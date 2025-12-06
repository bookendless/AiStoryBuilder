import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Target, Sparkles } from 'lucide-react';

export interface TutorialStep {
  id: string;
  target: string; // CSSセレクタまたはID
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    type: 'click' | 'wait';
    selector?: string;
    text?: string;
  };
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  onStepChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // ターゲット要素の検出と位置計算
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const findTarget = () => {
      const element = document.querySelector(currentStep.target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        updateTooltipPosition(element);
      } else {
        // 要素が見つからない場合は中央に表示
        setTargetElement(null);
        setTooltipPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }
    };

    const updateTooltipPosition = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const position = currentStep.position || 'bottom';
      const spacing = 16;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - spacing;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + spacing;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - spacing;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + spacing;
          break;
        case 'center':
          top = rect.top + rect.height / 2;
          left = rect.left + rect.width / 2;
          break;
      }

      setTooltipPosition({ top, left });
    };

    // 初回検出
    findTarget();

    // リサイズやスクロール時に位置を更新
    const handleResize = () => {
      findTarget();
    };
    const handleScroll = () => {
      if (targetElement) {
        updateTooltipPosition(targetElement);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, currentStep, targetElement]);

  // ターゲット要素のハイライト
  useEffect(() => {
    if (!targetElement) return;

    const originalStyle = {
      zIndex: targetElement.style.zIndex,
      position: targetElement.style.position,
      outline: targetElement.style.outline,
    };

    targetElement.style.zIndex = '9998';
    if (getComputedStyle(targetElement).position === 'static') {
      targetElement.style.position = 'relative';
    }
    targetElement.style.outline = '3px solid rgba(99, 102, 241, 0.5)';
    targetElement.style.outlineOffset = '4px';
    targetElement.style.borderRadius = '8px';

    return () => {
      targetElement.style.zIndex = originalStyle.zIndex;
      targetElement.style.position = originalStyle.position;
      targetElement.style.outline = originalStyle.outline;
      targetElement.style.outlineOffset = '';
      targetElement.style.borderRadius = '';
    };
  }, [targetElement]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange?.(nextIndex);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onStepChange?.(prevIndex);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen || !currentStep) return null;

  const position = currentStep.position || 'bottom';
  const tooltipClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9997] transition-opacity"
        onClick={(e) => {
          // ツールチップ以外をクリックした場合は無視（スキップを明示的に行う必要がある）
          if (e.target === overlayRef.current) {
            // オーバーレイをクリックしても何もしない（誤操作防止）
          }
        }}
        aria-hidden="true"
      />

      {/* ツールチップ */}
      <div
        ref={tooltipRef}
        className={`fixed z-[9999] ${tooltipClasses[position]}`}
        style={{
          top: position === 'center' ? tooltipPosition.top : undefined,
          left: position === 'center' ? tooltipPosition.left : undefined,
        }}
      >
        <div className="bg-unohana-50 dark:bg-sumi-800 rounded-lg shadow-2xl border-2 border-ai-500 max-w-sm p-6 relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleSkip}
            className="absolute top-2 right-2 p-1 rounded-lg text-sumi-600 dark:text-usuzumi-400 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors"
            aria-label="チュートリアルをスキップ"
          >
            <X className="h-4 w-4" />
          </button>

          {/* ヘッダー */}
          <div className="flex items-center space-x-2 mb-3">
            <div className="bg-gradient-to-br from-ai-500 to-purple-600 p-1.5 rounded-lg">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                {currentStep.title}
              </h3>
              <p className="text-xs text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                ステップ {currentStepIndex + 1} / {steps.length}
              </p>
            </div>
          </div>

          {/* コンテンツ */}
          <p className="text-sumi-700 dark:text-usuzumi-300 mb-4 font-['Noto_Sans_JP']">
            {currentStep.content}
          </p>

          {/* アクション指示 */}
          {currentStep.action && (
            <div className="mb-4 p-3 bg-ai-50 dark:bg-ai-900/20 rounded-lg border border-ai-200 dark:border-ai-800">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-ai-600 dark:text-ai-400" />
                <span className="text-sm text-ai-800 dark:text-ai-200 font-['Noto_Sans_JP']">
                  {currentStep.action.text || '次のステップに進みましょう'}
                </span>
              </div>
            </div>
          )}

          {/* フッター */}
          <div className="flex items-center justify-between pt-4 border-t border-usuzumi-200 dark:border-usuzumi-700">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-['Noto_Sans_JP'] ${
                isFirstStep
                  ? 'text-usuzumi-400 dark:text-usuzumi-600 cursor-not-allowed'
                  : 'text-sumi-700 dark:text-usuzumi-300 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>前へ</span>
            </button>

            <div className="flex items-center space-x-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    index === currentStepIndex
                      ? 'bg-ai-600 dark:bg-ai-400 w-6'
                      : 'bg-usuzumi-300 dark:bg-usuzumi-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-ai-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
            >
              <span>{isLastStep ? '完了' : '次へ'}</span>
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 矢印 */}
        {position !== 'center' && (
          <div
            className={`absolute w-0 h-0 border-8 ${
              position === 'top'
                ? 'top-full left-1/2 -translate-x-1/2 border-t-ai-500 border-r-transparent border-b-transparent border-l-transparent'
                : position === 'bottom'
                ? 'bottom-full left-1/2 -translate-x-1/2 border-b-ai-500 border-r-transparent border-t-transparent border-l-transparent'
                : position === 'left'
                ? 'left-full top-1/2 -translate-y-1/2 border-l-ai-500 border-t-transparent border-b-transparent border-r-transparent'
                : 'right-full top-1/2 -translate-y-1/2 border-r-ai-500 border-t-transparent border-b-transparent border-l-transparent'
            }`}
          />
        )}
      </div>
    </>
  );
};

