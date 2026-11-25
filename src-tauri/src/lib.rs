mod desktop_auth;
mod font_activator;

use font_activator::FontActivatorState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FontActivatorState::default())
        .invoke_handler(tauri::generate_handler![
            font_activator::get_os_font_status,
            font_activator::activate_google_font,
            font_activator::activate_font_binary,
            font_activator::activate_cached_font,
            font_activator::deactivate_os_font,
            font_activator::open_os_fonts_folder,
            font_activator::scan_system_fonts,
            desktop_auth::start_desktop_auth_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fontainer desktop application");
}
