import React from 'react';

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
  variant?: 'text' | 'card' | 'list' | 'project-card';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  className = '',
  variant = 'text',
  count = 1,
}) => {
  if (variant === 'project-card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${className}`}>
        {Array.from({ length: count }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="animate-pulse p-4 sm:p-6 rounded-lg glass-bg border border-usuzumi-200 dark:border-usuzumi-700"
          >
            {/* 表紙画像のスケルトン */}
            <div className="mb-4">
              <div className="w-full h-36 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>

            {/* タイトルと進捗のスケルトン */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
            </div>

            {/* 進捗バーのスケルトン */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"></div>
            </div>

            {/* メタ情報のスケルトン */}
            <div className="flex items-center justify-between text-sm">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-gray-200 dark:bg-gray-700 rounded"
              style={{ width: i === lines - 1 ? '60%' : '100%' }}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default text variant
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        ></div>
      ))}
    </div>
  );
};


