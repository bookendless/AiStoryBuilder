import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../common/Modal';
import { Save } from 'lucide-react';

interface BackupDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (description: string) => void;
  defaultDescription?: string;
}

export const BackupDescriptionModal: React.FC<BackupDescriptionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultDescription = '草案作業時のバックアップ',
}) => {
  const [description, setDescription] = useState(defaultDescription);
  const inputRef = useRef<HTMLInputElement>(null);

  // モーダルが開いたときに初期値を設定し、フォーカス
  useEffect(() => {
    if (isOpen) {
      setDescription(defaultDescription);
      // 少し遅延させてフォーカス（モーダルのアニメーション完了後）
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onConfirm(description.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    setDescription(defaultDescription);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="手動バックアップの作成"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="backup-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']"
          >
            バックアップの説明
          </label>
          <input
            ref={inputRef}
            id="backup-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
            placeholder="バックアップの説明を入力してください"
            maxLength={100}
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            {description.length}/100文字
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!description.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-['Noto_Sans_JP']"
          >
            <Save className="h-4 w-4" />
            バックアップを作成
          </button>
        </div>
      </form>
    </Modal>
  );
};













