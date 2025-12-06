import React, { useState, useCallback, useMemo } from 'react';
import { Sparkles, FileText, CheckCircle, BookOpen, Loader } from 'lucide-react';
import { useProject, Project } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { aiService } from '../../services/aiService';
import { getUserFriendlyError } from '../../utils/errorHandler';

/**
 * SynopsisAssistantPanel - ツールサイドバー用のあらすじAI支援パネル
 * ProjectContextから直接synopsis状態を読み書きし、SynopsisStepと同期します。
 */
export const SynopsisAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess, showError, showErrorWithDetails } = useToast();

    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
    const [isGeneratingFullSynopsis, setIsGeneratingFullSynopsis] = useState(false);
    const [activeStyleType, setActiveStyleType] = useState<string | null>(null);

    // 現在のシノプシスをProjectContextから取得
    const synopsis = currentProject?.synopsis || '';

    // シノプシスを更新する関数
    const updateSynopsis = useCallback((newSynopsis: string) => {
        if (currentProject) {
            updateProject({ synopsis: newSynopsis });
        }
    }, [currentProject, updateProject]);

    // キャラクター情報を構築する関数
    const buildCharactersInfo = useCallback((characters: Project['characters']) => {
        if (!characters || characters.length === 0) {
            return 'キャラクター情報が設定されていません';
        }
        return characters.map(c =>
            `【${c.name}】\n` +
            `役割: ${c.role}\n` +
            `外見: ${c.appearance || '未設定'}\n` +
            `性格: ${c.personality || '未設定'}\n` +
            `背景: ${c.background || '未設定'}\n`
        ).join('\n');
    }, []);

    // プロット基本設定情報を構築する関数
    const buildBasicPlotInfo = useCallback((plot: Project['plot']) => {
        if (!plot) return '';
        return [
            `メインテーマ: ${plot.theme || '未設定'}`,
            `舞台設定: ${plot.setting || '未設定'}`,
            `フック要素: ${plot.hook || '未設定'}`,
            `主人公の目標: ${plot.protagonistGoal || '未設定'}`,
            `主要な障害: ${plot.mainObstacle || '未設定'}`
        ].join('\n');
    }, []);

    // PlotStep2の詳細構成情報を構築する関数
    const buildDetailedStructureInfo = useCallback((plot: Project['plot']) => {
        if (!plot) return '物語構造の詳細が設定されていません';

        switch (plot.structure) {
            case 'kishotenketsu':
                return [
                    `【起承転結構成】`,
                    `起（導入）: ${plot.ki || '未設定'}`,
                    `承（展開）: ${plot.sho || '未設定'}`,
                    `転（転換）: ${plot.ten || '未設定'}`,
                    `結（結末）: ${plot.ketsu || '未設定'}`
                ].join('\n');
            case 'three-act':
                return [
                    `【三幕構成】`,
                    `第1幕（導入）: ${plot.act1 || '未設定'}`,
                    `第2幕（展開）: ${plot.act2 || '未設定'}`,
                    `第3幕（結末）: ${plot.act3 || '未設定'}`
                ].join('\n');
            default:
                return '物語構造の詳細が設定されていません';
        }
    }, []);

    // プロジェクトの基本情報を構築する関数
    const buildProjectInfo = useCallback((project: Project | null) => {
        if (!project) return '';
        return [
            `作品タイトル: ${project.title || '無題'}`,
            `メインジャンル: ${project.mainGenre || project.genre || '未設定'}`,
            `サブジャンル: ${project.subGenre || '未設定'}`,
            `ターゲット読者: ${project.targetReader || '未設定'}`,
            `プロジェクトテーマ: ${project.projectTheme || '未設定'}`,
            `作品説明: ${project.description || '未設定'}`
        ].join('\n');
    }, []);

    // 章立て情報を構築する関数
    const buildChaptersInfo = useCallback((chapters: Project['chapters'], characters: Project['characters']) => {
        if (!chapters || chapters.length === 0) return '';

        return chapters.map((chapter, index) => {
            const characterNames = chapter.characters
                ? chapter.characters.map(id => {
                    const char = characters.find(c => c.id === id);
                    return char ? char.name : id;
                }).join('、')
                : '未設定';

            return `【第${index + 1}章: ${chapter.title}】
概要: ${chapter.summary || '未設定'}
登場キャラクター: ${characterNames}`;
        }).join('\n\n');
    }, []);

    // メモ化されたプロンプト構築用の情報
    const promptVariables = useMemo(() => {
        if (!currentProject) return null;

        const charactersInfo = buildCharactersInfo(currentProject.characters);
        const basicPlotInfo = buildBasicPlotInfo(currentProject.plot);
        const detailedStructureInfo = buildDetailedStructureInfo(currentProject.plot);
        const projectInfo = buildProjectInfo(currentProject);

        return {
            title: currentProject.title || '無題',
            projectInfo,
            characters: charactersInfo,
            basicPlotInfo,
            detailedStructureInfo,
        };
    }, [currentProject, buildCharactersInfo, buildBasicPlotInfo, buildDetailedStructureInfo, buildProjectInfo]);

    // 全体あらすじ生成用の変数をメモ化
    const fullSynopsisVariables = useMemo(() => {
        if (!currentProject || !promptVariables) return null;
        if (!currentProject.chapters || currentProject.chapters.length === 0) return null;

        const chaptersInfo = buildChaptersInfo(currentProject.chapters, currentProject.characters);

        return {
            ...promptVariables,
            chaptersInfo,
        };
    }, [currentProject, promptVariables, buildChaptersInfo]);

    const handleAIGenerate = async () => {
        if (!isConfigured) {
            showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
            return;
        }

        if (!promptVariables) {
            showError('プロジェクト情報が不足しています。');
            return;
        }

        setIsGenerating(true);

        try {
            const prompt = aiService.buildPrompt('synopsis', 'generate', promptVariables);

            const response = await aiService.generateContent({
                prompt,
                type: 'synopsis',
                settings,
            });

            if (response.error) {
                const errorInfo = getUserFriendlyError(response.error);
                showErrorWithDetails(errorInfo.title, errorInfo.message, errorInfo.details);
                return;
            }

            updateSynopsis(response.content);
            showSuccess('あらすじを生成しました');
        } catch (error) {
            console.error('AI generation error:', error);
            showError('AI生成中にエラーが発生しました');
        } finally {
            setIsGenerating(false);
        }
    };

    // 文体調整AI機能
    const handleStyleAdjustment = async (styleType: string) => {
        if (!isConfigured) {
            showError('AI設定が必要です。');
            return;
        }

        if (!synopsis.trim()) {
            showError('あらすじが入力されていません。先にあらすじを入力してください。');
            return;
        }

        setIsGeneratingStyle(true);
        setActiveStyleType(styleType);

        try {
            let prompt = '';

            if (styleType === 'readable') {
                prompt = aiService.buildPrompt('synopsis', 'improveReadable', { synopsis });
            } else if (styleType === 'summary') {
                prompt = aiService.buildPrompt('synopsis', 'improveSummary', { synopsis });
            } else if (styleType === 'engaging') {
                prompt = aiService.buildPrompt('synopsis', 'improveEngaging', { synopsis });
            }

            const response = await aiService.generateContent({
                prompt,
                type: 'synopsis',
                settings,
            });

            if (response.error) {
                const errorInfo = getUserFriendlyError(response.error);
                showErrorWithDetails(errorInfo.title, errorInfo.message, errorInfo.details);
                return;
            }

            updateSynopsis(response.content);
            showSuccess(`文体を調整しました（${styleType}）`);
        } catch (error) {
            console.error('Style adjustment error:', error);
            showError('文体調整中にエラーが発生しました');
        } finally {
            setIsGeneratingStyle(false);
            setActiveStyleType(null);
        }
    };

    // 全体あらすじ生成機能
    const handleGenerateFullSynopsis = async () => {
        if (!isConfigured) {
            showError('AI設定が必要です。');
            return;
        }

        if (!currentProject?.chapters || currentProject.chapters.length === 0) {
            showError('章立てが必要です。まず章立てを作成してください。');
            return;
        }

        if (!fullSynopsisVariables) {
            showError('プロジェクト情報が不足しています。');
            return;
        }

        setIsGeneratingFullSynopsis(true);

        try {
            const prompt = aiService.buildPrompt('synopsis', 'generateFullSynopsis', fullSynopsisVariables);

            const response = await aiService.generateContent({
                prompt,
                type: 'synopsis',
                settings,
            });

            if (response.error) {
                const errorInfo = getUserFriendlyError(response.error);
                showErrorWithDetails(errorInfo.title, errorInfo.message, errorInfo.details);
                return;
            }

            updateSynopsis(response.content);
            showSuccess('全体あらすじを生成しました');
        } catch (error) {
            console.error('Full synopsis generation error:', error);
            showError('全体あらすじ生成中にエラーが発生しました');
        } finally {
            setIsGeneratingFullSynopsis(false);
        }
    };

    const isAnyLoading = isGenerating || isGeneratingStyle || isGeneratingFullSynopsis;

    if (!currentProject) return null;

    return (
        <div className="space-y-4">
            {/* AIあらすじ提案（メイン） */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-indigo-500" />
                    AIあらすじ提案
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-3">
                    プロジェクト設定に基づき、あらすじを自動生成します。
                </p>
                <button
                    onClick={handleAIGenerate}
                    disabled={isAnyLoading || !isConfigured}
                    className="w-full px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                >
                    {isGenerating ? (
                        <>
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>生成中...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4" />
                            <span>あらすじをAI提案</span>
                        </>
                    )}
                </button>
            </div>

            {/* 文体調整 */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                    文体調整
                </h3>
                <div className="space-y-2">
                    <button
                        onClick={() => handleStyleAdjustment('readable')}
                        disabled={isAnyLoading || !synopsis.trim()}
                        className={`w-full p-2 rounded-lg transition-all duration-200 text-left ${isAnyLoading || !synopsis.trim()
                                ? 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
                                : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-blue-700 dark:text-blue-300 text-xs font-['Noto_Sans_JP']">
                                    読みやすく調整
                                </div>
                                <div className="text-xs text-blue-500 dark:text-blue-400 font-['Noto_Sans_JP']">
                                    文章を整理して理解しやすく
                                </div>
                            </div>
                            {isGeneratingStyle && activeStyleType === 'readable' ? (
                                <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4 text-blue-500" />
                            )}
                        </div>
                    </button>

                    <button
                        onClick={() => handleStyleAdjustment('summary')}
                        disabled={isAnyLoading || !synopsis.trim()}
                        className={`w-full p-2 rounded-lg transition-all duration-200 text-left ${isAnyLoading || !synopsis.trim()
                                ? 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
                                : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-green-700 dark:text-green-300 text-xs font-['Noto_Sans_JP']">
                                    要点抽出
                                </div>
                                <div className="text-xs text-green-500 dark:text-green-400 font-['Noto_Sans_JP']">
                                    重要なポイントを抽出
                                </div>
                            </div>
                            {isGeneratingStyle && activeStyleType === 'summary' ? (
                                <Loader className="h-4 w-4 text-green-500 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* 全体あらすじ生成 */}
            {currentProject?.chapters && currentProject.chapters.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                        <BookOpen className="h-4 w-4 mr-2 text-orange-500" />
                        全体あらすじ生成
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                        章立てを参照し、全体あらすじを作成します。
                    </p>
                    <button
                        onClick={handleGenerateFullSynopsis}
                        disabled={isAnyLoading || !isConfigured}
                        className="w-full px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                    >
                        {isGeneratingFullSynopsis ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin" />
                                <span>生成中...</span>
                            </>
                        ) : (
                            <>
                                <BookOpen className="h-4 w-4" />
                                <span>全体あらすじを生成</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* 進捗状況 */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-1">
                    進捗状況
                </h3>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">文字数</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                        {synopsis.length} / 500
                    </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${synopsis.length >= 500
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            }`}
                        style={{ width: `${Math.min((synopsis.length / 500) * 100, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
