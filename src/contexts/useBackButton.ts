import { createContext, useContext } from 'react';

/**
 * Android戻るボタン対応Contextとその参照フック
 *
 * Provider（BackButtonContext.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * Contextオブジェクトと非コンポーネントのフックを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

/**
 * オーバーレイ（モーダル/サイドバー）の状態を表すインターフェース
 */
export interface OverlayState {
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
export interface BackButtonContextValue {
    /** オーバーレイを登録 */
    registerOverlay: (state: OverlayState) => void;
    /** オーバーレイの登録を解除 */
    unregisterOverlay: (id: string) => void;
}

export const BackButtonContext = createContext<BackButtonContextValue | null>(null);

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
