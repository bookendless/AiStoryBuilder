import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { EvaluationMode, EvaluationResult, SavedEvaluation, EvaluationStrictness } from '../../types/evaluation';
import {
    BookOpen,
    Users,
    Feather,
    UserCheck,
    Play,
    Loader2,
    AlertCircle,
    CheckCircle2,
    ThumbsUp,
    ThumbsDown,
    Lightbulb,
    FileText,
    Save,
    Download,
    History,
    Trash2,
    ChevronRight,
    Search,
    Upload,
    Book,
    Check,
    Pencil,
    ChevronUp,
} from 'lucide-react';
import MarkdownIt from 'markdown-it';
import { StepNavigation } from '../common/StepNavigation';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { Step } from '../../contexts/ProjectContext';
import { exportFile } from '../../utils/mobileExportUtils';

interface ReviewStepProps {
    onNavigateToStep?: (step: Step) => void;
}

const MAX_SCORE = 5;

const EVALUATION_MODES: { id: EvaluationMode; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'structure', label: '構造・プロット', icon: <BookOpen size={18} />, description: '物語の構成、一貫性、ペース配分を分析します' },
    { id: 'character', label: 'キャラクター', icon: <Users size={18} />, description: 'キャラクターの動機、成長、独自性を評価します' },
    { id: 'style', label: '文体・表現', icon: <Feather size={18} />, description: '文章の読みやすさ、描写力、五感表現をチェックします' },
    { id: 'persona', label: '読者ペルソナ', icon: <UserCheck size={18} />, description: '想定読者になりきって感想と市場性を評価します' },
];

