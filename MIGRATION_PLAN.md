# AI支援機能移行プラン

## 概要
メインエリアからツールサイドバーへのAI支援機能移行を円滑に進めるための詳細プランです。

## 既に移行済みのステップ

### 1. CharacterStep（キャラクターステップ）
- ✅ `CharacterAssistantPanel` として移行完了
- 機能：
  - キャラクター自動生成（3-5人）
  - AIログ表示
  - 進捗状況表示

### 2. SynopsisStep（あらすじステップ）
- ✅ `SynopsisAssistantPanel` として移行完了
- 機能：
  - あらすじ自動生成
  - 文体調整（読みやすく/要点抽出/魅力的に）
  - 全体あらすじ生成（章立てベース）
  - 進捗状況表示

## 移行が必要なステップ

---

## Phase 1: プロット関連ステップ（優先度：高）

### 1. PlotStep1（プロット基本設定）

**現在の状況:**
- `DraggableSidebar` 内にAIアシスタントセクションが存在
- メインエリアにも機能が散在

**移行対象機能:**
1. **基本設定全体のAI生成** (`handleBasicAIGenerate`)
   - メインテーマ、舞台設定、フック要素、主人公の目標、主要な障害、結末を一括生成
2. **個別フィールドのAI生成** (`handleFieldAIGenerate`)
   - 各フィールドごとの個別生成機能

**移行手順:**
1. `PlotStep1AssistantPanel.tsx` を作成
2. 既存のAI生成関数をパネル内に移動
3. `DraggableSidebar` からAI機能を削除
4. `ToolsSidebar` の `renderAssistContent()` に `case 'plot1'` を追加

**注意点:**
- `DraggableSidebar` の他のセクション（完成度、プレビュー）はメインエリアに残す
- フィールドの状態は `ProjectContext` 経由で管理されているため、パネルから直接更新可能

---

### 2. PlotStep2（プロット構成詳細）

**現在の状況:**
- サイドバー内に複数のAI機能セクションが存在
- 機能が充実している

**移行対象機能:**
1. **構成全体の生成** (`handleStructureAIGenerate`)
   - 選択した構成（起承転結、三幕構成など）の内容を一括生成
2. **一貫性チェック** (`checkConsistency`)
   - 構成要素の一貫性をAIでチェック
3. **個別フィールド補完** (`handleAISupplement`)
   - 各セクションの内容を補完

**移行手順:**
1. `PlotStep2AssistantPanel.tsx` を作成
2. 既存のサイドバーセクションからAI機能を抽出
3. プロット基礎設定の参照機能は残す（表示のみ）
4. 構成ガイド情報も移行を検討
5. `ToolsSidebar` の `renderAssistContent()` に `case 'plot2'` を追加

**注意点:**
- 構成ガイドは参考情報として残すか、パネル内に含めるか検討
- AIログ機能も移行（既存の `AILogPanel` を活用）

---

## Phase 2: 章・下書き関連ステップ（優先度：中）

### 3. ChapterStep（章立てステップ）

**現在の状況:**
- `ChapterSidebar` コンポーネント内にAI機能が存在
- サイドバー内に統合されている

**移行対象機能:**
1. **章構造生成** (`handleAIGenerate` - `generateStructure`)
   - 構成バランスを考慮した章立て生成
2. **章基本情報生成** (`handleAIGenerate` - `generateBasic`)
   - 基本的な章立て生成
3. **構成バランス分析** (`handleStructureBasedAIGenerate`)
   - 導入部、展開部、クライマックス、結末部のバランス分析

**移行手順:**
1. `ChapterAssistantPanel.tsx` を作成
2. `ChapterSidebar` からAI機能を抽出
3. 章一覧表示などの非AI機能はサイドバーに残す
4. `ToolsSidebar` の `renderAssistContent()` に `case 'chapter'` を追加

**注意点:**
- AIログ機能も移行

---

### 4. DraftStep（下書きステップ）

**現在の状況:**
- `AiTabPanel` という専用パネルが既に存在
- 機能が非常に充実している

**移行対象機能:**
1. **下書き生成** (`handleAIGenerate`)
   - 章の下書きを生成
2. **続き生成** (`handleContinueGeneration`)
   - 既存の下書きの続きを生成
3. **説明文強化** (`handleDescriptionEnhancement`)
   - 章の説明文を強化
4. **文体調整** (`handleStyleAdjustment`)
   - 下書きの文体を調整
5. **テキスト短縮** (`handleShortenText`)
   - 下書きを短縮
6. **章改善** (`handleChapterImprovement`)
   - 下書き全体を改善
7. **自己改善** (`handleSelfRefineImprovement`)
   - AIによる自己改善

