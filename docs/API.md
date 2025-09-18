# API ドキュメント

AI Story BuilderのAPI仕様について説明します。

## 概要

AI Story Builderは、複数のAIプロバイダーと連携して小説創作を支援するWebアプリケーションです。このドキュメントでは、アプリケーション内で使用されるAPIの仕様について説明します。

## AI プロバイダー

### 対応プロバイダー

| プロバイダー | モデル | 最大トークン数 | 料金 |
|-------------|--------|----------------|------|
| OpenAI | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo | 128,000 | 従量課金 |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus | 200,000 | 従量課金 |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 1.5 Pro | 2,000,000 | 従量課金 |
| ローカル | カスタムモデル | 32,768 | 無料 |

### エンドポイント

#### OpenAI API
```
POST https://api.openai.com/v1/chat/completions
```

#### Anthropic Claude API
```
POST https://api.anthropic.com/v1/messages
```

#### Google Gemini API
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

#### ローカルLLM API
```
POST {VITE_LOCAL_LLM_ENDPOINT}/v1/chat/completions
```

## リクエスト形式

### 共通パラメータ

```typescript
interface AIRequest {
  prompt: string;           // プロンプトテキスト
  context?: string;         // 追加のコンテキスト
  settings: AISettings;     // AI設定
}

interface AISettings {
  provider: string;         // プロバイダーID
  model: string;           // モデルID
  apiKey?: string;         // APIキー（暗号化済み）
  localEndpoint?: string;  // ローカルエンドポイント
  temperature: number;     // 温度パラメータ (0.0-1.0)
  maxTokens: number;       // 最大トークン数
}
```

### プロンプトテンプレート

#### キャラクター生成
```typescript
const characterPrompt = `
以下の条件に基づいて、魅力的で多様なキャラクターを3人同時に作成してください。

テーマ: {theme}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}

【出力形式】
【キャラクター1】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）
`;
```

#### プロット生成
```typescript
const plotPrompt = `
以下の設定に基づいて、起承転結の物語構造を提案してください。

テーマ: {theme}
舞台: {setting}
主要キャラクター: {characters}

【出力形式】
【起】導入部
（状況設定、キャラクター紹介、日常の描写）

【承】発展部
（問題の発生、複雑化、キャラクターの成長）

【転】転換部
（クライマックス、大きな変化、対立の頂点）

【結】結末部
（解決、結論、キャラクターの変化）
`;
```

#### あらすじ生成
```typescript
const synopsisPrompt = `
以下の情報から魅力的なあらすじを作成してください。

【プロジェクト基本情報】
{projectInfo}

【キャラクター情報】
{characters}

【プロット基本設定】
{basicPlotInfo}

【物語構造の詳細】
{detailedStructureInfo}

【重要指示】
上記の情報を総合的に活用して、以下の要素を含む魅力的なあらすじを作成してください：

1. **主人公の動機と目標**
2. **主要な対立や問題**
3. **物語の核心となる出来事**
4. **読者の興味を引く要素**
5. **適切な文字数**：500文字程度で簡潔かつ魅力的に

【出力形式】
あらすじのみを出力してください。説明文やコメントは不要です。
`;
```

## レスポンス形式

### 成功レスポンス

```typescript
interface AIResponse {
  content: string;          // 生成されたコンテンツ
  usage?: {                // 使用量情報（利用可能な場合）
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;          // エラーメッセージ（エラーの場合）
}
```

### エラーレスポンス

```typescript
interface ErrorResponse {
  content: '';
  error: string;           // エラーメッセージ
}
```

## エラーハンドリング

### エラーコード

| コード | 説明 | 対処法 |
|--------|------|--------|
| 400 | 不正なリクエスト | リクエスト形式を確認 |
| 401 | 認証エラー | APIキーを確認 |
| 429 | レート制限 | リクエスト頻度を調整 |
| 500 | サーバーエラー | しばらく待ってから再試行 |

### 再試行ロジック

```typescript
const retryConfig = {
  maxRetries: 3,           // 最大再試行回数
  baseDelay: 1000,         // 基本遅延時間（ms）
  maxDelay: 10000,         // 最大遅延時間（ms）
  backoffMultiplier: 2     // バックオフ乗数
};
```

## セキュリティ

### APIキー管理

- APIキーは暗号化してローカルストレージに保存
- 本番環境では環境変数が優先
- 手動入力は開発環境のみ有効

### 入力値検証

- プロンプトの長さ制限（最大10,000文字）
- 危険なコンテンツの検出とフィルタリング
- XSS、SQLインジェクション対策

### レート制限

- 1分間に100リクエストまで
- 超過時は429エラーを返す
- 指数バックオフで再試行

## 使用例

### 基本的な使用

```typescript
import { aiService } from './services/aiService';

const request: AIRequest = {
  prompt: "魅力的な主人公を作成してください",
  settings: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000
  }
};

const response = await aiService.generateContent(request);
console.log(response.content);
```

### プロンプトテンプレートの使用

```typescript
const variables = {
  theme: "友情",
  mainGenre: "ファンタジー",
  subGenre: "冒険",
  targetReader: "10代"
};

const prompt = aiService.buildPrompt('character', 'create', variables);
const response = await aiService.generateContent({
  prompt,
  settings: request.settings
});
```

## 制限事項

### トークン制限

- OpenAI GPT-3.5: 4,096トークン
- OpenAI GPT-4: 8,192トークン
- OpenAI GPT-4o: 128,000トークン
- Claude 3.5: 200,000トークン
- Gemini 2.5: 2,000,000トークン

### レート制限

- OpenAI: モデルによって異なる
- Claude: 1分間に100リクエスト
- Gemini: 1分間に60リクエスト
- ローカル: 制限なし

### コスト制限

- 各プロバイダーで使用量制限を設定可能
- 月間使用量の監視
- 予算アラートの設定

## トラブルシューティング

### よくある問題

1. **APIキーエラー**
   - 環境変数の設定を確認
   - APIキーの有効性を確認

2. **レート制限エラー**
   - リクエスト頻度を調整
   - より高い制限のプランに変更

3. **トークン制限エラー**
   - プロンプトの長さを短縮
   - maxTokensの値を調整

4. **ネットワークエラー**
   - インターネット接続を確認
   - プロキシ設定を確認

### デバッグ

```typescript
// デバッグモードを有効化
const debugMode = import.meta.env.VITE_DEBUG_MODE === 'true';

if (debugMode) {
  console.log('AI Request:', request);
  console.log('AI Response:', response);
}
```

## 更新履歴

- **v1.0.0**: 初回リリース
- **v0.9.0**: ベータ版
- **v0.1.0**: プロトタイプ

---

詳細な情報については、[GitHubリポジトリ](https://github.com/your-username/ai-story-builder)を参照してください。
