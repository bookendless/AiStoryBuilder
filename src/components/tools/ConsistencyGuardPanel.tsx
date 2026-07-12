import React, { useMemo, useState } from 'react';
import {
    ShieldCheck,
    Play,
    Loader2,
    Copy,
    Check,
    EyeOff,
    RotateCcw,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { useToast } from '../Toast';
import {
    ConsistencyCategory,
    ConsistencyIssue,
    ConsistencyIssueStatus,
    CONSISTENCY_CATEGORY_LABELS,
    CONSISTENCY_SEVERITY_LABELS,
} from '../../types/consistency';
import { createConsistencyRunner } from '../../services/consistency/createConsistencyRunner';
import { scanProject, ConsistencyScanProgress } from '../../services/consistency/scanProject';

/**
 * ConsistencyGuardPanel - 整合性ガード（設定ドリフト検知）
 *
 * 設定台帳（キャラクター・用語集・世界観・時系列）と各章の草案を突き合わせ、
 * 容姿・一人称/口調・呼称・用語表記・時系列の矛盾をスキャンして一覧表示する。
 * スキャンは章ごとにAIを呼び、GenerationContext経由でキャンセル可能。
 * 結果は Project.consistencyReports に保存され（最新5件）、指摘ごとに無視/解決をマークできる。
 */

interface ConsistencyGuardPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const ALL_CATEGORIES: ConsistencyCategory[] = [
    'appearance',
    'narration',
    'address',
    'terminology',
    'timeline',
];

const SEVERITY_BADGE_CLASSES: Record<ConsistencyIssue['severity'], string> = {
    high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

export const ConsistencyGuardPanel: React.FC<ConsistencyGuardPanelProps> = ({ isOpen, onClose }) => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { startTask, updateTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
    const { showSuccess, showError } = useToast();

    const [selectedCategories, setSelectedCategories] = useState<Set<ConsistencyCategory>>(
        () => new Set(ALL_CATEGORIES)
    );
    // 既定は全章対象。除外集合で持つことで、章が増えても「全選択」が保たれる
    const [excludedChapterIds, setExcludedChapterIds] = useState<Set<string>>(() => new Set());
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState<ConsistencyScanProgress | null>(null);
    const [failedChapterCount, setFailedChapterCount] = useState(0);
    const [showIgnored, setShowIgnored] = useState(false);

    const draftChapters = useMemo(
        () => (currentProject?.chapters ?? []).filter(c => (c.draft ?? '').trim().length > 0),
        [currentProject]
    );
    const targetChapters = draftChapters.filter(c => !excludedChapterIds.has(c.id));
    const latestReport = currentProject?.consistencyReports?.[0];

    const scanKey = currentProject ? `${currentProject.id}:tools:consistency` : '';

    const toggleCategory = (category: ConsistencyCategory) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    };

    const toggleChapter = (chapterId: string) => {
        setExcludedChapterIds(prev => {
            const next = new Set(prev);
            if (next.has(chapterId)) next.delete(chapterId);
            else next.add(chapterId);
            return next;
        });
    };

    const handleScan = () => {
        if (!currentProject || isScanning || !isConfigured) return;
        if (isKeyActive(scanKey)) return;
        if (targetChapters.length === 0 || selectedCategories.size === 0) return;

        const project = currentProject;
        const categories = ALL_CATEGORIES.filter(c => selectedCategories.has(c));

        setIsScanning(true);
        setProgress(null);
        setFailedChapterCount(0);

        const { id, signal } = startTask({
            key: scanKey,
            label: '整合性スキャン中',
            step: 'tools',
        });
        const run = createConsistencyRunner(settings, signal);

        scanProject(project, {
            settings,
            run,
            signal,
            categories,
            targetChapterIds: targetChapters.map(c => c.id),
            onProgress: p => {
                setProgress(p);
                updateTask(id, {
                    progress: {
                        current: p.current,
                        total: p.total,
                        status: `「${p.chapterTitle}」をチェック中`,
                    },
                });
            },
            onChapterError: () => setFailedChapterCount(n => n + 1),
        })
            .then(async report => {
                const existing = project.consistencyReports ?? [];
                await updateProject(
                    { consistencyReports: [report, ...existing].slice(0, 5) },
                    true
                );
                showSuccess(
                    report.issues.length > 0
                        ? `スキャン完了: ${report.issues.length}件の指摘が見つかりました`
                        : 'スキャン完了: 矛盾は見つかりませんでした'
                );
            })
            .catch((error: unknown) => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.error('整合性スキャンエラー:', error);
                    showError('整合性スキャンに失敗しました');
                }
            })
            .finally(() => {
                completeTask(id);
                setIsScanning(false);
                setProgress(null);
            });
    };

    const handleCancel = () => {
        cancelByKey(scanKey);
    };

    const setIssueStatus = (issueId: string, status: ConsistencyIssueStatus) => {
        if (!currentProject || !latestReport) return;
        const reports = (currentProject.consistencyReports ?? []).map(r =>
            r.id !== latestReport.id
                ? r
                : { ...r, issues: r.issues.map(i => (i.id === issueId ? { ...i, status } : i)) }
        );
        void updateProject({ consistencyReports: reports });
    };

    const handleCopyQuote = async (quote: string) => {
        try {
            await navigator.clipboard.writeText(quote);
            showSuccess('引用をコピーしました。草案画面の検索で該当箇所を開けます');
        } catch {
            showError('コピーに失敗しました');
        }
    };

    // 章順で指摘をグループ化（無視済みはトグルで表示）
    const groupedIssues = useMemo(() => {
        if (!currentProject || !latestReport) return [];
        const chapterOrder = new Map(currentProject.chapters.map((c, i) => [c.id, i]));
        const groups = new Map<string, { chapterTitle: string; issues: ConsistencyIssue[] }>();
        for (const issue of latestReport.issues) {
            if (!showIgnored && issue.status === 'ignored') continue;
            const group = groups.get(issue.chapterId) ?? {
                chapterTitle: issue.chapterTitle,
                issues: [],
            };
            group.issues.push(issue);
            groups.set(issue.chapterId, group);
        }
        return Array.from(groups.entries()).sort(
            (a, b) => (chapterOrder.get(a[0]) ?? 0) - (chapterOrder.get(b[0]) ?? 0)
        );
    }, [currentProject, latestReport, showIgnored]);

    const ignoredCount = latestReport?.issues.filter(i => i.status === 'ignored').length ?? 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <span className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-teal-500" />
                    整合性ガード
                </span>
            }
        >
            <div className="space-y-5 font-['Noto_Sans_JP']">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    設定台帳（キャラクター・用語集・世界観・タイムライン）と各章の草案を突き合わせ、容姿・一人称/口調・呼称・用語表記・時系列の矛盾をAIが検出します。
                </p>

                {/* スキャン設定 */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-3">
                    <div>
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">チェック項目</h3>
                        <div className="flex flex-wrap gap-2">
                            {ALL_CATEGORIES.map(category => (
                                <label
                                    key={category}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${selectedCategories.has(category)
                                        ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={selectedCategories.has(category)}
                                        onChange={() => toggleCategory(category)}
                                    />
                                    <span>{CONSISTENCY_CATEGORY_LABELS[category]}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                            対象の章（草案のある章のみ・{targetChapters.length}/{draftChapters.length}章）
                        </h3>
                        {draftChapters.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                草案が書かれた章がありません。草案執筆後にスキャンできます。
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                                {draftChapters.map(chapter => (
                                    <label
                                        key={chapter.id}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${!excludedChapterIds.has(chapter.id)
                                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={!excludedChapterIds.has(chapter.id)}
                                            onChange={() => toggleChapter(chapter.id)}
                                        />
                                        <span>{chapter.title}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 実行 */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            対象{targetChapters.length}章 ≒ AI呼び出し{targetChapters.length}回（長い章は分割され増えることがあります）
                        </p>
                        {isScanning ? (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <XCircle className="h-4 w-4" />
                                <span>キャンセル</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleScan}
                                disabled={!isConfigured || targetChapters.length === 0 || selectedCategories.size === 0}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm hover:scale-105 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <Play className="h-4 w-4" />
                                <span>スキャン開始</span>
                            </button>
                        )}
                    </div>
                    {!isConfigured && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">AI設定を行うとスキャンできます。</p>
                    )}
                </div>

                {/* 進捗 */}
                {isScanning && (
                    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span>
                                {progress
                                    ? `${progress.current}/${progress.total}章: 「${progress.chapterTitle}」をチェック中…`
                                    : 'スキャンを準備しています…'}
                            </span>
                        </div>
                        {progress && (
                            <div className="h-1.5 rounded-full bg-teal-100 dark:bg-teal-900 overflow-hidden">
                                <div
                                    className="h-full bg-teal-500 transition-all duration-300"
                                    style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* 最新レポート */}
                {latestReport && !isScanning && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                最新スキャン結果（{new Date(latestReport.createdAt).toLocaleString('ja-JP')}）
                            </h3>
                            {ignoredCount > 0 && (
                                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showIgnored}
                                        onChange={e => setShowIgnored(e.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span>無視済み{ignoredCount}件を表示</span>
                                </label>
                            )}
                        </div>

                        {failedChapterCount > 0 && (
                            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {failedChapterCount}章のスキャンに失敗しました（結果には含まれていません）
                            </p>
                        )}

                        {latestReport.issues.length === 0 ? (
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                                🎉 矛盾は見つかりませんでした。設定と本文はきれいに整合しています。
                            </div>
                        ) : groupedIssues.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                表示できる指摘はありません（すべて無視済みです）。
                            </p>
                        ) : (
                            groupedIssues.map(([chapterId, group]) => (
                                <div key={chapterId} className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        {group.chapterTitle}
                                    </h4>
                                    {group.issues.map(issue => (
                                        <div
                                            key={issue.id}
                                            className={`rounded-xl border p-3 space-y-2 transition-opacity ${issue.status === 'resolved'
                                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                                                : issue.status === 'ignored'
                                                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 opacity-60'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_BADGE_CLASSES[issue.severity]}`}>
                                                    深刻度: {CONSISTENCY_SEVERITY_LABELS[issue.severity]}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                                    {CONSISTENCY_CATEGORY_LABELS[issue.category]}
                                                </span>
                                                {issue.status === 'resolved' && (
                                                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                                        <Check className="h-3.5 w-3.5" /> 解決済み
                                                    </span>
                                                )}
                                            </div>

                                            <blockquote className="text-sm text-gray-800 dark:text-gray-100 border-l-2 border-teal-400 pl-3 whitespace-pre-wrap break-words">
                                                {issue.quote}
                                            </blockquote>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{issue.description}</p>
                                            {issue.evidence && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">根拠: {issue.evidence}</p>
                                            )}
                                            {issue.suggestion && (
                                                <p className="text-xs text-emerald-700 dark:text-emerald-300">修正案: {issue.suggestion}</p>
                                            )}

                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyQuote(issue.quote)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    title="引用をコピー（草案画面の検索で該当箇所へ）"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    <span>引用をコピー</span>
                                                </button>
                                                {issue.status !== 'resolved' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIssueStatus(issue.id, 'resolved')}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        <span>解決済みにする</span>
                                                    </button>
                                                )}
                                                {issue.status !== 'ignored' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIssueStatus(issue.id, 'ignored')}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                        title="意図的な変化・誤検知の場合"
                                                    >
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                        <span>無視</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIssueStatus(issue.id, 'open')}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        <span>元に戻す</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
