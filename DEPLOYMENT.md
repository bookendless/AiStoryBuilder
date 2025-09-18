# デプロイメントガイド

AI Story Builderのデプロイメント方法について説明します。

## 前提条件

- Node.js 18以上
- npm または yarn
- 各プラットフォームのアカウント

## デプロイメント方法

### 1. Vercel（推奨）

Vercelは最も簡単で高速なデプロイメント方法です。

#### 自動デプロイ
1. GitHubリポジトリをVercelに接続
2. 環境変数を設定
3. 自動デプロイが開始

#### 手動デプロイ
```bash
# Vercel CLIをインストール
npm install -g vercel

# デプロイ
npm run deploy:vercel
```

#### 環境変数の設定
Vercelダッシュボードで以下の環境変数を設定：
- `VITE_OPENAI_API_KEY`
- `VITE_CLAUDE_API_KEY`
- `VITE_GEMINI_API_KEY`
- `VITE_LOCAL_LLM_ENDPOINT`（オプション）

### 2. Netlify

#### 自動デプロイ
1. GitHubリポジトリをNetlifyに接続
2. ビルド設定：
   - Build command: `npm run build`
   - Publish directory: `dist`
3. 環境変数を設定
4. デプロイ

#### 手動デプロイ
```bash
# Netlify CLIをインストール
npm install -g netlify-cli

# デプロイ
npm run deploy:netlify
```

### 3. GitHub Pages

#### 自動デプロイ
1. リポジトリのSettings > PagesでGitHub Pagesを有効化
2. ソースを「GitHub Actions」に設定
3. 環境変数をGitHub Secretsに設定
4. mainブランチにプッシュ

#### 手動デプロイ
```bash
# ビルド
npm run build

# distフォルダをGitHub Pagesにアップロード
npm run deploy:github
```

## 環境変数の設定

### 必須環境変数
- `VITE_APP_NAME`: アプリケーション名
- `VITE_APP_VERSION`: バージョン
- `VITE_APP_DESCRIPTION`: 説明

### オプション環境変数
- `VITE_OPENAI_API_KEY`: OpenAI APIキー
- `VITE_CLAUDE_API_KEY`: Claude APIキー
- `VITE_GEMINI_API_KEY`: Gemini APIキー
- `VITE_LOCAL_LLM_ENDPOINT`: ローカルLLMエンドポイント
- `VITE_DEBUG_MODE`: デバッグモード（true/false）
- `VITE_LOG_LEVEL`: ログレベル（debug/info/warn/error）

## ビルド最適化

### 本番ビルド
```bash
# 型チェック + リント + ビルド
npm run build

# ビルド分析
npm run build:analyze
```

### パフォーマンス最適化
- チャンク分割によるコード分割
- アセットの最適化
- 本番環境でのconsole.log削除
- ソースマップの無効化

## トラブルシューティング

### よくある問題

1. **ビルドエラー**
   - 型チェック: `npm run type-check`
   - リント: `npm run lint`

2. **環境変数が読み込まれない**
   - 環境変数名が`VITE_`で始まっているか確認
   - デプロイ先で環境変数が設定されているか確認

3. **APIキーエラー**
   - 環境変数でAPIキーが設定されているか確認
   - 手動入力は本番環境では無効

### ログの確認
```bash
# 開発環境
npm run dev

# 本番環境のプレビュー
npm run preview
```

## セキュリティ

- APIキーは環境変数で管理
- 本番環境では手動入力無効
- HTTPS必須
- セキュリティヘッダー設定済み

## パフォーマンス

- 静的アセットのキャッシュ設定
- コード分割による初期読み込み最適化
- 画像の最適化
- バンドルサイズの最適化
