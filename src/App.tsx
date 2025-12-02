import { useState, useEffect } from 'react';
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
import { ProjectProvider } from './contexts/ProjectContext';
import { AIProvider } from './contexts/AIContext';
import { ToastProvider } from './components/Toast';
import { OfflineNotifier } from './components/OfflineNotifier';
import { setSecurityHeaders, SessionManager } from './utils/securityUtils';
import { PerformanceMonitor, registerServiceWorker } from './utils/performanceUtils';
import { useGlobalShortcuts } from './hooks/useKeyboardNavigation';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { Onboarding } from './components/Onboarding';
import { databaseService } from './services/databaseService';

export type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'review' | 'export';

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

const AppContent: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsSidebarCollapsed, setIsToolsSidebarCollapsed] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // テーマの初期化
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // オンボーディングの初期化
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    if (!onboardingCompleted) {
      // 少し遅延させて表示（アプリの読み込み完了後）
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

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
        return <CharacterStep />;
      case 'plot1':
        return <PlotStep1 onNavigateToStep={setCurrentStep} />;
      case 'plot2':
        return <PlotStep2 onNavigateToStep={setCurrentStep} />;
      case 'synopsis':
        return <SynopsisStep />;
      case 'chapter':
        return <ChapterStep />;
      case 'draft':
        return <DraftStep />;
      case 'review':
        return <ReviewStep />;
      case 'export':
        return <ExportStep />;
      default:
        return <HomePage onNavigateToStep={setCurrentStep} />;
    }
  };

  return (
    <AIProvider>
      <ProjectProvider>
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
              onStepChange={setCurrentStep}
              className={currentStep === 'home' ? 'hidden' : ''}
              isCollapsed={isSidebarCollapsed}
              onCollapseChange={setIsSidebarCollapsed}
            />

            <div className={`flex-1 transition-all duration-300 ${currentStep === 'home'
                ? 'ml-0'
                : isSidebarCollapsed
                  ? 'ml-16'
                  : 'ml-64'
              } ${currentStep === 'home' ? 'mr-0' : isToolsSidebarCollapsed ? 'mr-16' : 'mr-64'}`}>
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
        />
      </ProjectProvider>
    </AIProvider>
  );
}

export default App;