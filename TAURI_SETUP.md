# Tauri 2 セットアップガイド

このプロジェクトはTauri 2を使用してデスクトップアプリケーションおよびAndroidアプリケーションとしてビルドできます。

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

#### Android
Androidアプリのビルドには以下が必要です：

1. **Java JDK 17以上**
   - Oracle JDKまたはOpenJDKをインストール
   - `JAVA_HOME`環境変数を設定

2. **Android Studio**
   - [Android Studio](https://developer.android.com/studio)をダウンロードしてインストール
   - Android SDK、Android SDK Platform-Tools、NDK (Side by side)、Android SDK Build-Toolsをインストール
   - `ANDROID_HOME`環境変数を設定（通常は `~/Android/Sdk` または `%LOCALAPPDATA%\Android\Sdk`）

3. **環境変数の設定**
   ```bash
   # Windows (PowerShell)
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:PATH"

   # Linux/macOS
   export JAVA_HOME=/path/to/jdk-17
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH
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

## Androidビルド

### Android開発環境の初期化

初回のみ、Androidプロジェクトを初期化する必要があります：

```bash
npm run tauri:android:init
```

これにより、`src-tauri/gen/android`ディレクトリが作成されます。

### Android開発サーバーの起動

```bash
npm run tauri:dev:android
```

これにより以下が実行されます：
- Vite開発サーバーの起動
- Androidエミュレータまたは接続されたデバイスにアプリがインストールされます
- ホットリロードが有効

### Androidビルド

#### APKのビルド
```bash
npm run tauri:build:android
```

ビルドされたAPKは `src-tauri/gen/android/app/build/outputs/apk/` に生成されます。

#### AAB（Android App Bundle）のビルド

Google Playに公開する場合はAAB形式をビルドします：

```bash
npm run tauri:build:android -- --bundles aab
```

AABファイルは `src-tauri/gen/android/app/build/outputs/bundle/` に生成されます。

### Android固有の設定

`src-tauri/tauri.conf.json`でAndroid固有の設定が可能です：

- **最小SDKバージョン**: `app.android.minSdkVersion` (デフォルト: 21)
- **ターゲットSDKバージョン**: `app.android.targetSdkVersion` (デフォルト: 33)
- **権限**: `app.android.permissions`で必要な権限を指定

### Android権限

現在のアプリでは以下の権限が設定されています：

- `INTERNET`: ネットワークアクセス（クラウドAI API使用）
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`: ファイルエクスポート機能
- `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` / `READ_MEDIA_AUDIO`: メディアファイルアクセス（将来の機能用）

### Androidでのファイルエクスポート

Android環境では、ファイルシステムへの直接アクセスが制限されているため、以下の方法でファイルをエクスポートします：

1. **Share API**: Androidのシステム共有機能を使用（推奨）
2. **ブラウザダウンロード**: Share APIが使用できない場合のフォールバック

コードは自動的に環境を検出し、適切な方法を選択します。

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

5. **Androidビルドエラー**
   ```bash
   # Android SDKパスの確認
   echo $ANDROID_HOME
   
   # Javaバージョンの確認
   java -version
   
   # 必要なSDKコンポーネントの確認
   # Android StudioのSDK Managerで以下がインストールされているか確認：
   # - Android SDK Platform (API 33以上)
   # - Android SDK Build-Tools
   # - NDK (Side by side)
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

### Android
- **APK**: 直接インストール用
- **AAB**: Google Play Store配布用（推奨）

#### Google Play Storeへの公開

1. **Google Play Console**でデベロッパーアカウントを作成（初回登録料: $25）
2. **アプリ署名キー**を作成して設定
3. AABファイルをアップロード
4. ストアリスティング情報を入力
5. 審査提出（通常1週間以内に完了）

## セキュリティ

Tauri 2では以下のセキュリティ機能が利用できます：

- **CSP (Content Security Policy)**
- **API許可リスト**
- **ファイルシステムアクセス制限**
- **ネットワークアクセス制限**

詳細は`src-tauri/tauri.conf.json`の`allowlist`設定を確認してください。


