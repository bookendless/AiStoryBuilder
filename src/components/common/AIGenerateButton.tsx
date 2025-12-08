import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIGenerateButtonProps {
  target: string; // 生成対象の項目名（例: "メインテーマ"）
  onGenerate: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AIGenerateButton: React.FC<AIGenerateButtonProps> = ({
  target,
  onGenerate,
  isLoading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-lg',
    secondary: 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 text-purple-700 dark:text-purple-300 hover:from-purple-200 hover:to-indigo-200 dark:hover:from-purple-900/50 dark:hover:to-indigo-900/50 border border-purple-200 dark:border-purple-700',
    icon: 'p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
  };

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const buttonClasses = `
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    rounded-lg
    transition-all
    duration-200
    font-['Noto_Sans_JP']
    disabled:opacity-50
    disabled:cursor-not-allowed
    ${variant === 'primary' ? 'hover:scale-105' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  if (variant === 'icon') {
    return (
      <button
        onClick={onGenerate}
        disabled={isLoading || disabled}
        className={buttonClasses}
        title={`AIで${target}を生成`}
        aria-label={`AIで${target}を生成`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSize[size]} animate-spin`} />
        ) : (
          <Sparkles className={iconSize[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onGenerate}
      disabled={isLoading || disabled}
      className={buttonClasses}
      aria-label={`AIで${target}を生成`}
    >
      <div className="flex items-center space-x-2">
        {isLoading ? (
          <Loader2 className={`${iconSize[size]} animate-spin`} />
        ) : (
          <Sparkles className={iconSize[size]} />
        )}
        <span>
          {isLoading ? '生成中...' : `AIで${target}を生成`}
        </span>
      </div>
    </button>
  );
};

