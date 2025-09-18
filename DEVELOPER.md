# 開発者向けドキュメント

AI Story Builderの開発・カスタマイズ・デプロイに関する詳細な情報を提供します。

## 📋 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
- [プロジェクト構造](#プロジェクト構造)
- [技術スタック](#技術スタック)
- [開発ワークフロー](#開発ワークフロー)
- [API仕様](#api仕様)
- [デプロイメント](#デプロイメント)
- [コントリビューション](#コントリビューション)
- [トラブルシューティング](#トラブルシューティング)

## 開発環境のセットアップ

### 前提条件

- **Node.js**: 18.0.0以上
- **npm**: 8.0.0以上 または **yarn**: 1.22.0以上
- **Git**: 2.0.0以上
- **TypeScript**: 5.0.0以上

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/your-username/ai-story-builder.git
cd ai-story-builder

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

### 利用可能なスクリプト

```bash
# 開発
npm run dev              # 開発サーバー起動
npm run dev:local        # ローカルLLMモードで起動
npm run build            # 本番用ビルド
npm run build:local      # ローカルモード用ビルド
npm run preview          # ビルド結果のプレビュー

# 品質管理
npm run lint             # ESLint実行
npm run lint:fix         # ESLint自動修正
npm run type-check       # TypeScript型チェック

# ローカル環境
npm run setup:local      # ローカル環境セットアップ
npm run check:local      # ローカルLLM接続テスト

# デプロイ
npm run deploy:vercel    # Vercelにデプロイ
npm run deploy:netlify   # Netlifyにデプロイ
npm run deploy:github    # GitHub Pagesにデプロイ
```

## プロジェクト構造

```
ai-story-builder/
├── public/                 # 静的ファイル
│   ├── manifest.json      # PWAマニフェスト
│   ├── sw.js             # サービスワーカー
│   └── icons/            # アプリアイコン
├── src/
│   ├── components/        # Reactコンポーネント
│   │   ├── steps/        # 各ステップのコンポーネント
│   │   │   ├── CharacterStep.tsx
│   │   │   ├── PlotStep1.tsx
│   │   │   ├── PlotStep2.tsx
│   │   │   ├── SynopsisStep.tsx
│   │   │   ├── ChapterStep.tsx
│   │   │   └── DraftStep.tsx
│   │   ├── AISettings.tsx
│   │   ├── DataManager.tsx
│   │   ├── Header.tsx
│   │   ├── HomePage.tsx
│   │   ├── ImageBoard.tsx
│   │   ├── NewProjectModal.tsx
│   │   ├── OptimizedImage.tsx
│   │   ├── Sidebar.tsx
│   │   └── VirtualScrollList.tsx
│   ├── contexts/         # React Context
│   │   ├── AIContext.tsx
│   │   └── ProjectContext.tsx
│   ├── services/         # APIサービス
│   │   ├── aiService.ts
│   │   └── databaseService.ts
│   ├── utils/           # ユーティリティ関数
│   │   ├── aiResponseParser.ts
│   │   ├── apiUtils.ts
│   │   ├── performanceUtils.ts
│   │   └── securityUtils.ts
│   ├── types/           # TypeScript型定義
│   │   └── ai.ts
│   ├── App.tsx          # メインアプリケーション
│   ├── main.tsx         # エントリーポイント
│   └── index.css        # グローバルスタイル
├── scripts/             # ビルド・デプロイスクリプト
│   ├── deploy.ps1
│   ├── deploy.sh
│   ├── setup-deployment.js
│   ├── setup-local.js
│   └── check-local-llm.js
├── docs/                # ドキュメント
│   ├── API.md
│   └── README.md
├── .github/workflows/   # GitHub Actions
├── vercel.json          # Vercel設定
├── netlify.toml         # Netlify設定
├── package.json         # プロジェクト設定
├── vite.config.ts       # Vite設定
├── tailwind.config.js   # Tailwind CSS設定
└── tsconfig.json        # TypeScript設定
```

## 技術スタック

### フロントエンド
- **React 18**: UIライブラリ
- **TypeScript**: 型安全なJavaScript
- **Vite**: 高速ビルドツール
- **Tailwind CSS**: ユーティリティファーストCSS
- **TipTap**: リッチテキストエディタ

### AI統合
- **OpenAI API**: GPT-4, GPT-3.5
- **Anthropic Claude API**: Claude 3.5
- **Google Gemini API**: Gemini 2.5
- **ローカルLLM**: LM Studio, Ollama対応

### データ管理
- **Dexie**: IndexedDBラッパー
- **React Context**: 状態管理
- **LocalStorage**: 設定保存

### 開発ツール
- **ESLint**: コード品質管理
- **Prettier**: コードフォーマット
- **TypeScript**: 型チェック

## 開発ワークフロー

### ブランチ戦略

```bash
main                 # 本番環境
├── develop         # 開発環境
├── feature/xxx     # 機能開発
├── bugfix/xxx      # バグ修正
└── hotfix/xxx      # 緊急修正
```

### コミット規約

```
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
style: コードスタイル修正
refactor: リファクタリング
test: テスト追加・修正
chore: その他の変更
```

### プルリクエスト

1. 機能ブランチを作成
2. 変更をコミット
3. プルリクエストを作成
4. コードレビュー
5. マージ

## API仕様

### AI Service API

```typescript
interface AIService {
  generateContent(request: AIRequest): Promise<AIResponse>;
  buildPrompt(type: string, subType: string, variables: Record<string, string>): string;
}

interface AIRequest {
  prompt: string;
  context?: string;
  settings: AISettings;
}

interface AIResponse {
  content: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### プロジェクト管理API

```typescript
interface ProjectContext {
  projects: Project[];
  currentProject: Project | null;
  createProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}
```

## デプロイメント

### 環境別設定

#### 開発環境
```bash
npm run dev
```

#### ローカル環境
```bash
npm run dev:local
```

#### 本番環境
```bash
npm run build
npm run preview
```

### デプロイ先

#### Vercel（推奨）
```bash
npm run deploy:vercel
```

#### Netlify
```bash
npm run deploy:netlify
```

#### GitHub Pages
```bash
npm run deploy:github
```

### 環境変数

#### 開発環境
```env
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_ENABLE_DEBUG_TOOLS=true
```

#### 本番環境
```env
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=info
VITE_ENABLE_DEBUG_TOOLS=false
```

## コントリビューション

### 開発環境のセットアップ

1. リポジトリをフォーク
2. ローカルにクローン
3. 依存関係をインストール
4. 機能ブランチを作成
5. 変更を実装
6. テストを実行
7. プルリクエストを作成

### コーディング規約

- TypeScriptを使用
- ESLintとPrettierの設定に従う
- コンポーネントは関数コンポーネントで作成
- 適切な型定義を追加
- コメントは日本語で記述

### テスト

```bash
# 型チェック
npm run type-check

# リント
npm run lint

# ビルドテスト
npm run build
```

## トラブルシューティング

### よくある問題

#### ビルドエラー
```bash
# 型チェック
npm run type-check

# リント
npm run lint

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

#### ローカルLLM接続エラー
```bash
# 接続テスト
npm run check:local

# ログ確認
npm run dev:local
```

#### メモリ不足
- より軽量なモデルを使用
- システムのメモリを増設
- 他のアプリケーションを終了

### デバッグ

#### 開発者ツール
- ブラウザの開発者ツール
- React DevTools
- Redux DevTools

#### ログレベル
```env
VITE_LOG_LEVEL=debug  # 詳細ログ
VITE_LOG_LEVEL=info   # 通常ログ
VITE_LOG_LEVEL=warn   # 警告のみ
VITE_LOG_LEVEL=error  # エラーのみ
```

## パフォーマンス最適化

### ビルド最適化
- コード分割
- アセット最適化
- バンドルサイズ削減

### ランタイム最適化
- メモ化
- 仮想スクロール
- 遅延読み込み

### 監視
- バンドルサイズ監視
- パフォーマンスメトリクス
- エラー追跡

---

詳細な情報が必要な場合は、各ドキュメントファイルを参照してください：
- [API.md](docs/API.md) - API仕様
- [LOCAL_SETUP.md](LOCAL_SETUP.md) - ローカル環境セットアップ
- [DEPLOYMENT.md](DEPLOYMENT.md) - デプロイメントガイド
