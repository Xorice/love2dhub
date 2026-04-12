mod commands;
mod models;
mod runtime_cache;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_love2d_releases,
            commands::list_cached_runtimes,
            commands::download_runtime,
            commands::delete_runtime,
            commands::open_runtime_dir,
            commands::open_runtime_version_dir,
            commands::build_game,
            commands::list_packages,
            commands::run_package,
            commands::open_package_dir,
            commands::delete_package,
            commands::get_host_platform,
            commands::get_default_dirs,
            commands::open_path,
            commands::read_file_as_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
