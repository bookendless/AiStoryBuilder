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
import { ExportStep } from './components/steps/ExportStep';
import { ProjectProvider } from './contexts/ProjectContext';
import { AIProvider } from './contexts/AIContext';
import { setSecurityHeaders, SessionManager } from './utils/securityUtils';
import { PerformanceMonitor, registerServiceWorker, onOnlineStatusChange } from './utils/performanceUtils';

export type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsSidebarCollapsed, setIsToolsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // セキュリティヘッダーの設定
        setSecurityHeaders();
        
        // セッション管理の初期化
        const sessionManager = new SessionManager();
        sessionManager.updateActivity();
        
        // レート制限の初期化（将来の使用のためにコメントアウト）
        // const rateLimiter = new RateLimiter(100, 60000); // 1分間に100リクエスト
        
        // パフォーマンス監視の開始
        const performanceMonitor = new PerformanceMonitor();
        
        // サービスワーカーの登録
        if (import.meta.env.PROD) {
          await registerServiceWorker();
        }
        
        // オフライン状態の監視
        const unsubscribeOnlineStatus = onOnlineStatusChange((isOnline) => {
          if (!isOnline) {
            console.warn('オフライン状態です。一部の機能が制限される可能性があります。');
          }
        });
        
        // テーマの初期化
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
          setIsDarkMode(true);
          document.documentElement.classList.add('dark');
        }
        
        // クリーンアップ関数
        return () => {
          performanceMonitor.disconnect();
          unsubscribeOnlineStatus();
        };
      } catch (err) {
        console.error('アプリ初期化エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeApp();
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
      case 'export':
        return <ExportStep />;
      default:
        return <HomePage onNavigateToStep={setCurrentStep} />;
    }
  };

  // ローディング状態
  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="アプリケーションを読み込み中"
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
            aria-hidden="true"
          ></div>
          <p className="text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error) {
    return (
      <div 
        className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-4">
            <p className="text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP'] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="ページを再読み込みしてエラーを解決"
          >
            ページを再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <AIProvider>
      <ProjectProvider>
        {/* スキップリンク */}
        <a 
          href="#main-content" 
          className="skip-link"
          aria-label="メインコンテンツにスキップ"
        >
          メインコンテンツにスキップ
        </a>
        
        <div 
          className={`min-h-screen transition-colors duration-300 ${
            isDarkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
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
            
            <div className={`flex-1 transition-all duration-300 ${
              currentStep === 'home' 
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
      </ProjectProvider>
    </AIProvider>
  );
}

export default App;