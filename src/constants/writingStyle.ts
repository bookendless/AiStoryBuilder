/**
 * 文体設定の選択肢定数
 * 新規プロジェクト作成とプロジェクト設定編集で共通使用
 */

// 基本文体オプション
// ProjectSettingsModalの多様な選択肢 + NewProjectModalの追加選択肢を統合
export const STYLE_OPTIONS = [
  '現代小説風',
  'ライトノベル風',
  '純文学風',
  '児童文学風',
  'ハードボイルド',
  '幻想的',
  'コミカル',
  'シリアス',
  '文語調',
  '口語的',
  '詩的',
  '簡潔',
  '詳細',
  'その他'
] as const;

// 人称オプション
// NewProjectModalの具体的な選択肢を使用（説明付き）
export const PERSPECTIVE_OPTIONS = [
  '一人称（私/僕/俺）',
  '三人称（彼/彼女）',
  '神の視点'
] as const;

// 硬軟オプション
// NewProjectModalの具体的な選択肢を使用
export const FORMALITY_OPTIONS = [
  '硬め',
  '柔らかめ',
  '口語的',
  '文語的'
] as const;

// リズムオプション
// NewProjectModalの具体的な選択肢を使用
export const RHYTHM_OPTIONS = [
  '短文中心',
  'テンポよく',
  '長短混合',
  '流れるような長文'
] as const;

// 比喩表現オプション
// NewProjectModalの具体的な選択肢を使用
export const METAPHOR_OPTIONS = [
  '多用',
  '控えめ',
  '詩的',
  '写実的'
] as const;

// 会話比率オプション
// NewProjectModalの具体的な選択肢を使用
export const DIALOGUE_OPTIONS = [
  '会話多め',
  '描写重視',
  'バランス型'
] as const;

// 感情描写オプション
// NewProjectModalの具体的な選択肢を使用
export const EMOTION_OPTIONS = [
  '内面重視',
  '行動で示す',
  '抑制的'
] as const;

// トーンオプション
// NewProjectModalの具体的な選択肢を使用
export const TONE_OPTIONS = [
  '緊張感',
  '穏やか',
  '明るい',
  '暗い',
  '切ない',
  '謎めいた'
] as const;

