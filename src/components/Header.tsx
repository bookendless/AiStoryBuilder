import React, { useState } from 'react';
import { Moon, Sun, Home, BookOpen, Save, PanelLeftClose, PanelLeftOpen, Database, Settings } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import { DataManager } from './DataManager';
import { AISettings } from './AISettings';

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
  const { isConfigured } = useAI();
  const [showDataManager, setShowDataManager] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

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
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label={isLoading ? '保存中です' : 'プロジェクトを手動保存'}
                  aria-describedby="save-status"
                >
                  <Save className={`h-5 w-5 text-green-600 dark:text-green-400 ${isLoading ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span className="hidden sm:inline text-sm font-['Noto_Sans_JP']">
                    {isLoading ? '保存中...' : lastSaved ? `保存済み ${lastSaved.toLocaleTimeString('ja-JP')}` : '保存'}
                  </span>
                </button>
                <span id="save-status" className="sr-only">
                  {isLoading ? 'プロジェクトを保存中です' : lastSaved ? `最後の保存: ${lastSaved.toLocaleTimeString('ja-JP')}` : 'まだ保存されていません'}
                </span>
              </div>
            )}
            
            <button
              onClick={() => setShowDataManager(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label="データ管理を開く"
              title="データ管理"
            >
              <div className="relative">
                <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              </div>
              <span className="hidden sm:inline text-sm font-['Noto_Sans_JP']">
                データ管理
              </span>
            </button>
            
            <button
              onClick={() => setShowAISettings(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative"
              aria-label="AI設定を開く"
              title="AI設定"
            >
              <div className="relative">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                {!isConfigured && (
                  <span 
                    className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
                    aria-label="設定が必要"
                  />
                )}
              </div>
              <span className="hidden sm:inline text-sm font-['Noto_Sans_JP']">
                AI設定
              </span>
            </button>
            
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
    
    {/* モーダル */}
    <DataManager 
      isOpen={showDataManager} 
      onClose={() => setShowDataManager(false)} 
    />
    
    <AISettings 
      isOpen={showAISettings} 
      onClose={() => setShowAISettings(false)} 
    />
    </>
  );
};