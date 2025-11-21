import React, { useState, useEffect, useRef } from 'react';
import { X, HelpCircle } from 'lucide-react';

export interface TooltipProps {
  id: string; // ツールチップの一意のID（localStorageのキーとして使用）
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // 表示までの遅延（ミリ秒）
  showOnce?: boolean; // 一度だけ表示するかどうか
  persistent?: boolean; // 常に表示するかどうか（showOnceと併用不可）
  className?: string;
  trigger?: 'hover' | 'click' | 'focus';
  onShow?: () => void;
  onHide?: () => void;
}

export const Tooltip: React.FC<TooltipProps> = ({
  id,
  content,
  children,
  position = 'top',
  delay = 300,
  showOnce = false,
  persistent = false,
  className = '',
  trigger = 'hover',
  onShow,
  onHide,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDismissOption, setShowDismissOption] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // localStorageから非表示状態を読み込む
  useEffect(() => {
    if (showOnce) {
      const dismissed = localStorage.getItem(`tooltip-dismissed-${id}`);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, [id, showOnce]);

  // 位置の計算
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  // 矢印の位置
  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 dark:border-t-gray-200 border-l-transparent border-r-transparent border-b-transparent';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800 dark:border-b-gray-200 border-l-transparent border-r-transparent border-t-transparent';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-800 dark:border-l-gray-200 border-t-transparent border-b-transparent border-r-transparent';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-800 dark:border-r-gray-200 border-t-transparent border-b-transparent border-l-transparent';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 dark:border-t-gray-200 border-l-transparent border-r-transparent border-b-transparent';
    }
  };

  const handleShow = () => {
    if (isDismissed) return;

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
        setShowDismissOption(true);
        onShow?.();
      }, delay);
    } else {
      setIsVisible(true);
      setShowDismissOption(true);
      onShow?.();
    }
  };

  const handleHide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    onHide?.();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(`tooltip-dismissed-${id}`, 'true');
    }
  };

  // イベントハンドラーの設定
  const eventHandlers = {
    hover: {
      onMouseEnter: handleShow,
      onMouseLeave: handleHide,
    },
    click: {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVisible) {
          handleHide();
        } else {
          handleShow();
        }
      },
    },
    focus: {
      onFocus: handleShow,
      onBlur: handleHide,
    },
  };

  const handlers = eventHandlers[trigger];

  // クリックアウトサイドで閉じる
  useEffect(() => {
    if (trigger === 'click' && isVisible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          tooltipRef.current &&
          triggerRef.current &&
          !tooltipRef.current.contains(event.target as Node) &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          handleHide();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [trigger, isVisible]);

  if (isDismissed && showOnce) {
    return <>{children}</>;
  }

  return (
    <div className={`relative inline-block ${className}`} ref={triggerRef} {...handlers}>
      {children}
      {isVisible && !isDismissed && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${getPositionClasses()} ${
            persistent ? '' : 'pointer-events-none'
          }`}
          role="tooltip"
          aria-live="polite"
        >
          <div className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg shadow-xl p-3 max-w-xs text-sm font-['Noto_Sans_JP']">
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1">{content}</div>
              {showDismissOption && showOnce && (
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 text-gray-400 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors"
                  aria-label="次回から表示しない"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {showDismissOption && showOnce && (
              <div className="mt-2 pt-2 border-t border-gray-700 dark:border-gray-400">
                <button
                  onClick={handleDismiss}
                  className="text-xs text-gray-400 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors font-['Noto_Sans_JP']"
                >
                  次回から表示しない
                </button>
              </div>
            )}
          </div>
          {/* 矢印 */}
          <div
            className={`absolute ${getArrowClasses()} border-4`}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
};

// ヘルプアイコン付きツールチップ（簡易版）
export const HelpTooltip: React.FC<{
  content: string | React.ReactNode;
  className?: string;
}> = ({ content, className = '' }) => {
  return (
    <Tooltip
      id={`help-${Math.random().toString(36).substr(2, 9)}`}
      content={content}
      position="top"
      trigger="hover"
      delay={200}
      className={className}
    >
      <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
    </Tooltip>
  );
};

