import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Sparkles, Loader, FileText, CheckCircle } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { exportFile } from '../../utils/mobileExportUtils';

// フィールド設定
const FIELD_MAX_LENGTHS = {
    theme: 100,
    setting: 300,
    hook: 300,
    protagonistGoal: 100,
    mainObstacle: 100,
    ending: 200,
} as const;

/**
 * PlotStep1AssistantPanel - ツールサイドバー用のプロット基本設定AI支援パネル
 * ProjectContextから直接plot状態を読み書きし、PlotStep1と同期します。
 */
export const PlotStep1AssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess, showWarning } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const { aiLogs, addLog } = useAILog({ projectId: currentProject?.id });
    const abortControllerRef = useRef<AbortController | null>(null);

    // 現在のプロット設定を取得
    const plotData = currentProject?.plot || {
        theme: '',
        setting: '',
        hook: '',
        protagonistGoal: '',
        mainObstacle: '',
        ending: '',
    };

    // プロジェクトの詳細情報を取得する関数
    const getProjectContext = useCallback(() => {
        if (!currentProject) return null;

        return {
            title: currentProject.title,
            description: currentProject.description,
            genre: currentProject.genre || '一般小説',
            mainGenre: currentProject.mainGenre || currentProject.genre || '一般小説',
            subGenre: currentProject.subGenre || '未設定',
            targetReader: currentProject.targetReader || '全年齢',
            projectTheme: currentProject.projectTheme || '成長・自己発見',
            characters: currentProject.characters.map(c => ({
                name: c.name,
                role: c.role,
                personality: c.personality,
                background: c.background
            }))
        };
    }, [currentProject]);

    // 文字数制限に基づいて内容を成形する関数
    const formatContentToFit = useCallback((content: string, maxLength: number, fieldName: string): string => {
        if (!content) return '';

        let formatted = content.trim();

        // 基本的なクリーニング
        formatted = formatted
            .replace(/^["']|["']$/g, '') // クォートの除去
            .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
            .replace(/\n+/g, ' ') // 改行を空白に
            .trim();

        // 文字数制限を超えている場合の処理
        if (formatted.length > maxLength) {
            console.warn(`${fieldName}の文字数が制限を超過: ${formatted.length}/${maxLength}文字`);

            // 1. 文の境界で切り詰めを試行（句読点で分割）
            const sentences = formatted.split(/[。！？]/);
            let truncated = '';

            for (const sentence of sentences) {
                const testLength = truncated.length + sentence.length + (truncated ? 1 : 0);
                if (testLength <= maxLength) {
                    truncated += (truncated ? '。' : '') + sentence;
                } else {
                    break;
                }
            }

            // 2. 文の境界で切り詰めができなかった場合、カンマや読点で切り詰め
            if (!truncated || truncated.length < maxLength * 0.6) {
                const commaSentences = formatted.split(/[、,]/);
                truncated = '';

                for (const sentence of commaSentences) {
                    const testLength = truncated.length + sentence.length + (truncated ? 1 : 0);
                    if (testLength <= maxLength) {
                        truncated += (truncated ? '、' : '') + sentence;
                    } else {
                        break;
                    }
                }
            }

            // 3. それでも適切に切り詰められない場合、単語境界で切り詰め
            if (!truncated || truncated.length < maxLength * 0.5) {
                // 日本語の場合は文字単位、英語の場合は単語単位で切り詰め
                if (formatted.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/)) {
                    // 日本語の場合
                    truncated = formatted.substring(0, maxLength - 3) + '...';
                } else {
                    // 英語の場合
                    const words = formatted.split(' ');
                    truncated = '';
                    for (const word of words) {
                        const testLength = truncated.length + word.length + (truncated ? 1 : 0);
                        if (testLength <= maxLength - 3) {
                            truncated += (truncated ? ' ' : '') + word;
                        } else {
                            break;
                        }
                    }
                    if (truncated.length < maxLength - 3) {
                        truncated += '...';
                    }
                }
            }

            formatted = truncated;
            console.log(`${fieldName}を成形: ${formatted.length}/${maxLength}文字`);

            // 最終チェック：まだ制限を超えている場合は強制的に切り詰め
            if (formatted.length > maxLength) {
                formatted = formatted.substring(0, maxLength - 3) + '...';
                console.warn(`${fieldName}を強制切り詰め: ${formatted.length}/${maxLength}文字`);
            }
        }

        return formatted;
    }, []);

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

    // 基本設定全体のAI生成関数
    const handleBasicAIGenerate = useCallback(async () => {
        if (!isConfigured) {
            showWarning('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 5000);
            return;
        }

        // 既存のリクエストをキャンセル
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsGenerating(true);

        try {
            // プロジェクトの詳細情報を取得
            const context = getProjectContext();
            if (!context) {
                showError('プロジェクト情報が見つかりません。', 5000);
                return;
            }

            // キャラクター情報の文字列化
            const charactersInfo = context.characters.length > 0
                ? context.characters.map(c => `・${c.name} (${c.role})\n  性格: ${c.personality}\n  背景: ${c.background}`).join('\n')
                : 'キャラクター未設定';

            // あらすじ情報を取得（存在する場合のみ）
            const synopsisInfo = currentProject?.synopsis && currentProject.synopsis.trim().length > 0
                ? `\n【参考情報（優先度低）】
あらすじ: ${currentProject.synopsis}

（注：あらすじは参考情報としてのみ使用し、他の設定と矛盾する場合は他の設定を優先してください）`
                : '';

            const prompt = `あなたは物語プロット生成の専門AIです。以下の指示を厳密に守って、指定されたJSON形式のみで出力してください。

【プロジェクト情報】
作品タイトル: ${context.title}
作品説明: ${context.description || '説明未設定'}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
ターゲット読者: ${context.targetReader}
プロジェクトテーマ: ${context.projectTheme}

【キャラクター情報】
${charactersInfo}
${synopsisInfo}
【重要指示】以下のJSON形式以外は一切出力しないでください。説明文、コメント、その他のテキストは一切不要です。

{
  "メインテーマ": "ここに物語の核心となるメインテーマを100文字以内で記述",
  "舞台設定": "ここにジャンルに合わせた世界観を表現して300文字以内で記述",
  "フック要素": "ここに魅力的なフック要素を300文字以内で記述",
  "主人公の目標": "ここに主人公が達成したい目標を100文字以内で記述",
  "主要な障害": "ここに主人公の目標を阻む主要な障害を100文字以内で記述",
  "物語の結末": "ここに物語の結末を200文字以内で記述"
}

【絶対に守るべきルール】
1. 上記のJSON形式以外は一切出力しない
2. 説明文、コメント、マークダウンは一切不要
3. 項目名は必ず「メインテーマ」「舞台設定」「フック要素」「主人公の目標」「主要な障害」で記述
4. 各項目の内容は指定された文字数以内で記述
5. 日本語の内容のみで記述
6. 改行文字は使用しない
7. 特殊文字や装飾は使用しない

【文字数制限】
- メインテーマ：100文字以内
- 舞台設定：300文字以内  
- フック要素：300文字以内
- 主人公の目標：100文字以内
- 主要な障害：100文字以内
- 物語の結末：200文字以内

【出力例】
{
  "メインテーマ": "友情と成長をテーマにした青春物語",
  "舞台設定": "現代の高校を舞台に、主人公の日常と非日常が交錯する世界観",
  "フック要素": "謎の転校生との出会いが引き起こす予想外の展開",
  "主人公の目標": "転校生の正体を突き止め、クラスメイトとの友情を深める",
  "主要な障害": "転校生の秘密と、クラス内の対立関係",
  "物語の結末": "主人公と転校生が和解し、クラス全体が団結して新しい関係を築く"
}

上記の形式で出力してください。`;

            const response = await aiService.generateContent({
                prompt,
                type: 'plot',
                settings,
                signal: abortController.signal,
            });

            // キャンセルされた場合は処理をスキップ
            if (abortController.signal.aborted) {
                return;
            }

            // AIログに記録
            addLog({
                type: 'basic',
                prompt,
                response: response.content || '',
                error: response.error,
            });

            if (response.error) {
                showError(`AI生成エラー: ${response.error}`, 7000);
                return;
            }

            // 生成された内容を解析
            const content = response.content;
            console.log('Basic AI生の出力:', content);

            // JSON形式の解析（強化版）
            let parsedData: Record<string, unknown> | null = null;
            try {
                // 複数のJSON抽出パターンを試行
                const jsonPatterns = [
                    // 1. 完全なJSONオブジェクト
                    /\{[\s\S]*?\}/,
                    // 2. 複数行にわたるJSON
                    /\{[\s\S]*\}/,
                    // 3. 基本設定専用のJSON
                    /\{\s*"メインテーマ"[\s\S]*?"フック要素"[\s\S]*?\}/
                ];

                for (const pattern of jsonPatterns) {
                    const jsonMatch = content.match(pattern);
                    if (jsonMatch) {
                        let jsonStr = jsonMatch[0];

                        // JSON文字列のクリーニング
                        jsonStr = jsonStr
                            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 制御文字を除去
                            .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
                            .replace(/\n/g, ' ') // 改行を空白に
                            .trim();

                        try {
                            const parsed = JSON.parse(jsonStr);

                            // 基本設定のキーが存在するかチェック
                            const basicKeys = ['メインテーマ', '舞台設定', 'フック要素', '主人公の目標', '主要な障害', '物語の結末'];
                            const validKeys = basicKeys.filter(key => Object.prototype.hasOwnProperty.call(parsed, key));

                            if (validKeys.length >= 2) { // 最低2つのキーがあれば有効
                                console.log('基本設定JSON解析成功:', {
                                    pattern: pattern.toString(),
                                    validKeys: validKeys,
                                    content: jsonStr.substring(0, 200) + '...'
                                });
                                parsedData = parsed;
                                break;
                            }
                        } catch (parseError) {
                            console.warn('JSON解析エラー:', parseError);
                            continue;
                        }
                    }
                }

                if (!parsedData) {
                    console.warn('基本設定JSON解析に失敗、フォールバック解析を使用');
                }
            } catch (error) {
                console.warn('基本設定JSON解析に失敗:', error);
            }

            // フィールド抽出関数
            const extractBasicField = (label: string) => {
                // JSON形式から抽出
                if (parsedData && parsedData[label]) {
                    return String(parsedData[label]).trim();
                }

                // テキスト形式から抽出
                const patterns = [
                    new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]*)*)`, 'i'),
                    new RegExp(`${label}\\s*[:：]\\s*([^\\n]+(?:\\n(?!\\w+\\s*[:：])[^\\n]*)*)`, 'i'),
                    new RegExp(`"${label}"\\s*:\\s*"([^"]*)"`, 'i'),
                    new RegExp(`'${label}'\\s*:\\s*'([^']*)'`, 'i')
                ];

                for (const pattern of patterns) {
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        return match[1].trim().replace(/^["']|["']$/g, '');
                    }
                }

                return '';
            };

            const rawTheme = extractBasicField('メインテーマ');
            const rawSetting = extractBasicField('舞台設定');
            const rawHook = extractBasicField('フック要素');
            const rawProtagonistGoal = extractBasicField('主人公の目標');
            const rawMainObstacle = extractBasicField('主要な障害');
            const rawEnding = extractBasicField('物語の結末');

            // 文字数制限に基づいて内容を成形
            const theme = formatContentToFit(rawTheme, FIELD_MAX_LENGTHS.theme, 'メインテーマ');
            const setting = formatContentToFit(rawSetting, FIELD_MAX_LENGTHS.setting, '舞台設定');
            const hook = formatContentToFit(rawHook, FIELD_MAX_LENGTHS.hook, 'フック要素');
            const protagonistGoal = formatContentToFit(rawProtagonistGoal, FIELD_MAX_LENGTHS.protagonistGoal, '主人公の目標');
            const mainObstacle = formatContentToFit(rawMainObstacle, FIELD_MAX_LENGTHS.mainObstacle, '主要な障害');
            const ending = formatContentToFit(rawEnding, FIELD_MAX_LENGTHS.ending, '物語の結末');

            // 解析結果の確認
            const extractedCount = [theme, setting, hook, protagonistGoal, mainObstacle, ending].filter(v => v).length;
            if (extractedCount === 0) {
                console.error('基本設定の解析に完全に失敗:', {
                    rawContent: content,
                    parsedData: parsedData,
                    extractedFields: { theme, setting, hook, protagonistGoal, mainObstacle, ending }
                });
                showError('基本設定の解析に失敗しました。AIがテンプレートを逸脱した出力をしています。もう一度お試しください。', 7000);
                return;
            } else if (extractedCount < 6) {
                console.warn(`基本設定の一部項目のみ解析成功: ${extractedCount}/6項目`, {
                    extractedFields: { theme, setting, hook, protagonistGoal, mainObstacle, ending },
                    rawContent: content.substring(0, 500) + '...'
                });
                showWarning(`一部の基本設定項目のみ解析できました（${extractedCount}/6項目）。不完全な結果が適用されます。`, 5000);
            } else {
                showSuccess('基本設定の生成が完了しました', 3000);
            }

            // プロット設定を更新
            const updatedPlot = {
                ...plotData,
                theme: theme || plotData.theme,
                setting: setting || plotData.setting,
                hook: hook || plotData.hook,
                protagonistGoal: protagonistGoal || plotData.protagonistGoal,
                mainObstacle: mainObstacle || plotData.mainObstacle,
                ending: ending || plotData.ending,
            };

            await updateProject({ plot: updatedPlot });

        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Basic AI生成エラー:', error);
            const errorMessage = error instanceof Error ? error.message : '基本設定のAI生成中にエラーが発生しました';
            showError(errorMessage, 5000);
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(false);
            }
            abortControllerRef.current = null;
        }
    }, [isConfigured, getProjectContext, settings, showError, showSuccess, showWarning, addLog, formatContentToFit, plotData, updateProject, currentProject]);

    // 基本設定完成度を計算
    const progress = useMemo(() => {
        const fields = [
            { key: 'theme', label: 'メインテーマ', value: plotData.theme },
            { key: 'setting', label: '舞台設定', value: plotData.setting },
            { key: 'hook', label: 'フック要素', value: plotData.hook },
            { key: 'protagonistGoal', label: '主人公の目標', value: plotData.protagonistGoal },
            { key: 'mainObstacle', label: '主要な障害', value: plotData.mainObstacle },
            { key: 'ending', label: '物語の結末', value: plotData.ending },
        ];

        const completedFields = fields.filter(field => field.value && String(field.value).trim().length > 0);
        const progressPercentage = (completedFields.length / fields.length) * 100;

        return {
            completed: completedFields.length,
            total: fields.length,
            percentage: progressPercentage,
        };
    }, [plotData]);

    const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
        const typeLabel = log.type === 'basic' ? '基本設定生成' : '生成';
        const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;
        navigator.clipboard.writeText(logText);
        showSuccess('ログをクリップボードにコピーしました');
    }, [showSuccess]);

    // ログダウンロード機能
    const handleDownloadLogs = useCallback(async () => {
        const typeLabels: Record<string, string> = {
            'basic': '基本設定生成',
        };
        const logsText = aiLogs.map(log => {
            const typeLabel = typeLabels[log.type] || log.type;
            return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`;
        }).join('\n\n');

        const filename = `plot_step1_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
        const result = await exportFile({
            filename,
            content: logsText,
            mimeType: 'text/plain',
            title: 'プロット基本設定AIログ',
        });

        if (result.success) {
            showSuccess('ログをダウンロードしました');
        } else if (result.method === 'error') {
            showError(result.error || 'ログのダウンロードに失敗しました');
        }
    }, [aiLogs, showSuccess, showError]);

    if (!currentProject) return null;

    return (
        <div className="space-y-4">
            {/* AI生成中のローディングインジケーター */}
            {isGenerating && (
                <AILoadingIndicator
                    message="基本設定を生成中"
                    estimatedTime={30}
                    variant="inline"
                    cancellable={true}
                    onCancel={handleCancel}
                />
            )}

            {/* AI基本設定提案（メイン） */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                    AI基本設定提案
                </h3>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-3">
                        プロジェクト設定に基づき、一貫性のある基本設定を自動生成します。
                    </p>

                    <button
                        onClick={handleBasicAIGenerate}
                        disabled={isGenerating || !isConfigured}
                        className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin" />
                                <span>生成中...</span>
                            </>
                        ) : !isConfigured ? (
                            'AI設定が必要'
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                <span>基本設定をAI提案</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 進捗状況 */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    進捗状況
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">設定項目</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {progress.completed} / {progress.total}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${progress.percentage === 100
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                }`}
                            style={{ width: `${progress.percentage}%` }}
                        />
                    </div>
                    <div className="text-center">
                        <span className={`text-sm font-semibold ${progress.percentage === 100
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-white'
                            }`}>
                            {progress.percentage.toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* AIログ */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                    AIログ
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <AILogPanel
                        logs={aiLogs}
                        onCopyLog={handleCopyLog}
                        onDownloadLogs={handleDownloadLogs}
                        typeLabels={{
                            'basic': '基本設定生成',
                        }}
                        renderLogContent={(log) => (
                            <div className="text-sm text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">
                                <div className="mb-1 text-xs opacity-70 truncate">{log.prompt}</div>
                                <div className="pl-2 border-l-2 border-blue-300 dark:border-blue-700 text-xs line-clamp-3">
                                    {log.response}
                                </div>
                            </div>
                        )}
                        compact={true}
                    />
                </div>
            </div>
        </div>
    );
};

