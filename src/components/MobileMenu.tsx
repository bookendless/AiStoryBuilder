import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileMenuProps {
    /**
     * メニューが開いているかどうか
     */
    isOpen: boolean;

    /**
     * メニューを閉じる関数
     */
    onClose: () => void;

    /**
     * メニューのコンテンツ
     */
    children: React.ReactNode;

    /**
     * メニューのタイトル
     */
    title?: string;

    /**
     * メニューの位置
     * @default 'left'
     */
    position?: 'left' | 'right';

    /**
     * 追加のクラス名
     */
    className?: string;
}

/**
 * モバイル用のスライドインメニューコンポーネント
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({
    isOpen,
    onClose,
    children,
    title,
    position = 'left',
    className = '',
}) => {
    // Escキーでメニューを閉じる
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // メニューが開いているときはスクロールを無効化
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* バックドロップ */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* メニュー本体 */}
            <div
                className={`fixed top-0 ${position === 'left' ? 'left-0' : 'right-0'
                    } h-full w-80 max-w-[85vw] glass border-r dark:border-gray-700 z-50 transition-transform duration-300 ${isOpen
                        ? 'translate-x-0'
                        : position === 'left'
                            ? '-translate-x-full'
                            : 'translate-x-full'
                    } ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={title || 'メニュー'}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    {title && (
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                            {title}
                        </h2>
                    )}
                    <button
                        onClick={onClose}
                        className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500"
                        aria-label="メニューを閉じる"
                    >
                        <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="overflow-y-auto h-[calc(100%-73px)]">
                    {children}
                </div>
            </div>
        </>
    );
};
