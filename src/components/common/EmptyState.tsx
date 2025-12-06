import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  iconSize?: number;
  iconColor?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  iconSize = 64,
  iconColor = 'text-usuzumi-400 dark:text-usuzumi-500',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  children,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {Icon && (
        <div className={`mb-4 ${iconColor}`}>
          <Icon size={iconSize} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-xl font-bold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">
        {title}
      </h3>
      {description && (
        <p className="text-sumi-600 dark:text-usuzumi-400 mb-6 max-w-md font-['Noto_Sans_JP']">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-ai-500 to-ai-600 text-white px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl font-['Noto_Sans_JP']"
        >
          <span>{actionLabel}</span>
        </button>
      )}
      {children}
    </div>
  );
};

