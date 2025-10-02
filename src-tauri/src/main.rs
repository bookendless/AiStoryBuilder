// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tokio::sync::Mutex;

// アプリケーションの状態管理
#[derive(Default)]
pub struct AppState {
    pub projects: Mutex<HashMap<String, Project>>,
    pub current_project: Mutex<Option<String>>,
}

// プロジェクト構造
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub characters: Vec<Character>,
    pub plot: Option<Plot>,
    pub synopsis: Option<String>,
    pub chapters: Vec<Chapter>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub age: Option<i32>,
    pub description: String,
    pub role: String,
    pub personality: String,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plot {
    pub id: String,
    pub title: String,
    pub genre: String,
    pub theme: String,
    pub setting: String,
    pub conflict: String,
    pub resolution: String,
    pub acts: Vec<Act>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Act {
    pub id: String,
    pub title: String,
    pub description: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub title: String,
    pub content: String,
    pub order: i32,
    pub word_count: i32,
}

// AI設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub provider: String,
    pub api_key: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: i32,
}

// エラーハンドリング
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("プロジェクトが見つかりません: {0}")]
    ProjectNotFound(String),
    #[error("AI設定エラー: {0}")]
    AIConfigError(String),
    #[error("ファイル操作エラー: {0}")]
    FileError(String),
    #[error("データベースエラー: {0}")]
    DatabaseError(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Tauriコマンド
#[tauri::command]
async fn create_project(
    title: String,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<Project, AppError> {
    let project_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let project = Project {
        id: project_id.clone(),
        title,
        description,
        characters: Vec::new(),
        plot: None,
        synopsis: None,
        chapters: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
    };
    
    let mut projects = state.projects.lock().await;
    projects.insert(project_id.clone(), project.clone());
    
    Ok(project)
}

#[tauri::command]
async fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, AppError> {
    let projects = state.projects.lock().await;
    Ok(projects.values().cloned().collect())
}

#[tauri::command]
async fn get_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Project, AppError> {
    let projects = state.projects.lock().await;
    projects
        .get(&project_id)
        .cloned()
        .ok_or_else(|| AppError::ProjectNotFound(project_id))
}

#[tauri::command]
async fn update_project(
    project_id: String,
    project: Project,
    state: State<'_, AppState>,
) -> Result<Project, AppError> {
    let mut projects = state.projects.lock().await;
    
    if !projects.contains_key(&project_id) {
        return Err(AppError::ProjectNotFound(project_id));
    }
    
    let mut updated_project = project;
    updated_project.updated_at = chrono::Utc::now().to_rfc3339();
    
    projects.insert(project_id.clone(), updated_project.clone());
    Ok(updated_project)
}

#[tauri::command]
async fn delete_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut projects = state.projects.lock().await;
    
    if projects.remove(&project_id).is_none() {
        return Err(AppError::ProjectNotFound(project_id));
    }
    
    Ok(())
}

#[tauri::command]
async fn generate_ai_content(
    prompt: String,
    config: AIConfig,
) -> Result<String, AppError> {
    // AI コンテンツ生成の実装
    // 実際の実装では、OpenAI、Claude、またはローカルLLMを使用
    match config.provider.as_str() {
        "openai" => {
            // OpenAI APIの実装
            Ok(format!("AI生成コンテンツ: {}", prompt))
        }
        "claude" => {
            // Claude APIの実装
            Ok(format!("AI生成コンテンツ: {}", prompt))
        }
        "local" => {
            // ローカルLLMの実装
            Ok(format!("ローカルAI生成コンテンツ: {}", prompt))
        }
        _ => Err(AppError::AIConfigError("サポートされていないAIプロバイダー".to_string())),
    }
}

#[tauri::command]
async fn export_project(
    project_id: String,
    format: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let projects = state.projects.lock().await;
    let project = projects
        .get(&project_id)
        .ok_or_else(|| AppError::ProjectNotFound(project_id))?;
    
    match format.as_str() {
        "txt" => {
            let mut content = String::new();
            content.push_str(&format!("タイトル: {}\n", project.title));
            if let Some(desc) = &project.description {
                content.push_str(&format!("説明: {}\n", desc));
            }
            
            for chapter in &project.chapters {
                content.push_str(&format!("\n## {}\n", chapter.title));
                content.push_str(&chapter.content);
            }
            
            Ok(content)
        }
        "json" => {
            let json = serde_json::to_string_pretty(project)
                .map_err(|e| AppError::FileError(format!("JSON変換エラー: {}", e)))?;
            Ok(json)
        }
        _ => Err(AppError::FileError("サポートされていないエクスポート形式".to_string())),
    }
}

// ローカルLLMプロキシ関数
#[tauri::command]
async fn proxy_local_llm_request(
    endpoint: String,
    body: String,
    headers: HashMap<String, String>,
) -> Result<String, String> {
    println!("🔄 ローカルLLMプロキシリクエスト開始");
    println!("📍 エンドポイント: {}", endpoint);
    
    // reqwestクライアントを作成（タイムアウト設定付き）
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("クライアント作成エラー: {}", e))?;
    
    // リクエストビルダーを作成
    let mut request_builder = client.post(&endpoint);
    
    // ヘッダーを追加
    for (key, value) in headers {
        request_builder = request_builder.header(&key, &value);
    }
    
    // リクエストを送信
    let response = request_builder
        .body(body.clone())
        .send()
        .await
        .map_err(|e| {
            println!("❌ リクエスト送信エラー: {}", e);
            if e.is_timeout() {
                "ローカルLLMサーバーへの接続がタイムアウトしました。サーバーが起動しているか確認してください。".to_string()
            } else if e.is_connect() {
                "ローカルLLMサーバーに接続できません。サーバーが起動しているか、エンドポイントが正しいか確認してください。".to_string()
            } else {
                format!("リクエスト送信エラー: {}", e)
            }
        })?;
    
    println!("📊 レスポンスステータス: {}", response.status());
    
    // レスポンスボディを読み取り
    let response_text = response
        .text()
        .await
        .map_err(|e| {
            println!("❌ レスポンス読み取りエラー: {}", e);
            format!("レスポンス読み取りエラー: {}", e)
        })?;
    
    println!("✅ ローカルLLMプロキシリクエスト完了");
    println!("📝 レスポンス長: {} 文字", response_text.len());
    
    Ok(response_text)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            create_project,
            get_projects,
            get_project,
            update_project,
            delete_project,
            generate_ai_content,
            export_project,
            proxy_local_llm_request
        ])
        .setup(|_app| {
            // アプリケーション初期化
            println!("AI Story Builder が起動しました");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}