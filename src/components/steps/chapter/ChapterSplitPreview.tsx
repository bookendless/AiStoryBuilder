import React, { useState, useRef } from 'react';
import {
    X,
    Scissors,
    Loader2,
    Check,
    ChevronRight,
    AlertTriangle,
    Lightbulb
} from 'lucide-react';
import { useProject, Chapter } from '../../../contexts/ProjectContext';
import { useAI } from '../../../contexts/AIContext';
import { useToast } from '../../Toast';
import { useOverlayBackHandler } from '../../../contexts/BackButtonContext';
import { aiService } from '../../../services/aiService';
import { CHAPTER_PROMPT_CAP } from '../../../services/prompts/chapter';
import { parseAIResponse } from '../../../utils/aiResponseParser';

// 分割結果の型定義
interface SplitPart {
    partNumber: number;
    suggestedTitle: string;
    summary: string;
    setting: string;
    mood: string;
    keyEvents: string[];
    characters: string[];
    transitionHint: string;
}

interface SplitResult {
    canSplit: boolean;
    splitReason: string;
    splitParts: SplitPart[];
    splitBenefits: string[];
    splitRisks: string[];
    alternativeSuggestion?: string;
}

interface ChapterSplitPreviewProps {
    isOpen: boolean;
    chapter: Chapter;
    chapterIndex: number;
    onClose: () => void;
    onApplySplit: (newChapters: Chapter[]) => void;
}

