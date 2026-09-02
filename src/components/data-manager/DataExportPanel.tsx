import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, HardDrive, Trash2, Clock } from 'lucide-react';
import { databaseService } from '../../services/databaseService';
import type { StorageBreakdown, ProjectStorageInfo } from '../../services/data-transfer/types';
import {
  DEFAULT_EXPORT_CONTENT,
  buildExportFilename,
  estimateExportSize,
  estimateProjectSize,
  sumAutoBackups,
  type ExportContentOptions,
} from '../../services/data-transfer/exportEstimate';
import { Project } from '../../contexts/ProjectContext';
import { useToast } from '../useToast';
import { getUserFriendlyError } from '../../utils/errorHandler';
import { exportFile } from '../../utils/mobileExportUtils';
import { isAndroidEnvironment } from '../../utils/platformUtils';
import { formatBytes } from '../../utils/formatBytes';

export interface DeleteAutoBackupsRequest {
  scope: 'selected' | 'all';
  projectIds: string[];
  count: number;
  bytes: number;
}

interface DataExportPanelProps {
  projects: Project[];
  currentProject: Project | null;
  isBusy: boolean;
  setBusy: (busy: boolean) => void;
  /** 値が変わるたびに容量内訳を取り直す */
  refreshToken: number;
  onDataChanged: () => Promise<void> | void;
  onRequestDeleteAutoBackups: (request: DeleteAutoBackupsRequest) => void;
}

/** サイズが大きくなりすぎたときに注意を促すしきい値 */
const LARGE_EXPORT_WARNING_BYTES = 200 * 1024 * 1024;

const CONTENT_OPTIONS: Array<{
  key: keyof ExportContentOptions;
  label: string;
  hint?: string;
}> = [
    { key: 'includeManualBackups', label: '手動バックアップ' },
    { key: 'includeAutoBackups', label: '自動バックアップ', hint: 'ファイルが大きくなる主な原因です' },
    { key: 'includeHistories', label: '章の履歴' },
    { key: 'includeAILogs', label: 'AIログ' },
    { key: 'includeImages', label: '画像', hint: '画像ボードの画像を含めます' },
    { key: 'includeSettings', label: 'アプリ設定', hint: 'すべての作品を選んだときのみ含められます' },
  ];

