import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(({
    isOpen,
    onClose,
    title,
    children,
    className = '',
    size = 'md',
    showCloseButton = true,
}, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    // 外部からのrefと内部のrefを統合
    const modalRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;
    const previousActiveElement = useRef<HTMLElement | null>(null);
    const hasInitialFocused = useRef(false);

    // onCloseをrefで保持して、依存関係から除外
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // フォーカス可能な要素を取得する関数
    const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
        const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
            (el) => !el.hasAttribute('disabled') && !el.hasAttribute('aria-hidden')
        );
    };

    // キーボードイベントハンドラー（refを使用して安定した参照を維持）
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!modalRef.current) return;

        // Escapeキーでモーダルを閉じる
        if (e.key === 'Escape') {
            onCloseRef.current();
            return;
        }

        // Tabキーでフォーカストラップ
        if (e.key === 'Tab') {
            const focusableElements = getFocusableElements(modalRef.current);
            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const currentElement = document.activeElement as HTMLElement;

            if (e.shiftKey) {
                // Shift+Tab: 逆方向
                if (currentElement === firstElement || !focusableElements.includes(currentElement)) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: 順方向
                if (currentElement === lastElement || !focusableElements.includes(currentElement)) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    }, [modalRef]);

    // フォーカストラップの実装
    useEffect(() => {
        if (!isOpen || !modalRef.current) {
            // モーダルが閉じた時にフラグをリセット
            hasInitialFocused.current = false;
            return;
        }

        // モーダルが開いた時の処理
        previousActiveElement.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        // モーダル内の最初の要素にフォーカス（初回のみ）
        if (!hasInitialFocused.current) {
            hasInitialFocused.current = true;
            setTimeout(() => {
                if (!modalRef.current) return;
                const focusableElements = getFocusableElements(modalRef.current);
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                } else {
                    // フォーカス可能な要素がない場合はモーダル自体にフォーカス
                    modalRef.current?.setAttribute('tabindex', '-1');
                    modalRef.current?.focus();
                }
            }, 100);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';

            // 前の要素にフォーカスを戻す
            if (previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
        full: 'max-w-full mx-0 sm:mx-4',
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
            role="dialog"
            aria-modal="true"
        >
            {/* 背景オーバーレイ: グラデーションとぼかし効果 */}
            <div
                className="absolute inset-0 glass-overlay transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* モーダルコンテンツ: 強化されたGlassmorphism */}
            <div
                ref={modalRef}
                tabIndex={-1}
                className={`
          relative w-full ${sizeClasses[size]} 
          glass-strong glass-shimmer
          rounded-t-2xl sm:rounded-2xl
          transform transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95
          flex flex-col max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] sm:max-h-[90vh]
          focus:outline-none
          ${className}
        `}
            >
                {/* ヘッダー */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/20 dark:border-white/10 shrink-0">
                        {title && (
                            <div className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {title}
                            </div>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
                                aria-label="閉じる"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* コンテンツ */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
});

Modal.displayName = 'Modal';
