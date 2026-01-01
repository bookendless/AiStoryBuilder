/**
 * プロンプトテンプレート - 共通型定義とバレルエクスポート
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
