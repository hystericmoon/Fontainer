use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Serializes manifest reads/writes and OS font operations across concurrent IPC calls.
pub struct FontActivatorState {
    pub lock: Mutex<()>,
}

impl Default for FontActivatorState {
    fn default() -> Self {
        Self {
            lock: Mutex::new(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleFontStyleInput {
    pub weight: u16,
    pub italic: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledFontFile {
    pub file_name: String,
    pub installed_path: String,
    pub registry_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFontEntry {
    pub font_id: String,
    pub display_name: String,
    pub source: String,
    pub files: Vec<InstalledFontFile>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivatorManifest {
    version: u32,
    entries: HashMap<String, ManifestFontEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OsFontStatus {
    pub platform: String,
    pub fonts_dir: String,
    pub active_font_ids: Vec<String>,
    pub active_file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationResult {
    pub font_id: String,
    pub installed: bool,
    pub already_active: bool,
    pub file_count: usize,
    pub fonts_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeactivationResult {
    pub font_id: String,
    pub removed_files: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSystemStyle {
    pub name: String,
    pub weight: u16,
    pub italic: bool,
    pub post_script_name: String,
    pub file_size_kb: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSystemFont {
    pub family: String,
    pub format: String,
    pub source_path: String,
    pub styles: Vec<ScannedSystemStyle>,
}

/// Returns the current OS platform label.
pub fn current_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "linux"
    }
}

/// Returns the per-user OS fonts folder:
/// - macOS: ~/Library/Fonts
/// - Windows: %LOCALAPPDATA%\Microsoft\Windows\Fonts
/// - Linux fallback: ~/.local/share/fonts
pub fn resolve_os_fonts_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or_else(|| "Unable to determine macOS home directory".to_string())?;
        Ok(home.join("Library").join("Fonts"))
    }
    #[cfg(target_os = "windows")]
    {
        let local_app_data = dirs::data_local_dir()
            .ok_or_else(|| "Unable to determine Windows LOCALAPPDATA directory".to_string())?;
        Ok(local_app_data.join("Microsoft").join("Windows").join("Fonts"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let data_dir = dirs::data_local_dir()
            .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
            .ok_or_else(|| "Unable to determine user fonts directory".to_string())?;
        Ok(data_dir.join("fonts"))
    }
}

fn resolve_manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    Ok(data_dir.join("activated_fonts_manifest.json"))
}

fn resolve_font_cache_dir(app: &AppHandle, safe_font_id: &str) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    let cache_dir = data_dir.join("font-cache").join(safe_font_id);
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create font cache directory: {e}"))?;
    Ok(cache_dir)
}

pub fn sanitize_segment(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('_');
    if trimmed.is_empty() {
        "font".to_string()
    } else {
        trimmed.chars().take(96).collect()
    }
}

fn load_manifest(path: &Path) -> ActivatorManifest {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str::<ActivatorManifest>(&contents).unwrap_or(ActivatorManifest {
            version: 1,
            entries: HashMap::new(),
        }),
        Err(_) => ActivatorManifest {
            version: 1,
            entries: HashMap::new(),
        },
    }
}

fn save_manifest(path: &Path, manifest: &ActivatorManifest) -> Result<(), String> {
    let serialized = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize font manifest: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, serialized)
        .map_err(|e| format!("Failed to write temporary manifest: {e}"))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to commit manifest: {e}"))
}

// ============================================================================
// Platform-Specific OS Registration (macOS CoreText & Windows GDI + HKCU Reg)
// ============================================================================

#[cfg(target_os = "macos")]
mod platform_os {
    use std::ffi::c_void;
    use std::os::unix::ffi::OsStrExt;
    use std::path::Path;
    use std::ptr;

    const K_CT_FONT_MANAGER_SCOPE_PERSISTENT: u32 = 2;

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFURLCreateFromFileSystemRepresentation(
            allocator: *const c_void,
            buffer: *const u8,
            buf_len: isize,
            is_directory: u8,
        ) -> *const c_void;
        fn CFRelease(cf: *const c_void);
    }

    #[link(name = "CoreText", kind = "framework")]
    extern "C" {
        fn CTFontManagerRegisterFontsForURL(
            font_url: *const c_void,
            scope: u32,
            error: *mut *const c_void,
        ) -> u8;
        fn CTFontManagerUnregisterFontsForURL(
            font_url: *const c_void,
            scope: u32,
            error: *mut *const c_void,
        ) -> u8;
    }

    pub fn register_font(path: &Path, _display_name: &str) -> Result<Option<String>, String> {
        let bytes = path.as_os_str().as_bytes();
        unsafe {
            let url = CFURLCreateFromFileSystemRepresentation(
                ptr::null(),
                bytes.as_ptr(),
                bytes.len() as isize,
                0,
            );
            if url.is_null() {
                return Err(format!("Failed to create CFURL for {}", path.display()));
            }
            // Note: fontd watches ~/Library/Fonts automatically; CoreText registration makes the
            // font appear instantaneously in already-running apps. If fontd already registered it,
            // CTFontManagerRegisterFontsForURL returns false — that's harmless since the file is in place.
            let _ = CTFontManagerRegisterFontsForURL(
                url,
                K_CT_FONT_MANAGER_SCOPE_PERSISTENT,
                ptr::null_mut(),
            );
            CFRelease(url);
        }
        Ok(None)
    }

    pub fn unregister_font(path: &Path, _registry_name: Option<&str>) {
        let bytes = path.as_os_str().as_bytes();
        unsafe {
            let url = CFURLCreateFromFileSystemRepresentation(
                ptr::null(),
                bytes.as_ptr(),
                bytes.len() as isize,
                0,
            );
            if !url.is_null() {
                let _ = CTFontManagerUnregisterFontsForURL(
                    url,
                    K_CT_FONT_MANAGER_SCOPE_PERSISTENT,
                    ptr::null_mut(),
                );
                CFRelease(url);
            }
        }
    }

    pub fn broadcast_font_change() {
        // CoreText notifies running macOS apps automatically.
    }
}

#[cfg(target_os = "windows")]
mod platform_os {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use std::ptr;
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::Graphics::Gdi::{AddFontResourceW, RemoveFontResourceW};
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW,
        HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
    };

    const FONTS_REG_SUBKEY: &str = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

    fn to_wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    fn path_to_wide_null(path: &Path) -> Vec<u16> {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn register_font(path: &Path, display_name: &str) -> Result<Option<String>, String> {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("ttf")
            .to_ascii_lowercase();
        let format_suffix = if ext == "otf" { "OpenType" } else { "TrueType" };
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(display_name);
        let reg_value_name = format!("{display_name} [{stem}] ({format_suffix})");

        let subkey_w = to_wide_null(FONTS_REG_SUBKEY);
        let value_name_w = to_wide_null(&reg_value_name);
        let full_path_w = path_to_wide_null(path);

        unsafe {
            let mut hkey: HKEY = ptr::null_mut();
            let status = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                subkey_w.as_ptr(),
                0,
                ptr::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_SET_VALUE,
                ptr::null(),
                &mut hkey,
                ptr::null_mut(),
            );
            if status == ERROR_SUCCESS {
                let byte_len = (full_path_w.len() * std::mem::size_of::<u16>()) as u32;
                let _ = RegSetValueExW(
                    hkey,
                    value_name_w.as_ptr(),
                    0,
                    REG_SZ,
                    full_path_w.as_ptr() as *const u8,
                    byte_len,
                );
                RegCloseKey(hkey);
            }

            let _ = AddFontResourceW(full_path_w.as_ptr());
        }

        Ok(Some(reg_value_name))
    }

    pub fn unregister_font(path: &Path, registry_name: Option<&str>) {
        let full_path_w = path_to_wide_null(path);
        unsafe {
            let _ = RemoveFontResourceW(full_path_w.as_ptr());

            if let Some(reg_name) = registry_name {
                let subkey_w = to_wide_null(FONTS_REG_SUBKEY);
                let value_name_w = to_wide_null(reg_name);
                let mut hkey: HKEY = ptr::null_mut();
                let status = RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    subkey_w.as_ptr(),
                    0,
                    KEY_SET_VALUE,
                    &mut hkey,
                );
                if status == ERROR_SUCCESS {
                    let _ = RegDeleteValueW(hkey, value_name_w.as_ptr());
                    RegCloseKey(hkey);
                }
            }
        }
    }

    pub fn broadcast_font_change() {
        unsafe {
            let mut _result: usize = 0;
            let _ = SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_FONTCHANGE,
                0,
                0,
                SMTO_ABORTIFHUNG,
                2000,
                &mut _result,
            );
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform_os {
    use std::path::Path;

    pub fn register_font(_path: &Path, _display_name: &str) -> Result<Option<String>, String> {
        Ok(None)
    }

    pub fn unregister_font(_path: &Path, _registry_name: Option<&str>) {}

    pub fn broadcast_font_change() {
        let _ = std::process::Command::new("fc-cache").arg("-f").status();
    }
}

// ============================================================================
// Google Fonts CSS2 -> Direct .ttf URL Extractor
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedGoogleFontFace {
    weight: String,
    italic: bool,
    url: String,
}

fn encode_google_family(family: &str) -> String {
    let mut out = String::with_capacity(family.len() + 8);
    for b in family.trim().bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn build_google_css2_url(family_name: &str, styles: &[GoogleFontStyleInput]) -> String {
    let encoded = encode_google_family(family_name);
    if styles.is_empty() {
        return format!("https://fonts.googleapis.com/css2?family={encoded}&display=swap");
    }

    let mut normal_weights: Vec<u16> = styles
        .iter()
        .filter(|s| !s.italic)
        .map(|s| s.weight.clamp(100, 900))
        .collect();
    normal_weights.sort_unstable();
    normal_weights.dedup();

    let mut italic_weights: Vec<u16> = styles
        .iter()
        .filter(|s| s.italic)
        .map(|s| s.weight.clamp(100, 900))
        .collect();
    italic_weights.sort_unstable();
    italic_weights.dedup();

    if italic_weights.is_empty() {
        if normal_weights.is_empty() {
            return format!("https://fonts.googleapis.com/css2?family={encoded}&display=swap");
        }
        let list: Vec<String> = normal_weights.iter().map(|w| w.to_string()).collect();
        format!(
            "https://fonts.googleapis.com/css2?family={encoded}:wght@{}&display=swap",
            list.join(";")
        )
    } else {
        let mut tuples: Vec<String> = Vec::new();
        for w in normal_weights {
            tuples.push(format!("0,{w}"));
        }
        for w in italic_weights {
            tuples.push(format!("1,{w}"));
        }
        format!(
            "https://fonts.googleapis.com/css2?family={encoded}:ital,wght@{}&display=swap",
            tuples.join(";")
        )
    }
}

fn extract_google_ttf_faces(css: &str) -> Vec<ParsedGoogleFontFace> {
    let mut faces = Vec::new();
    let mut seen_urls = HashSet::new();

    for block in css.split("@font-face").skip(1) {
        let body = match block.find('{') {
            Some(start) => match block[start + 1..].find('}') {
                Some(end) => &block[start + 1..start + 1 + end],
                None => continue,
            },
            None => continue,
        };

        let mut weight = "400".to_string();
        let mut italic = false;
        let mut found_url: Option<String> = None;

        for line in body.split(';') {
            let trimmed = line.trim();
            let lower = trimmed.to_ascii_lowercase();
            if lower.starts_with("font-weight:") {
                let val = trimmed["font-weight:".len()..].trim();
                let digits: String = val
                    .chars()
                    .take_while(|c| c.is_ascii_digit() || *c == ' ')
                    .collect();
                let clean = digits.trim().replace(' ', "-");
                if !clean.is_empty() {
                    weight = clean;
                }
            } else if lower.starts_with("font-style:") {
                let val = lower["font-style:".len()..].trim();
                italic = val.contains("italic") || val.contains("oblique");
            } else if lower.starts_with("src:") {
                if let Some(url_start) = trimmed.find("url(") {
                    let after = &trimmed[url_start + 4..];
                    if let Some(url_end) = after.find(')') {
                        let raw_url = after[..url_end].trim().trim_matches('"').trim_matches('\'');
                        if is_safe_google_font_asset_url(raw_url) {
                            found_url = Some(raw_url.to_string());
                        }
                    }
                }
            }
        }

        if let Some(url) = found_url {
            if seen_urls.insert(url.clone()) {
                faces.push(ParsedGoogleFontFace { weight, italic, url });
            }
        }
    }

    faces
}

fn is_safe_google_font_asset_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    (lower.starts_with("https://fonts.gstatic.com/") || lower.starts_with("http://fonts.gstatic.com/"))
        && (lower.ends_with(".ttf") || lower.ends_with(".otf"))
}

fn install_files_into_os(
    fonts_dir: &Path,
    safe_font_id: &str,
    display_name: &str,
    source_files: &[(String, Vec<u8>)],
) -> Result<Vec<InstalledFontFile>, String> {
    fs::create_dir_all(fonts_dir)
        .map_err(|e| format!("Could not create OS Fonts directory {}: {e}", fonts_dir.display()))?;

    let mut installed = Vec::new();
    for (suffix_and_ext, bytes) in source_files {
        let file_name = format!("Fontainer_{safe_font_id}_{suffix_and_ext}");
        let dest_path = fonts_dir.join(&file_name);
        fs::write(&dest_path, bytes)
            .map_err(|e| format!("Failed to write font to {}: {e}", dest_path.display()))?;

        let registry_name = platform_os::register_font(&dest_path, display_name)?;
        installed.push(InstalledFontFile {
            file_name,
            installed_path: dest_path.to_string_lossy().to_string(),
            registry_name,
        });
    }

    platform_os::broadcast_font_change();
    Ok(installed)
}

fn list_cached_font_files(cache_dir: &Path) -> Vec<(String, Vec<u8>)> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let lower = name.to_ascii_lowercase();
        if !(lower.ends_with(".ttf") || lower.ends_with(".otf")) {
            continue;
        }
        if let Ok(bytes) = fs::read(&path) {
            if !bytes.is_empty() {
                files.push((name.to_string(), bytes));
            }
        }
    }
    files.sort_by(|a, b| a.0.cmp(&b.0));
    files
}

// ============================================================================
// Tauri IPC Commands
// ============================================================================

#[tauri::command]
pub fn get_os_font_status(
    app: AppHandle,
    state: tauri::State<'_, FontActivatorState>,
) -> Result<OsFontStatus, String> {
    let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
    let fonts_dir = resolve_os_fonts_dir()?;
    let manifest_path = resolve_manifest_path(&app)?;
    let mut manifest = load_manifest(&manifest_path);

    // Prune any entries whose files were manually deleted outside Fontainer
    let mut changed = false;
    manifest.entries.retain(|_, entry| {
        let all_exist = !entry.files.is_empty()
            && entry.files.iter().all(|f| Path::new(&f.installed_path).exists());
        if !all_exist {
            changed = true;
        }
        all_exist
    });
    if changed {
        let _ = save_manifest(&manifest_path, &manifest);
    }

    let mut active_font_ids: Vec<String> = manifest.entries.keys().cloned().collect();
    active_font_ids.sort();
    let active_file_count = manifest.entries.values().map(|e| e.files.len()).sum();

    Ok(OsFontStatus {
        platform: current_platform().to_string(),
        fonts_dir: fonts_dir.to_string_lossy().to_string(),
        active_font_ids,
        active_file_count,
    })
}

#[tauri::command]
pub async fn activate_google_font(
    app: AppHandle,
    state: tauri::State<'_, FontActivatorState>,
    font_id: String,
    family_name: String,
    styles: Vec<GoogleFontStyleInput>,
) -> Result<ActivationResult, String> {
    let safe_id = sanitize_segment(&font_id);
    let fonts_dir = resolve_os_fonts_dir()?;
    let manifest_path = resolve_manifest_path(&app)?;
    let cache_dir = resolve_font_cache_dir(&app, &safe_id)?;

    // Fast path: already active and on disk
    {
        let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
        let manifest = load_manifest(&manifest_path);
        if let Some(existing) = manifest.entries.get(&font_id) {
            if !existing.files.is_empty()
                && existing.files.iter().all(|f| Path::new(&f.installed_path).exists())
            {
                return Ok(ActivationResult {
                    font_id,
                    installed: true,
                    already_active: true,
                    file_count: existing.files.len(),
                    fonts_dir: fonts_dir.to_string_lossy().to_string(),
                });
            }
        }
    }

    // Check offline cache first
    let mut font_files = list_cached_font_files(&cache_dir);

    if font_files.is_empty() {
        let client = reqwest::Client::builder()
            .user_agent("Fontainer/1.0")
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

        let primary_url = build_google_css2_url(&family_name, &styles);
        let fallback_url = format!(
            "https://fonts.googleapis.com/css2?family={}&display=swap",
            encode_google_family(&family_name)
        );

        let css_text = match client.get(&primary_url).send().await {
            Ok(resp) if resp.status().is_success() => resp
                .text()
                .await
                .map_err(|e| format!("Failed to read Google Fonts CSS: {e}"))?,
            _ => {
                let fallback_resp = client
                    .get(&fallback_url)
                    .send()
                    .await
                    .map_err(|e| format!("Unable to reach Google Fonts: {e}"))?;
                if !fallback_resp.status().is_success() {
                    return Err(format!(
                        "Google Fonts returned HTTP {} for \"{}\"",
                        fallback_resp.status(),
                        family_name
                    ));
                }
                fallback_resp
                    .text()
                    .await
                    .map_err(|e| format!("Failed to read fallback Google Fonts CSS: {e}"))?
            }
        };

        let faces = extract_google_ttf_faces(&css_text);
        if faces.is_empty() {
            return Err(format!(
                "No downloadable desktop .ttf files were returned by Google Fonts for \"{}\".",
                family_name
            ));
        }

        for (idx, face) in faces.iter().enumerate() {
            let resp = client
                .get(&face.url)
                .send()
                .await
                .map_err(|e| format!("Failed downloading {} variant: {e}", family_name))?;
            if !resp.status().is_success() {
                continue;
            }
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| format!("Failed reading {} font bytes: {e}", family_name))?
                .to_vec();
            if bytes.len() < 256 {
                continue;
            }
            let ext = if face.url.to_ascii_lowercase().ends_with(".otf") {
                "otf"
            } else {
                "ttf"
            };
            let style_tag = if face.italic { "italic" } else { "normal" };
            let cache_name = format!("w{}_{}_{}.{}", face.weight, style_tag, idx, ext);
            let _ = fs::write(cache_dir.join(&cache_name), &bytes);
            font_files.push((cache_name, bytes));
        }

        if font_files.is_empty() {
            return Err(format!("Failed to download any valid font binaries for \"{}\".", family_name));
        }
    }

    // Install into OS Fonts dir + persist manifest under lock
    let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
    let installed = install_files_into_os(&fonts_dir, &safe_id, &family_name, &font_files)?;
    let mut manifest = load_manifest(&manifest_path);
    manifest.version = 1;
    manifest.entries.insert(
        font_id.clone(),
        ManifestFontEntry {
            font_id: font_id.clone(),
            display_name: family_name,
            source: "google".to_string(),
            files: installed.clone(),
        },
    );
    save_manifest(&manifest_path, &manifest)?;

    Ok(ActivationResult {
        font_id,
        installed: true,
        already_active: false,
        file_count: installed.len(),
        fonts_dir: fonts_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn activate_font_binary(
    app: AppHandle,
    state: tauri::State<'_, FontActivatorState>,
    font_id: String,
    display_name: String,
    file_name: String,
    base64_data: String,
) -> Result<ActivationResult, String> {
    let lower_name = file_name.to_ascii_lowercase();
    let ext = if lower_name.ends_with(".otf") {
        "otf"
    } else if lower_name.ends_with(".ttf") {
        "ttf"
    } else {
        return Err(
            "Web font formats (.woff/.woff2) preview inside Fontainer, but macOS and Windows require .ttf or .otf for system activation."
                .to_string(),
        );
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Invalid base64 font payload: {e}"))?;
    if bytes.len() < 128 {
        return Err("Font file appears empty or corrupted.".to_string());
    }

    let safe_id = sanitize_segment(&font_id);
    let safe_stem = sanitize_segment(
        Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&display_name),
    );
    let cache_name = format!("{safe_stem}.{ext}");

    let fonts_dir = resolve_os_fonts_dir()?;
    let manifest_path = resolve_manifest_path(&app)?;
    let cache_dir = resolve_font_cache_dir(&app, &safe_id)?;

    let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
    let _ = fs::write(cache_dir.join(&cache_name), &bytes);

    let files = vec![(cache_name, bytes)];
    let installed = install_files_into_os(&fonts_dir, &safe_id, &display_name, &files)?;

    let mut manifest = load_manifest(&manifest_path);
    manifest.version = 1;
    manifest.entries.insert(
        font_id.clone(),
        ManifestFontEntry {
            font_id: font_id.clone(),
            display_name,
            source: if font_id.starts_with("gdrive-") {
                "gdrive".to_string()
            } else {
                "local".to_string()
            },
            files: installed.clone(),
        },
    );
    save_manifest(&manifest_path, &manifest)?;

    Ok(ActivationResult {
        font_id,
        installed: true,
        already_active: false,
        file_count: installed.len(),
        fonts_dir: fonts_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn activate_cached_font(
    app: AppHandle,
    state: tauri::State<'_, FontActivatorState>,
    font_id: String,
    display_name: String,
) -> Result<ActivationResult, String> {
    let safe_id = sanitize_segment(&font_id);
    let fonts_dir = resolve_os_fonts_dir()?;
    let manifest_path = resolve_manifest_path(&app)?;
    let cache_dir = resolve_font_cache_dir(&app, &safe_id)?;

    let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
    let mut manifest = load_manifest(&manifest_path);

    if let Some(existing) = manifest.entries.get(&font_id) {
        if !existing.files.is_empty()
            && existing.files.iter().all(|f| Path::new(&f.installed_path).exists())
        {
            return Ok(ActivationResult {
                font_id,
                installed: true,
                already_active: true,
                file_count: existing.files.len(),
                fonts_dir: fonts_dir.to_string_lossy().to_string(),
            });
        }
    }

    let cached_files = list_cached_font_files(&cache_dir);
    if cached_files.is_empty() {
        return Ok(ActivationResult {
            font_id,
            installed: false,
            already_active: false,
            file_count: 0,
            fonts_dir: fonts_dir.to_string_lossy().to_string(),
        });
    }

    let installed = install_files_into_os(&fonts_dir, &safe_id, &display_name, &cached_files)?;
    manifest.version = 1;
    manifest.entries.insert(
        font_id.clone(),
        ManifestFontEntry {
            font_id: font_id.clone(),
            display_name,
            source: if font_id.starts_with("gdrive-") {
                "gdrive".to_string()
            } else {
                "local".to_string()
            },
            files: installed.clone(),
        },
    );
    save_manifest(&manifest_path, &manifest)?;

    Ok(ActivationResult {
        font_id,
        installed: true,
        already_active: false,
        file_count: installed.len(),
        fonts_dir: fonts_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn deactivate_os_font(
    app: AppHandle,
    state: tauri::State<'_, FontActivatorState>,
    font_id: String,
) -> Result<DeactivationResult, String> {
    let manifest_path = resolve_manifest_path(&app)?;
    let _guard = state.lock.lock().map_err(|_| "Activator lock poisoned".to_string())?;
    let mut manifest = load_manifest(&manifest_path);

    let Some(entry) = manifest.entries.remove(&font_id) else {
        return Ok(DeactivationResult {
            font_id,
            removed_files: 0,
        });
    };

    let mut removed = 0usize;
    for file in &entry.files {
        let path = Path::new(&file.installed_path);
        platform_os::unregister_font(path, file.registry_name.as_deref());
        if path.exists() && fs::remove_file(path).is_ok() {
            removed += 1;
        }
    }

    platform_os::broadcast_font_change();
    save_manifest(&manifest_path, &manifest)?;

    Ok(DeactivationResult {
        font_id,
        removed_files: removed,
    })
}

#[tauri::command]
pub fn open_os_fonts_folder() -> Result<String, String> {
    let dir = resolve_os_fonts_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to prepare OS fonts folder {}: {e}", dir.display()))?;
    open::that(&dir).map_err(|e| format!("Failed to open OS fonts folder: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

fn system_font_scan_dirs() -> Vec<PathBuf> {
    let mut dirs_to_scan = Vec::new();
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            dirs_to_scan.push(home.join("Library").join("Fonts"));
        }
        dirs_to_scan.push(PathBuf::from("/Library/Fonts"));
        dirs_to_scan.push(PathBuf::from("/System/Library/Fonts/Supplemental"));
        dirs_to_scan.push(PathBuf::from("/System/Library/Fonts"));
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(local) = dirs::data_local_dir() {
            dirs_to_scan.push(local.join("Microsoft").join("Windows").join("Fonts"));
        }
        let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
        dirs_to_scan.push(PathBuf::from(windir).join("Fonts"));
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(home) = dirs::home_dir() {
            dirs_to_scan.push(home.join(".local").join("share").join("fonts"));
        }
        dirs_to_scan.push(PathBuf::from("/usr/share/fonts"));
    }
    dirs_to_scan
}

fn parse_filename_family_and_style(stem: &str) -> (String, String, u16, bool) {
    let cleaned = stem.replace('_', " ");
    let parts: Vec<&str> = cleaned.splitn(2, '-').collect();
    let raw_family = parts[0].trim();
    let raw_style = if parts.len() > 1 { parts[1].trim() } else { "" };

    let lower = cleaned.to_ascii_lowercase();
    let italic = lower.contains("italic") || lower.contains("oblique");
    let weight = if lower.contains("thin") || lower.contains("hairline") {
        100
    } else if lower.contains("extralight") || lower.contains("ultralight") {
        200
    } else if lower.contains("light") {
        300
    } else if lower.contains("medium") {
        500
    } else if lower.contains("semibold") || lower.contains("demibold") || lower.contains("demi") {
        600
    } else if lower.contains("extrabold") || lower.contains("ultrabold") || lower.contains("heavy") {
        800
    } else if lower.contains("black") {
        900
    } else if lower.contains("bold") {
        700
    } else {
        400
    };

    // Insert spaces in CamelCase names like "HelveticaNeue" -> "Helvetica Neue"
    let mut spaced = String::with_capacity(raw_family.len() + 6);
    let chars: Vec<char> = raw_family.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if i > 0
            && c.is_uppercase()
            && chars[i - 1].is_lowercase()
            && !spaced.ends_with(' ')
        {
            spaced.push(' ');
        }
        spaced.push(c);
    }

    let family = spaced
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let final_family = if family.is_empty() {
        stem.to_string()
    } else {
        family
    };

    let style_name = if !raw_style.is_empty() {
        raw_style.to_string()
    } else {
        let base_w = match weight {
            100 => "Thin",
            200 => "ExtraLight",
            300 => "Light",
            500 => "Medium",
            600 => "SemiBold",
            700 => "Bold",
            800 => "ExtraBold",
            900 => "Black",
            _ => "Regular",
        };
        if italic {
            if weight == 400 {
                "Italic".to_string()
            } else {
                format!("{base_w} Italic")
            }
        } else {
            base_w.to_string()
        }
    };

    (final_family, style_name, weight, italic)
}

fn walk_font_dir(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 3 || out.len() >= 1500 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= 1500 {
            break;
        }
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name.starts_with('.') || name.starts_with("Fontainer_") {
            continue;
        }
        if path.is_dir() {
            walk_font_dir(&path, depth + 1, out);
        } else if path.is_file() {
            let lower = name.to_ascii_lowercase();
            if lower.ends_with(".ttf") || lower.ends_with(".otf") || lower.ends_with(".ttc") {
                out.push(path);
            }
        }
    }
}

/// Natively scans installed macOS / Windows / Linux system fonts without requiring Chromium's Local Font Access API.
#[tauri::command]
pub fn scan_system_fonts() -> Result<Vec<ScannedSystemFont>, String> {
    let mut file_paths = Vec::new();
    for dir in system_font_scan_dirs() {
        if dir.exists() {
            walk_font_dir(&dir, 0, &mut file_paths);
        }
    }

    let mut grouped: HashMap<String, ScannedSystemFont> = HashMap::new();

    for path in file_paths {
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("ttf")
            .to_ascii_uppercase();
        let format = if ext == "OTF" { "OTF" } else { "TTF" }.to_string();
        let size_kb = fs::metadata(&path)
            .map(|m| (m.len() / 1024).max(1))
            .unwrap_or(0);

        let (family, style_name, weight, italic) = parse_filename_family_and_style(stem);
        let key = family.to_ascii_lowercase();
        let ps_name = format!(
            "{}-{}",
            family.replace(' ', ""),
            style_name.replace(' ', "")
        );

        let entry = grouped.entry(key).or_insert_with(|| ScannedSystemFont {
            family: family.clone(),
            format: format.clone(),
            source_path: path.to_string_lossy().to_string(),
            styles: Vec::new(),
        });

        let already_has_style = entry
            .styles
            .iter()
            .any(|s| s.weight == weight && s.italic == italic && s.name.eq_ignore_ascii_case(&style_name));
        if !already_has_style {
            entry.styles.push(ScannedSystemStyle {
                name: style_name,
                weight,
                italic,
                post_script_name: ps_name,
                file_size_kb: size_kb,
            });
        }
    }

    let mut result: Vec<ScannedSystemFont> = grouped
        .into_values()
        .map(|mut f| {
            f.styles.sort_by(|a, b| a.weight.cmp(&b.weight).then(a.italic.cmp(&b.italic)));
            f
        })
        .collect();
    result.sort_by(|a, b| a.family.to_ascii_lowercase().cmp(&b.family.to_ascii_lowercase()));

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_google_css2_ttf_blocks() {
        let sample = r#"
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/v20/regular.ttf) format('truetype');
}
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/inter/v20/bold-italic.ttf) format('truetype');
}
"#;
        let faces = extract_google_ttf_faces(sample);
        assert_eq!(faces.len(), 2);
        assert_eq!(faces[0].weight, "400");
        assert!(!faces[0].italic);
        assert_eq!(faces[1].weight, "700");
        assert!(faces[1].italic);
    }

    #[test]
    fn rejects_non_gstatic_urls() {
        assert!(!is_safe_google_font_asset_url("https://evil.example.com/font.ttf"));
        assert!(!is_safe_google_font_asset_url("https://fonts.gstatic.com/s/inter/v20/a.woff2"));
        assert!(is_safe_google_font_asset_url("https://fonts.gstatic.com/s/inter/v20/a.ttf"));
    }

    #[test]
    fn sanitizes_path_traversal_segments() {
        assert_eq!(sanitize_segment("../../etc/passwd"), "etc_passwd");
        assert_eq!(sanitize_segment("gdrive-1AbC_xYz"), "gdrive-1AbC_xYz");
    }

    #[test]
    fn builds_css2_query_with_italics_and_weights() {
        let url = build_google_css2_url(
            "Playfair Display",
            &[
                GoogleFontStyleInput { weight: 400, italic: false },
                GoogleFontStyleInput { weight: 700, italic: true },
            ],
        );
        assert_eq!(
            url,
            "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,700&display=swap"
        );
    }
}
