import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Save, BookOpen, Users, Globe, Radio } from 'lucide-react';
import { useProject, TimelineEvent } from '../../contexts/ProjectContext';

interface TimelineViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryIcons: Record<TimelineEvent['category'], typeof BookOpen> = {
  plot: BookOpen,
  character: Users,
  world: Globe,
  other: Radio,
};

const categoryColors: Record<TimelineEvent['category'], string> = {
  plot: 'bg-blue-500',
  character: 'bg-pink-500',
  world: 'bg-green-500',
  other: 'bg-gray-500',
};

export const TimelineViewer: React.FC<TimelineViewerProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState<Partial<TimelineEvent>>({
    title: '',
    description: '',
    date: '',
    order: 0,
    chapterId: '',
    characterIds: [],
    category: 'plot',
  });

  const timeline = currentProject?.timeline || [];
  const chapters = currentProject?.chapters || [];
  const characters = currentProject?.characters || [];

  // フィルタリング
  const filteredTimeline = useMemo(() => {
    if (selectedCategory === 'all') return timeline;
    return timeline.filter(event => event.category === selectedCategory);
  }, [timeline, selectedCategory]);

  // ソート
  const sortedTimeline = useMemo(() => {
    return [...filteredTimeline].sort((a, b) => a.order - b.order);
  }, [filteredTimeline]);

  if (!isOpen || !currentProject) return null;

  const handleAddEvent = () => {
    if (!formData.title || !formData.description) {
      alert('タイトルと説明は必須です');
      return;
    }

    const newEvent: TimelineEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: formData.title,
      description: formData.description,
      date: formData.date || undefined,
      order: formData.order || 0,
      chapterId: formData.chapterId || undefined,
      characterIds: formData.characterIds || [],
      category: formData.category || 'plot',
    };

    if (editingEvent) {
      const updatedTimeline = timeline.map(e => (e.id === editingEvent.id ? newEvent : e));
      updateProject({ timeline: updatedTimeline });
    } else {
      updateProject({ timeline: [...timeline, newEvent] });
    }

    handleCloseForm();
  };

  const handleEditEvent = (event: TimelineEvent) => {
    setEditingEvent(event);
    setFormData(event);
    setShowAddForm(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!confirm('このイベントを削除しますか？')) return;

    updateProject({
      timeline: timeline.filter(e => e.id !== eventId),
    });
  };

  const handleReorder = (eventId: string, direction: 'up' | 'down') => {
    const eventIndex = sortedTimeline.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return;

    const newOrder = direction === 'up' 
      ? sortedTimeline[eventIndex].order - 1
      : sortedTimeline[eventIndex].order + 1;

    const updatedTimeline = timeline.map(e =>
      e.id === eventId ? { ...e, order: newOrder } : e
    );

    updateProject({ timeline: updatedTimeline });
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      date: '',
      order: timeline.length,
      chapterId: '',
      characterIds: [],
      category: 'plot',
    });
  };

  const getChapterTitle = (id: string) => {
    return chapters.find(c => c.id === id)?.title || '不明';
  };

  const getCharacterName = (id: string) => {
    return characters.find(c => c.id === id)?.name || '不明';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              タイムライン
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">追加</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* フィルタ */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">すべて</option>
              <option value="plot">プロット</option>
              <option value="character">キャラクター</option>
              <option value="world">世界</option>
              <option value="other">その他</option>
            </select>
          </div>
        </div>

        {/* タイムラインリスト */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedTimeline.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                まだイベントが登録されていません
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* タイムラインの線 */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-indigo-200 dark:bg-indigo-900"></div>

              {/* イベントリスト */}
              <div className="space-y-8">
                {sortedTimeline.map((event, index) => {
                  const Icon = categoryIcons[event.category];
                  const color = categoryColors[event.category];

                  return (
                    <div key={event.id} className="relative flex items-start">
                      {/* イベントドット */}
                      <div className={`relative z-10 ${color} rounded-full p-2 text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* イベントコンテンツ */}
                      <div className="flex-1 ml-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {event.title}
                              </h3>
                              {event.date && (
                                <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-['Noto_Sans_JP']">
                                  {event.date}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                              {event.description}
                            </p>
                            
                            {/* 関連情報 */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {event.chapterId && (
                                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                  <BookOpen className="h-4 w-4" />
                                  <span className="font-['Noto_Sans_JP']">{getChapterTitle(event.chapterId)}</span>
                                </div>
                              )}
                              {event.characterIds && event.characterIds.length > 0 && (
                                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                  <Users className="h-4 w-4" />
                                  <span className="font-['Noto_Sans_JP']">
                                    {event.characterIds.map(id => getCharacterName(id)).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleReorder(event.id, 'up')}
                              disabled={index === 0}
                              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="上に移動"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleReorder(event.id, 'down')}
                              disabled={index === sortedTimeline.length - 1}
                              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="下に移動"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleEditEvent(event)}
                              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 追加/編集フォーム */}
        {showAddForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    {editingEvent ? 'イベントを編集' : 'イベントを追加'}
                  </h3>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      タイトル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="例：魔王復活"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      説明 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                      placeholder="イベントの詳細"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      日付/時期
                    </label>
                    <input
                      type="text"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                      placeholder="例：物語開始後3年目、第一章"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      カテゴリ
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as TimelineEvent['category'] })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="plot">プロット</option>
                      <option value="character">キャラクター</option>
                      <option value="world">世界</option>
                      <option value="other">その他</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      関連する章
                    </label>
                    <select
                      value={formData.chapterId}
                      onChange={(e) => setFormData({ ...formData, chapterId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">なし</option>
                      {chapters.map(chapter => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      関連するキャラクター
                    </label>
                    <select
                      multiple
                      value={formData.characterIds}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        characterIds: Array.from(e.target.selectedOptions, option => option.value) 
                      })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      size={5}
                    >
                      {characters.map(char => (
                        <option key={char.id} value={char.id}>
                          {char.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
                      Ctrlキー（Windows）またはCmdキー（Mac）を押しながらクリックで複数選択
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-4 pt-4">
                    <button
                      onClick={handleCloseForm}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddEvent}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Save className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">保存</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


