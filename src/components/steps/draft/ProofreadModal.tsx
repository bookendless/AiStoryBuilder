import React, { useState, useMemo, useEffect } from 'react';
import { SpellCheck, Sparkles, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useAI } from '../../../contexts/AIContext';
import { useToast } from '../../Toast';
import { aiService } from '../../../services/aiService';
import { parseAIResponse } from '../../../utils/aiResponseParser';
import { proofreadText, PROOFREAD_TYPE_LABELS, applyCorrections } from '../../../utils/proofreadUtils';
import {
  PROOFREAD_PROMPTS,
  extractCorrections,
  ProofreadCorrection,
} from '../../../services/prompts/proofread';

interface ProofreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: string;
  onApply: (newText: string) => void;
}

interface CorrectionItem extends ProofreadCorrection {
  id: number;
  selected: boolean;
  applicable: boolean;
}

/**
 * 校正モーダル。
 * 記法チェック（正規表現・即時）とAI校正（誤字脱字・表記ゆれの修正候補）の
 * 2段構成。AI修正候補は選択して部分適用できる。
 */
export const ProofreadModal: React.FC<ProofreadModalProps> = ({
  isOpen,
  onClose,
  draft,
  onApply,
}) => {
  const { settings, isConfigured } = useAI();
  const { showSuccess, showError } = useToast();

  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // モーダルを開き直したらAI結果をリセット
  useEffect(() => {
    if (isOpen) {
      setCorrections([]);
      setAiError(null);
      setHasRun(false);
    }
  }, [isOpen]);

  // 機械チェック（即時・無料）
  const mechanicalIssues = useMemo(
    () => (isOpen ? proofreadText(draft) : []),
    [isOpen, draft]
  );

  const handleRunAI = async () => {
    if (!draft.trim() || isRunning) return;

    setIsRunning(true);
    setAiError(null);
    try {
      // split/join を使う（String.replace は draft 内の $&,$1 等を特殊置換として解釈しプロンプトを壊すため）
      const prompt = PROOFREAD_PROMPTS.proofread.split('{text}').join(draft);
      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        maxPromptLength: 30000,
      });

      if (response.error) {
        setAiError(response.error);
        return;
      }

      const parsed = parseAIResponse(response.content, 'json');
      const extracted = extractCorrections(parsed.data);
      setCorrections(
        extracted.map((correction, index) => ({
          ...correction,
          id: index,
          selected: draft.includes(correction.before),
          applicable: draft.includes(correction.before),
        }))
      );
      setHasRun(true);
    } catch (error) {
      console.error('AI校正に失敗しました:', error);
      setAiError(error instanceof Error ? error.message : 'AI校正に失敗しました');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleCorrection = (id: number) => {
    setCorrections(prev =>
      prev.map(item =>
        item.id === id && item.applicable ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const selectedCount = corrections.filter(item => item.selected).length;

  const handleApply = () => {
    if (selectedCount === 0) return;

    const { newText, applied } = applyCorrections(
      draft,
      corrections.filter(item => item.selected)
    );

    if (applied > 0) {
      onApply(newText);
      showSuccess(`${applied}件の修正を適用しました`);
      onClose();
    } else {
      showError('適用できる修正がありませんでした（本文が変更された可能性があります）');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <SpellCheck className="h-5 w-5 text-ai-600 dark:text-ai-400" />
          校正チェック
        </span>
      }
      size="lg"
    >
      <div className="space-y-6">
        {/* 記法チェック（機械） */}
        <section>
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
            記法チェック（自動）
          </h3>
          {mechanicalIssues.length > 0 ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
              {mechanicalIssues.map((issue, index) => (
                <div key={index} className="px-3 py-2 flex items-start gap-2">
                  <span
                    className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 font-['Noto_Sans_JP'] ${
                      issue.severity === 'warning'
                        ? 'bg-yamabuki-100 text-yamabuki-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {PROOFREAD_TYPE_LABELS[issue.type]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                      {issue.line}行目: {issue.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-['Noto_Sans_JP']">
                      {issue.excerpt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-['Noto_Sans_JP']">
              <CheckCircle2 className="h-4 w-4" />
              記法上の問題は見つかりませんでした
            </p>
          )}
        </section>

        {/* AI校正 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
              AI校正（誤字脱字・表記ゆれ）
            </h3>
            <button
              type="button"
              onClick={handleRunAI}
              disabled={!isConfigured || !draft.trim() || isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-['Noto_Sans_JP']"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isRunning ? '校正中…' : hasRun ? '再実行' : 'AI校正を実行'}
            </button>
          </div>

          {!isConfigured && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              AI校正を使うには設定画面でAIプロバイダーを設定してください（記法チェックはAIなしで利用できます）。
            </p>
          )}

          {aiError && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 font-['Noto_Sans_JP']">{aiError}</p>
            </div>
          )}

          {hasRun && corrections.length === 0 && !aiError && (
            <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-['Noto_Sans_JP']">
              <CheckCircle2 className="h-4 w-4" />
              修正候補は見つかりませんでした
            </p>
          )}

          {corrections.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
              {corrections.map(item => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                    item.applicable
                      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      : 'opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    disabled={!item.applicable}
                    onChange={() => toggleCorrection(item.id)}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-ai-600 focus:ring-ai-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm font-['Noto_Sans_JP']">
                      <span className="text-red-600 dark:text-red-400 line-through break-all">
                        {item.before}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-green-700 dark:text-green-400 break-all">
                        {item.after || '（削除）'}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-['Noto_Sans_JP']">
                        {item.reason}
                      </p>
                    )}
                    {!item.applicable && (
                      <p className="text-xs text-yamabuki-600 dark:text-yellow-500 mt-0.5 font-['Noto_Sans_JP']">
                        本文中に該当箇所が見つからないため適用できません
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* フッター */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-['Noto_Sans_JP']"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ai-600 text-white hover:bg-ai-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-['Noto_Sans_JP']"
          >
            <SpellCheck className="h-4 w-4" />
            {selectedCount > 0 ? `${selectedCount}件の修正を適用` : '修正を適用'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
