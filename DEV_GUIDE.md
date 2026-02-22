# 開発環境ガイド

このドキュメントは、AI Story Builder の開発およびビルドに関する技術的なガイドです。

## 🛠 技術スタック

本プロジェクトは以下の技術で構築されています：

- **Frontend Core**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust backend)
- **Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **AI Integration**: OpenAI SDK, Google Generative AI SDK, Anthropic SDK (Axios), xAI Grok (OpenAI compatible)

## 🚀 開発環境のセットアップ

### 前提条件

- **Node.js**: v20以上推奨
- **Rust**: Tauri（デスクトップアプリ）のビルドに必要
  - Windows: `winget install Rustlang.Rustup` または公式サイトからインストーラーを使用
  - Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/bookendless/aistorybuilder.git
cd aistorybuilder
npm install
```

### 2. 開発サーバーの起動

#### ブラウザモード（UI開発推奨）
Rustのビルドを待たずに素早くUI開発を行えます。

```bash
npm run dev
```
- アクセス: `http://localhost:5173`
- ブラウザモードでもプロキシ設定により、ローカルLLMへの接続が可能です。

#### デスクトップアプリモード (Tauri)
実際のデスクトップアプリとして動作確認する場合に使用します。

```bash
npm run tauri:dev
```

#### Androidアプリモード (Tauri)
Android実機またはエミュレーターでの動作確認に使用します。
（Android StudioおよびSDKの設定が必要です）

```bash
npm run tauri:dev:android
```

## 🔑 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成することで、APIキー等を自動読み込みできます。

```bash
# OpenAI / xAI Grok (OpenAI compatible)
VITE_OPENAI_API_KEY=sk-xxx

# Anthropic Claude
VITE_CLAUDE_API_KEY=sk-ant-xxx

# Google Gemini
VITE_GEMINI_API_KEY=xxx

# Local LLM Endpoint (Default)
VITE_LOCAL_LLM_ENDPOINT=http://localhost:11434/v1
```

## 🏗 ビルドとデプロイ

### Webアプリケーションとしてビルド

```bash
npm run build
# プレビュー
npm run preview
```

### デスクトップアプリ (Windows/Linux) としてビルド

```bash
npm run tauri:build
```
ビルド成果物は `src-tauri/target/release/bundle/` 配下に生成されます（Windowsなら `.exe` や `.msi`）。

### Androidアプリとしてビルド

```bash
# デバッグビルド（APKが必要な場合は -- --apk を付与）
npm run tauri:build:android

# リリース（署名付き）APK
npm run tauri:build:android:release
```

※ 初回は `npm run tauri:android:init` で Android プロジェクトを生成してください。詳細は `docs/TAURI_ANDROID_BUILD_STATUS.md` を参照。

## 🐛 デバッグとトラブルシューティング

### ローカルLLM (Ollama/LM Studio) への接続

開発モード（`npm run dev`）では、CORS制限を回避するためにViteのプロキシ設定が利用されます。
アプリ内のAI設定でエンドポイントを以下のように指定してください（通常はデフォルトで認識されます）：

- **Ollama**: `http://localhost:11434`
- **LM Studio**: `http://localhost:1234`

### Tauriビルドエラー

Rust周りのエラーが発生した場合：
1. `rustup update` でRustを最新版に更新してください。
2. `src-tauri/target` ディレクトリを削除してクリーンビルドを試してください。

## 📁 ディレクトリ構造

- `src/`: フロントエンドのソースコード
  - `components/`: Reactコンポーネント
  - `services/`: AI呼び出し、DB操作などのロジック層
  - `types/`: TypeScript型定義
  - `hooks/`: カスタムHooks
- `src-tauri/`: Tauriバックエンド（Rust）の設定とコード
- `scripts/`: ビルド補助スクリプト

---
より詳細な仕様については、ソースコードおよび `package.json` を参照してください。
