import React, { useState } from 'react';
import { Sparkles, Loader2, MoreVertical, ChevronDown, ChevronUp, Copy, Trash2, AlertCircle } from 'lucide-react';
import { PlotFormData } from '../types';
import { CHARACTER_LIMIT } from '../constants';
import { getCharacterCountColor, getProgressBarColor } from '../utils';
import { InlineAIFeedback } from '../../../common/InlineAIFeedback';

interface PlotStructureFieldProps {
  fieldKey: keyof PlotFormData;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  color: {
    bg: string;
    border: string;
    text: string;
    icon: string;
  };
  isCollapsed: boolean;
  isGenerating: boolean;
  formData: PlotFormData;
  onChange: (value: string) => void;
  onToggleCollapse: () => void;
  onAISupplement: () => void;
  onCopy: () => void;
  onClear: () => void;
  limit?: number;
}

export const PlotStructureField: React.FC<PlotStructureFieldProps> = ({
  fieldKey,
  label,
  description,
  placeholder,
  value,
  color,
  isCollapsed,
  isGenerating,
  onChange,
  onToggleCollapse,
  onAISupplement,
  onCopy,
  onClear,
  limit = CHARACTER_LIMIT,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const overLimit = value.length > limit;

  return (
    <div
      id={`section-${fieldKey}`}
      className={`bg-gradient-to-br ${color.bg} p-6 rounded-2xl border ${color.border}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className={`${color.icon} w-8 h-8 rounded-full flex items-center justify-center`}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${color.text} font-['Noto_Sans_JP']`}>
              {label}
            </h3>
            <p className={`text-sm ${color.text.replace('900', '700').replace('100', '300')} font-['Noto_Sans_JP']`}>
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* AI補完ボタン */}
          <button
            onClick={onAISupplement}
            disabled={isGenerating}
            className={`p-2.5 rounded-lg hover:bg-opacity-20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center`}
            title="AI補完"
          >
            {isGenerating ? (
              <Loader2 className={`h-5 w-5 ${color.text.replace('900', '700').replace('100', '300')} animate-spin`} />
            ) : (
              <Sparkles className={`h-5 w-5 ${color.text.replace('900', '700').replace('100', '300')}`} />
            )}
          </button>
          {/* その他のアクションメニュー */}
          <div className="relative">
            <button
              onClick={() => setOpenMenuId(openMenuId === fieldKey ? null : fieldKey)}
              className={`p-2.5 rounded-lg hover:bg-opacity-20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center`}
              title="その他のアクション"
            >
              <MoreVertical className={`h-5 w-5 ${color.text.replace('900', '700').replace('100', '300')}`} />
            </button>
            {openMenuId === fieldKey && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={() => {
                    onCopy();
                    setOpenMenuId(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  <span>コピー</span>
                </button>
                <button
                  onClick={() => {
                    onClear();
                    setOpenMenuId(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>クリア</span>
                </button>
              </div>
            )}
          </div>
          {/* 折りたたみボタン */}
          <button
            onClick={onToggleCollapse}
            className={`p-2.5 rounded-lg hover:bg-opacity-20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center`}
            title={isCollapsed ? '展開' : '折りたたみ'}
          >
            {isCollapsed ? (
              <ChevronDown className={`h-5 w-5 ${color.text.replace('900', '700').replace('100', '300')}`} />
            ) : (
              <ChevronUp className={`h-5 w-5 ${color.text.replace('900', '700').replace('100', '300')}`} />
            )}
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <div>
          {/* AI生成中のフィードバック */}
          {isGenerating && (
            <InlineAIFeedback
              message={`AIが「${label}」を生成中...`}
              variant="with-progress"
            />
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={8}
            className={`w-full px-4 py-3 rounded-lg border ${
              overLimit
                ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                : `${color.border} focus:ring-2`
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`}
          />
          <div className="mt-2 space-y-2">
            {/* 文字数超過警告 */}
            {overLimit && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium font-['Noto_Sans_JP']">
                  文字数が上限を{value.length - limit}文字超過しています
                </span>
              </div>
            )}
            {/* 文字数プログレスバー */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(value.length, limit)}`}
                style={{ width: `${Math.min((value.length / limit) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className={`text-xs ${color.text.replace('900', '600').replace('100', '400')} font-['Noto_Sans_JP']`}>
                {limit}文字以内で記述してください
              </p>
              <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(value.length, limit)}`}>
                {value.length}/{limit}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

