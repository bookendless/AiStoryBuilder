import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, Flame, Target, PenLine, Loader2, Check, Coins } from 'lucide-react';
import { Modal } from './common/Modal';
import { useProject } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import {
  getDailySamples,
  getWritingGoal,
  saveWritingGoal,
} from '../services/writingStatsService';
import {
  getMonthlySummary,
  getAvailableMonths,
  currentMonthKey,
  UsageSummary,
} from '../services/aiCostService';
import { formatUsd } from '../utils/aiPricingUtils';
import {
  computeDailyDeltas,
  computeStreak,
  sumWritten,
  computeTotalDraftChars,
  toDateKey,
  DailyDelta,
} from '../utils/writingStatsUtils';

interface WritingDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHART_DAYS = 14;

/** 'YYYY-MM-DD' を 'M/D' の短縮表記に */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${m}/${d}`;
}

export const WritingDashboardModal: React.FC<WritingDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deltas, setDeltas] = useState<DailyDelta[] | null>(null);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // AIコスト
  const [costSummary, setCostSummary] = useState<UsageSummary | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());

  const load = useCallback(async () => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const [samples, goal] = await Promise.all([
        getDailySamples(currentProject.id),
        getWritingGoal(currentProject.id),
      ]);

      // 今日のサンプルが未記録でも、現在の総文字数で補完してリアルタイム表示する
      const todayKey = toDateKey(new Date());
      const totalNow = computeTotalDraftChars(currentProject.chapters, currentProject.draft);
      const merged = samples.some(s => s.date === todayKey)
        ? samples.map(s => (s.date === todayKey ? { ...s, totalChars: totalNow } : s))
        : [...samples, { date: todayKey, totalChars: totalNow }];

      setDeltas(computeDailyDeltas(merged, CHART_DAYS));
      setDailyGoal(goal.dailyGoal);
      setGoalInput(goal.dailyGoal > 0 ? String(goal.dailyGoal) : '');

      // AIコスト（全プロジェクト共通で集計）
      const available = await getAvailableMonths();
      const monthList = available.includes(currentMonthKey())
        ? available
        : [currentMonthKey(), ...available];
      setMonths(monthList);
    } catch (error) {
      console.error('執筆記録の読み込みに失敗しました:', error);
      showError('執筆記録の読み込みに失敗しました');
      // 失敗しても null のままだとスピナーが固着するため空配列で確定させる
      setDeltas(prev => prev ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, showError]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  // 選択月のAIコストサマリーを読み込む
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void getMonthlySummary(selectedMonth)
      .then(summary => {
        if (!cancelled) setCostSummary(summary);
      })
      .catch(error => {
        console.error('AIコストサマリーの読み込みに失敗しました:', error);
        if (!cancelled) setCostSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedMonth]);

  const todayWritten = useMemo(() => {
    if (!deltas || deltas.length === 0) return 0;
    return deltas[deltas.length - 1].delta;
  }, [deltas]);

  const streak = useMemo(() => (deltas ? computeStreak(deltas) : 0), [deltas]);
  const weekWritten = useMemo(() => (deltas ? sumWritten(deltas.slice(-7)) : 0), [deltas]);
  const periodWritten = useMemo(() => (deltas ? sumWritten(deltas) : 0), [deltas]);

  const chartData = useMemo(
    () =>
      (deltas ?? []).map(d => ({
        date: shortDate(d.date),
        written: Math.max(0, d.delta),
      })),
    [deltas]
  );

  const goalRate = dailyGoal > 0 ? Math.min(100, Math.round((todayWritten / dailyGoal) * 100)) : 0;

  const handleSaveGoal = async () => {
    if (!currentProject) return;
    const value = Math.max(0, parseInt(goalInput, 10) || 0);
    try {
      await saveWritingGoal({
        projectId: currentProject.id,
        dailyGoal: value,
        targetChapters: 0,
      });
    } catch (error) {
      console.error('目標の保存に失敗しました:', error);
      showError('目標の保存に失敗しました');
      return;
    }
    setDailyGoal(value);
    setSavedFlash(true);
    showSuccess(value > 0 ? `1日の目標を${value.toLocaleString()}文字に設定しました` : '目標を解除しました');
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  };

  // アンマウント時にフラッシュ用タイマーを破棄する
  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  // 章ごとの進捗（草案文字数）
  const chapterProgress = useMemo(() => {
    if (!currentProject) return [];
    const max = Math.max(1, ...currentProject.chapters.map(c => c.draft?.length ?? 0));
    return currentProject.chapters.map((c, i) => ({
      id: c.id,
      label: `第${i + 1}章 ${c.title || '無題'}`,
      chars: c.draft?.length ?? 0,
      ratio: (c.draft?.length ?? 0) / max,
    }));
  }, [currentProject]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-ai-600 dark:text-ai-400" />
          執筆ダッシュボード
        </span>
      }
      size="lg"
    >
      {isLoading || !deltas ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
          <Loader2 className="h-5 w-5 animate-spin" />
          読み込み中…
        </div>
      ) : (
        <div className="space-y-6">
          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                <PenLine className="h-4 w-4" />
                <span className="text-xs font-['Noto_Sans_JP']">今日</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {todayWritten.toLocaleString()}
                <span className="text-xs font-normal text-gray-500 ml-1">文字</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
              <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 mb-1">
                <Flame className="h-4 w-4" />
                <span className="text-xs font-['Noto_Sans_JP']">連続執筆</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {streak}
                <span className="text-xs font-normal text-gray-500 ml-1">日</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-['Noto_Sans_JP']">直近7日</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {weekWritten.toLocaleString()}
                <span className="text-xs font-normal text-gray-500 ml-1">文字</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-['Noto_Sans_JP']">直近{CHART_DAYS}日</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {periodWritten.toLocaleString()}
                <span className="text-xs font-normal text-gray-500 ml-1">文字</span>
              </div>
            </div>
          </div>

          {/* 日次執筆量チャート */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
              日次執筆量（直近{CHART_DAYS}日）
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()}文字`, '執筆量']}
                    labelStyle={{ fontFamily: 'Noto Sans JP' }}
                  />
                  <Bar dataKey="written" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={dailyGoal > 0 && entry.written >= dailyGoal ? '#16a34a' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 目標設定 */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-ai-600 dark:text-ai-400" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                1日の執筆目標
              </h3>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min="0"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="例: 1000"
                className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ai-500 font-['Noto_Sans_JP']"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">文字 / 日</span>
              <button
                type="button"
                onClick={handleSaveGoal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ai-600 text-white text-sm hover:bg-ai-700 transition-colors font-['Noto_Sans_JP']"
              >
                {savedFlash ? <Check className="h-4 w-4" /> : null}
                設定
              </button>
            </div>
            {dailyGoal > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1 font-['Noto_Sans_JP']">
                  <span>今日の達成度</span>
                  <span>{todayWritten.toLocaleString()} / {dailyGoal.toLocaleString()}文字（{goalRate}%）</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${goalRate >= 100 ? 'bg-green-500' : 'bg-ai-500'}`}
                    style={{ width: `${goalRate}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 章ごとの進捗 */}
          {chapterProgress.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
                章ごとの草案文字数
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {chapterProgress.map(chapter => (
                  <div key={chapter.id} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 text-xs text-gray-700 dark:text-gray-300 truncate font-['Noto_Sans_JP']">
                      {chapter.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.round(chapter.ratio * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {chapter.chars.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI利用コスト */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                  AI利用コスト（概算）
                </h3>
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-ai-500 font-['Noto_Sans_JP']"
              >
                {months.map(month => (
                  <option key={month} value={month}>{month.replace('-', '年')}月</option>
                ))}
              </select>
            </div>

            {!costSummary || costSummary.rows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-3 font-['Noto_Sans_JP']">
                この月のAI利用記録はありません。
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">概算合計</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {formatUsd(costSummary.totalCost)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">呼び出し</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {costSummary.totalCalls.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">総トークン</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {costSummary.totalTokens.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs font-['Noto_Sans_JP']">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-left">
                        <th className="px-3 py-2 font-medium">モデル</th>
                        <th className="px-3 py-2 font-medium text-right">回数</th>
                        <th className="px-3 py-2 font-medium text-right">トークン</th>
                        <th className="px-3 py-2 font-medium text-right">概算</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {costSummary.rows.map(row => (
                        <tr key={`${row.provider}:${row.model}`} className="text-gray-800 dark:text-gray-200">
                          <td className="px-3 py-2">
                            <span className="text-gray-500 dark:text-gray-400">{row.provider}</span> {row.model}
                          </td>
                          <td className="px-3 py-2 text-right">{row.calls.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{row.totalTokens.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatUsd(row.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-['Noto_Sans_JP']">
              ※ 単価は目安です。実際の請求額はプロバイダーの料金体系・為替により異なります。ローカルLLMは無料（$0）です。
            </p>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 font-['Noto_Sans_JP']">
            ※ 執筆量はプロジェクトの保存時に記録されます。導入直後はデータが少なく表示されます。
          </p>
        </div>
      )}
    </Modal>
  );
};
