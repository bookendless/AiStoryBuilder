import React, { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { ExitConfirmDialog } from '../components/ExitConfirmDialog';
import { BackButtonContext, BackButtonContextValue, OverlayState } from './useBackButton';

// 型は後方互換性のため再エクスポート
export type { BackButtonContextValue, OverlayState };

// ヒストリーステートのマーカー
const HISTORY_STATE_KEY = '__androidBackButton';

/**
 * Android戻るボタン対応Providerコンポーネント
 */
export const BackButtonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const overlaysRef = useRef<Map<string, OverlayState>>(new Map());
    const initializedRef = useRef(false);

    /**
     * オーバーレイを登録
     */
    const registerOverlay = useCallback((state: OverlayState) => {
        const overlays = overlaysRef.current;

        // 既に登録されている場合は更新のみ
        if (overlays.has(state.id)) {
            overlays.set(state.id, state);
            return;
        }

        // 新規登録時にhistoryにエントリを追加
        overlays.set(state.id, state);

        // ヒストリーにマーカーを付けてpush
        window.history.pushState(
            { [HISTORY_STATE_KEY]: state.id },
            ''
        );
    }, []);

    /**
     * オーバーレイの登録を解除
     */
    const unregisterOverlay = useCallback((id: string) => {
        overlaysRef.current.delete(id);
    }, []);

    /**
     * 終了確認ダイアログを閉じる
     */
    const dismissExitConfirm = useCallback(() => {
        setShowExitConfirm(false);
        // 終了確認から戻る場合、履歴を元に戻す
        window.history.pushState(null, '');
    }, []);

    /**
     * アプリを終了する
     */
    const confirmExit = useCallback(() => {
        try {
            // @ts-expect-error Tauri API
            if (window.__TAURI__) {
                window.close();
            } else {
                window.history.go(-(window.history.length - 1));
            }
        } catch {
            window.close();
        }
    }, []);

    /**
     * popstateイベントハンドラ
     */
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const overlays = overlaysRef.current;
            const state: unknown = event.state;
            const rawOverlayId = state && typeof state === 'object'
                ? (state as Record<string, unknown>)[HISTORY_STATE_KEY]
                : undefined;
            const overlayId = typeof rawOverlayId === 'string' ? rawOverlayId : undefined;

            // オーバーレイが開いている場合
            if (overlays.size > 0) {
                const sortedOverlays = Array.from(overlays.values()).sort(
                    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
                );

                if (overlayId && overlays.has(overlayId)) {
                    const overlay = overlays.get(overlayId)!;
                    overlay.onClose();
                    overlays.delete(overlayId);
                } else if (sortedOverlays.length > 0) {
                    const topOverlay = sortedOverlays[0];
                    topOverlay.onClose();
                    overlays.delete(topOverlay.id);
                }
                return;
            }

            // オーバーレイがなく、終了確認ダイアログが表示されていない場合
            if (!showExitConfirm) {
                setShowExitConfirm(true);
                window.history.pushState(
                    { [HISTORY_STATE_KEY]: '__exit_confirm' },
                    ''
                );
            } else {
                setShowExitConfirm(false);
            }
        };

        // 初期のヒストリーエントリを追加（アプリ起動時）
        if (!initializedRef.current) {
            initializedRef.current = true;
            window.history.pushState(null, '');
        }

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showExitConfirm]);

    const contextValue: BackButtonContextValue = {
        registerOverlay,
        unregisterOverlay,
    };

    return (
        <BackButtonContext.Provider value={contextValue}>
            {children}
            <ExitConfirmDialog
                isOpen={showExitConfirm}
                onCancel={dismissExitConfirm}
                onConfirm={confirmExit}
            />
        </BackButtonContext.Provider>
    );
};
