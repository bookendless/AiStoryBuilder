import React from 'react';
import { Moon, Sun, Home, BookOpen, Image, Settings, Save, Database } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import { ImageBoard } from './ImageBoard';
import { AISettings } from './AISettings';
import { DataManager } from './DataManager';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onHomeClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onHomeClick }) => {
  const { currentProject, saveProject, isLoading, lastSaved } = useProject();
  const { isConfigured } = useAI();
  const [showImageBoard, setShowImageBoard] = React.useState(false);
  const [showAISettings, setShowAISettings] = React.useState(false);
  const [showDataManager, setShowDataManager] = React.useState(false);

  const handleManualSave = async () => {
    await saveProject();
  };

  return (
    <>
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onHomeClick}
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Home className="h-6 w-6" />
              <span className="hidden sm:inline">ホーム</span>
            </button>
            
            <div className="hidden sm:flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AIと共創するストーリービルダー
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentProject && (
              <>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleManualSave}
                  disabled={isLoading}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                  title="手動保存"
                >
                  <Save className={`h-5 w-5 ${isLoading ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline text-sm">
                    {isLoading ? '保存中...' : lastSaved ? `保存済み ${lastSaved.toLocaleTimeString('ja-JP')}` : '保存'}
                  </span>
                </button>
              </div>
              
              <button
                onClick={() => setShowImageBoard(true)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Image className="h-5 w-5" />
                <span className="hidden sm:inline">イメージボード</span>
              </button>
              </>
            )}
            
            <button
              onClick={() => setShowDataManager(true)}
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <Database className="h-5 w-5" />
              <span className="hidden sm:inline">データ管理</span>
            </button>
            
            <button
              onClick={() => setShowAISettings(true)}
              className={`flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors ${
                !isConfigured ? 'animate-pulse' : ''
              }`}
              title={isConfigured ? 'AI設定' : 'AI設定が必要です'}
            >
              <Settings className="h-5 w-5" />
              <span className="hidden sm:inline">AI設定</span>
              {!isConfigured && (
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
              title={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <ImageBoard 
      isOpen={showImageBoard} 
      onClose={() => setShowImageBoard(false)} 
    />
    
    <AISettings 
      isOpen={showAISettings} 
      onClose={() => setShowAISettings(false)} 
    />
    
    <DataManager 
      isOpen={showDataManager} 
      onClose={() => setShowDataManager(false)} 
    />
    </>
  );
};