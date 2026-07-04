import React, { useState, useMemo, useEffect } from 'react';
import { Replace, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './common/Modal';
import { useProject } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import {
  buildReplacePreview,
  applyReplace,
  ReplaceScope,
} from '../utils/replaceUtils';

interface SearchReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

/**
 * プロジェクト横断の検索と一括置換モーダル。
 * キャラクター改名や表記ゆれ統一を、対象範囲を選択した上で一括適用する。
 */
export const SearchReplaceModal: React.FC<SearchReplaceModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const { currentProject, updateProject, createManualBackup } = useProject();
  const { showSuccess, showError } = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<ReplaceScope>>(new Set());
  const [createBackup, setCreateBackup] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);

  // モーダルを開くたびに初期化
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setReplacement('');
      setIsReplacing(false);
    }
  }, [isOpen, initialQuery]);

  const preview = useMemo(
    () => buildReplacePreview(currentProject, query),
    [currentProject, query]
  );

  // 検索語が変わったら、ヒットした全スコープを既定で選択
  useEffect(() => {
    setSelectedScopes(new Set(preview.scopes.map(info => info.scope)));
  }, [preview]);

  const selectedCount = useMemo(
    () =>
      preview.scopes
        .filter(info => selectedScopes.has(info.scope))
        .reduce((sum, info) => sum + info.count, 0),
    [preview, selectedScopes]
  );

  const toggleScope = (scope: ReplaceScope) => {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const handleReplace = async () => {
    if (!currentProject || !query || selectedCount === 0) return;

    setIsReplacing(true);
    try {
      if (createBackup) {
        await createManualBackup(`一括置換前（「${query}」→「${replacement}」）`);
      }

      const updates = applyReplace(currentProject, query, replacement, selectedScopes);
      await updateProject(updates, true);

      showSuccess(`${selectedCount}箇所を置換しました（「${query}」→「${replacement}」）`);
      onClose();
    } catch (error) {
      console.error('一括置換に失敗しました:', error);
      showError('一括置換に失敗しました。バックアップから復元できます。');
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Replace className="h-5 w-5 text-ai-600 dark:text-ai-400" />
          検索と置換
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* 入力欄 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="replace-query" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
              検索する文字列
            </label>
            <input
              id="replace-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例: 旧キャラクター名"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ai-500 font-['Noto_Sans_JP']"
            />
          </div>
          <div>
            <label htmlFor="replace-replacement" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
              置換後の文字列
            </label>
            <input
              id="replace-replacement"
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="例: 新キャラクター名"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ai-500 font-['Noto_Sans_JP']"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
          完全一致で検索します。置換後の文字列が空の場合は削除になります。
        </p>

        {/* ヒット状況と対象選択 */}
        {query && (
          preview.total > 0 ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-sm font-semibold text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                {preview.total}箇所が見つかりました — 置換する範囲を選択
              </div>
              {preview.scopes.map(info => (
                <label
                  key={info.scope}
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedScopes.has(info.scope)}
                      onChange={() => toggleScope(info.scope)}
                      className="h-4 w-4 rounded border-gray-300 text-ai-600 focus:ring-ai-500"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                      {info.label}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-ai-600 dark:text-ai-400 bg-ai-50 dark:bg-ai-900/30 px-2 py-0.5 rounded-full font-['Noto_Sans_JP']">
                    {info.count}件
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg font-['Noto_Sans_JP']">
              「{query}」は見つかりませんでした
            </div>
          )
        )}

        {/* バックアップオプション */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={createBackup}
            onChange={(e) => setCreateBackup(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-ai-600 focus:ring-ai-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
            実行前にバックアップを作成する（推奨）
          </span>
        </label>

        {/* 注意書き */}
        {selectedCount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-yamabuki-50 dark:bg-yellow-900/20 border border-yamabuki-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yamabuki-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
              選択した範囲の{selectedCount}箇所を一括で書き換えます。この操作は取り消せないため、バックアップの作成をおすすめします。
            </p>
          </div>
        )}

        {/* 実行ボタン */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-['Noto_Sans_JP']"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleReplace}
            disabled={!query || selectedCount === 0 || isReplacing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ai-600 text-white hover:bg-ai-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-['Noto_Sans_JP']"
          >
            {isReplacing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Replace className="h-4 w-4" />
            )}
            {selectedCount > 0 ? `${selectedCount}箇所を置換` : '置換'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
