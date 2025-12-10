import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Sparkles, Loader, CheckCircle, FileText, BookOpen } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { aiService } from '../../services/aiService';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { StructureProgress } from '../steps/chapter/types';

export const ChapterAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess, showWarning, showInfo } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
    const { aiLogs, addLog } = useAILog();
    const basicAbortControllerRef = useRef<AbortController | null>(null);
    const structureAbortControllerRef = useRef<AbortController | null>(null);

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
                mainGenre: currentProject?.mainGenre || '未設定',
                structureDetails: projectContext.plot?.structureDetails || '構成詳細が設定されていません',
                characters: characters,
                existingChapters: existingChapters,
                incompleteStructures: incompleteStructures.join('、'),
            });
        } else {
            // 基本AI生成用のプロンプト
            return aiService.buildPrompt('chapter', 'generateBasic', {
                title: projectContext.title,
                mainGenre: currentProject?.mainGenre || '未設定',
                structureDetails: projectContext.plot?.structureDetails || '構成詳細が設定されていません',
                characters: characters,
                existingChapters: existingChapters,
            });
        }
    }, [projectContext, currentProject, structureProgress]);

    // AI応答を解析
    const parseAIResponse = useCallback((content: string) => {
        const newChapters: Array<{ id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }> = [];
        const lines = content.split('\n').filter(line => line.trim());
        let currentChapter: {
            id: string;
            title: string;
            summary: string;
            setting: string;
            mood: string;
            keyEvents: string[];
            characters: string[];
        } | null = null;

        // 拡張された章検出パターン
        const chapterPatterns = [
            /第(\d+)章[：:]\s*(.+)/,           // 標準形式: 第1章: タイトル
            /(\d+)\.\s*(.+)/,                  // 番号付き形式: 1. タイトル
            /【第(\d+)章】\s*(.+)/,            // 括弧形式: 【第1章】 タイトル
            /Chapter\s*(\d+)[：:]\s*(.+)/i,    // 英語形式: Chapter 1: タイトル
            /章(\d+)[：:]\s*(.+)/,             // 簡略形式: 章1: タイトル
            /^(\d+)\s*[．.]\s*(.+)/,           // 数字+句点形式: 1．タイトル
            /^(\d+)\s*[-－]\s*(.+)/,           // 数字+ハイフン形式: 1-タイトル
        ];

        // 詳細情報検出パターン（より柔軟）
        const detailPatterns = {
            summary: [/概要[：:]\s*(.+)/, /あらすじ[：:]\s*(.+)/, /内容[：:]\s*(.+)/, /要約[：:]\s*(.+)/],
            setting: [/設定[・・]場所[：:]\s*(.+)/, /舞台[：:]\s*(.+)/, /場所[：:]\s*(.+)/, /設定[：:]\s*(.+)/],
            mood: [/雰囲気[・・]ムード[：:]\s*(.+)/, /ムード[：:]\s*(.+)/, /雰囲気[：:]\s*(.+)/, /トーン[：:]\s*(.+)/],
            keyEvents: [/重要な出来事[：:]\s*(.+)/, /キーイベント[：:]\s*(.+)/, /出来事[：:]\s*(.+)/, /イベント[：:]\s*(.+)/],
            characters: [/登場キャラクター[：:]\s*(.+)/, /登場人物[：:]\s*(.+)/, /キャラクター[：:]\s*(.+)/, /人物[：:]\s*(.+)/]
        };

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 章の開始を検出（複数パターンを試行）
            let chapterMatch: RegExpMatchArray | null = null;
            let chapterTitle = '';

            for (const pattern of chapterPatterns) {
                const match = trimmedLine.match(pattern);
                if (match) {
                    chapterMatch = match;
                    chapterTitle = match[2].trim();
                    break;
                }
            }

            if (chapterMatch) {
                if (currentChapter) {
                    newChapters.push(currentChapter);
                }
                currentChapter = {
                    id: Date.now().toString() + Math.random(),
                    title: chapterTitle,
                    summary: '',
                    setting: '',
                    mood: '',
                    keyEvents: [] as string[],
                    characters: [] as string[],
                };
            } else if (currentChapter) {
                // 章の詳細情報を解析（複数パターンを試行）
                let detailFound = false;

                // 概要の検出
                for (const pattern of detailPatterns.summary) {
                    const match = trimmedLine.match(pattern);
                    if (match) {
                        currentChapter.summary = match[1].trim();
                        detailFound = true;
                        break;
                    }
                }

                // 設定・場所の検出
                if (!detailFound) {
                    for (const pattern of detailPatterns.setting) {
                        const match = trimmedLine.match(pattern);
                        if (match) {
                            currentChapter.setting = match[1].trim();
                            detailFound = true;
                            break;
                        }
                    }
                }

                // 雰囲気・ムードの検出
                if (!detailFound) {
                    for (const pattern of detailPatterns.mood) {
                        const match = trimmedLine.match(pattern);
                        if (match) {
                            currentChapter.mood = match[1].trim();
                            detailFound = true;
                            break;
                        }
                    }
                }

                // 重要な出来事の検出
                if (!detailFound) {
                    for (const pattern of detailPatterns.keyEvents) {
                        const match = trimmedLine.match(pattern);
                        if (match) {
                            const eventsText = match[1].trim();
                            currentChapter.keyEvents = eventsText.split(/[,、;；]/).map(event => event.trim()).filter(event => event) as string[];
                            detailFound = true;
                            break;
                        }
                    }
                }

                // 登場キャラクターの検出
                if (!detailFound) {
                    for (const pattern of detailPatterns.characters) {
                        const match = trimmedLine.match(pattern);
                        if (match) {
                            const charactersText = match[1].trim();
                            currentChapter.characters = charactersText.split(/[,、;；]/).map(char => char.trim()).filter(char => char) as string[];
                            detailFound = true;
                            break;
                        }
                    }
                }

                // 詳細情報が見つからず、概要も空の場合は最初の説明文を概要として使用
                if (!detailFound && !currentChapter.summary &&
                    !trimmedLine.startsWith('役割:') &&
                    !trimmedLine.startsWith('ペース:') &&
                    !trimmedLine.includes('【') &&
                    !trimmedLine.includes('】') &&
                    trimmedLine.length > 10) {
                    currentChapter.summary = trimmedLine;
                }
            }
        }

        if (currentChapter) {
            newChapters.push(currentChapter);
        }

        return newChapters;
    }, []);

    // キャンセルハンドラー
    const handleCancelBasic = useCallback(() => {
        if (basicAbortControllerRef.current) {
            basicAbortControllerRef.current.abort();
            basicAbortControllerRef.current = null;
            setIsGenerating(false);
        }
    }, []);

    const handleCancelStructure = useCallback(() => {
        if (structureAbortControllerRef.current) {
            structureAbortControllerRef.current.abort();
            structureAbortControllerRef.current = null;
            setIsGeneratingStructure(false);
        }
    }, []);

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (basicAbortControllerRef.current) {
                basicAbortControllerRef.current.abort();
                basicAbortControllerRef.current = null;
            }
            if (structureAbortControllerRef.current) {
                structureAbortControllerRef.current.abort();
                structureAbortControllerRef.current = null;
            }
        };
    }, []);

    // 基本章立て生成
    const handleAIGenerate = async () => {
        if (!isConfigured) {
            showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
                title: 'AI設定が必要',
            });
            return;
        }

        if (!currentProject) return;

        // 既存のリクエストをキャンセル
        if (basicAbortControllerRef.current) {
            basicAbortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        basicAbortControllerRef.current = abortController;

        setIsGenerating(true);

        try {
            const prompt = buildAIPrompt('basic');
            const response = await aiService.generateContent({
                prompt,
                type: 'chapter',
                settings,
                signal: abortController.signal,
            });

            // キャンセルされた場合は処理をスキップ
            if (abortController.signal.aborted) {
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
                showError(`AI生成エラー: ${response.error}`, 10000, {
                    title: 'AI生成エラー',
                    details: 'ログを確認するにはAIログセクションを確認してください。',
                });
                return;
            }

            const newChapters = parseAIResponse(response.content);

            // 解析結果を含めてログを保存
            addLog({
                type: 'basic',
                prompt,
                response: response.content || '',
                error: response.error,
                parsedChapters: newChapters
            });

            if (newChapters.length > 0) {
                updateProject({
                    chapters: [...currentProject.chapters, ...newChapters],
                });

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

                if (incompleteChapters.length > 0) {
                    showWarning(`AI構成提案で${newChapters.length}章を追加しました。`, 8000, {
                        title: '章を追加しました',
                        details: `注意: ${incompleteChapters.length}章で情報が不完全です。必要に応じて手動で編集してください。`,
                    });
                } else {
                    showSuccess(`AI構成提案で${newChapters.length}章を追加しました。`);
                }
            } else {
                showError('章立ての解析に失敗しました。', 10000, {
                    title: '解析エラー',
                    details: '考えられる原因:\n1. AI出力の形式が期待と異なる\n2. 章の開始パターンが見つからない\n3. 必要な情報が不足している\n\nAIの応答内容を確認するにはAIログセクションを確認してください。',
                });
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
            showError(`AI生成中にエラーが発生しました: ${errorMessage}`, 10000, {
                title: 'AI生成エラー',
                details: 'ログを確認するにはAIログセクションを確認してください。',
            });
        } finally {
            if (!abortController.signal.aborted) {
                setIsGenerating(false);
            }
            basicAbortControllerRef.current = null;
        }
    };

    // 構成バランス分析に基づく章立て生成
    const handleStructureBasedAIGenerate = async () => {
        if (!isConfigured || !currentProject) {
            showError('AI設定が完了していません。設定画面でAPIキーを入力してください。', 7000, {
                title: 'AI設定が必要',
            });
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

        // 既存のリクエストをキャンセル
        if (structureAbortControllerRef.current) {
            structureAbortControllerRef.current.abort();
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController();
        structureAbortControllerRef.current = abortController;

        setIsGeneratingStructure(true);

        try {
            const prompt = buildAIPrompt('structure');
            const response = await aiService.generateContent({
                prompt: prompt,
                type: 'chapter',
                settings: settings,
                signal: abortController.signal,
            });

            // キャンセルされた場合は処理をスキップ
            if (abortController.signal.aborted) {
                return;
            }

            if (response.content && !response.error) {
                const newChapters = parseAIResponse(response.content);

                // 解析結果を含めてログを保存
                addLog({
                    type: 'structure',
                    prompt,
                    response: response.content || '',
                    error: response.error,
                    parsedChapters: newChapters
                });

                if (newChapters.length > 0) {
                    updateProject({
                        chapters: [...currentProject.chapters, ...newChapters],
                    });

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

                    if (incompleteChapters.length > 0) {
                        showWarning(`構成バランスAI提案で${newChapters.length}章を追加しました。`, 8000, {
                            title: '章を追加しました',
                            details: `対象: ${incompleteStructures.join('、')}\n注意: ${incompleteChapters.length}章で情報が不完全です。必要に応じて手動で編集してください。`,
                        });
                    } else {
                        showSuccess(`構成バランスAI提案で${newChapters.length}章を追加しました。対象: ${incompleteStructures.join('、')}`);
                    }
                } else {
                    showError('章立ての解析に失敗しました。', 10000, {
                        title: '解析エラー',
                        details: '考えられる原因:\n1. AI出力の形式が期待と異なる\n2. 章の開始パターンが見つからない\n3. 必要な情報が不足している\n\nAIの応答内容を確認するにはAIログセクションを確認してください。',
                    });
                }
            } else {
                showError(`AI生成に失敗しました: ${response.error || '不明なエラー'}`, 10000, {
                    title: 'AI生成エラー',
                    details: 'ログを確認するにはAIログセクションを確認してください。',
                });
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
            showError(`AI生成中にエラーが発生しました: ${errorMessage}`, 10000, {
                title: 'AI生成エラー',
                details: 'ログを確認するにはAIログセクションを確認してください。',
            });
        } finally {
            if (!abortController.signal.aborted) {
                setIsGeneratingStructure(false);
            }
            structureAbortControllerRef.current = null;
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
${log.parsedChapters.map((ch: any, i: number) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}` : ''}`;

        navigator.clipboard.writeText(logText);
        showSuccess('ログをクリップボードにコピーしました');
    }, [showSuccess]);

    // ログダウンロード機能
    const handleDownloadLogs = useCallback(() => {
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
${log.parsedChapters.map((ch: any, i: number) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}` : ''}

${'='.repeat(80)}`;
        }).join('\n\n');

        const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chapter_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('ログをダウンロードしました');
    }, [aiLogs, showSuccess]);

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
                    onClick={handleAIGenerate}
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
                        onClick={handleStructureBasedAIGenerate}
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
                                            {log.parsedChapters.map((c: any) => c.title).join(', ')}
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

