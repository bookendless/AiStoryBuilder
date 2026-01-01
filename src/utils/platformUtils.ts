/**
 * プラットフォーム検出ユーティリティ
 */

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: {
    metadata?: {
      platform?: string;
    };
  };
  __TAURI__?: unknown;
}

/**
 * Tauri環境かどうかを検出
 */
export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  const typedWindow = window as unknown as TauriWindow;
  return Boolean(typedWindow.__TAURI_INTERNALS__ || typedWindow.__TAURI__);
};

/**
 * Android環境かどうかを検出
 */
export const isAndroidEnvironment = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // Tauri環境でない場合はfalseを返す（Web環境ではユーザーエージェント判定をしない）
  if (!isTauriEnvironment()) return false;

  // 1. Tauri 2.0の内部パスから判定（最も確実）
  const typedWindow = window as unknown as TauriWindow;
  if (typedWindow.__TAURI_INTERNALS__?.metadata?.platform === 'android') {
    return true;
  }

  // 2. ユーザーエージェントで判定（フォールバック）
  // Tauri環境でmetadataが取得できない場合のフォールバック
  if (typeof navigator !== 'undefined') {
    return /Android/i.test(navigator.userAgent);
  }

  return false;
};

/**
 * iOS環境かどうかを検出
 */
export const isIOSEnvironment = async (): Promise<boolean> => {
  if (!isTauriEnvironment()) return false;

  // 1. Tauri 2.0の内部パスから判定
  const typedWindow = window as unknown as TauriWindow;
  if (typedWindow.__TAURI_INTERNALS__?.metadata?.platform === 'ios') {
    return true;
  }

  // 2. ユーザーエージェントで判定
  if (typeof navigator !== 'undefined') {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  return false;
};

/**
 * モバイル環境（AndroidまたはiOS）かどうかを検出
 */
export const isMobileEnvironment = async (): Promise<boolean> => {
  const [isAndroid, isIOS] = await Promise.all([
    isAndroidEnvironment(),
    isIOSEnvironment()
  ]);
  return isAndroid || isIOS;
};
