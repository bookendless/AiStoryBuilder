import React from 'react';
import { Save, X, Tag } from 'lucide-react';
import type { Foreshadowing } from '../../../../contexts/ProjectContext';
import { Modal } from '../../../common/Modal';
import { categoryConfig } from '../config';

interface Character {
  id: string;
  name: string;
  role: string;
}

interface Chapter {
  id: string;
  title: string;
}

interface ForeshadowingFormModalProps {
  isOpen: boolean;
  editingForeshadowing: Foreshadowing | null;
  formData: Partial<Foreshadowing>;
  setFormData: (data: Partial<Foreshadowing>) => void;
  plantChapterId: string;
  setPlantChapterId: (id: string) => void;
  tagInput: string;
  setTagInput: (input: string) => void;
  chapters: Chapter[];
  characters: Character[];
  onSave: () => void;
  onClose: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

export const ForeshadowingFormModal: React.FC<ForeshadowingFormModalProps> = ({
  isOpen,
  editingForeshadowing,
  formData,
  setFormData,
  plantChapterId,
  setPlantChapterId,
  tagInput,
  setTagInput,
  chapters,
  characters,
  onSave,
  onClose,
  onAddTag,
  onRemoveTag,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingForeshadowing ? '伏線を編集' : '新しい伏線を追加'}
      size="md"
      className="z-[60]"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="例：主人公の過去の秘密"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            説明 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder="この伏線の内容と意図..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              重要度
            </label>
            <select
              value={formData.importance}
              onChange={(e) => setFormData({ ...formData, importance: e.target.value as Foreshadowing['importance'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="high">★★★ 高</option>
              <option value="medium">★★☆ 中</option>
              <option value="low">★☆☆ 低</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              ステータス
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Foreshadowing['status'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="planted">設置済み</option>
              <option value="hinted">進行中</option>
              <option value="resolved">回収済み</option>
              <option value="abandoned">破棄</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              カテゴリ
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as Foreshadowing['category'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            関連キャラクター
          </label>
          <select
            multiple
            value={formData.relatedCharacterIds || []}
            onChange={(e) => setFormData({
              ...formData,
              relatedCharacterIds: Array.from(e.target.selectedOptions, option => option.value)
            })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            size={4}
          >
            {characters.map(char => (
              <option key={char.id} value={char.id}>
                {char.name} ({char.role})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
            Ctrlキー（Windows）またはCmdキー（Mac）を押しながらクリックで複数選択
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            始まりの章（設置する章）
          </label>
          <select
            value={plantChapterId}
            onChange={(e) => setPlantChapterId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">未設定</option>
            {chapters.map((chapter, idx) => (
              <option key={chapter.id} value={chapter.id}>
                第{idx + 1}章: {chapter.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
            この伏線を最初に設置する章を選択してください
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            回収予定の章
          </label>
          <select
            value={formData.plannedPayoffChapterId || ''}
            onChange={(e) => setFormData({ ...formData, plannedPayoffChapterId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">未定</option>
            {chapters.map((chapter, idx) => (
              <option key={chapter.id} value={chapter.id}>
                第{idx + 1}章: {chapter.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            回収方法の計画
          </label>
          <textarea
            value={formData.plannedPayoffDescription || ''}
            onChange={(e) => setFormData({ ...formData, plannedPayoffDescription: e.target.value })}
            rows={2}
            placeholder="どのように回収する予定か..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            タグ
          </label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
              placeholder="タグを入力してEnter"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
            />
            <button
              type="button"
              onClick={onAddTag}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              <Tag className="h-5 w-5" />
            </button>
          </div>
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-sm bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full font-['Noto_Sans_JP']"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="ml-1 text-rose-500 hover:text-rose-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            メモ
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="作者メモ..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
          />
        </div>

        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Save className="h-5 w-5" />
            <span className="font-['Noto_Sans_JP']">保存</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
