# デプロイメントガイド

AI Story Builderの本番環境へのデプロイメント手順を詳しく説明します。

## 🚀 デプロイメントプラットフォーム

### 推奨プラットフォーム

| プラットフォーム | 難易度 | コスト | パフォーマンス | 推奨度 |
|------------------|--------|--------|----------------|--------|
| **Vercel** | ⭐ | 無料〜 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Netlify** | ⭐⭐ | 無料〜 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **GitHub Pages** | ⭐⭐⭐ | 無料 | ⭐⭐⭐ | ⭐⭐⭐ |

## 📋 前提条件

### 必要な準備

- [ ] Node.js 18.0.0以上がインストール済み
- [ ] GitリポジトリがGitHubにプッシュ済み
- [ ] 各AIプロバイダーのAPIキーを取得済み
- [ ] デプロイメント先のアカウントを作成済み

### 環境変数の準備

以下の環境変数を準備してください：

#### 必須環境変数
```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_CLAUDE_API_KEY=your_claude_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

#### オプション環境変数
```env
VITE_LOCAL_LLM_ENDPOINT=http://localhost:1234/v1/chat/completions
```

## 🔧 デプロイメント前の準備

### 1. デプロイメント設定の確認

```bash
# デプロイメント設定をチェック
npm run check:deployment

# 特定のプラットフォームの設定を確認
npm run setup:vercel
npm run setup:netlify
npm run setup:github
```

### 2. ビルドテスト

```bash
# 型チェック
npm run type-check

# リント
npm run lint

# ビルドテスト
npm run build

# プレビュー
npm run preview
```

## 🌐 Vercel（推奨）

### 特徴
- ⚡ 超高速デプロイメント
- 🔄 自動デプロイ
- 📊 詳細な分析
- 🌍 グローバルCDN
- 💰 無料プランで十分

### デプロイ手順

#### 方法1: Vercel CLI（推奨）

```bash
# 1. Vercel CLIをインストール
npm install -g vercel

# 2. Vercelにログイン
vercel login

# 3. プロジェクトをデプロイ
vercel --prod

# 4. 環境変数を設定
# Vercelダッシュボード > Settings > Environment Variables
```

#### 方法2: GitHub連携

1. [Vercel](https://vercel.com/)にアクセス
2. GitHubアカウントでサインアップ
3. 「New Project」をクリック
4. GitHubリポジトリを選択
5. 環境変数を設定
6. 「Deploy」をクリック

### 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_CLAUDE_API_KEY=your_claude_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### カスタムドメイン設定

1. Vercelダッシュボード > Settings > Domains
2. ドメインを追加
3. DNS設定を更新

## 🌐 Netlify

### 特徴
- 🚀 簡単なデプロイメント
- 🔧 豊富なプラグイン
- 📈 フォーム処理機能
- 🔍 詳細なログ
- 💰 無料プランで十分

### デプロイ手順

#### 方法1: Netlify CLI

```bash
# 1. Netlify CLIをインストール
npm install -g netlify-cli

# 2. Netlifyにログイン
netlify login

# 3. プロジェクトをデプロイ
netlify deploy --prod --dir=dist

# 4. 環境変数を設定
# Netlifyダッシュボード > Site settings > Environment variables
```

#### 方法2: GitHub連携

1. [Netlify](https://netlify.com/)にアクセス
2. GitHubアカウントでサインアップ
3. 「New site from Git」をクリック
4. GitHubリポジトリを選択
5. ビルド設定を確認
6. 環境変数を設定
7. 「Deploy site」をクリック

### ビルド設定

Netlifyで以下の設定を確認：

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: `18`

### 環境変数の設定

Netlifyダッシュボードで以下の環境変数を設定：

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_CLAUDE_API_KEY=your_claude_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 🌐 GitHub Pages

### 特徴
- 💰 完全無料
- 🔄 GitHub Actions連携
- 📚 ドキュメントサイト向け
- ⚡ 高速アクセス
- 🔒 セキュア

### デプロイ手順

#### 1. リポジトリの設定

1. GitHubリポジトリの「Settings」に移動
2. 左側メニューから「Pages」を選択
3. 「Source」を「GitHub Actions」に設定

#### 2. 環境変数の設定

1. リポジトリの「Settings」に移動
2. 左側メニューから「Secrets and variables」>「Actions」を選択
3. 「New repository secret」をクリック
4. 以下のシークレットを追加：

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_CLAUDE_API_KEY=your_claude_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

#### 3. 自動デプロイ

mainブランチにプッシュすると自動的にデプロイされます：

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

### カスタムドメイン設定

1. リポジトリの「Settings」>「Pages」に移動
2. 「Custom domain」にドメインを入力
3. DNS設定でCNAMEレコードを追加

## 🔍 デプロイメント後の確認

### 1. 基本動作確認

- [ ] アプリケーションが正常に読み込まれる
- [ ] ダークモード切り替えが動作する
- [ ] レスポンシブデザインが正しく表示される
- [ ] PWA機能が動作する

### 2. AI機能確認

- [ ] AI設定画面でAPIキーが正しく表示される
- [ ] 各AIプロバイダーでコンテンツ生成が動作する
- [ ] エラーハンドリングが正しく動作する

### 3. パフォーマンス確認

- [ ] ページ読み込み速度が適切
- [ ] 画像の遅延読み込みが動作する
- [ ] キャッシュが正しく設定されている

### 4. セキュリティ確認

- [ ] HTTPSが有効
- [ ] セキュリティヘッダーが設定されている
- [ ] APIキーが適切に暗号化されている

## 🛠️ トラブルシューティング

### よくある問題

#### ビルドエラー

```bash
# 型チェックエラー
npm run type-check

# リントエラー
npm run lint

# 依存関係の問題
rm -rf node_modules package-lock.json
npm install
```

#### 環境変数エラー

- 環境変数が正しく設定されているか確認
- 変数名が`VITE_`で始まっているか確認
- 本番環境で再ビルドが必要

#### デプロイエラー

- ビルドログを確認
- 環境変数の設定を確認
- プラットフォームの制限を確認

### ログの確認

#### Vercel
- Vercelダッシュボード > Functions > Logs

#### Netlify
- Netlifyダッシュボード > Functions > Logs

#### GitHub Pages
- GitHub Actions > ワークフロー実行 > ログ

## 📊 パフォーマンス最適化

### 推奨設定

1. **画像最適化**
   - WebP形式の使用
   - 適切なサイズでの配信
   - 遅延読み込みの実装

2. **キャッシュ設定**
   - 静的アセットの長期キャッシュ
   - APIレスポンスのキャッシュ
   - CDNの活用

3. **バンドル最適化**
   - コード分割の実装
   - 不要な依存関係の削除
   - Tree shakingの活用

## 🔄 継続的デプロイメント

### 自動デプロイの設定

各プラットフォームで以下の設定を推奨：

- **mainブランチ**: 本番環境に自動デプロイ
- **developブランチ**: ステージング環境に自動デプロイ
- **プルリクエスト**: プレビュー環境に自動デプロイ

### 環境分離

- **本番環境**: 安定版のみデプロイ
- **ステージング環境**: テスト用
- **開発環境**: ローカル開発用

## 📞 サポート

### デプロイメントに関する質問

- **GitHub Issues**: 技術的な問題
- **GitHub Discussions**: 一般的な質問
- **ドキュメント**: 詳細な手順

### 緊急時の対応

1. ロールバックの実行
2. 問題の特定と修正
3. 再デプロイの実行

---

**注意**: このガイドは定期的に更新されます。最新の情報については、常に最新版を参照してください。
