import { useState, useEffect } from 'react';

/**
 * メディアクエリの状態を監視するカスタムフック
 * @param query - CSSメディアクエリ文字列 (例: '(max-width: 768px)')
 * @returns メディアクエリがマッチするかどうか
 */
export const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia(query);

        // 初期値を設定
        setMatches(mediaQuery.matches);

        // イベントリスナーを設定
        const handler = (event: MediaQueryListEvent) => {
            setMatches(event.matches);
        };

        // モダンブラウザ用
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
        } else {
            // レガシーブラウザ用
            mediaQuery.addListener(handler);
        }

        // クリーンアップ
        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handler);
            } else {
                mediaQuery.removeListener(handler);
            }
        };
    }, [query]);

    return matches;
};

/**
 * ブレークポイントの型定義
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * 現在のブレークポイントを返すカスタムフック
 * @returns 現在のブレークポイント
 */
export const useBreakpoint = (): Breakpoint => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
};

/**
 * タッチデバイスかどうかを判定するカスタムフック
 * @returns タッチデバイスかどうか
 */
export const useIsTouchDevice = (): boolean => {
    const [isTouch, setIsTouch] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const checkTouch = () => {
            setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
        };

        checkTouch();
    }, []);

    return isTouch;
};

/**
 * 画面の向きを監視するカスタムフック
 * @returns 画面の向き ('portrait' | 'landscape')
 */
export const useOrientation = (): 'portrait' | 'landscape' => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
        if (typeof window !== 'undefined') {
            return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        }
        return 'portrait';
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleOrientationChange = () => {
            setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
        };

        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            window.removeEventListener('resize', handleOrientationChange);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    return orientation;
};
