import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Plus, Search, X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../Toast';
import { ChapterFormModal } from './chapter/ChapterFormModal';
import { ChapterHistoryModal } from './chapter/ChapterHistoryModal';
import { ChapterList } from './chapter/ChapterList';
import { ChapterHistory, ChapterFormData } from './chapter/types';
import { StepNavigation } from '../common/StepNavigation';
import { Step } from '../../App';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ChapterStepProps {
  onNavigateToStep?: (step: Step) => void;
}

export const ChapterStep: React.FC<ChapterStepProps> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject, deleteChapter } = useProject();
  const { showSuccess } = useToast();

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

  // 履歴管理の状態
  const [chapterHistories, setChapterHistories] = useState<{ [chapterId: string]: ChapterHistory[] }>({});
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

    const updatedChapter = {
      id: editingId,
      title: editFormData.title.trim(),
      summary: editFormData.summary.trim(),
      characters: editFormData.characters,
      setting: editFormData.setting.trim(),
      mood: editFormData.mood.trim(),
      keyEvents: editFormData.keyEvents,
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


  // 章の履歴を保存する関数
  const saveChapterHistory = useCallback((chapter: { id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }) => {
    const history: ChapterHistory = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      chapterId: chapter.id,
      timestamp: new Date(),
      data: {
        title: chapter.title,
        summary: chapter.summary,
        characters: chapter.characters || [],
        setting: chapter.setting || '',
        mood: chapter.mood || '',
        keyEvents: chapter.keyEvents || [],
      },
    };

    setChapterHistories(prev => {
      const chapterHistory = prev[chapter.id] || [];
      // 最新50件まで保持
      const newHistory = [history, ...chapterHistory].slice(0, 50);
      return {
        ...prev,
        [chapter.id]: newHistory,
      };
    });
  }, []);

  // 履歴から章を復元する関数
  const restoreChapterFromHistory = (history: ChapterHistory) => {
    if (!currentProject) return;

    // 復元前に現在の状態を履歴に保存（タイミング問題の修正）
    const currentChapter = currentProject.chapters.find(c => c.id === history.chapterId);
    if (currentChapter) {
      saveChapterHistory(currentChapter);
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
        histories={selectedChapterId ? (chapterHistories[selectedChapterId] || []) : []}
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
    </div>
  );
};