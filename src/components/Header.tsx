import React, { useState } from 'react';
import { Moon, Sun, Home, BookOpen, Save, PanelLeftClose, PanelLeftOpen, Database, Settings, TrendingUp, ChevronRight, Check, HelpCircle } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import { DataManager } from './DataManager';
import { AISettings } from './AISettings';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useGlobalShortcuts } from '../hooks/useKeyboardNavigation';
import { ContextHelp } from './ContextHelp';
import { Step } from '../App';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onHomeClick: () => void;
  isSidebarCollapsed?: boolean;
  isToolsSidebarCollapsed?: boolean;
  onToggleBothSidebars?: () => void;
  showSidebarControls?: boolean;
  currentStep?: Step;
}

export const Header: React.FC<HeaderProps> = ({ 
  isDarkMode, 
  onToggleTheme, 
  onHomeClick,
  isSidebarCollapsed = false,
  isToolsSidebarCollapsed = false,
  onToggleBothSidebars,
  showSidebarControls = false,
  currentStep = 'home',
}) => {
  const { currentProject, saveProject, isLoading, lastSaved, calculateProjectProgress } = useProject();
  const { isConfigured } = useAI();
  const { showError, showSuccess } = useToast();
  const [showDataManager, setShowDataManager] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);

  const projectProgress = currentProject ? calculateProjectProgress(currentProject) : null;

  const handleManualSave = async () => {
    try {
      await saveProject();
      showSuccess('プロジェクトを保存しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    }
  };

  // Ctrl+S ショートカット
  useGlobalShortcuts(
    [
      {
        keys: 'ctrl+s',
        handler: () => {
          if (currentProject && !isLoading) {
            handleManualSave();
          }
        },
        description: 'プロジェクトを手動保存',
        enabled: !!currentProject && !isLoading,
      },
    ],
    {
      enabled: true,
      ignoreInputs: false, // Ctrl+Sは入力フィールド内でも有効
    }
  );

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
            
            <div className="hidden sm:flex items-center space-x-4 flex-1">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  AIと共創するストーリービルダー
                </h1>
              </div>
              
              {/* 進捗バー */}
              {currentProject && projectProgress && (
                <div className="flex-1 max-w-md ml-4">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => setShowProgressDetails(!showProgressDetails)}
                    onMouseEnter={() => setShowProgressDetails(true)}
                    onMouseLeave={() => setShowProgressDetails(false)}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {projectProgress.completedSteps}/{projectProgress.totalSteps} ステップ完了
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {projectProgress.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          projectProgress.percentage === 100 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : projectProgress.percentage >= 50
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        }`}
                        style={{ width: `${projectProgress.percentage}%` }}
                      />
                    </div>
                    
                    {/* 進捗詳細ツールチップ */}
                    {showProgressDetails && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                              プロジェクト進捗
                            </span>
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              {projectProgress.percentage.toFixed(0)}%
                            </span>
                          </div>
                          {projectProgress.steps.map((stepProgress) => {
                            const stepLabels: Record<string, string> = {
                              character: 'キャラクター',
                              plot1: 'プロット基本設定',
                              plot2: 'プロット構成詳細',
                              synopsis: 'あらすじ',
                              chapter: '章立て',
                              draft: '草案',
                            };
                            return (
                              <div key={stepProgress.step} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                  {stepProgress.completed ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                                  )}
                                  <span className={`font-['Noto_Sans_JP'] ${
                                    stepProgress.completed 
                                      ? 'text-gray-700 dark:text-gray-300' 
                                      : 'text-gray-400 dark:text-gray-500'
                                  }`}>
                                    {stepLabels[stepProgress.step] || stepProgress.step}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {projectProgress.nextStep && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center space-x-2 text-sm text-indigo-600 dark:text-indigo-400">
                                <ChevronRight className="h-4 w-4" />
                                <span className="font-['Noto_Sans_JP']">
                                  次: {projectProgress.nextStep}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
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
            
            {/* コンテキストヘルプボタン */}
            {currentStep !== 'home' && (
              <button
                onClick={() => setShowContextHelp(true)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="ヘルプを表示"
                title="ヘルプ"
              >
                <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <span className="hidden sm:inline text-sm font-['Noto_Sans_JP']">
                  ヘルプ
                </span>
              </button>
            )}
            
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
    
    {/* コンテキストヘルプ */}
    <ContextHelp
      step={currentStep}
      isOpen={showContextHelp}
      onClose={() => setShowContextHelp(false)}
    />
    </>
  );
};