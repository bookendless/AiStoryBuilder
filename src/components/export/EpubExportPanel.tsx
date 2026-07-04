import React, { useState } from 'react';
import { BookOpen, Download, Loader2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../Toast';
import { generateEpub, canGenerateEpub } from '../../services/epubService';
import { exportFile } from '../../utils/mobileExportUtils';
import { sanitizeFileName } from '../../utils/securityUtils';

/**
 * EPUB出力パネル。
 * 章草案からEPUB3（縦書き/横書き対応・目次付き）を生成してダウンロードする。
 */
export const EpubExportPanel: React.FC = () => {
  const { currentProject } = useProject();
  const { showSuccess, showError } = useToast();

  const [vertical, setVertical] = useState(true);
  const [includeSynopsis, setIncludeSynopsis] = useState(true);
  const [author, setAuthor] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = canGenerateEpub(currentProject);

  const handleGenerate = async () => {
    if (!currentProject || !canGenerate || isGenerating) return;

    setIsGenerating(true);
    try {
      const epubData = generateEpub(currentProject, {
        vertical,
        includeSynopsis,
        author,
      });
      const blob = new Blob([new Uint8Array(epubData)], { type: 'application/epub+zip' });
      const filename = `${sanitizeFileName(currentProject.title || 'novel')}.epub`;

      const result = await exportFile({
        filename,
        content: blob,
        mimeType: 'application/epub+zip',
        title: currentProject.title,
        dialogTitle: 'EPUBを保存',
      });

      if (result.success) {
        showSuccess('EPUBを出力しました');
      } else if (result.method !== 'cancelled') {
        showError(result.error || 'EPUBの出力に失敗しました');
      }
    } catch (error) {
      console.error('EPUB生成に失敗しました:', error);
      showError('EPUBの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6 mt-4 lg:mt-6">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-5 w-5 text-orange-500" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
          EPUB出力（電子書籍）
        </h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
        章草案から目次付きのEPUB3を生成します。電子書籍リーダーやスマートフォンの読書アプリで読めます。ルビ・傍点も反映されます。
      </p>

      <div className="space-y-3">
        {/* 組み方向 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300 w-20 font-['Noto_Sans_JP']">組み方向</span>
          <button
            type="button"
            onClick={() => setVertical(true)}
            className={`px-3 py-1.5 rounded-lg border-2 text-sm transition-colors font-['Noto_Sans_JP'] ${vertical
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-semibold'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
              }`}
          >
            縦書き（右開き）
          </button>
          <button
            type="button"
            onClick={() => setVertical(false)}
            className={`px-3 py-1.5 rounded-lg border-2 text-sm transition-colors font-['Noto_Sans_JP'] ${!vertical
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-semibold'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
              }`}
          >
            横書き
          </button>
        </div>

        {/* 著者名 */}
        <div className="flex items-center gap-2">
          <label htmlFor="epub-author" className="text-sm text-gray-700 dark:text-gray-300 w-20 font-['Noto_Sans_JP']">
            著者名
          </label>
          <input
            id="epub-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="ペンネーム（任意）"
            className="flex-1 max-w-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-['Noto_Sans_JP']"
          />
        </div>

        {/* あらすじ */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSynopsis}
            onChange={(e) => setIncludeSynopsis(e.target.checked)}
            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
            あらすじページを含める
          </span>
        </label>

        {/* 生成ボタン */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-['Noto_Sans_JP']"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            EPUBを生成してダウンロード
          </button>
          {!canGenerate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-['Noto_Sans_JP']">
              草案が書かれた章がないため生成できません。
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
