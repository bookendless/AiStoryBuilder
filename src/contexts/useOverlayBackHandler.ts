import { useEffect, useRef } from 'react';
import { useBackButton } from './useBackButton';

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
                unregisterOverlay(currentId);
                registeredRef.current = false;
            }
        };
        // 空の依存配列で、コンポーネントのアンマウント時のみ実行
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
