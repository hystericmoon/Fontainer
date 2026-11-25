use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;
use tauri::Manager;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAuthTokens {
    pub id_token: String,
    pub access_token: Option<String>,
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                if let (Ok(hi), Ok(lo)) = (
                    u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 2]).unwrap_or(""), 16),
                    u8::from_str_radix(std::str::from_utf8(&bytes[i + 2..i + 3]).unwrap_or(""), 16),
                ) {
                    out.push((hi << 4) | lo);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

fn parse_form_urlencoded(body: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in body.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = percent_decode(parts.next().unwrap_or(""));
        let val = percent_decode(parts.next().unwrap_or(""));
        if !key.is_empty() {
            map.insert(key, val);
        }
    }
    map
}

fn html_response(status_line: &str, title: &str, message: &str, auto_close: bool) -> String {
    let close_script = if auto_close {
        r#"<script>setTimeout(function () { window.close(); }, 900);</script>"#
    } else {
        ""
    };
    let body = format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f6f6; color: #1b1b1b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    @media (prefers-color-scheme: dark) {{
      body {{ background: #161616; color: #f5f5f5; }}
      .card {{ background: #222; border-color: #333; }}
      .badge {{ background: #f5f5f5; color: #111; }}
      p {{ color: #aaa; }}
    }}
    .card {{ background: #fff; border: 1px solid #e5e5e5; border-radius: 14px; padding: 28px 32px; max-width: 400px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }}
    .badge {{ width: 40px; height: 40px; border-radius: 10px; background: #1b1b1b; color: #fff; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }}
    h1 {{ font-size: 17px; margin: 0 0 8px; }}
    p {{ font-size: 13px; color: #555; margin: 0; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">F</div>
    <h1>{title}</h1>
    <p>{message}</p>
  </div>
  {close_script}
</body>
</html>"#
    );
    format!(
        "HTTP/1.1 {status_line}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
}

async fn read_http_request(stream: &mut tokio::net::TcpStream) -> Result<(String, String), String> {
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 2048];
    let mut header_end: Option<usize> = None;
    let mut content_length: usize = 0;

    loop {
        let n = stream
            .read(&mut chunk)
            .await
            .map_err(|e| format!("Failed reading loopback auth callback: {e}"))?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > 64 * 1024 {
            return Err("Auth callback payload too large".to_string());
        }

        if header_end.is_none() {
            if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                header_end = Some(pos + 4);
                let headers_str = String::from_utf8_lossy(&buf[..pos]);
                for line in headers_str.lines() {
                    if let Some((k, v)) = line.split_once(':') {
                        if k.trim().eq_ignore_ascii_case("content-length") {
                            content_length = v.trim().parse::<usize>().unwrap_or(0);
                        }
                    }
                }
            }
        }

        if let Some(hend) = header_end {
            if buf.len() >= hend + content_length {
                break;
            }
        }
    }

    let hend = header_end.ok_or_else(|| "Malformed HTTP callback".to_string())?;
    let header_text = String::from_utf8_lossy(&buf[..hend]).to_string();
    let body_text = String::from_utf8_lossy(&buf[hend..]).to_string();
    Ok((header_text, body_text))
}

/// Launches the user's real system browser to sign in via Fontainer's hosted `/desktop-auth` page,
/// receives the Google OAuth credentials over a local one-shot loopback POST, and returns them to Tauri.
#[tauri::command]
pub async fn start_desktop_auth_session(
    app: tauri::AppHandle,
    auth_base_url: String,
    request_drive_scope: bool,
) -> Result<DesktopAuthTokens, String> {
    let trimmed_base = auth_base_url.trim().trim_end_matches('/');
    if !(trimmed_base.starts_with("https://")
        || trimmed_base.starts_with("http://localhost")
        || trimmed_base.starts_with("http://127.0.0.1"))
    {
        return Err("Invalid desktop auth base URL.".to_string());
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to start local sign-in listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to inspect local sign-in port: {e}"))?
        .port();

    let expected_state = Uuid::new_v4().simple().to_string();
    let drive_flag = if request_drive_scope { "1" } else { "0" };
    let auth_url = format!(
        "{trimmed_base}/desktop-auth?port={port}&state={expected_state}&drive={drive_flag}"
    );

    open::that(&auth_url).map_err(|e| format!("Could not open system browser for sign-in: {e}"))?;

    let wait_future = async {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|e| format!("Failed accepting sign-in callback: {e}"))?;

            let Ok((headers, body)) = read_http_request(&mut stream).await else {
                continue;
            };

            let request_line = headers.lines().next().unwrap_or("");
            if !request_line.starts_with("POST /callback") {
                let resp = html_response(
                    "404 Not Found",
                    "Waiting for Fontainer Sign-In",
                    "Complete sign-in in the Fontainer browser tab.",
                    false,
                );
                let _ = stream.write_all(resp.as_bytes()).await;
                continue;
            }

            let fields = parse_form_urlencoded(&body);
            let received_state = fields.get("state").cloned().unwrap_or_default();
            if received_state != expected_state {
                let resp = html_response(
                    "400 Bad Request",
                    "Sign-In Session Mismatch",
                    "This sign-in link expired or did not match. Please try again from Fontainer.",
                    false,
                );
                let _ = stream.write_all(resp.as_bytes()).await;
                return Err("Sign-in state mismatch. Please try again.".to_string());
            }

            if let Some(err_msg) = fields.get("error").filter(|e| !e.is_empty()) {
                let resp = html_response(
                    "200 OK",
                    "Sign-In Cancelled",
                    "You can close this tab and return to Fontainer.",
                    true,
                );
                let _ = stream.write_all(resp.as_bytes()).await;
                return Err(err_msg.clone());
            }

            let id_token = fields.get("idToken").cloned().unwrap_or_default();
            let access_token = fields
                .get("accessToken")
                .cloned()
                .filter(|t| !t.trim().is_empty());

            if id_token.is_empty() {
                let resp = html_response(
                    "400 Bad Request",
                    "Missing Google Credential",
                    "Google did not return an ID token. Please try signing in again.",
                    false,
                );
                let _ = stream.write_all(resp.as_bytes()).await;
                return Err("Missing Google ID token from desktop sign-in.".to_string());
            }

            let resp = html_response(
                "200 OK",
                "Signed in to Fontainer",
                "Returning to Fontainer… You can safely close this browser tab.",
                true,
            );
            let _ = stream.write_all(resp.as_bytes()).await;

            // Bring the Fontainer desktop app window right back to the front
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }

            return Ok(DesktopAuthTokens {
                id_token,
                access_token,
            });
        }
    };

    tokio::time::timeout(Duration::from_secs(180), wait_future)
        .await
        .map_err(|_| "Google sign-in timed out after 3 minutes. Please try again.".to_string())?
}
