import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProject, Character } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { PenTool, Sparkles, BookOpen, FileText, ChevronDown, ChevronUp, AlignLeft, AlignJustify } from 'lucide-react';
import { diffLines, type Change } from 'diff';
import { aiService } from '../../services/aiService';
import { databaseService } from '../../services/databaseService';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import {
  HISTORY_AUTO_SAVE_DELAY,
  HISTORY_MAX_ENTRIES,
  HISTORY_TYPE_LABELS,
  MAX_SUGGESTION_TEXT_LENGTH,
  MODAL_DEFAULT_FONT_SIZE,
  MODAL_DEFAULT_LINE_HEIGHT,
  MODAL_TEXTAREA_DEFAULT_HEIGHT,
  MODAL_TEXTAREA_MAX_HEIGHT,
  MODAL_TEXTAREA_MIN_HEIGHT,
  SUGGESTION_CONFIG,
} from './draft/constants';
import { DisplaySettingsPanel } from './draft/DisplaySettingsPanel';
import { AiTabPanel } from './draft/AiTabPanel';
import { HistoryTabPanel } from './draft/HistoryTabPanel';
import { Toast } from './draft/Toast';
import { ImprovementLogModal } from './draft/ImprovementLogModal';
import { CustomPromptModal } from './draft/CustomPromptModal';
import { AIStatusBar } from './draft/AIStatusBar';
import { DraftHeader } from './draft/DraftHeader';
import { ChapterTabs } from './draft/ChapterTabs';
import { MainEditor, type MainEditorHandle } from './draft/MainEditor';
import { ForeshadowingPanel } from './draft/ForeshadowingPanel';
import { useAILog } from '../common/hooks/useAILog';
import { AILogPanel } from '../common/AILogPanel';
import type {
  AIStatusTone,
  AISuggestion,
  AISuggestionType,
  ChapterHistoryEntry,
  GenerationAction,
  HistoryEntryType,
  ImprovementLog,
  SecondaryTab,
} from './draft/types';
import {
  downloadTextFileInBrowser,
  isTauriEnvironment,
  parseAISuggestions,
  sanitizeFilename,
} from './draft/utils';


export const DraftStep: React.FC = () => {
  const { currentProject, updateProject, createManualBackup } = useProject();
  const { isConfigured, settings } = useAI();
  
  // State variables
  const [draft, setDraft] = useState(currentProject?.draft || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState('');
  const [isVerticalWriting, setIsVerticalWriting] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isModalChapterInfoCollapsed, setIsModalChapterInfoCollapsed] = useState(false);
  const [isImprovementLogModalOpen, setIsImprovementLogModalOpen] = useState(false);
  const [chapterHistories, setChapterHistories] = useState<Record<string, ChapterHistoryEntry[]>>({});
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [improvementLogs, setImprovementLogs] = useState<Record<string, ImprovementLog[]>>({});
  const [selectedImprovementLogId, setSelectedImprovementLogId] = useState<string | null>(null);
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [lastSelectedText, setLastSelectedText] = useState<string>('');
  const [activeSuggestionType, setActiveSuggestionType] = useState<AISuggestionType>('rewrite');
  const [wasSelectionTruncated, setWasSelectionTruncated] = useState<boolean>(false);
  
  // 全章生成用の状態
  const [isGeneratingAllChapters, setIsGeneratingAllChapters] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generationStatus, setGenerationStatus] = useState<string>('');
  
  // カスタムプロンプト用の状態
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);
  const [isChapterInfoCollapsed, setIsChapterInfoCollapsed] = useState(false);
  const [mainTextareaHeight, setMainTextareaHeight] = useState(MODAL_TEXTAREA_DEFAULT_HEIGHT);
  const [mainFontSize, setMainFontSize] = useState<number>(MODAL_DEFAULT_FONT_SIZE);
  const [mainLineHeight, setMainLineHeight] = useState<number>(MODAL_DEFAULT_LINE_HEIGHT);
  const [currentGenerationAction, setCurrentGenerationAction] = useState<GenerationAction | null>(null);
  
  // アコーディオン用の状態
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<SecondaryTab>('ai');
  
  // 伏線パネル用の状態
  const [isForeshadowingPanelCollapsed, setIsForeshadowingPanelCollapsed] = useState(false);
  
  // トースト通知用の状態
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // AIログ管理
  const { aiLogs, addLog, loadLogs } = useAILog({
    projectId: currentProject?.id,
    chapterId: selectedChapter || undefined,
    autoLoad: true,
  });

  // AIログをコピー（DraftStep特有の形式に対応）
  const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
    const typeLabels: Record<string, string> = {
      generateSingle: '章生成',
      continue: '続き生成',
      suggestions: '提案生成',
    };
    const typeLabel = typeLabels[log.type] || log.type;
    const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}
