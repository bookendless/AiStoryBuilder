import React from 'react';
import { Copy, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { AILogEntry } from './types';

interface AILogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AILogEntry | null;
  logs?: AILogEntry[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onCopyLog?: (log: AILogEntry) => void;
  typeLabels?: Record<string, string>;
}

export const AILogViewerModal: React.FC<AILogViewerModalProps> = ({
  isOpen,
  onClose,
  log,
  logs,
  currentIndex,
  onNavigate,
  onCopyLog,
  typeLabels = {},
}) => {

  const defaultTypeLabels: Record<string, string> = {
    'generate': '生成',
    'readable': '読みやすく',
    'summary': '要点抽出',
    'engaging': '魅力的に',
    'basic': '基本',
    'structure': '構造',
    'enhance': '強化',
    'generateSingle': '単一生成',
    'continue': '続き生成',
    'suggestions': '提案',
    ...typeLabels,
  };

  const getTypeBadgeClass = (type: string): string => {
    const badgeClasses: Record<string, string> = {
      'generate': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'readable': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'summary': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'engaging': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'basic': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'structure': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'enhance': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'generateSingle': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'continue': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'suggestions': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return badgeClasses[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (!log) return null;

  const typeLabel = defaultTypeLabels[log.type] || log.type;
  const canNavigatePrev = logs && currentIndex !== undefined && currentIndex > 0;
  const canNavigateNext = logs && currentIndex !== undefined && currentIndex < logs.length - 1;

  const handleCopy = () => {
    if (onCopyLog) {
      onCopyLog(log);
    } else {
      // フォールバック: 直接クリップボードにコピー
      const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.characterName ? `キャラクター: ${log.characterName}\n` : ''}
${log.fieldLabel ? `フィールド: ${log.fieldLabel}\n` : ''}
${log.structureType ? `構造タイプ: ${log.structureType}\n` : ''}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}
${log.suggestionType ? `提案タイプ: ${log.suggestionType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】\n${log.error}` : ''}`;
      navigator.clipboard.writeText(logText);
    }
  };

  const handlePrev = () => {
    if (canNavigatePrev && onNavigate && currentIndex !== undefined) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (canNavigateNext && onNavigate && currentIndex !== undefined) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <FileText className="h-5 w-5 text-indigo-500 flex-shrink-0" />
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeClass(log.type)}`}>
                {typeLabel}
              </span>
              {log.characterName && (
                <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] truncate">
                  {log.characterName}
                </span>
              )}
              {log.fieldLabel && (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] truncate">
                  {String(log.fieldLabel)}
                </span>
              )}
              {log.structureType && (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] truncate">
                  {String(log.structureType)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
            {/* 前へ/次へナビゲーション */}
            {logs && currentIndex !== undefined && (
              <>
                <button
                  onClick={handlePrev}
                  disabled={!canNavigatePrev}
                  className={`p-2 rounded-lg transition-colors ${
                    canNavigatePrev
                      ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                  title="前のログ"
                  aria-label="前のログ"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {currentIndex + 1} / {logs.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!canNavigateNext}
                  className={`p-2 rounded-lg transition-colors ${
                    canNavigateNext
                      ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                  title="次のログ"
                  aria-label="次のログ"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            {/* コピーボタン */}
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="ログをコピー"
              aria-label="ログをコピー"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pb-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-['Noto_Sans_JP']">
            時刻: {log.timestamp.toLocaleString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          {log.chapterId && (
            <span className="font-['Noto_Sans_JP']">
              章ID: {String(log.chapterId)}
            </span>
          )}
          {log.suggestionType && (
            <span className="font-['Noto_Sans_JP']">
              提案タイプ: {log.suggestionType}
            </span>
          )}
        </div>

        {/* エラー表示 */}
        {log.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2 font-['Noto_Sans_JP']">
              エラー
            </h3>
            <div className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap font-['Noto_Sans_JP']">
              {log.error}
            </div>
          </div>
        )}

        {/* プロンプト */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
            プロンプト
          </h3>
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 max-h-96 overflow-y-auto custom-scrollbar">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed break-words">
              {log.prompt}
            </pre>
          </div>
        </div>

        {/* AI応答 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
            AI応答
          </h3>
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 max-h-96 overflow-y-auto custom-scrollbar">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed break-words">
              {log.response}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
};
