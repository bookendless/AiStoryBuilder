import React, { useState, useCallback, useMemo } from 'react';
import { Sparkles, Loader, CheckCircle, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { usePendingResult } from '../../contexts/PendingResultContext';
import { useToast } from '../Toast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { CHAPTER_PROMPT_CAP } from '../../services/prompts/chapter';
import { parseChapterList } from '../../services/chapter/parseChapterList';
import { buildCreativePointsInstruction } from '../../services/prompts/creativePoints';
import { splitCreativePoints } from '../../services/creativePoints/parseCreativePoints';
import { buildBranchInstruction } from '../../services/creativePoints/buildBranchInstruction';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { StructureProgress } from '../steps/chapter/types';
import { exportFile } from '../../utils/mobileExportUtils';

export const ChapterAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess, showInfo, showError } = useToast();
    const { handleAPIError } = useErrorHandler();
    const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
    const { proposeResult } = usePendingResult();
    const { aiLogs, addLog } = useAILog({
        projectId: currentProject?.id,
        autoLoad: true,
    });

    // 生成タスクの識別キー（種別ごと）。実行中判定はマネージャから導出
    const pid = currentProject?.id ?? 'none';
    const basicKey = `${pid}:chapter:basic`;
    const structureKey = `${pid}:chapter:structure`;
    const isGenerating = isKeyActive(basicKey);
    const isGeneratingStructure = isKeyActive(structureKey);

    // 構成バランスの状態管理
    const [structureProgress, setStructureProgress] = useState<StructureProgress>({
        introduction: false,
        development: false,
        climax: false,
        conclusion: false,
    });

    // プロジェクトが変更されたときに構成バランスの状態を初期化
    React.useEffect(() => {
        if (currentProject) {
            setStructureProgress({
                introduction: currentProject.structureProgress?.introduction || false,
                development: currentProject.structureProgress?.development || false,
                climax: currentProject.structureProgress?.climax || false,
                conclusion: currentProject.structureProgress?.conclusion || false,
            });
        }
    }, [currentProject]);

    // プロジェクトコンテキストを構築
    const projectContext = useMemo(() => {
        if (!currentProject) {
            return {
                title: '無題',
                description: '一般小説',
                plot: {
                    theme: '',
                    setting: '',
                    structure: '',
                    hook: '',
                    structureDetails: '',
                },
                characters: [],
                existingChapters: [],
            };
        }

        // プロット構成の詳細情報を構築（章づくりを意識した形式）
        const buildStructureDetails = () => {
            if (!currentProject.plot) return '';

            const {
                structure,
                ki, sho, ten, ketsu,
                act1, act2, act3,
                fourAct1, fourAct2, fourAct3, fourAct4,
                hj1, hj2, hj3, hj4, hj5, hj6, hj7, hj8,
                bs1, bs2, bs3, bs4, bs5, bs6, bs7,
                ms1, ms2, ms3, ms4, ms5, ms6, ms7
            } = currentProject.plot;

            if (structure === 'kishotenketsu') {
                const parts = [];
                if (ki) parts.push(`【起】導入部（1-2章程度）: ${ki}`);
                if (sho) parts.push(`【承】展開部（3-6章程度）: ${sho}`);
                if (ten) parts.push(`【転】転換部（7-8章程度）: ${ten}`);
                if (ketsu) parts.push(`【結】結末部（9-10章程度）: ${ketsu}`);
                return parts.join('\n');
            } else if (structure === 'three-act') {
                const parts = [];
                if (act1) parts.push(`【第1幕】導入部（1-3章程度）: ${act1}`);
                if (act2) parts.push(`【第2幕】展開部（4-8章程度）: ${act2}`);
                if (act3) parts.push(`【第3幕】結末部（9-10章程度）: ${act3}`);
                return parts.join('\n');
            } else if (structure === 'four-act') {
                const parts = [];
                if (fourAct1) parts.push(`【第1幕】秩序（1-2章程度）: ${fourAct1}`);
                if (fourAct2) parts.push(`【第2幕】混沌（3-5章程度）: ${fourAct2}`);
                if (fourAct3) parts.push(`【第3幕】秩序（6-8章程度）: ${fourAct3}`);
                if (fourAct4) parts.push(`【第4幕】混沌（9-10章程度）: ${fourAct4}`);
                return parts.join('\n');
            } else if (structure === 'heroes-journey') {
                const parts = [];
                if (hj1) parts.push(`【日常の世界】（1章程度）: ${hj1}`);
                if (hj2) parts.push(`【冒険への誘い】（1-2章程度）: ${hj2}`);
                if (hj3) parts.push(`【境界越え】（1章程度）: ${hj3}`);
                if (hj4) parts.push(`【試練と仲間】（2-3章程度）: ${hj4}`);
                if (hj5) parts.push(`【最大の試練】（1-2章程度）: ${hj5}`);
                if (hj6) parts.push(`【報酬】（1章程度）: ${hj6}`);
                if (hj7) parts.push(`【帰路】（1-2章程度）: ${hj7}`);
                if (hj8) parts.push(`【復活と帰還】（1章程度）: ${hj8}`);
                return parts.join('\n');
            } else if (structure === 'beat-sheet') {
                const parts = [];
                if (bs1) parts.push(`【導入 (Setup)】（1-2章程度）: ${bs1}`);
                if (bs2) parts.push(`【決断 (Break into Two)】（1章程度）: ${bs2}`);
                if (bs3) parts.push(`【試練 (Fun and Games)】（2-4章程度）: ${bs3}`);
                if (bs4) parts.push(`【転換点 (Midpoint)】（1章程度）: ${bs4}`);
                if (bs5) parts.push(`【危機 (All Is Lost)】（1-2章程度）: ${bs5}`);
                if (bs6) parts.push(`【クライマックス (Finale)】（1-2章程度）: ${bs6}`);
                if (bs7) parts.push(`【結末 (Final Image)】（1章程度）: ${bs7}`);
                return parts.join('\n');
            } else if (structure === 'mystery-suspense') {
                const parts = [];
                if (ms1) parts.push(`【発端（事件発生）】（1章程度）: ${ms1}`);
                if (ms2) parts.push(`【捜査（初期）】（1-2章程度）: ${ms2}`);
                if (ms3) parts.push(`【仮説とミスリード】（2-3章程度）: ${ms3}`);
                if (ms4) parts.push(`【第二の事件/急展開】（1-2章程度）: ${ms4}`);
                if (ms5) parts.push(`【手がかりの統合】（1-2章程度）: ${ms5}`);
                if (ms6) parts.push(`【解決（真相解明）】（1-2章程度）: ${ms6}`);
                if (ms7) parts.push(`【エピローグ】（1章程度）: ${ms7}`);
                return parts.join('\n');
            }

            return '';
        };

        return {
            // 基本情報
            title: currentProject.title || '無題',
            description: currentProject.description || '一般小説',
            mainGenre: currentProject.mainGenre || '',
            subGenre: currentProject.subGenre || currentProject.customSubGenre || '',
            targetReader: currentProject.targetReader || currentProject.customTargetReader || '',
            projectTheme: currentProject.projectTheme || currentProject.theme || currentProject.customTheme || '',
            writingStyle: (() => {
                const ws = currentProject.writingStyle;
                if (!ws) return '';
                const parts = [];
                if (ws.style || ws.customStyle) parts.push(`文体: ${ws.customStyle || ws.style}`);
                if (ws.perspective || ws.customPerspective) parts.push(`人称: ${ws.customPerspective || ws.perspective}`);
                if (ws.tone || ws.customTone) parts.push(`トーン: ${ws.customTone || ws.tone}`);
                return parts.join(', ');
            })(),

            // プロット情報
            plot: {
                theme: currentProject.plot?.theme || '',
                setting: currentProject.plot?.setting || '',
                structure: currentProject.plot?.structure || '',
                hook: currentProject.plot?.hook || '',
                structureDetails: buildStructureDetails(),
            },

            // キャラクター情報（正確なプロパティ参照）
            characters: currentProject.characters.map(c => ({
                name: c.name,
                role: c.role,
                appearance: c.appearance,
                personality: c.personality,
                background: c.background,
                image: c.image ? '画像あり' : '画像なし'
            })),

            // 既存の章情報
            existingChapters: currentProject.chapters.map(c => ({
                title: c.title,
                summary: c.summary,
                setting: c.setting || '',
                mood: c.mood || '',
                keyEvents: c.keyEvents || []
            }))
        };
    }, [currentProject]);

    // AIプロンプトを構築
    const buildAIPrompt = useCallback((type: 'basic' | 'structure') => {
        if (!projectContext) return '';

        // 既存の章情報をフォーマット
        const existingChapters = projectContext.existingChapters.map((ch: { title: string; summary: string; setting?: string; mood?: string; keyEvents?: string[] }, index: number) => {
            let chapterInfo = `${index + 1}. ${ch.title}: ${ch.summary}`;
            if (ch.setting) chapterInfo += `\n   設定・場所: ${ch.setting}`;
            if (ch.mood) chapterInfo += `\n   雰囲気・ムード: ${ch.mood}`;
            if (ch.keyEvents && ch.keyEvents.length > 0) {
                chapterInfo += `\n   重要な出来事: ${ch.keyEvents.join(', ')}`;
            }
            return chapterInfo;
        }).join('\n') || '既存の章はありません';

        // キャラクター情報をフォーマット
        const characters = projectContext.characters.map((c: { name: string; role: string; appearance: string; personality: string; background: string }) =>
            `・${c.name} (${c.role})\n  外見: ${c.appearance}\n  性格: ${c.personality}\n  背景: ${c.background}`
        ).join('\n') || 'キャラクターが設定されていません';

        if (type === 'structure') {
            const incompleteStructures = [];
            if (!structureProgress.introduction) incompleteStructures.push('導入部');
            if (!structureProgress.development) incompleteStructures.push('展開部');
            if (!structureProgress.climax) incompleteStructures.push('クライマックス');
            if (!structureProgress.conclusion) incompleteStructures.push('結末部');

            return aiService.buildPrompt('chapter', 'generateStructure', {
                title: projectContext.title,
                mainGenre: projectContext.mainGenre || '未設定',
                subGenre: projectContext.subGenre || '未設定',
                targetReader: projectContext.targetReader || '未設定',
                projectTheme: projectContext.projectTheme || '未設定',
                writingStyle: projectContext.writingStyle || '未設定',
                structureDetails: projectContext.plot?.structureDetails || '構成詳細が設定されていません',
                characters: characters,
                existingChapters: existingChapters,
                incompleteStructures: incompleteStructures.join('、'),
            });
        } else {
            // 基本AI生成用のプロンプト
            return aiService.buildPrompt('chapter', 'generateBasic', {
                title: projectContext.title,
                mainGenre: projectContext.mainGenre || '未設定',
                subGenre: projectContext.subGenre || '未設定',
                targetReader: projectContext.targetReader || '未設定',
                projectTheme: projectContext.projectTheme || '未設定',
                writingStyle: projectContext.writingStyle || '未設定',
                structureDetails: projectContext.plot?.structureDetails || '構成詳細が設定されていません',
                characters: characters,
                existingChapters: existingChapters,
            });
        }
    }, [projectContext, structureProgress]);

    // AI応答を解析（共有パーサを使用。先回り生成（Phase D）と解析ロジックを共通化）
    const parseAIResponse = useCallback((content: string) => parseChapterList(content), []);

    // キャンセルハンドラー（マネージャ経由でkey単位にabort）
    const handleCancelBasic = useCallback(() => {
        cancelByKey(basicKey);
    }, [cancelByKey, basicKey]);

    const handleCancelStructure = useCallback(() => {
        cancelByKey(structureKey);
    }, [cancelByKey, structureKey]);

    // 基本章立て生成
    const handleAIGenerate = async (branchInstruction?: string) => {
        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                '章立て生成',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        if (!currentProject) return;

        // マネージャに生成タスクを登録（同keyの既存タスクは自動でキャンセル・置換）
        const { id: taskId, signal } = startTask({
            key: basicKey,
            label: '章立てを生成中',
            step: 'chapter',
        });

        // 創造ポイント（Phase C）: 設定ONなら分岐候補の付記を要求する
        const cpEnabled = settings.creativePointsEnabled !== false;

        try {
            let prompt = buildAIPrompt('basic');
            if (branchInstruction) {
                prompt += `\n\n【別案の指定】${branchInstruction}`;
            }
            if (cpEnabled) {
                prompt += buildCreativePointsInstruction('章立て');
            }
            const response = await aiService.generateContent({
                prompt,
                type: 'chapter',
                settings,
                signal,
                maxPromptLength: CHAPTER_PROMPT_CAP,
            });

            // キャンセルされた場合は処理をスキップ
            if (signal.aborted) {
                return;
            }

            if (response.error) {
                // エラーの場合はログを保存
                addLog({
                    type: 'basic',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                    parsedChapters: []
                });
                handleAPIError(
                    new Error(response.error),
                    '章立て生成',
                    {
                        title: 'AI生成エラー',
                        duration: 10000,
                        showDetails: true,
                        onRetry: () => handleAIGenerate(),
                    }
                );
                return;
            }

            // 創造ポイントのマーカー以降を章立て本文から分離してから解析する
            const { content: chapterContent, creativePoints } = cpEnabled
                ? splitCreativePoints(response.content)
                : { content: response.content, creativePoints: [] };
            const newChapters = parseAIResponse(chapterContent);

            // 解析結果を含めてログを保存
            addLog({
                type: 'basic',
                prompt,
                response: response.content || '',
                error: response.error,
                parsedChapters: newChapters
            });

            if (newChapters.length > 0) {
                const existingChapters = currentProject.chapters;
                const chaptersToAdd = newChapters;

                // 不完全な章があるかチェック
                const incompleteChapters = newChapters.filter((ch: {
                    id: string;
                    title: string;
                    summary: string;
                    characters?: string[];
                    setting?: string;
                    mood?: string;
                    keyEvents?: string[];
                }) =>
                    !ch.summary || !ch.setting || !ch.mood || !ch.keyEvents?.length || !ch.characters?.length
                );

                const previewText = [
                    incompleteChapters.length > 0
                        ? `⚠ ${incompleteChapters.length}章で情報が不完全です。反映後に手動編集できます。\n`
                        : '',
                    ...newChapters.map((ch: { title: string; summary?: string }, i: number) =>
                        `${i + 1}. ${ch.title}\n   ${ch.summary || '(概要なし)'}`
                    ),
                ].filter(Boolean).join('\n\n');

                // 即時反映せず、確認モーダルで反映/破棄を選べるよう保留に登録
                proposeResult({
                    label: `章立て（${newChapters.length}章追加）`,
                    preview: previewText,
                    onApply: () => updateProject({
                        chapters: [...existingChapters, ...chaptersToAdd],
                    }),
                    creativePoints: creativePoints.length > 0 ? creativePoints : undefined,
                    onRegenerateWithSelections:
                        creativePoints.length > 0
                            ? (selections) =>
                                  handleAIGenerate(buildBranchInstruction(selections))
                            : undefined,
                });
            } else {
                handleAPIError(
                    new Error('章立ての解析に失敗しました'),
                    '章立て生成',
                    {
                        title: '解析エラー',
                        duration: 10000,
                        showDetails: true,
                        onRetry: () => handleAIGenerate(),
                    }
                );
            }

        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            addLog({
                type: 'basic',
                prompt: buildAIPrompt('basic'),
                response: '',
                error: errorMessage
            });
            handleAPIError(
                error,
                '章立て生成',
                {
                    title: 'AI生成中にエラーが発生しました',
                    duration: 10000,
                    showDetails: true,
                    onRetry: () => handleAIGenerate(),
                }
            );
        } finally {
            // 成否・キャンセルに関わらずタスクを除去（キャンセル済みならno-op）
            completeTask(taskId);
        }
    };

    // 構成バランス分析に基づく章立て生成
    const handleStructureBasedAIGenerate = async (branchInstruction?: string) => {
        if (!isConfigured || !currentProject) {
            handleAPIError(
                new Error('AI設定が完了していません'),
                '構成バランス章立て生成',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        // 完了していない構成要素を特定
        const incompleteStructures = [];
        if (!structureProgress.introduction) incompleteStructures.push('導入部');
        if (!structureProgress.development) incompleteStructures.push('展開部');
        if (!structureProgress.climax) incompleteStructures.push('クライマックス');
        if (!structureProgress.conclusion) incompleteStructures.push('結末部');

        if (incompleteStructures.length === 0) {
            showInfo('すべての構成要素が完了しています。新しい章を追加する場合は「AI章立て提案」をご利用ください。');
            return;
        }

        // マネージャに生成タスクを登録（同keyの既存タスクは自動でキャンセル・置換）
        const { id: taskId, signal } = startTask({
            key: structureKey,
            label: '構成ベース章立てを生成中',
            step: 'chapter',
        });

        // 創造ポイント（Phase C）: 設定ONなら分岐候補の付記を要求する
        const cpEnabled = settings.creativePointsEnabled !== false;

        try {
            let prompt = buildAIPrompt('structure');
            if (branchInstruction) {
                prompt += `\n\n【別案の指定】${branchInstruction}`;
            }
            if (cpEnabled) {
                prompt += buildCreativePointsInstruction('章立て');
            }
            const response = await aiService.generateContent({
                prompt: prompt,
                type: 'chapter',
                settings: settings,
                signal,
                maxPromptLength: CHAPTER_PROMPT_CAP,
            });

            // キャンセルされた場合は処理をスキップ
            if (signal.aborted) {
                return;
            }

            if (response.content && !response.error) {
                // 創造ポイントのマーカー以降を章立て本文から分離してから解析する
                const { content: chapterContent, creativePoints } = cpEnabled
                    ? splitCreativePoints(response.content)
                    : { content: response.content, creativePoints: [] };
                const newChapters = parseAIResponse(chapterContent);

                // 解析結果を含めてログを保存
                addLog({
                    type: 'structure',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                    parsedChapters: newChapters
                });

                if (newChapters.length > 0) {
                    const existingChapters = currentProject.chapters;
                    const chaptersToAdd = newChapters;

                    // 不完全な章があるかチェック
                    const incompleteChapters = newChapters.filter((ch: {
                        id: string;
                        title: string;
                        summary: string;
                        characters?: string[];
                        setting?: string;
                        mood?: string;
                        keyEvents?: string[];
                    }) =>
                        !ch.summary || !ch.setting || !ch.mood || !ch.keyEvents?.length || !ch.characters?.length
                    );

                    const previewText = [
                        `対象: ${incompleteStructures.join('、')}`,
                        incompleteChapters.length > 0
                            ? `⚠ ${incompleteChapters.length}章で情報が不完全です。反映後に手動編集できます。`
                            : '',
                        '',
                        ...newChapters.map((ch: { title: string; summary?: string }, i: number) =>
                            `${i + 1}. ${ch.title}\n   ${ch.summary || '(概要なし)'}`
                        ),
                    ].filter(Boolean).join('\n\n');

                    // 即時反映せず、確認モーダルで反映/破棄を選べるよう保留に登録
                    proposeResult({
                        label: `構成バランス章立て（${newChapters.length}章追加）`,
                        preview: previewText,
                        onApply: () => updateProject({
                            chapters: [...existingChapters, ...chaptersToAdd],
                        }),
                        creativePoints: creativePoints.length > 0 ? creativePoints : undefined,
                        onRegenerateWithSelections:
                            creativePoints.length > 0
                                ? (selections) =>
                                      handleStructureBasedAIGenerate(buildBranchInstruction(selections))
                                : undefined,
                    });
                } else {
                    showError('章立ての解析に失敗しました。', 10000, {
                        title: '解析エラー',
                        details: '考えられる原因:\n1. AI出力の形式が期待と異なる\n2. 章の開始パターンが見つからない\n3. 必要な情報が不足している\n\nAIの応答内容を確認するにはAIログセクションを確認してください。',
                    });
                }
            } else {
                handleAPIError(
                    new Error(response.error || '不明なエラー'),
                    '構成バランス章立て生成',
                    {
                        title: 'AI生成エラー',
                        duration: 10000,
                        showDetails: true,
                        onRetry: () => handleStructureBasedAIGenerate(),
                    }
                );
            }
        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            addLog({
                type: 'structure',
                prompt: buildAIPrompt('structure'),
                response: '',
                error: errorMessage
            });
            console.error('Structure-based AI generation error:', error);
            handleAPIError(
                error,
                '章立て生成',
                {
                    title: 'AI生成中にエラーが発生しました',
                    duration: 10000,
                    showDetails: true,
                    onRetry: () => handleAIGenerate(),
                }
            );
        } finally {
            // 成否・キャンセルに関わらずタスクを除去（キャンセル済みならno-op）
            completeTask(taskId);
        }
    };

    // 構成バランスの更新
    const handleStructureProgressChange = useCallback((section: keyof StructureProgress) => {
        const newProgress = {
            ...structureProgress,
            [section]: !structureProgress[section],
        };
        setStructureProgress(newProgress);

        // プロジェクトに保存
        if (currentProject) {
            updateProject({
                structureProgress: newProgress,
            });
        }
    }, [structureProgress, currentProject, updateProject]);

    // ログコピー機能
    const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
        const typeLabels: Record<string, string> = {
            basic: '基本AI章立て提案',
            structure: '構成バランスAI提案',
        };
        const typeLabel = typeLabels[log.type] || log.type;
        const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${log.parsedChapters && log.parsedChapters.length > 0 ? `【解析された章数】
${log.parsedChapters.length}章

【解析された章の詳細】
${log.parsedChapters.map((ch, i: number) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}` : ''}`;

        navigator.clipboard.writeText(logText);
        showSuccess('ログをクリップボードにコピーしました');
    }, [showSuccess]);

    // ログダウンロード機能
    const handleDownloadLogs = useCallback(async () => {
        const typeLabels: Record<string, string> = {
            basic: '基本AI章立て提案',
            structure: '構成バランスAI提案',
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

${log.parsedChapters && log.parsedChapters.length > 0 ? `【解析された章数】
${log.parsedChapters.length}章

【解析された章の詳細】
${log.parsedChapters.map((ch, i: number) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}` : ''}

${'='.repeat(80)}`;
        }).join('\n\n');

        const filename = `chapter_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
        const result = await exportFile({
            filename,
            content: logsText,
            mimeType: 'text/plain',
            title: '章立てAIログ',
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

    const isAnyLoading = isGenerating || isGeneratingStructure;

    return (
        <div className="space-y-4">
            {/* 生成中のローディングインジケーター */}
            {isAnyLoading && (
                <AILoadingIndicator
                    message={
                        isGeneratingStructure
                            ? '章立て構成を生成中'
                            : '章立てを生成中'
                    }
                    estimatedTime={60}
                    variant="inline"
                    cancellable={true}
                    onCancel={
                        isGeneratingStructure
                            ? handleCancelStructure
                            : handleCancelBasic
                    }
                />
            )}

            {/* AI章立て提案（メイン） */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-blue-500" />
                    AI章立て提案
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-3">
                    構成詳細（起承転結・三幕構成・四幕構成）を最重要視し、ジャンルに適した章立てを自動生成します。
                </p>
                <button
                    onClick={() => handleAIGenerate()}
                    disabled={isAnyLoading || !isConfigured}
                    className="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                >
                    {isGenerating ? (
                        <>
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>生成中...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4" />
                            <span>AI章立て提案</span>
                        </>
                    )}
                </button>
            </div>

            {/* 構成バランス */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    構成バランス
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-3">
                    各構成要素が実装できているかチェックしてください
                </p>
                <div className="space-y-2">
                    {(['introduction', 'development', 'climax', 'conclusion'] as const).map((key) => {
                        const labels = {
                            introduction: { name: '導入部', desc: '世界観、キャラクター、基本設定を提示' },
                            development: { name: '展開部', desc: '葛藤や問題を発展させ、物語を深める' },
                            climax: { name: 'クライマックス', desc: '物語の最高潮、最大の転換点' },
                            conclusion: { name: '結末部', desc: '問題の解決、物語の締めくくり' },
                        };
                        const label = labels[key];
                        const completed = structureProgress[key];

                        return (
                            <div key={key} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleStructureProgressChange(key)}
                                        className="flex items-center justify-center w-4 h-4 rounded border-2 transition-colors flex-shrink-0"
                                        style={{
                                            backgroundColor: completed ? '#10b981' : 'transparent',
                                            borderColor: completed ? '#10b981' : '#d1d5db',
                                        }}
                                    >
                                        {completed && (
                                            <CheckCircle className="w-3 h-3 text-white" />
                                        )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{label.name}</span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] truncate">{label.desc}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 構成バランスAI提案ボタン */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-['Noto_Sans_JP']">
                        未完了の構成要素に焦点を当て、構成詳細を最重要視した章立てをAIが提案します。
                    </p>
                    <button
                        onClick={() => handleStructureBasedAIGenerate()}
                        disabled={isAnyLoading || Object.values(structureProgress).every(Boolean)}
                        className="w-full px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                    >
                        {isGeneratingStructure ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin" />
                                <span>生成中...</span>
                            </>
                        ) : Object.values(structureProgress).every(Boolean) ? (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                <span>すべて完了済み</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                <span>構成バランス提案</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 進捗状況 */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-1">
                    進捗状況
                </h3>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">作成済み章数</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                        {currentProject.chapters.length} / 10
                    </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-teal-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((currentProject.chapters.length / 10) * 100, 100)}%` }}
                    />
                </div>
            </div>

            {/* AIログ */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
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
                            'basic': '基本提案',
                            'structure': '構成提案',
                        }}
                        renderLogContent={(log) => (
                            <>
                                {log.parsedChapters && log.parsedChapters.length > 0 && (
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        <strong>解析された章 ({log.parsedChapters.length}章):</strong>
                                        <div className="mt-1">
                                            {log.parsedChapters.map((c) => c.title).join(', ')}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        compact={true}
                    />
                </div>
            </div>
        </div>
    );
};