export const ChapterSplitPreview: React.FC<ChapterSplitPreviewProps> = ({
    isOpen,
    chapter,
    chapterIndex,
    onClose,
    onApplySplit,
}) => {
    const { currentProject } = useProject();
    const { settings: aiSettings } = useAI();
    const { showError, showSuccess } = useToast();

    // 状態管理
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<SplitResult | null>(null);
    const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set());

    const modalRef = useRef<HTMLDivElement>(null);

    // Android戻るボタン対応
    useOverlayBackHandler(isOpen, onClose, 'chapter-split-modal', 96);

    // 分割提案を生成
    const handleGenerate = async () => {
        if (!currentProject) return;

        setIsGenerating(true);
        setResult(null);

        try {
            // キャラクター名を取得
            const chapterCharacterIds = chapter.characters || [];
            const characterNames = chapterCharacterIds.map(id => {
                const char = currentProject.characters.find(c => c.id === id);
                return char?.name || id;
            });

            // プロンプト変数を構築
            const promptVariables = {
                title: currentProject.title,
                mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
                chapterNumber: String(chapterIndex + 1),
                chapterTitle: chapter.title,
                chapterSummary: chapter.summary || '未設定',
                chapterSetting: chapter.setting || '未設定',
                chapterMood: chapter.mood || '未設定',
                chapterKeyEvents: chapter.keyEvents?.join('、') || '未設定',
                chapterCharacters: characterNames.join('、') || '未設定',
            };

            const prompt = aiService.buildPrompt('chapter', 'suggestSplit', promptVariables);

            const response = await aiService.generateContent({
                prompt,
                type: 'chapter',
                settings: aiSettings,
                maxPromptLength: CHAPTER_PROMPT_CAP,
            });

            if (response.error) {
                throw new Error(response.error);
            }

            if (!response.content) {
                throw new Error('AIからの応答が空です');
            }

            // JSONをパース
            const parsed = parseAIResponse(response.content, 'json');
            if (!parsed.success || !parsed.data) {
                throw new Error(parsed.error || 'AI応答の解析に失敗しました');
            }

            const splitResult = parsed.data as SplitResult;
            setResult(splitResult);

            // すべてのパーツを選択状態にする
            if (splitResult.splitParts) {
                setSelectedParts(new Set(splitResult.splitParts.map(p => p.partNumber)));
            }

            if (splitResult.canSplit) {
                showSuccess('分割提案を生成しました');
            } else {
                showSuccess('分析が完了しました');
            }
        } catch (error) {
            console.error('Chapter split error:', error);
            const errorMessage = error instanceof Error ? error.message : '分割提案の生成に失敗しました';
            showError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    // 分割を適用
    const handleApplySplit = () => {
        if (!result || !result.canSplit || result.splitParts.length === 0) return;

        // 選択されたパーツから新しい章を作成
        const newChapters: Chapter[] = result.splitParts
            .filter(part => selectedParts.has(part.partNumber))
            .map((part, idx) => ({
                id: `${chapter.id}-split-${idx}-${Date.now()}`,
                title: part.suggestedTitle,
                summary: part.summary,
                setting: part.setting,
                mood: part.mood,
                keyEvents: part.keyEvents,
                characters: part.characters.map(name => {
                    // キャラクター名からIDを逆引き
                    const char = currentProject?.characters.find(c => c.name === name);
                    return char?.id || name;
                }),
                foreshadowingRefs: chapter.foreshadowingRefs, // 伏線参照を引き継ぐ
            }));

        if (newChapters.length === 0) {
            showError('少なくとも1つのパーツを選択してください');
            return;
        }

        onApplySplit(newChapters);
        showSuccess(`章を${newChapters.length}つに分割しました`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={modalRef}
                className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
            >
                {/* ヘッダー */}
                <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-lg">
                                <Scissors className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                    章の分割提案
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                    第{chapterIndex + 1}章: {chapter.title}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 現在の章情報 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                            現在の章内容
                        </h4>
                        <div className="space-y-2 text-sm">
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="font-medium">概要:</span> {chapter.summary || '未設定'}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                <span className="font-medium">重要な出来事:</span> {chapter.keyEvents?.join('、') || '未設定'}
                            </p>
                        </div>
                    </div>

                    {/* 生成ボタン */}
                    {!result && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="font-['Noto_Sans_JP']">分析中...</span>
                                </>
                            ) : (
                                <>
                                    <Scissors className="h-5 w-5" />
                                    <span className="font-['Noto_Sans_JP']">AIで分割案を生成</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* 結果表示 */}
                    {result && (
                        <div className="space-y-4">
                            {/* 分割可否 */}
                            <div className={`p-4 rounded-lg ${result.canSplit
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                }`}>
                                <p className={`text-sm font-medium font-['Noto_Sans_JP'] ${result.canSplit ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
                                    }`}>
                                    {result.canSplit ? '✓ 分割可能' : '⚠ 分割は推奨しません'}
                                </p>
                                <p className={`text-sm mt-1 font-['Noto_Sans_JP'] ${result.canSplit ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'
                                    }`}>
                                    {result.splitReason}
                                </p>
                            </div>

                            {/* 分割パーツ */}
                            {result.canSplit && result.splitParts.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                        分割案 ({result.splitParts.length}パート)
                                    </h4>

                                    <div className="flex items-center space-x-2">
                                        {result.splitParts.map((part, idx) => (
                                            <React.Fragment key={part.partNumber}>
                                                <div
                                                    className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedParts.has(part.partNumber)
                                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-amber-300'
                                                        }`}
                                                    onClick={() => {
                                                        const newSet = new Set(selectedParts);
                                                        if (newSet.has(part.partNumber)) {
                                                            newSet.delete(part.partNumber);
                                                        } else {
                                                            newSet.add(part.partNumber);
                                                        }
                                                        setSelectedParts(newSet);
                                                    }}
                                                >
                                                    <div className="flex items-start space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedParts.has(part.partNumber)}
                                                            onChange={() => { }}
                                                            className="h-4 w-4 text-amber-600 rounded mt-1"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                                                                {part.suggestedTitle}
                                                            </p>
                                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 font-['Noto_Sans_JP']">
                                                                {part.summary}
                                                            </p>
                                                            {part.keyEvents.length > 0 && (
                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                    {part.keyEvents.slice(0, 2).map((event, i) => (
                                                                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-['Noto_Sans_JP']">
                                                                            {event}
                                                                        </span>
                                                                    ))}
                                                                    {part.keyEvents.length > 2 && (
                                                                        <span className="text-xs text-gray-500">+{part.keyEvents.length - 2}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {part.transitionHint && (
                                                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-['Noto_Sans_JP']">
                                                                    💡 {part.transitionHint}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {idx < result.splitParts.length - 1 && (
                                                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* メリット */}
                            {result.splitBenefits && result.splitBenefits.length > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Lightbulb className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                                            分割のメリット
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {result.splitBenefits.map((benefit, idx) => (
                                            <li key={idx} className="text-sm text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                                                • {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* リスク */}
                            {result.splitRisks && result.splitRisks.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        <span className="text-sm font-medium text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                                            注意点
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {result.splitRisks.map((risk, idx) => (
                                            <li key={idx} className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                                                • {risk}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 代替案 */}
                            {result.alternativeSuggestion && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">
                                        💡 代替案
                                    </p>
                                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-['Noto_Sans_JP']">
                                        {result.alternativeSuggestion}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-6 border-t border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/20 transition-colors font-['Noto_Sans_JP']"
                        >
                            キャンセル
                        </button>
                        {result && result.canSplit && result.splitParts.length > 0 && (
                            <button
                                onClick={handleApplySplit}
                                disabled={selectedParts.size === 0}
                                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-['Noto_Sans_JP']"
                            >
                                <Check className="h-5 w-5" />
                                <span>分割を適用</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
