import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Image,
  FileText,
  Network,
  Calendar,
  MessageSquare,
  Globe,
  Bookmark,
  TrendingUp,
  Sparkles,
  Wrench,
  HelpCircle
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { Step } from '../App';
import { ImageBoard } from './ImageBoard';
import { GlossaryManager } from './tools/GlossaryManager';
import { RelationshipDiagram } from './tools/RelationshipDiagram';
import { TimelineViewer } from './tools/TimelineViewer';
import { ChatAssistant } from './tools/ChatAssistant';
import { WorldSettingsManager } from './tools/WorldSettingsManager';
import { ForeshadowingTracker } from './tools/ForeshadowingTracker';
import { EmotionMapVisualizer } from './tools/EmotionMapVisualizer';
import { CharacterAssistantPanel } from './tools/CharacterAssistantPanel';
import { SynopsisAssistantPanel } from './tools/SynopsisAssistantPanel';
import { PlotStep1AssistantPanel } from './tools/PlotStep1AssistantPanel';
import { PlotStep2AssistantPanel } from './tools/PlotStep2AssistantPanel';
import { ChapterAssistantPanel } from './tools/ChapterAssistantPanel';
import { DraftAssistantPanel } from './tools/DraftAssistantPanel';

// ツールボタンコンポーネント（メモ化）
interface ToolButtonProps {
  tool: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  };
  isDisabled: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const ToolButton = React.memo<ToolButtonProps>(({ tool, isDisabled, isCollapsed, onClick }) => {
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full flex items-center rounded-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isCollapsed
        ? 'justify-center px-2 py-3'
        : 'space-x-3 px-4 py-3 text-left'
        } ${isDisabled
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
}, (prevProps, nextProps) => {
  // カスタム比較関数：ツールの状態が変更された場合のみ再レンダリング
  return (
    prevProps.tool.id === nextProps.tool.id &&
    prevProps.isDisabled === nextProps.isDisabled &&
    prevProps.isCollapsed === nextProps.isCollapsed
  );
});

ToolButton.displayName = 'ToolButton';

const MEMO_TABS = [
  { id: 'ideas', label: '1' },
  { id: 'tasks', label: '2' },
  { id: 'notes', label: '3' },
] as const;

type MemoTabId = (typeof MEMO_TABS)[number]['id'];

interface ToolsSidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
  currentStep?: Step;
}

