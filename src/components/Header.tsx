import React from 'react';
import { Moon, Sun, Home, BookOpen, Save, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onHomeClick: () => void;
  isSidebarCollapsed?: boolean;
  isToolsSidebarCollapsed?: boolean;
  onToggleBothSidebars?: () => void;
  showSidebarControls?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  isDarkMode, 
  onToggleTheme, 
  onHomeClick,
  isSidebarCollapsed = false,
  isToolsSidebarCollapsed = false,
  onToggleBothSidebars,
  showSidebarControls = false,
}) => {
  const { currentProject, saveProject, isLoading, lastSaved } = useProject();

  const handleManualSave = async () => {
    await saveProject();
  };

  // 両方のサイドバーが折りたたまれているかどうか
  const areBothCollapsed = isSidebarCollapsed && isToolsSidebarCollapsed;

  return (
    <>
    <header 
      className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors"
      role="banner"
      aria-label="アプリケーションヘッダー"
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onHomeClick}
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-md"
              aria-label="ホームページに戻る"
            >
              <Home className="h-6 w-6" aria-hidden="true" />
              <span className="hidden sm:inline">ホーム</span>
            </button>
            
            <div className="hidden sm:flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AIと共創するストーリービルダー
              </h1>
              {showSidebarControls && onToggleBothSidebars && (
                <button
                  onClick={onToggleBothSidebars}
                  className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  aria-label={areBothCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
                  title={areBothCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
                >
                  {areBothCollapsed ? (
                    <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>
          
          <nav className="flex items-center space-x-4" role="navigation" aria-label="メインナビゲーション">
            {currentProject && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleManualSave}
                  disabled={isLoading}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-md"
                  aria-label={isLoading ? '保存中です' : 'プロジェクトを手動保存'}
                  aria-describedby="save-status"
                >
                  <Save className={`h-5 w-5 ${isLoading ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span className="hidden sm:inline text-sm">
                    {isLoading ? '保存中...' : lastSaved ? `保存済み ${lastSaved.toLocaleTimeString('ja-JP')}` : '保存'}
                  </span>
                </button>
                <span id="save-status" className="sr-only">
                  {isLoading ? 'プロジェクトを保存中です' : lastSaved ? `最後の保存: ${lastSaved.toLocaleTimeString('ja-JP')}` : 'まだ保存されていません'}
                </span>
              </div>
            )}
            
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" aria-hidden="true" />
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
    </>
  );
};