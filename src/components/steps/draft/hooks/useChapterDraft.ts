import { useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '../../../../contexts/ProjectContext';

interface UseChapterDraftOptions {
  currentProject: Project | null;
  updateProject: (
    updates: { chapters?: Project['chapters']; draft?: string } | ((project: Project) => { chapters?: Project['chapters']; draft?: string }),
    immediate?: boolean,
    targetProjectId?: string,
  ) => Promise<void>;
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
  const currentProjectRef = useRef(currentProject);
  const updateProjectRef = useRef(updateProject);
  currentProjectRef.current = currentProject;
  updateProjectRef.current = updateProject;

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
        const contentToSave = content ?? draft;

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

        await updateProject({
          chapters: updatedChapters,
          draft: contentToSave,
        }, true, currentProject.id);

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

  useEffect(() => {
    return () => {
      const project = currentProjectRef.current;
      const chapterId = currentSelectedChapterRef.current;
      const latestDraft = currentDraftRef.current;
      if (!project || !chapterId) return;

      void updateProjectRef.current((latest) => {
        const chapters = latest.chapters.map(chapter =>
          chapter.id === chapterId ? { ...chapter, draft: latestDraft } : chapter
        );
        return { chapters, draft: latestDraft };
      }, true, project.id).catch(error => {
        console.error('Draft cleanup save error:', error);
      });
    };
  }, []);


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

