import React from 'react';
import { FileText, Copy, Download } from 'lucide-react';
import { AILogEntry } from './types';

interface AILogPanelProps {
  logs: AILogEntry[];
  onCopyLog?: (log: AILogEntry) => void;
  onDownloadLogs?: () => void;
  typeLabels?: Record<string, string>;
  maxHeight?: string;
  renderLogContent?: (log: AILogEntry) => React.ReactNode;
  showWhenEmpty?: boolean;
  compact?: boolean;
}

export const AILogPanel: React.FC<AILogPanelProps> = ({
  logs,
  onCopyLog,
  onDownloadLogs,
  typeLabels = {},
  maxHeight = 'max-h-96',
  renderLogContent,
  showWhenEmpty = true,
  compact = false,
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

  if (logs.length === 0) {
    if (!showWhenEmpty) {
      return null;
    }
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-['Noto_Sans_JP']">
          AIログがありません
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
          AI生成を実行すると、ここにログが表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onDownloadLogs && (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={onDownloadLogs}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="ログをダウンロード"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={`space-y-3 ${maxHeight} overflow-y-auto`}>
        {logs.map((log) => (
          <div
            key={log.id}
            className={`bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 ${compact ? 'p-2' : 'p-3'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeClass(log.type)}`}>
                  {defaultTypeLabels[log.type] || log.type}
                </span>
                {log.characterName && (
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {log.characterName}
                  </span>
                )}
                {log.fieldLabel && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {log.fieldLabel}
                  </span>
                )}
                {log.structureType && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {log.structureType}
                  </span>
                )}
                {log.chapterId && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {log.chapterId}
                  </span>
                )}
                {log.suggestionType && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {log.suggestionType}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {log.timestamp.toLocaleString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {onCopyLog && (
                  <button
                    onClick={() => onCopyLog(log)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="ログをコピー"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {log.error ? (
              <div className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                <strong>エラー:</strong> {log.error}
              </div>
            ) : renderLogContent ? (
              renderLogContent(log)
            ) : (
              <div className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                <div className="mb-2">
                  <strong>プロンプト:</strong>
                  <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs max-h-20 overflow-y-auto">
                    {log.prompt.substring(0, 200)}...
                  </div>
                </div>
                <div>
                  <strong>応答:</strong>
                  <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs max-h-20 overflow-y-auto">
                    {log.response.substring(0, 300)}...
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

