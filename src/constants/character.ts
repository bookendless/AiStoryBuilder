/**
 * キャラクター関連の定数
 */

// 画像関連の定数
export const IMAGE_CONFIG = {
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  QUALITY: 0.8,
  MAX_SIZE_MB: 5,
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
} as const;

// 文字数制限
export const TEXT_LIMITS = {
  APPEARANCE_MAX: 200,
  APPEARANCE_WARNING: 150,
  PERSONALITY_MAX: 200,
  PERSONALITY_WARNING: 150,
  BACKGROUND_MAX: 200,
  BACKGROUND_WARNING: 150,
  SPEECH_STYLE_MAX: 200,
  SPEECH_STYLE_WARNING: 100,
} as const;

// キャラクター生成関連（AI応答のテキスト解析で受け付ける最大人数）
export const CHARACTER_GENERATION = {
  PARSING_MAX: 30,
} as const;




























