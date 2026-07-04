import React, { useState, useEffect } from 'react';
import { GitCompare, Plus, Minus, PencilLine, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal } from './common/Modal';
import { databaseService } from '../services/databaseService';
import { useProject } from '../contexts/ProjectContext';
import { diffSnapshots, SectionDiff, ChangeKind } from '../utils/snapshotDiff';

interface SnapshotCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupId: string | null;
  backupDescription: string;
  backupCreatedAt: Date | null;
}

const KIND_STYLES: Record<ChangeKind, { icon: React.ReactNode; className: string; label: string }> = {
  added: {
    icon: <Plus className="h-4 w-4" />,
    className: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    label: '追加',
  },
  removed: {
    icon: <Minus className="h-4 w-4" />,
    className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    label: '削除',
  },
  modified: {
    icon: <PencilLine className="h-4 w-4" />,
    className: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    label: '変更',
  },
  unchanged: {
    icon: null,
    className: 'text-gray-500',
    label: '変更なし',
  },
};

/**
 * スナップショット（バックアップ）と現在のプロジェクトを比較するモーダル。
 * 復元前に「何がどう変わったか」をセクション単位で確認できる。
 */
export const SnapshotCompareModal: React.FC<SnapshotCompareModalProps> = ({
  isOpen,
  onClose,
  backupId,
  backupDescription,
  backupCreatedAt,
}) => {
  const { currentProject } = useProject();
  const [changes, setChanges] = useState<SectionDiff[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !backupId || !currentProject) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setChanges(null);

    (async () => {
      try {
        const backupProject = await databaseService.getBackupProject(backupId);
        if (cancelled) return;
        if (!backupProject) {
          setError('バックアップデータを読み込めませんでした');
          return;
        }
        const result = diffSnapshots(backupProject, currentProject);
        if (!cancelled) setChanges(result.changes);
      } catch (e) {
        console.error('スナップショット比較エラー:', e);
        if (!cancelled) setError('比較中にエラーが発生しました');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, backupId, currentProject]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-ai-600 dark:text-ai-400" />
          スナップショットと現在の比較
        </span>
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          <span className="font-semibold text-gray-800 dark:text-gray-200">「{backupDescription}」</span>
          {backupCreatedAt && (
            <span>（{new Date(backupCreatedAt).toLocaleString('ja-JP')}時点）</span>
          )}
          <span> と現在のプロジェクトを比較しています。</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            <Loader2 className="h-5 w-5 animate-spin" />
            比較しています…
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 font-['Noto_Sans_JP']">
            {error}
          </div>
        )}

        {!isLoading && !error && changes && (
          changes.length === 0 ? (
            <div className="flex items-center gap-2 py-10 justify-center text-green-700 dark:text-green-400 font-['Noto_Sans_JP']">
              <CheckCircle2 className="h-5 w-5" />
              このスナップショットと現在のプロジェクトに違いはありません
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                {changes.length}件の変更（スナップショット → 現在）
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-[55vh] overflow-y-auto">
                {changes.map((change, index) => {
                  const style = KIND_STYLES[change.kind];
                  return (
                    <div key={index} className="flex items-start gap-3 px-3 py-2.5">
                      <span className={`flex items-center gap-1 flex-shrink-0 text-xs font-semibold px-2 py-1 rounded ${style.className} font-['Noto_Sans_JP']`}>
                        {style.icon}
                        {style.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                          {change.label}
                        </p>
                        {change.detail && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            {change.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                ※ このスナップショットに復元すると、上記の「現在」側の変更は失われます。
              </p>
            </>
          )
        )}

        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-['Noto_Sans_JP']"
          >
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
};
