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

    // 入力フィールド内では通常の文字編集操作を優先
    const target = event.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName;
      const isInputElement =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox';

      if (isInputElement) {
        // ここでは一切ショートカット処理を行わず、ブラウザ標準の挙動に任せる
        // （Backspace/Delete/Space/Enter などの編集キーをブロックしない）
        return;
      }
    }

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
  const hasInitialFocused = useRef(false);
  
  // onClose/onConfirmをrefで保持して、依存関係から除外
  const onCloseRef = useRef(onClose);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onCloseRef.current = onClose;
    onConfirmRef.current = onConfirm;
  }, [onClose, onConfirm]);

  // フォーカストラップ
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current) return;

    if (e.key === 'Escape') {
      onCloseRef.current();
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
  }, []);

  // モーダルが開いた時の処理
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', trapFocus);
      document.body.style.overflow = 'hidden';
      
      // モーダル内の最初の要素にフォーカス（初回のみ）
      if (!hasInitialFocused.current) {
        hasInitialFocused.current = true;
        setTimeout(() => {
          const firstFocusable = modalRef.current?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }, 100);
      }
    } else {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = 'unset';
      hasInitialFocused.current = false;
      
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

  // onEnter/onSpaceは入力フィールドでは無視されるので安全
  // ただし、useKeyboardNavigationは既に入力フィールドをチェックしている
  useKeyboardNavigation({
    enabled: isOpen,
    onEscape: () => onCloseRef.current(),
    onEnter: onConfirmRef.current ? () => onConfirmRef.current?.() : undefined,
    onSpace: onConfirmRef.current ? () => onConfirmRef.current?.() : undefined
  });

  return { modalRef };
};

/**
 * ショートカットキーの組み合わせを正規化
 */
export const normalizeShortcut = (event: KeyboardEvent): string => {
  const parts: string[] = [];
  
  if (event.ctrlKey || event.metaKey) {
    parts.push('ctrl');
  }
  if (event.shiftKey) {
    parts.push('shift');
  }
  if (event.altKey) {
    parts.push('alt');
  }
  
  // キー名を正規化
  let key = event.key.toLowerCase();
  if (key === ' ') {
    key = 'space';
  } else if (key === 'escape') {
    key = 'esc';
  } else if (key === 'control') {
    return ''; // 修飾キーのみは無視
  } else if (key === 'meta') {
    return ''; // 修飾キーのみは無視
  }
  
  parts.push(key);
  return parts.join('+');
};

/**
 * ショートカット定義の型
 */
export interface ShortcutDefinition {
  keys: string; // 例: "ctrl+s", "ctrl+shift+n", "esc"
  handler: () => void;
  description?: string;
  enabled?: boolean; // 動的に有効/無効を切り替え可能
  preventDefault?: boolean; // デフォルトの動作を防ぐかどうか（デフォルト: true）
  stopPropagation?: boolean; // イベントの伝播を止めるかどうか（デフォルト: false）
}

/**
 * グローバルキーボードショートカット（拡張版）
 */
export const useGlobalShortcuts = (
  shortcuts: ShortcutDefinition[] | Record<string, () => void>,
  options: {
    enabled?: boolean;
    ignoreInputs?: boolean; // 入力フィールド内では無効化（デフォルト: true）
  } = {}
) => {
  const { enabled = true, ignoreInputs = true } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 入力フィールド内では無効化（オプション）
    if (ignoreInputs) {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable ||
                     target.getAttribute('role') === 'textbox';
      
      // Escキーは常に有効
      if (isInput && event.key !== 'Escape') {
        // Ctrl+S, Ctrl+N, Ctrl+/ などの特定のショートカットは入力フィールド内でも有効
        const normalized = normalizeShortcut(event);
        const allowedInInput = ['ctrl+s', 'ctrl+n', 'ctrl+/', 'ctrl+shift+/', 'ctrl+b', 'ctrl+h', 'esc', '?'];
        if (!allowedInInput.includes(normalized)) {
          return;
        }
      }
    }

    const normalized = normalizeShortcut(event);
    if (!normalized) return;

    // 配列形式のショートカット定義
    if (Array.isArray(shortcuts)) {
      for (const shortcut of shortcuts) {
        if (shortcut.keys === normalized && (shortcut.enabled !== false)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          shortcut.handler();
          return;
        }
      }
    } else {
      // レガシー形式（Record<string, () => void>）のサポート
      if (shortcuts[normalized]) {
        event.preventDefault();
        shortcuts[normalized]();
      }
    }
  }, [shortcuts, enabled, ignoreInputs]);

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