${log.suggestionType ? `提案タイプ: ${log.suggestionType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

    navigator.clipboard.writeText(logText);
    setToastMessage('ログをクリップボードにコピーしました');
  }, [setToastMessage]);

  // AIログをダウンロード（DraftStep特有の形式に対応）
  const handleDownloadLogs = useCallback(() => {
    const typeLabels: Record<string, string> = {
      generateSingle: '章生成',
      continue: '続き生成',
      suggestions: '提案生成',
    };
    const logsText = aiLogs.map(log => {
      const typeLabel = typeLabels[log.type] || log.type;
      return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}
${log.suggestionType ? `提案タイプ: ${log.suggestionType}\n` : ''}

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
    a.download = `draft_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('ログをダウンロードしました');
  }, [aiLogs, setToastMessage]);
  
  // ドロップダウンメニュー用の状態
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  
  // AI生成キャンセル用のref
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const [showCompletionToast, setShowCompletionToast] = useState<string | null>(null);

  const mainEditorRef = useRef<MainEditorHandle | null>(null);
  const historyAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSnapshotContentRef = useRef<string>('');
  const historyLoadedChaptersRef = useRef<Set<string>>(new Set());
  const verticalPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    historyLoadedChaptersRef.current.clear();
    setChapterHistories({});
    setSelectedHistoryEntryId(null);
  }, [currentProject?.id]);

  const createHistorySnapshot = useCallback(
    async (type: HistoryEntryType, options?: { content?: string; label?: string; force?: boolean }) => {
      if (!currentProject || !selectedChapter) return false;
      const content = options?.content ?? draft;
      const normalizedContent = content ?? '';

      let entryWasAdded = false;
      const label = options?.label || HISTORY_TYPE_LABELS[type] || '履歴';

      // 既存の履歴を確認（重複チェック）
      const previousEntries = chapterHistories[selectedChapter] || [];
      if (!options?.force && previousEntries[0]?.content === normalizedContent) {
        return false;
      }

      try {
        // IndexedDBに保存
        const entryId = await databaseService.saveHistoryEntry(
          currentProject.id,
          selectedChapter,
          {
            content: normalizedContent,
            type,
            label,
          }
        );

        entryWasAdded = true;
        lastSnapshotContentRef.current = normalizedContent;

        // 状態を更新
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
            [selectedChapter]: updatedEntries,
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
    [currentProject, selectedChapter, draft, chapterHistories]
  );

  const handleManualHistorySnapshot = useCallback(async () => {
    await createHistorySnapshot('manual', { force: true, label: '手動保存' });
  }, [createHistorySnapshot]);

  const getCurrentSelection = useCallback(() => {
    if (!mainEditorRef.current) return '';
    return mainEditorRef.current.getCurrentSelection();
  }, []);

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

  // カスタムプロンプトの保存
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(`customPrompt_${currentProject.id}`, customPrompt);
      localStorage.setItem(`useCustomPrompt_${currentProject.id}`, useCustomPrompt.toString());
    }
  }, [customPrompt, useCustomPrompt, currentProject]);
  
  // 現在の値を保持するためのref
  const currentDraftRef = useRef(draft);
  const currentSelectedChapterRef = useRef(selectedChapter);
  
  // refを更新
  useEffect(() => {
    currentDraftRef.current = draft;
  }, [draft]);
  
  useEffect(() => {
    currentSelectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  useEffect(() => {
    setIsChapterInfoCollapsed(false);
  }, [selectedChapter]);


  // データ管理側のバックアップ機能を利用
  const handleCreateManualBackup = async () => {
    if (!currentProject) return;
    
    // 現在の草案状態を保存してからバックアップを作成
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    try {
      const description = prompt('手動バックアップの説明を入力してください:', '草案作業時のバックアップ');
      if (!description) return;
      
      await createManualBackup(description);
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      // createManualBackup関数内でエラーハンドリングが行われるため、ここでは追加のalertは不要
    }
  };

  // 章の草案を同期
  useEffect(() => {
    if (!currentProject) return;
    
    // 既存の章草案を初期化（空の草案も含む、既存のchapterDraftsは保持）
    setChapterDrafts(prevChapterDrafts => {
      const initialChapterDrafts: Record<string, string> = { ...prevChapterDrafts };
      currentProject.chapters.forEach(chapter => {
        // 既にchapterDraftsに存在する場合は保持、存在しない場合は初期化
        if (!(chapter.id in initialChapterDrafts)) {
          initialChapterDrafts[chapter.id] = chapter.draft || '';
        }
      });
      return initialChapterDrafts;
    });
  }, [currentProject]);

  // 章が変更されたときの処理（クリーンアップは停止）
  // useEffect(() => {
  //   if (currentProject) {
  //     cleanupDeletedChapterDrafts(currentProject);
  //   }
  // }, [currentProject?.chapters]);

  // 選択された章の草案を読み込み
  useEffect(() => {
    if (selectedChapter) {
      // 選択された章に既存の草案があるかチェック
      if (chapterDrafts[selectedChapter]) {
        setDraft(chapterDrafts[selectedChapter]);
      } else {
        // 新規章の場合は空の草案を設定
        setDraft('');
      }
    }
  }, [selectedChapter, chapterDrafts]);

  useEffect(() => {
    if (!isModalOpen) return;

    if (selectedChapter && chapterDrafts[selectedChapter] !== undefined) {
      setModalDraft(chapterDrafts[selectedChapter] ?? '');
    } else if (!selectedChapter) {
      setModalDraft('');
    }
  }, [isModalOpen, selectedChapter, chapterDrafts]);

useEffect(() => {
  if (isModalOpen) {
    setModalDraft(draft);
  }
}, [draft, isModalOpen]);


  useEffect(() => {
    if (!currentProject || !selectedChapter) {
      return;
    }

    if (historyLoadedChaptersRef.current.has(selectedChapter)) return;

    // IndexedDBから履歴を読み込む
    const loadHistory = async () => {
      try {
        const entries = await databaseService.getHistoryEntries(
          currentProject.id,
          selectedChapter
        );

        setChapterHistories(prev => ({
          ...prev,
          [selectedChapter]: entries,
        }));

        if (entries[0]) {
          lastSnapshotContentRef.current = entries[0].content;
        } else {
          const fallbackContent =
            currentProject.chapters.find(chapter => chapter.id === selectedChapter)?.draft || '';
          lastSnapshotContentRef.current = fallbackContent;
        }

        historyLoadedChaptersRef.current.add(selectedChapter);
      } catch (error) {
        console.error('章履歴の読み込みに失敗しました:', error);
        // エラー時は空配列を設定
        setChapterHistories(prev => ({
          ...prev,
          [selectedChapter]: [],
        }));
        historyLoadedChaptersRef.current.add(selectedChapter);
      }
    };

    loadHistory();
  }, [currentProject, selectedChapter]);

  useEffect(() => {
    if (!selectedChapter) {
      if (selectedHistoryEntryId !== null) {
        setSelectedHistoryEntryId(null);
      }
      return;
    }

    const entries = chapterHistories[selectedChapter] || [];
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
  }, [chapterHistories, selectedChapter, selectedHistoryEntryId]);

  useEffect(() => {
    if (!selectedChapter) return;
    if (!historyLoadedChaptersRef.current.has(selectedChapter)) return;

    const entries = chapterHistories[selectedChapter] || [];
    if (entries.length === 0) {
      const baseContent =
        currentProject?.chapters.find(chapter => chapter.id === selectedChapter)?.draft || '';
      if (baseContent.trim()) {
        createHistorySnapshot('manual', {
          content: baseContent,
          label: '初期状態',
          force: true,
        }).catch(error => {
          console.error('初期状態の履歴保存エラー:', error);
        });
      }
    }
  }, [chapterHistories, selectedChapter, currentProject, createHistorySnapshot]);

  useEffect(() => {
    if (!currentProject || !selectedChapter) return;

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
  }, [draft, currentProject, selectedChapter, createHistorySnapshot]);

  useEffect(() => {
    return () => {
      if (historyAutoSaveTimeoutRef.current) {
        clearTimeout(historyAutoSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedChapter) return;
    const entries = chapterHistories[selectedChapter];
    if (entries && entries[0]) {
      lastSnapshotContentRef.current = entries[0].content;
    }
  }, [chapterHistories, selectedChapter]);

  useEffect(() => {
    setAISuggestions([]);
    setSuggestionError(null);
    setLastSelectedText('');
    setWasSelectionTruncated(false);
  }, [selectedChapter]);

  // 章選択ハンドラー
  const handleChapterSelect = async (chapterId: string) => {
    // 現在の章の内容を保存（章が選択されている場合）
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    // 選択された章を設定（草案はuseEffectで適切に初期化される）
    setSelectedChapter(chapterId);
  };

  const handleNavigateChapter = useCallback(
    async (direction: 'prev' | 'next') => {
      if (!currentProject || !currentProject.chapters.length) return;

      const chapters = currentProject.chapters;
      const currentIndex = selectedChapter
        ? chapters.findIndex((chapter) => chapter.id === selectedChapter)
        : -1;

      if (currentIndex === -1) {
        const targetChapter = direction === 'next' ? chapters[0] : chapters[chapters.length - 1];
        if (targetChapter) {
          await handleChapterSelect(targetChapter.id);
        }
        return;
      }

      const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= chapters.length) return;

      const targetChapter = chapters[targetIndex];
      if (targetChapter) {
        await handleChapterSelect(targetChapter.id);
      }
    },
    [currentProject, selectedChapter, handleChapterSelect]
  );

  const handlePrevChapter = useCallback(() => {
    handleNavigateChapter('prev');
  }, [handleNavigateChapter]);

  const handleNextChapter = useCallback(() => {
    handleNavigateChapter('next');
  }, [handleNavigateChapter]);

  const mainControlButtonBase = 'rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const mainControlButtonActive = 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700';

  const adjustMainTextareaHeight = useCallback((delta: number) => {
    setMainTextareaHeight(prev => {
      const next = prev + delta;
      if (next < MODAL_TEXTAREA_MIN_HEIGHT) return MODAL_TEXTAREA_MIN_HEIGHT;
      if (next > MODAL_TEXTAREA_MAX_HEIGHT) return MODAL_TEXTAREA_MAX_HEIGHT;
      return next;
    });
  }, []);

  const secondaryTabs = useMemo(
    () => [
      { 
        id: 'display' as SecondaryTab, 
        label: '表示設定', 
        disabled: false,
        disabledReason: ''
      },
      { 
        id: 'ai' as SecondaryTab, 
        label: 'AIアシスト', 
        disabled: !selectedChapter,
        disabledReason: '章を選択すると利用できます'
      },
      { 
        id: 'history' as SecondaryTab, 
        label: '履歴管理', 
        disabled: !selectedChapter,
        disabledReason: '章を選択すると利用できます'
      },
      { 
        id: 'project' as SecondaryTab, 
        label: 'プロジェクト情報', 
        disabled: false,
        disabledReason: ''
      },
      { 
        id: 'aiLogs' as SecondaryTab, 
        label: 'AIログ', 
        disabled: aiLogs.length === 0,
        disabledReason: 'AI生成を実行するとログが表示されます'
      },
    ],
    [selectedChapter, aiLogs.length]
  );

  useEffect(() => {
    if (
      !selectedChapter &&
      (activeSecondaryTab === 'ai' || activeSecondaryTab === 'history')
    ) {
      setActiveSecondaryTab('display');
    }
  }, [selectedChapter, activeSecondaryTab]);

  const openSecondaryTab = useCallback((tab: SecondaryTab) => {
    setActiveSecondaryTab(tab);
  }, []);

  const handleResetDisplaySettings = useCallback(() => {
    setMainFontSize(MODAL_DEFAULT_FONT_SIZE);
    setMainLineHeight(MODAL_DEFAULT_LINE_HEIGHT);
    setMainTextareaHeight(MODAL_TEXTAREA_DEFAULT_HEIGHT);
  }, []);

  const handleClearSuggestionState = useCallback(() => {
    setAISuggestions([]);
    setSuggestionError(null);
    setLastSelectedText('');
    setWasSelectionTruncated(false);
  }, []);

  const renderAiTab = (): React.ReactNode => {
    if (!selectedChapter || !currentChapter) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          章を選択するとAIアシスト機能が利用できます。
        </div>
      );
    }

    return (
      <AiTabPanel
        selectedChapterId={selectedChapter}
        currentChapter={currentChapter}
        draft={draft}
        aiSuggestions={aiSuggestions}
        lastSelectedText={lastSelectedText}
        wasSelectionTruncated={wasSelectionTruncated}
        suggestionError={suggestionError}
        isGeneratingSuggestion={isGeneratingSuggestion}
        isGenerating={isGenerating}
        isFullDraftGenerating={isFullDraftGenerating}
        isImproving={isImproving}
        isSelfRefining={isSelfRefining}
        isContinueGenerating={isContinueGenerating}
        isDescriptionGenerating={isDescriptionGenerating}
        isStyleGenerating={isStyleGenerating}
        isShortenGenerating={isShortenGenerating}
        activeSuggestionType={activeSuggestionType}
        improvementLogs={improvementLogs}
        onOpenCustomPrompt={() => setShowCustomPromptModal(true)}
        onGenerateFullDraft={handleAIGenerate}
        onImproveChapter={handleChapterImprovement}
        onSelfRefine={handleSelfRefineImprovement}
        onContinueGeneration={handleContinueGeneration}
        onDescriptionEnhancement={handleDescriptionEnhancement}
        onStyleAdjustment={handleStyleAdjustment}
        onShortenText={handleShortenText}
        onGenerateSuggestions={handleGenerateSuggestions}
        onApplySuggestion={applyAISuggestion}
        onClearSelectionState={handleClearSuggestionState}
        onOpenImprovementLogModal={() => setIsImprovementLogModalOpen(true)}
      />
    );
  };

  const renderHistoryTab = (): React.ReactNode => {
    if (!selectedChapter || !currentChapter) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          章を選択すると履歴を表示できます。
        </div>
      );
    }

    return (
      <HistoryTabPanel
        selectedChapterId={selectedChapter}
        currentChapter={currentChapter}
        historyEntries={historyEntries}
        selectedHistoryEntryId={selectedHistoryEntryId}
        setSelectedHistoryEntryId={setSelectedHistoryEntryId}
        onManualSnapshot={handleManualHistorySnapshot}
        onRestoreHistoryEntry={handleRestoreHistoryEntry}
        onDeleteHistoryEntry={handleDeleteHistoryEntry}
        hasHistoryDiff={hasHistoryDiff}
        historyDiffSegments={historyDiffSegments}
      />
    );
  };

  const renderAiLogsTab = (): React.ReactNode => {
    return (
      <AILogPanel
        logs={aiLogs}
        onCopyLog={handleCopyLog}
        onDownloadLogs={handleDownloadLogs}
        typeLabels={{
          generateSingle: '章生成',
          continue: '続き生成',
          suggestions: '提案生成',
        }}
        maxHeight="max-h-[calc(100vh-300px)]"
        renderLogContent={(log) => (
          <>
            {log.chapterId && (
              <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mr-2">
                {currentProject?.chapters.find(c => c.id === log.chapterId)?.title || log.chapterId}
              </span>
            )}
            {log.suggestionType && (
              <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                {log.suggestionType}
              </span>
            )}
          </>
        )}
      />
    );
  };

  const renderProjectTab = (): React.ReactNode => {
    if (!currentProject) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          プロジェクト情報を読み込めませんでした。
        </div>
      );
    }

    const chapterDetails = currentChapter ? getChapterDetails(currentChapter) : null;

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            プロジェクト基本情報
          </h4>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">作品タイトル</dt>
              <dd className="text-right text-gray-800 dark:text-gray-100">{currentProject.title || '未設定'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">メインジャンル</dt>
              <dd className="text-right text-gray-800 dark:text-gray-100">{currentProject.mainGenre || '未設定'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">サブジャンル</dt>
              <dd className="text-right text-gray-800 dark:text-gray-100">{currentProject.subGenre || '未設定'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">ターゲット読者</dt>
              <dd className="text-right text-gray-800 dark:text-gray-100">{currentProject.targetReader || '未設定'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">テーマ</dt>
              <dd className="text-right text-gray-800 dark:text-gray-100">{currentProject.projectTheme || '未設定'}</dd>
            </div>
          </dl>
        </div>

        {chapterDetails && currentChapter && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              選択中の章の情報
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              {currentChapter.title}
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300">
              {chapterDetails.characters !== '未設定' && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">登場キャラクター:</span>
                  <span className="ml-1">{chapterDetails.characters}</span>
                </div>
              )}
              {chapterDetails.setting !== '未設定' && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">設定・場所:</span>
                  <span className="ml-1">{chapterDetails.setting}</span>
                </div>
              )}
              {chapterDetails.mood !== '未設定' && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">雰囲気:</span>
                  <span className="ml-1">{chapterDetails.mood}</span>
                </div>
              )}
              {chapterDetails.keyEvents !== '未設定' && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">重要な出来事:</span>
                  <span className="ml-1">{chapterDetails.keyEvents}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              全章オペレーション
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              プロジェクト全体の生成や書き出しを行います。
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGenerateAllChapters}
              disabled={isGeneratingAllChapters || currentProject.chapters.length === 0}
              className="w-full p-3 text-left bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 dark:border-blue-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-900 dark:text-blue-100 text-xs font-['Noto_Sans_JP']">全章生成</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-300 font-['Noto_Sans_JP'] mt-0.5">
                    {currentProject.chapters.length}章を一括生成（5-15分）
                  </div>
                </div>
                {isGeneratingAllChapters && (
                  <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={handleExportFull}
              className="w-full p-3 text-left bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors font-['Noto_Sans_JP']"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs">完全版出力</div>
                  <div className="text-[11px] text-indigo-100/90 mt-0.5">全章をまとめて書き出し</div>
                </div>
                <FileText className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>

          {isGeneratingAllChapters && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-full flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white animate-spin" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    全章生成中
                  </h5>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    {generationStatus ||
                      (generationProgress.total > 0
                        ? `${generationProgress.current} / ${generationProgress.total}章を処理中です`
                        : 'AIが章を順番に執筆しています')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSecondaryTabContent = (): React.ReactNode => {
    switch (activeSecondaryTab) {
      case 'ai':
        return renderAiTab();
      case 'display':
        return (
          <DisplaySettingsPanel
            mainFontSize={mainFontSize}
            setMainFontSize={setMainFontSize}
            mainLineHeight={mainLineHeight}
            setMainLineHeight={setMainLineHeight}
            mainTextareaHeight={mainTextareaHeight}
            adjustMainTextareaHeight={adjustMainTextareaHeight}
            handleResetDisplaySettings={handleResetDisplaySettings}
            mainControlButtonBase={mainControlButtonBase}
            mainControlButtonActive={mainControlButtonActive}
            isVerticalWriting={isVerticalWriting}
            setIsVerticalWriting={setIsVerticalWriting}
            isZenMode={isZenMode}
            setIsZenMode={setIsZenMode}
          />
        );
      case 'history':
        return renderHistoryTab();
      case 'project':
        return renderProjectTab();
      case 'aiLogs':
        return renderAiLogsTab();
      default:
        return null;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevChapter();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextChapter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevChapter, handleNextChapter]);

  // ドロップダウンメニューの外側クリックで閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  // 現在の章を取得（メモ化）
  const currentChapter = useMemo(() => {
    if (!selectedChapter || !currentProject) return null;
    return currentProject.chapters.find(c => c.id === selectedChapter) || null;
  }, [selectedChapter, currentProject]);

  const currentChapterIndex = useMemo(() => {
    if (!currentProject || !selectedChapter) return -1;
    return currentProject.chapters.findIndex(chapter => chapter.id === selectedChapter);
  }, [currentProject, selectedChapter]);

  const isFullDraftGenerating = isGenerating && currentGenerationAction === 'fullDraft';
  const isContinueGenerating = isGenerating && currentGenerationAction === 'continue';
  const isDescriptionGenerating = isGenerating && currentGenerationAction === 'description';
  const isStyleGenerating = isGenerating && currentGenerationAction === 'style';
  const isShortenGenerating = isGenerating && currentGenerationAction === 'shorten';
  const isImproving = isGenerating && currentGenerationAction === 'improve';
  const isSelfRefining = isGenerating && currentGenerationAction === 'selfRefine';

  const aiStatus = useMemo<{
    tone: AIStatusTone;
    title: string;
    detail?: string;
  } | null>(() => {
    if (isGeneratingAllChapters) {
      const baseDetail =
        generationStatus ||
        (generationProgress.total > 0
          ? `${generationProgress.current} / ${generationProgress.total}章を処理中です`
          : 'AIが章を順番に執筆しています');
      return {
        tone: 'blue',
        title: '全章を生成しています…',
        detail: baseDetail,
      };
    }

    if (isFullDraftGenerating) {
      return {
        tone: 'emerald',
        title: 'AIが章全体を執筆しています…',
        detail: '数十秒ほどかかる場合があります。',
      };
    }

    if (isContinueGenerating) {
      return {
        tone: 'emerald',
        title: '文章の続きを生成しています…',
        detail: 'AIが既存の流れに合わせて続きを執筆中です。',
      };
    }

    if (isDescriptionGenerating) {
      return {
        tone: 'emerald',
        title: '描写を強化しています…',
        detail: '臨場感ある情景と感情表現に整えています。',
      };
    }

    if (isStyleGenerating) {
      return {
        tone: 'emerald',
        title: '文体を調整しています…',
        detail: '読みやすさを重視した文章にリライト中です。',
      };
    }

    if (isShortenGenerating) {
      return {
        tone: 'emerald',
        title: '文章を要約しています…',
        detail: '重要な内容を保ちながら簡潔な形に整えています。',
      };
    }

    if (isImproving) {
      return {
        tone: 'purple',
        title: '章全体を改善しています…',
        detail: '描写強化と文体調整を同時に実行中です。',
      };
    }

    if (isSelfRefining) {
      return {
        tone: 'purple',
        title: '弱点を特定し、改善しています…',
        detail: 'フェーズ1：批評 → フェーズ2：改訂を実行中です。',
      };
    }

    if (isGeneratingSuggestion) {
      const label = SUGGESTION_CONFIG[activeSuggestionType].label;
      return {
        tone: 'purple',
        title: `${label}を生成しています…`,
        detail: '選択したテキストを解析し、提案を準備中です。',
      };
    }

    return null;
  }, [
    activeSuggestionType,
    generationProgress.current,
    generationProgress.total,
    generationStatus,
    isContinueGenerating,
    isDescriptionGenerating,
    isFullDraftGenerating,
    isGeneratingAllChapters,
    isGeneratingSuggestion,
    isImproving,
    isShortenGenerating,
    isStyleGenerating,
  ]);

  const historyEntries = useMemo(
    () => (selectedChapter ? chapterHistories[selectedChapter] || [] : []),
    [chapterHistories, selectedChapter]
  );

  const selectedHistoryEntry = useMemo(() => {
    if (!selectedChapter || !selectedHistoryEntryId) return null;
    const entries = chapterHistories[selectedChapter] || [];
    return entries.find(entry => entry.id === selectedHistoryEntryId) || null;
  }, [chapterHistories, selectedChapter, selectedHistoryEntryId]);

  const historyDiffSegments = useMemo<Change[]>(() => {
    if (!selectedHistoryEntry) return [];
    return diffLines(selectedHistoryEntry.content ?? '', draft ?? '');
  }, [selectedHistoryEntry, draft]);

  const hasHistoryDiff = useMemo(
    () => historyDiffSegments.some(segment => segment.added || segment.removed),
    [historyDiffSegments]
  );

  const handleGenerateSuggestions = useCallback(
    async (type: AISuggestionType) => {
      if (!selectedChapter || !currentProject) {
        setSuggestionError('章を選択するとAI提案が利用できます。');
        return;
      }

      if (!isConfigured) {
        alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
        return;
      }

      const selection = getCurrentSelection();

      if (!selection.trim()) {
        setSuggestionError('テキストエリアで提案対象の文章を選択してください。');
        return;
      }

      let truncatedSelection = selection.trim();
      let truncated = false;
      if (truncatedSelection.length > MAX_SUGGESTION_TEXT_LENGTH) {
        truncatedSelection = truncatedSelection.slice(0, MAX_SUGGESTION_TEXT_LENGTH);
        truncated = true;
      }

      setActiveSuggestionType(type);
      setIsGeneratingSuggestion(true);
      setSuggestionError(null);
      setAISuggestions([]);
      setLastSelectedText(truncatedSelection);
      setWasSelectionTruncated(truncated);

      try {
        const prompt = SUGGESTION_CONFIG[type].prompt({
          selectedText: truncatedSelection,
          chapterTitle: currentChapter?.title,
          chapterSummary: currentChapter?.summary,
          projectTitle: currentProject?.title,
        });

        const response = await aiService.generateContent({
          prompt,
          type: 'draft',
          settings,
        });

        // AIログに記録
        addLog({
          type: 'suggestions',
          prompt,
          response: response.content || '',
          error: response.error,
          chapterId: selectedChapter || undefined,
          suggestionType: type,
        });

        if (!response || !response.content) {
          throw new Error('AIからの応答が空でした。');
        }

        const parsed = parseAISuggestions(response.content);
        if (!parsed.length) {
          throw new Error('提案を解析できませんでした。');
        }

        setAISuggestions(parsed);
      } catch (error) {
        console.error('AI提案生成エラー:', error);
        setSuggestionError(
          error instanceof Error ? error.message : 'AI提案の生成中にエラーが発生しました。'
        );
      } finally {
        setIsGeneratingSuggestion(false);
      }
    },
    [currentChapter, currentProject, getCurrentSelection, isConfigured, selectedChapter, settings]
  );

  // 章草案保存ハンドラー
  const handleSaveChapterDraft = async (chapterId: string, content?: string, isAutoSave: boolean = false) => {
    if (!currentProject) return;
    
    try {
      const contentToSave = content || draft;
      
      // chapterDraftsを更新（空の草案も含む）
      const updatedChapterDrafts = { ...chapterDrafts, [chapterId]: contentToSave };
      setChapterDrafts(updatedChapterDrafts);
      
      // プロジェクトの章に草案を保存
      const updatedChapters = currentProject.chapters.map(chapter => {
        if (chapter.id === chapterId) {
          return { ...chapter, draft: contentToSave };
        }
        return chapter;
      });
      
      const updatedProject = {
        ...currentProject,
        chapters: updatedChapters,
        draft: contentToSave,
        updatedAt: new Date(),
      };
      
      updateProject({ 
        chapters: updatedChapters,
        draft: contentToSave // メインの草案も更新
      });
      
      // 即座にデータベースに保存（デバウンスを待たない）
      await databaseService.saveProject(updatedProject);
      
      // 保存成功時の処理
      const now = new Date();
      setLastSavedAt(now);
      
      // トースト通知を表示（自動保存の場合のみ）
      if (isAutoSave) {
        setToastMessage('自動保存しました');
        // 3秒後にトーストを非表示
        setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('章草案保存エラー:', error);
      // エラーが発生してもUIの状態は更新済みなので、ユーザーには通知しない
    }
  };

  const handleRestoreHistoryEntry = useCallback(async () => {
    if (!selectedChapter || !selectedHistoryEntry) return;

    if (selectedHistoryEntry.content === draft) return;

    await createHistorySnapshot('restore', {
      content: draft,
      label: '復元前スナップショット',
      force: true,
    });

    const nextContent = selectedHistoryEntry.content;
    setDraft(nextContent);
    setChapterDrafts(prev => ({
      ...prev,
      [selectedChapter]: nextContent,
    }));

    await handleSaveChapterDraft(selectedChapter, nextContent);

    setTimeout(() => {
      const textarea = mainEditorRef.current?.getTextareaRef();
      if (textarea) {
        textarea.focus();
        const cursorPosition = nextContent.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [createHistorySnapshot, draft, handleSaveChapterDraft, selectedChapter, selectedHistoryEntry]);

  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    if (!currentProject || !selectedChapter) return;

    try {
      // IndexedDBから削除
      await databaseService.deleteHistoryEntry(entryId);

      // 状態を更新
      setChapterHistories(prev => {
        const entries = prev[selectedChapter] || [];
        const updatedEntries = entries.filter(e => e.id !== entryId);
        
        // 削除されたエントリが選択されていた場合、選択を解除
        if (selectedHistoryEntryId === entryId) {
          setSelectedHistoryEntryId(null);
        }

        return {
          ...prev,
          [selectedChapter]: updatedEntries,
        };
      });

      setToastMessage('履歴を削除しました');
    } catch (error) {
      console.error('履歴の削除エラー:', error);
      setToastMessage('履歴の削除に失敗しました');
    }
  }, [currentProject, selectedChapter, selectedHistoryEntryId, setToastMessage]);

  const applyAISuggestion = useCallback(
    async (suggestion: AISuggestion) => {
      if (!selectedChapter) return;

      const textarea = mainEditorRef.current?.getTextareaRef();
      if (!textarea) return;

      const replacement = suggestion.body;
      const { selectionStart, selectionEnd } = textarea;
      const before = draft.slice(0, selectionStart);
      const after = draft.slice(selectionEnd);
      const newContent = `${before}${replacement}${after}`;

      await createHistorySnapshot('restore', {
        content: draft,
        label: `${SUGGESTION_CONFIG[activeSuggestionType].label}適用前`,
        force: true,
      });

      setDraft(newContent);
      setChapterDrafts(prev => ({
        ...prev,
        [selectedChapter]: newContent,
      }));

      void handleSaveChapterDraft(selectedChapter, newContent);

      await createHistorySnapshot('manual', {
        content: newContent,
        label: `${SUGGESTION_CONFIG[activeSuggestionType].label}適用`,
        force: true,
      });

      setTimeout(() => {
        const textarea = mainEditorRef.current?.getTextareaRef();
        if (textarea) {
          const cursorPosition = selectionStart + replacement.length;
          textarea.focus();
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    },
    [activeSuggestionType, createHistorySnapshot, draft, handleSaveChapterDraft, selectedChapter]
  );

  // 削除された章の草案データをクリーンアップ（機能停止）
  // const cleanupDeletedChapterDrafts = (project: typeof currentProject) => {
  //   if (!project) return;
  //   
  //   const existingChapterIds = new Set(project.chapters.map(chapter => chapter.id));
  //   const cleanedChapterDrafts = Object.keys(chapterDrafts).reduce((acc, chapterId) => {
  //     // 章が存在する場合のみ保持（空の草案も含む）
  //     if (existingChapterIds.has(chapterId)) {
  //       acc[chapterId] = chapterDrafts[chapterId];
  //     }
  //     return acc;
  //   }, {} as Record<string, string>);
  //   
  //   setChapterDrafts(cleanedChapterDrafts);
  // };

  // 章詳細情報を取得（メモ化）
  const getChapterDetails = useCallback((chapter: { characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }) => {
    if (!chapter || !currentProject) {
      return {
        characters: '未設定',
        setting: '未設定',
        mood: '未設定',
        keyEvents: '未設定'
      };
    }

    // キャラクター情報の取得を修正
    // chapter.charactersは文字列配列（キャラクター名またはキャラクターID）として保存されている
    // キャラクターIDの場合はキャラクター名に変換する
    const characters = chapter.characters && chapter.characters.length > 0
      ? chapter.characters.map(charIdOrName => {
          // キャラクターIDかどうかを判定（IDは通常UUIDやタイムスタンプベースの文字列）
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

  // 文字数カウント（メモ化）
  const wordCount = useMemo(() => draft.length, [draft]);

  // 設定情報の取得ヘルパー
  const getProjectContextInfo = useCallback(() => {
    if (!currentProject) return { worldSettings: '', glossary: '', relationships: '', plotInfo: '' };

    // 1. 世界観設定・用語集
    const worldSettingsList = currentProject.worldSettings || [];
    const glossaryList = currentProject.glossary || [];
    
    // 重要度が高いものを優先的に抽出（ここでは簡易的に全件、ただし長すぎる場合は制限が必要）
    // プロンプトサイズ削減のため、タイトルと内容の要約のみを抽出するなどの工夫が可能
    const worldSettingsText = worldSettingsList.length > 0 
      ? worldSettingsList.map(w => `・${w.title}: ${w.content.substring(0, 100)}...`).join('\n')
      : '特になし';
      
    const glossaryText = glossaryList.length > 0
      ? glossaryList.map(g => `・${g.term}: ${g.definition.substring(0, 100)}...`).join('\n')
      : '特になし';

    // 2. キャラクター相関図
    const relationshipsList = currentProject.relationships || [];
    const relationshipsText = relationshipsList.length > 0
      ? relationshipsList.map(r => {
          const fromChar = currentProject.characters.find(c => c.id === r.from)?.name || '不明';
          const toChar = currentProject.characters.find(c => c.id === r.to)?.name || '不明';
          return `・${fromChar} → ${toChar}: ${r.type} (${r.description || ''})`;
        }).join('\n')
      : '特になし';

    // 3. 物語構造の進行度
    // PlotStep2の情報を活用
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
    }

    return {
      worldSettings: worldSettingsText,
      glossary: glossaryText,
      relationships: relationshipsText,
      plotInfo
    };
  }, [currentProject]);

  // カスタムプロンプトの構築（メモ化）
  const buildCustomPrompt = useCallback((
    currentChapter: { title: string; summary: string }, 
    chapterDetails: { characters: string; setting: string; mood: string; keyEvents: string }, 
    projectCharacters: string, 
    previousStory: string, 
    previousChapterEnd: string = '',
    contextInfo: { worldSettings: string; glossary: string; relationships: string; plotInfo: string } = { worldSettings: '', glossary: '', relationships: '', plotInfo: '' }
  ) => {
    // 文体設定の取得（プロジェクト設定から、またはデフォルト値）
    const writingStyle = currentProject?.writingStyle || {};
    const style = writingStyle.style || '現代小説風';
    const perspective = writingStyle.perspective || '';
    const formality = writingStyle.formality || '';
    const rhythm = writingStyle.rhythm || '';
    const metaphor = writingStyle.metaphor || '';
    const dialogue = writingStyle.dialogue || '';
    const emotion = writingStyle.emotion || '';
    const tone = writingStyle.tone || '';

    // 文体の詳細指示を構築
    const styleDetailsArray: string[] = [];
    if (perspective || formality || rhythm || metaphor || dialogue || emotion || tone) {
      styleDetailsArray.push('【文体の詳細指示】');
      if (perspective) styleDetailsArray.push(`- **人称**: ${perspective} （一人称 / 三人称 / 神の視点）`);
      if (formality) styleDetailsArray.push(`- **硬軟**: ${formality} （硬め / 柔らかめ / 口語的 / 文語的）`);
      if (rhythm) styleDetailsArray.push(`- **リズム**: ${rhythm} （短文中心 / 長短混合 / 流れるような長文）`);
      if (metaphor) styleDetailsArray.push(`- **比喩表現**: ${metaphor} （多用 / 控えめ / 詩的 / 写実的）`);
      if (dialogue) styleDetailsArray.push(`- **会話比率**: ${dialogue} （会話多め / 描写重視 / バランス型）`);
      if (emotion) styleDetailsArray.push(`- **感情描写**: ${emotion} （内面重視 / 行動で示す / 抑制的）`);
      if (tone) {
        styleDetailsArray.push('');
        styleDetailsArray.push(`【参考となるトーン】`);
        styleDetailsArray.push(`${tone} （緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）`);
      }
    }
    const styleDetails = styleDetailsArray.length > 0 ? styleDetailsArray.join('\n') + '\n' : '';

    // 物語の全体構成を構築
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
      return `${basePrompt}${basePrompt.includes('【カスタム執筆指示】') ? '' : '\n\n【カスタム執筆指示】\n'}${customPrompt}`;
    }
    
    return basePrompt;
  }, [currentProject, useCustomPrompt, customPrompt]);

  // AI生成ハンドラー
  const handleAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!currentProject) return;

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('非ローカルLLM（OpenAI、Anthropic等）の使用を推奨します。\n\n非ローカルLLMは以下の利点があります：\n• より自然で流暢な文章生成\n• 会話の臨場感と感情表現\n• 3000-4000文字の長文生成に最適\n\n続行しますか？');
      if (!useNonLocal) return;
    }

    setCurrentGenerationAction('fullDraft');
    setIsGenerating(true);
    
    try {
      if (!currentChapter) {
        alert('章を選択してください。');
        return;
      }

      // 章詳細情報を取得
      const chapterDetails = getChapterDetails(currentChapter);
      
      // プロジェクトのキャラクター情報を整理
      const projectCharacters = currentProject.characters.map((char: Character) => {
        let charInfo = `${char.name}`;
        if (char.role) {
          charInfo += ` (${char.role})`;
        }
        if (char.personality) {
          charInfo += `\n  性格: ${char.personality}`;
        }
        if (char.background) {
          charInfo += `\n  背景: ${char.background}`;
        }
        // 口調設定は簡潔に、かつ安全な表現のみを含める
        if (char.speechStyle) {
          // 口調設定を簡潔に（最大100文字）
          const speechStyle = char.speechStyle.trim();
          const truncatedSpeechStyle = speechStyle.length > 100 
            ? speechStyle.substring(0, 100) + '...' 
            : speechStyle;
          charInfo += `\n  口調: ${truncatedSpeechStyle}`;
        }
        return charInfo;
      }).join('\n\n');

      // 前章までのあらすじを取得
      const currentChapterIndex = currentProject.chapters.findIndex((c) => c.id === currentChapter.id);
      const previousStory = currentProject.chapters
        .slice(0, currentChapterIndex)
        .map((c, index: number) => `第${index + 1}章「${c.title}」\nあらすじ: ${c.summary || '（あらすじなし）'}`)
        .join('\n\n');

      // 直前の章の末尾を取得（一貫性確保のため）
      let previousChapterEnd = '';
      if (currentChapterIndex > 0) {
        const prevChapter = currentProject.chapters[currentChapterIndex - 1];
        if (prevChapter.draft && prevChapter.draft.trim()) {
          // 末尾1000文字程度を取得
          const prevDraft = prevChapter.draft.trim();
          previousChapterEnd = prevDraft.length > 1000 
            ? '...' + prevDraft.slice(-1000) 
            : prevDraft;
        }
      }

      // 設定情報の取得
      const contextInfo = getProjectContextInfo();

      // プロンプトを構築
      const prompt = buildCustomPrompt(currentChapter, chapterDetails, projectCharacters, previousStory, previousChapterEnd, contextInfo);

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });

      // AIログに記録
      addLog({
        type: 'generateSingle',
        prompt,
        response: response.content || '',
        error: response.error,
        chapterId: selectedChapter || undefined,
      });
      
      if (response && response.content) {
        setDraft(response.content);
        // 章草案を保存
        handleSaveChapterDraft(selectedChapter!, response.content);
        // 完了通知
        setShowCompletionToast('章全体の生成が完了しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('AI生成中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 続き生成
  const handleContinueGeneration = async () => {
    if (!currentProject || !selectedChapter) return;
    
    setCurrentGenerationAction('continue');
    setIsGenerating(true);
    try {
      // プロジェクトのキャラクター情報を整理
      const projectCharacters = currentProject.characters.map((char: Character) => {
        let charInfo = `${char.name}`;
        if (char.role) {
          charInfo += ` (${char.role})`;
        }
        if (char.personality) {
          charInfo += `\n  性格: ${char.personality}`;
        }
        if (char.background) {
          charInfo += `\n  背景: ${char.background}`;
        }
        // 口調設定は簡潔に、かつ安全な表現のみを含める
        if (char.speechStyle) {
          // 口調設定を簡潔に（最大100文字）
          const speechStyle = char.speechStyle.trim();
          const truncatedSpeechStyle = speechStyle.length > 100 
            ? speechStyle.substring(0, 100) + '...' 
            : speechStyle;
          charInfo += `\n  口調: ${truncatedSpeechStyle}`;
        }
        return charInfo;
      }).join('\n\n');

      // 設定情報の取得
      const contextInfo = getProjectContextInfo();

      // 文体設定の取得（プロジェクト設定から、またはデフォルト値）
      const writingStyle = currentProject.writingStyle || {};
      const style = writingStyle.style || '現代小説風';
      const perspective = writingStyle.perspective || '';
      const formality = writingStyle.formality || '';
      const rhythm = writingStyle.rhythm || '';
      const metaphor = writingStyle.metaphor || '';
      const dialogue = writingStyle.dialogue || '';
      const emotion = writingStyle.emotion || '';
      const tone = writingStyle.tone || '';

      // プロット情報の整理
      const plotStructure = currentProject.plot?.structure 
        ? (currentProject.plot.structure === 'kishotenketsu' 
            ? `起承転結構成\n起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`
            : currentProject.plot.structure === 'three-act'
            ? `三幕構成\n第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`
            : `四幕構成\n第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`)
        : '未設定';

      // buildPromptを使用してプロンプトを構築
      const prompt = aiService.buildPrompt('draft', 'continue', {
        currentText: draft,
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        projectCharacters: projectCharacters || '未設定',
        plotTheme: currentProject?.plot?.theme || '未設定',
        plotSetting: currentProject?.plot?.setting || '未設定',
        plotStructure: plotStructure,
        style: style,
        perspective: perspective,
        formality: formality,
        rhythm: rhythm,
        metaphor: metaphor,
        dialogue: dialogue,
        emotion: emotion,
        tone: tone,
      });

      // 追加のコンテキスト情報をプロンプトに追加
      const enhancedPrompt = `${prompt}

【追加コンテキスト情報（参考）】
${contextInfo.relationships ? `【キャラクター相関図】\n${contextInfo.relationships}\n` : ''}
${contextInfo.worldSettings ? `【設定資料・世界観】\n${contextInfo.worldSettings}\n` : ''}
${contextInfo.glossary ? `【重要用語集】\n${contextInfo.glossary}\n` : ''}

【追加の執筆指示】
- 上記の文章の自然な続きを書いてください
- キャラクターの性格や設定を一貫して保ってください
- 特に「設定資料・世界観」や「重要用語集」の内容と矛盾しないようにしてください
- 「キャラクター相関図」の関係性に基づいた会話や態度を描写してください
- 会話を重視し、臨場感のある描写を心がけてください
- 1000-1500文字程度で続きを執筆してください
- 章の目的に沿った内容で物語を前進させてください
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください`;

      const response = await aiService.generateContent({
        prompt: enhancedPrompt,
        type: 'draft',
        settings
      });

      // AIログに記録
      addLog({
        type: 'continue',
        prompt: enhancedPrompt,
        response: response.content || '',
        error: response.error,
        chapterId: selectedChapter || undefined,
      });
      
      if (response && response.content) {
        const newContent = draft + '\n\n' + response.content;
        setDraft(newContent);
        handleSaveChapterDraft(selectedChapter!, newContent);
        setShowCompletionToast('文章の続きを生成しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('続き生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('続き生成中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 描写強化
  const handleDescriptionEnhancement = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setCurrentGenerationAction('description');
    setIsGenerating(true);
    try {
      const prompt = aiService.buildPrompt('draft', 'enhanceDescription', {
        currentText: draft,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
        setShowCompletionToast('描写を強化しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('描写強化エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('描写強化中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 文体調整
  const handleStyleAdjustment = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setCurrentGenerationAction('style');
    setIsGenerating(true);
    try {
      const prompt = aiService.buildPrompt('draft', 'adjustStyle', {
        currentText: draft,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
        setShowCompletionToast('文体を調整しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('文体調整エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('文体調整中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 文章短縮
  const handleShortenText = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setCurrentGenerationAction('shorten');
    setIsGenerating(true);
    try {
      const prompt = aiService.buildPrompt('draft', 'shorten', {
        currentText: draft,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
        setShowCompletionToast('文章を短縮しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('文章短縮エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('文章短縮中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 全章生成機能
  const handleGenerateAllChapters = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!currentProject || currentProject.chapters.length === 0) {
      alert('章が設定されていません。章立てステップで章を作成してから実行してください。');
      return;
    }

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('全章生成には非ローカルLLM（OpenAI、Anthropic等）の使用を強く推奨します。\n\n理由：\n• 一貫性のある長文生成\n• キャラクター設定の維持\n• 物語の流れの統一\n• 高品質な文章生成\n\n続行しますか？');
      if (!useNonLocal) return;
    }

    // 確認ダイアログ
    const confirmMessage = `全${currentProject.chapters.length}章の草案を一括生成します。\n\n⚠️ 重要な注意事項：\n• 生成には5-15分程度かかる場合があります\n• ネットワーク状況により失敗する可能性があります\n• 既存の章草案は上書きされます\n• 生成中はページを閉じないでください\n\n実行しますか？`;
    if (!confirm(confirmMessage)) return;

    setIsGeneratingAllChapters(true);
    setGenerationProgress({ current: 0, total: currentProject.chapters.length });
    setGenerationStatus('準備中...');

    try {
      // プロジェクト全体の情報を整理
      const projectInfo = {
        title: currentProject.title,
        mainGenre: currentProject.mainGenre || '未設定',
        subGenre: currentProject.subGenre || '未設定',
        targetReader: currentProject.targetReader || '未設定',
        projectTheme: currentProject.projectTheme || '未設定'
      };

      // キャラクター情報を整理
      const charactersInfo = currentProject.characters.map((char: { name: string; role: string; appearance: string; personality: string; background: string }) => 
        `【${char.name}】\n役割: ${char.role}\n外見: ${char.appearance}\n性格: ${char.personality}\n背景: ${char.background}`
      ).join('\n\n');

      // プロット情報を整理
      const plotInfo = {
        theme: currentProject.plot?.theme || '未設定',
        setting: currentProject.plot?.setting || '未設定',
        hook: currentProject.plot?.hook || '未設定',
        protagonistGoal: currentProject.plot?.protagonistGoal || '未設定',
        mainObstacle: currentProject.plot?.mainObstacle || '未設定',
        structure: currentProject.plot?.structure || 'kishotenketsu'
      };

      // 物語構造の詳細を取得
      let structureDetails = '';
      if (plotInfo.structure === 'kishotenketsu') {
        structureDetails = `起承転結構造:\n起: ${currentProject.plot?.ki || '未設定'}\n承: ${currentProject.plot?.sho || '未設定'}\n転: ${currentProject.plot?.ten || '未設定'}\n結: ${currentProject.plot?.ketsu || '未設定'}`;
      } else if (plotInfo.structure === 'three-act') {
        structureDetails = `三幕構成:\n第1幕: ${currentProject.plot?.act1 || '未設定'}\n第2幕: ${currentProject.plot?.act2 || '未設定'}\n第3幕: ${currentProject.plot?.act3 || '未設定'}`;
      } else if (plotInfo.structure === 'four-act') {
        structureDetails = `四幕構成:\n第1幕: ${currentProject.plot?.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot?.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot?.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot?.fourAct4 || '未設定'}`;
      }

      // 各章の情報を整理
      const chaptersInfo = currentProject.chapters.map((chapter, index) => {
        const chapterDetails = getChapterDetails(chapter);
        return `【第${index + 1}章: ${chapter.title}】
概要: ${chapter.summary}
登場キャラクター: ${chapterDetails.characters}
設定・場所: ${chapterDetails.setting}
雰囲気: ${chapterDetails.mood}
重要な出来事: ${chapterDetails.keyEvents}`;
      }).join('\n\n');

      // 全章生成用のプロンプトを作成
      const fullPrompt = aiService.buildPrompt('draft', 'generateFull', {
        title: projectInfo.title,
        mainGenre: projectInfo.mainGenre,
        subGenre: projectInfo.subGenre,
        targetReader: projectInfo.targetReader,
        projectTheme: projectInfo.projectTheme,
        plotTheme: plotInfo.theme,
        plotSetting: plotInfo.setting,
        plotHook: plotInfo.hook,
        protagonistGoal: plotInfo.protagonistGoal,
        mainObstacle: plotInfo.mainObstacle,
        structureDetails: structureDetails,
        charactersInfo: charactersInfo,
        chaptersInfo: chaptersInfo,
      });

      setGenerationStatus('AI生成中...（全章の一貫性を保ちながら執筆中）');
      const response = await aiService.generateContent({
        prompt: fullPrompt,
        type: 'draft',
        settings
      });

      if (response && response.content) {
        setGenerationStatus('結果を解析中...');
        
        // 生成された内容を解析して各章に分割
        const content = response.content;
        const chapterSections = content.split(/=== 第\d+章: .+? ===/);
        
        // 最初の要素は空文字列なので削除
        chapterSections.shift();
        
        // 各章の内容を抽出
        const generatedChapters: Record<string, string> = {};
        let chapterIndex = 0;
        
        for (let i = 0; i < currentProject.chapters.length && i < chapterSections.length; i++) {
          const chapter = currentProject.chapters[i];
          const chapterContent = chapterSections[i]?.trim() || '';
          
          if (chapterContent) {
            generatedChapters[chapter.id] = chapterContent;
            chapterIndex++;
          }
        }

        // 章草案を更新
        setChapterDrafts(prev => ({ ...prev, ...generatedChapters }));

        // プロジェクトの章に草案を保存
        const updatedChapters = currentProject.chapters.map(chapter => {
          if (generatedChapters[chapter.id]) {
            return { ...chapter, draft: generatedChapters[chapter.id] };
          }
          return chapter;
        });

        updateProject({ chapters: updatedChapters });

        setGenerationStatus(`完了！${chapterIndex}章の草案を生成しました。各章の内容を確認してください。`);
        
        // 成功メッセージ
        setShowCompletionToast(`全章生成が完了しました（${chapterIndex}/${currentProject.chapters.length}章）`);
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 5000);
        
      } else {
        throw new Error('AI生成に失敗しました');
      }

    } catch (error) {
      console.error('全章生成エラー:', error);
      
      if ((error as Error).name !== 'AbortError') {
        let errorMessage = '不明なエラーが発生しました';
        let errorDetails = '';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // エラーの種類に応じた詳細メッセージ
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorDetails = '\n\nネットワークエラーが発生しました。インターネット接続を確認してください。';
          } else if (error.message.includes('timeout')) {
            errorDetails = '\n\nタイムアウトエラーが発生しました。時間をおいて再度お試しください。';
          } else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorDetails = '\n\nAPIの利用制限に達しました。しばらく時間をおいてから再度お試しください。';
          } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
            errorDetails = '\n\nAPIキーが無効です。AI設定でAPIキーを確認してください。';
          } else if (error.message.includes('rate limit')) {
            errorDetails = '\n\nリクエスト制限に達しました。しばらく時間をおいてから再度お試しください。';
          }
        }
        
        const fullErrorMessage = `全章生成中にエラーが発生しました: ${errorMessage}${errorDetails}\n\n対処方法：\n• ネットワーク接続を確認してください\n• AI設定でAPIキーが正しく設定されているか確認してください\n• しばらく時間をおいてから再度お試しください\n• 問題が続く場合は、個別に章を生成してください`;
        
        alert(fullErrorMessage);
        setGenerationStatus('エラーが発生しました');
      }
    } finally {
      setIsGeneratingAllChapters(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
  };

  // エクスポート機能
  const handleExportChapter = async () => {
    if (!currentChapter || !draft.trim()) {
      alert('エクスポートする章の内容がありません');
      return;
    }
    
    const content = `# ${currentChapter.title}\n\n${draft}`;
    const filename = sanitizeFilename(`${currentChapter.title}.txt`);
    let exported = false;

    if (isTauriEnvironment()) {
      try {
        const filePath = await save({
          title: 'ファイルを保存',
          defaultPath: filename,
          filters: [
            {
              name: 'Text Files',
              extensions: ['txt']
            }
          ]
        });

        if (filePath) {
          await writeTextFile(filePath, content);
          alert('エクスポートが完了しました');
          exported = true;
        }
      } catch (error) {
        console.warn('Tauri経由の章出力に失敗しました。ブラウザダウンロードにフォールバックします。', error);
      }
    }

    if (!exported) {
      try {
        downloadTextFileInBrowser(filename, content);
        alert('ブラウザから章のテキストをダウンロードしました');
      } catch (error) {
        console.error('Browser export error:', error);
        alert('エクスポートに失敗しました: ' + (error as Error).message);
      }
    }
  };

  const handleExportFull = async () => {
    if (!currentProject) return;
    
    let content = `# ${currentProject.title}\n\n`;
    
    // 各章の草案をエクスポート
    currentProject.chapters.forEach(chapter => {
      const chapterDraft = chapterDrafts[chapter.id];
      if (chapterDraft && chapterDraft.trim()) {
        content += `## ${chapter.title}\n\n${chapterDraft}\n\n`;
      }
    });
    
    if (content.trim() === `# ${currentProject.title}`) {
      alert('エクスポートする内容がありません');
      return;
    }
    
    const filename = sanitizeFilename(`${currentProject.title}_完全版.txt`);
    let exported = false;

    if (isTauriEnvironment()) {
      try {
        const filePath = await save({
          title: 'ファイルを保存',
          defaultPath: filename,
          filters: [
            {
              name: 'Text Files',
              extensions: ['txt']
            }
          ]
        });
        
        if (filePath) {
          await writeTextFile(filePath, content);
          alert('エクスポートが完了しました');
          exported = true;
        }
      } catch (error) {
        console.warn('Tauri経由の完全版出力に失敗しました。ブラウザダウンロードにフォールバックします。', error);
      }
    }

    if (!exported) {
      try {
        downloadTextFileInBrowser(filename, content);
        alert('ブラウザから完全版テキストをダウンロードしました');
      } catch (error) {
        console.error('Browser export error:', error);
        alert('エクスポートに失敗しました: ' + (error as Error).message);
      }
    }
  };

  // 自動保存用のタイマー
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // コンポーネントのアンマウント時に現在の章の内容を保存
  useEffect(() => {
    return () => {
      // 自動保存タイマーをクリア
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      const currentChapter = currentSelectedChapterRef.current;
      const currentDraft = currentDraftRef.current;
      
      if (currentChapter && currentProject) {
        // 即座にデータベースに保存（非同期処理を同期的に実行）
        const saveToDatabase = async () => {
          try {
            const updatedChapters = currentProject.chapters.map(chapter => {
              if (chapter.id === currentChapter) {
                return { ...chapter, draft: currentDraft };
              }
              return chapter;
            });
            
            const updatedProject = {
              ...currentProject,
              chapters: updatedChapters,
              draft: currentDraft,
              updatedAt: new Date(),
            };
            
            await databaseService.saveProject(updatedProject);
          } catch (error) {
            console.error('アンマウント時の保存エラー:', error);
          }
        };
        
        // 保存を実行（エラーハンドリング付き）
        saveToDatabase();
      }
    };
  }, [currentProject]); // currentProjectを依存関係に追加

  // モーダル関連
  const handleOpenViewer = () => {
    setModalDraft(draft);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalDraft('');
  };

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (isModalOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseModal();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isModalOpen]);

  // 縦書きプレビューのホイールイベント処理（非passiveリスナー）
  useEffect(() => {
    const element = verticalPreviewRef.current;
    if (!element || !isModalOpen || !isVerticalWriting) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      // マウスホイールの回転（deltaY）を横スクロール（scrollLeft）に変換
      // 通常のマウス：下に回す（deltaY > 0）→ 左へスクロール（文章が進む）
      // 縦書き（vertical-rl）の仕様上、スクロール位置は負の値になるブラウザが多い
      // 左へスクロール = scrollLeft を減らす（マイナス方向へ進む）
      element.scrollLeft -= e.deltaY;
      e.preventDefault();
    };

    // 非passiveイベントリスナーとして登録
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [isModalOpen, isVerticalWriting]);

  // 章全体改善（描写強化＋文体調整の組み合わせ）
  const handleChapterImprovement = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setCurrentGenerationAction('improve');
    setIsGenerating(true);
    try {
      const prompt = aiService.buildPrompt('draft', 'improve', {
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
        currentLength: draft.length.toString(),
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
        setShowCompletionToast('章全体を改善しました');
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      }
    } catch (error) {
      console.error('章全体改善エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('章全体改善中にエラーが発生しました');
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // 弱点の特定と修正案の生成ループ（Self-Refine）
  const handleSelfRefineImprovement = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setCurrentGenerationAction('selfRefine');
    setIsGenerating(true);
    
    try {
      // フェーズ1：批評フェーズ（弱点の特定と修正案の生成）
      const critiquePrompt = aiService.buildPrompt('draft', 'critique', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
      });

      const critiqueResponse = await aiService.generateContent({
        prompt: critiquePrompt,
        type: 'draft',
        settings
      });

      if (!critiqueResponse || !critiqueResponse.content) {
        throw new Error('批評フェーズの応答が取得できませんでした');
      }

      // フェーズ2：改訂フェーズ（改善実行と統合）
      // プロンプトの長さを制限するため、元の文章を適切な長さに切り詰める
      const maxDraftLength = 4000; // プロンプトの長さをさらに制限
      const truncatedDraft = draft.length > maxDraftLength 
        ? draft.substring(0, maxDraftLength) + '\n\n[以下省略]' 
        : draft;
      
      // 評価結果から重要なポイントを抽出（JSON形式から要約を抽出）
      let critiqueResult = '';
      let critiqueSummary = '';
      let weaknesses: Array<{ aspect: string; score: number; problem: string; solutions: string[] }> = [];
      
      try {
        // JSON形式の評価結果を抽出（コードブロックがあれば除去）
        let jsonContent = critiqueResponse.content.trim();
        
        // コードブロックを除去
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          } else {
            // コードブロックが見つからない場合は、全体を使用
            jsonContent = jsonContent.replace(/```json\s*|\s*```/g, '').trim();
          }
        }
        
        // JSONオブジェクトを抽出（複数行に対応、最も長いマッチを選択）
        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = '';
        
        if (jsonMatches && jsonMatches.length > 0) {
          // 最も長いマッチを選択（完全なJSONの可能性が高い）
          jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
          // マッチが見つからない場合は、全体を試行
          jsonString = jsonContent;
        }
        
        // JSON文字列のクリーニング
        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '');
        
        if (jsonString && jsonString.startsWith('{')) {
          const critiqueData = JSON.parse(jsonString);
          
          // summaryを取得
          if (critiqueData.summary) {
            critiqueSummary = critiqueData.summary;
          }
          
          // weaknessesを取得
          if (critiqueData.weaknesses && Array.isArray(critiqueData.weaknesses)) {
            weaknesses = critiqueData.weaknesses.filter((w: any) => w && w.aspect && w.problem);
            
            // 7点以下の弱点を優先的に抽出
            const lowScoreWeaknesses = weaknesses
              .filter((w: any) => w.score !== undefined && w.score <= 7)
              .slice(0, 5); // 最大5つまで
            
            // 弱点の要約を作成
            if (lowScoreWeaknesses.length > 0) {
              const weaknessTexts = lowScoreWeaknesses.map((w: any) => {
                const solutions = w.solutions && Array.isArray(w.solutions) 
                  ? w.solutions.slice(0, 2).join('、') 
                  : '';
                return `【${w.aspect}】（スコア: ${w.score}/10）\n問題: ${w.problem}\n改善策: ${solutions}`;
              });
              critiqueSummary = weaknessTexts.join('\n\n') + (critiqueData.summary ? `\n\n総評: ${critiqueData.summary}` : '');
            } else if (weaknesses.length > 0) {
              // スコアが不明な場合は最初の3つを使用
              const weaknessTexts = weaknesses.slice(0, 3).map((w: any) => {
                const solutions = w.solutions && Array.isArray(w.solutions) 
                  ? w.solutions.slice(0, 2).join('、') 
                  : '';
                return `【${w.aspect}】\n問題: ${w.problem}\n改善策: ${solutions}`;
              });
              critiqueSummary = weaknessTexts.join('\n\n') + (critiqueData.summary ? `\n\n総評: ${critiqueData.summary}` : '');
            }
          }
          
          // 完全な評価結果を保持（reviseプロンプトで使用）
          critiqueResult = JSON.stringify(critiqueData, null, 2);
        } else {
          // JSONが見つからない場合は、テキスト全体を使用
          critiqueResult = critiqueResponse.content;
          critiqueSummary = critiqueResponse.content.substring(0, 1000);
        }
      } catch (e) {
        // JSON解析に失敗した場合は、評価結果をそのまま使用
        console.warn('Critique JSON解析エラー:', e);
        critiqueResult = critiqueResponse.content;
        
        // テキストから重要な部分を抽出
        const lines = critiqueResponse.content.split('\n').filter(line => line.trim());
        const importantLines = lines.filter(line => 
          line.includes('問題') || 
          line.includes('改善') || 
          line.includes('弱点') || 
          line.includes('評価') ||
          line.includes('スコア')
        );
        critiqueSummary = importantLines.length > 0 
          ? importantLines.slice(0, 10).join('\n')
          : lines.slice(0, 10).join('\n');
      }
      
      // 要約が長すぎる場合は切り詰める
      const maxSummaryLength = 1500;
      if (critiqueSummary.length > maxSummaryLength) {
        critiqueSummary = critiqueSummary.substring(0, maxSummaryLength) + '...';
      }

      // reviseプロンプトを構築（aiService.buildPromptを使用）
      const revisionPrompt = aiService.buildPrompt('draft', 'revise', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: truncatedDraft,
        critiqueResult: critiqueResult,
        currentLength: draft.length.toString(),
      });

      const revisionResponse = await aiService.generateContent({
        prompt: revisionPrompt,
        type: 'draft',
        settings
      });

      if (!revisionResponse || !revisionResponse.content) {
        throw new Error('改訂フェーズの応答が取得できませんでした');
      }

      // JSON形式の応答をパース（より堅牢な解析）
      let revisedText = '';
      let improvementSummary = '';
      let phase2Changes: string[] = [];
      
      try {
        // JSON形式の応答を抽出（コードブロックがあれば除去）
        let jsonContent = revisionResponse.content.trim();
        
        // コードブロックを除去
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
          }
        }
        
        // JSONオブジェクトを抽出（複数行に対応、最も長いマッチを選択）
        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = '';
        
        if (jsonMatches && jsonMatches.length > 0) {
          // 最も長いマッチを選択（完全なJSONの可能性が高い）
          jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
          // マッチが見つからない場合は、全体を試行
          jsonString = jsonContent;
        }
        
        // JSON文字列のクリーニング
        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '');
        
        if (jsonString && jsonString.startsWith('{')) {
          try {
            const parsed = JSON.parse(jsonString);
            revisedText = parsed.revisedText || parsed.revised_text || '';
            improvementSummary = parsed.improvementSummary || parsed.improvement_summary || '';
            phase2Changes = parsed.changes || [];
          } catch (parseError) {
            console.warn('JSON解析エラー（抽出した文字列）:', parseError);
            throw new Error('JSON形式が見つかりましたが、解析に失敗しました');
          }
        } else {
          throw new Error('JSON形式が見つかりません');
        }
        
        // revisedTextが空の場合は、テキストから文章を抽出
        if (!revisedText || revisedText.trim().length < 100) {
          // 応答から文章らしい部分を抽出
          const textPatterns = [
            /"revisedText"\s*:\s*"([^"]+)"/,  // JSON内の文字列
            /"revisedText"\s*:\s*"([^"]*\\"[^"]*)*"/,  // エスケープされた文字列
            /改訂後の文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,  // テキスト形式
            /改善された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,  // テキスト形式
          ];
          
          for (const pattern of textPatterns) {
            const match = revisionResponse.content.match(pattern);
            if (match && match[1] && match[1].trim().length > 100) {
              revisedText = match[1].trim().replace(/\\n/g, '\n').replace(/\\"/g, '"');
              break;
            }
          }
          
          // それでも見つからない場合は、応答全体から文章部分を抽出
          if (!revisedText || revisedText.trim().length < 100) {
            // JSON以外の部分から文章を抽出
            const lines = revisionResponse.content.split('\n');
            const textLines: string[] = [];
            let inTextBlock = false;
            
            for (const line of lines) {
              const trimmed = line.trim();
              // JSONのキーや構造的な部分をスキップ
              if (trimmed.startsWith('{') || trimmed.startsWith('}') || 
                  trimmed.startsWith('"') && trimmed.includes(':') && !trimmed.includes('、') && !trimmed.includes('。')) {
                continue;
              }
              // 文章らしい行を抽出
              if (trimmed.length > 20 && !trimmed.startsWith('//') && !trimmed.match(/^[\s\w":,\[\]{}]+$/)) {
                textLines.push(line);
                inTextBlock = true;
              } else if (inTextBlock && trimmed.length > 0) {
                textLines.push(line);
              }
            }
            
            if (textLines.length > 0) {
              revisedText = textLines.join('\n').trim();
            }
          }
        }
        
        // 最終的にrevisedTextが空の場合は、元の応答を使用（ただし警告を出す）
        if (!revisedText || revisedText.trim().length < 100) {
          console.warn('改訂後の文章の抽出に失敗。応答全体を使用します。');
          // 応答全体から、明らかにJSON構造の部分を除去
          const cleanedContent = revisionResponse.content
            .replace(/\{[^}]*"revisedText"[^}]*\}/g, '')
            .replace(/\{[^}]*"improvementSummary"[^}]*\}/g, '')
            .replace(/\{[^}]*"changes"[^}]*\}/g, '')
            .replace(/\{[\s\S]*?\}/g, '')
            .trim();
          
          if (cleanedContent.length > 100) {
            revisedText = cleanedContent;
          } else {
            revisedText = revisionResponse.content;
          }
        }
      } catch (parseError) {
        console.warn('JSONパースエラー、テキスト抽出を試行:', parseError);
        
        // JSONパースに失敗した場合でも、テキストから文章を抽出
        const textPatterns = [
          /改訂後の文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
          /改善された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
          /改訂された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
        ];
        
        let extracted = false;
        for (const pattern of textPatterns) {
          const match = revisionResponse.content.match(pattern);
          if (match && match[1] && match[1].trim().length > 100) {
            revisedText = match[1].trim();
            extracted = true;
            break;
          }
        }
        
        // それでも見つからない場合は、応答全体を使用（ただし構造的な部分を除去）
        if (!extracted) {
          const cleanedContent = revisionResponse.content
            .replace(/\{[^}]*"revisedText"[^}]*\}/g, '')
            .replace(/\{[^}]*"improvementSummary"[^}]*\}/g, '')
            .replace(/\{[^}]*"changes"[^}]*\}/g, '')
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();
          
          revisedText = cleanedContent.length > 100 ? cleanedContent : revisionResponse.content;
        }
      }

      if (revisedText.trim()) {
        setDraft(revisedText);
        handleSaveChapterDraft(selectedChapter!, revisedText);
        
        // 改善ログを保存
        const logId = `log-${Date.now()}`;
        const improvementLog: ImprovementLog = {
          id: logId,
          timestamp: Date.now(),
          chapterId: selectedChapter!,
          phase1Critique: critiqueResponse.content,
          phase2Summary: improvementSummary || '改善戦略の要約が取得できませんでした',
          phase2Changes: phase2Changes,
          originalLength: draft.length,
          revisedLength: revisedText.length,
        };
        
        setImprovementLogs(prev => {
          const chapterLogs = prev[selectedChapter!] || [];
          return {
            ...prev,
            [selectedChapter!]: [improvementLog, ...chapterLogs].slice(0, 20), // 最新20件まで保持
          };
        });
        
        // 改善戦略の要約をトーストで表示
        const toastMsg = improvementSummary 
          ? `弱点を特定し、改善しました。改善ログを確認できます。`
          : '弱点を特定し、改善しました';
        setShowCompletionToast(toastMsg);
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 3000);
      } else {
        throw new Error('改訂後の文章が取得できませんでした');
      }
    } catch (error) {
      console.error('弱点特定と修正ループエラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('弱点特定と修正中にエラーが発生しました: ' + ((error as Error).message || '不明なエラー'));
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
    }
  };

  // AI生成キャンセル処理
  const handleCancelGeneration = useCallback(() => {
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsGeneratingSuggestion(false);
    setIsGeneratingAllChapters(false);
    setCurrentGenerationAction(null);
    setToastMessage('生成をキャンセルしました');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // 統合されたAI生成状態
  const unifiedAIStatus = useMemo(() => {
    if (isGeneratingAllChapters) {
      return {
        visible: true,
        title: '全章を生成しています…',
        detail: generationStatus || 
          (generationProgress.total > 0
            ? `${generationProgress.current} / ${generationProgress.total}章を処理中です`
            : 'AIが章を順番に執筆しています'),
        tone: 'blue' as AIStatusTone,
        canCancel: true,
      };
    }
    
    if (isGenerating || isGeneratingSuggestion) {
      if (aiStatus) {
        return {
          visible: true,
          title: aiStatus.title,
          detail: aiStatus.detail,
          tone: aiStatus.tone,
          canCancel: true,
        };
      }
    }
    
    return { visible: false };
  }, [isGenerating, isGeneratingSuggestion, isGeneratingAllChapters, aiStatus, generationStatus, generationProgress]);

  // プロジェクトが存在しない場合の表示
  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          プロジェクトを作成してから草案作成を開始してください。
        </p>
      </div>
    );
  }

  // 章が存在しない場合の表示
  if (currentProject.chapters.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
          草案を作成するには、まず章立てを完成させてください。
        </p>
        <div className="text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            「章立て」ステップで章を作成してから戻ってきてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <DraftHeader onBackup={handleCreateManualBackup} />

      {/* 統合AI生成状態バー */}
      <AIStatusBar
        visible={unifiedAIStatus.visible}
        title={unifiedAIStatus.title || ''}
        detail={unifiedAIStatus.detail}
        tone={unifiedAIStatus.tone}
        canCancel={unifiedAIStatus.canCancel}
        onCancel={handleCancelGeneration}
      />

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* メインエディタエリア */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* 章選択 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-6">
              <ChapterTabs
                chapters={currentProject.chapters}
                selectedChapterId={selectedChapter}
                chapterDrafts={chapterDrafts}
                onChapterSelect={handleChapterSelect}
                onPrevChapter={handlePrevChapter}
                onNextChapter={handleNextChapter}
                currentChapterIndex={currentChapterIndex}
              />
            </div>

            <MainEditor
              ref={mainEditorRef}
              selectedChapterId={selectedChapter}
              currentChapter={currentChapter}
              draft={draft}
              chapterDetails={currentChapter ? getChapterDetails(currentChapter) : null}
              isChapterInfoCollapsed={isChapterInfoCollapsed}
              onChapterInfoToggle={() => setIsChapterInfoCollapsed(prev => !prev)}
              onDraftChange={(value) => {
                const newContent = value;
                setDraft(newContent);
                
                // 即座にchapterDraftsを更新（保存はしない）
                if (selectedChapter) {
                  setChapterDrafts(prev => ({
                    ...prev,
                    [selectedChapter]: newContent
                  }));
                  
                  // 自動保存のタイマーを設定（2秒後に保存）
                  if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                  }
                  
                  autoSaveTimeoutRef.current = setTimeout(() => {
                    if (selectedChapter && newContent.trim()) {
                      handleSaveChapterDraft(selectedChapter, newContent, true);
                    }
                  }, 2000);
                }
              }}
              mainFontSize={mainFontSize}
              mainLineHeight={mainLineHeight}
              mainTextareaHeight={mainTextareaHeight}
              wordCount={wordCount}
              lastSavedAt={lastSavedAt}
              selectedChapter={selectedChapter}
              onSave={async () => {
                if (selectedChapter) {
                  await handleSaveChapterDraft(selectedChapter, undefined, false);
                  setToastMessage('保存しました');
                  setTimeout(() => {
                    setToastMessage(null);
                  }, 3000);
                }
              }}
              onOpenViewer={handleOpenViewer}
              onExportChapter={handleExportChapter}
              onOpenDisplaySettings={() => openSecondaryTab('display')}
              onOpenAIAssist={() => openSecondaryTab('ai')}
              isVerticalWriting={isVerticalWriting}
              isZenMode={isZenMode}
              onExitZenMode={() => setIsZenMode(false)}
            />

            {/* 伏線パネル */}
            {selectedChapter && !isZenMode && (
              <ForeshadowingPanel
                currentChapterId={selectedChapter}
                onInsertText={(text) => {
                  if (mainEditorRef.current) {
                    mainEditorRef.current.insertText(text);
                  }
                }}
                isCollapsed={isForeshadowingPanelCollapsed}
                onToggleCollapse={() => setIsForeshadowingPanelCollapsed(prev => !prev)}
                currentDraft={draft}
              />
            )}
          </div>

          {/* 副次機能パネル */}
          <aside className="w-full lg:w-80 xl:w-[360px] flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-5 pt-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  ワークスペース
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                  副次機能をタブで切り替えて利用できます。
                </p>
              </div>
              <div className="px-5 pt-4">
                <div
                  role="tablist"
                  aria-label="副次機能"
                  className="flex flex-col gap-2"
                >
                  {secondaryTabs.map(tab => {
                    const isActive = activeSecondaryTab === tab.id;
                    return (
                      <div key={tab.id} className="relative group">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          disabled={tab.disabled}
                          onClick={() => !tab.disabled && openSecondaryTab(tab.id)}
                          title={tab.disabled ? tab.disabledReason : undefined}
                          className={`w-full px-4 py-3 text-sm font-semibold rounded-lg transition-all font-['Noto_Sans_JP'] relative ${
                            isActive
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm'
                              : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                          } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className="relative z-10">{tab.label}</span>
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-b-lg" />
                          )}
                        </button>
                        {/* ツールチップ（無効状態の場合） */}
                        {tab.disabled && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-['Noto_Sans_JP']">
                            {tab.disabledReason}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-5 py-5">
                {renderSecondaryTabContent()}
              </div>
            </div>
          </aside>
        </div>
      </div>

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

      {/* プレビュー／編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseModal}
            />

            {/* モーダルコンテンツ */}
            <div className="relative w-full max-w-7xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* モーダルヘッダー */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <PenTool className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {currentChapter ? `${currentChapter.title} の草案プレビュー` : '草案プレビュー'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {modalDraft.length.toLocaleString()} 文字
                      {currentChapter && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ({currentChapter.title})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsVerticalWriting(!isVerticalWriting)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP'] text-sm"
                  >
                    {isVerticalWriting ? (
                      <>
                        <AlignLeft className="h-4 w-4" />
                        <span>横書き</span>
                      </>
                    ) : (
                      <>
                        <AlignJustify className="h-4 w-4" />
                        <span>縦書き</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* モーダルボディ */}
              <div className="p-4">
                {/* 章内容表示 */}
                {currentChapter && (
                  <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                    {/* アコーディオンヘッダー */}
                    <button
                      onClick={() => setIsModalChapterInfoCollapsed(!isModalChapterInfoCollapsed)}
                      className="w-full p-4 flex items-start space-x-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] ${!isModalChapterInfoCollapsed ? 'mb-2' : ''}`}>
                            {currentChapter.title}
                          </h4>
                          {isModalChapterInfoCollapsed ? (
                            <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          )}
                        </div>
                        {!isModalChapterInfoCollapsed && (
                          <>
                            <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                              {(() => {
                                // 章の説明内のキャラクターIDをキャラクター名に変換
                                if (!currentChapter.summary || !currentProject) {
                                  return currentChapter.summary || '';
                                }
                                let summary = currentChapter.summary;
                                // プロジェクト内のすべてのキャラクターIDをキャラクター名に置換
                                currentProject.characters.forEach(character => {
                                  // キャラクターIDがテキスト内に含まれている場合、キャラクター名に置換
                                  // 単語境界を考慮して置換（IDが単独で出現する場合のみ）
                                  const regex = new RegExp(`\\b${character.id}\\b`, 'g');
                                  summary = summary.replace(regex, character.name);
                                });
                                return summary;
                              })()}
                            </p>

                            {/* 章詳細情報 */}
                            {(() => {
                              const chapterDetails = getChapterDetails(currentChapter);
                              const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');

                              if (!hasDetails) return null;

                              return (
                                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {chapterDetails.characters !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                      </div>
                                    )}
                                    {chapterDetails.setting !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                      </div>
                                    )}
                                    {chapterDetails.mood !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                      </div>
                                    )}
                                    {chapterDetails.keyEvents !== '未設定' && (
                                      <div className="sm:col-span-2">
                                        <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* テキストエリア（読み取り専用） */}
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <div
                    ref={verticalPreviewRef}
                    className={`${isVerticalWriting ? 'h-[600px] font-serif-jp' : 'h-[400px] font-[\'Noto_Sans_JP\']'} w-full p-4 border-0 rounded-lg bg-transparent text-gray-900 dark:text-white leading-relaxed overflow-auto whitespace-pre-wrap`}
                    style={{
                      lineHeight: isVerticalWriting ? '2.0' : '1.8',
                      letterSpacing: isVerticalWriting ? '0.05em' : 'normal',
                      writingMode: isVerticalWriting ? 'vertical-rl' : 'horizontal-tb',
                      textOrientation: isVerticalWriting ? 'upright' : 'mixed',
                    }}
                  >
                    {modalDraft || (
                      <div className="text-gray-400 dark:text-gray-500 italic">
                        草案がまだ作成されていません。メインエディタで執筆を開始してください。
                      </div>
                    )}
                  </div>
                </div>

                {/* モーダルフッター */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数: {modalDraft.length.toLocaleString()}
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 改善ログモーダル */}
      <ImprovementLogModal
        isOpen={isImprovementLogModalOpen}
        chapterTitle={currentChapter?.title || null}
        logs={selectedChapter && improvementLogs[selectedChapter] ? improvementLogs[selectedChapter] : []}
        selectedLogId={selectedImprovementLogId}
        onClose={() => setIsImprovementLogModalOpen(false)}
        onSelectLog={setSelectedImprovementLogId}
      />

      {/* トースト通知 */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 生成完了通知 */}
      {showCompletionToast && (
        <Toast
          message={showCompletionToast}
          type="info"
          onClose={() => setShowCompletionToast(null)}
        />
      )}
    </div>
  );
};