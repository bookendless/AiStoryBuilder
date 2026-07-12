const STORAGE_KEY = 'feature_flags';

export const DEFAULT_FEATURE_FLAGS = {
  IMAGE_BOARD: true,
  GLOSSARY: true,
  RELATIONSHIPS: true,
  TIMELINE: true,
  WORLD_SETTINGS: true,
  FORESHADOWINGS: true,
  EMOTION_MAP: false,
  CONSISTENCY_GUARD: true,
  WHAT_IF_LAB: true,
} as const;

export type FeatureKey = keyof typeof DEFAULT_FEATURE_FLAGS;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  IMAGE_BOARD: 'イメージボード',
  GLOSSARY: '用語集',
  RELATIONSHIPS: '相関図',
  TIMELINE: 'タイムライン',
  WORLD_SETTINGS: '世界観',
  FORESHADOWINGS: '伏線トラッカー',
  EMOTION_MAP: '感情マップ',
  CONSISTENCY_GUARD: '整合性ガード',
  WHAT_IF_LAB: '平行世界ラボ',
};

function loadFlags(): Record<FeatureKey, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Record<FeatureKey, boolean>>;
      return { ...DEFAULT_FEATURE_FLAGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_FEATURE_FLAGS };
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return loadFlags()[key];
}

export function setFeatureEnabled(key: FeatureKey, enabled: boolean): void {
  const flags = loadFlags();
  flags[key] = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // ignore
  }
}

export function getAllFeatureFlags(): Record<FeatureKey, boolean> {
  return loadFlags();
}
