import React from 'react';
import { X, Keyboard, Save, Home, Sidebar, FilePlus, Command } from 'lucide-react';
import { Modal } from './common/Modal';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
            <Keyboard className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="block text-xl font-bold">キーボードショートカット</span>
            <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
              作業効率を向上させるショートカット一覧
            </span>
          </div>
        </div>
      }
      size="lg"
    >
      {/* コンテンツ */}
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
    </Modal>
  );
};
