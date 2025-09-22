/**
 * キーボードナビゲーション用のカスタムフック
 * Phase 1: キーボードナビゲーション機能の実装
 */

import { useEffect, useCallback, useRef, useState } from 'react';

export interface KeyboardNavigationOptions {
  enabled?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: (direction: 'forward' | 'backward') => void;
  onHome?: () => void;
  onEnd?: () => void;
  onSpace?: () => void;
  onDelete?: () => void;
  onBackspace?: () => void;
}

/**
 * 基本的なキーボードナビゲーション
 */
export const useKeyboardNavigation = (options: KeyboardNavigationOptions = {}) => {
  const {
    enabled = true,
    onEnter,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onTab,
    onHome,
    onEnd,
    onSpace,
    onDelete,
    onBackspace
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 修飾キーが押されている場合は無視
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onEnter?.();
        break;
      case 'Escape':
        event.preventDefault();
        onEscape?.();
        break;
      case 'ArrowUp':
        event.preventDefault();
        onArrowUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        onArrowDown?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        onArrowLeft?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onArrowRight?.();
        break;
      case 'Tab':
        if (onTab) {
          event.preventDefault();
          onTab(event.shiftKey ? 'backward' : 'forward');
        }
        break;
      case 'Home':
        event.preventDefault();
        onHome?.();
        break;
      case 'End':
        event.preventDefault();
        onEnd?.();
        break;
      case ' ':
        event.preventDefault();
        onSpace?.();
        break;
      case 'Delete':
        event.preventDefault();
        onDelete?.();
        break;
      case 'Backspace':
        event.preventDefault();
        onBackspace?.();
        break;
    }
  }, [enabled, onEnter, onEscape, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab, onHome, onEnd, onSpace, onDelete, onBackspace]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
};

/**
 * リスト項目のキーボードナビゲーション
 */
export const useListNavigation = <T>(
  items: T[],
  options: {
    enabled?: boolean;
    onSelect?: (item: T, index: number) => void;
    onActivate?: (item: T, index: number) => void;
    initialIndex?: number;
    loop?: boolean;
  } = {}
) => {
  const {
    enabled = true,
    onSelect,
    onActivate,
    initialIndex = 0,
    loop = true
  } = options;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const navigate = useCallback((direction: 'up' | 'down') => {
    setCurrentIndex(prev => {
      let newIndex = direction === 'up' ? prev - 1 : prev + 1;
      
      if (loop) {
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
      } else {
        newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
      }
      
      return newIndex;
    });
  }, [items.length, loop]);

  const selectCurrent = useCallback(() => {
    if (items[currentIndex]) {
      onSelect?.(items[currentIndex], currentIndex);
    }
  }, [items, currentIndex, onSelect]);

  const activateCurrent = useCallback(() => {
    if (items[currentIndex]) {
      onActivate?.(items[currentIndex], currentIndex);
    }
  }, [items, currentIndex, onActivate]);

  const goToFirst = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentIndex(items.length - 1);
  }, [items.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index);
    }
  }, [items.length]);

  // フォーカス管理
  useEffect(() => {
    const currentElement = itemRefs.current[currentIndex];
    if (currentElement) {
      currentElement.focus();
    }
  }, [currentIndex]);

  useKeyboardNavigation({
    enabled,
    onArrowUp: () => navigate('up'),
    onArrowDown: () => navigate('down'),
    onEnter: activateCurrent,
    onSpace: selectCurrent,
    onHome: goToFirst,
    onEnd: goToLast
  });

  return {
    currentIndex,
    setCurrentIndex: goToIndex,
    itemRefs,
    navigate,
    selectCurrent,
    activateCurrent,
    goToFirst,
    goToLast
  };
};

/**
 * モーダルのキーボードナビゲーション
 */
export const useModalNavigation = (options: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}) => {
  const { isOpen, onClose, onConfirm } = options;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // フォーカストラップ
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!isOpen || !modalRef.current) return;

    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, [isOpen, onClose]);

  // モーダルが開いた時の処理
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', trapFocus);
      document.body.style.overflow = 'hidden';
      
      // モーダル内の最初の要素にフォーカス
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        firstFocusable?.focus();
      }, 100);
    } else {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = 'unset';
      
      // 前の要素にフォーカスを戻す
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, trapFocus]);

  useKeyboardNavigation({
    enabled: isOpen,
    onEscape: onClose,
    onEnter: onConfirm,
    onSpace: onConfirm
  });

  return { modalRef };
};

/**
 * グローバルキーボードショートカット
 */
export const useGlobalShortcuts = (shortcuts: Record<string, () => void>) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    
    if (modifier) {
      const shortcut = `ctrl+${key}`;
      if (shortcuts[shortcut]) {
        event.preventDefault();
        shortcuts[shortcut]();
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * フォーカス管理
 */
export const useFocusManagement = () => {
  const focusableElements = useRef<HTMLElement[]>([]);

  const registerFocusableElement = useCallback((element: HTMLElement | null) => {
    if (element && !focusableElements.current.includes(element)) {
      focusableElements.current.push(element);
    }
  }, []);

  const unregisterFocusableElement = useCallback((element: HTMLElement | null) => {
    if (element) {
      focusableElements.current = focusableElements.current.filter(el => el !== element);
    }
  }, []);

  const focusNext = useCallback(() => {
    const currentIndex = focusableElements.current.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElements.current.length;
    focusableElements.current[nextIndex]?.focus();
  }, []);

  const focusPrevious = useCallback(() => {
    const currentIndex = focusableElements.current.indexOf(document.activeElement as HTMLElement);
    const prevIndex = currentIndex <= 0 ? focusableElements.current.length - 1 : currentIndex - 1;
    focusableElements.current[prevIndex]?.focus();
  }, []);

  const focusFirst = useCallback(() => {
    focusableElements.current[0]?.focus();
  }, []);

  const focusLast = useCallback(() => {
    focusableElements.current[focusableElements.current.length - 1]?.focus();
  }, []);

  return {
    registerFocusableElement,
    unregisterFocusableElement,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    focusableElements: focusableElements.current
  };
};
