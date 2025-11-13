import React, { useState } from 'react';
import { Users, BookOpen, FileText, List, PenTool, Download, Check, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { Step } from '../App';

interface SidebarProps {
  currentStep: Step;
  onStepChange: (step: Step) => void;
  className?: string;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const steps = [
  { key: 'character' as Step, label: 'キャラクター', icon: Users, color: 'bg-gradient-to-r from-pink-400 to-rose-500' },
  { key: 'plot1' as Step, label: 'プロット基本設定', icon: BookOpen, color: 'bg-gradient-to-r from-purple-400 to-purple-600' },
  { key: 'plot2' as Step, label: 'プロット構成詳細', icon: Layers, color: 'bg-gradient-to-r from-purple-500 to-indigo-500' },
  { key: 'synopsis' as Step, label: 'あらすじ', icon: FileText, color: 'bg-gradient-to-r from-indigo-400 to-blue-500' },
  { key: 'chapter' as Step, label: '章立て', icon: List, color: 'bg-gradient-to-r from-blue-400 to-cyan-500' },
  { key: 'draft' as Step, label: '草案', icon: PenTool, color: 'bg-gradient-to-r from-green-400 to-emerald-500' },
  { key: 'export' as Step, label: 'エクスポート', icon: Download, color: 'bg-gradient-to-r from-orange-400 to-amber-500' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentStep, onStepChange, className, isCollapsed: externalIsCollapsed, onCollapseChange }) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  
  // 外部から状態が渡されている場合はそれを使用、そうでなければ内部状態を使用
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    if (externalIsCollapsed === undefined) {
      setInternalIsCollapsed(newState);
    }
    onCollapseChange?.(newState);
  };

  return (
    <aside 
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-10 ${className} ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      role="navigation"
      aria-label="制作ワークフローナビゲーション"
    >
      <div className="h-full flex flex-col">
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
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
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2" role="list" aria-label="制作ステップ">
          {steps.map((step, index) => {
            const isActive = currentStep === step.key;
            const isCompleted = false; // TODO: プロジェクト進捗から取得
            const Icon = step.icon;
            
            return (
              <button
                key={step.key}
                onClick={() => onStepChange(step.key)}
                className={`w-full flex items-center rounded-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isCollapsed 
                    ? 'justify-center px-2 py-3' 
                    : 'space-x-3 px-4 py-3 text-left'
                } ${
                  isActive
                    ? `${step.color} text-white shadow-md transform scale-105`
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                role="listitem"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`ステップ${index + 1}: ${step.label}`}
                aria-describedby={`step-${step.key}-description`}
                title={isCollapsed ? step.label : undefined}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                  isActive 
                    ? 'bg-white/20' 
                    : isCompleted 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : step.color
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-white'}`} aria-hidden="true" />
                  )}
                </div>
                
                {!isCollapsed && (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium font-['Noto_Sans_JP']">{step.label}</span>
                        <span 
                          className="text-xs bg-black/10 px-2 py-1 rounded-full"
                          aria-label={`ステップ${index + 1}`}
                        >
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    
                    <span id={`step-${step.key}-description`} className="sr-only">
                      {isActive ? '現在のステップ' : isCompleted ? '完了済み' : '未完了'} - {step.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
