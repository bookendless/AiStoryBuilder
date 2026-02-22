/**
 * プロンプトテンプレート - 共通型定義とバレルエクスポート
 * 
 * ## プレースホルダー規約
 * 
 * このモジュールのプロンプトテンプレートでは、以下の2種類のプレースホルダー形式を使用します：
 * 
 * ### 1. 単一波括弧 `{variable}`
 * - **用途**: 動的に置換される変数
 * - **例**: `{title}`, `{characters}`, `{chapterSummary}`
 * - **処理**: アプリケーション側で実際の値に置換される
 * 
 * ### 2. 二重波括弧 `{{key}}`
 * - **用途**: JSON出力例内のリテラル波括弧
 * - **例**: `{{"score": 0-10の整数, "summary": "..."}}`
 * - **理由**: テンプレートリテラル内で `{` をエスケープするため
 * - **注意**: AIへの出力例として表示され、置換されない
 * 
 * ### 使用例
 * ```typescript
 * const prompt = `作品タイトル: {title}
 * 
 * 以下のJSON形式で出力してください：
 * {{
 *   "score": 1-5の整数,
 *   "summary": "評価（200文字以内）"
 * }}`;
 * ```
 */

// プロンプトテンプレートのインターフェース
export interface PromptTemplates {
    [key: string]: {
        [subType: string]: string;
    };
}

// キャラクター関連プロンプト
export * from './character';

// プロット関連プロンプト
export * from './plot';

// あらすじ関連プロンプト
export * from './synopsis';

// 評価関連プロンプト
export * from './evaluation';

// 章立て関連プロンプト
export * from './chapter';

// 草案関連プロンプト
export * from './draft';

// 世界観設定関連プロンプト
export * from './world';

// 伏線関連プロンプト
export * from './foreshadowing';

// 画像・音声からの物語生成関連プロンプト
export * from './media';

// 全プロンプトを統合したオブジェクトを構築
import { CHARACTER_PROMPTS } from './character';
import { PLOT_PROMPTS } from './plot';
import { SYNOPSIS_PROMPTS } from './synopsis';
import { EVALUATION_PROMPTS } from './evaluation';
import { CHAPTER_PROMPTS } from './chapter';
import { DRAFT_PROMPTS } from './draft';
import { WORLD_PROMPTS } from './world';
import { FORESHADOWING_PROMPTS } from './foreshadowing';
import { IMAGE_TO_STORY_PROMPTS, AUDIO_TO_STORY_PROMPTS, AUDIO_IMAGE_TO_STORY_PROMPTS } from './media';

/**
 * 全プロンプトテンプレートを統合したオブジェクト
 */
export const PROMPTS: PromptTemplates = {
    character: CHARACTER_PROMPTS,
    plot: PLOT_PROMPTS,
    synopsis: SYNOPSIS_PROMPTS,
    evaluation: EVALUATION_PROMPTS,
    chapter: CHAPTER_PROMPTS,
    draft: DRAFT_PROMPTS,
    world: WORLD_PROMPTS,
    foreshadowing: FORESHADOWING_PROMPTS,
    imageToStory: IMAGE_TO_STORY_PROMPTS,
    audioToStory: AUDIO_TO_STORY_PROMPTS,
    audioImageToStory: AUDIO_IMAGE_TO_STORY_PROMPTS,
};
