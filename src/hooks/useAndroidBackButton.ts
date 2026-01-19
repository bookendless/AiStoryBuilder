import { useEffect, useCallback, useRef } from 'react';

/**
 * モーダル/サイドバーの状態を表すインターフェース
 */
interface OverlayState {
    /** 識別子 */
    id: string;
    /** 閉じる関数 */
    onClose: () => void;
    /** 優先度（高いほど先に閉じる） */
    priority?: number;
}

/**
 * Android戻るボタン対応フックの戻り値
 */
interface UseAndroidBackButtonReturn {
    /** オーバーレイ（モーダル/サイドバー）を登録 */
    registerOverlay: (state: OverlayState) => void;
    /** オーバーレイの登録を解除 */
    unregisterOverlay: (id: string) => void;
    /** 終了確認ダイアログを表示するか */
    showExitConfirm: boolean;
    /** 終了確認ダイアログを閉じる */
    dismissExitConfirm: () => void;
    /** アプリを終了する */
    confirmExit: () => void;
}

// ヒストリーステートのマーカー
const HISTORY_STATE_KEY = '__androidBackButton';

/**
 * Android戻るボタンに対応するカスタムフック
 * 
 * ブラウザのhistory API（pushState/popstate）を使用して、
 * モーダルやサイドバーが開いている場合は戻るボタンで閉じ、
 * 何も開いていない場合は終了確認ダイアログを表示する
 */
export function useAndroidBackButton(
    onShowExitConfirm: () => void,
    onDismissExitConfirm: () => void,
    showExitConfirm: boolean
): UseAndroidBackButtonReturn {
    // 登録されているオーバーレイのマップ
    const overlaysRef = useRef<Map<string, OverlayState>>(new Map());
    // 初期化済みフラグ
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
        onDismissExitConfirm();
        // 終了確認から戻る場合、履歴を元に戻す
        window.history.pushState(null, '');
    }, [onDismissExitConfirm]);

    /**
     * アプリを終了する
     */
    const confirmExit = useCallback(() => {
        // Tauriアプリの場合はウィンドウを閉じる
        // WebViewの場合はhistory操作で対応
        try {
            // @ts-expect-error Tauri API
            if (window.__TAURI__) {
                // Tauri環境ではウィンドウを閉じる
                window.close();
            } else {
                // 通常のブラウザではhistory.go(-history.length)
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

            // ヒストリーステートにマーカーがあるかチェック
            const state = event.state;
            const overlayId = state?.[HISTORY_STATE_KEY];

            // オーバーレイが開いている場合
            if (overlays.size > 0) {
                // 優先度順にソートして最も優先度の高いものを閉じる
                const sortedOverlays = Array.from(overlays.values()).sort(
                    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
                );

                // 特定のオーバーレイIDがある場合はそれを閉じる
                if (overlayId && overlays.has(overlayId)) {
                    const overlay = overlays.get(overlayId)!;
                    overlay.onClose();
                    overlays.delete(overlayId);
                } else if (sortedOverlays.length > 0) {
                    // なければ最も優先度の高いものを閉じる
                    const topOverlay = sortedOverlays[0];
                    topOverlay.onClose();
                    overlays.delete(topOverlay.id);
                }
                return;
            }

            // オーバーレイがなく、終了確認ダイアログが表示されていない場合
            if (!showExitConfirm) {
                // 終了確認ダイアログを表示
                onShowExitConfirm();
                // ダイアログ用のヒストリーエントリを追加（戻るボタンでダイアログを閉じられるように）
                window.history.pushState(
                    { [HISTORY_STATE_KEY]: '__exit_confirm' },
                    ''
                );
            } else {
                // 終了確認ダイアログが表示中に戻るボタンが押された場合は閉じる
                onDismissExitConfirm();
            }
        };

        // 初期のヒストリーエントリを追加（アプリ起動時）
        if (!initializedRef.current) {
            initializedRef.current = true;
            // 初期状態をpush
            window.history.pushState(null, '');
        }

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showExitConfirm, onShowExitConfirm, onDismissExitConfirm]);

    return {
        registerOverlay,
        unregisterOverlay,
        showExitConfirm,
        dismissExitConfirm,
        confirmExit,
    };
}

/**
 * オーバーレイコンポーネント用のヘルパーフック
 * モーダルやサイドバーで使用する
 */
export function useOverlayBackHandler(
    isOpen: boolean,
    onClose: () => void,
    id: string,
    registerOverlay: (state: OverlayState) => void,
    unregisterOverlay: (id: string) => void,
    priority: number = 0
) {
    const registeredRef = useRef(false);

    useEffect(() => {
        if (isOpen && !registeredRef.current) {
            registerOverlay({ id, onClose, priority });
            registeredRef.current = true;
        } else if (!isOpen && registeredRef.current) {
            unregisterOverlay(id);
            registeredRef.current = false;
        }
    }, [isOpen, id, onClose, priority, registerOverlay, unregisterOverlay]);

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (registeredRef.current) {
                unregisterOverlay(id);
            }
        };
    }, [id, unregisterOverlay]);
}
