import React, { useState } from 'react';
import {
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Target,
  Users,
  Sparkles,
  Wand2,
  Loader2,
} from 'lucide-react';
import type { Foreshadowing, ForeshadowingPoint } from '../../../../contexts/ProjectContext';
import { statusConfig, categoryConfig, importanceConfig, pointTypeConfig } from '../config';

interface ForeshadowingCardProps {
  foreshadowing: Foreshadowing;
  chapters: Array<{ id: string; title: string }>;
  characters: Array<{ id: string; name: string }>;
  isExpanded: boolean;
  isAILoading: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (foreshadowing: Foreshadowing) => void;
  onDelete: (id: string) => void;
  onAddPoint: (foreshadowingId: string, pointFormData: Partial<ForeshadowingPoint>, onSuccess: () => void) => void;
  onDeletePoint: (foreshadowingId: string, pointId: string) => void;
  onEnhance: (foreshadowing: Foreshadowing) => void;
  onSuggestPayoff: (foreshadowing: Foreshadowing) => void;
}

export const ForeshadowingCard: React.FC<ForeshadowingCardProps> = ({
  foreshadowing,
  chapters,
  characters,
  isExpanded,
  isAILoading,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddPoint,
  onDeletePoint,
  onEnhance,
  onSuggestPayoff,
}) => {
  const statusInfo = statusConfig[foreshadowing.status] || statusConfig.planted;
  const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
  const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
  const StatusIcon = statusInfo.icon;

  const [showPointForm, setShowPointForm] = useState(false);
  const [pointFormData, setPointFormData] = useState<Partial<ForeshadowingPoint>>({
    chapterId: '',
    type: 'plant',
    description: '',
    lineReference: '',
  });

  const getChapterTitle = (chapterId: string) => {
    return chapters.find(c => c.id === chapterId)?.title || '不明な章';
  };

  const getCharacterName = (characterId: string) => {
    return characters.find(c => c.id === characterId)?.name || '不明';
  };

  const handlePointSuccess = () => {
    setPointFormData({ chapterId: '', type: 'plant', description: '', lineReference: '' });
    setShowPointForm(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* ヘッダー */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`${statusInfo.color} p-2 rounded-lg flex-shrink-0`}>
              <StatusIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between sm:justify-start sm:items-center sm:space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] break-words">
                  {foreshadowing.title}
                </h3>
                <span className={`text-sm flex-shrink-0 ${importanceInfo.color}`}>
                  {importanceInfo.stars}
                </span>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <span className={`px-2 py-0.5 text-xs text-white rounded-full ${categoryInfo.color}`}>
                  {categoryInfo.label}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-['Noto_Sans_JP'] sm:line-clamp-2 break-words">
                {foreshadowing.description}
              </p>

              {/* ポイントサマリー */}
              {foreshadowing.points.length > 0 && (
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-sm">
                  {foreshadowing.points.map((point, idx) => {
                    const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                    return (
                      <div key={point.id} className="flex items-center">
                        <span className={`flex items-center space-x-1 ${pointTypeInfo.color}`}>
                          <span>{pointTypeInfo.icon}</span>
                          <span className="font-['Noto_Sans_JP']">
                            {chapters.findIndex(c => c.id === point.chapterId) + 1}章
                          </span>
                        </span>
                        {idx < foreshadowing.points.length - 1 && (
                          <span className="text-gray-300 dark:text-gray-600 ml-3">→</span>
                        )}
                      </div>
                    );
                  })}
                  {foreshadowing.plannedPayoffChapterId && foreshadowing.status !== 'resolved' && (
                    <div className="flex items-center">
                      <span className="text-gray-300 dark:text-gray-600 mr-3">→</span>
                      <span className="text-gray-400 font-['Noto_Sans_JP']">
                        🎯 {chapters.findIndex(c => c.id === foreshadowing.plannedPayoffChapterId) + 1}章(予定)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* タグ */}
              {foreshadowing.tags && foreshadowing.tags.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-2">
                  {foreshadowing.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full font-['Noto_Sans_JP']"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 mt-4 sm:mt-0 sm:ml-4 justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-700">
            <button
              onClick={() => onToggleExpand(foreshadowing.id)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isExpanded ? '閉じる' : '詳細を表示'}
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            <button
              onClick={() => onEdit(foreshadowing)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="編集"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(foreshadowing.id)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="削除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 展開コンテンツ */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          {/* ポイント一覧 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">ポイント</h4>
              <button
                onClick={() => setShowPointForm(true)}
                className="flex items-center space-x-1 text-sm text-rose-600 dark:text-rose-400 hover:underline font-['Noto_Sans_JP']"
              >
                <Plus className="h-4 w-4" />
                <span>追加</span>
              </button>
            </div>

            {foreshadowing.points.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <Target className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                  ポイントがまだ登録されていません
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                  伏線の設置、ヒント、回収のポイントを追加しましょう
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {foreshadowing.points
                  .sort((a, b) => {
                    const chapterOrderA = chapters.findIndex(c => c.id === a.chapterId);
                    const chapterOrderB = chapters.findIndex(c => c.id === b.chapterId);
                    return chapterOrderA - chapterOrderB;
                  })
                  .map(point => {
                    const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                    return (
                      <div
                        key={point.id}
                        className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <span className="text-lg">{pointTypeInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`text-sm font-medium ${pointTypeInfo.color}`}>
                              {pointTypeInfo.label}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                              第{chapters.findIndex(c => c.id === point.chapterId) + 1}章「{getChapterTitle(point.chapterId)}」
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {point.description}
                          </p>
                          {point.lineReference && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic font-['Noto_Sans_JP']">
                              「{point.lineReference}」
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => onDeletePoint(foreshadowing.id, point.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ポイント追加フォーム */}
            {showPointForm && (
              <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-rose-200 dark:border-rose-800">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                  ポイントを追加
                </h5>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                        タイプ
                      </label>
                      <select
                        value={pointFormData.type}
                        onChange={(e) => setPointFormData({ ...pointFormData, type: e.target.value as ForeshadowingPoint['type'] })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="plant">📍 設置</option>
                        <option value="hint">💡 ヒント</option>
                        <option value="payoff">🎯 回収</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                        章 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={pointFormData.chapterId}
                        onChange={(e) => setPointFormData({ ...pointFormData, chapterId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">選択してください</option>
                        {chapters.map((chapter, idx) => (
                          <option key={chapter.id} value={chapter.id}>
                            第{idx + 1}章: {chapter.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                      説明 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={pointFormData.description}
                      onChange={(e) => setPointFormData({ ...pointFormData, description: e.target.value })}
                      rows={2}
                      placeholder="このポイントの内容..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                      台詞・地の文（任意）
                    </label>
                    <input
                      type="text"
                      value={pointFormData.lineReference}
                      onChange={(e) => setPointFormData({ ...pointFormData, lineReference: e.target.value })}
                      placeholder="関連する台詞や描写..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowPointForm(false)}
                      className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-['Noto_Sans_JP']"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => onAddPoint(foreshadowing.id, pointFormData, handlePointSuccess)}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 関連キャラクター */}
          {foreshadowing.relatedCharacterIds && foreshadowing.relatedCharacterIds.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>関連キャラクター</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {foreshadowing.relatedCharacterIds.map(charId => (
                  <span
                    key={charId}
                    className="px-2 py-1 text-sm bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-['Noto_Sans_JP']"
                  >
                    {getCharacterName(charId)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 回収予定 */}
          {foreshadowing.plannedPayoffChapterId && foreshadowing.status !== 'resolved' && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>回収予定</span>
              </h4>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                  第{chapters.findIndex(c => c.id === foreshadowing.plannedPayoffChapterId) + 1}章「{getChapterTitle(foreshadowing.plannedPayoffChapterId)}」
                </p>
                {foreshadowing.plannedPayoffDescription && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                    {foreshadowing.plannedPayoffDescription}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* メモ */}
          {foreshadowing.notes && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">メモ</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                {foreshadowing.notes}
              </p>
            </div>
          )}

          {/* AIアクション */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>AIアシスト</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onEnhance(foreshadowing)}
                disabled={isAILoading}
                className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
              >
                {isAILoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                <span>強化提案</span>
              </button>
              {foreshadowing.status !== 'resolved' && (
                <button
                  onClick={() => onSuggestPayoff(foreshadowing)}
                  disabled={isAILoading}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                >
                  {isAILoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  <span>回収タイミング提案</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
