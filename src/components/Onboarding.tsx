import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, BookOpen, PenTool, Download, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { Modal } from './common/Modal';

interface OnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  mode?: 'full' | 'quick'; // フルオンボーディングまたはクイックガイド
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: string;
  features?: string[];
}

// クイックガイド用の簡素化されたステップ
const quickOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'AIと共創するストーリービルダーへようこそ',
    description: 'このアプリは、AIの力を借りて小説を創作するための支援ツールです。80%の面倒な作業はAIに任せて、20%の創造性に集中しましょう。',
    icon: <Sparkles className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />,
    features: [
      'AIによるキャラクター設計の支援',
      'プロット構造の自動生成',
      '草案執筆のAI支援',
    ],
  },
  {
    id: 'workflow',
    title: '6ステップの制作ワークフロー',
    description: '小説制作は6つのステップで進めます。各ステップを順番に完了することで、完成度の高い作品を作成できます。',
    icon: <BookOpen className="h-12 w-12 text-purple-600 dark:text-purple-400" />,
    features: [
      '1. キャラクター設計',
      '2. プロット基本設定',
      '3. プロット構成詳細',
      '4. あらすじ作成',
      '5. 章立て',
      '6. 草案執筆',
    ],
  },
];

// フルオンボーディング用の詳細なステップ
const fullOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'AIと共創するストーリービルダーへようこそ',
    description: 'このアプリは、AIの力を借りて小説を創作するための支援ツールです。80%の面倒な作業はAIに任せて、20%の創造性に集中しましょう。',
    icon: <Sparkles className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />,
    features: [
      'AIによるキャラクター設計の支援',
      'プロット構造の自動生成',
      '草案執筆のAI支援',
      '完全オフライン対応（ローカルLLM使用時）',
    ],
  },
  {
    id: 'workflow',
    title: '6ステップの制作ワークフロー',
    description: '小説制作は6つのステップで進めます。各ステップを順番に完了することで、完成度の高い作品を作成できます。',
    icon: <BookOpen className="h-12 w-12 text-purple-600 dark:text-purple-400" />,
    features: [
      '1. キャラクター設計 - 登場人物の設定',
      '2. プロット基本設定 - 物語の基本構造',
      '3. プロット構成詳細 - 起承転結や3幕構成',
      '4. あらすじ作成 - 物語の概要',
      '5. 章立て - 各章の構成',
      '6. 草案執筆 - AI支援による執筆',
    ],
  },
  {
    id: 'ai-features',
    title: 'AI機能の活用',
    description: '各ステップでAIがあなたの創作をサポートします。設定したプロンプトに基づいて、AIが適切な提案を生成します。',
    icon: <PenTool className="h-12 w-12 text-green-600 dark:text-green-400" />,
    features: [
      'キャラクターの背景や性格を自動生成',
      'プロット構造の提案',
      'あらすじの自動生成',
      '章ごとの草案執筆支援',
      '文章の改善提案',
    ],
  },
  {
    id: 'shortcuts',
    title: 'キーボードショートカット',
    description: '効率的に作業するために、キーボードショートカットを活用しましょう。',
    icon: <Download className="h-12 w-12 text-orange-600 dark:text-orange-400" />,
    features: [
      'Ctrl+S / Cmd+S: 手動保存',
      'Ctrl+N / Cmd+N: 新規プロジェクト作成',
      'Ctrl+/ / Cmd+/: ショートカット一覧表示',
      'Ctrl+B / Cmd+B: サイドバーの折りたたみ',
      'Esc: モーダルを閉じる',
    ],
  },
];

export const Onboarding: React.FC<OnboardingProps> = ({ isOpen, onClose, onComplete, mode = 'quick' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose: () => {
      handleComplete();
    },
  });

  // モードに応じてステップを選択
  const onboardingSteps = mode === 'full' ? fullOnboardingSteps : quickOnboardingSteps;
  const isFirstTime = !localStorage.getItem('onboarding-completed');

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 200);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    // 初回のみ完了フラグを設定
    if (isFirstTime) {
      localStorage.setItem('onboarding-completed', 'true');
    }
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  const step = onboardingSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
            {isFirstTime ? (
              <Sparkles className="h-6 w-6 text-white" />
            ) : (
              <HelpCircle className="h-6 w-6 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              {isFirstTime ? 'はじめに' : 'ガイド'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              {mode === 'full' ? '詳細ガイド' : 'クイックガイド'} - ステップ {currentStep + 1} / {onboardingSteps.length}
            </p>
          </div>
        </div>
      }
      size="lg"
      ref={modalRef}
    >
      {/* 進捗バー */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        <div
          className={`transition-all duration-300 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'
            }`}
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">{step.icon}</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              {step.title}
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 font-['Noto_Sans_JP']">
              {step.description}
            </p>
          </div>

          {step.features && (
            <div className="space-y-3">
              {step.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-['Noto_Sans_JP'] ${isFirstStep
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>前へ</span>
          </button>

          <div className="flex items-center space-x-2">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${index === currentStep
                    ? 'bg-indigo-600 dark:bg-indigo-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
          >
            <span>{isLastStep ? '始める' : '次へ'}</span>
            {isLastStep ? (
              <ArrowRight className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {!isLastStep && (
          <div className="mt-4 text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-['Noto_Sans_JP']"
            >
              スキップして始める
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

