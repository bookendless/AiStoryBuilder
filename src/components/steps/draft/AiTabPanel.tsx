import React from 'react';
import { Sparkles } from 'lucide-react';
import type { AISuggestion, AISuggestionType, ImprovementLog } from './types';
import { SUGGESTION_CONFIG } from './constants';
import { formatTimestamp } from './utils';

interface ChapterInfo {
  id: string;
  title: string;
  summary?: string;
}

interface AiTabPanelProps {
  selectedChapterId: string | null;
  currentChapter: ChapterInfo | null;
  draft: string;
  aiSuggestions: AISuggestion[];
  lastSelectedText: string;
  wasSelectionTruncated: boolean;
  suggestionError: string | null;
  isGeneratingSuggestion: boolean;
  isGenerating: boolean;
  isFullDraftGenerating: boolean;
  isImproving: boolean;
  isSelfRefining: boolean;
  isContinueGenerating: boolean;
  isDescriptionGenerating: boolean;
  isStyleGenerating: boolean;
  isShortenGenerating: boolean;
  activeSuggestionType: AISuggestionType;
  improvementLogs: Record<string, ImprovementLog[]>;
  onOpenCustomPrompt: () => void;
  onGenerateFullDraft: () => void;
  onImproveChapter: () => void;
  onSelfRefine: () => void;
  onContinueGeneration: () => void;
  onDescriptionEnhancement: () => void;
  onStyleAdjustment: () => void;
  onShortenText: () => void;
  onGenerateSuggestions: (type: AISuggestionType) => void;
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onClearSelectionState: () => void;
  onOpenImprovementLogModal: () => void;
}

