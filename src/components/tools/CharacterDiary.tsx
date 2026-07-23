import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Edit3, Trash2, Loader, Sparkles, Calendar, StopCircle, Download } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useProject } from '../../contexts/ProjectContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { aiService } from '../../services/aiService';
import { CHARACTER_PROMPT_CAP } from '../../services/prompts/character';
import { CharacterDiaryEntry } from '../../types/characterPossession';
import { generateUUID, sanitizeFileName } from '../../utils/securityUtils';
import { Modal } from '../common/Modal';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useOverlayBackHandler } from '../../contexts/BackButtonContext';

interface CharacterDiaryProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  // 完了トーストの「確認する」から日記モーダルを再オープンするための導線
  onRequestReopen?: (characterId: string) => void;
}

export const CharacterDiary: React.FC<CharacterDiaryProps> = ({
  isOpen,
  onClose,
  characterId,
  onRequestReopen,
}) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'character-diary-modal', 90);

  const { settings, isConfigured } = useAI();
  const { currentProject } = useProject();
  const { showError, showSuccess } = useToast();
  const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
  const [diaries, setDiaries] = useState<CharacterDiaryEntry[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<CharacterDiaryEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // 生成タスクの識別キー（キャラごと）。実行中判定はマネージャから導出するため
  // モーダルを閉じても（アンマウントしても）裏で生成は継続する。
  const pid = currentProject?.id ?? 'none';
  const diaryKey = `${pid}:character-diary:${characterId}`;
  const isGenerating = isKeyActive(diaryKey);

  // async 完了（別フレーム/アンマウント後）から最新の開閉状態を参照するための ref。
  // このモーダルは閉じるとアンマウントされる（isOpen が false になるのではなく消える）ため、
  // cleanup で false に倒さないと「閉じた後の完了」を検知できない（再オープン導線が死ぬ）。
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
    return () => {
      isOpenRef.current = false;
    };
  }, [isOpen]);

  // 選択されたキャラクターを取得
  const character = currentProject?.characters.find(c => c.id === characterId);

  // 日記をローカルストレージから読み込み
  const loadDiaries = useCallback(() => {
    if (!currentProject || !characterId) return;
    try {
      const key = `character_diary_${currentProject.id}_${characterId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<CharacterDiaryEntry, 'createdAt'> & { createdAt: string | Date }>;
        const diariesWithDates = parsed.map((d) => ({
          ...d,
          createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt),
        }));
        // 日付順（新しい順）にソート
        diariesWithDates.sort((a: CharacterDiaryEntry, b: CharacterDiaryEntry) =>
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        setDiaries(diariesWithDates);
      }
    } catch (error) {
      console.error('日記の読み込みに失敗しました:', error);
    }
  }, [currentProject, characterId]);

  useEffect(() => {
    if (isOpen && characterId && currentProject) {
      loadDiaries();
    }
  }, [isOpen, characterId, currentProject, loadDiaries]);

  // 生成完了時（実行中→停止）に最新の日記を読み直す。
  // 生成中に開き直した別インスタンスは、完了後の新エントリを localStorage から拾う必要があるため。
  useEffect(() => {
    if (!isGenerating && isOpen) {
      loadDiaries();
    }
  }, [isGenerating, isOpen, loadDiaries]);

  // 日記をローカルストレージに保存
  const saveDiaries = useCallback((updatedDiaries: CharacterDiaryEntry[]) => {
    if (!currentProject || !characterId) return;
    try {
      const key = `character_diary_${currentProject.id}_${characterId}`;
      localStorage.setItem(key, JSON.stringify(updatedDiaries));
      setDiaries(updatedDiaries);
    } catch (error) {
      console.error('日記の保存に失敗しました:', error);
    }
  }, [currentProject, characterId]);

  // 生成中の日記をlocalStorageへ追記（背景完了時にクロージャの古い diaries で取りこぼさないよう都度読み直す）
  const appendDiaryToStorage = useCallback((entry: CharacterDiaryEntry) => {
    if (!currentProject) return;
    const key = `character_diary_${currentProject.id}_${characterId}`;
    let existing: CharacterDiaryEntry[] = [];
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        existing = (JSON.parse(saved) as Array<Omit<CharacterDiaryEntry, 'createdAt'> & { createdAt: string | Date }>)
          .map((d) => ({ ...d, createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt) }));
      }
    } catch (error) {
      console.error('日記の読み込みに失敗しました:', error);
    }
    const updated = [entry, ...existing];
    localStorage.setItem(key, JSON.stringify(updated));
    setDiaries(updated); // マウント中ならUI反映（アンマウント時はno-op）
  }, [currentProject, characterId]);

  // 生成をキャンセル（key単位でabort）
  const handleCancelGeneration = () => {
    cancelByKey(diaryKey);
  };

  // 日記を生成
  const handleGenerateDiary = async (chapterId?: string) => {
    if (!isConfigured || !character || !currentProject) {
      // モーダルが開いている時のみエラー表示
      if (isOpen) {
        showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      }
      return;
    }

    const chapter = chapterId
      ? currentProject.chapters.find(c => c.id === chapterId)
      : currentProject.chapters[currentProject.chapters.length - 1]; // 最後の章

    if (!chapter) {
      // モーダルが開いている時のみエラー表示
      if (isOpen) {
        showError('章が見つかりません。');
      }
      return;
    }

    // マネージャに生成タスクを登録（同keyの既存タスクは自動でキャンセル・置換）。
    // signal を渡すことで、モーダルを閉じても生成は継続し左下インジケータに表示される。
    const { id: taskId, signal } = startTask({
      key: diaryKey,
      label: `「${character.name}」の本音日記を生成中`,
      step: 'character',
    });

    try {
      const chapterSummary = chapter.summary || '章の内容が設定されていません';
      const chapterDetails = chapter.characters?.join(', ') || '未設定';
      const chapterSetting = chapter.setting || '未設定';
      const chapterMood = chapter.mood || '未設定';
      const chapterEvents = chapter.keyEvents?.join(', ') || '未設定';

      const fullSummary = `【概要】\n${chapterSummary}\n\n【登場キャラクター】\n${chapterDetails}\n\n【設定・場所】\n${chapterSetting}\n\n【雰囲気】\n${chapterMood}\n\n【重要な出来事】\n${chapterEvents}`;

      const chapterContent = chapter.draft
        ? `【章の本文（草案）】\n${chapter.draft.substring(0, 10000)}`
        : '';

      const prompt = aiService.buildPrompt('character', 'diary', {
        characterName: character.name,
        characterRole: character.role || '未設定',
        characterAppearance: character.appearance || '未設定',
        characterPersonality: character.personality || '未設定',
        characterBackground: character.background || '未設定',
        characterSpeechStyle: character.speechStyle ? `口調・話し方: ${character.speechStyle}` : '',
        projectTitle: currentProject.title || '未設定',
        projectTheme: currentProject.theme || currentProject.projectTheme || '未設定',
        chapterSummary: fullSummary,
        chapterContent: chapterContent,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'character',
        settings,
        signal,
        maxPromptLength: CHARACTER_PROMPT_CAP,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      if (response.error) {
        showError(`日記生成エラー: ${response.error}`);
        return;
      }

      const diaryContent = response.content?.trim() || '';

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      const newDiary: CharacterDiaryEntry = {
        id: generateUUID(),
        characterId: character.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        title: `${chapter.title || '第' + (currentProject.chapters.findIndex(c => c.id === chapter.id) + 1) + '章'}終了後`,
        content: diaryContent,
        createdAt: new Date(),
        isAiGenerated: true,
      };

      // localStorageへ追記（モーダルが閉じていても保存される）
      appendDiaryToStorage(newDiary);

      // 完了通知。モーダルが閉じている場合は「確認する」で再オープンできるようにする。
      if (isOpenRef.current) {
        showSuccess('日記を生成しました');
      } else {
        showSuccess(`「${character.name}」の本音日記の生成が完了しました`, 8000, {
          title: '生成完了',
          action: {
            label: '確認する',
            onClick: () => onRequestReopen?.(character.id),
            variant: 'primary',
          },
        });
      }

    } catch (error) {
      // キャンセルされた場合はエラーを表示しない
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('日記生成がキャンセルされました');
        return;
      }

      console.error('日記生成エラー:', error);
      showError('日記生成中にエラーが発生しました');
    } finally {
      // 成否・キャンセルに関わらずタスクを除去（キャンセル済みならno-op）
      completeTask(taskId);
    }
  };

  // 日記を編集
  const handleEditDiary = (diary: CharacterDiaryEntry) => {
    setSelectedDiary(diary);
    setEditContent(diary.content);
    setIsEditing(true);
  };

  // 日記編集を保存
  const handleSaveEdit = () => {
    if (!selectedDiary) return;

    const updatedDiaries = diaries.map(d =>
      d.id === selectedDiary.id
        ? { ...d, content: editContent }
        : d
    );

    saveDiaries(updatedDiaries);
    setIsEditing(false);
    setSelectedDiary(null);
    setEditContent('');
    showSuccess('日記を更新しました');
  };

  // 日記削除の確認
  const handleDeleteDiary = (diaryId: string) => {
    setDeleteTargetId(diaryId);
    setShowDeleteConfirm(true);
  };

  // 日記削除の実行
  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    const updatedDiaries = diaries.filter(d => d.id !== deleteTargetId);
    saveDiaries(updatedDiaries);
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    showSuccess('日記を削除しました');
  };

  // 日記を表示
  const handleViewDiary = (diary: CharacterDiaryEntry) => {
    setSelectedDiary(diary);
    setEditContent(diary.content);
    setIsEditing(true);
  };

  // 日記をダウンロード
  const handleDownloadDiary = () => {
    if (!currentProject || !character || diaries.length === 0) {
      showError('ダウンロードする日記がありません');
      return;
    }

    try {
      // テキスト形式でフォーマット
      const exportDate = new Date().toLocaleString('ja-JP');
      let content = `【本音日記】\n`;
      content += `プロジェクト: ${currentProject.title || '未設定'}\n`;
      content += `キャラクター: ${character.name}\n`;
      content += `エクスポート日時: ${exportDate}\n\n`;
      content += `========================================\n\n`;

      // 日付順（新しい順）でソートされた日記をフォーマット
      diaries.forEach((diary, index) => {
        const dateStr = diary.createdAt.toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = diary.createdAt.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        });

        content += `【${diary.title}】\n`;
        if (diary.chapterTitle) {
          content += `章: ${diary.chapterTitle}\n`;
        }
        content += `日付: ${dateStr} ${timeStr}\n`;
        if (diary.isAiGenerated) {
          content += `[AI生成]\n`;
        }
        content += `\n${diary.content}\n\n`;

        if (index < diaries.length - 1) {
          content += `---\n\n`;
        }
      });

      // ファイル名を生成
      const projectName = currentProject.title || 'プロジェクト';
      const characterName = character.name;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = sanitizeFileName(`${projectName}_${characterName}_本音日記_${dateStr}.txt`);

      // Blobを作成してダウンロード
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess('日記をダウンロードしました');
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      showError('ダウンロードに失敗しました');
    }
  };

  if (!isOpen || !character) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          // 閉じても生成は中断しない（バックグラウンドで継続）。UI選択状態のみクリア。
          setSelectedChapterId(null);
          onClose();
        }}
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                📔 {character.name}の本音日記
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {character.image && (
                <img
                  src={character.image}
                  alt={character.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-purple-500"
                />
              )}
              {diaries.length > 0 && (
                <button
                  onClick={handleDownloadDiary}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="日記をダウンロード"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        }
        size="lg"
        ref={modalRef}
      >
        <div className="flex flex-col h-[70vh]">
          {/* 日記生成ボタン */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {currentProject && currentProject.chapters.length > 0 && (
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <select
                    value={selectedChapterId || ''}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value || null);
                    }}
                    disabled={isGenerating || !isConfigured}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                  >
                    <option value="">章を選択...</option>
                    {currentProject.chapters.map((chapter, index) => (
                      <option key={chapter.id} value={chapter.id}>
                        第{index + 1}章: {chapter.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (selectedChapterId) {
                        handleGenerateDiary(selectedChapterId);
                      }
                    }}
                    disabled={!selectedChapterId || isGenerating || !isConfigured}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-['Noto_Sans_JP'] whitespace-nowrap"
                  >
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    日記を生成
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {isGenerating && (
                <>
                  <Loader className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    生成中...
                  </span>
                  <button
                    onClick={handleCancelGeneration}
                    className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>キャンセル</span>
                  </button>
                </>
              )}
              {!isGenerating && (
                <button
                  onClick={() => {
                    const lastChapter = currentProject?.chapters[currentProject.chapters.length - 1];
                    if (lastChapter) {
                      handleGenerateDiary(lastChapter.id);
                    } else {
                      showError('章が設定されていません。');
                    }
                  }}
                  disabled={!isConfigured || !currentProject || currentProject.chapters.length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-['Noto_Sans_JP'] whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>最新の章で日記を生成</span>
                </button>
              )}
            </div>
          </div>

          {/* 日記一覧 */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {diaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <BookOpen className="h-12 w-12 mb-4 text-purple-600 dark:text-purple-400" />
                <p className="font-['Noto_Sans_JP'] mb-4">
                  {character.name}の日記はまだありません
                </p>
                {!isConfigured && (
                  <p className="text-sm mt-2 text-yellow-600 dark:text-yellow-400 font-['Noto_Sans_JP'] mb-4">
                    AI設定が必要です
                  </p>
                )}
                {currentProject && currentProject.chapters.length === 0 && (
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    章が設定されていないと日記を生成できません
                  </p>
                )}
              </div>
            ) : (
              diaries.map((diary) => (
                <div
                  key={diary.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                          {diary.title}
                        </h3>
                        {diary.isAiGenerated && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-['Noto_Sans_JP']">
                            AI生成
                          </span>
                        )}
                      </div>
                      {diary.chapterTitle && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                          {diary.chapterTitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] mt-1">
                        {diary.createdAt.toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewDiary(diary)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="読む"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditDiary(diary)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="編集"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDiary(diary.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] line-clamp-3">
                    {diary.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* 日記表示/編集モーダル */}
      {isEditing && selectedDiary && (
        <Modal
          isOpen={isEditing}
          onClose={() => {
            setIsEditing(false);
            setSelectedDiary(null);
            setEditContent('');
          }}
          title={
            <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              {selectedDiary.title}
            </span>
          }
          size="md"
        >
          <div className="space-y-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-['Noto_Sans_JP'] resize-none"
            />
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setSelectedDiary(null);
                  setEditContent('');
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
              >
                保存
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="日記を削除しますか？"
        message="この操作は取り消せません。"
        type="danger"
        confirmLabel="削除"
        cancelLabel="キャンセル"
      />
    </>
  );
};

