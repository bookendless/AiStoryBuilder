import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Plus, Search, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { Chapter } from '../../contexts/ProjectContext';
import { useProject } from '../../contexts/useProject';
import { useAI } from '../../contexts/useAI';
import { useToast } from '../useToast';
import { ChapterFormModal } from './chapter/ChapterFormModal';
import { ChapterHistoryModal } from './chapter/ChapterHistoryModal';
import { ChapterList } from './chapter/ChapterList';
import { ChapterEnhanceModal, EnhanceResultPayload } from './chapter/ChapterEnhanceModal';
import { ChapterSplitPreview } from './chapter/ChapterSplitPreview';
import { ChapterDraftSplitModal } from './chapter/ChapterDraftSplitModal';
import { ChapterHistory, ChapterFormData } from './chapter/types';
import { StepNavigation } from '../common/StepNavigation';
import { Step } from '../../App';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  saveChapterSnapshot,
  getChapterSnapshots,
  ChapterHistorySource,
} from '../../services/chapterHistoryService';
import {
  isSummaryStale,
  computeSummarySourceHash,
  SUMMARY_SOURCE_UNVERIFIED,
} from '../../services/summary/freshness';
import { refreshChapterSummary, RefreshedSummary } from '../../services/summary/refreshChapterSummary';
import { createSummaryRunner } from '../../services/summary/createSummaryRunner';

interface ChapterStepProps {
  onNavigateToStep?: (step: Step) => void;
}