export const AiTabPanel: React.FC<AiTabPanelProps> = ({
  selectedChapterId,
  currentChapter,
  draft,
  aiSuggestions,
  lastSelectedText,
  wasSelectionTruncated,
  suggestionError,
  isGeneratingSuggestion,
  isGenerating,
  isFullDraftGenerating,
  isImproving,
  isSelfRefining,
  isContinueGenerating,
  isDescriptionGenerating,
  isStyleGenerating,
  isShortenGenerating,
  activeSuggestionType,
  improvementLogs,
  onOpenCustomPrompt,
  onGenerateFullDraft,
  onImproveChapter,
  onSelfRefine,
  onContinueGeneration,
  onDescriptionEnhancement,
  onStyleAdjustment,
  onShortenText,
  onGenerateSuggestions,
  onApplySuggestion,
  onClearSelectionState,
  onOpenImprovementLogModal,
}) => {
  if (!selectedChapterId || !currentChapter) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
        章を選択するとAIアシスト機能が利用できます。
      </div>
    );
  }

  const hasSelectionState = aiSuggestions.length > 0 || Boolean(lastSelectedText);
  const hasDraft = Boolean(draft.trim());
  const chapterLogs = improvementLogs[selectedChapterId] || [];

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">章全体の生成</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              選択中の章をベースに長文ドラフトを生成します。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCustomPrompt}
            className="px-3 py-1.5 rounded-lg border border-purple-300 text-sm text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 font-['Noto_Sans_JP'] transition-colors"
          >
            カスタムプロンプト
          </button>
        </div>
        <button
          type="button"
          onClick={onGenerateFullDraft}
          disabled={isGenerating || !selectedChapterId}
          aria-busy={isFullDraftGenerating}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold font-['Noto_Sans_JP'] transition-all ${
            isFullDraftGenerating
              ? 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200 shadow-inner'
              : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-sm'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Sparkles
            className={`h-4 w-4 ${isFullDraftGenerating ? 'animate-spin text-emerald-600 dark:text-emerald-300' : 'text-white'}`}
          />
          <span>{isFullDraftGenerating ? 'AIが執筆中…' : 'AI章執筆を実行'}</span>
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">章全体の改善</h4>
        <button
          type="button"
          onClick={onImproveChapter}
          disabled={isGenerating || !hasDraft}
          aria-busy={isImproving}
          className="w-full p-3 text-left bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex flex-col">
            <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
              章全体改善
              <Sparkles className={`h-3 w-3 ${isImproving ? 'text-indigo-500 animate-spin' : 'text-indigo-500/70'}`} />
            </div>
            <div
              className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                isImproving ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {isImproving ? 'AIが描写と文体を総合的に改善しています…' : '描写強化＋文体調整を同時に実行'}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onSelfRefine}
          disabled={isGenerating || !hasDraft}
          aria-busy={isSelfRefining}
          className="w-full p-3 text-left bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex flex-col">
            <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
              弱点特定と修正ループ
              <Sparkles className={`h-3 w-3 ${isSelfRefining ? 'text-amber-500 animate-spin' : 'text-amber-500/70'}`} />
            </div>
            <div
              className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                isSelfRefining ? 'text-amber-600 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {isSelfRefining ? 'AIが弱点を特定し、改善しています…' : '批評→改訂の2段階で改善'}
            </div>
          </div>
        </button>

        {chapterLogs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                改善ログ ({chapterLogs.length}件)
              </h5>
              <button
                type="button"
                onClick={onOpenImprovementLogModal}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-['Noto_Sans_JP'] underline"
              >
                詳細を表示
              </button>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              最新: {formatTimestamp(chapterLogs[0].timestamp)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ActionButton
            title="続きを生成"
            description={isContinueGenerating ? 'AIが文章の続きを生成しています…' : '文章の続きを提案'}
            isBusy={isContinueGenerating}
            disabled={isGenerating || !hasDraft}
            onClick={onContinueGeneration}
          />
          <ActionButton
            title="描写強化"
            description={isDescriptionGenerating ? 'AIが描写を細部まで磨いています…' : '情景を詳しく'}
            isBusy={isDescriptionGenerating}
            disabled={isGenerating || !hasDraft}
            onClick={onDescriptionEnhancement}
          />
          <ActionButton
            title="文体調整"
            description={isStyleGenerating ? 'AIが文体を整えています…' : '読みやすく'}
            isBusy={isStyleGenerating}
            disabled={isGenerating || !hasDraft}
            onClick={onStyleAdjustment}
          />
          <ActionButton
            title="文章短縮"
            description={isShortenGenerating ? 'AIが文章を凝縮しています…' : '簡潔にまとめる'}
            isBusy={isShortenGenerating}
            disabled={isGenerating || !hasDraft}
            onClick={onShortenText}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">テキスト選択ツール</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              選択した文章に対する改善提案を受け取ります。
            </p>
          </div>
          {hasSelectionState && (
            <button
              type="button"
              onClick={onClearSelectionState}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-['Noto_Sans_JP']"
            >
              クリア
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {(['rewrite', 'tone', 'summary'] as AISuggestionType[]).map((type) => {
            const config = SUGGESTION_CONFIG[type];
            const isActive = activeSuggestionType === type && isGeneratingSuggestion;
            const descriptionText = isActive ? 'AIが提案を生成しています…' : config.description;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onGenerateSuggestions(type)}
                disabled={isGeneratingSuggestion || isGenerating || !selectedChapterId}
                aria-busy={isActive}
                className="w-full p-2.5 text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP']">{config.label}</div>
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">{descriptionText}</div>
                  </div>
                  <Sparkles className={`h-3.5 w-3.5 text-purple-500 ${isActive ? 'animate-spin' : 'opacity-60'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {suggestionError && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-2.5 font-['Noto_Sans_JP']">
            {suggestionError}
          </div>
        )}

        {lastSelectedText && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">対象テキスト</div>
            <div className="text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 max-h-24 overflow-y-auto whitespace-pre-wrap font-['Noto_Sans_JP']">
              {lastSelectedText.length > 150 ? `${lastSelectedText.slice(0, 150)}…` : lastSelectedText}
            </div>
            {wasSelectionTruncated && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">⚠️ 選択範囲が長いため先頭のみを使用</div>
            )}
          </div>
        )}

        {isGeneratingSuggestion && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP'] p-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-spin" />
            提案を生成中...
          </div>
        )}

        {aiSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h5 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">{suggestion.title}</h5>
              <button
                type="button"
                onClick={() => onApplySuggestion(suggestion)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors font-['Noto_Sans_JP'] flex-shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                適用
              </button>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed">
              {suggestion.body}
            </div>
          </div>
        ))}

        {!isGeneratingSuggestion && aiSuggestions.length === 0 && !lastSelectedText && (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-2">
            テキストを選択してボタンを押すと提案を表示します。
          </div>
        )}
      </div>
    </div>
  );
};

interface ActionButtonProps {
  title: string;
  description: string;
  isBusy: boolean;
  disabled: boolean;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, description, isBusy, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={isBusy}
    className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <div className="flex flex-col">
      <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
        {title}
        <Sparkles className={`h-3 w-3 ${isBusy ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`} />
      </div>
      <div
        className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
          isBusy ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {description}
      </div>
    </div>
  </button>
);