const STRICTNESS_LEVELS: { id: EvaluationStrictness; label: string; description: string }[] = [
    { id: 'gentle', label: 'やさしい', description: '良い点を重視し、建設的なフィードバックを提供' },
    { id: 'normal', label: '普通', description: 'バランスの取れた評価（デフォルト）' },
    { id: 'strict', label: '厳しい', description: 'より厳格な基準で評価し、改善点を明確に指摘' },
    { id: 'harsh', label: '辛辣', description: 'プロの編集者として厳しく評価し、問題点を率直に指摘' },
];

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const StepHeader: React.FC<{
    n: number; title: string; hint?: string;
    collapsible?: boolean; onToggle?: () => void;
}> = ({ n, title, hint, collapsible, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        disabled={!collapsible}
        className="w-full flex items-center gap-2 mb-3 text-left disabled:cursor-default"
    >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
            {n}
        </span>
        <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        {hint && <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
        {collapsible && <ChevronUp size={16} className="ml-auto text-gray-400" />}
    </button>
);

const SetupBar: React.FC<{
    n: number; label: string; value: string; onClick: () => void;
}> = ({ n, label, value, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-left"
    >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white shrink-0">
            <Check size={12} />
        </span>
        <span className="text-sm font-bold text-gray-600 dark:text-gray-300 shrink-0">
            {n}. {label}
        </span>
        <span className="ml-auto text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full truncate max-w-[45%]">
            {value}
        </span>
        <Pencil size={14} className="text-gray-400 shrink-0" />
    </button>
);

export const ReviewStep: React.FC<ReviewStepProps> = ({ onNavigateToStep }) => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess, showError } = useToast();

    const [activeMode, setActiveMode] = useState<EvaluationMode>('structure');
    const [evaluationStrictness, setEvaluationStrictness] = useState<EvaluationStrictness>('normal');
    const [targetContent, setTargetContent] = useState<string>('');
    const [targetType, setTargetType] = useState<'synopsis' | 'chapter' | 'custom' | 'file' | 'whole-story'>('synopsis');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [loadedFileName, setLoadedFileName] = useState<string>('');
    const [openStep, setOpenStep] = useState<1 | 2 | 3 | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const mdParser = useMemo(() => new MarkdownIt({
        html: false,
        linkify: true,
        typographer: true,
    }), []);

    const modeMap = useMemo(() => {
        const map = new Map<EvaluationMode, typeof EVALUATION_MODES[0]>();
        EVALUATION_MODES.forEach(mode => {
            map.set(mode.id, mode);
        });
        return map;
    }, []);

    const projectId = currentProject?.id;
    const synopsis = currentProject?.synopsis;
    const chapters = currentProject?.chapters;

    const wholeStoryContent = useMemo(() => {
        if (!chapters || chapters.length === 0) return '';

        return chapters
            .map(chapter => {
                const draft = chapter.draft || chapter.summary || '';
                return draft ? `# ${chapter.title}\n\n${draft}\n\n---\n\n` : '';
            })
            .join('')
            .replace(/\n\n---\n\n$/, '');
    }, [chapters]);

    useEffect(() => {
        // currentProject そのものではなく projectId でガード（オブジェクト参照変化での再実行を避ける）
        if (!projectId) return;

        if (targetType === 'synopsis') {
            setTargetContent(synopsis || '');
            setLoadedFileName('');
        } else if (targetType === 'chapter') {
            if (selectedChapterId) {
                const chapter = chapters?.find(c => c.id === selectedChapterId);
                setTargetContent(chapter?.draft || chapter?.summary || '');
            } else if (chapters && chapters.length > 0) {
                setSelectedChapterId(chapters[0].id);
                setTargetContent(chapters[0].draft || chapters[0].summary || '');
            }
            setLoadedFileName('');
        } else if (targetType === 'whole-story') {
            setTargetContent(wholeStoryContent);
            setLoadedFileName('');
        } else if (targetType === 'file') {
            // ファイルから読み込んだ場合は既にtargetContentに設定済み
        } else if (targetType === 'custom') {
            setLoadedFileName('');
        }
    }, [targetType, selectedChapterId, projectId, synopsis, chapters, wholeStoryContent]);

    const handleEvaluate = async () => {
        if (!isConfigured) {
            showError('AI設定が必要です');
            return;
        }
        if (!targetContent.trim()) {
            showError('評価対象のテキストがありません');
            return;
        }

        setIsEvaluating(true);
        setResult(null);
        setOpenStep(null);

        try {
            const context = {
                title: currentProject?.title,
                theme: currentProject?.theme,
                genre: currentProject?.mainGenre,
                targetAudience: currentProject?.targetReader,
                characters: currentProject?.characters?.map(c => `${c.name}: ${c.role}`).join(', ') || ''
            };

            const evaluationResult = await aiService.evaluateStory({
                mode: activeMode,
                content: targetContent,
                strictness: evaluationStrictness,
                context
            }, settings);

            setResult(evaluationResult);
            showSuccess('評価が完了しました');
        } catch (error) {
            console.error('Evaluation failed:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
            showError(`評価中にエラーが発生しました: ${errorMessage}`);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleSave = async () => {
        if (!currentProject || !result) return;

        let targetTitle: string | undefined;
        if (targetType === 'chapter') {
            targetTitle = currentProject.chapters?.find(c => c.id === selectedChapterId)?.title;
        } else if (targetType === 'file') {
            targetTitle = loadedFileName || 'ファイルから読み込み';
        } else if (targetType === 'whole-story') {
            targetTitle = '作品全体';
        }

        const newEvaluation: SavedEvaluation = {
            ...result,
            id: generateUUID(),
            date: new Date(),
            mode: activeMode,
            targetType,
            targetTitle
        };

        const updatedEvaluations = [...(currentProject.evaluations || []), newEvaluation];

        await updateProject({
            evaluations: updatedEvaluations
        });

        showSuccess('評価結果を保存しました');
    };

    const handleExport = async () => {
        if (!result) return;

        const modeLabel = modeMap.get(activeMode)?.label || activeMode;
        const content = `# AI評価レポート: ${modeLabel}

## 概要
${result.summary}

## スコア: ${result.score}/${MAX_SCORE}

${result.persona ? `## 想定ペルソナ\n${result.persona}\n` : ''}## 良かった点
${result.strengths.map(s => `- ${s}`).join('\n')}

## 改善の余地
${result.weaknesses.map(w => `- ${w}`).join('\n')}

## 具体的な改善提案
${result.improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

## 詳細分析
${result.detailedAnalysis}
`;

        const filename = `evaluation_${activeMode}_${new Date().toISOString().slice(0, 10)}.md`;
        const exportResult = await exportFile({
            filename,
            content,
            mimeType: 'text/markdown',
            title: '評価レポート',
            dialogTitle: '評価レポートを保存',
        });

        if (exportResult.success) {
            showSuccess('レポートをダウンロードしました');
        } else if (exportResult.method === 'error') {
            showError(exportResult.error || 'エクスポートに失敗しました');
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!currentProject) return;

        const updatedEvaluations = currentProject.evaluations?.filter(e => e.id !== id) || [];
        await updateProject({
            evaluations: updatedEvaluations
        });

        showSuccess('履歴を削除しました');
    };

    const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.txt') && !fileName.endsWith('.md')) {
            showError('テキストファイル(.txt)またはMarkdownファイル(.md)を選択してください');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setTargetContent(content);
            setTargetType('file');
            setLoadedFileName(file.name);
            showSuccess(`ファイル「${file.name}」を読み込みました`);
        };
        reader.onerror = () => {
            showError('ファイルの読み込みに失敗しました');
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const loadHistory = useCallback((evaluation: SavedEvaluation) => {
        setResult(evaluation);
        setActiveMode(evaluation.mode);
        setTargetType(evaluation.targetType);
        setShowHistory(false);
    }, []);

    const reversedEvaluations = useMemo(() => {
        if (!currentProject?.evaluations || currentProject.evaluations.length === 0) {
            return [];
        }
        return [...currentProject.evaluations].reverse();
    }, [currentProject?.evaluations]);

    // 結果が存在する＝結果フェーズ（①②③を折りたたむ）
    const isResultPhase = !!result && !isEvaluating;

    // 折りたたみバーに表示する選択値ラベル
    const TARGET_TYPE_LABEL: Record<typeof targetType, string> = {
        synopsis: 'あらすじ',
        chapter: currentProject?.chapters?.find(c => c.id === selectedChapterId)?.title ?? '章',
        'whole-story': '作品全体',
        file: loadedFileName || 'ファイル',
        custom: 'カスタム入力',
    };
    const activeModeLabel = modeMap.get(activeMode)?.label ?? activeMode;
    const strictnessLabel = STRICTNESS_LEVELS.find(l => l.id === evaluationStrictness)?.label ?? '普通';

    // あるステップを「展開表示すべきか」（設定フェーズ中は常に展開）
    const isStepOpen = (n: 1 | 2 | 3) => !isResultPhase || openStep === n;

    const EditFooter = () => (
        <div className="flex gap-2 mt-3">
            <button
                onClick={handleEvaluate}
                disabled={isEvaluating || !targetContent.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Play size={16} /> この条件で再評価
            </button>
            <button
                onClick={() => setOpenStep(null)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
                閉じる
            </button>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="flex flex-col gap-4 pb-10">
                <StepNavigation
                    currentStep="review"
                    onPrevious={() => onNavigateToStep?.('draft')}
                    onNext={() => onNavigateToStep?.('export')}
                />
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-teal-600">
                                <Search className="h-5 w-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                作品評価 / Review
                            </h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                            AIを使って作品を多角的に分析・評価し、改善点を見つけましょう。
                        </p>
                    </div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showHistory
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                            }`}
                    >
                        <History size={18} />
                        履歴 ({currentProject?.evaluations?.length || 0})
                    </button>
                </div>

                {showHistory ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <History size={20} />
                            評価履歴
                        </h3>
                        {reversedEvaluations.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {reversedEvaluations.map((evaluation) => (
                                    <div key={evaluation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-800/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                {modeMap.get(evaluation.mode)?.label || evaluation.mode}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteHistory(evaluation.id); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="mb-3">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                                                {evaluation.summary}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {evaluation.date instanceof Date
                                                    ? evaluation.date.toLocaleString()
                                                    : new Date(evaluation.date).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => loadHistory(evaluation)}
                                            className="w-full flex items-center justify-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            詳細を見る <ChevronRight size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                                保存された評価履歴はありません
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ━━━ ① 評価対象 ━━━ */}
                        {isStepOpen(1) ? (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                <StepHeader n={1} title="評価対象" hint="何を評価する？"
                                    collapsible={isResultPhase} onToggle={() => setOpenStep(openStep === 1 ? null : 1)} />

                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            ソース選択
                                        </label>
                                        <div className="grid grid-cols-5 gap-2">
                                            <button
                                                onClick={() => setTargetType('synopsis')}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${targetType === 'synopsis'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                <FileText size={18} />
                                                <span className="text-xs font-medium">あらすじ</span>
                                            </button>
                                            <button
                                                onClick={() => setTargetType('chapter')}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${targetType === 'chapter'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                <BookOpen size={18} />
                                                <span className="text-xs font-medium">章</span>
                                            </button>
                                            <button
                                                onClick={() => setTargetType('whole-story')}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${targetType === 'whole-story'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                                title="全章の草案を結合して評価"
                                            >
                                                <Book size={18} />
                                                <span className="text-xs font-medium">作品全体</span>
                                            </button>
                                            <button
                                                onClick={() => setTargetType('custom')}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${targetType === 'custom'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                <Feather size={18} />
                                                <span className="text-xs font-medium">カスタム</span>
                                            </button>
                                            <button
                                                onClick={handleFileSelect}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${targetType === 'file'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                                title="ファイルから読み込み (.txt, .md)"
                                            >
                                                <Upload size={18} />
                                                <span className="text-xs font-medium">ファイル</span>
                                            </button>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".txt,.md"
                                            onChange={handleFileLoad}
                                            className="hidden"
                                        />
                                    </div>

                                    {targetType === 'file' && loadedFileName && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                                                <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                                                    読み込み済み: {loadedFileName}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {targetType === 'whole-story' && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Book size={16} className="text-indigo-600 dark:text-indigo-400" />
                                                <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                                                    全{chapters?.length || 0}章を結合して評価
                                                    {targetContent && ` (${targetContent.length}文字)`}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {targetType === 'chapter' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                章を選択
                                            </label>
                                            <select
                                                value={selectedChapterId}
                                                onChange={(e) => setSelectedChapterId(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            >
                                                {currentProject?.chapters?.map(chapter => (
                                                    <option key={chapter.id} value={chapter.id}>
                                                        {chapter.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            評価テキスト
                                        </label>
                                        <textarea
                                            value={targetContent}
                                            onChange={(e) => setTargetContent(e.target.value)}
                                            className="w-full h-64 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 text-sm"
                                            placeholder="評価したいテキストを入力してください..."
                                        />
                                    </div>
                                </div>

                                {isResultPhase && <EditFooter />}
                            </section>
                        ) : (
                            <SetupBar n={1} label="評価対象" value={TARGET_TYPE_LABEL[targetType]} onClick={() => setOpenStep(1)} />
                        )}

                        {/* ━━━ ② 評価観点 ━━━ */}
                        {isStepOpen(2) ? (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                <StepHeader n={2} title="評価観点" hint="どの角度で？"
                                    collapsible={isResultPhase} onToggle={() => setOpenStep(openStep === 2 ? null : 2)} />

                                <div className="grid grid-cols-2 gap-3">
                                    {EVALUATION_MODES.map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setActiveMode(mode.id)}
                                            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${activeMode === mode.id
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-800'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg mb-3 ${activeMode === mode.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                {mode.icon}
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-gray-100 mb-1">{mode.label}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 text-left">{mode.description}</span>
                                        </button>
                                    ))}
                                </div>

                                {isResultPhase && <EditFooter />}
                            </section>
                        ) : (
                            <SetupBar n={2} label="評価観点" value={activeModeLabel} onClick={() => setOpenStep(2)} />
                        )}

                        {/* ━━━ ③ 評価の厳しさ ━━━ */}
                        {isStepOpen(3) ? (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                <StepHeader n={3} title="評価の厳しさ" hint="どれくらい？"
                                    collapsible={isResultPhase} onToggle={() => setOpenStep(openStep === 3 ? null : 3)} />

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {STRICTNESS_LEVELS.map((level) => (
                                        <button
                                            key={level.id}
                                            onClick={() => setEvaluationStrictness(level.id)}
                                            className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all ${evaluationStrictness === level.id
                                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 bg-white dark:bg-gray-800'
                                                }`}
                                            title={level.description}
                                        >
                                            <span className={`font-bold text-sm mb-1 ${evaluationStrictness === level.id
                                                ? 'text-orange-700 dark:text-orange-300'
                                                : 'text-gray-700 dark:text-gray-300'
                                                }`}>
                                                {level.label}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 text-left line-clamp-2">
                                                {level.description}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {isResultPhase && <EditFooter />}
                            </section>
                        ) : (
                            <SetupBar n={3} label="評価の厳しさ" value={strictnessLabel} onClick={() => setOpenStep(3)} />
                        )}

                        {/* ━━━ ④ 評価を実行（設定フェーズのみ） ━━━ */}
                        {!isResultPhase && !isEvaluating && (
                            <button
                                onClick={handleEvaluate}
                                disabled={!targetContent.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Play size={18} /> 評価を実行
                            </button>
                        )}

                        {/* ━━━ 結果 ━━━ */}
                        {isEvaluating ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 min-h-[300px]">
                                <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                                    <Loader2 className="animate-spin" size={18} />
                                    <span className="text-sm font-medium font-['Noto_Sans_JP']">評価を実行中...</span>
                                </div>
                                <SkeletonLoader variant="card" lines={6} className="mb-4" />
                                <SkeletonLoader variant="list" lines={3} />
                            </div>
                        ) : result ? (
                            <>
                                {/* セクション区切り */}
                                <div className="flex items-center gap-3 my-1">
                                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                    <span className="text-xs font-semibold text-gray-400">▼ 評価結果</span>
                                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                </div>

                                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* アクションボタン */}
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={handleSave}
                                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <Save size={16} />
                                            プロジェクトに保存
                                        </button>
                                        <button
                                            onClick={handleExport}
                                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <Download size={16} />
                                            MD出力
                                        </button>
                                    </div>

                                    {/* スコアと概要 */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">評価結果</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {modeMap.get(activeMode)?.label || activeMode}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">スコア</span>
                                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{result.score}/{MAX_SCORE}</span>
                                            </div>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                            {result.summary}
                                        </p>
                                    </div>

                                    {/* ペルソナ情報（ペルソナモード時のみ） */}
                                    {result.persona && (
                                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30 p-5">
                                            <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                                                <UserCheck size={18} />
                                                想定ペルソナ
                                            </h4>
                                            <p className="text-sm text-purple-900 dark:text-purple-200 leading-relaxed">
                                                {result.persona}
                                            </p>
                                        </div>
                                    )}

                                    {/* 良い点・改善点 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30 p-5">
                                            <h4 className="font-bold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                                                <ThumbsUp size={18} />
                                                良かった点
                                            </h4>
                                            <ul className="space-y-2">
                                                {result.strengths.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                                                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 p-5">
                                            <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-3 flex items-center gap-2">
                                                <ThumbsDown size={18} />
                                                改善の余地
                                            </h4>
                                            <ul className="space-y-2">
                                                {result.weaknesses.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400">
                                                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* 改善提案 */}
                                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 p-5">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                                            <Lightbulb size={18} />
                                            具体的な改善提案
                                        </h4>
                                        <ul className="space-y-3">
                                            {result.improvements.map((item, i) => (
                                                <li key={i} className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* 詳細分析 */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                            詳細分析レポート
                                        </h4>
                                        <div
                                            className="prose dark:prose-invert max-w-none text-sm"
                                            dangerouslySetInnerHTML={{
                                                __html: mdParser.render(result.detailedAnalysis)
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};
