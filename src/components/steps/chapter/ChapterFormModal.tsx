import React from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../../contexts/ProjectContext';
import { ChapterFormData } from './types';

interface ChapterFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: ChapterFormData;
  onFormDataChange: (data: ChapterFormData) => void;
  onClose: () => void;
  onSubmit: () => void;
  onCharacterToggle: (characterId: string) => void;
  onKeyEventChange: (index: number, value: string) => void;
  onAddKeyEvent: () => void;
  onRemoveKeyEvent: (index: number) => void;
}

export const ChapterFormModal: React.FC<ChapterFormModalProps> = ({
  isOpen,
  mode,
  formData,
  onFormDataChange,
  onClose,
  onSubmit,
  onCharacterToggle,
  onKeyEventChange,
  onAddKeyEvent,
  onRemoveKeyEvent,
}) => {
  const { currentProject } = useProject();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95">
        <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              {mode === 'add' ? '新しい章を追加' : '章を編集'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                章タイトル *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
                placeholder="例：第1章 異世界への扉"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                章の概要
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => onFormDataChange({ ...formData, summary: e.target.value })}
                placeholder="この章で起こることや目標を簡潔に説明してください"
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
              <div className="mt-1 text-right">
                <span className={`text-xs font-['Noto_Sans_JP'] ${formData.summary.length > 300
                  ? 'text-red-500 dark:text-red-400'
                  : formData.summary.length > 200
                    ? 'text-yellow-500 dark:text-yellow-400'
                    : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  {formData.summary.length} 文字
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                設定・場所
              </label>
              <textarea
                value={formData.setting}
                onChange={(e) => onFormDataChange({ ...formData, setting: e.target.value })}
                placeholder="この章の舞台となる場所や設定を詳細に入力（例：学校の屋上、夕方、雨が降り始めている）"
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                雰囲気・ムード
              </label>
              <input
                type="text"
                value={formData.mood}
                onChange={(e) => onFormDataChange({ ...formData, mood: e.target.value })}
                placeholder="この章の雰囲気やムードを入力（例：緊張感、和やか、悲壮感など）"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                登場キャラクター
              </label>
              <div className="space-y-3">
                {/* キャラクター選択 */}
                {currentProject && currentProject.characters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentProject.characters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => onCharacterToggle(character.id)}
                        className={`px-3 py-1 rounded-full text-sm transition-all ${formData.characters.includes(character.id)
                          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        {character.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center">
                      キャラクターが設定されていません。キャラクター設定からキャラクターを追加してください。
                    </p>
                  </div>
                )}

                {/* 選択されたキャラクター表示 */}
                {formData.characters.length > 0 && currentProject && (
                  <div className="flex flex-wrap gap-2">
                    {formData.characters.map((characterId) => {
                      const character = currentProject.characters.find(c => c.id === characterId);
                      return character ? (
                        <div
                          key={characterId}
                          className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                        >
                          <span>{character.name}</span>
                          <button
                            onClick={() => onCharacterToggle(characterId)}
                            className="ml-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}

                {/* 手動入力 */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="キャラクター名を手動入力"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.currentTarget.value.trim();
                        if (input && !formData.characters.includes(input)) {
                          onFormDataChange({
                            ...formData,
                            characters: [...formData.characters, input]
                          });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                      const value = input?.value.trim();
                      if (value && !formData.characters.includes(value)) {
                        onFormDataChange({
                          ...formData,
                          characters: [...formData.characters, value]
                        });
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP'] text-sm"
                  >
                    追加
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                重要な出来事
              </label>
              <div className="space-y-2">
                {formData.keyEvents.map((event, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={event}
                      onChange={(e) => onKeyEventChange(index, e.target.value)}
                      placeholder="重要な出来事を入力"
                      className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveKeyEvent(index)}
                      className="p-2 text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={onAddKeyEvent}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors font-['Noto_Sans_JP']"
                >
                  + 出来事を追加
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/20 dark:border-white/10 bg-white/30 dark:bg-gray-700/30 shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/50 transition-colors font-['Noto_Sans_JP'] font-medium"
            >
              キャンセル
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] font-medium shadow-lg"
            >
              {mode === 'add' ? '章を追加' : '更新'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


































