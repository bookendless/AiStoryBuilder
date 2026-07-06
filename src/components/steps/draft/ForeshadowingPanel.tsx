import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Plus,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  EyeOff,
  Copy,
  X,
} from 'lucide-react';
import { useProject, Foreshadowing, ForeshadowingPoint } from '../../../contexts/ProjectContext';

interface ForeshadowingPanelProps {
  currentChapterId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ステータス設定
const statusConfig: Record<Foreshadowing['status'], { label: string; color: string; icon: typeof Clock }> = {
  planted: { label: '設置済み', color: 'bg-blue-500', icon: Target },
  hinted: { label: '進行中', color: 'bg-amber-500', icon: Clock },
  resolved: { label: '回収済み', color: 'bg-green-500', icon: CheckCircle },
  abandoned: { label: '破棄', color: 'bg-gray-500', icon: EyeOff },
};

// カテゴリ設定
const categoryConfig: Record<Foreshadowing['category'], { label: string; color: string }> = {
  character: { label: 'キャラ', color: 'bg-pink-500' },
  plot: { label: 'プロット', color: 'bg-blue-500' },
  world: { label: '世界観', color: 'bg-green-500' },
  mystery: { label: 'ミステリー', color: 'bg-purple-500' },
  relationship: { label: '関係性', color: 'bg-rose-500' },
  other: { label: 'その他', color: 'bg-gray-500' },
};

// ポイントタイプ設定
const pointTypeConfig: Record<ForeshadowingPoint['type'], { label: string; icon: string; color: string }> = {
  plant: { label: '設置', icon: '📍', color: 'text-blue-600' },
  hint: { label: 'ヒント', icon: '💡', color: 'text-amber-600' },
  payoff: { label: '回収', icon: '🎯', color: 'text-green-600' },
};

export const ForeshadowingPanel: React.FC<ForeshadowingPanelProps> = ({
  currentChapterId,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { currentProject, updateProject } = useProject();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAllForeshadowings, setShowAllForeshadowings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQuickAddForm, setShowQuickAddForm] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    foreshadowingId: '',
    type: 'plant' as ForeshadowingPoint['type'],
    description: '',
  });
  // ステータス変更用のドロップダウン表示管理
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // フォールバックの空配列で下流useMemoの依存が毎レンダー変化しないようメモ化
  const foreshadowings = useMemo(
    () => currentProject?.foreshadowings || [],
    [currentProject?.foreshadowings]
  );
  const chapters = useMemo(
    () => currentProject?.chapters || [],
    [currentProject?.chapters]
  );

  // 現在の章に関連する伏線を取得
  const relatedForeshadowings = useMemo(() => {
    if (!currentChapterId) return [];

    return foreshadowings.filter(f => {
      // この章にポイントがある伏線
      const hasPointInChapter = f.points.some(p => p.chapterId === currentChapterId);
      // この章が回収予定の伏線
      const isPlannedPayoff = f.plannedPayoffChapterId === currentChapterId;
      // 関連章として設定されている伏線
      const isRelatedChapter = f.relatedChapterIds?.includes(currentChapterId);

      return hasPointInChapter || isPlannedPayoff || isRelatedChapter;
    });
  }, [foreshadowings, currentChapterId]);

  // 未回収の伏線（回収予定がこの章より後または未設定）
  const unresolvedForeshadowings = useMemo(() => {
    if (!currentChapterId) return [];

    const currentChapterIdx = chapters.findIndex(c => c.id === currentChapterId);

    return foreshadowings.filter(f => {
      if (f.status === 'resolved' || f.status === 'abandoned') return false;

      // 設置済みでまだこの章以前に設置されているもの
      const hasPlantBeforeOrAtChapter = f.points.some(p => {
        const pointChapterIdx = chapters.findIndex(c => c.id === p.chapterId);
        return p.type === 'plant' && pointChapterIdx <= currentChapterIdx;
      });

      return hasPlantBeforeOrAtChapter;
    });
  }, [foreshadowings, currentChapterId, chapters]);

  // 表示する伏線リスト
  const displayForeshadowings = showAllForeshadowings ? foreshadowings : relatedForeshadowings;

  // 展開/折りたたみ
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // ステータス変更ハンドラー
  const handleStatusChange = (foreshadowingId: string, newStatus: Foreshadowing['status']) => {
    const updatedForeshadowings = foreshadowings.map(f =>
      f.id === foreshadowingId
        ? { ...f, status: newStatus, updatedAt: new Date() }
        : f
    );
    updateProject({ foreshadowings: updatedForeshadowings });
    setStatusDropdownId(null);
  };

  // テキストをコピー
  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました', err);
    }
  };

  // クイック追加フォームのハンドラー
  const handleQuickAddPoint = () => {
    if (!quickAddData.foreshadowingId || !quickAddData.description || !currentChapterId) return;

    const targetForeshadowing = foreshadowings.find(f => f.id === quickAddData.foreshadowingId);
    if (!targetForeshadowing) return;

    const newPoint: ForeshadowingPoint = {
      id: Date.now().toString(),
      chapterId: currentChapterId,
      type: quickAddData.type,
      description: quickAddData.description,
      createdAt: new Date(),
    };

    // ステータスを更新
    let newStatus = targetForeshadowing.status;
    if (quickAddData.type === 'payoff' && targetForeshadowing.status !== 'abandoned') {
      newStatus = 'resolved';
    } else if (quickAddData.type === 'hint' && targetForeshadowing.status === 'planted') {
      newStatus = 'hinted';
    }

    const updatedForeshadowing: Foreshadowing = {
      ...targetForeshadowing,
      points: [...targetForeshadowing.points, newPoint],
      status: newStatus,
      updatedAt: new Date(),
    };

    updateProject({
      foreshadowings: foreshadowings.map(f =>
        f.id === targetForeshadowing.id ? updatedForeshadowing : f
      ),
    });

    // フォームをリセット
    setQuickAddData({
      foreshadowingId: '',
      type: 'plant',
      description: '',
    });
    setShowQuickAddForm(false);
  };

  // 章名を取得
  const getChapterTitle = (chapterId: string) => {
    const idx = chapters.findIndex(c => c.id === chapterId);
    const chapter = chapters[idx];
    return chapter ? `第${idx + 1}章: ${chapter.title}` : '不明な章';
  };

  if (!currentProject) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={onToggleCollapse}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-2 rounded-lg">
            <Bookmark className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              伏線パネル
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              {relatedForeshadowings.length}件の関連伏線
              {unresolvedForeshadowings.length > 0 && (
                <span className="ml-1 text-amber-500">
                  ({unresolvedForeshadowings.length}件未回収)
                </span>
              )}
            </p>
          </div>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* コンテンツ */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* ツールバー */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllForeshadowings}
                onChange={(e) => setShowAllForeshadowings(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                全伏線を表示
              </span>
            </label>
            <button
              onClick={() => setShowQuickAddForm(!showQuickAddForm)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors text-sm font-['Noto_Sans_JP']"
            >
              <Plus className="h-4 w-4" />
              <span>ポイント追加</span>
            </button>
          </div>

          {/* クイック追加フォーム */}
          {showQuickAddForm && currentChapterId && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-rose-800 dark:text-rose-200 text-sm font-['Noto_Sans_JP']">
                  この章にポイントを追加
                </h5>
                <button
                  onClick={() => setShowQuickAddForm(false)}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <select
                  value={quickAddData.foreshadowingId}
                  onChange={(e) => setQuickAddData({ ...quickAddData, foreshadowingId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">伏線を選択...</option>
                  {foreshadowings.filter(f => f.status !== 'resolved' && f.status !== 'abandoned').map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
                <div className="flex space-x-2">
                  <select
                    value={quickAddData.type}
                    onChange={(e) => setQuickAddData({ ...quickAddData, type: e.target.value as ForeshadowingPoint['type'] })}
                    className="px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="plant">📍 設置</option>
                    <option value="hint">💡 ヒント</option>
                    <option value="payoff">🎯 回収</option>
                  </select>
                  <input
                    type="text"
                    value={quickAddData.description}
                    onChange={(e) => setQuickAddData({ ...quickAddData, description: e.target.value })}
                    placeholder="説明..."
                    className="flex-1 px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                  />
                </div>
                <button
                  onClick={handleQuickAddPoint}
                  disabled={!quickAddData.foreshadowingId || !quickAddData.description}
                  className="w-full py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-['Noto_Sans_JP']"
                >
                  追加
                </button>
              </div>
            </div>
          )}

          {/* 未回収警告 */}
          {unresolvedForeshadowings.length > 0 && !showAllForeshadowings && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                    この章までに{unresolvedForeshadowings.length}件の伏線が未回収です
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unresolvedForeshadowings.slice(0, 3).map(f => (
                      <span
                        key={f.id}
                        className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full font-['Noto_Sans_JP']"
                      >
                        {f.title}
                      </span>
                    ))}
                    {unresolvedForeshadowings.length > 3 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        +{unresolvedForeshadowings.length - 3}件
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 伏線リスト */}
          <div className="max-h-[400px] overflow-y-auto">
            {displayForeshadowings.length === 0 ? (
              <div className="p-6 text-center">
                <Bookmark className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {showAllForeshadowings ? '伏線がありません' : 'この章に関連する伏線がありません'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {displayForeshadowings.map(foreshadowing => {
                  const isExpanded = expandedIds.has(foreshadowing.id);
                  const statusInfo = statusConfig[foreshadowing.status] || statusConfig.planted;
                  const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
                  const StatusIcon = statusInfo.icon;
                  const pointsInChapter = currentChapterId
                    ? foreshadowing.points.filter(p => p.chapterId === currentChapterId)
                    : [];

                  return (
                    <div key={foreshadowing.id} className="p-3">
                      {/* 伏線ヘッダー */}
                      <div className="flex items-start space-x-2">
                        <button
                          onClick={() => toggleExpand(foreshadowing.id)}
                          className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP'] truncate">
                              {foreshadowing.title}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded-full ${categoryInfo.color} text-white`}>
                              {categoryInfo.label}
                            </span>
                            {/* ステータス変更ドロップダウン */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatusDropdownId(statusDropdownId === foreshadowing.id ? null : foreshadowing.id);
                                }}
                                className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs rounded-full ${statusInfo.color} text-white cursor-pointer hover:opacity-80 transition-opacity`}
                                title="クリックでステータスを変更"
                              >
                                <StatusIcon className="h-3 w-3" />
                                <span>{statusInfo.label}</span>
                                <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                              </button>
                              {statusDropdownId === foreshadowing.id && (
                                <div className="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 min-w-[120px]">
                                  {(Object.entries(statusConfig) as [Foreshadowing['status'], typeof statusInfo][]).map(([key, config]) => {
                                    const OptionIcon = config.icon;
                                    return (
                                      <button
                                        key={key}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(foreshadowing.id, key);
                                        }}
                                        className={`w-full flex items-center space-x-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${foreshadowing.status === key ? 'font-bold' : ''
                                          }`}
                                      >
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full ${config.color}`}>
                                          <OptionIcon className="h-3 w-3 text-white" />
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{config.label}</span>
                                        {foreshadowing.status === key && (
                                          <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 font-['Noto_Sans_JP']">
                            {foreshadowing.description}
                          </p>

                          {/* この章のポイント表示 */}
                          {pointsInChapter.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {pointsInChapter.map(point => (
                                <span
                                  key={point.id}
                                  className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${point.type === 'plant' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    point.type === 'hint' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    }`}
                                >
                                  {pointTypeConfig[point.type].icon} この章で{pointTypeConfig[point.type].label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 回収予定表示 */}
                          {foreshadowing.plannedPayoffChapterId === currentChapterId && foreshadowing.status !== 'resolved' && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-dashed border-green-400">
                                🎯 この章で回収予定
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCopyText(foreshadowing.description, foreshadowing.id)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="説明をコピー"
                        >
                          {copiedId === foreshadowing.id ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* 展開コンテンツ */}
                      {isExpanded && (
                        <div className="mt-3 ml-6 space-y-2">
                          {/* ポイント一覧 */}
                          {foreshadowing.points.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                ポイント:
                              </p>
                              {foreshadowing.points.map(point => (
                                <div
                                  key={point.id}
                                  className={`flex items-start space-x-2 p-2 rounded-lg text-xs ${point.chapterId === currentChapterId
                                    ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800'
                                    : 'bg-gray-50 dark:bg-gray-700/50'
                                    }`}
                                >
                                  <span>{pointTypeConfig[point.type].icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {getChapterTitle(point.chapterId)}:
                                    </span>
                                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                      {point.description}
                                    </p>
                                    {point.lineReference && (
                                      <p className="mt-1 italic text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        「{point.lineReference}」
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 回収予定 */}
                          {foreshadowing.plannedPayoffChapterId && foreshadowing.status !== 'resolved' && (
                            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs">
                              <span className="font-medium text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                                回収予定: {getChapterTitle(foreshadowing.plannedPayoffChapterId)}
                              </span>
                              {foreshadowing.plannedPayoffDescription && (
                                <p className="text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                                  {foreshadowing.plannedPayoffDescription}
                                </p>
                              )}
                            </div>
                          )}

                          {/* メモ */}
                          {foreshadowing.notes && (
                            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs">
                              <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">メモ:</span>
                              <p className="text-gray-600 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
                                {foreshadowing.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

