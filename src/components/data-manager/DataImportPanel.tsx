import React from 'react';
import { Upload } from 'lucide-react';
import type { ImportProgress } from '../../services/data-transfer/types';
import { formatBytes } from '../../utils/formatBytes';

interface DataImportPanelProps {
  isBusy: boolean;
  /** 取り込み中のみ値が入る */
  progress: ImportProgress | null;
  onFileSelected: (file: File) => void;
}

export const DataImportPanel: React.FC<DataImportPanelProps> = ({
  isBusy,
  progress,
  onFileSelected,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 確認後に処理するため、入力はここでリセットしておく
    event.target.value = '';
    if (file) onFileSelected(file);
  };

  const percent = progress && progress.totalBytes
    ? Math.min(100, Math.round((progress.bytesRead / progress.totalBytes) * 100))
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
          データのインポート
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          以前にエクスポートしたJSONファイルからデータを復元します。
          ファイルサイズの上限はありません（大きなファイルは読み込みに数分かかることがあります）。
          同じIDのデータは上書きされます。
        </p>
      </div>

      <div className="relative inline-block">
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleChange}
          disabled={isBusy}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <button
          disabled={isBusy}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
        >
          <Upload className="h-4 w-4" />
          <span>ファイルを選択してインポート</span>
        </button>
      </div>

      {progress && (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            <span>読み込み中</span>
            <span>
              {formatBytes(progress.bytesRead)}
              {progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ''}
              {percent !== null ? `（${percent}%）` : ''}
            </span>
          </div>
          <div className="h-2 w-full bg-green-100 dark:bg-green-950 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-green-600 transition-all duration-200"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
            作品 {progress.counts.projects}・バックアップ {progress.counts.backups}・
            履歴 {progress.counts.histories}・AIログ {progress.counts.aiLogs}・
            画像 {progress.counts.images}
          </p>
        </div>
      )}
    </div>
  );
};
