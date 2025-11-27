import React, { useEffect, useRef } from 'react';
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

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
        full: 'max-w-full mx-4',
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
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
                className={`
          relative w-full ${sizeClasses[size]} 
          glass-strong glass-shimmer
          rounded-2xl
          transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95
          flex flex-col max-h-[90vh]
          ${className}
        `}
            >
                {/* ヘッダー */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/10 shrink-0">
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
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
});

Modal.displayName = 'Modal';
