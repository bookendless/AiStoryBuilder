import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Sparkles, AlertCircle, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';
import { Step } from '../../App';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { Project } from '../../types/project';
import { Modal } from '../common/Modal';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { useOverlayBackHandler } from '../../contexts/BackButtonContext';
import { useToast } from '../Toast';
import { useSequelComposer, getSequelSnapshot } from './hooks/useSequelComposer';

interface SequelComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToStep: (step: Step) => void;
}

const inputClass =
    "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']";

export const SequelComposerModal: React.FC<SequelComposerModalProps> = ({ isOpen, onClose, onNavigateToStep }) => {
    useOverlayBackHandler(isOpen, onClose, 'sequel-composer-modal', 90);

    const { projects, calculateProjectProgress, createSequelProject } = useProject();
    const { isConfigured } = useAI();
    const { showSuccess } = useToast();

    const composer = useSequelComposer();
    const {
        step, sourceProjectId, isDetailedMode, extraction, elements, progress, isRunning, error,
        setSourceProjectId, setIsDetailedMode, setExtraction, setElements,
        runExtraction, runGeneration, cancel, reset, restoreSnapshot,
    } = composer;

    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [title, setTitle] = useState('');

    // 完成済み（進捗100%）のプロジェクトのみを対象とする
    const completedProjects = useMemo(
        () => projects.filter(p => calculateProjectProgress(p).percentage === 100),
        [projects, calculateProjectProgress]
    );

    const sourceProject: Project | null = useMemo(
        () => projects.find(p => p.id === sourceProjectId) || null,
        [projects, sourceProjectId]
    );

    // モーダルを開いたとき: 中断状態があれば再開を確認
    // projects は最新値を参照したいだけで、その変化で再評価する必要はないため依存から除外。
    useEffect(() => {
        if (!isOpen) return;
        const snapshot = getSequelSnapshot();
        if (snapshot && projects.some(p => p.id === snapshot.sourceProjectId)) {
            setShowResumePrompt(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // 完了ステップに来たらデフォルトタイトルを設定（未入力時のみ）
    useEffect(() => {
        if (step === 'finalize' && sourceProject) {
            setTitle(prev => prev || `${sourceProject.title}（続編）`);
        }
    }, [step, sourceProject]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (isRunning) cancel();
        onClose();
    };

    const handleResume = () => {
        const snapshot = getSequelSnapshot();
        if (snapshot) restoreSnapshot(snapshot);
        setShowResumePrompt(false);
    };

    const handleDiscardResume = () => {
        reset();
        setShowResumePrompt(false);
    };

    const handleStartExtraction = () => {
        if (!sourceProject) return;
        runExtraction(sourceProject);
    };

    const handleStartGeneration = () => {
        if (!sourceProject || !extraction) return;
        runGeneration(sourceProject, extraction);
    };

    const handleFinalize = () => {
        if (!sourceProject || !elements) return;
        createSequelProject(sourceProject, {
            title: title.trim() || `${sourceProject.title}（続編）`,
            synopsis: elements.synopsis,
            plot: {
                theme: elements.plot.theme,
                setting: elements.plot.setting,
                hook: elements.plot.hook,
                protagonistGoal: elements.plot.protagonistGoal,
                mainObstacle: elements.plot.mainObstacle,
            },
            characters: elements.characters,
            worldSettings: elements.worldSettings,
        });
        showSuccess('続編プロジェクトを作成しました', 4000);
        reset();
        setTitle('');
        onClose();
        onNavigateToStep('character');
    };

    // ---- レンダリング ----

    const renderResumePrompt = () => (
        <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                    中断していた続編構成があります。続きから再開しますか？
                </p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={handleDiscardResume}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                >
                    破棄して新規
                </button>
                <button
                    onClick={handleResume}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                >
                    再開する
                </button>
            </div>
        </div>
    );

    const renderSelect = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                完成済み（進捗100%）のプロジェクトを選び、その続編づくりをAIが補助します。
            </p>

            {!isConfigured && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                        AIが設定されていません。AI設定でプロバイダーとAPIキーを設定してください。
                    </p>
                </div>
            )}

            {completedProjects.length === 0 ? (
                <div className="text-center py-8">
                    <BookOpen className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        完成プロジェクトがありません。<br />全6ステップを完了したプロジェクトが続編構成の対象になります。
                    </p>
                </div>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {completedProjects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSourceProjectId(p.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors font-['Noto_Sans_JP'] ${sourceProjectId === p.id
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white truncate">{p.title}</span>
                                {sourceProjectId === p.id && <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {p.chapters.length}章 / キャラ{p.characters.length}人
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <label className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isDetailedMode}
                    onChange={(e) => setIsDetailedMode(e.target.checked)}
                    className="rounded border-gray-300"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    詳細抽出モード（本文も要約に使用 / 高精度だが時間・コスト増）
                </span>
            </label>

            {error && (
                <p className="text-xs text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">{error}</p>
            )}

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleStartExtraction}
                    disabled={!sourceProjectId || !isConfigured}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all font-['Noto_Sans_JP']"
                >
                    <Sparkles className="h-4 w-4" />
                    要素を抽出する
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );

    const renderExtracting = () => (
        <div className="py-6">
            <AILoadingIndicator
                message={progress?.phase || 'AIが分析中...'}
                progress={progress ? { current: progress.current, total: progress.total, status: progress.phase } : undefined}
                variant="inline"
                cancellable
                onCancel={cancel}
            />
        </div>
    );

    const renderReviewExtract = () => {
        if (!extraction) return null;
        const field = (key: keyof typeof extraction, label: string, rows = 3) => (
            <div>
                <label className={labelClass}>{label}</label>
                <textarea
                    value={extraction[key]}
                    onChange={(e) => setExtraction({ ...extraction, [key]: e.target.value })}
                    rows={rows}
                    className={inputClass}
                />
            </div>
        );
        return (
            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    抽出結果を確認・編集してください。この内容を元に続編要素を生成します。
                </p>
                {field('storyDigest', '前作の全体要約', 5)}
                {field('characterGrowth', 'キャラクターの成長・変化')}
                {field('relationshipChanges', '関係性の変化')}
                {field('worldChanges', '世界観の変化')}
                {field('openThreads', '未解決の要素（続編のフック）')}
                <div className="flex justify-between pt-2">
                    <button onClick={reset} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']">
                        最初からやり直す
                    </button>
                    <button
                        onClick={handleStartGeneration}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all font-['Noto_Sans_JP']"
                    >
                        <Sparkles className="h-4 w-4" />
                        続編要素を生成
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderReviewSequel = () => {
        if (!elements) return null;
        const plotField = (key: keyof typeof elements.plot, label: string) => (
            <div>
                <label className={labelClass}>{label}</label>
                <textarea
                    value={elements.plot[key]}
                    onChange={(e) => setElements({ ...elements, plot: { ...elements.plot, [key]: e.target.value } })}
                    rows={2}
                    className={inputClass}
                />
            </div>
        );
        return (
            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    続編の要素を確認・編集してください。
                </p>
                <div>
                    <label className={labelClass}>続編のあらすじ</label>
                    <textarea
                        value={elements.synopsis}
                        onChange={(e) => setElements({ ...elements, synopsis: e.target.value })}
                        rows={5}
                        className={inputClass}
                    />
                </div>
                {plotField('theme', 'テーマ')}
                {plotField('setting', '舞台・状況設定')}
                {plotField('hook', 'フック')}
                {plotField('protagonistGoal', '主人公の目標')}
                {plotField('mainObstacle', '主要な障害')}
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    引き継ぎ: キャラクター {elements.characters.length}人（成長を反映） / 世界観設定 {elements.worldSettings.length}件（前作から引き継ぎ＋変化メモ）
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={() => composer.setStep('finalize')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all font-['Noto_Sans_JP']"
                    >
                        次へ
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderFinalize = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                続編プロジェクトのタイトルを入力して作成します。作成後、キャラクターステップから編集を続けられます。
            </p>
            <div>
                <label className={labelClass}>続編プロジェクトのタイトル</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                />
            </div>
            <div className="flex justify-between pt-2">
                <button onClick={() => composer.setStep('reviewSequel')} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']">
                    戻る
                </button>
                <button
                    onClick={handleFinalize}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all font-['Noto_Sans_JP']"
                >
                    <BookOpen className="h-4 w-4" />
                    続編プロジェクトを作成
                </button>
            </div>
        </div>
    );

    const renderBody = () => {
        if (showResumePrompt) return renderResumePrompt();
        switch (step) {
            case 'select': return renderSelect();
            case 'extracting': return renderExtracting();
            case 'reviewExtract': return renderReviewExtract();
            case 'reviewSequel': return renderReviewSequel();
            case 'finalize': return renderFinalize();
            default: return renderSelect();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span>続編構成</span>
                </div>
            }
            size="xl"
        >
            {renderBody()}
        </Modal>
    );
};
