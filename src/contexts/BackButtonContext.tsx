import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { ExitConfirmDialog } from '../components/ExitConfirmDialog';

/**
 * オーバーレイ（モーダル/サイドバー）の状態を表すインターフェース
 */
interface OverlayState {
    /** 識別子 */
    id: string;
    /** 閉じる関数 */
    onClose: () => void;
    /** 優先度（高いほど先に閉じる）*/
    priority?: number;
}

/**
 * Android戻るボタン対応Contextの値
 */
interface BackButtonContextValue {
    /** オーバーレイを登録 */
    registerOverlay: (state: OverlayState) => void;
    /** オーバーレイの登録を解除 */
    unregisterOverlay: (id: string) => void;
}

// ヒストリーステートのマーカー
const HISTORY_STATE_KEY = '__androidBackButton';

const BackButtonContext = createContext<BackButtonContextValue | null>(null);

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
            const state = event.state;
            const overlayId = state?.[HISTORY_STATE_KEY];

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

/**
 * Android戻るボタン対応機能を使用するためのフック
 */
export function useBackButton(): BackButtonContextValue {
    const context = useContext(BackButtonContext);
    if (!context) {
        // Context外で使用された場合はダミー関数を返す（デスクトップ環境など）
        return {
            registerOverlay: () => { },
            unregisterOverlay: () => { },
        };
    }
    return context;
}

/**
 * オーバーレイコンポーネント用のヘルパーフック
 * モーダルやサイドバーで使用する
 */
export function useOverlayBackHandler(
    isOpen: boolean,
    onClose: () => void,
    id: string,
    priority: number = 0
) {
    const { registerOverlay, unregisterOverlay } = useBackButton();
    // 登録状態とID・priority・onCloseをrefで保持（依存関係から外す）
    const registeredRef = useRef(false);
    const idRef = useRef(id);
    const priorityRef = useRef(priority);
    const onCloseRef = useRef(onClose);

    // 値を常に最新に保つ
    idRef.current = id;
    priorityRef.current = priority;
    onCloseRef.current = onClose;

    useEffect(() => {
        if (isOpen && !registeredRef.current) {
            // 登録
            registerOverlay({
                id: idRef.current,
                onClose: () => onCloseRef.current(),
                priority: priorityRef.current
            });
            registeredRef.current = true;
        } else if (!isOpen && registeredRef.current) {
            // 解除（isOpenがfalseになった時のみ）
            unregisterOverlay(idRef.current);
            registeredRef.current = false;
        }

        // クリーンアップ：コンポーネントがアンマウントされた時のみ
        return () => {
            // コンポーネントアンマウント時に登録されていれば解除
            // ただし、isOpenの変更による再実行では実行しない
            // （isOpenがtrueのまま再実行された場合は何もしない）
        };
    }, [isOpen, registerOverlay, unregisterOverlay]);

    // コンポーネントの完全アンマウント時のクリーンアップ
    useEffect(() => {
        const currentId = idRef.current;
        return () => {
            if (registeredRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                unregisterOverlay(currentId);
                registeredRef.current = false;
            }
        };
        // 空の依存配列で、コンポーネントのアンマウント時のみ実行
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
