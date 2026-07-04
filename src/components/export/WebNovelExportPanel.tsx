import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../Toast';
import {
  WebNovelSite,
  WEB_NOVEL_SITE_LABELS,
  convertForSite,
} from '../../utils/webNovelUtils';

/**
 * 小説投稿サイト向け出力パネル。
 * 章ごとの本文を「小説家になろう」「カクヨム」の記法へ変換し、
 * 投稿フォームへ貼り付けやすい単位でクリップボードにコピーできる。
 */
export const WebNovelExportPanel: React.FC = () => {
  const { currentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const [site, setSite] = useState<WebNovelSite>('narou');
  const [copiedChapterId, setCopiedChapterId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const chaptersWithDraft = useMemo(
    () => (currentProject?.chapters ?? []).filter(chapter => chapter.draft?.trim()),
    [currentProject]
  );

  const handleCopy = async (chapterId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(convertForSite(text, site));
      setCopiedChapterId(chapterId);
      showSuccess(`${WEB_NOVEL_SITE_LABELS[site]}向けの記法でコピーしました`);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedChapterId(null), 2000);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
      showError('クリップボードへのコピーに失敗しました');
    }
  };

  const handleCopyAll = async () => {
    const merged = chaptersWithDraft
      .map(chapter => chapter.draft ?? '')
      .join('\n\n');
    await handleCopy('__all__', merged);
  };

  if (!currentProject) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6 mt-4 lg:mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Send className="h-5 w-5 text-orange-500" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
          投稿サイト向け出力
        </h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
        章ごとの本文を投稿サイトの記法（ルビ・傍点）に変換してコピーします。投稿フォームにそのまま貼り付けられます。
      </p>

      {/* サイト選択 */}
      <div className="flex items-center gap-2 mb-4">
        {(Object.keys(WEB_NOVEL_SITE_LABELS) as WebNovelSite[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setSite(key)}
            className={`px-3 py-1.5 rounded-lg border-2 text-sm transition-colors font-['Noto_Sans_JP'] ${
              site === key
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-semibold'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
            }`}
          >
            {WEB_NOVEL_SITE_LABELS[key]}
          </button>
        ))}
      </div>

      {site === 'narou' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
          ※ なろうは傍点記法（《《…》》）に非対応のため、1文字ずつ「・」のルビに変換されます。
        </p>
      )}

      {/* 章一覧 */}
      {chaptersWithDraft.length > 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
          {chaptersWithDraft.map((chapter, index) => (
            <div key={chapter.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900 dark:text-white truncate font-['Noto_Sans_JP']">
                  第{index + 1}章: {chapter.title || '無題'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {(chapter.draft?.length ?? 0).toLocaleString()}文字
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(chapter.id, chapter.draft ?? '')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-300 transition-colors font-['Noto_Sans_JP']"
              >
                {copiedChapterId === chapter.id ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                コピー
              </button>
            </div>
          ))}
          <div className="px-3 py-2.5 flex justify-end">
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 transition-colors font-['Noto_Sans_JP']"
            >
              {copiedChapterId === '__all__' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              全章をまとめてコピー
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center font-['Noto_Sans_JP']">
          草案が書かれた章がありません。草案ステップで執筆すると、ここからコピーできます。
        </p>
      )}
    </div>
  );
};
