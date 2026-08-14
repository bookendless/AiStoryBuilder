import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Copy, RefreshCw } from 'lucide-react';
import { useProject } from '../../contexts/useProject';
import { useToast } from '../useToast';
import { getProjectTally } from '../../services/aiUsageTallyService';
import { buildDisclosureSummary, DisclosureSummary } from '../../services/disclosure/buildDisclosureSummary';

/**
 * AI利用状況の開示パネル。
 *
 * 小説家になろう・カクヨムが作品ごとに求めるAI利用区分の申告を書くための材料として、
 * 記録済みのAI呼び出しを工程別に表示する。区分は断定せず候補として示す
 * （生成結果を本文へ採用したかどうかはアプリ側では分からないため）。
 */
export const AIUsageDisclosurePanel: React.FC = () => {
  const { currentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const [summary, setSummary] = useState<DisclosureSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const projectId = currentProject?.id;

  const load = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const entries = await getProjectTally(projectId);
      setSummary(buildDisclosureSummary(entries));
    } catch (error) {
      console.error('AI利用記録の読み込みに失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.text);
      showSuccess('AI利用状況をコピーしました');
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
      showError('クリップボードへのコピーに失敗しました');
    }
  };

  if (!currentProject) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6 mt-4 lg:mt-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-sky-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            AI利用状況
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 font-['Noto_Sans_JP']"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
        投稿サイトのAI利用区分を申告するための材料です。記録できるのはAIを呼び出した回数までで、生成結果を本文に採用したかどうかまでは分かりません。最終的な区分はご自身でご判断ください。
      </p>

      {summary?.isEmpty !== false ? (
        <p className="text-sm text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP'] py-2 leading-relaxed">
          この作品でのAI利用は記録されていません。ただしここに出るのは記録に対応した機能の利用だけで、記録が始まる前の利用、アプリ外での利用、まだ記録に対応していない機能（用語集・相関図・伏線・チャットなど）の利用は含まれません。「AI不使用」として申告してよいかは、ご自身でご確認ください。
        </p>
      ) : (
        <>
          <div className="space-y-1.5 mb-4">
            {summary.rows.map(row => (
              <div
                key={row.purpose}
                className="flex items-center justify-between text-sm font-['Noto_Sans_JP'] border-b border-gray-100 dark:border-gray-700 pb-1.5"
              >
                <span className="text-gray-700 dark:text-gray-200">{row.label}</span>
                <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                  {row.count}回{row.chapterCount > 0 ? `（${row.chapterCount}章分）` : ''}
                </span>
              </div>
            ))}
          </div>

          <div
            className={`rounded-lg p-3 mb-4 text-xs font-['Noto_Sans_JP'] leading-relaxed ${
              summary.hasProseUsage
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                : 'bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800'
            }`}
          >
            {summary.hasProseUsage ? (
              <>
                本文の生成・書き換えにAIを使った記録があります。なろうは「AI直接使用」または「AI間接利用」、カクヨムは「AI本文利用」または「AI本文一部利用」が候補です。どちらに当たるかは、生成された文章をそのまま使ったか、書き直したかによって変わります。
              </>
            ) : (
              <>
                本文の生成・書き換えにAIを使った記録はありません。アイデア出し・資料調査・校正のみであれば、なろうは「AI補助的利用」、カクヨムは「AI補助利用」が候補です。
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
          >
            <Copy className="h-4 w-4" />
            記録をコピー
          </button>
        </>
      )}
    </div>
  );
};
