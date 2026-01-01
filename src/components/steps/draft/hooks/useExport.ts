import { useCallback } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { downloadTextFileInBrowser, sanitizeFilename } from '../utils';
import { isTauriEnvironment, isAndroidEnvironment } from '../../../../utils/platformUtils';

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

      const isTauri = isTauriEnvironment();
      const isAndroid = isTauri ? await isAndroidEnvironment() : false;

      // Android環境ではファイルシステムAPIの代わりにShare APIまたはブラウザダウンロードを使用
      if (isTauri && !isAndroid) {
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

      // Android環境またはファイルシステムAPIが使えない場合
      if (!exported) {
        try {
          // Android環境ではShare APIを試行
          if (isAndroid && typeof navigator !== 'undefined' && navigator.share) {
            try {
              await navigator.share({
                title: chapterTitle,
                text: content,
                files: [
                  new File([content], filename, { type: 'text/plain' })
                ]
              });
              onSuccess?.('ファイルを共有しました');
              exported = true;
            } catch (shareError) {
              // Share APIがキャンセルされた場合や失敗した場合はダウンロードにフォールバック
              if (shareError instanceof Error && shareError.name !== 'AbortError') {
                console.warn('Share API failed, falling back to download:', shareError);
              }
            }
          }
          
          // Share APIが使えない場合や失敗した場合はブラウザダウンロード
          if (!exported) {
            downloadTextFileInBrowser(filename, content);
            onSuccess?.('ブラウザから章のテキストをダウンロードしました');
          }
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

    const isTauri = isTauriEnvironment();
    const isAndroid = isTauri ? await isAndroidEnvironment() : false;

    // Android環境ではファイルシステムAPIの代わりにShare APIまたはブラウザダウンロードを使用
    if (isTauri && !isAndroid) {
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

    // Android環境またはファイルシステムAPIが使えない場合
    if (!exported) {
      try {
        // Android環境ではShare APIを試行
        if (isAndroid && typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: currentProject.title,
              text: content,
              files: [
                new File([content], filename, { type: 'text/plain' })
              ]
            });
            onSuccess?.('ファイルを共有しました');
            exported = true;
          } catch (shareError) {
            // Share APIがキャンセルされた場合や失敗した場合はダウンロードにフォールバック
            if (shareError instanceof Error && shareError.name !== 'AbortError') {
              console.warn('Share API failed, falling back to download:', shareError);
            }
          }
        }
        
        // Share APIが使えない場合や失敗した場合はブラウザダウンロード
        if (!exported) {
          downloadTextFileInBrowser(filename, content);
          onSuccess?.('ブラウザから完全版テキストをダウンロードしました');
        }
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

























































































