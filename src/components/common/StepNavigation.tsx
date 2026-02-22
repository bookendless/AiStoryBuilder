import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Step } from '../../App';

interface StepNavigationProps {
  currentStep: Step;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
  showStepNumbers?: boolean;
}

const STEP_ORDER: Step[] = ['plot1', 'character', 'plot2', 'synopsis', 'chapter', 'draft', 'review', 'export'];

const STEP_LABELS: Record<Step, string> = {
  home: 'ホーム',
  character: 'キャラクター設計',
  plot1: 'プロット設計（基本）',
  plot2: 'プロット設計（詳細）',
  synopsis: 'あらすじ',
  chapter: '章立て',
  draft: '草案作成',
  review: '作品評価',
  export: 'エクスポート',
};

// 各ステップのイメージカラー（ホバー用）
const STEP_HOVER_COLORS: Record<Step, string> = {
  home: 'hover:bg-gray-100 dark:hover:bg-gray-700',
  plot1: 'hover:bg-gradient-to-r hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30 hover:text-purple-700 dark:hover:text-purple-300',
  character: 'hover:bg-gradient-to-r hover:from-pink-100 hover:to-rose-100 dark:hover:from-pink-900/30 dark:hover:to-rose-900/30 hover:text-pink-700 dark:hover:text-pink-300',
  plot2: 'hover:bg-gradient-to-r hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 hover:text-purple-700 dark:hover:text-purple-300',
  synopsis: 'hover:bg-gradient-to-r hover:from-indigo-100 hover:to-blue-100 dark:hover:from-indigo-900/30 dark:hover:to-blue-900/30 hover:text-indigo-700 dark:hover:text-indigo-300',
  chapter: 'hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/30 dark:hover:to-cyan-900/30 hover:text-blue-700 dark:hover:text-blue-300',
  draft: 'hover:bg-gradient-to-r hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 hover:text-green-700 dark:hover:text-green-300',
  review: 'hover:bg-gradient-to-r hover:from-teal-100 hover:to-teal-200 dark:hover:from-teal-900/30 dark:hover:to-teal-800/30 hover:text-teal-700 dark:hover:text-teal-300',
  export: 'hover:bg-gradient-to-r hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30 hover:text-orange-700 dark:hover:text-orange-300',
};

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  className = '',
  showStepNumbers = true,
}) => {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const previousStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : null;
  const nextStep = currentIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentIndex + 1] : null;

  const prevLabel = previousLabel || (previousStep ? STEP_LABELS[previousStep] : '前のステップ');
  const nextLabelText = nextLabel || (nextStep ? STEP_LABELS[nextStep] : '次のステップ');

  // 前のステップと次のステップのホバー色を取得
  const previousHoverColor = previousStep ? STEP_HOVER_COLORS[previousStep] : '';
  const nextHoverColor = nextStep ? STEP_HOVER_COLORS[nextStep] : '';

  return (
    <div className={`relative flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700 mb-6 ${className}`}>
      <button
        onClick={onPrevious}
        disabled={!previousStep}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-['Noto_Sans_JP']
          ${previousStep
            ? `text-gray-700 dark:text-gray-300 hover:scale-105 ${previousHoverColor}`
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
          }
        `}
        aria-label={prevLabel}
      >
        <ChevronLeft className="h-4 w-4" />
        <span>{prevLabel}</span>
      </button>

      {showStepNumbers && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-nowrap">
          <span>{currentIndex + 1} / {STEP_ORDER.length}</span>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!nextStep}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-['Noto_Sans_JP']
          ${nextStep
            ? `text-gray-700 dark:text-gray-300 hover:scale-105 ${nextHoverColor}`
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
          }
        `}
        aria-label={nextLabelText}
      >
        <span>{nextLabelText}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

