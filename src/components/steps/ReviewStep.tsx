import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { EvaluationMode, EvaluationResult, SavedEvaluation } from '../../types/evaluation';
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
    ChevronRight
} from 'lucide-react';
// @ts-ignore
import MarkdownIt from 'markdown-it';

export const ReviewStep: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess, showError } = useToast();

    const [activeMode, setActiveMode] = useState<EvaluationMode>('structure');
    const [targetContent, setTargetContent] = useState<string>('');
    const [targetType, setTargetType] = useState<'synopsis' | 'chapter' | 'custom'>('synopsis');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    // Markdownパーサーの初期化
    const mdParser = useMemo(() => new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
    }), []);

    // コンテンツの自動設定
    useEffect(() => {
        if (!currentProject) return;

        if (targetType === 'synopsis') {
            setTargetContent(currentProject.synopsis || '');
        } else if (targetType === 'chapter') {
            if (selectedChapterId) {
                const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
                setTargetContent(chapter?.draft || chapter?.summary || '');
            } else if (currentProject.chapters.length > 0) {
                setSelectedChapterId(currentProject.chapters[0].id);
                setTargetContent(currentProject.chapters[0].draft || currentProject.chapters[0].summary || '');
            }
        }
    }, [targetType, selectedChapterId, currentProject]);

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

        try {
            const context = {
                title: currentProject?.title,
                theme: currentProject?.theme,
                genre: currentProject?.mainGenre,
                targetAudience: currentProject?.targetReader,
                characters: currentProject?.characters.map(c => `${c.name}: ${c.role}`).join(', ')
            };

            const evaluationResult = await aiService.evaluateStory({
                mode: activeMode,
                content: targetContent,
                context
            }, settings);

            setResult(evaluationResult);
            showSuccess('評価が完了しました');
        } catch (error) {
            console.error('Evaluation failed:', error);
            showError('評価中にエラーが発生しました');
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleSave = async () => {
        if (!currentProject || !result) return;

        const newEvaluation: SavedEvaluation = {
            ...result,
            id: crypto.randomUUID(),
            date: new Date(),
            mode: activeMode,
            targetType,
            targetTitle: targetType === 'chapter'
                ? currentProject.chapters.find(c => c.id === selectedChapterId)?.title
                : undefined
        };

        const updatedEvaluations = [...(currentProject.evaluations || []), newEvaluation];

        await updateProject({
            evaluations: updatedEvaluations
        });

        showSuccess('評価結果を保存しました');
    };

    const handleExport = () => {
        if (!result) return;

        const content = `# AI評価レポート: ${modes.find(m => m.id === activeMode)?.label}

## 概要
${result.summary}

## スコア: ${result.score}/5

${result.persona ? `## 想定ペルソナ\n${result.persona}\n` : ''}

## 良かった点
${result.strengths.map(s => `- ${s}`).join('\n')}

## 改善の余地
${result.weaknesses.map(w => `- ${w}`).join('\n')}

## 具体的な改善提案
${result.improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

## 詳細分析
${result.detailedAnalysis}
`;

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evaluation_${activeMode}_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('レポートをダウンロードしました');
    };

    const handleDeleteHistory = async (id: string) => {
        if (!currentProject) return;

        const updatedEvaluations = currentProject.evaluations?.filter(e => e.id !== id) || [];
        await updateProject({
            evaluations: updatedEvaluations
        });

        showSuccess('履歴を削除しました');
    };

    const loadHistory = (evaluation: SavedEvaluation) => {
        setResult(evaluation);
        setActiveMode(evaluation.mode);
        setTargetType(evaluation.targetType);
        // コンテンツの復元は完全にはできない（保存していないため）が、結果は表示できる
        setShowHistory(false);
    };

    const modes: { id: EvaluationMode; label: string; icon: React.ReactNode; description: string }[] = [
        { id: 'structure', label: '構造・プロット', icon: <BookOpen size={18} />, description: '物語の構成、一貫性、ペース配分を分析します' },
        { id: 'character', label: 'キャラクター', icon: <Users size={18} />, description: 'キャラクターの動機、成長、独自性を評価します' },
        { id: 'style', label: '文体・表現', icon: <Feather size={18} />, description: '文章の読みやすさ、描写力、五感表現をチェックします' },
        { id: 'persona', label: '読者ペルソナ', icon: <UserCheck size={18} />, description: '想定読者になりきって感想と市場性を評価します' },
    ];

    return (
        <div className="h-full flex flex-col gap-6 p-6 max-w-7xl mx-auto overflow-y-auto">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">作品評価 / Review</h2>
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
                    {currentProject?.evaluations && currentProject.evaluations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentProject.evaluations.slice().reverse().map((evaluation) => (
                                <div key={evaluation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-800/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-medium px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                            {modes.find(m => m.id === evaluation.mode)?.label}
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
                                            {new Date(evaluation.date).toLocaleString()}
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
                    {/* モード選択 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {modes.map((mode) => (
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 左側: 入力エリア */}
                        <div className="lg:col-span-1 flex flex-col gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                    <FileText size={18} />
                                    評価対象
                                </h3>

                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            ソース選択
                                        </label>
                                        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <button
                                                onClick={() => setTargetType('synopsis')}
                                                className={`flex-1 py-2 text-sm font-medium transition-colors ${targetType === 'synopsis'
                                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}
                                            >
                                                あらすじ
                                            </button>
                                            <div className="w-px bg-gray-200 dark:bg-gray-700" />
                                            <button
                                                onClick={() => setTargetType('chapter')}
                                                className={`flex-1 py-2 text-sm font-medium transition-colors ${targetType === 'chapter'
                                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}
                                            >
                                                章
                                            </button>
                                            <div className="w-px bg-gray-200 dark:bg-gray-700" />
                                            <button
                                                onClick={() => setTargetType('custom')}
                                                className={`flex-1 py-2 text-sm font-medium transition-colors ${targetType === 'custom'
                                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}
                                            >
                                                カスタム
                                            </button>
                                        </div>
                                    </div>

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
                                                {currentProject?.chapters.map(chapter => (
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

                                    <button
                                        onClick={handleEvaluate}
                                        disabled={isEvaluating || !targetContent.trim()}
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {isEvaluating ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                評価中...
                                            </>
                                        ) : (
                                            <>
                                                <Play size={18} />
                                                評価を実行
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 右側: 結果表示エリア */}
                        <div className="lg:col-span-2">
                            {result ? (
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
                                                    {modes.find(m => m.id === activeMode)?.label}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">スコア</span>
                                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{result.score}/5</span>
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
                            ) : (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                                        <BookOpen size={32} className="text-indigo-200 dark:text-indigo-800" />
                                    </div>
                                    <p className="text-lg font-medium mb-2">評価結果がここに表示されます</p>
                                    <p className="text-sm">左側のパネルから評価対象を選択し、「評価を実行」ボタンを押してください</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
