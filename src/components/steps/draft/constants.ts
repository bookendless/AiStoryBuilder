import type {
  AIStatusTone,
  AISuggestionType,
  HistoryEntryType,
  SuggestionPromptPayload,
} from './types';

export const MODAL_TEXTAREA_MIN_HEIGHT = 260;
export const MODAL_TEXTAREA_MAX_HEIGHT = 1000;
export const MODAL_TEXTAREA_DEFAULT_HEIGHT = 420;
export const MODAL_TEXTAREA_HEIGHT_STEP = 80;
export const MODAL_FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24];
export const MODAL_LINE_HEIGHT_OPTIONS = [1.4, 1.6, 1.8];
export const MODAL_DEFAULT_FONT_SIZE = 16;
export const MODAL_DEFAULT_LINE_HEIGHT = 1.6;

export const HISTORY_STORAGE_PREFIX = 'chapterHistory';
export const HISTORY_MAX_ENTRIES = 30;
export const HISTORY_AUTO_SAVE_DELAY = 300000; // 5分

export const HISTORY_TYPE_LABELS: Record<HistoryEntryType, string> = {
  auto: '自動保存',
  manual: '手動保存',
  restore: '復元前',
};

export const HISTORY_BADGE_CLASSES: Record<HistoryEntryType, string> = {
  auto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  manual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};

export const MAX_SUGGESTION_TEXT_LENGTH = 2000;

export const SUGGESTION_CONFIG: Record<
  AISuggestionType,
  {
    label: string;
    description: string;
    prompt: (payload: SuggestionPromptPayload) => string;
  }
> = {
  rewrite: {
    label: 'リライト案',
    description: '読みやすさと臨場感を両立した案を生成します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは熟練の小説編集者です。以下のテキストを、読者が没入しやすい自然な流れに整えてください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください（余計な文章は書かないこと）:
{
  "suggestions": [
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" },
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" },
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" }
  ]
}

各案は文体やリズムに変化を付け、会話と描写のバランスを意識してください。`,
  },
  tone: {
    label: 'トーン調整',
    description: '雰囲気や感情のトーンを強調した案を提示します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは物語のトーンを整える編集者です。以下のテキストの感情・雰囲気を際立たせたバリエーションを3案提案してください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください:
{
  "suggestions": [
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" },
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" },
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" }
  ]
}

各案では異なる感情や雰囲気（例: 緊張感、切なさ、希望など）を意識し、描写を調整してください。`,
  },
  summary: {
    label: '要約＆鍵フレーズ',
    description: '内容を整理し、重要な要素を抽出します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは編集アシスタントです。以下のテキストの要点を整理し、今後の執筆に役立つ情報を抽出してください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください:
{
  "suggestions": [
    { "title": "要約", "body": "3〜4文で内容を要約" },
    { "title": "伏線・感情のヒント", "body": "注意すべきポイントを箇条書きで" },
    { "title": "キーフレーズ", "body": "重要語句やアイデアを列挙" }
  ]
}

要約は具体的・簡潔に、箇条書きは「・」で始めてください。`,
  },
};

export const AI_STATUS_STYLES: Record<
  AIStatusTone,
  {
    container: string;
    icon: string;
    title: string;
    detail: string;
  }
> = {
  emerald: {
    container:
      'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200',
    icon: 'bg-emerald-500 text-white',
    title: 'text-emerald-700 dark:text-emerald-200',
    detail: 'text-emerald-600 dark:text-emerald-300',
  },
  blue: {
    container:
      'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    icon: 'bg-blue-500 text-white',
    title: 'text-blue-700 dark:text-blue-200',
    detail: 'text-blue-600 dark:text-blue-300',
  },
  purple: {
    container:
      'bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-200',
    icon: 'bg-purple-500 text-white',
    title: 'text-purple-700 dark:text-purple-200',
    detail: 'text-purple-600 dark:text-purple-300',
  },
};


