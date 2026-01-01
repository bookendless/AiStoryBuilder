# 開発環境ガイド

このドキュメントは、AI Story Builder を開発環境で実行する際のガイドです。

## 開発環境とTauri環境の違い

AI Story Builder は Tauri ベースのデスクトップアプリケーションおよびAndroidアプリケーションですが、開発時には通常のブラウザ環境（`npm run dev`）でも動作するように設計されています。

### 環境の検出

アプリケーションは自動的に実行環境を検出します：

- **Tauri環境（デスクトップ）**: `npm run tauri:dev` または ビルドされたアプリケーション
- **Tauri環境（Android）**: `npm run tauri:dev:android` または ビルドされたAndroidアプリ
- **ブラウザ環境**: `npm run dev` （開発用Viteサーバー）

### Android開発環境

Androidアプリを開発する場合は、追加のセットアップが必要です。詳細は [TAURI_SETUP.md](TAURI_SETUP.md#android) を参照してください。

主な要件：
- Java JDK 17以上
- Android Studio（Android SDK、NDK、Build Tools）
- 環境変数の設定（`JAVA_HOME`、`ANDROID_HOME`）

## 開発環境でのAI機能

### 1. クラウドAPI (OpenAI, Claude, Gemini)

開発環境でもTauri環境でも同じように動作します。

```bash
# .env.local ファイルにAPIキーを設定
VITE_OPENAI_API_KEY=sk-xxx
VITE_CLAUDE_API_KEY=sk-ant-xxx
VITE_GEMINI_API_KEY=xxx
```

### 2. ローカルLLM (LM Studio, Ollama)

開発環境では、CORS制限を回避するためにViteのプロキシを使用します。

#### LM Studio の場合

```bash
# LM Studio を起動 (ポート 1234)
# アプリケーションのAI設定で以下を指定:
# エンドポイント: http://localhost:1234
```

開発環境では自動的に `/api/local` プロキシ経由で接続されます。

#### Ollama の場合

```bash
# Ollama を起動 (ポート 11434)
# アプリケーションのAI設定で以下を指定:
# エンドポイント: http://localhost:11434
```

開発環境では自動的に `/api/ollama` プロキシ経由で接続されます。

### 3. プロキシ設定

`vite.config.ts` に以下のプロキシが設定されています：

```typescript
proxy: {
  '/api/local': {
    target: 'http://localhost:1234',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/local/, '/v1/chat/completions'),
  },
  '/api/ollama': {
    target: 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/ollama/, '/v1/chat/completions'),
  },
}
```

## HTTP通信の実装

### httpService の動作

`src/services/httpService.ts` は環境に応じて適切な fetch API を使用します：

- **Tauri環境**: `@tauri-apps/plugin-http` の fetch を使用（CORS制限なし）
- **ブラウザ環境**: 標準の `window.fetch` を使用（プロキシ経由）

### タイムアウト処理

- **Tauri環境**: `connectTimeout` オプションを使用
- **ブラウザ環境**: `AbortController` を使用してタイムアウトを実装

## デバッグ

### コンソールログ

開発時には詳細なログが出力されます：

```javascript
// HTTP Request
console.log('HTTP Request:', {
  url,
  method,
  isTauriEnv: isTauri(),
  isUsingTauriFetch: isUsingTauri
});

// Local LLM Test
console.log('Testing local LLM connection:', {
  originalEndpoint: endpoint,
  apiEndpoint,
  isTauriEnv,
  isDev: import.meta.env.DEV
});
```

### ブラウザ開発者ツール

1. `F12` でブラウザの開発者ツールを開く
2. **Console** タブでログを確認
3. **Network** タブでHTTPリクエストを確認

## 開発サーバーの起動

### 通常の開発モード（ブラウザ）

```bash
npm run dev
```

- ポート: 5173
- 自動リロード: 有効
- Tauri API: 利用不可（ブラウザ環境）

### Tauri開発モード

```bash
npm run tauri:dev
```

- Viteサーバー + Tauriアプリケーションが起動
- 自動リロード: 有効
- Tauri API: 利用可能

## トラブルシューティング

### 問題: ローカルLLMに接続できない（開発環境）

**原因**: LM Studio/Ollama が起動していない、またはポートが異なる

**解決策**:
1. LM Studio/Ollama を起動
2. ポート番号を確認（LM Studio: 1234, Ollama: 11434）
3. アプリケーションのAI設定で正しいエンドポイントを指定

### 問題: API キーが認識されない

**原因**: `.env.local` ファイルが読み込まれていない

**解決策**:
1. プロジェクトルートに `.env.local` ファイルを作成
2. 環境変数を設定（`VITE_` プレフィックスが必要）
3. 開発サーバーを再起動

### 問題: CORS エラーが発生する

**原因**: ブラウザ環境でローカルLLMに直接接続しようとしている

**解決策**:
- 自動的にプロキシ経由で接続されるはずですが、もし問題が発生した場合は：
- `vite.config.ts` のプロキシ設定を確認
- 開発サーバーを再起動

## 環境変数

### 必須環境変数なし

アプリケーションはAPIキーなしでも起動します。AI機能を使用する際に、設定画面からAPIキーを入力できます。

### オプション環境変数

```bash
# OpenAI API Key
VITE_OPENAI_API_KEY=sk-xxx

# Claude API Key
VITE_CLAUDE_API_KEY=sk-ant-xxx

# Gemini API Key
VITE_GEMINI_API_KEY=xxx

# Local LLM Endpoint
VITE_LOCAL_LLM_ENDPOINT=http://localhost:1234
```

環境変数を設定すると、アプリケーション起動時にデフォルトで使用されます。

## ビルドとデプロイ

### Webアプリケーションとしてビルド

```bash
npm run build
npm run preview
```

### Tauriアプリケーションとしてビルド

```bash
npm run tauri:build
```

## まとめ

- **開発環境 (`npm run dev`)**: ブラウザで動作、プロキシ経由でローカルLLMに接続
- **Tauri環境 (`npm run tauri:dev`)**: デスクトップアプリとして動作、直接ローカルLLMに接続

どちらの環境でもAI機能が正常に動作するように設計されています。

