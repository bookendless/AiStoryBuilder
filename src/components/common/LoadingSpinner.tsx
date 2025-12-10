import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  text,
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-b-2',
  };

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-ai-500 ${sizeClasses[size]}`}
        role="status"
        aria-label={text || '読み込み中'}
      >
        <span className="sr-only">{text || '読み込み中'}</span>
      </div>
      {text && (
        <p className="mt-2 text-sm text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-sumi-900/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};








































