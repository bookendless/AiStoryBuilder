import { useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { databaseService } from '../../../../services/databaseService';

interface UseChapterDraftOptions {
  currentProject: Project | null;
  updateProject: (updates: { chapters?: Project['chapters']; draft?: string }) => void;
  selectedChapter: string | null;
  onSaveSuccess?: (lastSavedAt: Date, isAutoSave?: boolean) => void;
  onSaveError?: (error: Error) => void;
  onToastMessage?: (message: string | null) => void;
}

export const useChapterDraft = ({
  currentProject,
  updateProject,
  selectedChapter,
  onSaveSuccess,
  onSaveError,
  onToastMessage,
}: UseChapterDraftOptions) => {
  const [draft, setDraft] = useState('');
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // 現在の値を保持するためのref（アンマウント時に使用）
  const currentDraftRef = useRef(draft);
  const currentSelectedChapterRef = useRef(selectedChapter);

  // refを更新
  useEffect(() => {
    currentDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    currentSelectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  // 章の草案を同期（プロジェクトの更新を監視）
  useEffect(() => {
    if (!currentProject) return;

    // プロジェクトの章草案が外部から更新された場合を検知して同期
    setChapterDrafts(prevChapterDrafts => {
      const updatedChapterDrafts: Record<string, string> = {};
      let hasChanges = false;
      
      currentProject.chapters.forEach(chapter => {
        const projectDraft = chapter.draft || '';
        const localDraft = prevChapterDrafts[chapter.id];
        
        // プロジェクトの草案と異なる場合、またはローカルに存在しない場合は更新
        // ただし、選択中の章は現在編集中の可能性があるため、プロジェクト草案を優先
        if (localDraft === undefined || projectDraft !== localDraft) {
          updatedChapterDrafts[chapter.id] = projectDraft;
          if (localDraft !== undefined && projectDraft !== localDraft) {
            hasChanges = true;
          }
        } else {
          updatedChapterDrafts[chapter.id] = localDraft;
        }
      });
      
      // 変更がある場合のみ更新（不要な再レンダリングを防止）
      if (hasChanges || Object.keys(updatedChapterDrafts).length !== Object.keys(prevChapterDrafts).length) {
        return updatedChapterDrafts;
      }
      
      // 新しい章が追加された場合のみ更新
      const newChapters = currentProject.chapters.filter(c => !(c.id in prevChapterDrafts));
      if (newChapters.length > 0) {
        return updatedChapterDrafts;
      }
      
      return prevChapterDrafts;
    });
  }, [currentProject]);

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

  // 章草案保存ハンドラー
  const handleSaveChapterDraft = useCallback(
    async (chapterId: string, content?: string, isAutoSave: boolean = false) => {
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
          draft: contentToSave, // メインの草案も更新
        });

        // 即座にデータベースに保存（デバウンスを待たない）
        await databaseService.saveProject(updatedProject);

        // 保存成功時の処理
        const now = new Date();
        setLastSavedAt(now);
        onSaveSuccess?.(now, isAutoSave);
        
        // トースト通知を表示（自動保存の場合のみ）
        if (isAutoSave && onToastMessage) {
          onToastMessage('自動保存しました');
          setTimeout(() => {
            onToastMessage(null);
          }, 3000);
        }
      } catch (error) {
        console.error('章草案保存エラー:', error);
        const err = error instanceof Error ? error : new Error(String(error));
        onSaveError?.(err);
      }
    },
    [currentProject, draft, chapterDrafts, updateProject, onSaveSuccess, onSaveError, onToastMessage]
  );

  // アンマウント時に保存（refから最新の値を取得）
  useEffect(() => {
    return () => {
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
        void saveToDatabase();
      }
    };
  }, [currentProject]);

  return {
    draft,
    setDraft,
    chapterDrafts,
    setChapterDrafts,
    lastSavedAt,
    handleSaveChapterDraft,
    currentDraftRef,
    currentSelectedChapterRef,
  };
};

