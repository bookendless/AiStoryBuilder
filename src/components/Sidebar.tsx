import React, { useState, useRef, useEffect } from 'react';
import { Users, BookOpen, FileText, List, PenTool, Download, Check, Layers, ChevronLeft, ChevronRight, ArrowRight, Sparkles, Search } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { useBreakpoint } from '../hooks/useMediaQuery';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

// ステップボタンコンポーネント（メモ化）
interface StepButtonProps {
  step: { key: Step; label: string; icon: React.ComponentType<{ className?: string }>; color: string };
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const StepButton = React.memo<StepButtonProps>(({ step, index, isActive, isCompleted, isCollapsed, onClick }) => {
  const Icon = step.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center rounded-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isCollapsed
        ? 'justify-center px-2 py-3'
        : 'space-x-3 px-4 py-3 text-left'
        } ${isActive
          ? `${step.color} text-white shadow-lg shadow-indigo-500/20 transform scale-105 ring-1 ring-white/20`
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 hover:backdrop-blur-sm'
        }`}
      role="listitem"
      aria-current={isActive ? 'step' : undefined}
      aria-label={`ステップ${index + 1}: ${step.label}`}
      aria-describedby={`step-${step.key}-description`}
      title={isCollapsed ? step.label : undefined}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${isActive
        ? 'bg-white/20'
        : step.color
        }`}>
        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-white'}`} aria-hidden="true" />
      </div>

      {!isCollapsed && (
        <>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium font-['Noto_Sans_JP']">{step.label}</span>
              <div className="flex items-center space-x-2">
                <span
                  className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded-full flex items-center justify-center"
                  aria-label={isCompleted ? '完了済み' : `ステップ${index + 1}`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3 text-semantic-success" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
              </div>
            </div>
          </div>

          <span id={`step-${step.key}-description`} className="sr-only">
            {isActive ? '現在のステップ' : isCompleted ? '完了済み' : '未完了'} - {step.label}
          </span>
        </>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数：ステップの状態が変更された場合のみ再レンダリング
  return (
    prevProps.step.key === nextProps.step.key &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isCompleted === nextProps.isCompleted &&
    prevProps.isCollapsed === nextProps.isCollapsed
  );
});

StepButton.displayName = 'StepButton';

interface SidebarProps {
  currentStep: Step;
  onStepChange: (step: Step) => void;
  className?: string;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const stepGroups = [
  {
    title: '構想',
    items: [
      { key: 'plot1' as Step, label: '物語の種', icon: BookOpen, color: 'bg-gradient-to-r from-purple-400 to-purple-600' },
      { key: 'character' as Step, label: 'キャラクター', icon: Users, color: 'bg-gradient-to-r from-pink-400 to-rose-500' },
      { key: 'plot2' as Step, label: '構成', icon: Layers, color: 'bg-gradient-to-r from-purple-500 to-indigo-500' },
    ]
  },
  {
    title: '執筆',
    items: [
      { key: 'synopsis' as Step, label: 'あらすじ', icon: FileText, color: 'bg-gradient-to-r from-indigo-400 to-blue-500' },
      { key: 'chapter' as Step, label: '章立て', icon: List, color: 'bg-gradient-to-r from-blue-400 to-cyan-500' },
      { key: 'draft' as Step, label: '執筆', icon: PenTool, color: 'bg-gradient-to-r from-green-400 to-emerald-500' },
    ]
  },
  {
    title: '仕上げ',
    items: [
      { key: 'review' as Step, label: '分析', icon: Search, color: 'bg-gradient-to-r from-teal-400 to-teal-600' },
      { key: 'export' as Step, label: 'エクスポート', icon: Download, color: 'bg-gradient-to-r from-orange-400 to-amber-500' },
    ]
  }
];

// フラットなステップリスト（後方互換性と検索用）
const allSteps = stepGroups.flatMap(group => group.items);

export const Sidebar: React.FC<SidebarProps> = ({ currentStep, onStepChange, className, isCollapsed: externalIsCollapsed, onCollapseChange }) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const { currentProject, getStepCompletion, calculateProjectProgress } = useProject();
  const breakpoint = useBreakpoint();
  const sidebarRef = useRef<HTMLElement>(null);

  // 外部から状態が渡されている場合はそれを使用、そうでなければ内部状態を使用
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  // 次の未完了ステップを取得
  const projectProgress = currentProject ? calculateProjectProgress(currentProject) : null;
  const nextIncompleteStep = projectProgress?.steps.find(s => !s.completed);
  const nextStepInfo = nextIncompleteStep ? allSteps.find(s => s.key === nextIncompleteStep.step) : null;

  // 現在のステップが完了しているかどうか
  const isCurrentStepCompleted = getStepCompletion(currentProject, currentStep);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    if (externalIsCollapsed === undefined) {
      setInternalIsCollapsed(newState);
    }
    onCollapseChange?.(newState);
  };

  // モバイルでのスワイプジェスチャー
  useSwipeGesture(sidebarRef, {
    onSwipeLeft: () => {
      if (breakpoint === 'mobile' && !isCollapsed) {
        handleToggleCollapse();
      }
    },
  });

  // モバイルでサイドバーが開いているときはスクロールを無効化
  useEffect(() => {
    if (breakpoint === 'mobile' && !isCollapsed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [breakpoint, isCollapsed]);

  return (
    <>
      {/* モバイル/タブレット用バックドロップ */}
      {breakpoint !== 'desktop' && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={handleToggleCollapse}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full glass border-r transition-all duration-300 z-40 ${className
          } ${breakpoint !== 'desktop'
            ? isCollapsed
              ? '-translate-x-full w-64'
              : 'translate-x-0 w-64'
            : isCollapsed
              ? 'w-16'
              : 'w-64'
          }`}
        role="navigation"
        aria-label="制作ワークフローナビゲーション"
      >
        <div className="h-full flex flex-col">
          <div className={`p-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'
            }`}>
            {!isCollapsed && (
              <h2 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                制作ワークフロー
              </h2>
            )}
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6" role="list" aria-label="制作ステップ">
            {stepGroups.map((group) => (
              <div key={group.title} className={isCollapsed ? 'space-y-2' : ''}>
                {!isCollapsed && (
                  <div className="px-2 mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] uppercase tracking-wider">
                      {group.title}
                    </h3>
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((step) => {
                    const isActive = currentStep === step.key;
                    const isCompleted = getStepCompletion(currentProject, step.key);
                    // グループ内のインデックスではなく、全ステップを通したインデックスが必要な場合は計算が必要だが、
                    // ここでは表示用にグループ内での順序や、単に視覚的なステップとして扱う

                    return (
                      <StepButton
                        key={step.key}
                        step={step}
                        index={allSteps.findIndex(s => s.key === step.key)}
                        isActive={isActive}
                        isCompleted={isCompleted}
                        isCollapsed={isCollapsed}
                        onClick={() => onStepChange(step.key)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* 次のステップへの案内 */}
          {!isCollapsed && nextStepInfo && isCurrentStepCompleted && currentStep !== nextStepInfo.key && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center space-x-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-['Noto_Sans_JP']">
                    次のステップ
                  </span>
                </div>
                <button
                  onClick={() => onStepChange(nextStepInfo.key)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <nextStepInfo.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {nextStepInfo.label}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* フッター情報 */}
          {!isCollapsed && currentProject && (
            <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                <p className="font-semibold mb-1">プロジェクト</p>
                <p className="truncate" title={currentProject.title}>
                  {currentProject.title}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
