# AI Story Builder

AIを活用した小説創作支援アプリケーションです。複数のAIプロバイダー（OpenAI、Claude、Gemini）に対応し、キャラクター設定から物語の執筆まで一貫してサポートします。

## 機能

- 🤖 複数のAIプロバイダー対応（OpenAI、Claude、Gemini、ローカルLLM）
- 👥 キャラクター設定と管理
- 📖 プロット構成とあらすじ生成
- ✍️ 章立て構成と執筆支援
- 🎨 ダークモード対応
- 📱 レスポンシブデザイン

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`ファイルをコピーして`.env.local`を作成し、APIキーを設定してください：

```bash
cp .env.example .env.local
```

`.env.local`ファイルを編集して、使用したいAIプロバイダーのAPIキーを設定：

```env
# OpenAI API設定
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Claude API設定
VITE_CLAUDE_API_KEY=your_claude_api_key_here

# Google Gemini API設定
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# ローカルLLM設定（オプション）
VITE_LOCAL_LLM_ENDPOINT=http://localhost:1234/v1/chat/completions
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

## APIキーの取得方法

### OpenAI
1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. アカウントを作成またはログイン
3. API Keysセクションで新しいAPIキーを作成

### Anthropic Claude
1. [Anthropic Console](https://console.anthropic.com/)にアクセス
2. アカウントを作成またはログイン
3. API Keysセクションで新しいAPIキーを作成

### Google Gemini
1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. Googleアカウントでログイン
3. Create API KeyをクリックしてAPIキーを作成

## 本番環境へのデプロイ

本番環境では環境変数が優先され、手動でのAPIキー入力は無効になります。デプロイ先のプラットフォームで環境変数を設定してください。

### 推奨デプロイプラットフォーム
- **Vercel** - 簡単で高速
- **Netlify** - 静的サイトに最適
- **GitHub Pages** - 無料で利用可能

## ライセンス

MIT License
