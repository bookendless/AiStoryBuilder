import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader, CheckCircle, FileText, UserPlus } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { extractCharactersFromContent, ParseResult } from '../../utils/characterParser';
import { CHARACTER_GENERATION } from '../../constants/character';
import { exportFile } from '../../utils/mobileExportUtils';
import { SuggestionModal, SuggestedCharacter } from '../steps/character/SuggestionModal';
import { generateUUID } from '../../utils/securityUtils';

export const CharacterAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess } = useToast();
    const { handleAPIError } = useErrorHandler();
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestedCharacter[]>([]);
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

    const { aiLogs, addLog } = useAILog({
        projectId: currentProject?.id,
        autoLoad: true,
    });
    const abortControllerRef = useRef<AbortController | null>(null);

    // キャンセルハンドラー
    const handleCancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsGenerating(false);
        }
    }, []);

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    // AIによるキャラクター提案処理
    const handleSuggestCharacters = async () => {
        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                'キャラクター提案',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        if (!currentProject) return;

        // 既存のリクエストをキャンセル
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsGenerating(true);

        try {
            // プロジェクト情報
            const projectInfo = {
                title: currentProject.title || '未設定',
                theme: currentProject.theme || currentProject.projectTheme || '未設定',
                description: currentProject.description || '未設定',
            };

            // プロット情報
            const plotInfo = {
                theme: currentProject.plot?.theme || '',
                setting: currentProject.plot?.setting || '',
                hook: currentProject.plot?.hook || '',
                protagonistGoal: currentProject.plot?.protagonistGoal || '',
                mainObstacle: currentProject.plot?.mainObstacle || '',
            };

            // 既存キャラクターのリスト化
            const existingChars = currentProject.characters.map((c, i) =>
                `${i + 1}. ${c.name} (${c.role}): ${c.personality}`
            ).join('\n') || 'なし';

            // 既存の章情報のリスト化
            const chapterInfo = currentProject.chapters.map((c, i) =>
                `第${i + 1}章: ${c.title}\nあらすじ: ${c.summary}`
            ).join('\n\n') || 'まだ章は作成されていません。';

            const prompt = aiService.buildPrompt('character', 'suggest', {
                title: projectInfo.title,
                theme: projectInfo.theme,
                description: projectInfo.description,
                plotTheme: plotInfo.theme,
                plotSetting: plotInfo.setting,
                plotHook: plotInfo.hook,
                protagonistGoal: plotInfo.protagonistGoal,
                mainObstacle: plotInfo.mainObstacle,
                synopsis: currentProject.synopsis || '',
                existingCharacters: existingChars,
                chapterInfo: chapterInfo,
            });

            const response = await aiService.generateContent({
                prompt,
                type: 'character',
                settings,
                signal: abortController.signal,
            });

            if (abortController.signal.aborted) return;

            if (response.error) {
                addLog({
                    type: 'enhance', // 'suggest' タイプがあればそちらが良いが一旦enhance
                    prompt,
                    response: response.content || '',
                    error: response.error,
                });
                handleAPIError(new Error(response.error), 'キャラクター提案');
                return;
            }

            // 解析処理
            let parsedSuggestions: SuggestedCharacter[] = [];
            const content = response.content;
            let parseError: string | null = null;
            let parseMethod: 'json' | 'text' | 'fallback' = 'text';

            // 1. JSON解析を試行
            try {
                let jsonString = content.trim();
                const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonString = codeBlockMatch[1].trim();
                }
                // 配列を探す
                const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    jsonString = arrayMatch[0];
                }

                const parsed = JSON.parse(jsonString);
                if (Array.isArray(parsed)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    parsedSuggestions = parsed.map((item: any) => ({
                        id: generateUUID(),
                        name: item.name || item.名前 || '',
                        role: item.role || item.役割 || '',
                        appearance: item.appearance || item.外見 || '',
                        personality: item.personality || item.性格 || '',
                        background: item.background || item.背景 || '',
                        reason: item.reason || item.reasonING || item.提案理由 || '',
                        image: '',
                    })).filter(c => c.name); // 名前がないものは除外
                    parseMethod = 'json';
                }
            } catch (e) {
                console.warn('JSON parsing for suggestions failed:', e);
                parseError = e instanceof Error ? e.message : 'Unknown JSON error';
            }

            // 2. JSON失敗時は標準パーサーを使用 (reasonは失われる可能性があるがキャラクターは取得する)
            if (parsedSuggestions.length === 0) {
                const fallbackResult: ParseResult = extractCharactersFromContent(
                    content,
                    5, // 最大5人まで
                    'text'
                );

                if (fallbackResult.characters.length > 0) {
                    parsedSuggestions = fallbackResult.characters.map(c => ({
                        ...c,
                        reason: '（テキスト形式のため理由は自動抽出できませんでした）'
                    }));
                    parseMethod = 'fallback';
                }
            }

            addLog({
                type: 'enhance',
                prompt,
                response: content,
                parsedCharacters: parsedSuggestions,
            });

            if (parsedSuggestions.length > 0) {
                setSuggestions(parsedSuggestions);
                setIsSuggestionModalOpen(true);

                let msg = `${parsedSuggestions.length}人のキャラクターが提案されました`;
                if (parseMethod === 'fallback') {
                    msg += '（JSON解析に失敗したため、テキスト解析を実行しました）';
                }
                showSuccess(msg);
            } else {
                handleAPIError(
                    new Error(`キャラクターの抽出に失敗しました。\n解析エラー: ${parseError || '不明'}`),
                    'キャラクター提案',
                    { showDetails: true }
                );
            }

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            handleAPIError(error, 'キャラクター提案');
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(false);
            }
            abortControllerRef.current = null;
        }
    };

    const handleAIGenerateCharacters = async () => {
        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                'キャラクター生成',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        if (!currentProject) return;

        // 既存のリクエストをキャンセル
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsGenerating(true);

        try {
            // プロジェクト設定から情報を取得
            const projectInfo = {
                title: currentProject.title || '未設定',
                theme: currentProject.theme || currentProject.projectTheme || '未設定',
                genre: currentProject.genre || '未設定',
                mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
                subGenre: currentProject.subGenre || '未設定',
                targetReader: currentProject.targetReader || '未設定',
                description: currentProject.description || '未設定',
            };

            // プロット情報を取得
            const plotInfo = {
                theme: currentProject.plot?.theme || '',
                setting: currentProject.plot?.setting || '',
                hook: currentProject.plot?.hook || '',
                protagonistGoal: currentProject.plot?.protagonistGoal || '',
                mainObstacle: currentProject.plot?.mainObstacle || '',
            };

            const prompt = aiService.buildPrompt('character', 'create', {
                title: projectInfo.title,
                theme: projectInfo.theme,
                description: projectInfo.description,
                mainGenre: projectInfo.mainGenre,
                subGenre: projectInfo.subGenre,
                targetReader: projectInfo.targetReader,
                plotTheme: plotInfo.theme,
                plotSetting: plotInfo.setting,
                plotHook: plotInfo.hook,
                protagonistGoal: plotInfo.protagonistGoal,
                mainObstacle: plotInfo.mainObstacle,
                role: '主要キャラクター',
                synopsis: currentProject?.synopsis || '',
            });

            const response = await aiService.generateContent({
                prompt,
                type: 'character',
                settings,
                signal: abortController.signal,
            });

            // キャンセルされた場合は処理をスキップ
            if (abortController.signal.aborted) {
                return;
            }

            if (response.error) {
                // エラー時もログを記録
                addLog({
                    type: 'generate',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                });
                handleAPIError(
                    new Error(response.error),
                    'キャラクター生成',
                    {
                        title: 'AI生成エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleAIGenerateCharacters(),
                    }
                );
                return;
            }

            // プロバイダーに応じた形式を決定
            const getPreferredFormat = (provider: string): 'json' | 'text' => {
                const cloudProviders = ['openai', 'claude', 'gemini'];
                return cloudProviders.includes(provider) ? 'json' : 'text';
            };

            const preferredFormat = getPreferredFormat(settings.provider);

            // AIの回答を解析して複数のキャラクターを作成
            const content = response.content;
            const parseResult: ParseResult = extractCharactersFromContent(
                content,
                CHARACTER_GENERATION.PARSING_MAX,
                preferredFormat
            );

            const newCharacters = parseResult.characters;

            // 解析結果のログ記録
            if (import.meta.env.DEV) {
                console.log('キャラクター解析結果:', {
                    method: parseResult.parseMethod,
                    count: newCharacters.length,
                    errors: parseResult.errors,
                    warnings: parseResult.warnings,
                });
            }

            // 既存のキャラクターに追加
            if (newCharacters.length > 0) {
                updateProject({
                    characters: [...currentProject.characters, ...newCharacters],
                });

                // 成功時は解析結果を含めてログを記録
                addLog({
                    type: 'generate',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                    parsedCharacters: newCharacters,
                });

                const characterNames = newCharacters.map(c => c.name).join('、');

                // 警告やエラーがある場合のメッセージ
                let successMessage = `${newCharacters.length}人のキャラクター（${characterNames}）を生成しました！`;

                if (parseResult.warnings.length > 0) {
                    successMessage += `\n注意: ${parseResult.warnings.length}件の警告があります。`;
                }

                if (parseResult.parseMethod === 'fallback') {
                    successMessage += '\n（JSON形式の解析に失敗したため、テキスト形式で解析しました）';
                }

                showSuccess(successMessage);
            } else {
                // 解析失敗時もログを記録
                addLog({
                    type: 'generate',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                });

                // 詳細なエラーメッセージを構築
                let errorMessage = 'キャラクターの生成に失敗しました。\n\n';

                if (parseResult.errors.length > 0) {
                    errorMessage += '【エラー詳細】\n';
                    parseResult.errors.forEach((error, index) => {
                        errorMessage += `${index + 1}. ${error}\n`;
                    });
                    errorMessage += '\n';
                }

                errorMessage += '【対処法】\n';
                errorMessage += '1. AIログを確認して、AIの応答形式を確認してください\n';
                errorMessage += '2. プロンプトを再実行してみてください\n';
                errorMessage += '3. ローカルLLMを使用している場合、クラウドAPI（OpenAI、Claude、Gemini）の使用を検討してください\n';
                errorMessage += '4. それでも解決しない場合、手動でキャラクターを追加してください';

                handleAPIError(
                    new Error(errorMessage),
                    'キャラクター生成',
                    {
                        title: 'キャラクターの生成に失敗しました',
                        duration: 10000,
                        showDetails: true,
                        onRetry: () => handleAIGenerateCharacters(),
                    }
                );
            }

        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            handleAPIError(
                error,
                'キャラクター生成',
                {
                    title: 'AI生成中にエラーが発生しました',
                    duration: 7000,
                    showDetails: true,
                    onRetry: () => handleAIGenerateCharacters(),
                }
            );
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(false);
            }
            abortControllerRef.current = null;
        }
    };

    const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
        const typeLabels: Record<string, string> = {
            'enhance': 'キャラクター詳細化',
            'generate': 'キャラクター生成',
        };
        const typeLabel = typeLabels[log.type] || log.type;
        const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.characterName ? `キャラクター名: ${log.characterName}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${log.parsedCharacters && log.parsedCharacters.length > 0 ? `【解析されたキャラクター数】
