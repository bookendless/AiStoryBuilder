import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader, CheckCircle, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { extractCharactersFromContent, ParseResult } from '../../utils/characterParser';
import { CHARACTER_GENERATION } from '../../constants/character';
import { exportFile } from '../../utils/mobileExportUtils';

export const CharacterAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const { aiLogs, addLog } = useAILog();
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

    const handleAIGenerateCharacters = async () => {
        if (!isConfigured) {
            showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
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
                showError(`AI生成エラー: ${response.error}\n詳細はAIログを確認してください。`);
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
                CHARACTER_GENERATION.RECOMMENDED_MAX,
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

                showError(errorMessage);
            }

        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('AI生成エラー:', error);
            showError('AI生成中にエラーが発生しました');
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
            showError(result.error || 'ログのダウンロードに失敗しました');
        }
    }, [aiLogs, showSuccess, showError]);

    if (!currentProject) return null;

    return (
        <div className="space-y-6">
            {/* AI生成中のローディングインジケーター */}
            {isGenerating && (
                <AILoadingIndicator
                    message="キャラクターを生成中"
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
                    AIキャラクター提案
                </h3>
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl border border-pink-200 dark:border-pink-800 p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-3">
                        プロジェクト設定に基づき、物語に適した3〜5人のキャラクターを自動生成します。
                    </p>

                    <button
                        onClick={handleAIGenerateCharacters}
                        disabled={!isConfigured || isGenerating}
                        className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        {isGenerating ? (
                            <div className="flex items-center justify-center space-x-2">
                                <Loader className="h-4 w-4 animate-spin" />
                                <span>生成中...</span>
                            </div>
                        ) : !isConfigured ? (
                            'AI設定が必要'
                        ) : (
                            'キャラクターを自動生成'
                        )}
                    </button>

                    {settings.provider === 'local' && (
                        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
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
                            style={{ width: `${Math.min((currentProject.characters.length / 5) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                        推奨: 3-5人程度
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
                        compact={true} // New prop suggestion for tighter layout
                    />
                </div>
            </div>
        </div>
    );
};
