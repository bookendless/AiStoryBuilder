import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { AILogPanel } from '../common/AILogPanel';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { useAIGeneration } from '../steps/draft/hooks/useAIGeneration';
import { useAllChaptersGeneration } from '../steps/draft/hooks/useAllChaptersGeneration';
// テキスト選択機能は削除
import { CustomPromptModal } from '../steps/draft/CustomPromptModal';
import { ImprovementLogModal } from '../steps/draft/ImprovementLogModal';
import { formatTimestamp } from '../steps/draft/utils';
import type { ImprovementLog, ChapterHistoryEntry, HistoryEntryType } from '../steps/draft/types';
import { aiService } from '../../services/aiService';
import { databaseService } from '../../services/databaseService';
import { sanitizeInputForPrompt } from '../../utils/securityUtils';
import { HISTORY_AUTO_SAVE_DELAY, HISTORY_MAX_ENTRIES, HISTORY_TYPE_LABELS, HISTORY_BADGE_CLASSES } from '../steps/draft/constants';
import { diffLines, type Change } from 'diff';
import { Save, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const DraftAssistantPanel: React.FC = () => {
    const { currentProject, updateProject } = useProject();
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess, showWarning } = useToast();

    // 章選択状態（パネル内で管理）
    // sessionStorageから初期値を読み込む
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
        if (!currentProject) return null;
        const savedChapterId = sessionStorage.getItem(`draftSelectedChapter_${currentProject.id}`);
        if (savedChapterId && currentProject.chapters.some(c => c.id === savedChapterId)) {
            return savedChapterId;
        }
        return null;
    });

    // 折りたたみ状態
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['generate', 'improve']));

    // カスタムプロンプト状態
    const [customPrompt, setCustomPrompt] = useState('');
    const [useCustomPrompt, setUseCustomPrompt] = useState(false);
    const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);

    // 改善ログモーダル状態
    const [isImprovementLogModalOpen, setIsImprovementLogModalOpen] = useState(false);
    const [selectedImprovementLogId, setSelectedImprovementLogId] = useState<string | null>(null);
    const [improvementLogs, setImprovementLogs] = useState<Record<string, ImprovementLog[]>>({});

    // 履歴管理状態
    const [chapterHistories, setChapterHistories] = useState<Record<string, ChapterHistoryEntry[]>>({});
    const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
    const lastSnapshotContentRef = useRef<string>('');
    const historyLoadedChaptersRef = useRef<Set<string>>(new Set());

    // テキスト選択機能は削除

    // 章草案の状態管理（簡易版）- draftのuseMemoより前に宣言する必要がある
    const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({});
    const [deletingHistoryEntryId, setDeletingHistoryEntryId] = useState<string | null>(null);
    const [showGenerateAllChaptersConfirm, setShowGenerateAllChaptersConfirm] = useState(false);

    // 現在の章と草案を取得
    const currentChapter = useMemo(() => {
        if (!selectedChapterId || !currentProject) return null;
        return currentProject.chapters.find(c => c.id === selectedChapterId) || null;
    }, [selectedChapterId, currentProject]);

    const draft = useMemo(() => {
        if (!selectedChapterId || !currentProject) return '';
        // まずローカルステート（chapterDrafts）を確認（最新の編集内容を優先）
        if (chapterDrafts[selectedChapterId] !== undefined) {
            return chapterDrafts[selectedChapterId];
        }
        // ローカルステートにない場合は、プロジェクトから取得
        const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
        return chapter?.draft || '';
    }, [selectedChapterId, currentProject, chapterDrafts]);

    // 章詳細情報を取得
    const getChapterDetails = useCallback((chapter: { characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }) => {
        if (!chapter || !currentProject) {
            return {
                characters: '未設定',
                setting: '未設定',
                mood: '未設定',
                keyEvents: '未設定'
            };
        }

        const characters = chapter.characters && chapter.characters.length > 0
            ? chapter.characters.map(charIdOrName => {
                const character = currentProject.characters.find(c => c.id === charIdOrName);
                return character ? character.name : charIdOrName;
            }).join(', ')
            : '未設定';

        const setting = chapter.setting || '未設定';
        const mood = chapter.mood || '未設定';
        const keyEvents = chapter.keyEvents && chapter.keyEvents.length > 0
            ? chapter.keyEvents.join(', ')
            : '未設定';

        return { characters, setting, mood, keyEvents };
    }, [currentProject]);

    // プロジェクトコンテキスト情報を取得
    const getProjectContextInfo = useCallback(() => {
        if (!currentProject) return { worldSettings: '', glossary: '', relationships: '', plotInfo: '' };

        const worldSettingsList = currentProject.worldSettings || [];
        const glossaryList = currentProject.glossary || [];

        const worldSettingsText = worldSettingsList.length > 0
            ? worldSettingsList.map(w => `・${w.title}: ${w.content.substring(0, 100)}...`).join('\n')
            : '特になし';

        const glossaryText = glossaryList.length > 0
            ? glossaryList.map(g => `・${g.term}: ${g.definition.substring(0, 100)}...`).join('\n')
            : '特になし';

        const relationshipsList = currentProject.relationships || [];
        const relationshipsText = relationshipsList.length > 0
            ? relationshipsList.map(r => {
                const fromChar = currentProject.characters.find(c => c.id === r.from)?.name || '不明';
                const toChar = currentProject.characters.find(c => c.id === r.to)?.name || '不明';
                return `・${fromChar} → ${toChar}: ${r.type} (${r.description || ''})`;
            }).join('\n')
            : '特になし';

        const plot = currentProject.plot;
        let plotInfo = '構成情報なし';

        if (plot.structure === 'kishotenketsu') {
            plotInfo = `全体構造: 起承転結
起: ${plot.ki?.substring(0, 50) || '未設定'}...
承: ${plot.sho?.substring(0, 50) || '未設定'}...
転: ${plot.ten?.substring(0, 50) || '未設定'}...
結: ${plot.ketsu?.substring(0, 50) || '未設定'}...`;
        } else if (plot.structure === 'three-act') {
            plotInfo = `全体構造: 三幕構成
第1幕: ${plot.act1?.substring(0, 50) || '未設定'}...
第2幕: ${plot.act2?.substring(0, 50) || '未設定'}...
第3幕: ${plot.act3?.substring(0, 50) || '未設定'}...`;
        } else if (plot.structure === 'four-act') {
            plotInfo = `全体構造: 四幕構成
第1幕: ${plot.fourAct1?.substring(0, 50) || '未設定'}...
第2幕: ${plot.fourAct2?.substring(0, 50) || '未設定'}...
第3幕: ${plot.fourAct3?.substring(0, 50) || '未設定'}...
第4幕: ${plot.fourAct4?.substring(0, 50) || '未設定'}...`;
        }

        return {
            worldSettings: worldSettingsText,
            glossary: glossaryText,
            relationships: relationshipsText,
            plotInfo
        };
    }, [currentProject]);

    // カスタムプロンプトの構築
    const buildCustomPrompt = useCallback((args: {
        currentChapter: { title: string; summary: string };
        chapterDetails: { characters: string; setting: string; mood: string; keyEvents: string };
        projectCharacters: string;
        previousStory: string;
        previousChapterEnd?: string;
        contextInfo?: { worldSettings: string; glossary: string; relationships: string; plotInfo: string };
    }) => {
        const { currentChapter, chapterDetails, projectCharacters, previousStory, previousChapterEnd = '', contextInfo = { worldSettings: '', glossary: '', relationships: '', plotInfo: '' } } = args;

        const writingStyle = currentProject?.writingStyle || {};
        const style = writingStyle.style || '現代小説風';
        const perspective = writingStyle.perspective || '';
        const formality = writingStyle.formality || '';
        const rhythm = writingStyle.rhythm || '';
        const metaphor = writingStyle.metaphor || '';
        const dialogue = writingStyle.dialogue || '';
        const emotion = writingStyle.emotion || '';
        const tone = writingStyle.tone || '';

        const styleDetailsArray: string[] = [];
        if (perspective || formality || rhythm || metaphor || dialogue || emotion || tone) {
            styleDetailsArray.push('【文体の詳細指示】');
            if (perspective) styleDetailsArray.push(`- **人称**: ${perspective}`);
            if (formality) styleDetailsArray.push(`- **硬軟**: ${formality}`);
            if (rhythm) styleDetailsArray.push(`- **リズム**: ${rhythm}`);
            if (metaphor) styleDetailsArray.push(`- **比喩表現**: ${metaphor}`);
            if (dialogue) styleDetailsArray.push(`- **会話比率**: ${dialogue}`);
            if (emotion) styleDetailsArray.push(`- **感情描写**: ${emotion}`);
            if (tone) styleDetailsArray.push(`\n【参考となるトーン】\n${tone}`);
        }
        const styleDetails = styleDetailsArray.length > 0 ? styleDetailsArray.join('\n') + '\n' : '';

        let plotStructure = '';
        if (currentProject?.plot?.structure === 'kishotenketsu') {
            plotStructure = `起承転結構成\n起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`;
        } else if (currentProject?.plot?.structure === 'three-act') {
            plotStructure = `三幕構成\n第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`;
        } else if (currentProject?.plot?.structure === 'four-act') {
            plotStructure = `四幕構成\n第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`;
        } else {
            plotStructure = contextInfo.plotInfo || '未設定';
        }

        const basePrompt = aiService.buildPrompt('draft', 'generateSingle', {
            chapterTitle: currentChapter.title,
            chapterSummary: currentChapter.summary,
            characters: chapterDetails.characters,
            setting: chapterDetails.setting,
            mood: chapterDetails.mood,
            keyEvents: chapterDetails.keyEvents,
            projectTitle: currentProject?.title || '未設定',
            mainGenre: currentProject?.mainGenre || '未設定',
            subGenre: currentProject?.subGenre || '未設定',
            targetReader: currentProject?.targetReader || '未設定',
            previousStory: previousStory || 'これが最初の章です。',
            previousChapterEnd: previousChapterEnd ? `\n【直前の章のラストシーン（接続用）】\n以下の文章は、直前の章の終わりの部分です。この流れを汲んで、自然に接続するように新しい章を書き始めてください。\n---\n${previousChapterEnd}\n---` : '',
            projectCharacters: `${projectCharacters}\n\n【キャラクター相関図】\n${contextInfo.relationships}\n\n【設定資料・世界観】\n${contextInfo.worldSettings}\n\n【重要用語集】\n${contextInfo.glossary}`,
            plotTheme: currentProject?.plot?.theme || '未設定',
            plotSetting: currentProject?.plot?.setting || '未設定',
            plotStructure: plotStructure,
            style: style,
            styleDetails: styleDetails,
            customPrompt: useCustomPrompt && customPrompt.trim() ? `\n\n【カスタム執筆指示】\n${customPrompt}` : '',
        });

        if (useCustomPrompt && customPrompt.trim()) {
            // カスタムプロンプトをサニタイズして追加
            const sanitizedCustomPrompt = sanitizeInputForPrompt(customPrompt);
            return `${basePrompt}${basePrompt.includes('【カスタム執筆指示】') ? '' : '\n\n【カスタム執筆指示】\n'}${sanitizedCustomPrompt}`;
        }

        return basePrompt;
    }, [currentProject, useCustomPrompt, customPrompt]);

    // 章草案の保存
    const handleSaveChapterDraft = useCallback(async (chapterId: string, content: string) => {
        if (!currentProject) return;

        const updatedChapters = currentProject.chapters.map(chapter => {
            if (chapter.id === chapterId) {
                return { ...chapter, draft: content };
            }
            return chapter;
        });

        updateProject({ chapters: updatedChapters });
        setChapterDrafts(prev => ({ ...prev, [chapterId]: content }));
    }, [currentProject, updateProject]);

    // 草案の更新
    const handleDraftUpdate = useCallback((content: string) => {
        if (!selectedChapterId) return;
        setChapterDrafts(prev => ({ ...prev, [selectedChapterId]: content }));
        handleSaveChapterDraft(selectedChapterId, content);
    }, [selectedChapterId, handleSaveChapterDraft]);

    // 章変更ハンドラー（現在の章の草案を保存してから新しい章に切り替え）
    const handleChapterChange = useCallback(async (newChapterId: string | null) => {
        // 現在の章の草案を保存
        if (selectedChapterId && draft) {
            await handleSaveChapterDraft(selectedChapterId, draft);
        }
        // 新しい章を設定
        setSelectedChapterId(newChapterId);

        // sessionStorageに保存してDraftStepと同期
        if (currentProject) {
            if (newChapterId) {
                sessionStorage.setItem(`draftSelectedChapter_${currentProject.id}`, newChapterId);
                // CustomEventを発火してDraftStepに通知
                window.dispatchEvent(new CustomEvent('draftChapterSelected', { detail: { chapterId: newChapterId, projectId: currentProject.id, source: 'draftAssistantPanel' } }));
            } else {
                sessionStorage.removeItem(`draftSelectedChapter_${currentProject.id}`);
            }
        }
    }, [selectedChapterId, draft, handleSaveChapterDraft, currentProject]);

    // AIログ管理
    const { aiLogs, addLog } = useAILog({
        projectId: currentProject?.id,
        chapterId: selectedChapterId || undefined,
        autoLoad: true,
    });

    // AI生成フック
    const {
        isGenerating,
        currentGenerationAction,
        handleAIGenerate,
        handleContinueGeneration,
        handleDescriptionEnhancement,
        handleStyleAdjustment,
        handleShortenText,
        handleChapterImprovement,
        handleSelfRefineImprovement,
        handleCancelGeneration,
    } = useAIGeneration({
        currentProject,
        currentChapter,
        draft,
        selectedChapter: selectedChapterId,
        settings,
        isConfigured,
        onDraftUpdate: handleDraftUpdate,
        onSaveChapterDraft: handleSaveChapterDraft,
        onError: showError,
        onWarning: showWarning,
        onCompletionToast: (message) => {
            showSuccess(message);
        },
        addLog,
        getChapterDetails,
        getProjectContextInfo,
        buildCustomPrompt,
        setImprovementLogs,
    });

    // 全章一括生成用のAIログ管理（章未選択時用）
    const { aiLogs: allChaptersLogs, addLog: addAllChaptersLog, loadLogs: loadAllChaptersLogs } = useAILog({
        projectId: currentProject?.id,
        chapterId: undefined, // 全章生成ログは章IDなしで管理
        autoLoad: false,
    });

    // 全章一括生成フック
    const {
        isGeneratingAllChapters,
        generationProgress,
        generationStatus,
        chapterProgressList,
        handleGenerateAllChapters,
        handleCancelAllChaptersGeneration,
    } = useAllChaptersGeneration({
        currentProject,
        settings,
        isConfigured,
        getChapterDetails,
        onError: showError,
        onWarning: showWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast: (message: string | null) => {
            if (message) {
                showSuccess(message);
            }
        },
        addLog: addAllChaptersLog,
    });

    // テキスト選択機能は削除

    // 全章生成ログの読み込み（初回と全章生成完了時）
    useEffect(() => {
        if (currentProject && !selectedChapterId) {
            loadAllChaptersLogs();
        }
    }, [currentProject, selectedChapterId, loadAllChaptersLogs]);

    // 全章生成完了時にログを再読み込み
    useEffect(() => {
        if (!isGeneratingAllChapters && currentProject && !selectedChapterId) {
            // 少し遅延させてログが保存されるのを待つ
            const timeout = setTimeout(() => {
                loadAllChaptersLogs();
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [isGeneratingAllChapters, currentProject, selectedChapterId, loadAllChaptersLogs]);

    // カスタムプロンプトの保存・読み込み
    useEffect(() => {
        if (currentProject) {
            const savedCustomPrompt = localStorage.getItem(`customPrompt_${currentProject.id}`);
            const savedUseCustomPrompt = localStorage.getItem(`useCustomPrompt_${currentProject.id}`);

            if (savedCustomPrompt) {
                setCustomPrompt(savedCustomPrompt);
            }
            if (savedUseCustomPrompt === 'true') {
                setUseCustomPrompt(true);
            }
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProject) {
            localStorage.setItem(`customPrompt_${currentProject.id}`, customPrompt);
            localStorage.setItem(`useCustomPrompt_${currentProject.id}`, useCustomPrompt.toString());
        }
    }, [customPrompt, useCustomPrompt, currentProject]);

    // 章が変更されたときに草案を読み込む
    useEffect(() => {
        if (selectedChapterId && currentProject) {
            const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
            if (chapter && chapter.draft) {
                setChapterDrafts(prev => ({ ...prev, [selectedChapterId]: chapter.draft || '' }));
            }
        }
    }, [selectedChapterId, currentProject]);

    // DraftStepからの章選択変更を監視して同期
    useEffect(() => {
        if (!currentProject) return;

        const handleChapterSelected = (e: Event) => {
            const customEvent = e as CustomEvent<{ chapterId: string; projectId: string; source?: string }>;
            // 自分が発火したイベントは無視
            if (customEvent.detail.source === 'draftAssistantPanel') return;

            if (customEvent.detail.projectId === currentProject.id && customEvent.detail.chapterId !== selectedChapterId) {
                setSelectedChapterId(customEvent.detail.chapterId);
            }
        };

        window.addEventListener('draftChapterSelected', handleChapterSelected);

        return () => {
            window.removeEventListener('draftChapterSelected', handleChapterSelected);
        };
    }, [currentProject, selectedChapterId]);

    // 履歴スナップショット作成
    const createHistorySnapshot = useCallback(
        async (type: HistoryEntryType, options?: { content?: string; label?: string; force?: boolean }) => {
            if (!currentProject || !selectedChapterId) return false;
            const content = options?.content ?? draft;
            const normalizedContent = content ?? '';

            let entryWasAdded = false;
            const label = options?.label || HISTORY_TYPE_LABELS[type] || '履歴';

            const previousEntries = chapterHistories[selectedChapterId] || [];
            if (!options?.force && previousEntries[0]?.content === normalizedContent) {
                return false;
            }

            try {
                const entryId = await databaseService.saveHistoryEntry(
                    currentProject.id,
                    selectedChapterId,
                    {
                        content: normalizedContent,
                        type,
                        label,
                    }
                );

                entryWasAdded = true;
                lastSnapshotContentRef.current = normalizedContent;

                const newEntry: ChapterHistoryEntry = {
                    id: entryId,
                    timestamp: Date.now(),
                    content: normalizedContent,
                    type,
                    label,
                };

                setChapterHistories(prev => {
                    const updatedEntries = [newEntry, ...previousEntries].slice(0, HISTORY_MAX_ENTRIES);
                    return {
                        ...prev,
                        [selectedChapterId]: updatedEntries,
                    };
                });

                if (entryWasAdded) {
                    setSelectedHistoryEntryId(entryId);
                }
            } catch (error) {
                console.error('章履歴の保存に失敗しました:', error);
                return false;
            }

            return entryWasAdded;
        },
        [currentProject, selectedChapterId, draft, chapterHistories]
    );

    // 履歴の自動保存
    const historyAutoSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!currentProject || !selectedChapterId) return;

        if (historyAutoSaveTimeoutRef.current) {
            clearTimeout(historyAutoSaveTimeoutRef.current);
            historyAutoSaveTimeoutRef.current = null;
        }

        if (draft === lastSnapshotContentRef.current) return;

        historyAutoSaveTimeoutRef.current = window.setTimeout(() => {
            createHistorySnapshot('auto').catch(error => {
                console.error('自動履歴保存エラー:', error);
            });
            historyAutoSaveTimeoutRef.current = null;
        }, HISTORY_AUTO_SAVE_DELAY);

        return () => {
            if (historyAutoSaveTimeoutRef.current) {
                clearTimeout(historyAutoSaveTimeoutRef.current);
                historyAutoSaveTimeoutRef.current = null;
            }
        };
    }, [draft, currentProject, selectedChapterId, createHistorySnapshot]);

    // 履歴の読み込み
    useEffect(() => {
        if (!currentProject || !selectedChapterId) return;
        if (historyLoadedChaptersRef.current.has(selectedChapterId)) return;

        const loadHistory = async () => {
            try {
                const entries = await databaseService.getHistoryEntries(
                    currentProject.id,
                    selectedChapterId
                );

                setChapterHistories(prev => ({
                    ...prev,
                    [selectedChapterId]: entries,
                }));

                if (entries[0]) {
                    lastSnapshotContentRef.current = entries[0].content;
                    setSelectedHistoryEntryId(entries[0].id);
                } else {
                    const fallbackContent =
                        currentProject.chapters.find(chapter => chapter.id === selectedChapterId)?.draft || '';
                    lastSnapshotContentRef.current = fallbackContent;
                }

                historyLoadedChaptersRef.current.add(selectedChapterId);
            } catch (error) {
                console.error('章履歴の読み込みに失敗しました:', error);
                setChapterHistories(prev => ({
                    ...prev,
                    [selectedChapterId]: [],
                }));
                historyLoadedChaptersRef.current.add(selectedChapterId);
            }
        };

        loadHistory();
    }, [currentProject, selectedChapterId]);

    // 履歴エントリの選択状態を管理
    useEffect(() => {
        if (!selectedChapterId) {
            if (selectedHistoryEntryId !== null) {
                setSelectedHistoryEntryId(null);
            }
            return;
        }

        const entries = chapterHistories[selectedChapterId] || [];
        if (!entries.length) {
            if (selectedHistoryEntryId !== null) {
                setSelectedHistoryEntryId(null);
            }
            return;
        }

        const exists = entries.some(entry => entry.id === selectedHistoryEntryId);
        if (!exists) {
            setSelectedHistoryEntryId(entries[0].id);
        }
    }, [chapterHistories, selectedChapterId, selectedHistoryEntryId]);

    // 履歴の復元
    const handleRestoreHistoryEntry = useCallback(async () => {
        if (!selectedChapterId || !selectedHistoryEntryId) return;

        const entries = chapterHistories[selectedChapterId] || [];
        const selectedEntry = entries.find(e => e.id === selectedHistoryEntryId);
        if (!selectedEntry) return;

        if (selectedEntry.content === draft) return;

        await createHistorySnapshot('restore', {
            content: draft,
            label: '復元前スナップショット',
            force: true,
        });

        const nextContent = selectedEntry.content;
        handleDraftUpdate(nextContent);
        await handleSaveChapterDraft(selectedChapterId, nextContent);

        showSuccess('履歴を復元しました');
    }, [selectedChapterId, selectedHistoryEntryId, chapterHistories, draft, createHistorySnapshot, handleDraftUpdate, handleSaveChapterDraft, showSuccess]);

    // 履歴の削除
    const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
        if (!currentProject || !selectedChapterId) return;

        try {
            await databaseService.deleteHistoryEntry(entryId);

            setChapterHistories(prev => {
                const entries = prev[selectedChapterId] || [];
                const updatedEntries = entries.filter(e => e.id !== entryId);

                if (selectedHistoryEntryId === entryId) {
                    setSelectedHistoryEntryId(null);
                }

                return {
                    ...prev,
                    [selectedChapterId]: updatedEntries,
                };
            });

            showSuccess('履歴を削除しました');
        } catch (error) {
            console.error('履歴の削除エラー:', error);
            showError('履歴の削除に失敗しました');
        }
    }, [currentProject, selectedChapterId, selectedHistoryEntryId, showSuccess, showError]);

    // 履歴差分の計算
    const historyEntries = useMemo(
        () => (selectedChapterId ? chapterHistories[selectedChapterId] || [] : []),
        [chapterHistories, selectedChapterId]
    );

    const selectedHistoryEntry = useMemo(() => {
        if (!selectedChapterId || !selectedHistoryEntryId) return null;
        const entries = chapterHistories[selectedChapterId] || [];
        return entries.find(entry => entry.id === selectedHistoryEntryId) || null;
    }, [chapterHistories, selectedChapterId, selectedHistoryEntryId]);

    const historyDiffSegments = useMemo<Change[]>(() => {
        if (!selectedHistoryEntry) return [];
        return diffLines(selectedHistoryEntry.content ?? '', draft ?? '');
    }, [selectedHistoryEntry, draft]);

    const hasHistoryDiff = useMemo(
        () => historyDiffSegments.some(segment => segment.added || segment.removed),
        [historyDiffSegments]
    );

    // 手動スナップショット
    const handleManualHistorySnapshot = useCallback(async () => {
        await createHistorySnapshot('manual', { force: true, label: '手動保存' });
        showSuccess('履歴を保存しました');
    }, [createHistorySnapshot, showSuccess]);

    // 折りたたみセクションのトグル
    const toggleSection = useCallback((sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    if (!currentProject) return null;

    const hasDraft = Boolean(draft.trim());
    const isFullDraftGenerating = isGenerating && currentGenerationAction === 'fullDraft';
    const isContinueGenerating = isGenerating && currentGenerationAction === 'continue';
    const isDescriptionGenerating = isGenerating && currentGenerationAction === 'description';
    const isStyleGenerating = isGenerating && currentGenerationAction === 'style';
    const isShortenGenerating = isGenerating && currentGenerationAction === 'shorten';
    const isImproving = isGenerating && currentGenerationAction === 'improve';
    const isSelfRefining = isGenerating && currentGenerationAction === 'selfRefine';
    const chapterLogs = selectedChapterId ? improvementLogs[selectedChapterId] || [] : [];

    // 生成中のメッセージを取得
    const getGeneratingMessage = () => {
        if (isFullDraftGenerating) return '章全体を生成中';
        if (isContinueGenerating) return '続きを生成中';
        if (isDescriptionGenerating) return '描写を強化中';
        if (isStyleGenerating) return '文体を調整中';
        if (isShortenGenerating) return '文章を短縮中';
        if (isImproving) return '章全体を改善中';
        if (isSelfRefining) return '弱点を特定して修正中';
        return 'AI生成中';
    };

    return (
        <div className="space-y-4">
            {/* AI生成中のローディングインジケーター */}
            {isGenerating && (
                <AILoadingIndicator
                    message={getGeneratingMessage()}
                    estimatedTime={60}
                    variant="inline"
                    cancellable={true}
                    onCancel={handleCancelGeneration}
                />
            )}

            {/* 章選択UI */}
            {currentProject.chapters.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                    {/* 選択中の章情報表示 */}
                    {selectedChapterId && currentChapter && (
                        <div className="mb-3 pb-3 border-b border-blue-200 dark:border-blue-800">
                            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 font-['Noto_Sans_JP']">
                                {currentChapter.title}
                            </div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-300 font-['Noto_Sans_JP'] mt-1">
                                {draft.length.toLocaleString()} 文字
                            </div>
                        </div>
                    )}
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2">
                        章を選択
                    </label>
                    <select
                        value={selectedChapterId || ''}
                        onChange={(e) => handleChapterChange(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-['Noto_Sans_JP'] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">章を選択してください</option>
                        {currentProject.chapters.map((chapter) => (
                            <option key={chapter.id} value={chapter.id}>
                                {chapter.title}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {selectedChapterId && currentChapter ? (
                <>

                    {/* 章全体の生成セクション */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
                        <button
                            onClick={() => toggleSection('generate')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                <Sparkles className="h-4 w-4 mr-2 text-emerald-500" />
                                章全体の生成
                            </h3>
                            {expandedSections.has('generate') ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                        </button>

                        {expandedSections.has('generate') && (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                    選択中の章をベースに長文ドラフトを生成します。
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomPromptModal(true)}
                                        className="px-3 py-1.5 rounded-lg border border-purple-300 text-sm text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 font-['Noto_Sans_JP'] transition-colors"
                                    >
                                        カスタムプロンプト
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAIGenerate}
                                    disabled={isGenerating || !selectedChapterId}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold font-['Noto_Sans_JP'] transition-all ${isFullDraftGenerating
                                        ? 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200'
                                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <Sparkles
                                        className={`h-4 w-4 ${isFullDraftGenerating ? 'animate-spin' : ''}`}
                                    />
                                    <span>{isFullDraftGenerating ? 'AIが執筆中…' : 'AI章執筆を実行'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 章全体の改善セクション */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
                        <button
                            onClick={() => toggleSection('improve')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                <Sparkles className="h-4 w-4 mr-2 text-indigo-500" />
                                章全体の改善
                            </h3>
                            {expandedSections.has('improve') ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                        </button>

                        {expandedSections.has('improve') && (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleChapterImprovement}
                                    disabled={isGenerating || !hasDraft}
                                    className="w-full p-3 text-left bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP']">
                                                章全体改善
                                            </div>
                                            <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">
                                                {isImproving ? 'AIが描写と文体を総合的に改善しています…' : '描写強化＋文体調整を同時に実行'}
                                            </div>
                                        </div>
                                        <Sparkles className={`h-3 w-3 ${isImproving ? 'text-indigo-500 animate-spin' : 'text-indigo-500/70'}`} />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSelfRefineImprovement}
                                    disabled={isGenerating || !hasDraft}
                                    className="w-full p-3 text-left bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP']">
                                                弱点特定と修正ループ
                                            </div>
                                            <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">
                                                {isSelfRefining ? 'AIが弱点を特定し、改善しています…' : '批評→改訂の2段階で改善'}
                                            </div>
                                        </div>
                                        <Sparkles className={`h-3 w-3 ${isSelfRefining ? 'text-amber-500 animate-spin' : 'text-amber-500/70'}`} />
                                    </div>
                                </button>

                                {chapterLogs.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                                改善ログ ({chapterLogs.length}件)
                                            </h5>
                                            <button
                                                type="button"
                                                onClick={() => setIsImprovementLogModalOpen(true)}
                                                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-['Noto_Sans_JP'] underline"
                                            >
                                                詳細を表示
                                            </button>
                                        </div>
                                        <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                            最新: {formatTimestamp(chapterLogs[0].timestamp)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 個別機能セクション */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
                        <button
                            onClick={() => toggleSection('individual')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                個別機能
                            </h3>
                            {expandedSections.has('individual') ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                        </button>

                        {expandedSections.has('individual') && (
                            <div className="grid grid-cols-1 gap-2">
                                <ActionButton
                                    title="続きを生成"
                                    description={isContinueGenerating ? 'AIが文章の続きを生成しています…' : '文章の続きを提案'}
                                    isBusy={isContinueGenerating}
                                    disabled={isGenerating || !hasDraft}
                                    onClick={handleContinueGeneration}
                                />
                                <ActionButton
                                    title="描写強化"
                                    description={isDescriptionGenerating ? 'AIが描写を細部まで磨いています…' : '情景を詳しく'}
                                    isBusy={isDescriptionGenerating}
                                    disabled={isGenerating || !hasDraft}
                                    onClick={handleDescriptionEnhancement}
                                />
                                <ActionButton
                                    title="文体調整"
                                    description={isStyleGenerating ? 'AIが文体を整えています…' : '読みやすく'}
                                    isBusy={isStyleGenerating}
                                    disabled={isGenerating || !hasDraft}
                                    onClick={handleStyleAdjustment}
                                />
                                <ActionButton
                                    title="文章短縮"
                                    description={isShortenGenerating ? 'AIが文章を凝縮しています…' : '簡潔にまとめる'}
                                    isBusy={isShortenGenerating}
                                    disabled={isGenerating || !hasDraft}
                                    onClick={handleShortenText}
                                />
                            </div>
                        )}
                    </div>

                    {/* 履歴管理セクション */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
                        <button
                            onClick={() => toggleSection('history')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                <Save className="h-4 w-4 mr-2 text-emerald-500" />
                                履歴管理
                            </h3>
                            {expandedSections.has('history') ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                        </button>

                        {expandedSections.has('history') && (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">差分履歴</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                            現在の草案と過去のスナップショットを比較し復元します。
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleManualHistorySnapshot}
                                        disabled={!selectedChapterId}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-semibold font-['Noto_Sans_JP'] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Save className="h-4 w-4" />
                                        現在の状態を保存
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {historyEntries.length > 0 ? (
                                        historyEntries.map((entry) => {
                                            const preview =
                                                entry.content && entry.content.trim().length > 0
                                                    ? `${entry.content.replace(/\s+/g, ' ').slice(0, 50)}${entry.content.length > 50 ? '…' : ''}`
                                                    : '（空の草案）';
                                            const isActive = selectedHistoryEntryId === entry.id;

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className={`group relative w-full px-3 py-2 rounded-lg border transition-all duration-150 font-['Noto_Sans_JP'] ${isActive
                                                        ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-100'
                                                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedHistoryEntryId(entry.id)}
                                                        className="w-full text-left"
                                                    >
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${HISTORY_BADGE_CLASSES[entry.type]}`}>
                                                                {entry.label}
                                                            </span>
                                                            <span className="text-gray-500 dark:text-gray-400 text-[10px]">{formatTimestamp(entry.timestamp)}</span>
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{preview}</div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingHistoryEntryId(entry.id);
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-900/50"
                                                        title="履歴を削除"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-4">履歴はまだありません</div>
                                    )}
                                </div>

                                {selectedHistoryEntryId && (
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleRestoreHistoryEntry}
                                            disabled={!hasHistoryDiff}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border-2 border-emerald-500 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors font-semibold font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            このバージョンに復元
                                        </button>

                                        {hasHistoryDiff && (
                                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/40">
                                                {historyDiffSegments.map((segment, index) => {
                                                    const diffClass = segment.added
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                                        : segment.removed
                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                                                            : 'text-gray-800 dark:text-gray-100';
                                                    const prefix = segment.added ? '+ ' : segment.removed ? '- ' : '  ';
                                                    return (
                                                        <div key={`${index}-${segment.value}`} className={diffClass}>
                                                            <pre className="whitespace-pre-wrap px-3 py-1 text-xs font-mono">{`${prefix}${segment.value || ''}`}</pre>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* AIログセクション */}
                    {aiLogs.length > 0 && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-hidden">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                    <FileText className="h-4 w-4 mr-2 text-ai-500" />
                                    AIログ
                                </h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <AILogPanel
                                    logs={aiLogs}
                                    onCopyLog={(log) => {
                                        const typeLabels: Record<string, string> = {
                                            generateSingle: '章生成',
                                            continue: '続き生成',
                                        };
                                        const typeLabel = typeLabels[log.type] || log.type;
                                        const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】\n${log.error}` : ''}`;
                                        navigator.clipboard.writeText(logText);
                                        showSuccess('ログをクリップボードにコピーしました');
                                    }}
                                    onDownloadLogs={() => {
                                        const typeLabels: Record<string, string> = {
                                            generateSingle: '章生成',
                                            continue: '続き生成',
                                        };
                                        const logsText = aiLogs.map(log => {
                                            const typeLabel = typeLabels[log.type] || log.type;
                                            return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`;
                                        }).join('\n\n');

                                        const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `draft_ai_logs_${selectedChapterId || 'all'}_${new Date().toISOString().split('T')[0]}.txt`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        showSuccess('ログをダウンロードしました');
                                    }}
                                    typeLabels={{
                                        generateSingle: '章生成',
                                        continue: '続き生成',
                                    }}
                                    compact={true}
                                />
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-4">
                    {currentProject.chapters.length === 0 ? (
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-4">
                            <p>章が設定されていません。章立てステップで章を作成してください。</p>
                        </div>
                    ) : (
                        <>
                            {/* 全章一括生成セクション */}
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2 flex items-center justify-center">
                                        <Sparkles className="h-5 w-5 mr-2 text-indigo-500" />
                                        全章一括作成
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        全{currentProject.chapters.length}章の草案を一度に生成します
                                    </p>
                                </div>

                                {/* 生成中のローディングインジケーター */}
                                {isGeneratingAllChapters && (
                                    <div className="mb-4">
                                        <AILoadingIndicator
                                            message={generationStatus || '全章を生成中...'}
                                            estimatedTime={600}
                                            variant="inline"
                                            cancellable={true}
                                            onCancel={handleCancelAllChaptersGeneration}
                                        />
                                        
                                        {/* 進捗表示 */}
                                        {generationProgress.total > 0 && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-1">
                                                    <span>進捗</span>
                                                    <span>{generationProgress.current} / {generationProgress.total} 章</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 章ごとの進捗リスト */}
                                        {chapterProgressList.length > 0 && (
                                            <div className="mt-4 max-h-48 overflow-y-auto space-y-1">
                                                {chapterProgressList.map((chapterProgress) => {
                                                    const statusColors = {
                                                        pending: 'text-gray-400 dark:text-gray-500',
                                                        generating: 'text-indigo-600 dark:text-indigo-400',
                                                        completed: 'text-emerald-600 dark:text-emerald-400',
                                                        error: 'text-red-600 dark:text-red-400',
                                                    };
                                                    const statusIcons = {
                                                        pending: '○',
                                                        generating: '⟳',
                                                        completed: '✓',
                                                        error: '✗',
                                                    };
                                                    return (
                                                        <div
                                                            key={chapterProgress.chapterId}
                                                            className={`flex items-center text-xs font-['Noto_Sans_JP'] ${statusColors[chapterProgress.status]}`}
                                                        >
                                                            <span className="mr-2">{statusIcons[chapterProgress.status]}</span>
                                                            <span className={chapterProgress.status === 'generating' ? 'font-semibold' : ''}>
                                                                {chapterProgress.chapterTitle}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 全章一括生成ボタン */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isConfigured) {
                                            showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
                                                title: 'AI設定が必要',
                                            });
                                            return;
                                        }
                                        if (!currentProject || currentProject.chapters.length === 0) {
                                            showWarning('章が設定されていません。章立てステップで章を作成してから実行してください。', 7000, {
                                                title: '章が設定されていません',
                                            });
                                            return;
                                        }
                                        setShowGenerateAllChaptersConfirm(true);
                                    }}
                                    disabled={isGeneratingAllChapters || !isConfigured}
                                    className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-semibold font-['Noto_Sans_JP'] transition-all ${
                                        isGeneratingAllChapters
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isGeneratingAllChapters ? (
                                        <>
                                            <Sparkles className="h-5 w-5 animate-spin" />
                                            <span>生成中...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5" />
                                            <span>全章一括生成を実行</span>
                                        </>
                                    )}
                                </button>

                                {!isConfigured && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP'] text-center mt-2">
                                        AI設定が必要です
                                    </p>
                                )}
                            </div>

                            {/* 全章一括生成ログセクション */}
                            {allChaptersLogs.length > 0 && (
                                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-hidden">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
                                                <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                                                全章生成ログ ({allChaptersLogs.length}件)
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={loadAllChaptersLogs}
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-['Noto_Sans_JP']"
                                            >
                                                更新
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <AILogPanel
                                            logs={allChaptersLogs}
                                            onCopyLog={(log) => {
                                                const typeLabels: Record<string, string> = {
                                                    generateFull: '全章一括生成',
                                                };
                                                const typeLabel = typeLabels[log.type] || log.type;
                                                const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】\n${log.error}` : ''}`;
                                                navigator.clipboard.writeText(logText);
                                                showSuccess('ログをクリップボードにコピーしました');
                                            }}
                                            onDownloadLogs={() => {
                                                const typeLabels: Record<string, string> = {
                                                    generateFull: '全章一括生成',
                                                };
                                                const logsText = allChaptersLogs.map(log => {
                                                    const typeLabel = typeLabels[log.type] || log.type;
                                                    return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】\n${log.error}` : ''}

${'='.repeat(80)}`;
                                                }).join('\n\n');

                                                const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `all_chapters_ai_logs_${currentProject?.id || 'all'}_${new Date().toISOString().split('T')[0]}.txt`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                                showSuccess('ログをダウンロードしました');
                                            }}
                                            typeLabels={{
                                                generateFull: '全章一括生成',
                                            }}
                                            compact={true}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-2">
                                <p>章を選択すると個別のAIアシスト機能が利用できます。</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* カスタムプロンプトモーダル */}
            <CustomPromptModal
                isOpen={showCustomPromptModal}
                customPrompt={customPrompt}
                useCustomPrompt={useCustomPrompt}
                onClose={() => setShowCustomPromptModal(false)}
                onCustomPromptChange={setCustomPrompt}
                onUseCustomPromptChange={setUseCustomPrompt}
                onReset={() => {
                    setCustomPrompt('');
                    setUseCustomPrompt(false);
                }}
            />

            {/* 改善ログモーダル */}
            <ImprovementLogModal
                isOpen={isImprovementLogModalOpen}
                chapterTitle={currentChapter?.title || null}
                logs={chapterLogs}
                selectedLogId={selectedImprovementLogId}
                onClose={() => setIsImprovementLogModalOpen(false)}
                onSelectLog={setSelectedImprovementLogId}
            />

        {/* 確認ダイアログ - 履歴削除 */}
        <ConfirmDialog
            isOpen={deletingHistoryEntryId !== null}
            onClose={() => setDeletingHistoryEntryId(null)}
            onConfirm={() => {
                if (deletingHistoryEntryId) {
                    handleDeleteHistoryEntry(deletingHistoryEntryId);
                    setDeletingHistoryEntryId(null);
                }
            }}
            title="この履歴を削除しますか？"
            message=""
            type="warning"
            confirmLabel="削除"
        />

        {/* 確認ダイアログ - 全章生成 */}
        <ConfirmDialog
            isOpen={showGenerateAllChaptersConfirm}
            onClose={() => setShowGenerateAllChaptersConfirm(false)}
            onConfirm={() => {
                handleGenerateAllChapters();
                setShowGenerateAllChaptersConfirm(false);
            }}
            title={
                settings.provider === 'local'
                    ? '非ローカルLLMの使用を推奨します'
                    : '全章生成を実行しますか？'
            }
            message={
                settings.provider === 'local'
                    ? '全章生成には非ローカルLLM（OpenAI、Anthropic等）の使用を強く推奨します。\n\n理由：\n• 一貫性のある長文生成\n• キャラクター設定の維持\n• 物語の流れの統一\n• 高品質な文章生成\n\n続行しますか？'
                    : `全${currentProject?.chapters.length || 0}章の草案を一括生成します。\n\n⚠️ 重要な注意事項：\n• 生成には5-15分程度かかる場合があります\n• ネットワーク状況により失敗する可能性があります\n• 既存の章草案は上書きされます\n• 生成中はページを閉じないでください\n\n実行しますか？`
            }
            type={settings.provider === 'local' ? 'warning' : 'info'}
            confirmLabel="実行"
        />
        </div>
    );
};

interface ActionButtonProps {
    title: string;
    description: string;
    isBusy: boolean;
    disabled: boolean;
    onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, description, isBusy, disabled, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <div className="flex items-center justify-between">
            <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP']">
                    {title}
                </div>
                <div className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${isBusy ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                    {description}
                </div>
            </div>
            <Sparkles className={`h-3 w-3 ${isBusy ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`} />
        </div>
    </button>
);