export const DataExportPanel: React.FC<DataExportPanelProps> = ({
  projects,
  currentProject,
  isBusy,
  setBusy,
  refreshToken,
  onDataChanged,
  onRequestDeleteAutoBackups,
}) => {
  const { showError, showSuccess } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(projects.map(p => p.id)));
  const [options, setOptions] = useState<ExportContentOptions>(DEFAULT_EXPORT_CONTENT);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  // これまでに一覧へ出てきた作品ID。新規作品を既定で選択済みにするために使う
  const knownIdsRef = useRef<Set<string>>(new Set(projects.map(p => p.id)));

  useEffect(() => {
    let cancelled = false;
    void isAndroidEnvironment().then(result => {
      if (!cancelled) setIsAndroid(result);
    });
    return () => { cancelled = true; };
  }, []);

  // 作品が増減しても選択状態を保つ。消えた作品は落とし、新しい作品は選択済みにする
  useEffect(() => {
    setSelectedIds(prev => {
      const currentIds = projects.map(p => p.id);
      const currentIdSet = new Set(currentIds);
      const next = new Set<string>();
      for (const id of prev) {
        if (currentIdSet.has(id)) next.add(id);
      }
      for (const id of currentIds) {
        if (!knownIdsRef.current.has(id)) next.add(id);
      }
      knownIdsRef.current = currentIdSet;
      return next;
    });
  }, [projects]);

  const loadBreakdown = useCallback(async () => {
    setIsLoadingBreakdown(true);
    try {
      const result = await databaseService.getProjectStorageBreakdown();
      setBreakdown(result);
    } catch (error) {
      console.error('容量内訳の取得に失敗:', error);
      setBreakdown(null);
    } finally {
      setIsLoadingBreakdown(false);
    }
  }, []);

  useEffect(() => {
    void loadBreakdown();
  }, [loadBreakdown, refreshToken]);

  const infoById = useMemo(() => {
    const map = new Map<string, ProjectStorageInfo>();
    for (const info of breakdown?.projects ?? []) {
      map.set(info.projectId, info);
    }
    return map;
  }, [breakdown]);

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;

  // 設定は端末全体の値なので、一部の作品だけを書き出すときは含めない
  const effectiveOptions = useMemo<ExportContentOptions>(() => ({
    ...options,
    includeSettings: options.includeSettings && allSelected,
  }), [options, allSelected]);

  const estimatedBytes = useMemo(() => {
    if (!breakdown) return null;
    return estimateExportSize(breakdown, selectedIds, effectiveOptions);
  }, [breakdown, selectedIds, effectiveOptions]);

  const selectedAutoBackups = useMemo(() => {
    if (!breakdown) return { count: 0, bytes: 0 };
    return sumAutoBackups(breakdown, selectedIds);
  }, [breakdown, selectedIds]);

  const toggleProject = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev => (prev.size === projects.length ? new Set() : new Set(projects.map(p => p.id))));
  };

  const toggleOption = (key: keyof ExportContentOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportProjects = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    setBusy(true);
    try {
      const targets = projects.filter(p => ids.includes(p.id));
      const exportAll = ids.length === projects.length;
      const now = new Date();

      let content: string | Blob;
      let filename: string;

      if (isAndroid) {
        // Android は端末のメモリが限られるため、1作品だけの軽量エクスポートに絞る。
        // 複数選ばれている場合は編集中の作品を優先する
        const target = targets.length === 1
          ? targets[0]
          : (targets.find(p => p.id === currentProject?.id) ?? targets[0] ?? currentProject);
        if (!target) {
          showError('エクスポートする作品を選択してください', 5000);
          return;
        }
        content = await databaseService.exportData({
          projectIds: [target.id],
          includeManualBackups: false,
          includeAutoBackups: false,
          includeHistories: false,
          includeAILogs: false,
          includeImages: false,
          includeSettings: false,
          excludeImageData: true,
          returnBlob: false,
        }) as string;

        if (new Blob([content]).size < 100) {
          throw new Error('エクスポートするデータが空です。データベースにデータが存在するか確認してください。');
        }
        filename = buildExportFilename(targets, false, now, 'lightweight');
      } else {
        content = await databaseService.exportData({
          projectIds: exportAll ? undefined : ids,
          includeManualBackups: effectiveOptions.includeManualBackups,
          includeAutoBackups: effectiveOptions.includeAutoBackups,
          includeHistories: effectiveOptions.includeHistories,
          includeAILogs: effectiveOptions.includeAILogs,
          includeImages: effectiveOptions.includeImages,
          includeSettings: effectiveOptions.includeSettings,
          returnBlob: true,
        }) as Blob;
        filename = buildExportFilename(targets, exportAll, now);
      }

      const result = await exportFile({
        filename,
        content,
        mimeType: 'application/json',
        title: 'データバックアップ',
        dialogTitle: 'バックアップファイルを保存',
      });

      switch (result.method) {
        case 'tauri':
          showSuccess('ファイルを指定の場所に保存しました', 3000);
          break;
        case 'share':
          showSuccess('共有メニューを開きました。ファイルを保存する場所を選択してください。', 5000);
          break;
        case 'download':
          showSuccess('ダウンロードを開始しました（ダウンロードフォルダを確認してください）', 5000);
          break;
        case 'cancelled':
          break;
        default:
          showError(result.error || 'エクスポートに失敗しました', 7000, { title: 'エクスポートエラー' });
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: 'エクスポートエラー',
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setBusy(false);
    }
  }, [projects, currentProject, isAndroid, effectiveOptions, setBusy, showError, showSuccess]);

  const handleExportSelected = () => {
    void exportProjects([...selectedIds]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
          データのエクスポート
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          作品と含める内容を選んで、JSONファイルとして保存します。
          {isAndroid && ' Androidでは現在の作品のみの軽量エクスポートになります。'}
        </p>
      </div>

      {/* 作品の選択 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            エクスポートする作品
          </h4>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              {selectedIds.size}/{projects.length} 件選択
            </span>
            <button
              onClick={toggleAll}
              disabled={isBusy || projects.length === 0}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 font-medium font-['Noto_Sans_JP']"
            >
              {allSelected ? 'すべて解除' : 'すべて選択'}
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center font-['Noto_Sans_JP']">
            エクスポートできる作品がありません
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {projects.map(project => {
              const info = infoById.get(project.id);
              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-white/70 dark:bg-gray-800/50"
                >
                  <label className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(project.id)}
                      onChange={() => toggleProject(project.id)}
                      disabled={isBusy}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {project.title || '無題の作品'}
                        {currentProject?.id === project.id && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded font-['Noto_Sans_JP']">
                            編集中
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
                        {' ・ '}
                        {info ? formatBytes(estimateProjectSize(info, effectiveOptions)) : '計算中…'}
                      </span>
                    </span>
                  </label>
                  <button
                    onClick={() => void exportProjects([project.id])}
                    disabled={isBusy}
                    className="shrink-0 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                    title="この作品だけをエクスポート"
                  >
                    この作品のみ
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 含める内容 */}
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
          含める内容
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONTENT_OPTIONS.map(option => {
            const disabled = isBusy || (option.key === 'includeSettings' && !allSelected);
            return (
              <label
                key={option.key}
                className={`flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={option.key === 'includeSettings' ? effectiveOptions.includeSettings : options[option.key]}
                  onChange={() => toggleOption(option.key)}
                  disabled={disabled}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block">{option.label}</span>
                  {option.hint && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{option.hint}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 推定サイズと実行 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">推定サイズ</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            {isLoadingBreakdown || estimatedBytes === null ? '計算中…' : `約 ${formatBytes(estimatedBytes)}`}
          </span>
        </div>

        {estimatedBytes !== null && estimatedBytes > LARGE_EXPORT_WARNING_BYTES && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 font-['Noto_Sans_JP']">
            大きなファイルになります。自動バックアップを外すか、作品を分けてエクスポートすることをおすすめします。
          </p>
        )}

        <button
          onClick={handleExportSelected}
          disabled={isBusy || selectedIds.size === 0}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
        >
          <Download className="h-4 w-4" />
          <span>選択した作品をエクスポート</span>
        </button>
      </div>

      {/* 自動バックアップの整理 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center space-x-2 mb-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            自動バックアップの整理
          </h4>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
          自動バックアップは編集内容が変わるたびに作られ、エクスポートファイルを大きくします。
          ここから作品を開かずにまとめて削除できます。手動バックアップは削除されません。
        </p>

        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-3 font-['Noto_Sans_JP']">
          <div className="flex items-center justify-between">
            <span>選択した作品</span>
            <span>{selectedAutoBackups.count}件 / {formatBytes(selectedAutoBackups.bytes)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>すべての作品</span>
            <span>
              {breakdown?.totalAutoBackupCount ?? 0}件 / {formatBytes(breakdown?.totalAutoBackupBytes ?? 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => onRequestDeleteAutoBackups({
              scope: 'selected',
              projectIds: [...selectedIds],
              count: selectedAutoBackups.count,
              bytes: selectedAutoBackups.bytes,
            })}
            disabled={isBusy || selectedAutoBackups.count === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-['Noto_Sans_JP']"
          >
            <Trash2 className="h-4 w-4 inline mr-2" />
            選択した作品の分を削除
          </button>
          <button
            onClick={() => onRequestDeleteAutoBackups({
              scope: 'all',
              projectIds: [],
              count: breakdown?.totalAutoBackupCount ?? 0,
              bytes: breakdown?.totalAutoBackupBytes ?? 0,
            })}
            disabled={isBusy || (breakdown?.totalAutoBackupCount ?? 0) === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-['Noto_Sans_JP']"
          >
            <Trash2 className="h-4 w-4 inline mr-2" />
            すべての作品の分を削除
          </button>
        </div>
      </div>

      <button
        onClick={() => { void loadBreakdown(); void onDataChanged(); }}
        disabled={isBusy || isLoadingBreakdown}
        className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 font-['Noto_Sans_JP']"
      >
        <HardDrive className="h-3 w-3" />
        <span>容量を再計算</span>
      </button>
    </div>
  );
};
