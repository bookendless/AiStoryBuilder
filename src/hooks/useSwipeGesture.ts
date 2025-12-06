import { useEffect, useRef, RefObject } from 'react';

/**
 * スワイプ方向の型定義
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * スワイプジェスチャーのオプション
 */
export interface SwipeOptions {
    /**
     * スワイプと判定する最小距離(px)
     * @default 50
     */
    minSwipeDistance?: number;

    /**
     * スワイプの最大時間(ms)
     * @default 300
     */
    maxSwipeTime?: number;

    /**
     * 左スワイプ時のコールバック
     */
    onSwipeLeft?: () => void;

    /**
     * 右スワイプ時のコールバック
     */
    onSwipeRight?: () => void;

    /**
     * 上スワイプ時のコールバック
     */
    onSwipeUp?: () => void;

    /**
     * 下スワイプ時のコールバック
     */
    onSwipeDown?: () => void;

    /**
     * スワイプ開始時のコールバック
     */
    onSwipeStart?: () => void;

    /**
     * スワイプ終了時のコールバック
     */
    onSwipeEnd?: (direction: SwipeDirection | null) => void;
}

/**
 * スワイプジェスチャーを検出するカスタムフック
 * @param elementRef - スワイプを検出する要素のref
 * @param options - スワイプオプション
 */
export const useSwipeGesture = <T extends HTMLElement>(
    elementRef: RefObject<T>,
    options: SwipeOptions = {}
): void => {
    const {
        minSwipeDistance = 50,
        maxSwipeTime = 300,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onSwipeStart,
        onSwipeEnd,
    } = options;

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
            };
            onSwipeStart?.();
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStartRef.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;
            const deltaTime = Date.now() - touchStartRef.current.time;

            // スワイプ時間が長すぎる場合は無視
            if (deltaTime > maxSwipeTime) {
                touchStartRef.current = null;
                onSwipeEnd?.(null);
                return;
            }

            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);

            // 水平方向のスワイプ
            if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
                if (deltaX > 0) {
                    onSwipeRight?.();
                    onSwipeEnd?.('right');
                } else {
                    onSwipeLeft?.();
                    onSwipeEnd?.('left');
                }
            }
            // 垂直方向のスワイプ
            else if (absDeltaY > absDeltaX && absDeltaY > minSwipeDistance) {
                if (deltaY > 0) {
                    onSwipeDown?.();
                    onSwipeEnd?.('down');
                } else {
                    onSwipeUp?.();
                    onSwipeEnd?.('up');
                }
            } else {
                onSwipeEnd?.(null);
            }

            touchStartRef.current = null;
        };

        const handleTouchCancel = () => {
            touchStartRef.current = null;
            onSwipeEnd?.(null);
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchCancel);
        };
    }, [
        elementRef,
        minSwipeDistance,
        maxSwipeTime,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onSwipeStart,
        onSwipeEnd,
    ]);
};
