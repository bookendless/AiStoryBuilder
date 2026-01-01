import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Home, Save, PanelLeftClose, PanelLeftOpen, Database, Settings, TrendingUp, ChevronRight, Check, HelpCircle, Menu, GraduationCap, MoreVertical, Circle, Wrench } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import { DataManager } from './DataManager';
import { AISettings } from './AISettings';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useGlobalShortcuts } from '../hooks/useKeyboardNavigation';
import { ContextHelp } from './ContextHelp';
import { Step } from '../App';
import { SearchBar } from './SearchBar';
import { useBreakpoint } from '../hooks/useMediaQuery';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onHomeClick: () => void;
  isSidebarCollapsed?: boolean;
  isToolsSidebarCollapsed?: boolean;
  onToggleBothSidebars?: () => void;
  showSidebarControls?: boolean;
  currentStep?: Step;
  onNavigate?: (step: Step, chapterId?: string) => void;
  onToggleMobileMenu?: () => void;
  onToggleMobileToolsMenu?: () => void;
  onShowOnboarding?: (mode?: 'full' | 'quick') => void;
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
  onNavigate,
  onToggleMobileMenu,
  onToggleMobileToolsMenu,
  onShowOnboarding,
}) => {
  const breakpoint = useBreakpoint();
  const { currentProject, saveProject, isLoading, lastSaved, calculateProjectProgress } = useProject();
  const { isConfigured } = useAI();
  const { showError, showSuccess } = useToast();
  const [showDataManager, setShowDataManager] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  return (
    <>
      <header
        className="sticky top-0 z-20 glass border-b transition-colors"
        role="banner"
        aria-label="アプリケーションヘッダー"
      >
        <div className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* モバイル/タブレットメニューボタン */}
              {breakpoint !== 'desktop' && showSidebarControls && onToggleMobileMenu && (
                <button
                  onClick={onToggleMobileMenu}
                  className="p-2 rounded-lg text-sumi-700 dark:text-usuzumi-300 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2 lg:hidden"
                  aria-label="メニューを開く"
                >
                  <Menu className="h-6 w-6" aria-hidden="true" />
                </button>
              )}

              <button
                onClick={onHomeClick}
                className="flex items-center space-x-2 text-sumi-700 dark:text-usuzumi-300 hover:text-ai-600 dark:hover:text-ai-400 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2 rounded-md"
                aria-label="ホームページに戻る"
              >
                <Home className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                <span className="hidden lg:inline">ホーム</span>
              </button>

              {/* ツールメニューボタンは右端に移動 */}

              <div className="hidden lg:flex items-center space-x-4 flex-1">
                <SearchBar onNavigate={onNavigate} />

                {/* 進捗バー */}
                {currentProject && projectProgress && (
                  <div className="flex-1 max-w-md ml-4">
                    <div
                      className="relative cursor-pointer group"
                      onClick={() => setShowProgressDetails(!showProgressDetails)}
                      onMouseEnter={() => {
                        // Landscapeモードで高さが足りない場合はツールチップを表示しない
                        if (window.innerHeight > 500) {
                          setShowProgressDetails(true);
                        }
                      }}
                      onMouseLeave={() => setShowProgressDetails(false)}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-semantic-primary" />
                        <span className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                          {projectProgress.completedSteps}/{projectProgress.totalSteps} ステップ完了
                        </span>
                        <span className="text-caption font-semibold text-semantic-primary">
                          {projectProgress.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-usuzumi-200 dark:bg-usuzumi-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${projectProgress.percentage === 100
                            ? 'bg-semantic-success'
                            : projectProgress.percentage >= 50
                              ? 'bg-semantic-primary'
                              : 'bg-semantic-warning'
                            }`}
                          style={{ width: `${projectProgress.percentage}%` }}
                        />
                      </div>

                      {/* 進捗詳細ツールチップ */}
                      {showProgressDetails && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-unohana-50 dark:bg-sumi-800 rounded-lg shadow-xl border border-usuzumi-200 dark:border-usuzumi-700 p-4 z-50">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-usuzumi-200 dark:border-usuzumi-700">
                              <span className="font-semibold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                                プロジェクト進捗
                              </span>
                              <span className="text-sm font-bold text-ai-600 dark:text-ai-400">
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
                                      <Check className="h-4 w-4 text-semantic-success" />
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border-2 border-usuzumi-300 dark:border-usuzumi-600" />
                                    )}
                                    <span className={`font-['Noto_Sans_JP'] ${stepProgress.completed
                                      ? 'text-sumi-700 dark:text-usuzumi-300'
                                      : 'text-usuzumi-400 dark:text-usuzumi-500'
                                      }`}>
                                      {stepLabels[stepProgress.step] || stepProgress.step}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {projectProgress.nextStep && (
                              <div className="mt-3 pt-3 border-t border-usuzumi-200 dark:border-usuzumi-700">
                                <div className="flex items-center space-x-2 text-sm text-ai-600 dark:text-ai-400">
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
                    className="p-2 rounded-lg text-sumi-700 dark:text-usuzumi-300 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
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

            <nav className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 ml-4 md:ml-8 lg:ml-12" role="navigation" aria-label="メインナビゲーション">
              {currentProject && (
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={handleManualSave}
                    disabled={isLoading}
                    className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-wakagusa-100 dark:bg-wakagusa-900/30 hover:bg-wakagusa-200 dark:hover:bg-wakagusa-900/50 text-wakagusa-700 dark:text-wakagusa-400 transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-wakagusa-500 focus:ring-offset-2"
                    aria-label={isLoading ? '保存中です' : 'プロジェクトを手動保存'}
                    aria-describedby="save-status"
                  >
                    <Save className={`h-4 w-4 sm:h-5 sm:w-5 text-wakagusa-600 dark:text-wakagusa-400 ${isLoading ? 'animate-pulse' : ''}`} aria-hidden="true" />
                    <span className="hidden lg:inline text-sm font-['Noto_Sans_JP']">
                      {isLoading ? '保存中...' : lastSaved ? `保存済み ${lastSaved.toLocaleTimeString('ja-JP')}` : '保存'}
                    </span>
                  </button>
                  <span id="save-status" className="sr-only">
                    {isLoading ? 'プロジェクトを保存中です' : lastSaved ? `最後の保存: ${lastSaved.toLocaleTimeString('ja-JP')}` : 'まだ保存されていません'}
                  </span>
                </div>
              )}

              {/* データ管理（ホーム画面の時だけ常時表示） */}
              {currentStep === 'home' && (
                <button
                  onClick={() => setShowDataManager(true)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-mizu-100 dark:bg-mizu-900/30 hover:bg-mizu-200 dark:hover:bg-mizu-900/50 text-mizu-700 dark:text-mizu-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mizu-500 focus:ring-offset-2"
                  aria-label="データ管理を開く"
                  title="データ管理"
                >
                  <div className="relative">
                    <Database className="h-4 w-4 sm:h-5 sm:w-5 text-mizu-600 dark:text-mizu-400" aria-hidden="true" />
                  </div>
                  <span className="hidden lg:inline text-sm font-['Noto_Sans_JP']">
                    データ管理
                  </span>
                </button>
              )}

              {/* ヘルプ（デスクトップのみ表示、モバイルは三点リーダー内） */}
              <button
                onClick={() => setShowContextHelp(true)}
                className="hidden lg:flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-ai-100 dark:bg-ai-900/30 hover:bg-ai-200 dark:hover:bg-ai-900/50 text-ai-700 dark:text-ai-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
                aria-label="ヘルプを表示"
                title="ヘルプ"
              >
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-ai-600 dark:text-ai-400" aria-hidden="true" />
                <span className="hidden lg:inline text-sm font-['Noto_Sans_JP']">
                  ヘルプ
                </span>
              </button>

              {/* AI設定（ホーム画面の時だけ常時表示） */}
              {currentStep === 'home' && (
                <button
                  onClick={() => setShowAISettings(true)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-ai-100 dark:bg-ai-900/30 hover:bg-ai-200 dark:hover:bg-ai-900/50 text-ai-700 dark:text-ai-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
                  aria-label="AI設定を開く"
                  title="AI設定"
                >
                  <div className="relative">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-ai-600 dark:text-ai-400" aria-hidden="true" />
                    {!isConfigured && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 bg-sakura-500 rounded-full"
                        aria-label="設定が必要"
                      />
                    )}
                  </div>
                  <span className="hidden lg:inline text-sm font-['Noto_Sans_JP']">
                    AI設定
                  </span>
                </button>
              )}

              {/* 三点リーダーメニュー */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 rounded-lg bg-usuzumi-100 dark:bg-usuzumi-800 hover:bg-usuzumi-200 dark:hover:bg-usuzumi-700 text-sumi-700 dark:text-usuzumi-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
                  aria-label="その他のメニュー"
                  aria-expanded={showMoreMenu}
                  aria-haspopup="true"
                >
                  <MoreVertical className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* ドロップダウンメニュー */}
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-unohana-50 dark:bg-sumi-800 rounded-lg shadow-xl border border-usuzumi-200 dark:border-usuzumi-700 py-2 z-50">
                    {/* AI設定（ホーム画面以外の時だけ表示） */}
                    {currentStep !== 'home' && (
                      <button
                        onClick={() => {
                          setShowAISettings(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-inset"
                        aria-label="AI設定を開く"
                      >
                        <div className="relative">
                          <Settings className="h-5 w-5 text-ai-600 dark:text-ai-400" aria-hidden="true" />
                          {!isConfigured && (
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 bg-sakura-500 rounded-full"
                              aria-label="設定が必要"
                            />
                          )}
                        </div>
                        <span className="text-sm font-['Noto_Sans_JP'] text-sumi-700 dark:text-usuzumi-300">
                          AI設定
                        </span>
                      </button>
                    )}

                    {/* データ管理（ホーム画面以外の時だけ表示） */}
                    {currentStep !== 'home' && (
                      <button
                        onClick={() => {
                          setShowDataManager(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-mizu-500 focus:ring-inset"
                        aria-label="データ管理を開く"
                      >
                        <Database className="h-5 w-5 text-mizu-600 dark:text-mizu-400" aria-hidden="true" />
                        <span className="text-sm font-['Noto_Sans_JP'] text-sumi-700 dark:text-usuzumi-300">
                          データ管理
                        </span>
                      </button>
                    )}

                    {/* ガイド */}
                    {onShowOnboarding && (
                      <button
                        onClick={() => {
                          onShowOnboarding('quick');
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                        aria-label="ガイドを表示"
                      >
                        <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                        <span className="text-sm font-['Noto_Sans_JP'] text-sumi-700 dark:text-usuzumi-300">
                          ガイド
                        </span>
                      </button>
                    )}

                    {/* ヘルプ（モバイル/タブレット用） */}
                    {breakpoint !== 'desktop' && (
                      <button
                        onClick={() => {
                          setShowContextHelp(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-inset"
                        aria-label="ヘルプを表示"
                      >
                        <HelpCircle className="h-5 w-5 text-ai-600 dark:text-ai-400" aria-hidden="true" />
                        <span className="text-sm font-['Noto_Sans_JP'] text-sumi-700 dark:text-usuzumi-300">
                          ヘルプ
                        </span>
                      </button>
                    )}

                    {/* ダークモード切替（モバイル/タブレット用） */}
                    {breakpoint !== 'desktop' && (
                      <button
                        onClick={() => {
                          onToggleTheme();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-yamabuki-500 focus:ring-inset"
                        aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                      >
                        {isDarkMode ? (
                          <Sun className="h-5 w-5 text-yamabuki-600 dark:text-yamabuki-400" aria-hidden="true" />
                        ) : (
                          <Moon className="h-5 w-5 text-yamabuki-600 dark:text-yamabuki-400" aria-hidden="true" />
                        )}
                        <span className="text-sm font-['Noto_Sans_JP'] text-sumi-700 dark:text-usuzumi-300">
                          {isDarkMode ? 'ライトモード' : 'ダークモード'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ダークモードボタン（デスクトップのみ表示、モバイルは三点リーダー内） */}
              <button
                onClick={onToggleTheme}
                className="hidden lg:block p-2 rounded-lg bg-yamabuki-100 dark:bg-yamabuki-900/30 hover:bg-yamabuki-200 dark:hover:bg-yamabuki-900/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yamabuki-500 focus:ring-offset-2"
                aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-yamabuki-600 dark:text-yamabuki-400" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-yamabuki-600 dark:text-yamabuki-400" aria-hidden="true" />
                )}
              </button>

              {/* モバイル/タブレット用ツールメニューボタン（右端） */}
              {showSidebarControls && onToggleMobileToolsMenu && (
                <button
                  onClick={onToggleMobileToolsMenu}
                  className="p-2 rounded-lg text-sumi-700 dark:text-usuzumi-300 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2 lg:hidden"
                  aria-label="ツールを開く"
                >
                  <Wrench className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </button>
              )}

              {/* スペーサー（ツールサイドバーとの間隔を確保） */}
              <div className="hidden lg:block p-2 opacity-0 pointer-events-none" aria-hidden="true">
                <Circle className="h-1 w-1 sm:h-1.5 sm:w-1.5" />
              </div>
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