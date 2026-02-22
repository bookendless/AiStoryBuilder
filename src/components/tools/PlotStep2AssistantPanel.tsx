import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Sparkles, AlertCircle, Loader2, CheckCircle, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import type { PlotStructureType, PlotFormData, ConsistencyCheck } from '../steps/plot2/types';
import { PLOT_STRUCTURE_CONFIGS, AI_LOG_TYPE_LABELS } from '../steps/plot2/constants';
import { getProjectContext, getStructureFields, formatCharactersInfo } from '../steps/plot2/utils';
import { exportFile } from '../../utils/mobileExportUtils';
import { Modal } from '../common/Modal';

export const PlotStep2AssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showSuccess, showError } = useToast();
    const { handleAPIError } = useErrorHandler();
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const { aiLogs, addLog } = useAILog({
        projectId: currentProject?.id,
        autoLoad: true,
    });
    const [consistencyCheck, setConsistencyCheck] = useState<ConsistencyCheck | null>(null);
    const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
    const structureAbortControllerRef = useRef<AbortController | null>(null);
    const consistencyAbortControllerRef = useRef<AbortController | null>(null);

    // plotStructureとformDataは直接currentProjectから取得して即座に反映
    // これにより、PlotStep2との状態競合を防ぐ
    const plotStructure = (currentProject?.plot?.structure || 'kishotenketsu') as PlotStructureType;

    // formDataをcurrentProjectから直接構築（読み取り専用）
    const formData: PlotFormData = useMemo(() => ({
        ki: currentProject?.plot?.ki || '',
        sho: currentProject?.plot?.sho || '',
        ten: currentProject?.plot?.ten || '',
        ketsu: currentProject?.plot?.ketsu || '',
        act1: currentProject?.plot?.act1 || '',
        act2: currentProject?.plot?.act2 || '',
        act3: currentProject?.plot?.act3 || '',
        fourAct1: currentProject?.plot?.fourAct1 || '',
        fourAct2: currentProject?.plot?.fourAct2 || '',
        fourAct3: currentProject?.plot?.fourAct3 || '',
        fourAct4: currentProject?.plot?.fourAct4 || '',
        hj1: currentProject?.plot?.hj1 || '',
        hj2: currentProject?.plot?.hj2 || '',
        hj3: currentProject?.plot?.hj3 || '',
        hj4: currentProject?.plot?.hj4 || '',
        hj5: currentProject?.plot?.hj5 || '',
        hj6: currentProject?.plot?.hj6 || '',
        hj7: currentProject?.plot?.hj7 || '',
        hj8: currentProject?.plot?.hj8 || '',
        bs1: currentProject?.plot?.bs1 || '',
        bs2: currentProject?.plot?.bs2 || '',
        bs3: currentProject?.plot?.bs3 || '',
        bs4: currentProject?.plot?.bs4 || '',
        bs5: currentProject?.plot?.bs5 || '',
        bs6: currentProject?.plot?.bs6 || '',
        bs7: currentProject?.plot?.bs7 || '',
        ms1: currentProject?.plot?.ms1 || '',
        ms2: currentProject?.plot?.ms2 || '',
        ms3: currentProject?.plot?.ms3 || '',
        ms4: currentProject?.plot?.ms4 || '',
        ms5: currentProject?.plot?.ms5 || '',
        ms6: currentProject?.plot?.ms6 || '',
        ms7: currentProject?.plot?.ms7 || '',
    }), [currentProject?.plot]);

    // キャンセルハンドラー
    const handleCancelStructure = useCallback(() => {
        if (structureAbortControllerRef.current) {
            structureAbortControllerRef.current.abort();
            structureAbortControllerRef.current = null;
            setIsGenerating(null);
        }
    }, []);

    const handleCancelConsistency = useCallback(() => {
        if (consistencyAbortControllerRef.current) {
            consistencyAbortControllerRef.current.abort();
            consistencyAbortControllerRef.current = null;
            setIsGenerating(null);
        }
    }, []);

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (structureAbortControllerRef.current) {
                structureAbortControllerRef.current.abort();
                structureAbortControllerRef.current = null;
            }
            if (consistencyAbortControllerRef.current) {
                consistencyAbortControllerRef.current.abort();
                consistencyAbortControllerRef.current = null;
            }
        };
    }, []);

    // 構成全体の生成
    const handleStructureAIGenerate = useCallback(async () => {
        if (isGenerating) return;

        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                'プロット構成生成',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        // 既存のリクエストをキャンセル
        if (structureAbortControllerRef.current) {
            structureAbortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        structureAbortControllerRef.current = abortController;

        setIsGenerating('structure');

        try {
            const context = getProjectContext(currentProject);
            if (!context) {
                handleAPIError(
                    new Error('プロジェクト情報が見つかりません'),
                    'プロット構成生成',
                    {
                        title: 'プロジェクトエラー',
                        duration: 5000,
                    }
                );
                return;
            }

            const charactersInfo = formatCharactersInfo(context.characters);
            const ending = currentProject?.plot?.ending ? `物語の結末: ${currentProject.plot.ending}` : '';
            const reversePrompting = currentProject?.plot?.ending
                ? `【逆算プロンプティング（Goal-Oriented Prompting）】
上記の「物語の結末」から逆算して、その結末に至るための物語構成を構築してください。
結末を目標として、そこに到達するための{structureType}の各段階を設計してください。
結末に自然に繋がるように、各段階で必要な要素や展開を配置してください。`
                : '【重要】上記のプロット基礎設定を必ず反映し、一貫性のある物語構成を提案してください。';

            let structureType = '';
            let structureDescription = '';
            let outputFormat = '';

            if (plotStructure === 'kishotenketsu') {
                structureType = '起承転結';
                structureDescription = `起承転結の構成について：
- 起：物語の始まり、登場人物の紹介、日常の描写、事件の発端
- 承：事件の発展、状況の変化、新たな登場人物、問題の詳細化
- 転：大きな転換点、予想外の展開、クライマックス、物語の核心
- 結：問題の解決、物語の終結、キャラクターの成長、新たな始まり`;
                outputFormat = `{
  "起（導入）": "起（導入）を500文字以内で記述",
  "承（展開）": "承（展開）を500文字以内で記述",
  "転（転換）": "転（転換）を500文字以内で記述",
  "結（結末）": "結（結末）を500文字以内で記述"
}`;
            } else if (plotStructure === 'three-act') {
                structureType = '三幕構成';
                structureDescription = `三幕構成について：
- 第1幕：導入、設定、事件の発端、登場人物の紹介、世界観の設定
- 第2幕：展開、対立の激化、主人公の試練、クライマックスへの準備、物語の核心部分
- 第3幕：クライマックス、問題の解決、物語の結末、キャラクターの成長、最終的な解決`;
                outputFormat = `{
  "第1幕（導入）": "第1幕を500文字以内で記述",
  "第2幕（展開）": "第2幕を500文字以内で記述",
  "第3幕（結末）": "第3幕を500文字以内で記述"
}`;
            } else if (plotStructure === 'four-act') {
                structureType = '四幕構成';
                structureDescription = `四幕構成（ダン・ハーモンの秩序と混沌の対比）について：
- 第1幕（秩序）：日常の確立、キャラクター紹介、世界観の設定、平穏な状態
- 第2幕（混沌）：問題の発生、状況の悪化、困難の増大、秩序の崩壊
- 第3幕（秩序）：解決への取り組み、希望の光、状況の改善、秩序の回復への努力
- 第4幕（混沌）：最終的な試練、真の解決、物語の結末、新しい秩序の確立`;
                outputFormat = `{
  "第1幕（秩序）": "第1幕（秩序）を500文字以内で記述",
  "第2幕（混沌）": "第2幕（混沌）を500文字以内で記述",
  "第3幕（秩序）": "第3幕（秩序）を500文字以内で記述",
  "第4幕（混沌）": "第4幕（混沌）を500文字以内で記述"
}`;
            } else if (plotStructure === 'heroes-journey') {
                structureType = 'ヒーローズ・ジャーニー';
                structureDescription = `ヒーローズ・ジャーニー（神話の法則）について：
- 日常の世界：主人公の現状、平穏な日常
- 冒険への誘い：事件の始まり、冒険への呼びかけ
- 境界越え：非日常への旅立ち、新しい世界への入り口
- 試練と仲間：最初の試練、仲間との出会い、敵との遭遇
- 最大の試練：物語の底、敗北や死の危険、絶望の瞬間
- 報酬：剣（力）の獲得、勝利の報酬、重要な発見
- 帰路：追跡される帰路、最後の試練、脱出
- 復活と帰還：成長した主人公の帰還、新しい日常、変化の完成`;
                outputFormat = `{
  "日常の世界": "日常の世界を500文字以内で記述",
  "冒険への誘い": "冒険への誘いを500文字以内で記述",
  "境界越え": "境界越えを500文字以内で記述",
  "試練と仲間": "試練と仲間を500文字以内で記述",
  "最大の試練": "最大の試練を500文字以内で記述",
  "報酬": "報酬を500文字以内で記述",
  "帰路": "帰路を500文字以内で記述",
  "復活と帰還": "復活と帰還を500文字以内で記述"
}`;
            } else if (plotStructure === 'beat-sheet') {
                structureType = 'ビートシート';
                structureDescription = `ビートシート（Save the Cat! 風）について：
- 導入 (Setup)：日常、テーマの提示、きっかけ（事件発生）
- 決断 (Break into Two)：葛藤の末の決断、新しい世界への旅立ち
- 試練 (Fun and Games)：新しい世界での試行錯誤、サブプロットの展開
- 転換点 (Midpoint)：物語の中間点、状況の一変（偽の勝利または敗北）
- 危機 (All Is Lost)：迫り来る敵、絶望、魂の暗夜
- クライマックス (Finale)：再起、解決への最後の戦い
- 結末 (Final Image)：変化した世界、新たな日常`;
                outputFormat = `{
  "導入 (Setup)": "導入 (Setup)を500文字以内で記述",
  "決断 (Break into Two)": "決断 (Break into Two)を500文字以内で記述",
  "試練 (Fun and Games)": "試練 (Fun and Games)を500文字以内で記述",
  "転換点 (Midpoint)": "転換点 (Midpoint)を500文字以内で記述",
  "危機 (All Is Lost)": "危機 (All Is Lost)を500文字以内で記述",
  "クライマックス (Finale)": "クライマックス (Finale)を500文字以内で記述",
  "結末 (Final Image)": "結末 (Final Image)を500文字以内で記述"
}`;
            } else if (plotStructure === 'mystery-suspense') {
                structureType = 'ミステリー・サスペンス構成';
                structureDescription = `ミステリー・サスペンス構成について：
- 発端（事件発生）：不可解な事件の提示、謎の始まり
- 捜査（初期）：状況確認、関係者への聴取、初期の手がかり
- 仮説とミスリード：誤った推理、ミスリード、謎が深まる
- 第二の事件/急展開：捜査の行き詰まり、新たな事件、急展開
- 手がかりの統合：手がかりの統合、真相への気づき、重要な発見
- 解決（真相解明）：犯人の指摘、トリックの暴き、真相の解明
- エピローグ：事件後の余韻、影響、物語の結末`;
                outputFormat = `{
  "発端（事件発生）": "発端（事件発生）を500文字以内で記述",
  "捜査（初期）": "捜査（初期）を500文字以内で記述",
  "仮説とミスリード": "仮説とミスリードを500文字以内で記述",
  "第二の事件/急展開": "第二の事件/急展開を500文字以内で記述",
  "手がかりの統合": "手がかりの統合を500文字以内で記述",
  "解決（真相解明）": "解決（真相解明）を500文字以内で記述",
  "エピローグ": "エピローグを500文字以内で記述"
}`;
            }

            const prompt = aiService.buildPrompt('plot', 'generateStructure', {
                structureType: structureType,
                title: context.title,
                mainGenre: context.mainGenre || context.genre,
                subGenre: context.subGenre || '未設定',
                projectTheme: context.projectTheme,
                charactersInfo: charactersInfo,
                plotTheme: currentProject?.plot?.theme || '未設定',
                plotSetting: currentProject?.plot?.setting || '未設定',
                plotHook: currentProject?.plot?.hook || '未設定',
                protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
                mainObstacle: currentProject?.plot?.mainObstacle || '未設定',
                ending: ending,
                reversePrompting: reversePrompting.replace('{structureType}', structureType),
                structureDescription: structureDescription,
                outputFormat: outputFormat,
            });

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

            addLog({
                type: 'generateStructure',
                prompt,
                response: response.content || '',
                error: response.error,
                structureType: structureType,
            });

            if (response.error) {
                handleAPIError(
                    new Error(response.error),
                    'プロット構成生成',
                    {
                        title: 'AI生成エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleStructureAIGenerate(),
                    }
                );
                return;
            }

            const content = response.content;
            let normalizedContent = content.trim();
            if (normalizedContent.startsWith('{{') && normalizedContent.endsWith('}}')) {
                normalizedContent = normalizedContent.slice(1, -1);
            }

            const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    let jsonString = jsonMatch[0];
                    if (jsonString.startsWith('{{')) {
                        jsonString = jsonString.slice(1);
                    }
                    if (jsonString.endsWith('}}')) {
                        jsonString = jsonString.slice(0, -1);
                    }
                    const parsed = JSON.parse(jsonString);

                    const getStringValue = (key: string, defaultValue: string): string => {
                        const value = parsed[key];
                        return typeof value === 'string' ? value : defaultValue;
                    };

                    // updateProjectを使用してプロジェクトを直接更新
                    // これにより、PlotStep2のusePlotFormフックと競合しない
                    let plotUpdates: Record<string, string> = {};

                    if (plotStructure === 'kishotenketsu') {
                        plotUpdates = {
                            ki: getStringValue('起（導入）', formData.ki),
                            sho: getStringValue('承（展開）', formData.sho),
                            ten: getStringValue('転（転換）', formData.ten),
                            ketsu: getStringValue('結（結末）', formData.ketsu),
                        };
                    } else if (plotStructure === 'three-act') {
                        plotUpdates = {
                            act1: getStringValue('第1幕（導入）', formData.act1),
                            act2: getStringValue('第2幕（展開）', formData.act2),
                            act3: getStringValue('第3幕（結末）', formData.act3),
                        };
                    } else if (plotStructure === 'four-act') {
                        plotUpdates = {
                            fourAct1: getStringValue('第1幕（秩序）', formData.fourAct1),
                            fourAct2: getStringValue('第2幕（混沌）', formData.fourAct2),
                            fourAct3: getStringValue('第3幕（秩序）', formData.fourAct3),
                            fourAct4: getStringValue('第4幕（混沌）', formData.fourAct4),
                        };
                    } else if (plotStructure === 'heroes-journey') {
                        plotUpdates = {
                            hj1: getStringValue('日常の世界', formData.hj1),
                            hj2: getStringValue('冒険への誘い', formData.hj2),
                            hj3: getStringValue('境界越え', formData.hj3),
                            hj4: getStringValue('試練と仲間', formData.hj4),
                            hj5: getStringValue('最大の試練', formData.hj5),
                            hj6: getStringValue('報酬', formData.hj6),
                            hj7: getStringValue('帰路', formData.hj7),
                            hj8: getStringValue('復活と帰還', formData.hj8),
                        };
                    } else if (plotStructure === 'beat-sheet') {
                        plotUpdates = {
                            bs1: getStringValue('導入 (Setup)', formData.bs1),
                            bs2: getStringValue('決断 (Break into Two)', formData.bs2),
                            bs3: getStringValue('試練 (Fun and Games)', formData.bs3),
                            bs4: getStringValue('転換点 (Midpoint)', formData.bs4),
                            bs5: getStringValue('危機 (All Is Lost)', formData.bs5),
                            bs6: getStringValue('クライマックス (Finale)', formData.bs6),
                            bs7: getStringValue('結末 (Final Image)', formData.bs7),
                        };
                    } else if (plotStructure === 'mystery-suspense') {
                        plotUpdates = {
                            ms1: getStringValue('発端（事件発生）', formData.ms1),
                            ms2: getStringValue('捜査（初期）', formData.ms2),
                            ms3: getStringValue('仮説とミスリード', formData.ms3),
                            ms4: getStringValue('第二の事件/急展開', formData.ms4),
                            ms5: getStringValue('手がかりの統合', formData.ms5),
                            ms6: getStringValue('解決（真相解明）', formData.ms6),
                            ms7: getStringValue('エピローグ', formData.ms7),
                        };
                    }

                    // プロジェクトを直接更新（即座に保存）
                    const currentPlot = currentProject?.plot;
                    await updateProject({
                        plot: {
                            theme: currentPlot?.theme || '',
                            setting: currentPlot?.setting || '',
                            hook: currentPlot?.hook || '',
                            protagonistGoal: currentPlot?.protagonistGoal || '',
                            mainObstacle: currentPlot?.mainObstacle || '',
                            ...currentPlot,
                            ...plotUpdates,
                        }
                    }, true);

                    showSuccess(`${PLOT_STRUCTURE_CONFIGS[plotStructure].label}の内容を生成しました`);
                } catch (error) {
                    console.error('JSON解析エラー:', error);
                    handleAPIError(
                        error,
                        'プロット構成生成',
                        {
                            title: '解析エラー',
                            duration: 7000,
                            showDetails: true,
                            onRetry: () => handleStructureAIGenerate(),
                        }
                    );
                }
            } else {
                handleAPIError(
                    new Error('AI出力の形式が正しくありません'),
                    'プロット構成生成',
                    {
                        title: '形式エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleStructureAIGenerate(),
                    }
                );
            }
        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('AI生成エラー:', error);
            handleAPIError(
                error,
                'プロット構成生成',
                {
                    title: 'AI生成中にエラーが発生しました',
                    duration: 7000,
                    showDetails: true,
                    onRetry: () => handleStructureAIGenerate(),
                }
            );
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(null);
            }
            structureAbortControllerRef.current = null;
        }
    }, [isConfigured, currentProject, plotStructure, formData, settings, addLog, showError, showSuccess, updateProject, isGenerating]);

    // 一貫性チェック
    const checkConsistency = useCallback(async () => {
        if (isGenerating) return;

        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                '一貫性チェック',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        // 既存のリクエストをキャンセル
        if (consistencyAbortControllerRef.current) {
            consistencyAbortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        consistencyAbortControllerRef.current = abortController;

        setIsGenerating('consistency');

        try {
            const context = getProjectContext(currentProject);
            if (!context) {
                handleAPIError(
                    new Error('プロジェクト情報が見つかりません'),
                    '一貫性チェック',
                    {
                        title: 'プロジェクトエラー',
                        duration: 5000,
                    }
                );
                return;
            }

            const structureFields = getStructureFields(plotStructure, formData);
            const structureText = structureFields.map(f => `${f.label}: ${f.value}`).join('\n\n');

            const prompt = aiService.buildPrompt('plot', 'consistency', {
                title: context.title,
                mainGenre: context.mainGenre || context.genre,
                projectTheme: context.projectTheme,
                plotTheme: currentProject?.plot?.theme || '未設定',
                plotSetting: currentProject?.plot?.setting || '未設定',
                protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
                mainObstacle: currentProject?.plot?.mainObstacle || '未設定',
                structureText: structureText,
            });

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

            addLog({
                type: 'consistency',
                prompt,
                response: response.content || '',
                error: response.error,
            });

            if (response.error) {
                handleAPIError(
                    new Error(response.error),
                    'プロット構成生成',
                    {
                        title: 'AI生成エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleStructureAIGenerate(),
                    }
                );
                return;
            }

            const content = response.content;
            let normalizedContent = content.trim();
            if (normalizedContent.startsWith('{{') && normalizedContent.endsWith('}}')) {
                normalizedContent = normalizedContent.slice(1, -1);
            }

            const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    let jsonString = jsonMatch[0];
                    if (jsonString.startsWith('{{')) {
                        jsonString = jsonString.slice(1);
                    }
                    if (jsonString.endsWith('}}')) {
                        jsonString = jsonString.slice(0, -1);
                    }
                    const parsed = JSON.parse(jsonString);
                    const issues = Array.isArray(parsed.issues)
                        ? parsed.issues.filter((issue: unknown) => typeof issue === 'string')
                        : [];
                    const suggestions = Array.isArray(parsed.suggestions)
                        ? parsed.suggestions.filter((suggestion: unknown) => typeof suggestion === 'string')
                        : [];
                    setConsistencyCheck({
                        hasIssues: typeof parsed.hasIssues === 'boolean' ? parsed.hasIssues : false,
                        issues: issues,
                        suggestions: suggestions,
                    });
                    setIsConsistencyModalOpen(true);
                    showSuccess('一貫性チェックが完了しました');
                } catch (error) {
                    console.error('JSON解析エラー:', error);
                    showError('AI出力の解析に失敗しました。', 7000, {
                        title: '解析エラー',
                    });
                }
            }
        } catch (error) {
            // キャンセルされた場合はエラーを表示しない
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('一貫性チェックエラー:', error);
            handleAPIError(
                error,
                '一貫性チェック',
                {
                    title: '一貫性チェック中にエラーが発生しました',
                    duration: 7000,
                    showDetails: true,
                    onRetry: () => checkConsistency(),
                }
            );
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(null);
            }
            consistencyAbortControllerRef.current = null;
        }
    }, [isConfigured, formData, plotStructure, currentProject, settings, addLog, handleAPIError, showSuccess, isGenerating]);

    // 一貫性チェックから自動修正を適用
    const handleApplyConsistency = useCallback(async () => {
        if (!consistencyCheck || !consistencyCheck.hasIssues || !consistencyCheck.suggestions.length) return;

        if (isGenerating) return;

        if (!isConfigured) {
            handleAPIError(
                new Error('AI設定が必要です'),
                'プロット自動修正',
                {
                    title: 'AI設定が必要',
                    duration: 7000,
                }
            );
            return;
        }

        if (consistencyAbortControllerRef.current) {
            consistencyAbortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        consistencyAbortControllerRef.current = abortController;

        setIsGenerating('applyConsistency');

        try {
            const context = getProjectContext(currentProject);
            if (!context) {
                handleAPIError(
                    new Error('プロジェクト情報が見つかりません'),
                    'プロット自動修正',
                    {
                        title: 'プロジェクトエラー',
                        duration: 5000,
                    }
                );
                return;
            }

            const structureFields = getStructureFields(plotStructure, formData);
            const structureText = structureFields.map(f => `${f.label}: ${f.value}`).join('\n\n');
            const suggestionsText = consistencyCheck.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

            let structureType = '';
            let structureDescription = '';
            let outputFormat = '';

            if (plotStructure === 'kishotenketsu') {
                structureType = '起承転結';
                structureDescription = `起承転結の構成について：
- 起：物語の始まり、登場人物の紹介、日常の描写、事件の発端
- 承：事件の発展、状況の変化、新たな登場人物、問題の詳細化
- 転：大きな転換点、予想外の展開、クライマックス、物語の核心
- 結：問題の解決、物語の終結、キャラクターの成長、新たな始まり`;
                outputFormat = `{
  "起（導入）": "修正後の内容を記述",
  "承（展開）": "修正後の内容を記述",
  "転（転換）": "修正後の内容を記述",
  "結（結末）": "修正後の内容を記述"
}`;
            } else if (plotStructure === 'three-act') {
                structureType = '三幕構成';
                structureDescription = `三幕構成について：
- 第1幕：導入、設定、事件の発端、登場人物の紹介、世界観の設定
- 第2幕：展開、対立の激化、主人公の試練、クライマックスへの準備、物語の核心部分
- 第3幕：クライマックス、問題の解決、物語の結末、キャラクターの成長、最終的な解決`;
                outputFormat = `{
  "第1幕（導入）": "修正後の内容を記述",
  "第2幕（展開）": "修正後の内容を記述",
  "第3幕（結末）": "修正後の内容を記述"
}`;
            } else if (plotStructure === 'four-act') {
                structureType = '四幕構成';
                structureDescription = `四幕構成（ダン・ハーモンの秩序と混沌の対比）について：
- 第1幕（秩序）：日常の確立、キャラクター紹介、世界観の設定、平穏な状態
- 第2幕（混沌）：問題の発生、状況の悪化、困難の増大、秩序の崩壊
- 第3幕（秩序）：解決への取り組み、希望の光、状況の改善、秩序の回復への努力
- 第4幕（混沌）：最終的な試練、真の解決、物語の結末、新しい秩序の確立`;
                outputFormat = `{
  "第1幕（秩序）": "修正後の内容を記述",
  "第2幕（混沌）": "修正後の内容を記述",
  "第3幕（秩序）": "修正後の内容を記述",
  "第4幕（混沌）": "修正後の内容を記述"
}`;
            } else if (plotStructure === 'heroes-journey') {
                structureType = 'ヒーローズ・ジャーニー';
                structureDescription = `ヒーローズ・ジャーニー（神話の法則）について：
- 日常の世界：主人公の現状、平穏な日常
- 冒険への誘い：事件の始まり、冒険への呼びかけ
- 境界越え：非日常への旅立ち、新しい世界への入り口
- 試練と仲間：最初の試練、仲間との出会い、敵との遭遇
- 最大の試練：物語の底、敗北や死の危険、絶望の瞬間
- 報酬：剣（力）の獲得、勝利の報酬、重要な発見
- 帰路：追跡される帰路、最後の試練、脱出
- 復活と帰還：成長した主人公の帰還、新しい日常、変化の完成`;
                outputFormat = `{
  "日常の世界": "修正後の内容を記述",
  "冒険への誘い": "修正後の内容を記述",
  "境界越え": "修正後の内容を記述",
  "試練と仲間": "修正後の内容を記述",
  "最大の試練": "修正後の内容を記述",
  "報酬": "修正後の内容を記述",
  "帰路": "修正後の内容を記述",
  "復活と帰還": "修正後の内容を記述"
}`;
            } else if (plotStructure === 'beat-sheet') {
                structureType = 'ビートシート';
                structureDescription = `ビートシート（Save the Cat! 風）について：
- 導入 (Setup)：日常、テーマの提示、きっかけ（事件発生）
- 決断 (Break into Two)：葛藤の末の決断、新しい世界への旅立ち
- 試練 (Fun and Games)：新しい世界での試行錯誤、サブプロットの展開
- 転換点 (Midpoint)：物語の中間点、状況の一変（偽の勝利または敗北）
- 危機 (All Is Lost)：迫り来る敵、絶望、魂の暗夜
- クライマックス (Finale)：再起、解決への最後の戦い
- 結末 (Final Image)：変化した世界、新たな日常`;
                outputFormat = `{
  "導入 (Setup)": "修正後の内容を記述",
  "決断 (Break into Two)": "修正後の内容を記述",
  "試練 (Fun and Games)": "修正後の内容を記述",
  "転換点 (Midpoint)": "修正後の内容を記述",
  "危機 (All Is Lost)": "修正後の内容を記述",
  "クライマックス (Finale)": "修正後の内容を記述",
  "結末 (Final Image)": "修正後の内容を記述"
}`;
            } else if (plotStructure === 'mystery-suspense') {
                structureType = 'ミステリー・サスペンス構成';
                structureDescription = `ミステリー・サスペンス構成について：
- 発端（事件発生）：不可解な事件の提示、謎の始まり
- 捜査（初期）：状況確認、関係者への聴取、初期の手がかり
- 仮説とミスリード：誤った推理、ミスリード、謎が深まる
- 第二の事件/急展開：捜査の行き詰まり、新たな事件、急展開
- 手がかりの統合：手がかりの統合、真相への気づき、重要な発見
- 解決（真相解明）：犯人の指摘、トリックの暴き、真相の解明
- エピローグ：事件後の余韻、影響、物語の結末`;
                outputFormat = `{
  "発端（事件発生）": "修正後の内容を記述",
  "捜査（初期）": "修正後の内容を記述",
  "仮説とミスリード": "修正後の内容を記述",
  "第二の事件/急展開": "修正後の内容を記述",
  "手がかりの統合": "修正後の内容を記述",
  "解決（真相解明）": "修正後の内容を記述",
  "エピローグ": "修正後の内容を記述"
}`;
            }

            const prompt = aiService.buildPrompt('plot', 'applyConsistency', {
                title: context.title,
                mainGenre: context.mainGenre || context.genre,
                projectTheme: context.projectTheme,
                plotTheme: currentProject?.plot?.theme || '未設定',
                plotSetting: currentProject?.plot?.setting || '未設定',
                protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
                mainObstacle: currentProject?.plot?.mainObstacle || '未設定',
                structureText: structureText,
                suggestionsText: suggestionsText,
                structureDescription: structureDescription,
                outputFormat: outputFormat,
            });

            const response = await aiService.generateContent({
                prompt,
                type: 'plot',
                settings,
                signal: abortController.signal,
            });

            if (abortController.signal.aborted) {
                return;
            }

            // applyConsistency logging is recorded with empty type in AILogTypeLabels, but type is preserved
            addLog({
                type: 'applyConsistency',
                prompt,
                response: response.content || '',
                error: response.error,
                structureType: structureType,
            });

            if (response.error) {
                handleAPIError(
                    new Error(response.error),
                    'プロット自動修正',
                    {
                        title: 'AI生成エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleApplyConsistency(),
                    }
                );
                return;
            }

            const content = response.content;
            let normalizedContent = content.trim();
            if (normalizedContent.startsWith('{{') && normalizedContent.endsWith('}}')) {
                normalizedContent = normalizedContent.slice(1, -1);
            }

            const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    let jsonString = jsonMatch[0];
                    if (jsonString.startsWith('{{')) {
                        jsonString = jsonString.slice(1);
                    }
                    if (jsonString.endsWith('}}')) {
                        jsonString = jsonString.slice(0, -1);
                    }
                    const parsed = JSON.parse(jsonString);

                    const getStringValue = (key: string, defaultValue: string): string => {
                        const value = parsed[key];
                        return typeof value === 'string' ? value : defaultValue;
                    };

                    let plotUpdates: Record<string, string> = {};

                    if (plotStructure === 'kishotenketsu') {
                        plotUpdates = {
                            ki: getStringValue('起（導入）', formData.ki),
                            sho: getStringValue('承（展開）', formData.sho),
                            ten: getStringValue('転（転換）', formData.ten),
                            ketsu: getStringValue('結（結末）', formData.ketsu),
                        };
                    } else if (plotStructure === 'three-act') {
                        plotUpdates = {
                            act1: getStringValue('第1幕（導入）', formData.act1),
                            act2: getStringValue('第2幕（展開）', formData.act2),
                            act3: getStringValue('第3幕（結末）', formData.act3),
                        };
                    } else if (plotStructure === 'four-act') {
                        plotUpdates = {
                            fourAct1: getStringValue('第1幕（秩序）', formData.fourAct1),
                            fourAct2: getStringValue('第2幕（混沌）', formData.fourAct2),
                            fourAct3: getStringValue('第3幕（秩序）', formData.fourAct3),
                            fourAct4: getStringValue('第4幕（混沌）', formData.fourAct4),
                        };
                    } else if (plotStructure === 'heroes-journey') {
                        plotUpdates = {
                            hj1: getStringValue('日常の世界', formData.hj1),
                            hj2: getStringValue('冒険への誘い', formData.hj2),
                            hj3: getStringValue('境界越え', formData.hj3),
                            hj4: getStringValue('試練と仲間', formData.hj4),
                            hj5: getStringValue('最大の試練', formData.hj5),
                            hj6: getStringValue('報酬', formData.hj6),
                            hj7: getStringValue('帰路', formData.hj7),
                            hj8: getStringValue('復活と帰還', formData.hj8),
                        };
                    } else if (plotStructure === 'beat-sheet') {
                        plotUpdates = {
                            bs1: getStringValue('導入 (Setup)', formData.bs1),
                            bs2: getStringValue('決断 (Break into Two)', formData.bs2),
                            bs3: getStringValue('試練 (Fun and Games)', formData.bs3),
                            bs4: getStringValue('転換点 (Midpoint)', formData.bs4),
                            bs5: getStringValue('危機 (All Is Lost)', formData.bs5),
                            bs6: getStringValue('クライマックス (Finale)', formData.bs6),
                            bs7: getStringValue('結末 (Final Image)', formData.bs7),
                        };
                    } else if (plotStructure === 'mystery-suspense') {
                        plotUpdates = {
                            ms1: getStringValue('発端（事件発生）', formData.ms1),
                            ms2: getStringValue('捜査（初期）', formData.ms2),
                            ms3: getStringValue('仮説とミスリード', formData.ms3),
                            ms4: getStringValue('第二の事件/急展開', formData.ms4),
                            ms5: getStringValue('手がかりの統合', formData.ms5),
                            ms6: getStringValue('解決（真相解明）', formData.ms6),
                            ms7: getStringValue('エピローグ', formData.ms7),
                        };
                    }

                    const currentPlot = currentProject?.plot;
                    await updateProject({
                        plot: {
                            theme: currentPlot?.theme || '',
                            setting: currentPlot?.setting || '',
                            hook: currentPlot?.hook || '',
                            protagonistGoal: currentPlot?.protagonistGoal || '',
                            mainObstacle: currentPlot?.mainObstacle || '',
                            ...currentPlot,
                            ...plotUpdates,
                        }
                    }, true);

                    showSuccess('提案に従ってプロットを修正しました');
                    setIsConsistencyModalOpen(false);
                } catch (error) {
                    console.error('JSON解析エラー:', error);
                    handleAPIError(
                        error,
                        'プロット自動修正',
                        {
                            title: '解析エラー',
                            duration: 7000,
                            showDetails: true,
                            onRetry: () => handleApplyConsistency(),
                        }
                    );
                }
            } else {
                handleAPIError(
                    new Error('AI出力の形式が正しくありません'),
                    'プロット自動修正',
                    {
                        title: '形式エラー',
                        duration: 7000,
                        showDetails: true,
                        onRetry: () => handleApplyConsistency(),
                    }
                );
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('自動修正エラー:', error);
            handleAPIError(
                error,
                'プロット自動修正',
                {
                    title: '自動修正中にエラーが発生しました',
                    duration: 7000,
                    showDetails: true,
                    onRetry: () => handleApplyConsistency(),
                }
            );
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(null);
            }
            consistencyAbortControllerRef.current = null;
        }
    }, [isConfigured, formData, plotStructure, currentProject, consistencyCheck, settings, addLog, updateProject, handleAPIError, showSuccess, isGenerating]);

    // 進捗状況を計算
    const progress = useMemo(() => {
        const structureFields = getStructureFields(plotStructure, formData);
        const completedFields = structureFields.filter(field => field.value.trim().length > 0);
        const progressPercentage = (completedFields.length / structureFields.length) * 100;

        return {
            completed: completedFields.length,
            total: structureFields.length,
            percentage: progressPercentage,
        };
    }, [plotStructure, formData]);

    // AIログをコピー
    const handleCopyLog = useCallback(async (log: typeof aiLogs[0]) => {
        const typeLabel = AI_LOG_TYPE_LABELS[log.type] || log.type;
        const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.fieldLabel ? `フィールド: ${log.fieldLabel}\n` : ''}
${log.structureType ? `構造タイプ: ${log.structureType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

        try {
            await navigator.clipboard.writeText(logText);
            showSuccess('ログをクリップボードにコピーしました');
        } catch (error) {
            console.error('クリップボードへのコピーに失敗しました:', error);
            handleAPIError(
                error,
                'ログのコピー',
                {
                    title: 'コピーエラー',
                    duration: 5000,
                }
            );
        }
    }, [showSuccess, showError]);

    // AIログをダウンロード
    const handleDownloadLogs = useCallback(async () => {
        try {
            const logsText = aiLogs.map(log => {
                const typeLabel = AI_LOG_TYPE_LABELS[log.type] || log.type;
                return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.fieldLabel ? `フィールド: ${log.fieldLabel}\n` : ''}
${log.structureType ? `構造タイプ: ${log.structureType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`;
            }).join('\n\n');

            const filename = `plot_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
            const result = await exportFile({
                filename,
                content: logsText,
                mimeType: 'text/plain',
                title: 'プロット構成AIログ',
            });

            if (result.success) {
                showSuccess('ログをダウンロードしました');
            } else if (result.method === 'error') {
                handleAPIError(
                    new Error(result.error || 'ログのダウンロードに失敗しました'),
                    'ログのダウンロード',
                    {
                        title: 'ダウンロードエラー',
                        duration: 5000,
                    }
                );
            }
        } catch (error) {
            console.error('ログのダウンロードに失敗しました:', error);
            handleAPIError(
                error,
                'ログのダウンロード',
                {
                    title: 'ダウンロードエラー',
                    duration: 5000,
                }
            );
        }
    }, [aiLogs, showSuccess, showError]);

    if (!currentProject) return null;

    return (
        <div className="space-y-4">
            {/* AI生成中のローディングインジケーター */}
            {isGenerating && (
                <AILoadingIndicator
                    message={
                        isGenerating === 'consistency'
                            ? 'プロット構成の一貫性をチェック中'
                            : 'プロット構成を生成中'
                    }
                    estimatedTime={30}
                    variant="inline"
                    cancellable={true}
                    onCancel={
                        isGenerating === 'consistency'
                            ? handleCancelConsistency
                            : handleCancelStructure
                    }
                />
            )}

            {/* 構成全体の生成 */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                    {PLOT_STRUCTURE_CONFIGS[plotStructure].label}提案
                </h3>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-3">
                        プロジェクト設定に基づき、{PLOT_STRUCTURE_CONFIGS[plotStructure].label}の内容を一括生成します。
                    </p>
                    {currentProject?.plot?.ending && (
                        <div className="mb-3 p-2 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-300 dark:border-purple-700">
                            <p className="text-xs text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">
                                ✨ 結末が設定されているため、逆算プロンプティング機能が利用可能です
                            </p>
                        </div>
                    )}
                    <button
                        onClick={handleStructureAIGenerate}
                        disabled={isGenerating === 'structure' || !isConfigured}
                        className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                    >
                        {isGenerating === 'structure' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>生成中...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                <span>{PLOT_STRUCTURE_CONFIGS[plotStructure].label}をAI提案</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 一貫性チェック */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                    一貫性チェック
                </h3>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-3">
                        構成要素の一貫性をAIでチェックします。
                    </p>
                    <button
                        onClick={checkConsistency}
                        disabled={isGenerating === 'consistency' || !isConfigured}
                        className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2 text-sm"
                    >
                        {isGenerating === 'consistency' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>チェック中...</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-4 w-4" />
                                <span>一貫性をチェック</span>
                            </>
                        )}
                    </button>
                </div>

                {/* 一貫性チェック結果（サマリー表示） */}
                {consistencyCheck && (
                    <div className={`mt-3 p-3 rounded-lg border flex items-center justify-between text-sm font-['Noto_Sans_JP'] ${consistencyCheck.hasIssues
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}>
                        <div className="flex items-center space-x-2">
                            <AlertCircle className={`h-4 w-4 ${consistencyCheck.hasIssues
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-green-600 dark:text-green-400'
                                }`} />
                            <span className={`font-semibold ${consistencyCheck.hasIssues
                                ? 'text-amber-800 dark:text-amber-200'
                                : 'text-green-800 dark:text-green-200'
                                }`}>
                                {consistencyCheck.hasIssues ? '一貫性の問題が見つかりました' : '一貫性チェック完了：問題なし'}
                            </span>
                        </div>
                        {consistencyCheck.hasIssues && (
                            <button
                                onClick={() => setIsConsistencyModalOpen(true)}
                                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded text-xs font-semibold transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            >
                                詳細を確認
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 進捗状況 */}
            <div>
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
                            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-emerald-500"
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
                    {progress.percentage === 100 && (
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-semibold text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                                    {PLOT_STRUCTURE_CONFIGS[plotStructure].label}完成！
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* AIログ */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                    AIログ
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <AILogPanel
                        logs={aiLogs}
                        onCopyLog={handleCopyLog}
                        onDownloadLogs={handleDownloadLogs}
                        typeLabels={{
                            supplement: '補完',
                            consistency: '一貫性チェック',
                            generateStructure: '構造生成',
                            applyConsistency: 'プロット自動修正', // adding label here inside AILogPanel props
                        }}
                        maxHeight="max-h-96"
                    />
                </div>
            </div>

            {/* 一貫性チェック結果表示用モーダル */}
            <Modal
                isOpen={isConsistencyModalOpen}
                onClose={() => setIsConsistencyModalOpen(false)}
                title="プロットの一貫性チェック結果"
                size="lg"
            >
                <div className="space-y-6 font-['Noto_Sans_JP']">
                    {consistencyCheck && consistencyCheck.hasIssues ? (
                        <>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center">
                                    <AlertCircle className="w-5 h-5 mr-2" />
                                    指摘された問題点
                                </h4>
                                <ul className="list-disc list-inside space-y-2 text-sm text-amber-700 dark:text-amber-300">
                                    {consistencyCheck.issues.map((issue, index) => (
                                        <li key={index} className="leading-relaxed">{issue}</li>
                                    ))}
                                </ul>
                            </div>

                            {consistencyCheck.suggestions && consistencyCheck.suggestions.length > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        改善提案
                                    </h4>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-blue-700 dark:text-blue-300">
                                        {consistencyCheck.suggestions.map((suggestion, index) => (
                                            <li key={index} className="leading-relaxed">{suggestion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end pt-4 space-x-3 border-t border-gray-200 dark:border-gray-700 mt-6">
                                <button
                                    onClick={() => setIsConsistencyModalOpen(false)}
                                    className="px-4 py-2 text-sm justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    閉じる
                                </button>
                                <button
                                    onClick={handleApplyConsistency}
                                    disabled={isGenerating === 'applyConsistency'}
                                    className="px-4 py-2 text-sm justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold transition-all shadow shadow-blue-500/30 flex items-center disabled:opacity-50"
                                >
                                    {isGenerating === 'applyConsistency' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            修正中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            提案に従って修正を実施
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center text-green-600 dark:text-green-400">
                            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-80" />
                            <p className="font-semibold text-lg">一貫性チェック完了：問題なし</p>
                            <p className="text-sm mt-2 opacity-80">現在の構成に大きな問題は見つかりませんでした。</p>
                            <button
                                onClick={() => setIsConsistencyModalOpen(false)}
                                className="mt-6 px-6 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded-lg transition-colors font-semibold"
                            >
                                閉じる
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

