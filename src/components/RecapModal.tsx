import React from 'react';
import { BookOpen, Sparkles, MapPin, Link2, Lightbulb, Play, Loader2, RefreshCw, EyeOff } from 'lucide-react';
import { Modal } from './common/Modal';
import { Project } from '../types/project';
import { RecapAIContent, RecapAIState } from '../types/recap';
import { computeResumePoint, getOpenForeshadowings } from '../services/recap/recapLocal';

/**
 * RecapModal - 「前回までのあらすじ」モーダル
 *
 * しばらくぶりにプロジェクトを開いた作者に、連載アニメ風のリキャップと
 * 執筆再開の手がかりを表示する。再開地点・未回収伏線はローカル計算で即時表示し、
 * AIナレーション・提案は生成完了後に差し込む（RecapGateが状態を管理する）。
 */

interface RecapModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    /** 前回アクセスからの経過日数（不明時は null） */
    daysSince: number | null;
    aiContent: RecapAIContent | null;
    aiState: RecapAIState;
    onGenerateNarrative: () => void;
    onSnoozeToday: () => void;
}

const MAX_FORESHADOWINGS_SHOWN = 5;

export const RecapModal: React.FC<RecapModalProps> = ({
    isOpen,
    onClose,
    project,
    daysSince,
    aiContent,
    aiState,
    onGenerateNarrative,
    onSnoozeToday,
}) => {
    const resume = computeResumePoint(project);
    const openForeshadowings = getOpenForeshadowings(project);
    const shownForeshadowings = openForeshadowings.slice(0, MAX_FORESHADOWINGS_SHOWN);
    const hiddenCount = openForeshadowings.length - shownForeshadowings.length;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title={
                <span className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-500" />
                    前回までのあらすじ
                </span>
            }
        >
            <div className="space-y-5 font-['Noto_Sans_JP']">
                {/* 経過日数 */}
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {daysSince !== null && daysSince >= 1
                        ? `『${project.title}』の執筆から${daysSince}日ぶりです。おかえりなさい。`
                        : `『${project.title}』へ、おかえりなさい。`}
                </p>

                {/* AIナレーション */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 p-4">
                    {aiState === 'done' && aiContent ? (
                        <p className="text-sm leading-7 text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                            {aiContent.narrative}
                        </p>
                    ) : aiState === 'running' ? (
                        <div className="flex items-center gap-3 text-sm text-indigo-700 dark:text-indigo-300">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span>物語を振り返っています…</span>
                        </div>
                    ) : aiState === 'error' ? (
                        <div className="space-y-2">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                あらすじの生成に失敗しました。
                            </p>
                            <button
                                type="button"
                                onClick={onGenerateNarrative}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>再試行</span>
                            </button>
                        </div>
                    ) : aiState === 'unconfigured' ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            AI設定を行うと、ここに「前回までのあらすじ」ナレーションが表示されます。
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={onGenerateNarrative}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm hover:scale-105 transition-all duration-200 shadow-md"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span>AIで前回までのあらすじを振り返る</span>
                        </button>
                    )}
                </div>

                {/* 再開地点（ローカル計算・即時表示） */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-1.5">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        執筆の中断地点
                    </h3>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 pl-6">
                        {resume.stepLabel && <li>最後に編集していた画面: {resume.stepLabel}</li>}
                        {resume.lastDraftedChapterTitle && <li>最後に本文を書いた章: 「{resume.lastDraftedChapterTitle}」</li>}
                        {resume.nextChapterTitle && <li>次に本文を書く章: 「{resume.nextChapterTitle}」</li>}
                        {!resume.stepLabel && !resume.lastDraftedChapterTitle && !resume.nextChapterTitle && (
                            <li className="text-gray-500 dark:text-gray-400">記録がありません</li>
                        )}
                    </ul>
                </div>

                {/* 未回収の伏線 */}
                {shownForeshadowings.length > 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-1.5">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                            <Link2 className="h-4 w-4 text-amber-500" />
                            未回収の伏線（{openForeshadowings.length}件）
                        </h3>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 pl-6 list-disc">
                            {shownForeshadowings.map(f => (
                                <li key={f.id}>{f.title}</li>
                            ))}
                        </ul>
                        {hiddenCount > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">ほか{hiddenCount}件（伏線トラッカーで確認できます）</p>
                        )}
                    </div>
                )}

                {/* 執筆再開の提案 */}
                {aiState === 'done' && aiContent && aiContent.suggestions.length > 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-1.5">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            今日はここから
                        </h3>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 pl-6 list-disc">
                            {aiContent.suggestions.map((s, i) => (
                                <li key={i}>{s}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* アクション */}
                <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onSnoozeToday}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>今日は表示しない</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:scale-105 transition-all duration-200 shadow-md"
                    >
                        <Play className="h-4 w-4" />
                        <span>執筆を再開する</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};
