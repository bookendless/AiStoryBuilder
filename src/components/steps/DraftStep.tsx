import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { PenTool, BookOpen, ChevronDown, ChevronUp, AlignLeft, AlignJustify, Settings, Save } from 'lucide-react';
import { databaseService } from '../../services/databaseService';
import {
  HISTORY_AUTO_SAVE_DELAY,
  HISTORY_MAX_ENTRIES,
  HISTORY_TYPE_LABELS,
  MODAL_DEFAULT_FONT_SIZE,
  MODAL_DEFAULT_LINE_HEIGHT,
  MODAL_TEXTAREA_DEFAULT_HEIGHT,
  MODAL_TEXTAREA_MAX_HEIGHT,
  MODAL_TEXTAREA_MIN_HEIGHT,
} from './draft/constants';
// ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行
import { DisplaySettingsPanel } from './draft/DisplaySettingsPanel';
import { Toast } from './draft/Toast';
import { BackupDescriptionModal } from './draft/BackupDescriptionModal';
import { AIStatusBar } from './draft/AIStatusBar';
import { ChapterTabs } from './draft/ChapterTabs';
import { MainEditor, type MainEditorHandle } from './draft/MainEditor';
import { ForeshadowingPanel } from './draft/ForeshadowingPanel';
// AILogPanel is used in ToolsSidebar, reference removed from here
import { useChapterDraft } from './draft/hooks/useChapterDraft';
import { useExport } from './draft/hooks/useExport';
// AI生成機能はToolsSidebarのDraftAssistantPanelに移行
// テキスト選択機能は削除され、AI機能はToolsSidebarに移行
import { useAllChaptersGeneration } from './draft/hooks/useAllChaptersGeneration';
import { useToast } from '../Toast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
// AILoadingIndicator is used elsewhere
import { StepNavigation } from '../common/StepNavigation';
import { Step } from '../../App';
import type {
  AIStatusTone,
  ChapterHistoryEntry,
  HistoryEntryType,
} from './draft/types';


interface DraftStepProps {
  onNavigateToStep?: (step: Step) => void;
}

