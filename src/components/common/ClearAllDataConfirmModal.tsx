import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ClearAllDataConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearAllDataConfirmModal: React.FC<ClearAllDataConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // モーダルが開いたときにリセットし、フォーカス
  useEffect(() => {
    if (isOpen) {
      setInput('');
      // 少し遅延させてフォーカス（モーダルのアニメーション完了後）
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === 'DELETE') {
      onConfirm();
      onClose();
    }
  };

  const handleCancel = () => {
    setInput('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="すべてのデータを削除しますか？"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP'] whitespace-pre-line">
            すべてのプロジェクトとバックアップを削除します。この操作は取り消せません。確認のため「DELETE」と入力してください：
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-['Noto_Sans_JP']"
            placeholder="DELETE"
            autoFocus
          />
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
            disabled={input !== 'DELETE'}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors font-['Noto_Sans_JP']"
          >
            削除
          </button>
        </div>
      </form>
    </Modal>
  );
};



























