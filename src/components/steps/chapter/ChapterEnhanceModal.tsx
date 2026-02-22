import React, { useState, useRef, useMemo } from 'react';
import {
    X,
    Sparkles,
    Globe,
    Calendar,
    Palette,
    Wand2,
    Loader2,
    Check,
    Scissors,
    ChevronDown,
    ChevronUp,
    Bookmark,
    AlertCircle,
    BookOpen,
    Zap,
    FileText
} from 'lucide-react';
import { useProject, Chapter, Foreshadowing } from '../../../contexts/ProjectContext';
import { useAI } from '../../../contexts/AIContext';
import { useToast } from '../../Toast';
import { useOverlayBackHandler } from '../../../contexts/BackButtonContext';
import { aiService } from '../../../services/aiService';
import { parseAIResponse } from '../../../utils/aiResponseParser';

// 強化タイプの定義
type EnhanceType = 'comprehensive' | 'deepen';

interface EnhanceTypeOption {
    id: EnhanceType;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const enhanceTypeOptions: EnhanceTypeOption[] = [
    {
        id: 'comprehensive',
        label: '強化',
        description: '現在の章を豊かにする',
        icon: <Wand2 className="h-5 w-5" />,
    },
    {
        id: 'deepen',
        label: '深掘り',
        description: '物語を展開させる新章を提案',
        icon: <BookOpen className="h-5 w-5" />,
    },
];

// AI応答の型定義
interface EnhanceResult {
    enhancedSummary: string;
    enhancedSetting: string;
    enhancedMood: string;
    enhancedKeyEvents: Array<{
        original: string;
        enhanced: string;
        sceneHint: string;
    }>;
    atmosphereElements: Array<{
        element: string;
        effect: string;
    }>;
    foreshadowingOpportunities: Array<{
        point: string;
        suggestion: string;
    }>;
    splitRecommendation: {
        shouldSplit: boolean;
        reason: string;
    };
    suggestions?: Array<{
        type: 'inner_depth' | 'outer_progression';
        title: string;
        summary: string;
        setting: string;
        mood: string;
        keyEvents: string[];
        characters: string[];
        reason: string;
    }>;
}

interface ChapterEnhanceModalProps {
    isOpen: boolean;
    chapter: Chapter;
    chapterIndex: number;
    onClose: () => void;
    onApply: (updates: Partial<Chapter>) => void;

