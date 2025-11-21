import React from 'react';
import { X, Keyboard, Save, Home, Sidebar, FilePlus, Command } from 'lucide-react';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
    icon?: React.ReactNode;
  }>;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  // プラットフォームに応じた修飾キー表示
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘' : 'Ctrl';

  const categories: ShortcutCategory[] = [
    {
      title: '基本操作',
      shortcuts: [
        {
          keys: [modifierKey, 'S'],
          description: 'プロジェクトを手動保存',
          icon: <Save className="h-4 w-4" />,
        },
        {
          keys: [modifierKey, 'N'],
          description: '新しいプロジェクトを作成',
          icon: <FilePlus className="h-4 w-4" />,
        },
        {
          keys: ['Esc'],
          description: 'モーダルやサイドバーを閉じる',
          icon: <X className="h-4 w-4" />,
        },
      ],
    },
    {
      title: 'ナビゲーション',
      shortcuts: [
        {
          keys: [modifierKey, 'B'],
          description: 'サイドバーの折りたたみ/展開',
          icon: <Sidebar className="h-4 w-4" />,
        },
        {
          keys: [modifierKey, 'H'],
          description: 'ホームページに戻る',
          icon: <Home className="h-4 w-4" />,
        },
      ],
    },
    {
      title: 'ヘルプ',
      shortcuts: [
        {
          keys: [modifierKey, '/'],
          description: 'ショートカット一覧を表示',
          icon: <Keyboard className="h-4 w-4" />,
        },
        {
          keys: ['?'],
          description: 'ショートカット一覧を表示（別キー）',
          icon: <Keyboard className="h-4 w-4" />,
        },
      ],
    },
  ];

  const renderKey = (key: string) => {
    if (key === modifierKey) {
      return (
        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
          {isMac ? '⌘' : 'Ctrl'}
        </kbd>
      );
    }
    if (key === 'Esc') {
      return (
        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
          Esc
        </kbd>
      );
    }
    return (
      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
        {key}
      </kbd>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                <Keyboard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2
                  id="shortcut-help-title"
                  className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']"
                >
                  キーボードショートカット
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  作業効率を向上させるショートカット一覧
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-md p-1"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          <div className="space-y-6">
            {categories.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                  {category.title}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, shortcutIndex) => (
                    <div
                      key={shortcutIndex}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {shortcut.icon && (
                          <div className="text-gray-600 dark:text-gray-400">
                            {shortcut.icon}
                          </div>
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                          {shortcut.description}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {renderKey(key)}
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 dark:text-gray-500 mx-1">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <Command className="h-4 w-4" />
              <span className="font-['Noto_Sans_JP']">
                {isMac ? 'Mac' : 'Windows/Linux'} のショートカットが表示されています
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