export const ToolsSidebar: React.FC<ToolsSidebarProps> = ({ className = '', isCollapsed: externalIsCollapsed, onCollapseChange, currentStep = 'home' }) => {
  const { currentProject } = useProject();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'assist' | 'tools'>('assist');

  // ツール状態
  const [showImageBoard, setShowImageBoard] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showWorldSettings, setShowWorldSettings] = useState(false);
  const [showForeshadowings, setShowForeshadowings] = useState(false);
  const [showEmotionMap, setShowEmotionMap] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // メモ状態
  const [activeMemoTab, setActiveMemoTab] = useState<MemoTabId>('ideas');
  const memoDefaults = useMemo(
    () =>
      MEMO_TABS.reduce<Record<MemoTabId, string>>((acc, tab) => {
        acc[tab.id] = '';
        return acc;
      }, { ideas: '', tasks: '', notes: '' }),
    []
  );
  const [memoTexts, setMemoTexts] = useState<Record<MemoTabId, string>>(memoDefaults);
  const memoStorageKey = currentProject ? `toolsSidebarMemo:${currentProject.id}` : 'toolsSidebarMemo:global';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedMemo = localStorage.getItem(memoStorageKey);
      if (savedMemo) {
        const parsed = JSON.parse(savedMemo) as Partial<Record<MemoTabId, string>>;
        setMemoTexts({ ...memoDefaults, ...parsed });
      } else {
        setMemoTexts(memoDefaults);
      }
    } catch (error) {
      console.error('メモ読み込みエラー:', error);
      setMemoTexts(memoDefaults);
    }
  }, [memoStorageKey, memoDefaults]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(memoStorageKey, JSON.stringify(memoTexts));
    } catch (error) {
      console.error('メモ保存エラー:', error);
    }
  }, [memoStorageKey, memoTexts]);

  const handleMemoChange = (value: string) => {
    setMemoTexts((prev) => ({
      ...prev,
      [activeMemoTab]: value,
    }));
  };

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
    {
      id: 'worldSettings',
      label: '世界観',
      icon: Globe,
      onClick: () => setShowWorldSettings(true),
      color: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
      available: !!currentProject,
    },
    {
      id: 'foreshadowings',
      label: '伏線トラッカー',
      icon: Bookmark,
      onClick: () => setShowForeshadowings(true),
      color: 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20',
      available: !!currentProject,
    },
    {
      id: 'emotionMap',
      label: '感情マップ',
      icon: TrendingUp,
      onClick: () => setShowEmotionMap(true),
      color: 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20',
      available: !!currentProject,
    },
  ];

  const renderAssistContent = () => {
    switch (currentStep) {
      case 'character':
        return <CharacterAssistantPanel />;
      case 'synopsis':
        return <SynopsisAssistantPanel />;
      case 'plot1':
        return <PlotStep1AssistantPanel />;
      case 'plot2':
        return <PlotStep2AssistantPanel />;
      case 'chapter':
        return <ChapterAssistantPanel />;
      case 'draft':
        return <DraftAssistantPanel />;
      case 'home':
        return (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            <p className="text-sm">プロジェクトを選択して<br />作業を開始しましょう</p>
          </div>
        );
      default:
        return (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 text-indigo-400" />
            <p className="text-sm">このステップのAI支援機能は<br />準備中です</p>
          </div>
        );
    }
  };

  return (
    <>
      <aside
        className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg border-l border-gray-200 dark:border-gray-700 transition-all duration-300 z-30 ${className} ${isCollapsed ? 'w-16' : 'w-72'
          }`}
        role="complementary"
        aria-label="ツールサイドバー"
      >
        <div className="h-full flex flex-col">
          {/* ヘッダー & タブ切り替え */}
          <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className={`flex items-center ${isCollapsed ? 'justify-center p-4' : 'justify-between p-2'}`}>
              {!isCollapsed && (
                <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-lg mx-2 flex-1">
                  <button
                    onClick={() => setActiveTab('assist')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 font-['Noto_Sans_JP'] ${activeTab === 'assist'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>支援</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('tools')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 font-['Noto_Sans_JP'] ${activeTab === 'tools'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    <Wrench className="h-4 w-4" />
                    <span>ツール</span>
                  </button>
                </div>
              )}

              <button
                onClick={handleToggleCollapse}
                className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isCollapsed ? '' : 'mr-1'}`}
                aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
              >
                {isCollapsed ? (
                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* コンテンツエリア */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {isCollapsed ? (
              // 折りたたみ時のアイコン表示
              <div className="flex flex-col items-center py-4 space-y-4">
                <button
                  onClick={() => {
                    handleToggleCollapse();
                    setActiveTab('assist');
                  }}
                  className={`p-2 rounded-lg transition-colors ${activeTab === 'assist'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  title="AI支援"
                >
                  <Sparkles className="h-6 w-6" />
                </button>
                <button
                  onClick={() => {
                    handleToggleCollapse();
                    setActiveTab('tools');
                  }}
                  className={`p-2 rounded-lg transition-colors ${activeTab === 'tools'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  title="ツール"
                >
                  <Wrench className="h-6 w-6" />
                </button>
                <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 my-2" />
                <button
                  onClick={() => setShowChat(true)}
                  className="p-2 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  title="AIチャット"
                >
                  <MessageSquare className="h-6 w-6" />
                </button>
              </div>
            ) : (
              // 展開時のコンテンツ
              <>
                {activeTab === 'assist' && (
                  <div className="p-4 animate-fadeIn">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 text-pink-500" />
                        ステップ支援
                      </h3>
                      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[200px]">
                        {renderAssistContent()}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tools' && (
                  <div className="p-4 space-y-6 animate-fadeIn">
                    <div role="list" aria-label="ツール一覧" className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] uppercase tracking-wider mb-2">
                        プロジェクトツール
                      </h3>
                      {tools.map((tool) => {
                        const isDisabled = !tool.available;
                        return (
                          <ToolButton
                            key={tool.id}
                            tool={tool}
                            isDisabled={isDisabled}
                            isCollapsed={isCollapsed}
                            onClick={tool.onClick}
                          />
                        );
                      })}
                    </div>

                    {/* メモエリア */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']" htmlFor="tools-sidebar-memo">
                          クイックメモ
                        </label>
                        <div role="tablist" aria-label="メモタブ" className="flex gap-1">
                          {MEMO_TABS.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={activeMemoTab === tab.id}
                              onClick={() => setActiveMemoTab(tab.id)}
                              className={`px-2 py-1 rounded-md text-xs font-['Noto_Sans_JP'] transition-colors ${activeMemoTab === tab.id
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        id="tools-sidebar-memo"
                        aria-label="ツールメモ"
                        value={memoTexts[activeMemoTab] ?? ''}
                        onChange={(event) => handleMemoChange(event.target.value)}
                        rows={6}
                        placeholder="アイデアや気づきを自由にメモ..."
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[120px]"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* フッター：チャット (展開時のみ詳細表示) */}
          {!isCollapsed && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowChat(true)}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group"
                aria-label="AIアシスタント"
              >
                <MessageSquare className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <span className="block text-sm font-bold font-['Noto_Sans_JP']">AIチャット相談</span>
                  <span className="block text-xs text-purple-100 font-['Noto_Sans_JP']">困ったらここで相談</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* モーダル群 */}
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

      <WorldSettingsManager
        isOpen={showWorldSettings}
        onClose={() => setShowWorldSettings(false)}
      />

      <ForeshadowingTracker
        isOpen={showForeshadowings}
        onClose={() => setShowForeshadowings(false)}
      />

      <EmotionMapVisualizer
        isOpen={showEmotionMap}
        onClose={() => setShowEmotionMap(false)}
      />

      <ChatAssistant
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />
    </>
  );
};