export const ChapterStep: React.FC<ChapterStepProps> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject, deleteChapter } = useProject();
  const { settings: aiSettings, isConfigured } = useAI();
  const { showSuccess, showError } = useToast();

  // あらすじ更新は数十秒かかりうるため、完了時は「その時点で最新の」プロジェクトへ反映する
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  // 状態管理
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChapterFormData>({
    title: '',
    summary: '',
    characters: [],
    setting: '',
    mood: '',
    keyEvents: [],
  });
  const [editFormData, setEditFormData] = useState<ChapterFormData>({
    title: '',
    summary: '',
    characters: [],
    setting: '',
    mood: '',
    keyEvents: [],
  });
  // 折りたたみ機能の状態管理
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // 検索機能の状態管理
  const [searchQuery, setSearchQuery] = useState('');

  // ジャンプ機能用のref
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 履歴管理の状態（サービスから取得、ローカルは表示用stateのみ）
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // 確認ダイアログの状態
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    chapterId: string | null;
    chapterTitle: string;
  }>({
    isOpen: false,
    chapterId: null,
    chapterTitle: '',
  });

  // AI強化モーダルの状態
  const [enhanceModalState, setEnhanceModalState] = useState<{
    isOpen: boolean;
    chapter: Chapter | null;
    chapterIndex: number;
  }>({
    isOpen: false,
    chapter: null,
    chapterIndex: -1,
  });

  // AI強化の生成結果を章ごとに保持（モーダルを閉じても再オープンで確認できるようにする）
  const [enhanceResultCache, setEnhanceResultCache] = useState<Record<string, EnhanceResultPayload>>({});

  // 現在開いている強化モーダルの対象章ID（生成完了が別フレーム/アンマウント後でも開閉判定に使う）
  const openEnhanceChapterIdRef = useRef<string | null>(null);
  useEffect(() => {
    openEnhanceChapterIdRef.current = enhanceModalState.isOpen ? enhanceModalState.chapter?.id ?? null : null;
  }, [enhanceModalState]);

  // 分割プレビューモーダルの状態
  const [splitPreviewState, setSplitPreviewState] = useState<{
    isOpen: boolean;
    chapter: Chapter | null;
    chapterIndex: number;
  }>({
    isOpen: false,
    chapter: null,
    chapterIndex: -1,
  });

  // 本文分割モーダル（draft を持つ章の逐語分割）の状態
  const [draftSplitState, setDraftSplitState] = useState<{
    isOpen: boolean;
    chapter: Chapter | null;
    chapterIndex: number;
  }>({
    isOpen: false,
    chapter: null,
    chapterIndex: -1,
  });

  // ユーティリティ関数
  const handleCharacterToggle = (characterId: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        characters: prev.characters.includes(characterId)
          ? prev.characters.filter(id => id !== characterId)
          : [...prev.characters, characterId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        characters: prev.characters.includes(characterId)
          ? prev.characters.filter(id => id !== characterId)
          : [...prev.characters, characterId]
      }));
    }
  };

  const handleKeyEventChange = (index: number, value: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.map((event, i) => i === index ? value : event)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.map((event, i) => i === index ? value : event)
      }));
    }
  };

  const handleAddKeyEvent = (isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: [...prev.keyEvents, '']
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: [...prev.keyEvents, '']
      }));
    }
  };

  const handleRemoveKeyEvent = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.filter((_, i) => i !== index)
      }));
    }
  };


  const handleAddChapter = () => {
    if (!currentProject || !formData.title.trim()) return;

    const newChapter = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      summary: formData.summary.trim(),
      characters: formData.characters,
      setting: formData.setting.trim(),
      mood: formData.mood.trim(),
      keyEvents: formData.keyEvents,
    };

    updateProject({
      chapters: [...currentProject.chapters, newChapter],
    });

    // 新規作成時も履歴を保存
    saveChapterHistory(newChapter);

    setFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowAddForm(false);
  };

  const handleCloseModal = useCallback(() => {
    setFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowAddForm(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowEditForm(false);
    setEditingId(null);
  }, []);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddForm) {
          handleCloseModal();
        } else if (showEditForm) {
          handleCloseEditModal();
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        }
      }
    };

    if (showAddForm || showEditForm || showHistoryModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showAddForm, showEditForm, showHistoryModal, handleCloseModal, handleCloseEditModal]);

  const handleDeleteChapter = (id: string) => {
    if (!currentProject) return;
    const chapter = currentProject.chapters.find(c => c.id === id);
    if (!chapter) return;

    setConfirmDialogState({
      isOpen: true,
      chapterId: id,
      chapterTitle: chapter.title,
    });
  };

  const handleConfirmDelete = () => {
    if (!currentProject || !confirmDialogState.chapterId) return;
    deleteChapter(confirmDialogState.chapterId);
    showSuccess('章を削除しました');
    setConfirmDialogState({
      isOpen: false,
      chapterId: null,
      chapterTitle: '',
    });
  };

  const handleEditChapter = (chapter: { id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }) => {
    setEditingId(chapter.id);
    setEditFormData({
      title: chapter.title,
      summary: chapter.summary,
      characters: chapter.characters || [],
      setting: chapter.setting || '',
      mood: chapter.mood || '',
      keyEvents: chapter.keyEvents || [],
    });
    setShowEditForm(true);
  };


  const handleUpdateChapter = () => {
    if (!currentProject || !editingId || !editFormData.title.trim()) return;

    // 更新前の状態を履歴に保存
    const oldChapter = currentProject.chapters.find(c => c.id === editingId);
    if (oldChapter) {
      saveChapterHistory(oldChapter);
    }

    const nextSummary = editFormData.summary.trim();
    const updatedChapter = {
      id: editingId,
      title: editFormData.title.trim(),
      summary: nextSummary,
      characters: editFormData.characters,
      setting: editFormData.setting.trim(),
      mood: editFormData.mood.trim(),
      keyEvents: editFormData.keyEvents,
      // あらすじを書き換えたときだけ、その時点の本文に対して確定したものとして印を付け直す。
      // 雰囲気だけ直した場合に印を更新すると、古いままのあらすじが「最新」に化ける
      ...(nextSummary !== oldChapter?.summary && oldChapter?.draft?.trim()
        ? { summarySourceHash: computeSummarySourceHash(oldChapter.draft) }
        : {}),
    };

    updateProject({
      chapters: currentProject.chapters.map(c =>
        c.id === editingId
          ? {
            ...c,
            ...updatedChapter
          }
          : c
      ),
    });

    handleCloseEditModal();
  };


  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    setDraggedChapterId(chapterId);
    e.dataTransfer.setData('text/plain', chapterId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedChapterId(null);
  };

  const handleDrop = (e: React.DragEvent, dropChapterId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // dataTransferからドラッグIDを取得（fallbackとしてstateも使用）
    const dragId = e.dataTransfer.getData('text/plain') || draggedChapterId;

    if (!currentProject || !dragId || dragId === dropChapterId) {
      setDraggedChapterId(null);
      return;
    }

    // IDベースで処理（フィルタリング後でも正しく動作）
    const draggedIndex = currentProject.chapters.findIndex(c => c.id === dragId);
    const dropIndex = currentProject.chapters.findIndex(c => c.id === dropChapterId);

    if (draggedIndex === -1 || dropIndex === -1 || draggedIndex === dropIndex) {
      setDraggedChapterId(null);
      return;
    }

    const newChapters = [...currentProject.chapters];
    const draggedChapter = newChapters[draggedIndex];

    // ドラッグされた章を削除
    newChapters.splice(draggedIndex, 1);

    // 新しい位置を再計算（削除後のインデックス）
    const newDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;

    // 新しい位置に挿入
    newChapters.splice(newDropIndex, 0, draggedChapter);

    updateProject({
      chapters: newChapters,
    });

    setDraggedChapterId(null);
  };

  const moveChapter = (fromIndex: number, toIndex: number) => {
    if (!currentProject || fromIndex === toIndex) return;

    const newChapters = [...currentProject.chapters];
    const [movedChapter] = newChapters.splice(fromIndex, 1);
    newChapters.splice(toIndex, 0, movedChapter);

    updateProject({
      chapters: newChapters,
    });
  };

  // 折りたたみ機能のハンドラー
  const toggleChapterExpansion = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // すべての章を展開/折りたたみ
  const toggleAllChapters = () => {
    if (!currentProject) return;
    if (expandedChapters.size === currentProject.chapters.length) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(currentProject.chapters.map(ch => ch.id)));
    }
  };

  // 検索フィルタリング関数（メモ化）
  const filteredChapters = useMemo(() => {
    if (!currentProject) return [];
    if (!searchQuery.trim()) return currentProject.chapters;

    const query = searchQuery.toLowerCase();
    return currentProject.chapters.filter(chapter => {
      // タイトルで検索
      if (chapter.title.toLowerCase().includes(query)) return true;

      // 概要で検索
      if (chapter.summary.toLowerCase().includes(query)) return true;

      // 設定・場所で検索
      if (chapter.setting?.toLowerCase().includes(query)) return true;

      // 雰囲気・ムードで検索
      if (chapter.mood?.toLowerCase().includes(query)) return true;

      // 重要な出来事で検索
      if (chapter.keyEvents?.some(event => event.toLowerCase().includes(query))) return true;

      // キャラクター名で検索
      if (chapter.characters?.some(characterId => {
        const character = currentProject.characters.find(c => c.id === characterId);
        const characterName = character ? character.name : characterId;
        return characterName.toLowerCase().includes(query);
      })) return true;

      return false;
    });
  }, [currentProject, searchQuery]);


  // 章の履歴を保存する関数（セッションベースのサービスを利用）
  const saveChapterHistory = useCallback((chapter: { id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }, source: ChapterHistorySource = 'manual') => {
    if (!currentProject) return;
    saveChapterSnapshot(currentProject.id, chapter, source);
  }, [currentProject]);

  // 履歴から章を復元する関数
  const restoreChapterFromHistory = (history: ChapterHistory) => {
    if (!currentProject) return;

    // 復元前に現在の状態を履歴に保存（復元ソース）
    const currentChapter = currentProject.chapters.find(c => c.id === history.chapterId);
    if (currentChapter) {
      saveChapterHistory(currentChapter, 'restore');
    }

    // 復元処理
    updateProject({
      chapters: currentProject.chapters.map(c =>
        c.id === history.chapterId
          ? {
            ...c,
            title: history.data.title,
            summary: history.data.summary,
            characters: history.data.characters,
            setting: history.data.setting,
            mood: history.data.mood,
            keyEvents: history.data.keyEvents,
            // 履歴のあらすじは過去の時点のもの。本文はそのまま残るので、
            // 印を引き継ぐと「本文から作られた最新のあらすじ」に化ける
            ...(c.draft?.trim() ? { summarySourceHash: SUMMARY_SOURCE_UNVERIFIED } : {}),
          }
          : c
      ),
    });

    setShowHistoryModal(false);
    showSuccess('章を履歴から復元しました');
  };

  // 履歴モーダルを開く
  const openHistoryModal = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setShowHistoryModal(true);
  };

  // 現在選択中の章の履歴をサービスから取得
  // showHistoryModal はモーダルを開くたびに最新スナップショットを取り直すための意図的な依存
  const selectedChapterHistories = useMemo(() => {
    if (!currentProject || !selectedChapterId) return [];
    return getChapterSnapshots(currentProject.id, selectedChapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, selectedChapterId, showHistoryModal]);

  // --- あらすじの鮮度管理 ---

  // あらすじが本文より古い章のID。本文全体をハッシュするため、章配列が変わったときだけ計算する
  const staleChapterIds = useMemo(() => {
    const ids = new Set<string>();
    currentProject?.chapters.forEach(c => {
      if (isSummaryStale(c)) ids.add(c.id);
    });
    return ids;
  }, [currentProject?.chapters]);

  // 更新中の章ID（一括更新中は現在処理中の章）と進捗
  const [refreshingChapterId, setRefreshingChapterId] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // アンマウント時に進行中の更新を中断する（結果を反映する先が無くなるため）
    return () => refreshAbortRef.current?.abort();
  }, []);

  /**
   * 指定した章のあらすじを本文から作り直す。
   * 反映は最後に1回だけ行い、対象章以外は「完了時点で最新の」内容をそのまま残す
   * （更新中にユーザーが別の章を編集しても、その編集を巻き戻さない）。
   */
  const runSummaryRefresh = useCallback(
    async (targets: Chapter[]) => {
      const project = currentProjectRef.current;
      if (!project || targets.length === 0 || refreshAbortRef.current) return;

      if (!isConfigured) {
        showError('AIの設定が完了していません。設定画面からAPIキーを設定してください');
        return;
      }

      const controller = new AbortController();
      refreshAbortRef.current = controller;
      const projectId = project.id;
      const results = new Map<string, RefreshedSummary>();
      let failed = 0;

      setRefreshProgress({ current: 0, total: targets.length });
      try {
        const run = createSummaryRunner(aiSettings, controller.signal);
        for (let i = 0; i < targets.length; i++) {
          if (controller.signal.aborted) break;
          const chapter = targets[i];
          setRefreshingChapterId(chapter.id);
          setRefreshProgress({ current: i + 1, total: targets.length });
          try {
            results.set(chapter.id, await refreshChapterSummary(chapter, {
              settings: aiSettings,
              run,
              projectId,
              signal: controller.signal,
            }));
          } catch (error) {
            if (controller.signal.aborted) break;
            failed++;
            console.error('あらすじ更新エラー:', error);
          }
        }
      } finally {
        refreshAbortRef.current = null;
        setRefreshingChapterId(null);
        setRefreshProgress(null);
      }

      const aborted = controller.signal.aborted;

      if (results.size === 0) {
        if (aborted) showSuccess('あらすじの更新を中止しました');
        else if (failed > 0) showError('あらすじの更新に失敗しました');
        return;
      }

      // 反映先は「完了時点の」プロジェクト。別作品に切り替わっていたら捨てる
      const latest = currentProjectRef.current;
      if (!latest || latest.id !== projectId) {
        showError('別の作品に切り替わったため、あらすじの更新は反映されませんでした');
        return;
      }

      latest.chapters.forEach(c => {
        if (results.has(c.id)) saveChapterHistory(c, 'ai-generate');
      });

      updateProject({
        chapters: latest.chapters.map(c => {
          const refreshed = results.get(c.id);
          return refreshed ? { ...c, ...refreshed } : c;
        }),
      });

      // 中止・失敗は件数だけで察せられないため明示する（残りは古いままなので）
      const notes = [
        aborted ? '中止しました' : '',
        failed > 0 ? `${failed}章は失敗` : '',
      ].filter(Boolean);
      showSuccess(
        notes.length > 0
          ? `${results.size}章のあらすじを更新しました（${notes.join('・')}）`
          : `${results.size}章のあらすじを更新しました`
      );
    },
    [aiSettings, isConfigured, saveChapterHistory, showError, showSuccess, updateProject]
  );

  const handleRefreshSummary = useCallback(
    (chapter: Chapter) => { void runSummaryRefresh([chapter]); },
    [runSummaryRefresh]
  );

  const handleRefreshAllStaleSummaries = useCallback(() => {
    const targets = currentProjectRef.current?.chapters.filter(c => staleChapterIds.has(c.id)) ?? [];
    void runSummaryRefresh(targets);
  }, [runSummaryRefresh, staleChapterIds]);

  // AI強化モーダルを開く
  const handleOpenEnhanceModal = (chapter: Chapter, index: number) => {
    setEnhanceModalState({
      isOpen: true,
      chapter,
      chapterIndex: index,
    });
  };

  // AI強化の生成結果を受け取る（payload=null で適用後にクリア）
  const handleEnhanceResult = useCallback(
    (chapterId: string, payload: EnhanceResultPayload | null) => {
      setEnhanceResultCache((prev) => {
        const next = { ...prev };
        if (payload) {
          next[chapterId] = payload;
        } else {
          delete next[chapterId];
        }
        return next;
      });

      if (!payload) return;

      // モーダルが閉じている/別章を開いている場合は、再オープン導線付きの完了トーストを出す
      if (openEnhanceChapterIdRef.current !== chapterId) {
        const ch = currentProject?.chapters.find((c) => c.id === chapterId);
        const idx = currentProject?.chapters.findIndex((c) => c.id === chapterId) ?? -1;
        if (ch) {
          showSuccess('章の強化案の生成が完了しました', 8000, {
            title: '生成完了',
            action: {
              label: '確認する',
              onClick: () => handleOpenEnhanceModal(ch, idx),
              variant: 'primary',
            },
          });
        }
      } else {
        showSuccess('章の強化案を生成しました');
      }
    },
    [currentProject, showSuccess]
  );

  // AI強化結果を適用
  const handleApplyEnhancement = (updates: Partial<Chapter>) => {
    if (!currentProject || !enhanceModalState.chapter) return;

    // 更新前の状態を履歴に保存（AI強化ソース）
    const currentChapter = currentProject.chapters.find(
      c => c.id === enhanceModalState.chapter!.id
    );
    if (currentChapter) {
      saveChapterHistory(currentChapter, 'ai-enhance');
    }

    updateProject({
      chapters: currentProject.chapters.map(c =>
        c.id === enhanceModalState.chapter!.id
          ? {
            ...c,
            ...updates,
            // AI強化はメタデータ（タイトル・設定・出来事）だけを見て書くため、
            // 生成されたあらすじは本文の内容を反映していない
            ...(updates.summary && c.draft?.trim()
              ? { summarySourceHash: SUMMARY_SOURCE_UNVERIFIED }
              : {}),
          }
          : c
      ),
    });

    showSuccess('章の内容を更新しました');
  };

  // メタデータ分割モーダルを開く（機能1: AI強化モーダルの「分割」専用。draftの有無に依らず常にメタデータ分割提案）
  const handleRequestMetadataSplit = (chapter: Chapter) => {
    const index = currentProject?.chapters.findIndex(c => c.id === chapter.id) ?? -1;
    setSplitPreviewState({
      isOpen: true,
      chapter,
      chapterIndex: index,
    });
  };

  // 本文分割モーダルを開く（機能2: 章カードのハサミ専用。draftを持つ章のみ表示されるため常に逐語分割）
  const handleRequestDraftSplit = (chapter: Chapter) => {
    const index = currentProject?.chapters.findIndex(c => c.id === chapter.id) ?? -1;
    setDraftSplitState({
      isOpen: true,
      chapter,
      chapterIndex: index,
    });
  };

  // 分割を適用
  const handleApplySplit = (newChapters: Chapter[]) => {
    if (!currentProject || !splitPreviewState.chapter) return;

    const chapterIndex = currentProject.chapters.findIndex(
      c => c.id === splitPreviewState.chapter!.id
    );

    if (chapterIndex === -1) return;

    // 元の章を削除し、新しい章を挿入
    const updatedChapters = [...currentProject.chapters];
    updatedChapters.splice(chapterIndex, 1, ...newChapters);

    updateProject({
      chapters: updatedChapters,
    });

    showSuccess(`章を${newChapters.length}つに分割しました`);
  };

  // 本文の逐語分割を適用（元章のメタデータは履歴へ退避してから置換）
  const handleApplyDraftSplit = (newChapters: Chapter[]) => {
    if (!currentProject || !draftSplitState.chapter) return;

    const chapterIndex = currentProject.chapters.findIndex(
      c => c.id === draftSplitState.chapter!.id
    );

    if (chapterIndex === -1) return;

    saveChapterHistory(draftSplitState.chapter, 'manual');

    const updatedChapters = [...currentProject.chapters];
    updatedChapters.splice(chapterIndex, 1, ...newChapters);

    updateProject({
      chapters: updatedChapters,
    });

    showSuccess(`本文を${newChapters.length}つの章に分割しました`);
  };

  // AI深掘りで生成された新しい章を挿入
  const handleInsertChapter = (chapterData: Partial<Chapter>) => {
    if (!currentProject || !enhanceModalState.chapter) return;

    const newChapter = {
      id: Date.now().toString(),
      title: chapterData.title || '新しい章',
      summary: chapterData.summary || '',
      characters: chapterData.characters || [],
      setting: chapterData.setting || '',
      mood: chapterData.mood || '',
      keyEvents: chapterData.keyEvents || [],
      ...chapterData,
    };

    const chapterIndex = currentProject.chapters.findIndex(
      c => c.id === enhanceModalState.chapter!.id
    );

    if (chapterIndex === -1) return;

    const updatedChapters = [...currentProject.chapters];
    // 現在の章の後ろに追加
    updatedChapters.splice(chapterIndex + 1, 0, newChapter);

    updateProject({
      chapters: updatedChapters,
    });

    // 新規作成時も履歴を保存
    saveChapterHistory(newChapter);

    showSuccess('新しい章を追加しました');
  };







  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  // ステップナビゲーション用のハンドラー
  const handlePreviousStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('synopsis');
    }
  };

  const handleNextStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('draft');
    }
  };

  return (
    <div>
      {/* ステップナビゲーション */}
      <StepNavigation
        currentStep="chapter"
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
      />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500">
            <List className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            章立て構成
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語の章構成を設計しましょう。AIが自動的な構成展開案を作成します。
        </p>
      </div>

      <div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  章構成一覧
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {currentProject.chapters.length} 章設定済み
                  {searchQuery && (
                    <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                      （検索結果: {filteredChapters.length} 章）
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>章を追加</span>
                </button>
              </div>
            </div>

            {/* 検索バー */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="章を検索（タイトル、概要、キャラクター名など）"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* あらすじ鮮度の一括更新（古い章が2つ以上あるときだけ出す。1章なら章カードのボタンで足りる） */}
            {(staleChapterIds.size >= 2 || refreshProgress) && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                    {staleChapterIds.size}章のあらすじが本文より古くなっています。
                    あらすじは次の章を書くときの文脈に使われるため、古いままだと生成品質が落ちます。
                  </p>
                </div>
                <button
                  onClick={refreshProgress ? () => refreshAbortRef.current?.abort() : handleRefreshAllStaleSummaries}
                  className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-['Noto_Sans_JP'] flex-shrink-0"
                >
                  {refreshProgress ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>更新中 {refreshProgress.current}/{refreshProgress.total}（中止）</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>まとめて更新（AI呼び出し{staleChapterIds.size}回）</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 折りたたみコントロール */}
            {currentProject.chapters.length > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={toggleAllChapters}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-['Noto_Sans_JP']"
                >
                  {expandedChapters.size === currentProject.chapters.length ? 'すべて折りたたむ' : 'すべて展開する'}
                </button>
              </div>
            )}
          </div>

          {/* Chapters List */}
          <div className="p-6">
            <ChapterList
              filteredChapters={filteredChapters}
              searchQuery={searchQuery}
              expandedChapters={expandedChapters}
              draggedChapterId={draggedChapterId}
              chapterRefs={chapterRefs}
              onToggleExpansion={toggleChapterExpansion}
              onEdit={handleEditChapter}
              onDelete={handleDeleteChapter}
              onMoveUp={(index) => moveChapter(index, Math.max(0, index - 1))}
              onMoveDown={(index) => moveChapter(index, Math.min(currentProject.chapters.length - 1, index + 1))}
              onOpenHistory={openHistoryModal}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onAddChapter={() => setShowAddForm(true)}
              onEnhance={handleOpenEnhanceModal}
              onSplitDraft={handleRequestDraftSplit}
              staleChapterIds={staleChapterIds}
              onRefreshSummary={handleRefreshSummary}
              refreshingChapterId={refreshingChapterId}
              isRefreshBusy={refreshProgress !== null}
            />
          </div>
        </div>
      </div>

      {/* Add Chapter Modal */}
      <ChapterFormModal
        isOpen={showAddForm}
        mode="add"
        formData={formData}
        onFormDataChange={setFormData}
        onClose={handleCloseModal}
        onSubmit={handleAddChapter}
        onCharacterToggle={(characterId) => handleCharacterToggle(characterId, false)}
        onKeyEventChange={(index, value) => handleKeyEventChange(index, value, false)}
        onAddKeyEvent={() => handleAddKeyEvent(false)}
        onRemoveKeyEvent={(index) => handleRemoveKeyEvent(index, false)}
      />

      {/* Edit Chapter Modal */}
      <ChapterFormModal
        isOpen={showEditForm}
        mode="edit"
        formData={editFormData}
        onFormDataChange={setEditFormData}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdateChapter}
        onCharacterToggle={(characterId) => handleCharacterToggle(characterId, true)}
        onKeyEventChange={(index, value) => handleKeyEventChange(index, value, true)}
        onAddKeyEvent={() => handleAddKeyEvent(true)}
        onRemoveKeyEvent={(index) => handleRemoveKeyEvent(index, true)}
      />


      {/* Chapter History Modal */}
      <ChapterHistoryModal
        isOpen={showHistoryModal}
        selectedChapterId={selectedChapterId}
        histories={selectedChapterHistories}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedChapterId(null);
        }}
        onRestore={restoreChapterFromHistory}
      />

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() => setConfirmDialogState({
          isOpen: false,
          chapterId: null,
          chapterTitle: '',
        })}
        onConfirm={handleConfirmDelete}
        title="章を削除しますか？"
        message={`「${confirmDialogState.chapterTitle}」を削除します。\nこの操作は取り消せません。`}
        type="danger"
        confirmLabel="削除"
        cancelLabel="キャンセル"
      />

      {/* AI強化モーダル */}
      {enhanceModalState.chapter && (
        <ChapterEnhanceModal
          isOpen={enhanceModalState.isOpen}
          chapter={enhanceModalState.chapter}
          chapterIndex={enhanceModalState.chapterIndex}
          onClose={() => setEnhanceModalState({ isOpen: false, chapter: null, chapterIndex: -1 })}
          onApply={handleApplyEnhancement}
          onRequestSplit={handleRequestMetadataSplit}
          onInsertChapter={handleInsertChapter}
          cachedResult={enhanceResultCache[enhanceModalState.chapter.id] ?? null}
          onResult={handleEnhanceResult}
        />
      )}

      {/* 分割プレビューモーダル */}
      {splitPreviewState.chapter && (
        <ChapterSplitPreview
          isOpen={splitPreviewState.isOpen}
          chapter={splitPreviewState.chapter}
          chapterIndex={splitPreviewState.chapterIndex}
          onClose={() => setSplitPreviewState({ isOpen: false, chapter: null, chapterIndex: -1 })}
          onApplySplit={handleApplySplit}
        />
      )}

      {/* 本文分割モーダル（逐語分割） */}
      {draftSplitState.chapter && (
        <ChapterDraftSplitModal
          isOpen={draftSplitState.isOpen}
          chapter={draftSplitState.chapter}
          chapterIndex={draftSplitState.chapterIndex}
          onClose={() => setDraftSplitState({ isOpen: false, chapter: null, chapterIndex: -1 })}
          onApply={handleApplyDraftSplit}
        />
      )}
    </div>
  );
};