    onRequestSplit: (chapter: Chapter) => void;
    onInsertChapter?: (chapterData: Partial<Chapter>) => void;
}

export const ChapterEnhanceModal: React.FC<ChapterEnhanceModalProps> = ({
    isOpen,
    chapter,
    chapterIndex,
    onClose,
    onApply,

    onRequestSplit,
    onInsertChapter,
}) => {
    const { currentProject } = useProject();
    const { settings: aiSettings } = useAI();
    const { showError, showSuccess } = useToast();

    // 状態管理
    const [selectedType, setSelectedType] = useState<EnhanceType>('comprehensive');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<EnhanceResult | null>(null);
    const [isApplied, setIsApplied] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'setting', 'mood', 'events']));
    const [selectedUpdates, setSelectedUpdates] = useState<{
        summary: boolean;
        setting: boolean;
        mood: boolean;
        keyEvents: Set<number>;
    }>({
        summary: true,
        setting: true,
        mood: true,
        keyEvents: new Set(),
    });
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);

    // Android戻るボタン対応
    useOverlayBackHandler(isOpen, onClose, 'chapter-enhance-modal', 95);

    // 関連する伏線を取得
    const relatedForeshadowings = useMemo(() => {
        if (!currentProject) return [];
        return currentProject.foreshadowings?.filter(f =>
            f.points.some(p => p.chapterId === chapter.id) ||
            chapter.foreshadowingRefs?.includes(f.id)
        ) || [];
    }, [currentProject, chapter]);

    // toggleSection
    const toggleSection = (sectionId: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(sectionId)) {
            newSet.delete(sectionId);
        } else {
            newSet.add(sectionId);
        }
        setExpandedSections(newSet);
    };

    // AI強化を実行
    const handleGenerate = async () => {
        if (!currentProject) return;

        setIsGenerating(true);
        setResult(null);
        setSelectedSuggestionIndex(null);

        try {
            // キャラクター詳細を構築
            const chapterCharacterIds = chapter.characters || [];
            const characterDetails = currentProject.characters
                .filter(c => chapterCharacterIds.includes(c.id) || chapterCharacterIds.includes(c.name))
                .map(c => `- ${c.name}（${c.role}）: ${c.personality || '性格未設定'}`)
                .join('\n') || '未設定';

            // 伏線情報を構築
            const foreshadowingInfo = relatedForeshadowings
                .map(f => `- ${f.title}: ${f.description}`)
                .join('\n') || 'なし';

            // 強化タイプのラベル
            const enhanceTypeLabel = enhanceTypeOptions.find(o => o.id === selectedType)?.label || '総合';

            // プロンプト変数を構築
            const promptVariables = {
                title: currentProject.title,
                mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
                chapterTitle: chapter.title,
                chapterSummary: chapter.summary || '未設定',
                chapterSetting: chapter.setting || '未設定',
                chapterMood: chapter.mood || '未設定',
                chapterKeyEvents: chapter.keyEvents?.join('、') || '未設定',
                chapterCharacters: chapterCharacterIds.join('、') || '未設定',
                characterDetails,
                relatedForeshadowings: foreshadowingInfo,
                enhanceType: enhanceTypeLabel,
            };



            const promptName = selectedType === 'deepen' ? 'deepenChapter' : 'enhanceChapter';
            const prompt = aiService.buildPrompt('chapter', promptName, promptVariables);

            const response = await aiService.generateContent({
                prompt,
                type: 'chapter',
                settings: aiSettings,
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

            const enhanceResult = parsed.data as EnhanceResult;
            setResult(enhanceResult);

            // すべてのkeyEventsを選択状態にする
            if (enhanceResult.enhancedKeyEvents) {
                setSelectedUpdates(prev => ({
                    ...prev,
                    keyEvents: new Set(enhanceResult.enhancedKeyEvents.map((_, i) => i)),
                }));
            }

            showSuccess('章の強化案を生成しました');
        } catch (error) {
            console.error('Chapter enhance error:', error);
            const errorMessage = error instanceof Error ? error.message : '章の強化に失敗しました';
            showError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    // 選択した提案を挿入
    const handleInsertSuggestion = () => {
        if (!result || !result.suggestions || selectedSuggestionIndex === null || !onInsertChapter) return;

        const suggestion = result.suggestions[selectedSuggestionIndex];

        onInsertChapter({
            title: suggestion.title,
            summary: suggestion.summary,
            setting: suggestion.setting,
            mood: suggestion.mood,
            keyEvents: suggestion.keyEvents,
            characters: suggestion.characters,
        });

        // モーダルを閉じる
        onClose();
    };

    // 選択した内容を適用
    const handleApply = () => {
        if (!result) return;

        const updates: Partial<Chapter> = {};

        // 概要の更新
        if (selectedUpdates.summary && result.enhancedSummary) {
            updates.summary = result.enhancedSummary;
        }

        // 設定の更新
        if (selectedUpdates.setting && result.enhancedSetting) {
            updates.setting = result.enhancedSetting;
        }

        // ムードの更新
        if (selectedUpdates.mood && result.enhancedMood) {
            updates.mood = result.enhancedMood;
        }

        // keyEventsの更新
        if (selectedUpdates.keyEvents.size > 0 && result.enhancedKeyEvents) {
            const newKeyEvents = chapter.keyEvents ? [...chapter.keyEvents] : [];

            // 選択された強化をマージ
            result.enhancedKeyEvents.forEach((enhanced, index) => {
                if (selectedUpdates.keyEvents.has(index)) {
                    // 元の出来事のインデックスを探す
                    const originalIndex = newKeyEvents.findIndex(e => e === enhanced.original);
                    if (originalIndex >= 0) {
                        newKeyEvents[originalIndex] = enhanced.enhanced;
                    } else {
                        // 見つからない場合は追加
                        newKeyEvents.push(enhanced.enhanced);
                    }
                }
            });

            updates.keyEvents = newKeyEvents;
        }

        onApply(updates);
        setIsApplied(true);
        showSuccess('章の内容を更新しました');
        // モーダルは閉じない（分割機能を使えるようにするため）
    };

    // AI提案をメモとして保存
    const handleSaveSuggestionsAsNote = () => {
        if (!result) return;

        const timestamp = new Date().toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        let suggestions = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📝 AI提案メモ（${timestamp}）\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        // 雰囲気要素
        if (result.atmosphereElements && result.atmosphereElements.length > 0) {
            suggestions += `\n■ 雰囲気演出の提案\n`;
            result.atmosphereElements.forEach((elem) => {
                suggestions += `  • ${elem.element}: ${elem.effect}\n`;
            });
        }

        // 伏線挿入ポイント
        if (result.foreshadowingOpportunities && result.foreshadowingOpportunities.length > 0) {
            suggestions += `\n■ 伏線挿入ポイント\n`;
            result.foreshadowingOpportunities.forEach((opp) => {
                suggestions += `  ▶ ${opp.point}\n`;
                suggestions += `    └ ${opp.suggestion}\n`;
            });
        }

        // シーンヒント（keyEventsから）
        const sceneHints = result.enhancedKeyEvents?.filter(e => e.sceneHint) || [];
        if (sceneHints.length > 0) {
            suggestions += `\n■ シーン描写のヒント\n`;
            sceneHints.forEach((event) => {
                suggestions += `  💡 ${event.enhanced}: ${event.sceneHint}\n`;
            });
        }

        suggestions += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        // 既存のdraftに追記
        const currentDraft = chapter.draft || '';
        const updatedDraft = currentDraft + suggestions;

        onApply({ draft: updatedDraft });
        showSuccess('AI提案をメモとして保存しました');
    };

    // 分割をリクエスト
    const handleRequestSplit = () => {
        onRequestSplit(chapter);
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
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                                <Sparkles className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                    AIで章を強化
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
                    {/* 強化タイプ選択 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                            強化タイプを選択
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {enhanceTypeOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setSelectedType(option.id)}
                                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${selectedType === option.id
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                        }`}
                                >
                                    <div className={`${selectedType === option.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {option.icon}
                                    </div>
                                    <span className={`text-sm font-bold mt-1 font-['Noto_Sans_JP'] ${selectedType === option.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'
                                        }`}>
                                        {option.label}
                                    </span>
                                    <span className={`text-xs mt-1 text-center font-['Noto_Sans_JP'] ${selectedType === option.id ? 'text-purple-600/80 dark:text-purple-300/80' : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                        {option.description}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 関連伏線表示 */}
                    {relatedForeshadowings.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <Bookmark className="h-4 w-4 text-rose-500" />
                                <span className="text-sm font-medium text-rose-700 dark:text-rose-300 font-['Noto_Sans_JP']">
                                    関連する伏線 ({relatedForeshadowings.length}件)
                                </span>
                            </div>
                            <div className="space-y-1">
                                {relatedForeshadowings.map((f: Foreshadowing) => (
                                    <div key={f.id} className="text-sm text-rose-600 dark:text-rose-400 font-['Noto_Sans_JP']">
                                        • {f.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 生成ボタン */}
                    {!result && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="font-['Noto_Sans_JP']">生成中...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    <span className="font-['Noto_Sans_JP']">AIで強化案を生成</span>
                                </>
                            )}
                        </button>

                    )}

                    {/* 深掘り提案の表示 */}
                    {result && selectedType === 'deepen' && result.suggestions && (
                        <div className="space-y-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                <BookOpen className="h-5 w-5 mr-2 text-indigo-500" />
                                次の章の展開案（2案）
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.suggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedSuggestionIndex(index)}
                                        className={`cursor-pointer rounded-xl border-2 transition-all p-4 ${selectedSuggestionIndex === index
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 ring-opacity-50'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold font-['Noto_Sans_JP'] ${suggestion.type === 'inner_depth'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                                }`}>
                                                {suggestion.type === 'inner_depth' ? '案1: 内面・静的展開' : '案2: 外面・動的展開'}
                                            </span>
                                            {selectedSuggestionIndex === index && (
                                                <div className="bg-indigo-500 rounded-full p-1">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        <h5 className="font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 line-clamp-2 min-h-[3rem]">
                                            {suggestion.title}
                                        </h5>

                                        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2 mb-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-1">
                                                <Zap className="h-3 w-3 inline mr-1" />
                                                推奨理由
                                            </p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] text-xs">
                                                {suggestion.reason}
                                            </p>
                                        </div>

                                        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-4 border-t border-gray-100 dark:border-gray-700 pt-2">
                                            {suggestion.summary}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 結果表示 (深掘り以外) */}
                    {result && selectedType !== 'deepen' && (
                        <div className="space-y-4">
                            {/* 概要 */}
                            {result.enhancedSummary && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('summary')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUpdates.summary}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUpdates(prev => ({ ...prev, summary: !prev.summary }));
                                                }}
                                                className="h-4 w-4 text-purple-600 rounded"
                                            />
                                            <FileText className="h-5 w-5 text-indigo-500" />
                                            <span className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">概要</span>
                                        </div>
                                        {expandedSections.has('summary') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {expandedSections.has('summary') && (
                                        <div className="px-4 pb-4">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP']">
                                                    {result.enhancedSummary}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 設定・場所 */}
                            {result.enhancedSetting && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('setting')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUpdates.setting}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUpdates(prev => ({ ...prev, setting: !prev.setting }));
                                                }}
                                                className="h-4 w-4 text-purple-600 rounded"
                                            />
                                            <Globe className="h-5 w-5 text-blue-500" />
                                            <span className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">設定・場所</span>
                                        </div>
                                        {expandedSections.has('setting') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {expandedSections.has('setting') && (
                                        <div className="px-4 pb-4">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP']">
                                                    {result.enhancedSetting}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 雰囲気・ムード */}
                            {result.enhancedMood && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('mood')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUpdates.mood}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUpdates(prev => ({ ...prev, mood: !prev.mood }));
                                                }}
                                                className="h-4 w-4 text-purple-600 rounded"
                                            />
                                            <Palette className="h-5 w-5 text-purple-500" />
                                            <span className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">雰囲気・ムード</span>
                                        </div>
                                        {expandedSections.has('mood') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {expandedSections.has('mood') && (
                                        <div className="px-4 pb-4">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                                    {result.enhancedMood}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 強化されたkeyEvents */}
                            {result.enhancedKeyEvents && result.enhancedKeyEvents.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('events')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Calendar className="h-5 w-5 text-green-500" />
                                            <span className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                                重要な出来事 ({result.enhancedKeyEvents.length}件)
                                            </span>
                                        </div>
                                        {expandedSections.has('events') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {expandedSections.has('events') && (
                                        <div className="px-4 pb-4 space-y-3">
                                            {result.enhancedKeyEvents.map((event, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                    <div className="flex items-start space-x-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUpdates.keyEvents.has(idx)}
                                                            onChange={() => {
                                                                const newSet = new Set(selectedUpdates.keyEvents);
                                                                if (newSet.has(idx)) {
                                                                    newSet.delete(idx);
                                                                } else {
                                                                    newSet.add(idx);
                                                                }
                                                                setSelectedUpdates(prev => ({ ...prev, keyEvents: newSet }));
                                                            }}
                                                            className="h-4 w-4 text-purple-600 rounded mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-1">
                                                                元: {event.original}
                                                            </p>
                                                            <p className="text-sm text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP'] font-medium">
                                                                → {event.enhanced}
                                                            </p>
                                                            {event.sceneHint && (
                                                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-['Noto_Sans_JP']">
                                                                    💡 {event.sceneHint}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 伏線挿入ポイント */}
                            {result.foreshadowingOpportunities && result.foreshadowingOpportunities.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('foreshadowing')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Bookmark className="h-5 w-5 text-rose-500" />
                                            <span className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                                伏線挿入ポイント ({result.foreshadowingOpportunities.length}件)
                                            </span>
                                        </div>
                                        {expandedSections.has('foreshadowing') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {expandedSections.has('foreshadowing') && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {result.foreshadowingOpportunities.map((opp, idx) => (
                                                <div key={idx} className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300 font-['Noto_Sans_JP']">
                                                        {opp.point}
                                                    </p>
                                                    <p className="text-sm text-rose-600 dark:text-rose-400 mt-1 font-['Noto_Sans_JP']">
                                                        {opp.suggestion}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 分割推奨 */}
                            {result.splitRecommendation?.shouldSplit && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                    <div className="flex items-start space-x-3">
                                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                                                章の分割を推奨
                                            </p>
                                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 font-['Noto_Sans_JP']">
                                                {result.splitRecommendation.reason}
                                            </p>
                                            <button
                                                onClick={handleRequestSplit}
                                                className="mt-3 flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                                            >
                                                <Scissors className="h-4 w-4" />
                                                <span className="font-['Noto_Sans_JP'] text-sm">分割を提案してもらう</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-6 border-t border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex flex-col space-y-3">
                        {/* 提案保存ボタン */}
                        {result && selectedType !== 'deepen' && (
                            <button
                                onClick={handleSaveSuggestionsAsNote}
                                className="w-full flex items-center justify-center space-x-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-['Noto_Sans_JP'] text-sm"
                            >
                                <Bookmark className="h-4 w-4" />
                                <span>AI提案をメモとして草案に保存</span>
                            </button>
                        )}

                        {/* メイン操作ボタン */}
                        <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/20 transition-colors font-['Noto_Sans_JP']"
                            >
                                閉じる
                            </button>
                            {result && selectedType !== 'deepen' && (
                                <button
                                    onClick={handleApply}
                                    disabled={isApplied}
                                    className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-all font-['Noto_Sans_JP'] ${isApplied
                                        ? 'bg-green-500 text-white cursor-default'
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                                        }`}
                                >
                                    <Check className="h-5 w-5" />
                                    <span>{isApplied ? '適用済み' : '選択した内容を適用'}</span>
                                </button>
                            )}

                            {/* 深掘り用の適用ボタン */}
                            {result && selectedType === 'deepen' && (
                                <button
                                    onClick={handleInsertSuggestion}
                                    disabled={selectedSuggestionIndex === null}
                                    className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-all font-['Noto_Sans_JP'] ${selectedSuggestionIndex !== null
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <BookOpen className="h-5 w-5" />
                                    <span>選択した案で章を作成</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};
