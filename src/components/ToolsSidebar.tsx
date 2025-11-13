import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Image, 
  FileText, 
  Network, 
  Calendar,
  MessageSquare
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { ImageBoard } from './ImageBoard';
import { GlossaryManager } from './tools/GlossaryManager';
import { RelationshipDiagram } from './tools/RelationshipDiagram';
import { TimelineViewer } from './tools/TimelineViewer';
import { ChatAssistant } from './tools/ChatAssistant';

interface ToolsSidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export const ToolsSidebar: React.FC<ToolsSidebarProps> = ({ className = '', isCollapsed: externalIsCollapsed, onCollapseChange }) => {
  const { currentProject } = useProject();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const [showImageBoard, setShowImageBoard] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // 外部から状態が渡されている場合はそれを使用、そうでなければ内部状態を使用
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    if (externalIsCollapsed === undefined) {
      setInternalIsCollapsed(newState);
    }
    onCollapseChange?.(newState);
  };

  const tools = [
    {
      id: 'imageBoard',
      label: 'イメージボード',
      icon: Image,
      onClick: () => setShowImageBoard(true),
      color: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
      available: !!currentProject,
    },
    {
      id: 'glossary',
      label: '用語集',
      icon: FileText,
      onClick: () => setShowGlossary(true),
      color: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
      available: !!currentProject,
    },
    {
      id: 'relationships',
      label: '相関図',
      icon: Network,
      onClick: () => setShowRelationships(true),
      color: 'text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20',
      available: !!currentProject,
    },
    {
      id: 'timeline',
      label: 'タイムライン',
      icon: Calendar,
      onClick: () => setShowTimeline(true),
      color: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
      available: !!currentProject,
    },
  ];

  return (
    <>
      <aside 
        className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg border-l border-gray-200 dark:border-gray-700 transition-all duration-300 z-10 ${className} ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
        role="complementary"
        aria-label="ツールサイドバー"
      >
        <div className="h-full flex flex-col">
          {/* ヘッダー */}
          <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}>
            {!isCollapsed && (
              <h2 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                ツール
              </h2>
            )}
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
            >
              {isCollapsed ? (
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          {/* ツールリスト */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2" role="list" aria-label="ツール一覧">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isDisabled = !tool.available;
              
              return (
                <button
                  key={tool.id}
                  onClick={tool.onClick}
                  disabled={isDisabled}
                  className={`w-full flex items-center rounded-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    isCollapsed 
                      ? 'justify-center px-2 py-3' 
                      : 'space-x-3 px-4 py-3 text-left'
                  } ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : tool.color
                  }`}
                  role="listitem"
                  aria-label={tool.label}
                  title={isDisabled ? 'プロジェクトが必要です' : tool.label}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  {!isCollapsed && (
                    <span className="font-medium font-['Noto_Sans_JP'] flex-1">
                      {tool.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* チャットボタン（常に表示） */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowChat(true)}
              className={`w-full flex items-center rounded-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 ${
                isCollapsed 
                  ? 'justify-center px-2 py-3' 
                  : 'space-x-3 px-4 py-3 text-left'
              }`}
              aria-label="AIアシスタント"
              title="AIアシスタントとチャット"
            >
              <div className="relative flex-shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              {!isCollapsed && (
                <span className="font-medium font-['Noto_Sans_JP'] flex-1">
                  AIアシスタント
                </span>
              )}
            </button>
          </div>

          {/* フッター情報 */}
          {!isCollapsed && currentProject && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                <p className="font-semibold mb-1">プロジェクト</p>
                <p className="truncate" title={currentProject.title}>
                  {currentProject.title}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* モーダル */}
      <ImageBoard 
        isOpen={showImageBoard} 
        onClose={() => setShowImageBoard(false)} 
      />
      
      <GlossaryManager 
        isOpen={showGlossary} 
        onClose={() => setShowGlossary(false)} 
      />
      
      <RelationshipDiagram 
        isOpen={showRelationships} 
        onClose={() => setShowRelationships(false)} 
      />
      
      <TimelineViewer 
        isOpen={showTimeline} 
        onClose={() => setShowTimeline(false)} 
      />
      
      <ChatAssistant 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
      />
    </>
  );
};

