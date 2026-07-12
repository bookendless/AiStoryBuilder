import React, { useMemo, useState } from 'react';
import {
    GitBranch,
    Sparkles,
    Loader2,
    XCircle,
    Trash2,
    FlaskConical,
    History,
    ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { useToast } from '../Toast';
import {
    WhatIfBranchPoint,
    WhatIfScenario,
    WHAT_IF_SEVERITY_LABELS,
} from '../../types/whatIf';
import { createWhatIfRunner } from '../../services/whatIf/createWhatIfRunner';
import { generateWhatIfReport } from '../../services/whatIf/generateWhatIfReport';

/**
 * WhatIfLabPanel - 平行世界ラボ（What-if分岐シミュレータ）
 *
 * 既存の展開に「もし◯◯だったら」を適用し、後続章への波及・壊れる伏線・
 * 変わる関係性・新たな可能性をAIがレポートする。本編は一切変更しない。
 * シナリオ履歴は Project.whatIfScenarios に保存され、気に入った分岐は
 * サンドボックスプロジェクト（分岐点まで複製）として展開できる。
 */

interface WhatIfLabPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const SEVERITY_BADGE_CLASSES: Record<string, string> = {
    major: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    moderate: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    minor: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const genScenarioId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const WhatIfLabPanel: React.FC<WhatIfLabPanelProps> = ({ isOpen, onClose }) => {
    const { currentProject, updateProject, createBranchProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
    const { showSuccess, showError } = useToast();

    const [branchType, setBranchType] = useState<'chapter' | 'custom'>('chapter');
    const [branchChapterId, setBranchChapterId] = useState<string>('');
    const [premise, setPremise] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewingScenarioId, setViewingScenarioId] = useState<string | null>(null);

    const chaptersWithContent = useMemo(
        () =>
            (currentProject?.chapters ?? []).filter(
                c => (c.summary ?? '').trim().length > 0 || (c.draft ?? '').trim().length > 0
            ),
        [currentProject]
    );
    const scenarios = currentProject?.whatIfScenarios ?? [];
    const viewingScenario =
        scenarios.find(s => s.id === viewingScenarioId) ?? scenarios[0] ?? null;

    const taskKey = currentProject ? `${currentProject.id}:tools:whatif` : '';

    const handleGenerate = () => {
        if (!currentProject || isGenerating || !isConfigured) return;
        if (isKeyActive(taskKey)) return;
        const trimmedPremise = premise.trim();
        if (!trimmedPremise) return;

        const project = currentProject;
        let branchPoint: WhatIfBranchPoint;
        if (branchType === 'chapter') {
            const chapter = project.chapters.find(c => c.id === branchChapterId);
            if (!chapter) return;
            const chapterNumber = project.chapters.findIndex(c => c.id === chapter.id) + 1;
            branchPoint = {
                type: 'chapter',
                chapterId: chapter.id,
                description: `第${chapterNumber}章「${chapter.title}」の展開`,
            };
        } else {
            branchPoint = { type: 'custom', description: '物語全体（自由分岐）' };
        }

        setIsGenerating(true);
        const { id, signal } = startTask({
            key: taskKey,
            label: 'What-if分岐をシミュレート中',
            step: 'tools',
        });
        const run = createWhatIfRunner(settings, signal);

        generateWhatIfReport(project, branchPoint, trimmedPremise, { settings, run, signal })
            .then(async report => {
                const scenario: WhatIfScenario = {
                    id: genScenarioId(),
                    createdAt: new Date(),
                    branchPoint,
                    premise: trimmedPremise,
                    report,
                };
                const existing = project.whatIfScenarios ?? [];
                await updateProject(
                    { whatIfScenarios: [scenario, ...existing].slice(0, 10) },
                    true
                );
                setViewingScenarioId(scenario.id);
                setPremise('');
                showSuccess('分岐レポートが完成しました');
            })
            .catch((error: unknown) => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.error('What-ifシミュレーションエラー:', error);
                    showError('分岐シミュレーションに失敗しました');
                }
            })
            .finally(() => {
                completeTask(id);
                setIsGenerating(false);
            });
    };

    const handleCancel = () => cancelByKey(taskKey);

    const handleDeleteScenario = (scenarioId: string) => {
        if (!currentProject) return;
        const remaining = (currentProject.whatIfScenarios ?? []).filter(s => s.id !== scenarioId);
        void updateProject({ whatIfScenarios: remaining });
        if (viewingScenarioId === scenarioId) setViewingScenarioId(null);
    };

    const handleCreateSandbox = (scenario: WhatIfScenario) => {
        if (!currentProject) return;
        const premiseLabel =
            scenario.premise.length > 15 ? `${scenario.premise.substring(0, 15)}…` : scenario.premise;
        createBranchProject(currentProject, {
            title: `${currentProject.title}〔分岐: ${premiseLabel}〕`,
            premise: scenario.premise,
            branchChapterId: scenario.branchPoint.chapterId,
        });
        showSuccess('サンドボックスプロジェクトを作成して開きました。本編は変更されていません');
        onClose();
    };

    const report = viewingScenario?.report;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <span className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-purple-500" />
                    平行世界ラボ
                </span>
            }
        >
            <div className="space-y-5 font-['Noto_Sans_JP']">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    物語の展開に「もしも」を試す実験室です。分岐点と前提を指定すると、後続章への波及・壊れる伏線・新たな可能性をAIがレポートします。<span className="font-medium">本編は一切変更されません。</span>
                </p>

                {/* 分岐の指定 */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 dark:text-gray-300">
                            <input
                                type="radio"
                                name="whatif-branch-type"
                                checked={branchType === 'chapter'}
                                onChange={() => setBranchType('chapter')}
                                className="h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>章の展開を分岐させる</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 dark:text-gray-300">
                            <input
                                type="radio"
                                name="whatif-branch-type"
                                checked={branchType === 'custom'}
                                onChange={() => setBranchType('custom')}
                                className="h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>自由に指定する</span>
                        </label>
                    </div>

                    {branchType === 'chapter' && (
                        <select
                            value={branchChapterId}
                            onChange={e => setBranchChapterId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="">分岐点となる章を選択…</option>
                            {chaptersWithContent.map(chapter => {
                                const num = (currentProject?.chapters ?? []).findIndex(c => c.id === chapter.id) + 1;
                                return (
                                    <option key={chapter.id} value={chapter.id}>
                                        第{num}章「{chapter.title}」
                                    </option>
                                );
                            })}
                        </select>
                    )}

                    <textarea
                        value={premise}
                        onChange={e => setPremise(e.target.value)}
                        rows={2}
                        placeholder="もし◯◯だったら…（例: もしこの章でヒロインが真実を打ち明けていたら）"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">AI呼び出し1回でレポートを生成します</p>
                        {isGenerating ? (
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
                                onClick={handleGenerate}
                                disabled={
                                    !isConfigured ||
                                    !premise.trim() ||
                                    (branchType === 'chapter' && !branchChapterId)
                                }
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white text-sm hover:scale-105 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>シミュレート</span>
                            </button>
                        )}
                    </div>
                    {!isConfigured && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">AI設定を行うとシミュレートできます。</p>
                    )}
                </div>

                {/* 生成中 */}
                {isGenerating && (
                    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 p-4 flex items-center gap-3 text-sm text-purple-700 dark:text-purple-300">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>平行世界を観測しています…</span>
                    </div>
                )}

                {/* シナリオ履歴 */}
                {scenarios.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                            <History className="h-4 w-4 text-gray-400" />
                            シナリオ履歴
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {scenarios.map(scenario => (
                                <div
                                    key={scenario.id}
                                    className={`flex items-center gap-1 rounded-full border text-xs transition-colors ${viewingScenario?.id === scenario.id
                                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setViewingScenarioId(scenario.id)}
                                        className="pl-3 py-1.5 max-w-[220px] truncate"
                                        title={scenario.premise}
                                    >
                                        {scenario.premise}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteScenario(scenario.id)}
                                        className="pr-2 pl-1 py-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                        aria-label="このシナリオを削除"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* レポート表示 */}
                {viewingScenario && report && !isGenerating && (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/80 to-fuchsia-50/80 dark:from-purple-950/40 dark:to-fuchsia-950/40 p-4 space-y-1">
                            <p className="text-xs text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
                                <GitBranch className="h-3.5 w-3.5" />
                                {viewingScenario.branchPoint.description}
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                もしも: {viewingScenario.premise}
                            </p>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-1.5">
                            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">分岐直後の展開</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.immediate}</p>
                        </div>

                        {report.chapterImpacts.length > 0 && (
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 space-y-2">
                                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">後続章への波及</h4>
                                {report.chapterImpacts.map((impact, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${SEVERITY_BADGE_CLASSES[impact.severity]}`}>
                                            影響{WHAT_IF_SEVERITY_LABELS[impact.severity]}
                                        </span>
                                        <p className="text-gray-700 dark:text-gray-300">
                                            <span className="font-medium">「{impact.title}」</span>: {impact.impact}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(report.brokenForeshadowings.length > 0 || report.relationshipChanges.length > 0) && (
                            <div className="grid sm:grid-cols-2 gap-3">
                                {report.brokenForeshadowings.length > 0 && (
                                    <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-1.5">
                                        <h4 className="text-sm font-medium text-rose-700 dark:text-rose-300">壊れる伏線</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc pl-5">
                                            {report.brokenForeshadowings.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {report.relationshipChanges.length > 0 && (
                                    <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50/40 dark:bg-pink-950/20 p-4 space-y-1.5">
                                        <h4 className="text-sm font-medium text-pink-700 dark:text-pink-300">変わる関係性</h4>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc pl-5">
                                            {report.relationshipChanges.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {report.newPossibilities.length > 0 && (
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-1.5">
                                <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">新たに生まれる可能性</h4>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc pl-5">
                                    {report.newPossibilities.map((item, i) => (
                                        <li key={i}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 space-y-1.5">
                            <h4 className="text-sm font-medium text-indigo-700 dark:text-indigo-300">総評</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.verdict}</p>
                        </div>

                        {/* サンドボックス生成 */}
                        <div className="flex items-center justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => handleCreateSandbox(viewingScenario)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-700 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                                title="分岐点までを複製した実験用プロジェクトを新規作成します（本編は変更されません）"
                            >
                                <GitBranch className="h-4 w-4" />
                                <span>この分岐でサンドボックスを作成して開く</span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {scenarios.length === 0 && !isGenerating && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                        まだシナリオがありません。分岐点と「もしも」を指定してシミュレートしてみましょう。
                    </p>
                )}
            </div>
        </Modal>
    );
};
