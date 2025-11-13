import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { PenTool, Sparkles, BookOpen, Save, Download, FileText, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, ListChecks, Wand2, ChevronDown, ChevronUp, AlignLeft, AlignJustify, CheckCircle, X, MoreVertical } from 'lucide-react';
import { diffLines, type Change } from 'diff';
import { aiService } from '../../services/aiService';
import { databaseService } from '../../services/databaseService';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';

const MODAL_TEXTAREA_MIN_HEIGHT = 260;
const MODAL_TEXTAREA_MAX_HEIGHT = 1000;
const MODAL_TEXTAREA_DEFAULT_HEIGHT = 420;
const MODAL_TEXTAREA_HEIGHT_STEP = 80;
const MODAL_FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24];
const MODAL_LINE_HEIGHT_OPTIONS = [1.4, 1.6, 1.8];
const MODAL_DEFAULT_FONT_SIZE = 16;
const MODAL_DEFAULT_LINE_HEIGHT = 1.6;

const HISTORY_STORAGE_PREFIX = 'chapterHistory';
const HISTORY_MAX_ENTRIES = 30;
const HISTORY_AUTO_SAVE_DELAY = 20000;

type HistoryEntryType = 'auto' | 'manual' | 'restore';

interface ChapterHistoryEntry {
  id: string;
  timestamp: number;
  content: string;
  type: HistoryEntryType;
  label: string;
}

type AISuggestionType = 'rewrite' | 'tone' | 'summary';

interface AISuggestion {
  id: string;
  title: string;
  body: string;
}

type GenerationAction = 'fullDraft' | 'continue' | 'description' | 'style' | 'shorten' | 'improve';
type AIStatusTone = 'emerald' | 'blue' | 'purple';
type SecondaryTab = 'ai' | 'display' | 'history' | 'project';

const AI_STATUS_STYLES: Record<
  AIStatusTone,
  {
    container: string;
    icon: string;
    title: string;
    detail: string;
  }
> = {
  emerald: {
    container: 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200',
    icon: 'bg-emerald-500 text-white',
    title: 'text-emerald-700 dark:text-emerald-200',
    detail: 'text-emerald-600 dark:text-emerald-300',
  },
  blue: {
    container: 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    icon: 'bg-blue-500 text-white',
    title: 'text-blue-700 dark:text-blue-200',
    detail: 'text-blue-600 dark:text-blue-300',
  },
  purple: {
    container: 'bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-200',
    icon: 'bg-purple-500 text-white',
    title: 'text-purple-700 dark:text-purple-200',
    detail: 'text-purple-600 dark:text-purple-300',
  },
};

interface SuggestionPromptPayload {
  selectedText: string;
  chapterTitle?: string;
  chapterSummary?: string;
  projectTitle?: string;
}

const HISTORY_TYPE_LABELS: Record<HistoryEntryType, string> = {
  auto: '自動保存',
  manual: '手動保存',
  restore: '復元前',
};

const HISTORY_BADGE_CLASSES: Record<HistoryEntryType, string> = {
  auto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  manual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};

const MAX_SUGGESTION_TEXT_LENGTH = 2000;

const SUGGESTION_CONFIG: Record<
  AISuggestionType,
  {
    label: string;
    description: string;
    prompt: (payload: SuggestionPromptPayload) => string;
  }
> = {
  rewrite: {
    label: 'リライト案',
    description: '読みやすさと臨場感を両立した案を生成します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは熟練の小説編集者です。以下のテキストを、読者が没入しやすい自然な流れに整えてください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください（余計な文章は書かないこと）:
{
  "suggestions": [
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" },
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" },
    { "title": "案の短い説明", "body": "提案内容（200文字程度）" }
  ]
}

各案は文体やリズムに変化を付け、会話と描写のバランスを意識してください。`,
  },
  tone: {
    label: 'トーン調整',
    description: '雰囲気や感情のトーンを強調した案を提示します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは物語のトーンを整える編集者です。以下のテキストの感情・雰囲気を際立たせたバリエーションを3案提案してください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください:
{
  "suggestions": [
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" },
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" },
    { "title": "強調するトーンの説明", "body": "提案本文（180文字程度）" }
  ]
}

各案では異なる感情や雰囲気（例: 緊張感、切なさ、希望など）を意識し、描写を調整してください。`,
  },
  summary: {
    label: '要約＆鍵フレーズ',
    description: '内容を整理し、重要な要素を抽出します',
    prompt: ({ selectedText, chapterTitle, chapterSummary, projectTitle }) => `あなたは編集アシスタントです。以下のテキストの要点を整理し、今後の執筆に役立つ情報を抽出してください。

作品タイトル: ${projectTitle || '未設定'}
章タイトル: ${chapterTitle || '未設定'}
章概要: ${chapterSummary || '未設定'}

対象テキスト:
"""${selectedText}"""

返答は必ず次のJSON形式で出力してください:
{
  "suggestions": [
    { "title": "要約", "body": "3〜4文で内容を要約" },
    { "title": "伏線・感情のヒント", "body": "注意すべきポイントを箇条書きで" },
    { "title": "キーフレーズ", "body": "重要語句やアイデアを列挙" }
  ]
}

要約は具体的・簡潔に、箇条書きは「・」で始めてください。`,
  },
};

const getHistoryStorageKey = (projectId: string, chapterId: string) =>
  `${HISTORY_STORAGE_PREFIX}_${projectId}_${chapterId}`;

const formatTimestamp = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return `${timestamp}`;
  }
};

const parseAISuggestions = (raw: string): AISuggestion[] => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .map((item: { title?: string; body?: string }, index: number) => ({
          id: `parsed-${Date.now()}-${index}`,
          title: item?.title?.trim() || `提案 ${index + 1}`,
          body: item?.body?.trim() || '',
        }))
        .filter((item: AISuggestion) => item.body);
    }
  } catch {
    // フォールバック処理へ
  }

  const fallbackSegments = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (fallbackSegments.length) {
    return fallbackSegments.map((segment, index) => ({
      id: `fallback-${Date.now()}-${index}`,
      title: `提案 ${index + 1}`,
      body: segment,
    }));
  }

  return [
    {
      id: `raw-${Date.now()}`,
      title: 'AI提案',
      body: raw.trim(),
    },
  ];
};
const isTauriEnvironment = () => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI_IPC__ || (window as any).__TAURI_METADATA__);
};

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
};