${log.parsedCharacters.length}人

【解析されたキャラクターの詳細】
                ${log.parsedCharacters.map((c, i: number) => `${i + 1}. ${c.name}: ${c.role || ''}`).join('\n')}` : ''}`;
        navigator.clipboard.writeText(logText);
        showSuccess('ログをクリップボードにコピーしました');
    }, [showSuccess]);

    // ログダウンロード機能
    const handleDownloadLogs = useCallback(async () => {
        const typeLabels: Record<string, string> = {
            'enhance': 'キャラクター詳細化',
            'generate': 'キャラクター生成',
        };
        const logsText = aiLogs.map(log => {
            const typeLabel = typeLabels[log.type] || log.type;
            return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.characterName ? `キャラクター名: ${log.characterName}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${log.parsedCharacters && log.parsedCharacters.length > 0 ? `【解析されたキャラクター数】
${log.parsedCharacters.length}人

【解析されたキャラクターの詳細】
${log.parsedCharacters.map((c, i: number) => `${i + 1}. ${c.name}: ${c.role || ''}`).join('\n')}` : ''}

${'='.repeat(80)}`;
        }).join('\n\n');

        const filename = `character_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
        const result = await exportFile({
            filename,
            content: logsText,
            mimeType: 'text/plain',
            title: 'キャラクターAIログ',
        });

        if (result.success) {
            showSuccess('ログをダウンロードしました');
        } else if (result.method === 'error') {
            handleAPIError(
                new Error(result.error || 'ログのダウンロードに失敗しました'),
                'ログのダウンロード',
                {
                    title: 'ログのダウンロードに失敗しました',
                    duration: 5000,
                }
            );
        }
    }, [aiLogs, showSuccess, handleAPIError]);

    if (!currentProject) return null;

    return (
        <div className="space-y-6">
            {/* AI生成中のローディングインジケーター */}
            {isGenerating && (
                <AILoadingIndicator
                    message="AIが思考中..."
                    estimatedTime={30}
                    variant="inline"
                    cancellable={true}
                    onCancel={handleCancel}
                />
            )}

            {/* AI Assistant Section */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-pink-500" />
                    AIキャラクター作成支援
                </h3>
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl border border-pink-200 dark:border-pink-800 p-4 space-y-4">

                    {/* Auto Generate */}
                    <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                            作品情報からキャラクターを自動生成
                        </p>
                        <button
                            onClick={handleAIGenerateCharacters}
                            disabled={!isConfigured || isGenerating}
                            className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span>自動生成（一括作成）</span>
                        </button>
                    </div>

                    {/* Suggest Missing */}
                    <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                            不足しているキャラクターをAIが提案
                        </p>
                        <button
                            onClick={handleSuggestCharacters}
                            disabled={!isConfigured || isGenerating}
                            className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 text-pink-700 dark:text-pink-300 rounded-lg transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed border border-pink-200 dark:border-pink-800 flex items-center justify-center space-x-2"
                        >
                            <UserPlus className="h-4 w-4" />
                            <span>不足キャラクターを提案</span>
                        </button>
                    </div>

                    {settings.provider === 'local' && (
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-['Noto_Sans_JP']">
                                ⚠️ ローカルLLMは解析に失敗しやすい傾向があります。
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Section */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-mizu-500" />
                    進捗状況
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">作成済み</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {currentProject.characters.length} 人
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div
                            className="bg-gradient-to-r from-mizu-500 to-mizu-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (currentProject.characters.length / 10) * 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                        作品に応じてAIが人数を判断します
                    </p>
                </div>
            </div>

            {/* Logs Section */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-ai-500" />
                    AIログ
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <AILogPanel
                        logs={aiLogs}
                        onCopyLog={handleCopyLog}
                        onDownloadLogs={handleDownloadLogs}
                        typeLabels={{
                            'enhance': '詳細化',
                            'generate': '生成',
                        }}
                        renderLogContent={(log) => (
                            <div className="text-sm text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">
                                <div className="mb-1 text-xs opacity-70 truncate">{log.prompt}</div>
                                <div className="pl-2 border-l-2 border-ai-300 dark:border-ai-700 text-xs line-clamp-3">
                                    {log.response}
                                </div>
                            </div>
                        )}
                        compact={true}
                    />
                </div>
            </div>

            <SuggestionModal
                isOpen={isSuggestionModalOpen}
                onClose={() => setIsSuggestionModalOpen(false)}
                suggestions={suggestions}
                onAddCharacters={(chars) => {
                    updateProject({
                        characters: [...currentProject.characters, ...chars]
                    });
                    showSuccess(`${chars.length}人のキャラクターを追加しました`);
                }}
            />
        </div>
    );
};
