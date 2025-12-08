# Tauri 2 セットアップガイド

このプロジェクトはTauri 2を使用してデスクトップアプリケーションとしてビルドできます。

## 前提条件

### 1. Rustのインストール
```bash
# Rustをインストール（まだインストールしていない場合）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# または Windowsの場合
# https://rustup.rs/ からインストーラーをダウンロード
```

### 2. システム依存関係

#### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2 (通常はWindows 10/11にプリインストール済み)

#### macOS
```bash
# Xcode Command Line Tools
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

## 開発環境のセットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Tauri開発サーバーの起動
```bash
npm run tauri:dev
```

これにより以下が実行されます：
- Vite開発サーバーの起動（ポート5173）
- Tauriアプリケーションの起動
- ホットリロードが有効

## ビルド

### デバッグビルド
```bash
npm run tauri:build
```

### リリースビルド
```bash
npm run tauri:build -- --mode release
```

## ローカルLLM接続

Tauri 2では`@tauri-apps/plugin-http`を使用してローカルLLMに接続できます。

### 設定方法

1. **LM Studio** または **Ollama** を起動
2. アプリケーションの設定でローカルエンドポイントを指定：
   - LM Studio: `http://localhost:1234`
   - Ollama: `http://localhost:11434`

### 接続テスト

```bash
npm run check:local
```

## トラブルシューティング

### よくある問題

1. **Rustコンパイルエラー**
   ```bash
   # Rustツールチェーンを更新
   rustup update
   ```

2. **WebView2エラー（Windows）**
   - Microsoft Edge WebView2ランタイムを最新版に更新

3. **macOS署名エラー**
   ```bash
   # 開発用署名を無効化
   npm run tauri:build -- --no-bundle
   ```

4. **Linux依存関係エラー**
   ```bash
   # 必要なパッケージをインストール
   sudo apt install libwebkit2gtk-4.0-dev libgtk-3-dev
   ```

### ログの確認

開発モードでは、ブラウザの開発者ツールでログを確認できます。

## パフォーマンス最適化

### ビルドサイズの削減

1. **デッドコード削除**
   ```bash
   # Cargo.tomlで最適化設定を有効化
   [profile.release]
   opt-level = "s"
   lto = true
   ```

2. **フロントエンド最適化**
   - 不要な依存関係の削除
   - コード分割の活用

## 配布

### Windows
- `.exe`ファイルが生成されます
- MSIインストーラーも作成可能

### macOS
- `.app`バンドルが生成されます
- DMGファイルも作成可能

### Linux
- `.deb`、`.rpm`、`.AppImage`形式で配布可能

## セキュリティ

Tauri 2では以下のセキュリティ機能が利用できます：

- **CSP (Content Security Policy)**
- **API許可リスト**
- **ファイルシステムアクセス制限**
- **ネットワークアクセス制限**

詳細は`src-tauri/tauri.conf.json`の`allowlist`設定を確認してください。


