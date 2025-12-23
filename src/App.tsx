import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToolsSidebar } from './components/ToolsSidebar';
import { HomePage } from './components/HomePage';
import { CharacterStep } from './components/steps/CharacterStep';
import { PlotStep1 } from './components/steps/PlotStep1';
import { PlotStep2 } from './components/steps/PlotStep2';
import { SynopsisStep } from './components/steps/SynopsisStep';
import { ChapterStep } from './components/steps/ChapterStep';
import { DraftStep } from './components/steps/DraftStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { ExportStep } from './components/steps/ExportStep';
import { ProjectProvider, useProject, Step } from './contexts/ProjectContext';
import { AIProvider } from './contexts/AIContext';
import { ToastProvider } from './components/Toast';
import { OfflineNotifier } from './components/OfflineNotifier';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { setSecurityHeaders, SessionManager } from './utils/securityUtils';
import { PerformanceMonitor, registerServiceWorker } from './utils/performanceUtils';
import { useGlobalShortcuts } from './hooks/useKeyboardNavigation';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { Onboarding } from './components/Onboarding';
import { databaseService } from './services/databaseService';

// Step型はProjectContextから再エクスポート（後方互換性のため）
export type { Step };

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // セキュリティヘッダーの設定
        setSecurityHeaders();

        // セッション管理の初期化
        const sessionManager = new SessionManager();
        sessionManager.updateActivity();

        // パフォーマンス監視の開始
        const performanceMonitor = new PerformanceMonitor();

        // サービスワーカーの登録
        if (import.meta.env.PROD) {
          await registerServiceWorker();
        }

        // データ移行（初回のみ）
        const migrationDone = localStorage.getItem('historyMigrationDone');
        if (!migrationDone) {
          try {
            const result = await databaseService.migrateHistoryFromLocalStorage();
            if (result.migrated > 0) {
              console.log(`履歴データ移行完了: ${result.migrated}件`);
              localStorage.setItem('historyMigrationDone', 'true');
            }
          } catch (error) {
            console.error('履歴データ移行エラー:', error);
          }
        }

        // データベーススキーマの確認と再作成（必要に応じて）
        // 注意: これは開発中のみ有効。本番環境では削除するか、より安全な方法を実装
        try {
          // データベースが正しく初期化されているか確認
          await databaseService.getSettings();
        } catch (error) {
          console.error('データベース初期化エラー。ブラウザの開発者ツールでIndexedDBをクリアしてください:', error);
        }

        // 古いデータの自動クリーンアップ
        try {
          await databaseService.cleanupExpiredHistoryEntries();
          await databaseService.cleanupExpiredAILogEntries();
        } catch (error) {
          console.error('データクリーンアップエラー:', error);
        }

        // 定期的なクリーンアップ（1日1回）
        const cleanupInterval = setInterval(async () => {
          try {
            await databaseService.cleanupExpiredHistoryEntries();
            await databaseService.cleanupExpiredAILogEntries();
          } catch (error) {
            console.error('定期データクリーンアップエラー:', error);
          }
        }, 24 * 60 * 60 * 1000); // 24時間

        // クリーンアップ関数
        return () => {
          performanceMonitor.disconnect();
          clearInterval(cleanupInterval);
        };
      } catch (err) {
        console.error('アプリ初期化エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // ローディング状態
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-unohana-50 via-unohana-100 to-unohana-200 dark:from-sumi-900 dark:via-sumi-800 dark:to-sumi-900 flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="アプリケーションを読み込み中"
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-ai-500 mx-auto mb-4"
            aria-hidden="true"
          ></div>
          <p className="text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

// ステップ変更時の自動保存を処理するコンポーネント
const StepChangeAutoSave: React.FC<{ currentStep: Step }> = ({ currentStep }) => {
  const { currentProject, updateProject } = useProject();
  const isInitialMount = useRef(true);
  const previousStepRef = useRef<Step>('home');

  useEffect(() => {
    // 初回マウント時はスキップ
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousStepRef.current = currentStep;
      return;
    }

    // ステップが実際に変更された場合のみ保存
    if (previousStepRef.current !== currentStep && currentProject) {
      const saveStepBeforeNavigation = async () => {
        try {
          // ホームに戻る場合：前のステップ（'home'以外）をcurrentStepとして保存
          if (currentStep === 'home' && previousStepRef.current !== 'home') {
            await updateProject({
              currentStep: previousStepRef.current as Exclude<Step, 'home'>,
            }, true); // 即座に保存
            console.log(`ステップ「${previousStepRef.current}」を記録しました（ホームに戻る前）`);
          }
          // 他のステップに移動する場合：現在のステップをcurrentStepとして保存
          else if (currentStep !== 'home') {
            await updateProject({
              currentStep: currentStep as Exclude<Step, 'home'>,
            }, true); // 即座に保存
            console.log(`ステップ「${currentStep}」を記録しました`);
          }
        } catch (error) {
          console.error('ステップ記録エラー:', error);
          // エラーが発生してもステップ移動は続行
        }
      };
      saveStepBeforeNavigation();
      previousStepRef.current = currentStep;
    }
  }, [currentStep, currentProject, updateProject]);

  return null;
};

const AppContent: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  // サイドバーの折りたたみ状態をlocalStorageから読み込む（デフォルト: true = 折りたたみ）
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? saved === 'true' : true; // デフォルトで折りたたみ
  });
  const [isToolsSidebarCollapsed, setIsToolsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('tools-sidebar-collapsed');
    return saved !== null ? saved === 'true' : true; // デフォルトで折りたたみ
  });
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'full' | 'quick'>('quick');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // テーマの初期化
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // サイドバーの折りたたみ状態をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('tools-sidebar-collapsed', String(isToolsSidebarCollapsed));
  }, [isToolsSidebarCollapsed]);

  // オンボーディングの初期化
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    if (!onboardingCompleted) {
      // 少し遅延させて表示（アプリの読み込み完了後）
      const timer = setTimeout(() => {
        setOnboardingMode('quick'); // 初回はクイックガイド
        setShowOnboarding(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // オンボーディングの表示（再表示用）
  const handleShowOnboarding = (mode: 'full' | 'quick' = 'quick') => {
    setOnboardingMode(mode);
    setShowOnboarding(true);
  };

  const toggleTheme = () => {
    try {
      setIsDarkMode(!isDarkMode);
      if (!isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (err) {
      console.error('テーマ切り替えエラー:', err);
    }
  };

  // モバイルメニューの開閉
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    // モバイルメニューを開くときはサイドバーを展開
    if (isMobileMenuOpen) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };

  // グローバルショートカットの登録
  useGlobalShortcuts(
    [
      {
        keys: 'ctrl+/',
        handler: () => setShowShortcutHelp(true),
        description: 'ショートカット一覧を表示',
      },
      {
        keys: '?',
        handler: () => setShowShortcutHelp(true),
        description: 'ショートカット一覧を表示（別キー）',
        preventDefault: false, // ?キーは通常の入力としても使用されるため
      },
      {
        keys: 'ctrl+b',
        handler: () => {
          if (currentStep !== 'home') {
            setIsSidebarCollapsed(!isSidebarCollapsed);
            setIsToolsSidebarCollapsed(!isToolsSidebarCollapsed);
            setIsMobileMenuOpen(false); // モバイルメニューを閉じる
          }
        },
        description: 'サイドバーの折りたたみ/展開',
        enabled: currentStep !== 'home',
      },
      {
        keys: 'ctrl+h',
        handler: () => setCurrentStep('home'),
        description: 'ホームページに戻る',
      },
      {
        keys: 'esc',
        handler: () => {
          // モーダルが開いている場合は閉じる（各モーダルコンポーネントで処理）
          // ここではショートカットヘルプのみ閉じる
          setShowShortcutHelp(false);
        },
        description: 'モーダルを閉じる',
      },
    ],
    {
      enabled: true,
      ignoreInputs: true,
    }
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'home':
        return <HomePage onNavigateToStep={setCurrentStep} />;
      case 'character':
        return <CharacterStep onNavigateToStep={setCurrentStep} />;
      case 'plot1':
        return <PlotStep1 onNavigateToStep={setCurrentStep} />;
      case 'plot2':
        return <PlotStep2 onNavigateToStep={setCurrentStep} />;
      case 'synopsis':
        return <SynopsisStep onNavigateToStep={setCurrentStep} />;
      case 'chapter':
        return <ChapterStep onNavigateToStep={setCurrentStep} />;
      case 'draft':
        return <DraftStep onNavigateToStep={setCurrentStep} />;
      case 'review':
        return <ReviewStep />;
      case 'export':
        return <ExportStep />;
      default:
        return <HomePage onNavigateToStep={setCurrentStep} />;
    }
  };

  return (
    <ErrorBoundary>
      <AIProvider>
        <ProjectProvider>
        <StepChangeAutoSave currentStep={currentStep} />
        <OfflineNotifier />
        {/* スキップリンク */}
        <a
          href="#main-content"
          className="skip-link"
          aria-label="メインコンテンツにスキップ"
        >
          メインコンテンツにスキップ
        </a>

        <div
          className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-sumi-900' : 'bg-gradient-to-br from-unohana-50 via-unohana-100 to-unohana-200'
            }`}
          role="application"
          aria-label="AI小説創作支援アプリケーション"
        >
          <div className="flex">
            <Sidebar
              currentStep={currentStep}
              onStepChange={(step) => {
                setCurrentStep(step);
                setIsMobileMenuOpen(false); // ステップ変更時にモバイルメニューを閉じる
              }}
              className={currentStep === 'home' ? 'hidden' : ''}
              isCollapsed={currentStep === 'home' ? true : isMobileMenuOpen ? false : isSidebarCollapsed}
              onCollapseChange={(collapsed) => {
                setIsSidebarCollapsed(collapsed);
                if (!collapsed) {
                  setIsMobileMenuOpen(false);
                }
              }}
            />

            <div className={`flex-1 transition-all duration-300 ${currentStep === 'home'
              ? 'ml-0'
              : 'ml-0 md:ml-16 lg:ml-64'
              } ${currentStep === 'home' ? 'mr-0' : 'mr-0 md:mr-16 lg:mr-64'
              }`}>
              <Header
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
                onHomeClick={() => setCurrentStep('home')}
                isSidebarCollapsed={isSidebarCollapsed}
                isToolsSidebarCollapsed={isToolsSidebarCollapsed}
                onToggleBothSidebars={() => {
                  const newState = !(isSidebarCollapsed && isToolsSidebarCollapsed);
                  setIsSidebarCollapsed(newState);
                  setIsToolsSidebarCollapsed(newState);
                }}
                showSidebarControls={currentStep !== 'home'}
                currentStep={currentStep}
                onNavigate={(step, _chapterId) => {
                  setCurrentStep(step);
                  // 章IDが必要な場合は、各ステップコンポーネントで処理
                  // 必要に応じて、ここで章IDを状態として管理することも可能
                }}
                onToggleMobileMenu={toggleMobileMenu}
                onShowOnboarding={handleShowOnboarding}
              />

              <main
                id="main-content"
                className="p-6"
                role="main"
                aria-label="メインコンテンツ"
                tabIndex={-1}
              >
                {renderStep()}
              </main>
            </div>

            <ToolsSidebar
              className={currentStep === 'home' ? 'hidden' : ''}
              isCollapsed={isToolsSidebarCollapsed}
              onCollapseChange={setIsToolsSidebarCollapsed}
              currentStep={currentStep}
            />
          </div>
        </div>

        {/* ショートカットヘルプモーダル */}
        <ShortcutHelpModal
          isOpen={showShortcutHelp}
          onClose={() => setShowShortcutHelp(false)}
        />

        {/* オンボーディング */}
        <Onboarding
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => {
            setShowOnboarding(false);
          }}
          mode={onboardingMode}
        />
        </ProjectProvider>
      </AIProvider>
    </ErrorBoundary>
  );
}

export default App;