const downloadTextFileInBrowser = (filename: string, content: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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
  const [isModalChapterInfoCollapsed, setIsModalChapterInfoCollapsed] = useState(false);
  const [mainLineNumbers, setMainLineNumbers] = useState<number[]>([1]);
  const [chapterHistories, setChapterHistories] = useState<Record<string, ChapterHistoryEntry[]>>({});
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
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
  const [showMainLineNumbers, setShowMainLineNumbers] = useState<boolean>(false);
  const [isMainFocusMode, setIsMainFocusMode] = useState<boolean>(false);
  const [currentGenerationAction, setCurrentGenerationAction] = useState<GenerationAction | null>(null);
  
  // アコーディオン用の状態
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<SecondaryTab>('ai');
  
  // トースト通知用の状態
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // ドロップダウンメニュー用の状態
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  
  // 章選択タブのスクロール状態
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // AI生成キャンセル用のref
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const [showCompletionToast, setShowCompletionToast] = useState<string | null>(null);

  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mainLineNumbersRef = useRef<HTMLDivElement | null>(null);
  const mainLineNumbersInnerRef = useRef<HTMLDivElement | null>(null);
  const chapterTabsContainerRef = useRef<HTMLDivElement | null>(null);
  const previousMainChapterCollapsedRef = useRef<boolean>(false);
  const previousMainFocusModeRef = useRef<boolean>(false);
  const historyAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSnapshotContentRef = useRef<string>('');
  const historyLoadedChaptersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    historyLoadedChaptersRef.current.clear();
    setChapterHistories({});
    setSelectedHistoryEntryId(null);
  }, [currentProject?.id]);

  // 章選択タブのスクロール状態を更新
  const updateScrollButtons = useCallback(() => {
    const container = chapterTabsContainerRef.current;
    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // 選択章を中央に自動スクロール
  useEffect(() => {
    if (!chapterTabsContainerRef.current || !selectedChapter) {
      updateScrollButtons();
      return;
    }
    const container = chapterTabsContainerRef.current;
    const activeTab = container.querySelector<HTMLButtonElement>(`[data-chapter-id="${selectedChapter}"]`);
    if (!activeTab) {
      updateScrollButtons();
      return;
    }

    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;
    const tabCenter = tabLeft + tabWidth / 2;
    const containerWidth = container.clientWidth;
    const scrollLeft = tabCenter - containerWidth / 2;

    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    
    // スクロール完了後にボタン状態を更新
    setTimeout(updateScrollButtons, 300);
  }, [selectedChapter, updateScrollButtons]);

  // スクロール時にボタン状態を更新
  useEffect(() => {
    const container = chapterTabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateScrollButtons();
    };

    container.addEventListener('scroll', handleScroll);
    // 初期状態を更新
    updateScrollButtons();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateScrollButtons]);

  // ウィンドウリサイズ時にスクロール状態を更新
  useEffect(() => {
    const handleResize = () => {
      updateScrollButtons();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollButtons]);

  const createHistorySnapshot = useCallback(
    (type: HistoryEntryType, options?: { content?: string; label?: string; force?: boolean }) => {
      if (!currentProject || !selectedChapter) return false;
      const content = options?.content ?? draft;
      const normalizedContent = content ?? '';
      const storageKey = getHistoryStorageKey(currentProject.id, selectedChapter);

      let entryWasAdded = false;
      const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const label = options?.label || HISTORY_TYPE_LABELS[type] || '履歴';

      setChapterHistories(prev => {
        const previousEntries = prev[selectedChapter] || [];
        if (!options?.force && previousEntries[0]?.content === normalizedContent) {
          return prev;
        }

        entryWasAdded = true;

        const newEntry: ChapterHistoryEntry = {
          id: entryId,
          timestamp: Date.now(),
          content: normalizedContent,
          type,
          label,
        };

        const updatedEntries = [newEntry, ...previousEntries].slice(0, HISTORY_MAX_ENTRIES);

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
          } catch (error) {
            console.warn('章履歴の保存に失敗しました:', error);
          }
        }

        lastSnapshotContentRef.current = normalizedContent;

        return {
          ...prev,
          [selectedChapter]: updatedEntries,
        };
      });

      if (entryWasAdded) {
        setSelectedHistoryEntryId(entryId);
      }

      return entryWasAdded;
    },
    [currentProject, selectedChapter, draft]
  );

  const handleManualHistorySnapshot = useCallback(() => {
    createHistorySnapshot('manual', { force: true, label: '手動保存' });
  }, [createHistorySnapshot]);

  const getCurrentSelection = useCallback(() => {
    const textarea = mainTextareaRef.current;
    if (!textarea) return '';
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart === selectionEnd) return '';
    return textarea.value.slice(selectionStart, selectionEnd);
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
    const wasFocus = previousMainFocusModeRef.current;

    if (isMainFocusMode && !wasFocus) {
      previousMainChapterCollapsedRef.current = isChapterInfoCollapsed;
      setIsChapterInfoCollapsed(true);
    } else if (!isMainFocusMode && wasFocus) {
      setIsChapterInfoCollapsed(previousMainChapterCollapsedRef.current);
    }

    previousMainFocusModeRef.current = isMainFocusMode;
  }, [isMainFocusMode, isChapterInfoCollapsed]);

  useEffect(() => {
    if (!currentProject || !selectedChapter) {
      return;
    }

    if (historyLoadedChaptersRef.current.has(selectedChapter)) return;
    if (typeof window === 'undefined') return;

    const storageKey = getHistoryStorageKey(currentProject.id, selectedChapter);
    let parsedEntries: ChapterHistoryEntry[] = [];

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        parsedEntries = JSON.parse(stored) as ChapterHistoryEntry[];
      }
    } catch (error) {
      console.warn('章履歴の読み込みに失敗しました:', error);
    }

    setChapterHistories(prev => ({
      ...prev,
      [selectedChapter]: parsedEntries,
    }));

    if (parsedEntries[0]) {
      lastSnapshotContentRef.current = parsedEntries[0].content;
    } else {
      const fallbackContent =
        currentProject.chapters.find(chapter => chapter.id === selectedChapter)?.draft || '';
      lastSnapshotContentRef.current = fallbackContent;
    }

    historyLoadedChaptersRef.current.add(selectedChapter);
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
      createHistorySnapshot('auto');
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

  const mainLineNumbersContent = useMemo(() => mainLineNumbers.join('\n'), [mainLineNumbers]);
  const mainComputedLineHeight = useMemo(() => Math.max(mainFontSize * mainLineHeight, 12), [mainFontSize, mainLineHeight]);

  const updateMainLineNumbers = useCallback(() => {
    const textarea = mainTextareaRef.current;
    if (!textarea) {
      setMainLineNumbers([1]);
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const contentHeight = Math.max(textarea.scrollHeight - paddingTop - paddingBottom, 0);
    const totalLines = Math.max(1, Math.ceil(contentHeight / mainComputedLineHeight));

    setMainLineNumbers((prev) => {
      if (prev.length === totalLines) {
        return prev;
      }
      return Array.from({ length: totalLines }, (_, index) => index + 1);
    });
  }, [mainComputedLineHeight]);

  useEffect(() => {
    updateMainLineNumbers();
  }, [draft, mainComputedLineHeight, mainTextareaHeight, isMainFocusMode, showMainLineNumbers, updateMainLineNumbers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      updateMainLineNumbers();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMainLineNumbers]);

  const syncLineNumberScroll = useCallback((textarea: HTMLTextAreaElement | null, innerElement: HTMLDivElement | null) => {
    if (!textarea || !innerElement) return;
    innerElement.style.transform = `translateY(-${textarea.scrollTop}px)`;
  }, []);

  const handleMainTextareaScroll = useCallback(() => {
    syncLineNumberScroll(mainTextareaRef.current, mainLineNumbersInnerRef.current);
  }, [syncLineNumberScroll]);

  useEffect(() => {
    if (showMainLineNumbers) {
      syncLineNumberScroll(mainTextareaRef.current, mainLineNumbersInnerRef.current);
    }
  }, [showMainLineNumbers, mainTextareaHeight, draft, mainComputedLineHeight, syncLineNumberScroll]);

  const mainEditorContainerClass = isMainFocusMode
    ? 'border border-emerald-500/40 bg-gray-900/90 shadow-inner'
    : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700';

  const mainControlButtonBase = isMainFocusMode
    ? 'rounded-md border border-emerald-500/40 bg-gray-900/80 text-emerald-200 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const mainControlButtonActive = isMainFocusMode
    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100'
    : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700';

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
        id: 'ai' as SecondaryTab, 
        label: 'AIアシスト', 
        disabled: !selectedChapter,
        disabledReason: '章を選択すると利用できます'
      },
      { 
        id: 'display' as SecondaryTab, 
        label: '表示設定', 
        disabled: false,
        disabledReason: ''
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
    ],
    [selectedChapter]
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
    setShowMainLineNumbers(false);
    setIsMainFocusMode(false);
  }, []);

  const renderAiTab = (): React.ReactNode => {
    if (!selectedChapter || !currentChapter) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          章を選択するとAIアシスト機能が利用できます。
        </div>
      );
    }

    const hasSelectionState = aiSuggestions.length > 0 || lastSelectedText;

    return (
      <div className="space-y-5">
        {/* サイドバー内の状態表示は削除（画面上部の統合バーに統合） */}

        <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                章全体の生成
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                選択中の章をベースに長文ドラフトを生成します。
              </p>
            </div>
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
            disabled={isGenerating || !selectedChapter}
            aria-busy={isFullDraftGenerating}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold font-['Noto_Sans_JP'] transition-all ${
              isFullDraftGenerating
                ? 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200 shadow-inner'
                : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-sm'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Sparkles
              className={`h-4 w-4 ${isFullDraftGenerating ? 'animate-spin text-emerald-600 dark:text-emerald-300' : 'text-white'}`}
            />
            <span>{isFullDraftGenerating ? 'AIが執筆中…' : 'AI章執筆を実行'}</span>
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            章全体の改善
          </h4>
          <button
            type="button"
            onClick={handleChapterImprovement}
            disabled={isGenerating || !draft.trim() || !selectedChapter}
            aria-busy={isImproving}
            className="w-full p-3 text-left bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col">
              <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
                章全体改善
                <Sparkles
                  className={`h-3 w-3 ${isImproving ? 'text-indigo-500 animate-spin' : 'text-indigo-500/70'}`}
                />
              </div>
              <div
                className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                  isImproving ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {isImproving ? 'AIが描写と文体を総合的に改善しています…' : '描写強化＋文体調整を同時に実行'}
              </div>
            </div>
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleContinueGeneration}
              disabled={isGenerating || !draft.trim() || !selectedChapter}
              aria-busy={isContinueGenerating}
              className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col">
                <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
                  続きを生成
                  <Sparkles
                    className={`h-3 w-3 ${isContinueGenerating ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`}
                  />
                </div>
                <div
                  className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                    isContinueGenerating ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isContinueGenerating ? 'AIが文章の続きを生成しています…' : '文章の続きを提案'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDescriptionEnhancement}
              disabled={isGenerating || !draft.trim() || !selectedChapter}
              aria-busy={isDescriptionGenerating}
              className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col">
                <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
                  描写強化
                  <Sparkles
                    className={`h-3 w-3 ${isDescriptionGenerating ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`}
                  />
                </div>
                <div
                  className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                    isDescriptionGenerating ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isDescriptionGenerating ? 'AIが描写を細部まで磨いています…' : '情景を詳しく'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleStyleAdjustment}
              disabled={isGenerating || !draft.trim() || !selectedChapter}
              aria-busy={isStyleGenerating}
              className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col">
                <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
                  文体調整
                  <Sparkles
                    className={`h-3 w-3 ${isStyleGenerating ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`}
                  />
                </div>
                <div
                  className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                    isStyleGenerating ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isStyleGenerating ? 'AIが文体を整えています…' : '読みやすく'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleShortenText}
              disabled={isGenerating || !draft.trim() || !selectedChapter}
              aria-busy={isShortenGenerating}
              className="p-2.5 text-left bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col">
                <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP'] flex items-center justify-between">
                  文章短縮
                  <Sparkles
                    className={`h-3 w-3 ${isShortenGenerating ? 'text-emerald-500 animate-spin' : 'text-emerald-500/70'}`}
                  />
                </div>
                <div
                  className={`text-[11px] font-['Noto_Sans_JP'] mt-0.5 ${
                    isShortenGenerating ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isShortenGenerating ? 'AIが文章を凝縮しています…' : '簡潔にまとめる'}
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                テキスト選択ツール
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                選択した文章に対する改善提案を受け取ります。
              </p>
            </div>
            {hasSelectionState && (
              <button
                type="button"
                onClick={() => {
                  setAISuggestions([]);
                  setSuggestionError(null);
                  setLastSelectedText('');
                  setWasSelectionTruncated(false);
                }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-['Noto_Sans_JP']"
              >
                クリア
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(['rewrite', 'tone', 'summary'] as AISuggestionType[]).map(type => {
              const config = SUGGESTION_CONFIG[type];
              const isActive = activeSuggestionType === type && isGeneratingSuggestion;
              const descriptionText = isActive ? 'AIが提案を生成しています…' : config.description;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleGenerateSuggestions(type)}
                  disabled={isGeneratingSuggestion || isGenerating || !selectedChapter}
                  aria-busy={isActive}
                  className="w-full p-2.5 text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white text-xs font-['Noto_Sans_JP']">
                        {config.label}
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">
                        {descriptionText}
                      </div>
                    </div>
                    <Sparkles
                      className={`h-3.5 w-3.5 text-purple-500 ${isActive ? 'animate-spin' : 'opacity-60'}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {suggestionError && (
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-2.5 font-['Noto_Sans_JP']">
              {suggestionError}
            </div>
          )}

          {lastSelectedText && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">
                対象テキスト
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 max-h-24 overflow-y-auto whitespace-pre-wrap font-['Noto_Sans_JP']">
                {lastSelectedText.length > 150 ? `${lastSelectedText.slice(0, 150)}…` : lastSelectedText}
              </div>
              {wasSelectionTruncated && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                  ⚠️ 選択範囲が長いため先頭のみを使用
                </div>
              )}
            </div>
          )}

          {isGeneratingSuggestion && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP'] p-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-spin" />
              提案を生成中...
            </div>
          )}

          {aiSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h5 className="text-xs font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  {suggestion.title}
                </h5>
                <button
                  type="button"
                  onClick={() => applyAISuggestion(suggestion)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors font-['Noto_Sans_JP'] flex-shrink-0"
                >
                  <Sparkles className="h-3 w-3" />
                  適用
                </button>
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed">
                {suggestion.body}
              </div>
            </div>
          ))}

          {!isGeneratingSuggestion && aiSuggestions.length === 0 && !lastSelectedText && (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-2">
              テキストを選択してボタンを押すと提案を表示します。
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDisplayTab = (): React.ReactNode => (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              表示設定
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              執筆エリアの見た目と操作感を調整します。
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDisplaySettings}
            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-['Noto_Sans_JP'] transition-colors"
          >
            リセット
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
              フォントサイズ
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {MODAL_FONT_SIZE_OPTIONS.map(size => (
                <button
                  key={`display-font-${size}`}
                  type="button"
                  onClick={() => setMainFontSize(size)}
                  className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
                    mainFontSize === size ? mainControlButtonActive : ''
                  }`}
                  aria-pressed={mainFontSize === size}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
              行間
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {MODAL_LINE_HEIGHT_OPTIONS.map(value => (
                <button
                  key={`display-line-height-${value}`}
                  type="button"
                  onClick={() => setMainLineHeight(value)}
                  className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
                    mainLineHeight === value ? mainControlButtonActive : ''
                  }`}
                  aria-pressed={mainLineHeight === value}
                >
                  {value === MODAL_DEFAULT_LINE_HEIGHT ? '標準' : value.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
                テキストエリアの高さ
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                {Math.round(mainTextareaHeight)}px
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustMainTextareaHeight(-MODAL_TEXTAREA_HEIGHT_STEP)}
                disabled={mainTextareaHeight <= MODAL_TEXTAREA_MIN_HEIGHT}
                className={`${mainControlButtonBase} w-9 h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="テキストエリアの高さを縮小"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all"
                  style={{
                    width: `${((mainTextareaHeight - MODAL_TEXTAREA_MIN_HEIGHT) / (MODAL_TEXTAREA_MAX_HEIGHT - MODAL_TEXTAREA_MIN_HEIGHT)) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => adjustMainTextareaHeight(MODAL_TEXTAREA_HEIGHT_STEP)}
                disabled={mainTextareaHeight >= MODAL_TEXTAREA_MAX_HEIGHT}
                className={`${mainControlButtonBase} w-9 h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="テキストエリアの高さを拡大"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
          <button
            type="button"
            onClick={() => setShowMainLineNumbers(prev => !prev)}
            className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
              showMainLineNumbers ? mainControlButtonActive : ''
            }`}
            aria-pressed={showMainLineNumbers}
          >
            行番号 {showMainLineNumbers ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setIsMainFocusMode(prev => !prev)}
            className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
              isMainFocusMode ? mainControlButtonActive : ''
            }`}
            aria-pressed={isMainFocusMode}
          >
            {isMainFocusMode ? '集中モード解除' : '集中モード'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2">
          表示プリセット
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMainFontSize(16);
              setMainLineHeight(1.6);
              setShowMainLineNumbers(false);
              setIsMainFocusMode(false);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300"
          >
            標準ビュー<br/>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">16px / 行間1.6 / 行番号OFF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMainFontSize(18);
              setMainLineHeight(1.8);
              setShowMainLineNumbers(true);
              setIsMainFocusMode(true);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300"
          >
            集中ビュー<br/>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">18px / 行間1.8 / 行番号ON</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = (): React.ReactNode => {
    if (!selectedChapter || !currentChapter) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          章を選択すると履歴を表示できます。
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              差分履歴
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              現在の草案と過去のスナップショットを比較し復元します。
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualHistorySnapshot}
            disabled={!selectedChapter}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-semibold font-['Noto_Sans_JP'] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            現在の状態を保存
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {historyEntries.length > 0 ? (
            historyEntries.map(entry => {
              const preview =
                entry.content && entry.content.trim().length > 0
                  ? `${entry.content.replace(/\s+/g, ' ').slice(0, 50)}${entry.content.length > 50 ? '…' : ''}`
                  : '（空の草案）';
              const isActive = selectedHistoryEntryId === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedHistoryEntryId(entry.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-150 font-['Noto_Sans_JP'] ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-100'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${HISTORY_BADGE_CLASSES[entry.type]}`}>
                      {entry.label}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {preview}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-4">
              履歴はまだありません
            </div>
          )}
        </div>

        {selectedHistoryEntry && (
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
                      <pre className="whitespace-pre-wrap px-3 py-1 text-xs font-mono">
                        {`${prefix}${segment.value || ''}`}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
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
        return renderDisplayTab();
      case 'history':
        return renderHistoryTab();
      case 'project':
        return renderProjectTab();
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

    createHistorySnapshot('restore', {
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
      if (mainTextareaRef.current) {
        const textarea = mainTextareaRef.current;
        textarea.focus();
        const cursorPosition = nextContent.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [createHistorySnapshot, draft, handleSaveChapterDraft, selectedChapter, selectedHistoryEntry]);

  const applyAISuggestion = useCallback(
    (suggestion: AISuggestion) => {
      if (!selectedChapter) return;

      const textarea = mainTextareaRef.current;
      if (!textarea) return;

      const replacement = suggestion.body;
      const { selectionStart, selectionEnd } = textarea;
      const before = draft.slice(0, selectionStart);
      const after = draft.slice(selectionEnd);
      const newContent = `${before}${replacement}${after}`;

      createHistorySnapshot('restore', {
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

      createHistorySnapshot('manual', {
        content: newContent,
        label: `${SUGGESTION_CONFIG[activeSuggestionType].label}適用`,
        force: true,
      });

      setTimeout(() => {
        if (mainTextareaRef.current) {
          const cursorPosition = selectionStart + replacement.length;
          mainTextareaRef.current.focus();
          mainTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
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
    // chapter.charactersは文字列配列（キャラクター名）として保存されている
    const characters = chapter.characters && chapter.characters.length > 0
      ? chapter.characters.join(', ')
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

  // カスタムプロンプトの構築（メモ化）
  const buildCustomPrompt = useCallback((currentChapter: { title: string; summary: string }, chapterDetails: { characters: string; setting: string; mood: string; keyEvents: string }, projectCharacters: string) => {
    const basePrompt = `以下の章の情報を基に、会話を重視し、読者に臨場感のある魅力的な小説の章を執筆してください。

【最重要：章情報】
章タイトル: ${currentChapter.title}
章の概要: ${currentChapter.summary}

【章の詳細設定】
設定・場所: ${chapterDetails.setting}
雰囲気・ムード: ${chapterDetails.mood}
重要な出来事: ${chapterDetails.keyEvents}
登場キャラクター: ${chapterDetails.characters}

【プロジェクト基本情報】
作品タイトル: ${currentProject?.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}
サブジャンル: ${currentProject?.subGenre || '未設定'}
ターゲット読者: ${currentProject?.targetReader || '未設定'}
プロジェクトテーマ: ${currentProject?.projectTheme || '未設定'}

【プロット基本設定】
テーマ: ${currentProject?.plot?.theme || '未設定'}
舞台設定: ${currentProject?.plot?.setting || '未設定'}
フック: ${currentProject?.plot?.hook || '未設定'}
主人公の目標: ${currentProject?.plot?.protagonistGoal || '未設定'}
主要な障害: ${currentProject?.plot?.mainObstacle || '未設定'}

【キャラクター情報】
${projectCharacters}

【執筆指示】
1. **文字数**: 3000-4000文字程度で執筆してください
2. **会話重視**: キャラクター同士の会話を豊富に含め、自然で生き生きとした対話を心がけてください
3. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
4. **感情表現**: キャラクターの心理状態や感情を丁寧に描写してください
5. **五感の活用**: 視覚、聴覚、触覚、嗅覚、味覚を意識した描写を入れてください
6. **章の目的**: 章の概要に沿った内容で、物語を前進させてください
7. **一貫性**: キャラクターの性格や設定を一貫して保ってください

【文体の特徴】
- 現代的な日本語小説の文体
- 読み手が感情移入しやすい表現
- 適度な改行と段落分け（会話の前後、場面転換時など）
- 会話は「」で囲み、自然な話し方で
- 情景描写は詩的で美しい表現を
- 改行は自然な文章の流れに従って適切に行う

【改行の指示】
- 会話の前後で改行する
- 場面転換時に改行する
- 段落の区切りで改行する
- 長い文章は読みやすく適度に改行する
- 改行は通常の改行文字（\n）で表現する

章の内容を執筆してください。`;

    if (useCustomPrompt && customPrompt.trim()) {
      return `${basePrompt}\n\n【カスタム執筆指示】\n${customPrompt}`;
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
      const projectCharacters = currentProject.characters.map((char: { name: string; bio?: string; description?: string }) => 
        `${char.name}: ${char.bio || char.description || '説明なし'}`
      ).join('\n');

      // プロンプトを構築
      const prompt = buildCustomPrompt(currentChapter, chapterDetails, projectCharacters);

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
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
      // const chapterDetails = getChapterDetails(currentChapter);
      
      const prompt = `以下の章の続きを執筆してください。

【章情報】
章タイトル: ${currentChapter?.title}
章の概要: ${currentChapter?.summary}

【現在の文章】
${draft}

【続きの執筆指示】
- 上記の文章の自然な続きを書いてください
- 会話を重視し、臨場感のある描写を心がけてください
- 1000-1500文字程度で続きを執筆してください
- 章の目的に沿った内容で物語を前進させてください
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

続きを執筆してください：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
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
      const prompt = `以下の文章の描写をより詳細で魅力的に強化してください。

【現在の文章】
${draft}

【強化指示】
- 情景描写をより詳細に
- キャラクターの感情表現を豊かに
- 五感を使った表現を追加
- 会話の自然さを保ちつつ、心理描写を強化
- 文章の長さは元の1.2-1.5倍程度に
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

強化された文章：`;

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
      const prompt = `以下の文章の文体を調整し、より読みやすく魅力的にしてください。

【現在の文章】
${draft}

【調整指示】
- 文章のリズムを整える
- 冗長な表現を簡潔に
- 読みやすい改行と段落分け
- 自然で現代的な日本語に
- 内容は変えずに表現のみ改善
- 改行は通常の改行文字（\n）で表現してください

調整された文章：`;

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
      const prompt = `以下の文章を簡潔にまとめ、冗長な部分を削除してください。

【現在の文章】
${draft}

【短縮指示】
- 重要な内容は保持
- 冗長な表現を削除
- 文章の流れを保つ
- 約70-80%の長さに短縮
- 読みやすさを維持
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

短縮された文章：`;

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
      const fullPrompt = `以下のプロジェクト全体の情報を基に、一貫性のある魅力的な小説の全章を執筆してください。

【プロジェクト基本情報】
作品タイトル: ${projectInfo.title}
メインジャンル: ${projectInfo.mainGenre}
サブジャンル: ${projectInfo.subGenre}
ターゲット読者: ${projectInfo.targetReader}
プロジェクトテーマ: ${projectInfo.projectTheme}

【プロット基本設定】
テーマ: ${plotInfo.theme}
舞台設定: ${plotInfo.setting}
フック: ${plotInfo.hook}
主人公の目標: ${plotInfo.protagonistGoal}
主要な障害: ${plotInfo.mainObstacle}

【物語構造の詳細】
${structureDetails}

【キャラクター情報】
${charactersInfo}

【章立て構成】
${chaptersInfo}

【執筆指示】
1. **全章の一貫性**: キャラクターの性格、設定、物語の流れを全章を通して一貫させてください
2. **文字数**: 各章3000-4000文字程度で執筆してください
3. **会話重視**: キャラクター同士の会話を豊富に含め、自然で生き生きとした対話を心がけてください
4. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
5. **感情表現**: キャラクターの心理状態や感情を丁寧に描写してください
6. **五感の活用**: 視覚、聴覚、触覚、嗅覚、味覚を意識した描写を入れてください
7. **章の目的**: 各章の概要に沿った内容で、物語を前進させてください
8. **文体の統一**: 現代的な日本語小説の文体で、読み手が感情移入しやすい表現を使用してください

【出力形式】
以下の形式で各章の草案を出力してください：

=== 第1章: [章タイトル] ===
[章の草案内容]

=== 第2章: [章タイトル] ===
[章の草案内容]

[以下、全章分続く]

各章の草案を執筆してください。`;

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

  // テキストエリアの変更ハンドラー
  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
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
  };

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
      const prompt = `以下の章の草案を総合的に改善してください。

【章情報】
章タイトル: ${currentChapter?.title}
章の概要: ${currentChapter?.summary}

【現在の草案】
${draft}

【改善指示】
1. **描写の強化**
   - 情景描写をより詳細で魅力的に
   - キャラクターの感情表現を豊かに
   - 五感を使った表現を追加
   - 会話の自然さを保ちつつ、心理描写を強化

2. **文体の調整**
   - 文章のリズムを整える
   - 冗長な表現を簡潔に
   - 読みやすい改行と段落分け
   - 自然で現代的な日本語に

3. **文字数と内容**
   - 現在の文字数（${draft.length}文字）を維持または3,000-4,000文字程度に調整
   - 重要な内容は保持しつつ、表現を改善
   - 章の目的に沿った内容を維持

4. **改行の指示**
   - 適度な改行と段落分けを行ってください
   - 改行は通常の改行文字（\n）で表現してください

改善された草案：`;

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-emerald-500">
                  <PenTool className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  草案作成
                </h1>
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                章ごとに詳細な草案を作成し、物語を完成させましょう
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCreateManualBackup}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-['Noto_Sans_JP']"
              >
                <Save className="h-4 w-4" />
                <span>バックアップ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 統合AI生成状態バー */}
      {unifiedAIStatus.visible && unifiedAIStatus.tone && (
        <div className={`${AI_STATUS_STYLES[unifiedAIStatus.tone].container} border-b border-gray-200 dark:border-gray-700`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`${AI_STATUS_STYLES[unifiedAIStatus.tone].icon} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
                  <Sparkles className="h-4 w-4 animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${AI_STATUS_STYLES[unifiedAIStatus.tone].title} font-['Noto_Sans_JP']`}>
                    {unifiedAIStatus.title}
                  </p>
                  {unifiedAIStatus.detail && (
                    <p className={`mt-0.5 text-xs leading-relaxed ${AI_STATUS_STYLES[unifiedAIStatus.tone].detail} font-['Noto_Sans_JP']`}>
                      {unifiedAIStatus.detail}
                    </p>
                  )}
                </div>
              </div>
              {unifiedAIStatus.canCancel && (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-current hover:bg-opacity-10 transition-colors text-sm font-['Noto_Sans_JP'] flex-shrink-0"
                  aria-label="生成をキャンセル"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">キャンセル</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* メインエディタエリア */}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 章選択 */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 font-['Noto_Sans_JP']">
                        章を選択
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        ショートカット: Ctrl + ← / → で章を切り替え
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevChapter}
                        disabled={
                          !selectedChapter ||
                          currentProject.chapters.length === 0 ||
                          currentProject.chapters[0]?.id === selectedChapter
                        }
                        className="flex items-center space-x-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="前の章へ"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="font-['Noto_Sans_JP']">前の章</span>
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {currentChapterIndex >= 0
                          ? `第${currentChapterIndex + 1}章 / 全${currentProject.chapters.length}章`
                          : `全${currentProject.chapters.length}章`}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextChapter}
                        disabled={
                          !selectedChapter ||
                          currentProject.chapters.length === 0 ||
                          currentProject.chapters[currentProject.chapters.length - 1]?.id === selectedChapter
                        }
                        className="flex items-center space-x-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="次の章へ"
                      >
                        <span className="font-['Noto_Sans_JP']">次の章</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    {/* スクロール可能な章タブエリア */}
                    <div className="relative">
                      {/* 左スクロールボタン */}
                      {canScrollLeft && (
                        <button
                          type="button"
                          onClick={() => {
                            const container = chapterTabsContainerRef.current;
                            if (container) {
                              container.scrollBy({ left: -300, behavior: 'smooth' });
                            }
                          }}
                          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label="左にスクロール"
                        >
                          <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </button>
                      )}

                      {/* 右スクロールボタン */}
                      {canScrollRight && (
                        <button
                          type="button"
                          onClick={() => {
                            const container = chapterTabsContainerRef.current;
                            if (container) {
                              container.scrollBy({ left: 300, behavior: 'smooth' });
                            }
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label="右にスクロール"
                        >
                          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </button>
                      )}

                      <div
                        ref={chapterTabsContainerRef}
                        role="tablist"
                        aria-label="章一覧"
                        className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {currentProject.chapters.map((chapter, index) => {
                          const isSelected = selectedChapter === chapter.id;
                          const hasContent = Boolean(chapterDrafts[chapter.id] && chapterDrafts[chapter.id].trim());
                          return (
                            <button
                              key={chapter.id}
                              type="button"
                              data-chapter-id={chapter.id}
                              role="tab"
                              tabIndex={isSelected ? 0 : -1}
                              aria-selected={isSelected}
                              onClick={() => handleChapterSelect(chapter.id)}
                              className={`group flex min-w-[200px] flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 font-['Noto_Sans_JP'] ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-400/60 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                <span>{`第${index + 1}章`}</span>
                                {hasContent && (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    草案あり
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {chapter.title || `章 ${index + 1}`}
                              </div>
                              {chapter.summary && (
                                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 max-h-10 overflow-hidden">
                                  {chapter.summary}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 章数が多い場合のドロップダウン（モバイル表示） */}
                    {currentProject.chapters.length > 5 && (
                      <div className="mt-3 sm:hidden">
                        <select
                          value={selectedChapter || ''}
                          onChange={(e) => handleChapterSelect(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-['Noto_Sans_JP'] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">章を選択してください</option>
                          {currentProject.chapters.map((chapter, index) => (
                            <option key={chapter.id} value={chapter.id}>
                              第{index + 1}章: {chapter.title || `章 ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 章数が多い場合のデスクトップ用ドロップダウン */}
                    {currentProject.chapters.length > 8 && (
                      <div className="hidden sm:block mt-3">
                        <select
                          value={selectedChapter || ''}
                          onChange={(e) => handleChapterSelect(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-['Noto_Sans_JP'] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">章を選択してください（クイック選択）</option>
                          {currentProject.chapters.map((chapter, index) => (
                            <option key={chapter.id} value={chapter.id}>
                              第{index + 1}章: {chapter.title || `章 ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <select
                    value={selectedChapter || ''}
                    onChange={(e) => handleChapterSelect(e.target.value)}
                    className="sr-only"
                    aria-label="章を選択"
                  >
                    <option value="">章を選択してください</option>
                    {currentProject.chapters.map(chapter => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    {selectedChapter && currentChapter ? `${currentChapter.title} の草案` : '草案執筆'}
                  </h3>
                </div>

                {/* 章内容表示 */}
                {currentChapter && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                    {/* アコーディオンヘッダー */}
                    <button
                      type="button"
                      onClick={() => setIsChapterInfoCollapsed(prev => !prev)}
                      className="w-full p-4 flex items-start space-x-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] ${!isChapterInfoCollapsed ? 'mb-2' : ''}`}>
                            {currentChapter.title}
                          </h4>
                          {isChapterInfoCollapsed ? (
                            <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          )}
                        </div>
                        {!isChapterInfoCollapsed && (
                          <>
                            <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                              {currentChapter.summary}
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

                {/* メインテキストエリア */}
                <div
                  className={`rounded-lg min-h-[300px] border ${
                    isMainFocusMode
                      ? 'border-emerald-500/40 bg-gray-900 text-emerald-50'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  {selectedChapter ? (
                    <div className={`p-4 ${isMainFocusMode ? 'bg-gray-900/80 rounded-b-lg' : ''}`}>
                      <div
                        className={`${mainEditorContainerClass} rounded-lg transition-colors duration-200`}
                        style={isMainFocusMode ? { boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.25)' } : undefined}
                      >
                        <div className="flex">
                          {showMainLineNumbers && (
                            <div
                              ref={mainLineNumbersRef}
                              className={`pl-6 pr-3 py-5 md:pl-8 md:pr-4 md:py-6 select-none border-r ${
                                isMainFocusMode
                                  ? 'border-emerald-500/40 bg-gray-900/60 text-emerald-200/80'
                                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500'
                              }`}
                              style={{
                                height: mainTextareaHeight,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <div
                                ref={mainLineNumbersInnerRef}
                                style={{
                                  fontFamily: 'monospace',
                                  whiteSpace: 'pre',
                                  fontSize: mainFontSize,
                                  lineHeight: `${mainComputedLineHeight}px`,
                                  transform: 'translateY(0)',
                                  willChange: 'transform',
                                }}
                              >
                                {mainLineNumbersContent}
                              </div>
                            </div>
                          )}
                          <textarea
                            ref={mainTextareaRef}
                            value={draft}
                            onChange={handleDraftChange}
                            onScroll={handleMainTextareaScroll}
                            placeholder="ここに草案を執筆してください..."
                            className={`flex-1 px-6 py-5 md:px-8 md:py-6 border-0 bg-transparent focus:outline-none resize-none font-['Noto_Sans_JP'] ${
                              isMainFocusMode
                                ? 'text-emerald-50 placeholder-emerald-400/50'
                                : 'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
                            }`}
                            style={{
                              fontSize: mainFontSize,
                              lineHeight: `${mainComputedLineHeight}px`,
                              height: mainTextareaHeight,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 min-h-[300px] flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <PenTool className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium font-['Noto_Sans_JP'] mb-2">
                          章を選択してください
                        </p>
                        <p className="text-sm font-['Noto_Sans_JP']">
                          上部の章一覧から章を選択すると、ここで草案を執筆できます。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数: {wordCount.toLocaleString()}
                  </div>
                  {lastSavedAt && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                      最終保存: {formatTimestamp(lastSavedAt.getTime())}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* プライマリボタン */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedChapter) {
                          await handleSaveChapterDraft(selectedChapter, undefined, false);
                          setToastMessage('保存しました');
                          setTimeout(() => {
                            setToastMessage(null);
                          }, 3000);
                        }
                      }}
                      disabled={!selectedChapter}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-['Noto_Sans_JP'] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" />
                      <span className="hidden sm:inline">保存</span>
                    </button>
                    {selectedChapter && (
                      <button
                        type="button"
                        onClick={handleOpenViewer}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-sm font-['Noto_Sans_JP'] text-sm"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">プレビュー</span>
                      </button>
                    )}
                  </div>

                  {/* セカンダリボタン（ドロップダウンメニュー） */}
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="その他の操作"
                      aria-expanded={isMenuOpen}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {/* ドロップダウンメニュー */}
                    {isMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 fade-in">
                        {currentChapter && (
                          <button
                            type="button"
                            onClick={() => {
                              handleExportChapter();
                              setIsMenuOpen(false);
                            }}
                            disabled={!draft.trim()}
                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                          >
                            <Download className="h-4 w-4" />
                            章出力
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            openSecondaryTab('display');
                            setIsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                        >
                          <ListChecks className="h-4 w-4" />
                          表示設定
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openSecondaryTab('ai');
                            setIsMenuOpen(false);
                          }}
                          disabled={!selectedChapter}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                        >
                          <Wand2 className="h-4 w-4" />
                          AIアシスト
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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

      {showCustomPromptModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowCustomPromptModal(false)}
            />

            {/* モーダルコンテンツ */}
            <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <PenTool className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      カスタムプロンプト設定
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      執筆スタイルをカスタマイズできます
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCustomPromptModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* モーダルボディ */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* カスタムプロンプト使用の切り替え */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="useCustomPrompt"
                      checked={useCustomPrompt}
                      onChange={(e) => setUseCustomPrompt(e.target.checked)}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="useCustomPrompt"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']"
                    >
                      カスタムプロンプトを使用する
                    </label>
                  </div>

                  {/* カスタムプロンプト入力エリア */}
                  {useCustomPrompt && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                          カスタム執筆指示
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                          基本のプロンプトに追加したい執筆指示を記述してください。例：「詩的な表現を多用する」「一人称視点で執筆する」「短編小説風の文体にする」など
                        </p>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder={'例：\n• 詩的な表現を多用し、美しい情景描写を心がける\n• 一人称視点で主人公の内面を深く描写する\n• 短編小説風の簡潔で印象的な文体にする\n• 会話は最小限に抑え、心理描写を重視する\n• ミステリー要素を織り交ぜ、読者の興味を引く展開にする'}
                          className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-['Noto_Sans_JP'] leading-relaxed"
                          style={{ lineHeight: '1.6' }}
                        />
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        文字数: {customPrompt.length.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* プレビューエリア */}
                  {useCustomPrompt && customPrompt.trim() && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        プロンプトプレビュー
                      </h4>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                          【基本プロンプト】<br />
                          以下の章の情報を基に、会話を重視し、読者に臨場感のある魅力的な小説の章を執筆してください。<br /><br />
                          【章情報・プロジェクト情報・キャラクター情報・執筆指示】<br />
                          （省略）<br /><br />
                          【カスタム執筆指示】<br />
                          {customPrompt}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* モーダルフッター */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {useCustomPrompt ? 'カスタムプロンプトが有効です' : 'デフォルトプロンプトを使用します'}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setCustomPrompt('');
                      setUseCustomPrompt(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                  >
                    リセット
                  </button>
                  <button
                    onClick={() => setShowCustomPromptModal(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    保存して閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                              {currentChapter.summary}
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
                    className={`${isVerticalWriting ? 'h-[600px]' : 'h-[400px]'} w-full p-4 border-0 rounded-lg bg-transparent text-gray-900 dark:text-white font-['Noto_Sans_JP'] leading-relaxed overflow-auto whitespace-pre-wrap`}
                    style={{
                      lineHeight: '1.6',
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

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 fade-in">
          <div className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-sm font-['Noto_Sans_JP']">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="flex-shrink-0 p-1 hover:bg-emerald-600 rounded transition-colors"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 生成完了通知 */}
      {showCompletionToast && (
        <div className="fixed top-4 right-4 z-50 fade-in">
          <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-sm font-['Noto_Sans_JP']">{showCompletionToast}</span>
            <button
              onClick={() => setShowCompletionToast(null)}
              className="flex-shrink-0 p-1 hover:bg-blue-600 rounded transition-colors"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};