import React from 'react';
import { Users, BookOpen, FileText, List, Film, PenTool, Download, Check } from 'lucide-react';
import { Step } from '../App';

interface SidebarProps {
  currentStep: Step;
  onStepChange: (step: Step) => void;
  className?: string;
}

const steps = [
  { key: 'character' as Step, label: 'キャラクター', icon: Users, color: 'bg-pink-500' },
  { key: 'plot1' as Step, label: 'プロット基本設定', icon: BookOpen, color: 'bg-purple-500' },
  { key: 'plot2' as Step, label: 'プロット構成詳細', icon: BookOpen, color: 'bg-purple-900' },
  { key: 'synopsis' as Step, label: 'あらすじ', icon: FileText, color: 'bg-indigo-500' },
  { key: 'chapter' as Step, label: '章立て', icon: List, color: 'bg-blue-500' },
  { key: 'draft' as Step, label: '草案', icon: PenTool, color: 'bg-green-500' },
  { key: 'export' as Step, label: 'エクスポート', icon: Download, color: 'bg-orange-500' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentStep, onStepChange, className }) => {
  return (
    <aside className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-10 ${className}`}>
      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 font-['Noto_Sans_JP']">
          制作ワークフロー
        </h2>
        
        <nav className="space-y-2">
          {steps.map((step, index) => {
            const isActive = currentStep === step.key;
            const isCompleted = false; // TODO: プロジェクト進捗から取得
            const Icon = step.icon;
            
            return (
              <button
                key={step.key}
                onClick={() => onStepChange(step.key)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-left group ${
                  isActive
                    ? `${step.color} text-white shadow-md transform scale-105`
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isActive 
                    ? 'bg-white/20' 
                    : isCompleted 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : step.color
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-white'}`} />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium font-['Noto_Sans_JP']">{step.label}</span>
                    <span className="text-xs bg-black/10 px-2 py-1 rounded-full">
                      {index + 1}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};