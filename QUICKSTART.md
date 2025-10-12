# クイックスタート - 開発環境

AI Story Builder の開発環境をすぐに始めるためのガイドです。

## 🚀 最速スタート（Rust不要）

### 前提条件
- Node.js 18以上がインストール済み
- Git がインストール済み

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/ai-story-builder.git
cd ai-story-builder
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

**Git Bash の場合:**
```bash
npm run dev
```

**PowerShell の場合:**
```powershell
# 初回のみ実行ポリシーを変更
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 開発サーバーを起動
npm run dev
```

### 4. ブラウザで確認

自動的にブラウザが開きますが、開かない場合は以下にアクセス：
```
http://localhost:5173
```

## ✅ AI機能のテスト

### Option A: クラウドAI（OpenAI推奨）

1. **OpenAI APIキーを取得**
   - [OpenAI Platform](https://platform.openai.com/api-keys) でAPIキーを作成

2. **アプリケーションで設定**
   - 右上の設定アイコン → AI設定
   - プロバイダー: **OpenAI GPT**
   - モデル: **GPT-4o Mini**（コスト効率が良い）
   - APIキー: `sk-...` （あなたのAPIキー）
   - 「接続をテスト」をクリック

3. **動作確認**
   - 新しいプロジェクトを作成
   - キャラクター設定で「AIに生成を依頼」
   - AIが提案を返すことを確認 ✨

### Option B: ローカルLLM（完全無料）

1. **LM Studio をインストール**
   - [LM Studio](https://lmstudio.ai/) をダウンロード・インストール

2. **モデルをダウンロード**
   - LM Studio を起動
   - 検索バーで `gemma` または `llama` を検索
   - 推奨: `gemma-2-9b-it` または `llama-3.1-8b-instruct`
   - ダウンロードボタンをクリック

3. **サーバーを起動**
   - LM Studio の「Developer」タブを開く
   - モデルを選択
   - 「Start Server」をクリック
   - ポート 1234 で起動していることを確認

4. **アプリケーションで設定**
   - 右上の設定アイコン → AI設定
   - プロバイダー: **ローカルLLM**
   - エンドポイント: `http://localhost:1234`
   - 「接続をテスト」をクリック

5. **動作確認**
   - 新しいプロジェクトを作成
   - キャラクター設定で「AIに生成を依頼」
   - AIが提案を返すことを確認 ✨

## 🎯 次のステップ

### 環境変数の設定（オプション）

APIキーを毎回入力したくない場合：

1. プロジェクトルートに `.env.local` ファイルを作成
2. 以下を記述：

```bash
# OpenAI
VITE_OPENAI_API_KEY=sk-your-api-key-here

# Claude
VITE_CLAUDE_API_KEY=sk-ant-your-api-key-here

# Gemini
VITE_GEMINI_API_KEY=your-api-key-here

# Local LLM
VITE_LOCAL_LLM_ENDPOINT=http://localhost:1234
```

3. 開発サーバーを再起動

### プロジェクトの開発

```bash
# 開発サーバーを起動（ホットリロード有効）
npm run dev

# ビルド（本番環境用）
npm run build

# ビルドしたアプリをプレビュー
npm run preview

# Lintチェック
npm run lint

# Lint自動修正
npm run lint:fix

# 型チェック
npm run type-check
```

## 🔧 よくある問題

### PowerShellで「スクリプトの実行が無効」エラー

**エラー内容:**
```
このシステムではスクリプトの実行が無効になっているため...
```

**解決方法:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ポート 5173 が使用中

**解決方法:**
```bash
# 別のポートを指定
npm run dev -- --port 3000
```

または、使用中のプロセスを終了：
```powershell
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID番号> /F
```

### ローカルLLMに接続できない

**チェック項目:**
- ✅ LM Studio/Ollama が起動しているか
- ✅ サーバーが起動しているか（Status: Running）
- ✅ ポート番号が正しいか（LM Studio: 1234, Ollama: 11434）
- ✅ ファイアウォールがブロックしていないか

**開発サーバーのログを確認:**
ブラウザの開発者ツール（F12）を開いて、Consoleタブでエラーメッセージを確認

### CORSエラーが発生

**原因:**
Viteのプロキシが正しく動作していない

**解決方法:**
1. 開発サーバーを再起動
2. ブラウザのキャッシュをクリア
3. `vite.config.ts` のプロキシ設定を確認

## 📖 さらなる情報

- **[開発環境ガイド](DEV_GUIDE.md)** - 詳細な開発環境の説明
- **[Rustインストールガイド](RUST_INSTALL_GUIDE.md)** - Tauri開発のためのRustセットアップ
- **[Tauriセットアップ](TAURI_SETUP.md)** - デスクトップアプリのビルド方法

## 💡 開発のヒント

### 開発効率アップ

1. **ブラウザ開発者ツールを活用**
   - `F12` で開発者ツールを開く
   - Console でログを確認
   - Network でAPI通信を監視

2. **ホットリロードを活用**
   - ファイル保存時に自動的にブラウザが更新される
   - 変更がすぐに反映される

3. **環境変数でAPIキーを管理**
   - `.env.local` でAPIキーを一元管理
   - GitHubにコミットされない（`.gitignore`に含まれている）

### AI機能の開発とテスト

1. **ローカルLLMで基本機能を開発**
   - 無料で使える
   - レスポンスが速い
   - オフラインでも動作

2. **クラウドAIで高度な機能をテスト**
   - より高品質な応答
   - より複雑な処理に対応
   - 本番環境に近い動作

3. **複数のAIプロバイダーをテスト**
   - OpenAI: バランスが良い
   - Claude: 長文生成に強い
   - Gemini: 多言語対応が優れている

## 🎉 準備完了！

これで開発環境の準備が整いました。さあ、AI Story Builder の開発を始めましょう！

質問や問題が発生した場合は、[Issue](https://github.com/your-username/ai-story-builder/issues) を作成してください。

