import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ChapterProgress {
  chapterId: string;
  chapterTitle: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

interface AILoadingIndicatorProps {
  message?: string;
  progress?: {
    current: number;
    total: number;
    status?: string;
    chapters?: ChapterProgress[]; // 章ごとの進捗
  };
  estimatedTime?: number; // 推定時間（秒）
  className?: string;
  variant?: 'inline' | 'overlay' | 'fullscreen';
  onCancel?: () => void; // キャンセルコールバック
  cancellable?: boolean; // キャンセル可能かどうか
}

const LOADING_MESSAGES = [
  'AIが思考中...',
  '文章を生成中...',
  '内容を分析中...',
  '最適な表現を探しています...',
  '物語を構築中...',
];

export const AILoadingIndicator: React.FC<AILoadingIndicatorProps> = ({
  message,
  progress,
  estimatedTime,
  className = '',
  variant = 'inline',
  onCancel,
  cancellable = false,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // メッセージのローテーション（3秒ごと）
  useEffect(() => {
    if (!message) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [message]);

  // 経過時間のカウント
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 残り時間の計算
  const remainingTime = estimatedTime ? Math.max(0, estimatedTime - elapsedTime) : null;
  const displayMessage = message || LOADING_MESSAGES[currentMessageIndex];
  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : null;

  // 章ごとの進捗表示
  const renderChapterProgress = () => {
    if (!progress?.chapters || progress.chapters.length === 0) return null;

    return (
      <div className="w-full max-w-md space-y-2 mt-4">
        <p className="text-xs font-medium text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
          章ごとの進捗:
        </p>
        <div className="space-y-1.5">
          {progress.chapters.map((chapter) => (
            <div
              key={chapter.chapterId}
              className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 dark:bg-gray-800/50"
            >
              <span className="text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP'] truncate flex-1">
                {chapter.chapterTitle}
              </span>
              <span className="ml-2 flex-shrink-0">
                {chapter.status === 'completed' && (
                  <span className="text-semantic-success">✓</span>
                )}
                {chapter.status === 'generating' && (
                  <Loader2 className="h-3 w-3 text-ai-500 animate-spin" />
                )}
                {chapter.status === 'error' && (
                  <span className="text-semantic-error">✗</span>
                )}
                {chapter.status === 'pending' && (
                  <span className="text-gray-400">○</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const content = (
    <div className={`relative flex flex-col items-center justify-center space-y-4 ${className}`}>
      {/* キャンセルボタン */}
      {cancellable && onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm transition-colors shadow-lg border border-gray-200 dark:border-gray-700"
          aria-label="キャンセル"
          title="キャンセル"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-ai-500 animate-pulse" />
        </div>
        <Loader2 className="h-8 w-8 text-ai-400 animate-spin" />
      </div>
      
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
          {displayMessage}
        </p>
        
        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
              <span>
                {progress.current} / {progress.total}
              </span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ai-400 to-ai-600 transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            {progress.status && (
              <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                {progress.status}
              </p>
            )}
          </div>
        )}
        
        {estimatedTime && (
          <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
            {remainingTime !== null && remainingTime > 0
              ? `推定残り時間: 約${Math.ceil(remainingTime / 60)}分${remainingTime % 60}秒`
              : '処理中...'}
          </p>
        )}

        {/* 章ごとの進捗 */}
        {renderChapterProgress()}
      </div>
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-sumi-900/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-sumi-900/80 backdrop-blur-sm rounded-lg">
        {content}
      </div>
    );
  }

  // inline variant (default)
  return <div className="relative py-8">{content}</div>;
};