export const DraftStep: React.FC<DraftStepProps> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject, createManualBackup } = useProject();
  const { isConfigured, settings } = useAI();
  const { showError, showSuccess, showWarning } = useToast();
  const { handleDatabaseError } = useErrorHandler();

  // State variables
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState('');
  const [isVerticalWriting, setIsVerticalWriting] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [chapterHistories, setChapterHistories] = useState<Record<string, ChapterHistoryEntry[]>>({});

  // バックアップモーダル用の状態
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isChapterInfoCollapsed, setIsChapterInfoCollapsed] = useState(true);
  const [mainTextareaHeight, setMainTextareaHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      // 画面の高さに応じて適切な初期値を設定（モバイル: 300px, デスクトップ: 420px）
      return window.innerHeight < 768 ? 300 : MODAL_TEXTAREA_DEFAULT_HEIGHT;
    }
    return MODAL_TEXTAREA_DEFAULT_HEIGHT;
  });
  const [mainFontSize, setMainFontSize] = useState<number>(MODAL_DEFAULT_FONT_SIZE);
  const [mainLineHeight, setMainLineHeight] = useState<number>(MODAL_DEFAULT_LINE_HEIGHT);

  // ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行

  // 伏線パネル用の状態
  const [isForeshadowingPanelCollapsed, setIsForeshadowingPanelCollapsed] = useState(true);

  // 表示設定ポップオーバー用の状態
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);

  // トースト通知用の状態
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  // 章の草案管理フック
  const {
    draft,
    setDraft,
    chapterDrafts,
    setChapterDrafts,
    lastSavedAt,
    handleSaveChapterDraft: handleSaveChapterDraftFromHook,
  } = useChapterDraft({
    currentProject,
    updateProject,
    selectedChapter,
    onSaveError: (error) => {
      console.error('章草案保存エラー:', error);
    },
    onToastMessage: setToastMessage,
  });

  // エクスポート機能
  const { exportChapter } = useExport({
    currentProject,
    chapterDrafts,
    onSuccess: showSuccess,
    onError: (message, title) => {
      showError(message, 7000, { title });
    },
    onWarning: (message, title) => {
      showWarning(message, 5000, { title });
    },
  });


  // 現在の章を取得（メモ化）
  const currentChapter = useMemo(() => {
    if (!selectedChapter || !currentProject) return null;
    return currentProject.chapters.find(c => c.id === selectedChapter) || null;
  }, [selectedChapter, currentProject]);

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


  const [showCompletionToast, setShowCompletionToast] = useState<string | null>(null);

  const mainEditorRef = useRef<MainEditorHandle | null>(null);
  const historyAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSnapshotContentRef = useRef<string>('');
  const historyLoadedChaptersRef = useRef<Set<string>>(new Set());
  const verticalPreviewRef = useRef<HTMLDivElement | null>(null);
  const displaySettingsRef = useRef<HTMLDivElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        displaySettingsRef.current && !displaySettingsRef.current.contains(event.target as Node) &&
        settingsBtnRef.current && !settingsBtnRef.current.contains(event.target as Node)
      ) {
        setIsDisplaySettingsOpen(false);
      }
    };
    if (isDisplaySettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDisplaySettingsOpen]);

  useEffect(() => {
    historyLoadedChaptersRef.current.clear();
    setChapterHistories({});
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

      } catch (error) {
        console.error('章履歴の保存に失敗しました:', error);
        return false;
      }

      return entryWasAdded;
    },
    [currentProject, selectedChapter, draft, chapterHistories]
  );

  // テキスト選択機能は削除され、AI機能はToolsSidebarに移行

  // 全章生成フック
  const {
    isGeneratingAllChapters,
    generationProgress,
    generationStatus,
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
    setShowCompletionToast,
  });

  const isGenerating = isGeneratingAllChapters;

  useEffect(() => {
    setIsChapterInfoCollapsed(false);

    // sessionStorageに保存してDraftAssistantPanelと同期
    if (currentProject && selectedChapter) {
      sessionStorage.setItem(`draftSelectedChapter_${currentProject.id}`, selectedChapter);
      // CustomEventを発火してDraftAssistantPanelに通知
      window.dispatchEvent(new CustomEvent('draftChapterSelected', { detail: { chapterId: selectedChapter, projectId: currentProject.id, source: 'draftStep' } }));
    }
  }, [selectedChapter, currentProject]);

  // 初期化時にsessionStorageから読み込む
  useEffect(() => {
    if (currentProject && !selectedChapter && currentProject.chapters.length > 0) {
      const savedChapterId = sessionStorage.getItem(`draftSelectedChapter_${currentProject.id}`);
      if (savedChapterId && currentProject.chapters.some(c => c.id === savedChapterId)) {
        setSelectedChapter(savedChapterId);
      } else if (currentProject.chapters.length > 0) {
        // 保存された章がない場合は最初の章を選択
        setSelectedChapter(currentProject.chapters[0].id);
      }
    }
  }, [currentProject]);

  // DraftAssistantPanelからの章選択変更を監視して同期
  useEffect(() => {
    if (!currentProject) return;

    const handleChapterSelected = async (e: Event) => {
      const customEvent = e as CustomEvent<{ chapterId: string; projectId: string; source?: string }>;
      // 自分が発火したイベントは無視
      if (customEvent.detail.source === 'draftStep') return;

      if (customEvent.detail.projectId === currentProject.id && customEvent.detail.chapterId !== selectedChapter) {
        // 現在の章の内容を保存
        if (selectedChapter) {
          await handleSaveChapterDraftFromHook(selectedChapter, draft);
        }
        // 新しい章を設定
        setSelectedChapter(customEvent.detail.chapterId);
      }
    };

    window.addEventListener('draftChapterSelected', handleChapterSelected);

    return () => {
      window.removeEventListener('draftChapterSelected', handleChapterSelected);
    };
  }, [currentProject, selectedChapter, draft, handleSaveChapterDraftFromHook]);


  // データ管理側のバックアップ機能を利用
  const handleCreateManualBackup = async () => {
    if (!currentProject) return;

    // 現在の草案状態を保存してからバックアップを作成
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }

    // バックアップモーダルを表示
    setShowBackupModal(true);
  };

  // バックアップ作成の実行
  const handleConfirmBackup = async (description: string) => {
    if (!currentProject) return;

    try {
      await createManualBackup(description);
      setToastMessage('バックアップを作成しました');
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (error) {
      handleDatabaseError(error, 'バックアップ作成', {
        title: 'バックアップエラー',
      });
    }
  };

  // 章の草案管理はuseChapterDraftフックで処理される

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

  // アンマウント時のクリーンアップは上記のuseEffectのreturnで処理されるため削除

  useEffect(() => {
    if (!selectedChapter) return;
    const entries = chapterHistories[selectedChapter];
    if (entries && entries[0]) {
      lastSnapshotContentRef.current = entries[0].content;
    }
  }, [chapterHistories, selectedChapter]);

  // 章が変更されたときに提案状態をクリア（フック内で処理されるため不要）
  // useEffect(() => {
  //   handleClearSuggestionState();
  // }, [selectedChapter, handleClearSuggestionState]);

  // 章選択ハンドラー
  const handleChapterSelect = async (chapterId: string) => {
    // 章が変更される場合は、進行中の生成をキャンセル
    if (selectedChapter !== chapterId && (isGenerating || isGeneratingAllChapters)) {
      handleCancelAllGeneration();
    }

    // 現在の章の内容を保存（章が選択されている場合）
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }

    // 選択された章を設定（草案はuseEffectで適切に初期化される）
    setSelectedChapter(chapterId);

    // sessionStorageに保存してDraftAssistantPanelと同期
    if (currentProject) {
      sessionStorage.setItem(`draftSelectedChapter_${currentProject.id}`, chapterId);
      // CustomEventを発火してDraftAssistantPanelに通知
      window.dispatchEvent(new CustomEvent('draftChapterSelected', { detail: { chapterId, projectId: currentProject.id, source: 'draftStep' } }));
    }
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

  // ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行

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


  const currentChapterIndex = useMemo(() => {
    if (!currentProject || !selectedChapter) return -1;
    return currentProject.chapters.findIndex(chapter => chapter.id === selectedChapter);
  }, [currentProject, selectedChapter]);

  // 章草案保存ハンドラー（フックから取得した関数をエイリアス）
  const handleSaveChapterDraft = handleSaveChapterDraftFromHook;

  // 文字数カウント（メモ化）
  const wordCount = useMemo(() => draft.length, [draft]);

  // エクスポートハンドラー（フックから取得した関数を使用）
  const handleExportChapter = useCallback(async () => {
    if (!currentChapter) return;
    await exportChapter(currentChapter.title, draft);
  }, [currentChapter, draft, exportChapter]);

  // 自動保存用のタイマー
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // 自動保存タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, []);

  // アンマウント時の保存処理はuseChapterDraftフック内で処理される

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

  // 統合されたキャンセル処理（全章生成のキャンセル）
  const handleCancelAllGeneration = useCallback(() => {
    // 全章生成をキャンセル
    handleCancelAllChaptersGeneration();

    setToastMessage('生成をキャンセルしました');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, [handleCancelAllChaptersGeneration]);

  // 章全体改善とSelf-RefineはuseAIGenerationフックに移動済み

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

    // 個別のAI生成はDraftAssistantPanelで管理されるため、ここでは全章生成のみ
    return { visible: false };
  }, [isGeneratingAllChapters, generationStatus, generationProgress]);

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
    // ステップナビゲーション用のハンドラー
    const handlePreviousStep = () => {
      if (onNavigateToStep) {
        onNavigateToStep('chapter');
      }
    };

    const handleNextStep = () => {
      if (onNavigateToStep) {
        onNavigateToStep('review');
      }
    };

    return (
      <div>
        {/* ステップナビゲーション */}
        <StepNavigation
          currentStep="draft"
          onPrevious={handlePreviousStep}
          onNext={handleNextStep}
        />

        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
            草案作成
          </h2>
          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
            草案を作成するには、まず章立てを完成させてください。
          </p>
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-6">
              「章立て」ステップで章を作成してから戻ってきてください。
            </p>
            {onNavigateToStep && (
              <button
                onClick={() => onNavigateToStep('chapter')}
                className="px-6 py-3 bg-gradient-to-r from-blue-400 to-cyan-500 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
              >
                章立てステップに移動
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ステップナビゲーション用のハンドラー
  const handlePreviousStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('chapter');
    }
  };

  const handleNextStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('review');
    }
  };

  return (
    <div>
      {/* ステップナビゲーション */}
      <StepNavigation
        currentStep="draft"
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
      />

      {/* タイトルセクション */}
      <div className="mb-6 sm:mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex-shrink-0">
                <PenTool className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                草案作成
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-2 truncate">
              章ごとに詳細な草案を作成し、物語を完成させましょう
            </p>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto flex-shrink-0">
            <button
              type="button"
              onClick={handleCreateManualBackup}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-['Noto_Sans_JP']"
            >
              <Save className="h-4 w-4" />
              <span>バックアップ</span>
            </button>
          </div>
        </div>
      </div>

      {/* 統合AI生成状態バー */}
      <AIStatusBar
        visible={unifiedAIStatus.visible}
        title={unifiedAIStatus.title || ''}
        detail={unifiedAIStatus.detail}
        tone={unifiedAIStatus.tone}
        canCancel={unifiedAIStatus.canCancel}
        onCancel={handleCancelAllGeneration}
      />

      {/* メインコンテンツ */}
      <div className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* メインエディタエリア - サイドバー削除により最大化 */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* 章選択 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden p-4 sm:p-6">
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

            {/* 章情報と表示設定を統合したアコーディオンパネル */}
            {currentChapter && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsChapterInfoCollapsed(prev => !prev)}
                    className="flex-1 p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                          章情報
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">
                          {currentChapter.title}
                        </p>
                      </div>
                    </div>
                    {isChapterInfoCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  <div className="pr-3">
                    <button
                      ref={settingsBtnRef}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsDisplaySettingsOpen(prev => !prev); }}
                      className={`p-2 rounded-lg transition-colors ${isDisplaySettingsOpen ? 'bg-ai-100 dark:bg-ai-900/30 text-ai-600 dark:text-ai-400' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      title="表示設定"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {!isChapterInfoCollapsed && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    {/* 章情報セクション */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">
                          章情報
                        </h5>
                      </div>
                      <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                        {(() => {
                          if (!currentChapter.summary || !currentProject) {
                            return currentChapter.summary || '';
                          }
                          let summary = currentChapter.summary;
                          currentProject.characters.forEach(character => {
                            const regex = new RegExp(`\\b${character.id}\\b`, 'g');
                            summary = summary.replace(regex, character.name);
                          });
                          return summary;
                        })()}
                      </p>
                      {(() => {
                        const chapterDetails = getChapterDetails(currentChapter);
                        const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');
                        if (!hasDetails) return null;
                        return (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <div className="grid grid-cols-1 gap-2 text-xs">
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
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                )}
              </div>
            )}

            <MainEditor
              ref={mainEditorRef}
              selectedChapterId={selectedChapter}
              currentChapter={currentChapter}
              draft={draft}
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

                  autoSaveTimeoutRef.current = window.setTimeout(() => {
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
              isVerticalWriting={isVerticalWriting}
              isZenMode={isZenMode}
              onExitZenMode={() => setIsZenMode(false)}
            />

            {/* 伏線パネル */}
            {selectedChapter && !isZenMode && (
              <ForeshadowingPanel
                currentChapterId={selectedChapter}
                isCollapsed={isForeshadowingPanelCollapsed}
                onToggleCollapse={() => setIsForeshadowingPanelCollapsed(prev => !prev)}
              />
            )}
          </div>

          {/* ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行 */}
        </div>
      </div>


      {/* バックアップ説明モーダル */}
      <BackupDescriptionModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onConfirm={handleConfirmBackup}
        defaultDescription="草案作業時のバックアップ"
      />

      {/* フルスクリーンプレビュー */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-8 h-8 rounded-full flex items-center justify-center">
                <PenTool className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  {currentChapter ? `${currentChapter.title} のプレビュー` : '草案プレビュー'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {modalDraft.length.toLocaleString()} 文字
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
                className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-['Noto_Sans_JP'] text-sm"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>閉じる</span>
              </button>
            </div>
          </div>

          {/* テキストプレビュー領域（フルスクリーン） */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
            <div className="h-full w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 overflow-hidden">
              <div
                ref={verticalPreviewRef}
                className={`h-full w-full p-6 sm:p-8 lg:p-12 ${isVerticalWriting ? 'font-serif-jp' : "font-['Noto_Sans_JP']"} text-gray-900 dark:text-white leading-relaxed overflow-auto whitespace-pre-wrap`}
                style={{
                  lineHeight: isVerticalWriting ? '2.2' : '2.0',
                  letterSpacing: isVerticalWriting ? '0.05em' : '0.02em',
                  fontSize: isVerticalWriting ? '1.125rem' : '1rem',
                  writingMode: isVerticalWriting ? 'vertical-rl' : 'horizontal-tb',
                  textOrientation: isVerticalWriting ? 'upright' : 'mixed',
                }}
              >
                {modalDraft || (
                  <div className="text-gray-400 dark:text-gray-500 italic text-center mt-20">
                    草案がまだ作成されていません。メインエディタで執筆を開始してください。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


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

      {/* 表示設定ポップオーバー（portal: overflow-hidden を回避） */}
      {isDisplaySettingsOpen && settingsBtnRef.current && ReactDOM.createPortal(
        <div
          ref={displaySettingsRef}
          className="fixed z-[200] w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4"
          style={{
            top: settingsBtnRef.current.getBoundingClientRect().bottom + 4,
            right: window.innerWidth - settingsBtnRef.current.getBoundingClientRect().right,
          }}
        >
          <DisplaySettingsPanel
            mainFontSize={mainFontSize}
            setMainFontSize={setMainFontSize}
            mainLineHeight={mainLineHeight}
            setMainLineHeight={setMainLineHeight}
            mainTextareaHeight={mainTextareaHeight}
            adjustMainTextareaHeight={adjustMainTextareaHeight}
            setMainTextareaHeight={setMainTextareaHeight}
            handleResetDisplaySettings={() => {
              setMainFontSize(MODAL_DEFAULT_FONT_SIZE);
              setMainLineHeight(MODAL_DEFAULT_LINE_HEIGHT);
              setMainTextareaHeight(MODAL_TEXTAREA_DEFAULT_HEIGHT);
            }}
            mainControlButtonBase={mainControlButtonBase}
            mainControlButtonActive={mainControlButtonActive}
            isVerticalWriting={isVerticalWriting}
            setIsVerticalWriting={setIsVerticalWriting}
            isZenMode={isZenMode}
            setIsZenMode={setIsZenMode}
          />
        </div>,
        document.body
      )}
    </div>
  );
};