import { useCallback } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { downloadTextFileInBrowser, isTauriEnvironment, sanitizeFilename } from '../utils';

interface UseExportOptions {
  currentProject: Project | null;
  chapterDrafts: Record<string, string>;
  onSuccess?: (message: string) => void;
  onError?: (message: string, title?: string) => void;
  onWarning?: (message: string, title?: string) => void;
}

export const useExport = ({
  currentProject,
  chapterDrafts,
  onSuccess,
  onError,
  onWarning,
}: UseExportOptions) => {
  // 章のエクスポート
  const exportChapter = useCallback(
    async (chapterTitle: string, draft: string) => {
      if (!draft.trim()) {
        onWarning?.('エクスポートする章の内容がありません', 'エクスポート不可');
        return;
      }

      const content = `# ${chapterTitle}\n\n${draft}`;
      const filename = sanitizeFilename(`${chapterTitle}.txt`);
      let exported = false;

      if (isTauriEnvironment()) {
        try {
          const filePath = await save({
            title: 'ファイルを保存',
            defaultPath: filename,
            filters: [
              {
                name: 'Text Files',
                extensions: ['txt'],
              },
            ],
          });

          if (filePath) {
            await writeTextFile(filePath, content);
            onSuccess?.('エクスポートが完了しました');
            exported = true;
          }
        } catch (error) {
          console.warn('Tauri経由の章出力に失敗しました。ブラウザダウンロードにフォールバックします。', error);
        }
      }

      if (!exported) {
        try {
          downloadTextFileInBrowser(filename, content);
          onSuccess?.('ブラウザから章のテキストをダウンロードしました');
        } catch (error) {
          console.error('Browser export error:', error);
          onError?.(
            'エクスポートに失敗しました: ' + (error instanceof Error ? error.message : String(error)),
            'エクスポートエラー'
          );
        }
      }
    },
    [onSuccess, onError, onWarning]
  );

  // 完全版のエクスポート
  const exportFull = useCallback(async () => {
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
      onWarning?.('エクスポートする内容がありません', 'エクスポート不可');
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
              extensions: ['txt'],
            },
          ],
        });

        if (filePath) {
          await writeTextFile(filePath, content);
          onSuccess?.('エクスポートが完了しました');
          exported = true;
        }
      } catch (error) {
        console.warn('Tauri経由の完全版出力に失敗しました。ブラウザダウンロードにフォールバックします。', error);
      }
    }

    if (!exported) {
      try {
        downloadTextFileInBrowser(filename, content);
        onSuccess?.('ブラウザから完全版テキストをダウンロードしました');
      } catch (error) {
        console.error('Browser export error:', error);
        onError?.(
          'エクスポートに失敗しました: ' + (error instanceof Error ? error.message : String(error)),
          'エクスポートエラー'
        );
      }
    }
  }, [currentProject, chapterDrafts, onSuccess, onError, onWarning]);

  return {
    exportChapter,
    exportFull,
  };
};













