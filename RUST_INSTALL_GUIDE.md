# Rust インストールガイド (Windows)

Tauriアプリケーションを開発・ビルドするには、Rustのインストールが必要です。

## インストール手順

### 1. Visual Studio C++ Build Tools のインストール

Rustをビルドするために必要です。

**方法A: Visual Studio Installer から（推奨）**
1. [Visual Studio Build Tools](https://visualstudio.microsoft.com/ja/downloads/) をダウンロード
2. 「Build Tools for Visual Studio 2022」をインストール
3. インストーラーで以下をチェック：
   - ✅ C++ によるデスクトップ開発
   - ✅ Windows 10 SDK

**方法B: winget から**
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

### 2. Rust のインストール

1. [Rustup公式サイト](https://rustup.rs/) にアクセス
2. Windows用のインストーラー `rustup-init.exe` をダウンロード
3. インストーラーを実行
4. プロンプトが表示されたら `1` を入力（デフォルト設定）

または、PowerShellで：
```powershell
# Rustupのインストール
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe
```

### 3. インストールの確認

新しいターミナルを開いて以下を実行：

```bash
# Rustのバージョン確認
rustc --version

# Cargoのバージョン確認
cargo --version
```

以下のような出力が表示されればOKです：
```
rustc 1.75.0 (82e1608df 2023-12-21)
cargo 1.75.0 (1d8b05cdd 2023-11-20)
```

### 4. WebView2 Runtime の確認

Windows 10/11には通常プリインストールされていますが、念のため確認：

1. `edge://settings/help` をEdgeブラウザで開く
2. バージョン情報が表示されればOK

または、[Microsoft Edge WebView2](https://developer.microsoft.com/ja-jp/microsoft-edge/webview2/) から手動インストール

## Tauri開発の開始

Rustインストール後、以下のコマンドでTauri開発環境を起動できます：

```bash
# 初回は依存関係のビルドに時間がかかります（5-10分程度）
npm run tauri:dev
```

## トラブルシューティング

### エラー: "program not found"

**原因**: Rustがインストールされていない、またはPATHが通っていない

**解決策**:
1. ターミナルを再起動
2. `cargo --version` で確認
3. それでも認識されない場合は、Rustを再インストール

### エラー: "linker 'link.exe' not found"

**原因**: Visual Studio C++ Build Toolsがインストールされていない

**解決策**:
1. Visual Studio Build Toolsをインストール
2. 「C++ によるデスクトップ開発」を選択
3. PCを再起動

### エラー: "failed to run custom build command"

**原因**: WebView2がインストールされていない

**解決策**:
1. Microsoft Edge WebView2 Runtimeをインストール
2. Windowsを最新版にアップデート

## 開発環境の選択

### ブラウザ開発環境 (`npm run dev`)
- ✅ Rustインストール不要
- ✅ 高速起動
- ✅ AI機能は完全動作（本修正により）
- ❌ Tauri固有機能は使用不可

### Tauri開発環境 (`npm run tauri:dev`)
- ⚠️ Rustインストール必要
- ⚠️ 初回起動は時間がかかる
- ✅ デスクトップアプリとして動作
- ✅ すべての機能が使用可能

## 推奨事項

**一般的な開発作業**: `npm run dev` を使用
- フロントエンド開発
- UI/UXの調整
- AI機能のテスト

**Tauri固有の機能開発**: `npm run tauri:dev` を使用
- ファイルシステムアクセス
- システムトレイ機能
- ウィンドウ管理
- 最終的な動作確認

**本番リリース**: `npm run tauri:build`
- 実行可能ファイルの生成
- インストーラーの作成