**移行手順:**
1. `DraftAssistantPanel.tsx` を作成
2. `AiTabPanel` の内容を参考にしながら、ツールサイドバー向けに最適化
3. 下書きエディタはメインエリアに残す
4. `ToolsSidebar` の `renderAssistContent()` に `case 'draft'` を追加

**注意点:**
- 下書きステップは機能が多く、パネルが大きくなる可能性がある
- 折りたたみ可能なセクション設計を検討
- 生成中の状態表示は `AILoadingIndicator` を活用

---

## Phase 3: レビューステップ（優先度：低）

### 5. ReviewStep（レビューステップ）

**現在の状況:**
- メインエリアに評価機能が配置されている
- 評価結果の表示もメインエリア

**移行対象機能:**
1. **評価実行** (`handleEvaluate`)
   - 構造・プロット、キャラクター、文体・表現、読者ペルソナの4モード
2. **評価履歴表示**
   - 過去の評価結果の参照

**移行手順:**
1. `ReviewAssistantPanel.tsx` を作成
2. 評価対象の選択UIをパネル内に配置
3. 評価結果の表示はメインエリアに残す（サイズが大きいため）
4. `ToolsSidebar` の `renderAssistContent()` に `case 'review'` を追加

**注意点:**
- 評価結果は詳細なため、メインエリアに表示する方が良い
- パネルからは評価を実行し、結果はメインエリアに反映

---

## Phase 4: その他

### 6. ExportStep（エクスポートステップ）

**現在の状況:**
- AI機能なし

**対応:**
- 移行不要

---

## 共通実装パターン

### パネルコンポーネントの基本構造

```typescript
export const XxxAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess } = useToast();
    
    // AI生成状態
    const [isGenerating, setIsGenerating] = useState(false);
    
    // AIログ管理
    const { aiLogs, addLog } = useAILog();
    
    // AI生成関数
    const handleAIGenerate = async () => {
        // 実装
    };
    
    if (!currentProject) return null;
    
    return (
        <div className="space-y-4">
            {/* AI支援機能UI */}
            {/* 進捗状況 */}
            {/* AIログ */}
        </div>
    );
};
```

### ToolsSidebar への統合

```typescript
const renderAssistContent = () => {
    switch (currentStep) {
        case 'character':
            return <CharacterAssistantPanel />;
        case 'synopsis':
            return <SynopsisAssistantPanel />;
        case 'plot1':
            return <PlotStep1AssistantPanel />;
        case 'plot2':
            return <PlotStep2AssistantPanel />;
        case 'chapter':
            return <ChapterAssistantPanel />;
        case 'draft':
            return <DraftAssistantPanel />;
        case 'review':
            return <ReviewAssistantPanel />;
        // ...
    }
};
```

---

## 実装順序の推奨

1. **Phase 1-1: PlotStep1** （比較的シンプル）
2. **Phase 1-2: PlotStep2** （機能が多く参考になる）
3. **Phase 2-1: ChapterStep** （中規模）
4. **Phase 2-2: DraftStep** （大規模、最も複雑）
5. **Phase 3: ReviewStep** （評価機能）

---

## 注意事項

### 1. 状態管理
- すべての状態は `ProjectContext` 経由で管理
- パネル内でローカル状態を持つ場合は、必要最小限に

### 2. UI設計
- コンパクトなサイドバー向けのUI設計
- 折りたたみ可能なセクションを活用
- 既存の `AILoadingIndicator`、`AILogPanel` を活用

### 3. エラーハンドリング
- 既存の `useToast` フックを活用
- エラーメッセージは分かりやすく

### 4. パフォーマンス
- 重い処理は適切にメモ化
- 不要な再レンダリングを避ける

### 5. 一貫性
- 既存の `CharacterAssistantPanel`、`SynopsisAssistantPanel` のスタイルに合わせる
- アイコンやボタンのスタイルを統一

---

## 完了基準

各ステップの移行が完了したと判断する基準：

1. ✅ メインエリアからAI機能が削除されている
2. ✅ ツールサイドバーの「支援」タブで機能が利用可能
3. ✅ 既存の機能が正常に動作する
4. ✅ AIログが適切に記録・表示される
5. ✅ エラーハンドリングが適切
6. ✅ UIがコンパクトで使いやすい

---

## 参考ファイル

- 既存パネル実装:
  - `src/components/tools/CharacterAssistantPanel.tsx`
  - `src/components/tools/SynopsisAssistantPanel.tsx`
- 共通コンポーネント:
  - `src/components/common/AILogPanel.tsx`
  - `src/components/common/AILoadingIndicator.tsx`
  - `src/components/ToolsSidebar.tsx`
