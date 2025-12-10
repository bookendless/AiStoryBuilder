import React from 'react';
import { Sparkles, Check, FileText, BookOpen, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { useProject, Chapter } from '../../../contexts/ProjectContext';
import { AILogPanel } from '../../common/AILogPanel';
import { AILogEntry } from '../../common/types';
import { SidebarSectionId, StructureProgress } from './types';

interface ChapterSidebarProps {
  sectionOrder: SidebarSectionId[];
  expandedSections: Set<SidebarSectionId>;
  expandedChapters: Set<string>;
  searchQuery: string;
  filteredChapters: Chapter[];
  structureProgress: StructureProgress;
  isGenerating: boolean;
  isGeneratingStructure: boolean;
  aiLogs: AILogEntry[];
  draggedSectionIndex: number | null;
  dragOverSectionIndex: number | null;
  onToggleSection: (sectionId: SidebarSectionId) => void;
  onScrollToChapter: (chapterId: string) => void;
  onAIGenerate: () => void;
  onStructureProgressChange: (section: keyof StructureProgress) => void;
  onStructureBasedAIGenerate: () => void;
  onCopyLog: (log: AILogEntry) => void;
  onDownloadLogs: () => void;
  onSectionDragStart: (e: React.DragEvent, index: number) => void;
  onSectionDragOver: (e: React.DragEvent, index: number) => void;
  onSectionDragLeave: () => void;
  onSectionDrop: (e: React.DragEvent, dropIndex: number) => void;
  onSectionDragEnd: () => void;
}

export const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
  sectionOrder,
  expandedSections,
  expandedChapters,
  searchQuery,
  filteredChapters,
  structureProgress,
  isGenerating,
  isGeneratingStructure,
  aiLogs,
  draggedSectionIndex,
  dragOverSectionIndex,
  onToggleSection,
  onScrollToChapter,
  onAIGenerate,
  onStructureProgressChange,
  onStructureBasedAIGenerate,
  onCopyLog,
  onDownloadLogs,
  onSectionDragStart,
  onSectionDragOver,
  onSectionDragLeave,
  onSectionDrop,
  onSectionDragEnd,
}) => {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  const renderSectionContent = (sectionId: SidebarSectionId) => {
    switch (sectionId) {
      case 'tableOfContents':
        if (currentProject.chapters.length === 0) return null;
        return (
          <div className="space-y-1">
            {currentProject.chapters.map((chapter, chIndex) => {
              const isChapterExpanded = expandedChapters.has(chapter.id);
              const isVisible = !searchQuery || filteredChapters.some(ch => ch.id === chapter.id);

              if (!isVisible) return null;

              return (
                <button
                  key={chapter.id}
                  onClick={() => onScrollToChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm font-['Noto_Sans_JP'] ${isChapterExpanded
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {chIndex + 1}.
                    </span>
                    <span className="truncate">{chapter.title}</span>
                  </div>
                </button>
              );
            })}

            {searchQuery && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  検索中: {filteredChapters.length} / {currentProject.chapters.length} 章
                </p>
              </div>
            )}
          </div>
        );

      case 'aiAssistant':
        return (
          <>
            <div className="space-y-3 mb-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                章立ての役割
              </h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  <span className="font-medium">• 物語の構成化:</span> 起承転結や三幕構成に沿った論理的な展開
                </p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  <span className="font-medium">• 読者の理解促進:</span> 明確な区切りで読みやすさを向上
                </p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  <span className="font-medium">• 執筆の指針:</span> 各章の目的と内容を事前に整理
                </p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  <span className="font-medium">• ペース管理:</span> 適切な緊張感と緩急のコントロール
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                  AI章立て機能
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP'] mb-3">
                構成詳細（起承転結・三幕構成・四幕構成）を最重要視し、ジャンルに適した章立てを自動生成します。プロット基本設定から逸脱しないよう設計されています。
              </p>
              <button
                onClick={onAIGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
              >
                <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? '生成中...' : 'AI章立て提案'}</span>
              </button>
            </div>
          </>
        );

      case 'structureProgress':
        return (
          <>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">作成済み章数</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {currentProject.chapters.length} / 10
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((currentProject.chapters.length / 10) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">構成バランス</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-3">
                各構成要素が実装できているかチェックしてください
              </p>
              <div className="space-y-3">
                {(['introduction', 'development', 'climax', 'conclusion'] as const).map((key) => {
                  const labels = {
                    introduction: { name: '導入部', desc: '世界観、キャラクター、基本設定を提示' },
                    development: { name: '展開部', desc: '葛藤や問題を発展させ、物語を深める' },
                    climax: { name: 'クライマックス', desc: '物語の最高潮、最大の転換点' },
                    conclusion: { name: '結末部', desc: '問題の解決、物語の締めくくり' },
                  };
                  const label = labels[key];
                  const completed = structureProgress[key];

                  return (
                    <div key={key} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => onStructureProgressChange(key)}
                            className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
                            style={{
                              backgroundColor: completed ? '#10b981' : 'transparent',
                              borderColor: completed ? '#10b981' : '#d1d5db',
                            }}
                          >
                            {completed && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                          <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{label.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${completed
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}>
                          {completed ? '完了' : '未完了'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-8">
                        {label.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 全体の進捗表示 */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">構成完成度</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {Object.values(structureProgress).filter(Boolean).length} / 4
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(Object.values(structureProgress).filter(Boolean).length / 4) * 100}%` }}
                  />
                </div>
              </div>

              {/* 構成バランスAI提案ボタン */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                    構成バランスAI提案
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                    未完了の構成要素に焦点を当て、構成詳細を最重要視した章立てをAIが提案します。ジャンルに適した構成で補完します。
                  </p>
                  <button
                    onClick={onStructureBasedAIGenerate}
                    disabled={isGeneratingStructure || Object.values(structureProgress).every(Boolean)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-['Noto_Sans_JP']"
                  >
                    <Sparkles className={`h-4 w-4 ${isGeneratingStructure ? 'animate-spin' : ''}`} />
                    <span>
                      {isGeneratingStructure
                        ? '生成中...'
                        : Object.values(structureProgress).every(Boolean)
                          ? 'すべて完了済み'
                          : '構成バランス提案'
                      }
                    </span>
                  </button>
                  {Object.values(structureProgress).some(Boolean) && !Object.values(structureProgress).every(Boolean) && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-['Noto_Sans_JP']">
                      未完了: {Object.entries(structureProgress)
                        .filter(([_key, completed]) => !completed)
                        .map(([key, _value]) => {
                          const labels = {
                            introduction: '導入部',
                            development: '展開部',
                            climax: 'クライマックス',
                            conclusion: '結末部'
                          };
                          return labels[key as keyof typeof labels];
                        })
                        .join('、')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        );

      case 'aiLogs':
        return (
          <AILogPanel
            logs={aiLogs}
            onCopyLog={onCopyLog}
            onDownloadLogs={onDownloadLogs}
            typeLabels={{
              basic: '基本提案',
              structure: '構成提案',
            }}
            maxHeight="max-h-96"
            renderLogContent={(log) => (
              <>
                {log.parsedChapters && Array.isArray(log.parsedChapters) && log.parsedChapters.length > 0 && (
                  <div className="mt-2">
                    <strong>解析された章 ({log.parsedChapters.length}章):</strong>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {log.parsedChapters.map((c: { title?: string }) => c.title || '').filter(Boolean).join(', ')}
                    </div>
                  </div>
                )}
              </>
            )}
          />
        );

      default:
        return null;
    }
  };

  const getSectionInfo = (sectionId: SidebarSectionId) => {
    switch (sectionId) {
      case 'tableOfContents':
        return {
          title: '章目次',
          icon: BookOpen,
          bgClass: 'bg-white dark:bg-gray-800',
          borderClass: 'border-gray-100 dark:border-gray-700',
          iconBgClass: 'bg-gradient-to-br from-indigo-500 to-purple-600',
          maxHeight: 'max-h-[400px]'
        };
      case 'aiAssistant':
        return {
          title: '構成アシスタント',
          icon: Sparkles,
          bgClass: 'bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20',
          borderClass: 'border-blue-200 dark:border-blue-800',
          iconBgClass: 'bg-gradient-to-br from-blue-500 to-teal-600',
          maxHeight: ''
        };
      case 'structureProgress':
        return {
          title: '構成進捗',
          icon: Check,
          bgClass: 'bg-white dark:bg-gray-800',
          borderClass: 'border-gray-100 dark:border-gray-700',
          iconBgClass: 'bg-gradient-to-br from-green-500 to-emerald-600',
          maxHeight: ''
        };
      case 'aiLogs':
        return {
          title: 'AIログ',
          icon: FileText,
          bgClass: 'bg-white dark:bg-gray-800',
          borderClass: 'border-gray-100 dark:border-gray-700',
          iconBgClass: 'bg-gradient-to-br from-green-500 to-emerald-600',
          maxHeight: ''
        };
    }
  };

  return (
    <div className="space-y-6">
      {sectionOrder.map((sectionId, index) => {
        const isExpanded = expandedSections.has(sectionId);
        const isDragging = draggedSectionIndex === index;
        const isDragOver = dragOverSectionIndex === index;
        const sectionInfo = getSectionInfo(sectionId);
        const IconComponent = sectionInfo.icon;
        const content = renderSectionContent(sectionId);

        // 章目次が空の場合は非表示
        if (sectionId === 'tableOfContents' && currentProject.chapters.length === 0) {
          return null;
        }

        return (
          <div
            key={sectionId}
            draggable
            onDragStart={(e) => onSectionDragStart(e, index)}
            onDragOver={(e) => onSectionDragOver(e, index)}
            onDragLeave={onSectionDragLeave}
            onDrop={(e) => onSectionDrop(e, index)}
            onDragEnd={onSectionDragEnd}
            className={`${sectionInfo.bgClass} rounded-2xl shadow-lg border transition-all duration-200 ${isDragging
              ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
              : isDragOver
                ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                : `${sectionInfo.borderClass} cursor-move hover:shadow-xl`
              }`}
          >
            {/* ヘッダー */}
            <div
              className="p-6 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
              onClick={() => onToggleSection(sectionId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`${sectionInfo.iconBgClass} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    {sectionInfo.title}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* コンテンツ */}
            {isExpanded && content && (
              <div className={`p-6 overflow-y-auto ${sectionInfo.maxHeight}`}>
                {content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};






























