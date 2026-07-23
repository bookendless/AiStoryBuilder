/**
 * 用語集関連プロンプト
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * 用語集プロンプトのサニタイズ上限（文字数）。
 * 既存の用語集全件が指示より前に無制限で挿入される構造上、用語が増えると
 * 既定の10000文字では末尾のJSON出力形式指示が黙って切り詰められる。
 * generateContent の maxPromptLength に渡して引き上げる。
 */
export const GLOSSARY_PROMPT_CAP = 20000;

/** プロジェクト情報からの重要用語自動抽出プロンプト */
export function buildGlossaryExtractTermsPrompt(projectContext: string, existingGlossaryJson: string): string {
  return `あなたは小説の設定資料を整理する用語集編集者です。以下のプロジェクト情報から、用語集に追加すべき重要な用語を抽出してください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('既存の用語集（これに含まれる用語は除外する）', existingGlossaryJson)}

【指示】
1. プロジェクト内で使用されている重要な用語（固有名詞、専門用語、特殊な概念など）を抽出する
2. 既存の用語集に含まれている用語は除外する
3. 各用語について以下の情報を提供する：
   - 用語名
   - 読み方（ひらがなまたはカタカナ）
   - 説明（プロジェクトの世界観に合わせた説明）
   - カテゴリ（character: キャラクター, location: 場所・舞台, concept: 概念・用語, item: アイテム, other: その他）

【出力形式】
以下のJSON配列形式で出力してください：
[
  {
    "term": "用語名",
    "reading": "読み方",
    "definition": "説明",
    "category": "character|location|concept|item|other"
  },
  ...
]

${JSON_OUTPUT_RULES}`;
}

/** 1件の用語についての説明文自動生成プロンプト */
export function buildGlossaryDescriptionPrompt(
  projectContext: string,
  term: string,
  reading: string | undefined
): string {
  return `あなたは小説の設定資料を整理する用語集編集者です。以下の用語について、プロジェクトの世界観に合わせた説明文を生成してください。

${dataBlock('プロジェクト情報', projectContext)}

【対象の用語】
用語: ${term}
${reading ? `読み方: ${reading}` : ''}

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成する
2. 説明文は100文字以上300文字程度で、具体的で分かりやすい内容にする
3. 読み方が未入力の場合は読み方も提案する
4. カテゴリも提案する（character, location, concept, item, otherのいずれか）

【出力形式】
以下のJSON形式で出力してください：
{
  "definition": "説明文",
  "reading": "読み方（ひらがなまたはカタカナ）",
  "category": "character|location|concept|item|other",
  "notes": "追加情報（任意）"
}

${JSON_OUTPUT_RULES}`;
}

/** 用語リストの一括用語集エントリ生成プロンプト */
export function buildGlossaryBatchGeneratePrompt(projectContext: string, termListText: string): string {
  return `あなたは小説の設定資料を整理する用語集編集者です。以下の用語リストについて、プロジェクトの世界観に合わせた用語集エントリを生成してください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('用語リスト', termListText)}

【指示】
各用語について以下の情報を生成する：
1. 読み方（ひらがなまたはカタカナ）
2. 説明（プロジェクトの世界観に合わせた説明、100文字以上300文字程度）
3. カテゴリ（character: キャラクター, location: 場所・舞台, concept: 概念・用語, item: アイテム, other: その他）

【出力形式】
以下のJSON配列形式で出力してください：
[
  {
    "term": "用語名",
    "reading": "読み方",
    "definition": "説明",
    "category": "character|location|concept|item|other"
  },
  ...
]

${JSON_OUTPUT_RULES}`;
}
