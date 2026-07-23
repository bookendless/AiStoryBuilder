/**
 * 感情分析関連プロンプト
 */

import { EmotionAnalysisRequest } from '../../types/emotion';
import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * 感情分析プロンプトのサニタイズ上限（文字数）。
 * 章の草案を全文そのままdataBlockへ入れる構造上、既定の10000文字では
 * 末尾のJSON出力形式指示が黙って切り詰められ、解析失敗を招く。
 * generateContent の maxPromptLength に渡して引き上げる。
 */
export const EMOTION_PROMPT_CAP = 30000;

/** 章の感情分析プロンプトを生成 */
export const buildEmotionAnalysisPrompt = (request: EmotionAnalysisRequest): string => {
  // 分析対象の決定
  const primaryContent = request.chapter.draft
    ? dataBlock('章の草案（全文・分析対象）', request.chapter.draft)
    : `【章の概要（分析対象）】\nタイトル: ${request.chapter.title}\n概要: ${request.chapter.summary}`;

  // 補助情報の構築
  const supplementaryInfo = [
    request.chapter.mood ? `雰囲気: ${request.chapter.mood}` : null,
    request.chapter.setting ? `設定: ${request.chapter.setting}` : null,
    request.chapter.keyEvents && request.chapter.keyEvents.length > 0
      ? `重要な出来事: ${request.chapter.keyEvents.join(', ')}`
      : null,
  ].filter(Boolean).join('\n');

  return `あなたは小説の感情分析の専門家です。以下の章の情報を分析し、読者が感じるであろう感情を数値化してください。

【プロジェクト情報】
ジャンル: ${request.projectContext.genre}
テーマ: ${request.projectContext.theme}
${request.projectContext.targetReader ? `対象読者: ${request.projectContext.targetReader}` : ''}

${primaryContent}

${supplementaryInfo ? `【補助情報】\n${supplementaryInfo}` : ''}

【前章の感情状態】
${request.previousChapterEmotion
  ? `総合スコア: ${request.previousChapterEmotion.overallScore}
主要感情: ${request.previousChapterEmotion.aiAnalysis?.dominantEmotion}`
  : '（最初の章）'}

【分析指針】
${request.chapter.draft
  ? '草案の全文を読んで、実際の文章から読者が感じる感情を分析してください。描写、会話、行動から感情を読み取ってください。'
  : `章の概要、タイトル、ムード設定、重要な出来事から、読者がこの章を読んだ時に感じるであろう感情を推測してください。直接的な感情表現がなくても、状況や描写から感情を数値化してください。
- ムード設定（例：「暗い」「明るい」「緊張感がある」など）から感情の方向性を推測する
- 重要な出来事の内容から感情の強度を推測する
- 章のタイトルから物語の展開を推測する
- 前章との関係性から感情の変化を推測する`}

【分析する感情】
以下の感情について、読者が感じるであろう強度を0-100のスコアで評価してください：
- joy (喜び): 読者が感じる喜びや幸福感
- sadness (悲しみ): 読者が感じる悲しみや切なさ
- anger (怒り): 読者が感じる怒りや憤り
- fear (恐怖): 読者が感じる恐怖や不安
- surprise (驚き): 読者が感じる驚きや意外性
- anticipation (期待): 読者が感じる期待感や先への期待
- tension (緊張): 読者が感じる緊張感や緊迫感
- excitement (興奮): 読者が感じる興奮や高揚感

【その他の評価項目】
- 総合的な感情スコア (-100 to +100): ポジティブな感情が強いほど正の値、ネガティブな感情が強いほど負の値
- テンポ (0-100): 0=静かでゆったり、100=激しく動的
- 読者の予測される没入度 (0-100): 読者が物語に没入する度合い

【出力形式】
以下のJSON形式で出力してください：
{
  "emotions": {
    "joy": 0-100,
    "sadness": 0-100,
    "anger": 0-100,
    "fear": 0-100,
    "surprise": 0-100,
    "anticipation": 0-100,
    "tension": 0-100,
    "excitement": 0-100
  },
  "overallScore": -100 to 100,
  "pace": 0-100,
  "immersionScore": 0-100,
  "dominantEmotion": "joy|sadness|anger|fear|surprise|anticipation|tension|excitement",
  "emotionalArc": "rising|falling|stable|fluctuating",
  "issues": ["問題点1", "問題点2"],
  "suggestions": ["提案1", "提案2"],
  "analysisSource": "${request.chapter.draft ? 'draft' : 'summary'}"
}

${JSON_OUTPUT_RULES}`;
};
