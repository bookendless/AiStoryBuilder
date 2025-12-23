// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// デバッグ用: 一時的にコンソールを有効化する場合は以下の行をコメントアウト
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // エラーハンドリングを改善
    if let Err(error) = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
    {
        eprintln!("Tauri application error: {:?}", error);
        std::process::exit(1);
    }
}
