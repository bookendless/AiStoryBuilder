# GitHub リポジトリ設定ガイド

ユーザーに不要なデータをcloneさせないためのGitHub設定について説明します。

## 📋 目次

- [リポジトリ設定](#リポジトリ設定)
- [ファイル除外設定](#ファイル除外設定)
- [GitHub Actions 最適化](#github-actions-最適化)
- [リポジトリサイズ最適化](#リポジトリサイズ最適化)
- [ユーザー向け最適化](#ユーザー向け最適化)

## リポジトリ設定

### 1. リポジトリの可視性

- **Public**: 一般ユーザーがアクセス可能
- **Private**: 制限されたユーザーのみアクセス可能

### 2. デフォルトブランチ

- `main` ブランチをデフォルトに設定
- 保護ルールを設定して直接プッシュを防止

### 3. リポジトリの説明

```markdown
# AI Story Builder
AIを活用した小説創作支援アプリケーション

## 特徴
- ローカルLLM対応（完全オフライン動作）
- プライバシー重視（データはローカルに保存）
- 直感的なUI（初心者でも簡単）

## クイックスタート
```bash
git clone <repo-url>
cd ai-story-builder
npm run quick-start
```
```

## ファイル除外設定

### 1. .gitignore の設定

```gitignore
# ユーザーに不要なファイル
node_modules/
dist/
build/
coverage/
.env*
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/
```

### 2. .gitattributes の設定

```gitattributes
# 言語統計から除外
node_modules/** linguist-vendored
dist/** linguist-vendored
coverage/** linguist-vendored

# ドキュメントファイルの設定
README.md linguist-documentation
DEVELOPER.md linguist-documentation
```

### 3. .githubignore の設定

```gitignore
# GitHub機能で無視するファイル
node_modules/
dist/
coverage/
.env*
*.log
```

## GitHub Actions 最適化

### 1. ワークフローの最適化

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
```

### 2. キャッシュの活用

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'
```

### 3. 不要なジョブの削除

- テストジョブは必要最小限に
- ビルドジョブは本番用のみ
- 開発用ジョブは別ブランチで実行

## リポジトリサイズ最適化

### 1. 大きなファイルの削除

```bash
# リポジトリ最適化スクリプトを実行
npm run optimize-repo

# または手動で削除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch -r node_modules dist build" \
  --prune-empty --tag-name-filter cat -- --all
```

### 2. Git履歴の最適化

```bash
# リポジトリを圧縮
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 3. 不要なブランチの削除

```bash
# マージ済みブランチを削除
git branch --merged | grep -v main | xargs -n 1 git branch -d

# リモートブランチを削除
git push origin --delete <branch-name>
```

## ユーザー向け最適化

### 1. README.md の最適化

- 簡潔で分かりやすい説明
- クイックスタート手順を強調
- 技術的な詳細は別ドキュメントに分離

### 2. ドキュメントの整理

```
README.md          # 一般ユーザー向け（簡潔）
├── USER_GUIDE.md  # 詳細な使用方法
├── DEVELOPER.md   # 開発者向け
└── LOCAL_SETUP.md # ローカル環境設定
```

### 3. セットアップスクリプト

```bash
# ワンコマンドセットアップ
npm run quick-start

# 環境チェック
npm run check:local

# リポジトリ最適化
npm run optimize-repo
```

## 推奨設定

### 1. リポジトリ設定

- [ ] デフォルトブランチを `main` に設定
- [ ] ブランチ保護ルールを有効化
- [ ] 必須ステータスチェックを設定
- [ ] 自動マージを無効化

### 2. セキュリティ設定

- [ ] 依存関係の脆弱性スキャンを有効化
- [ ] シークレットスキャンを有効化
- [ ] コードスキャンを有効化

### 3. ユーザビリティ設定

- [ ] テンプレートリポジトリとして設定
- [ ] 適切なトピックを設定
- [ ] ライセンスを明記
- [ ] コントリビューションガイドを作成

## チェックリスト

### リポジトリ公開前

- [ ] `.gitignore` が適切に設定されている
- [ ] `.gitattributes` が設定されている
- [ ] 不要なファイルが削除されている
- [ ] README.md が分かりやすく書かれている
- [ ] セットアップスクリプトが動作する
- [ ] ドキュメントが整理されている

### 定期的なメンテナンス

- [ ] 不要なブランチを削除
- [ ] 大きなファイルをチェック
- [ ] 依存関係を更新
- [ ] ドキュメントを更新

## トラブルシューティング

### リポジトリサイズが大きい場合

1. `npm run optimize-repo` を実行
2. 大きなファイルを特定: `git ls-files | xargs du -h | sort -hr`
3. 不要なファイルを削除
4. Git履歴を最適化

### ユーザーがcloneできない場合

1. リポジトリの可視性を確認
2. ブランチ保護ルールを確認
3. 必要な権限を確認

### ビルドが失敗する場合

1. GitHub Actions のログを確認
2. 環境変数を確認
3. 依存関係を確認

---

**注意**: これらの設定は段階的に適用することをお勧めします。一度にすべてを変更すると、既存のワークフローに影響する可能性があります。
