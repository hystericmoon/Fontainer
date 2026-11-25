mod desktop_auth;
mod font_activator;

use font_activator::FontActivatorState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(FontActivatorState::default())
        .setup(|app| {
            // Start background watched-folder auto-activator
            font_activator::start_watched_folder_poller(app.handle().clone());

            // Build native macOS Menu Bar / Windows System Tray icon
            let show_item = MenuItem::with_id(app, "show", "Show Fontainer", true, None::<&str>)?;
            let quick_item = MenuItem::with_id(
                app,
                "quick_switcher",
                "Quick Switcher",
                true,
                None::<&str>,
            )?;
            let folder_item = MenuItem::with_id(
                app,
                "open_fonts_dir",
                "Open OS Fonts Folder",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Fontainer", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quick_item, &folder_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Fontainer — Font Manager")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quick_switcher" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                        let _ = app.emit("open-quick-switcher", ());
                    }
                    "open_fonts_dir" => {
                        let _ = font_activator::open_os_fonts_folder();
                    }
                    "quit" => {
                        font_activator::cleanup_temporary_fonts(app);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            font_activator::get_os_font_status,
            font_activator::set_session_only_mode,
            font_activator::activate_google_font,
            font_activator::activate_fontshare_font,
            font_activator::activate_url_font,
            font_activator::activate_font_binary,
            font_activator::activate_cached_font,
            font_activator::deactivate_os_font,
            font_activator::open_os_fonts_folder,
            font_activator::scan_system_fonts,
            font_activator::batch_activate_drive_fonts,
            font_activator::batch_activate_google_fonts,
            font_activator::cancel_batch_activation,
            font_activator::batch_deactivate_os_fonts,
            font_activator::detect_local_google_drive_folders,
            font_activator::activate_local_drive_folder_zero_copy,
            font_activator::list_watched_folders,
            font_activator::watch_local_folder,
            font_activator::unwatch_local_folder,
            desktop_auth::start_desktop_auth_session,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Fontainer desktop application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            font_activator::cleanup_temporary_fonts(app_handle);
        }
    });
}
