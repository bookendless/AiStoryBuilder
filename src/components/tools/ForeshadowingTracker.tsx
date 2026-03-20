import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  List,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useOverlayBackHandler } from '../../contexts/BackButtonContext';
import { statusConfig, categoryConfig } from './foreshadowing/config';
import { useForeshadowingCRUD } from './foreshadowing/hooks/useForeshadowingCRUD';
import { useForeshadowingFilters } from './foreshadowing/hooks/useForeshadowingFilters';
import { useForeshadowingAI } from './foreshadowing/hooks/useForeshadowingAI';
import { ForeshadowingCard } from './foreshadowing/components/ForeshadowingCard';
import { TimelineView } from './foreshadowing/components/TimelineView';
import { StatsView } from './foreshadowing/components/StatsView';
import { ForeshadowingFormModal } from './foreshadowing/components/ForeshadowingFormModal';
import { AIAssistantModal } from './foreshadowing/components/AIAssistantModal';
import { ConsistencyResultModal } from './foreshadowing/components/modals/ConsistencyResultModal';
import { EnhanceResultModal } from './foreshadowing/components/modals/EnhanceResultModal';
import { PayoffResultModal } from './foreshadowing/components/modals/PayoffResultModal';

interface ForeshadowingTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForeshadowingTracker: React.FC<ForeshadowingTrackerProps> = ({ isOpen, onClose }) => {
  const { currentProject } = useProject();
  const { modalRef } = useModalNavigation({ isOpen, onClose });

  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'foreshadowing-tracker-modal', 80);

  // UI状態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentView, setCurrentView] = useState<'list' | 'timeline' | 'stats'>('list');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const foreshadowings = useMemo(() => currentProject?.foreshadowings || [], [currentProject?.foreshadowings]);
  const chapters = useMemo(() => currentProject?.chapters || [], [currentProject?.chapters]);
  const characters = useMemo(() => currentProject?.characters || [], [currentProject?.characters]);

  // カスタムフック
  const crud = useForeshadowingCRUD();
  const filters = useForeshadowingFilters({
    foreshadowings,
    chapters,
    searchQuery,
    selectedStatus,
    selectedCategory,
  });
  const ai = useForeshadowingAI();

  if (!isOpen || !currentProject) return null;

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-2 rounded-lg">
              <Bookmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                伏線トラッカー
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                伏線の設置・回収を管理
              </p>
            </div>
          </div>
        }
        size="xl"
        ref={modalRef}
      >
        <div className="flex flex-col h-[80vh]">
          {/* ビュー切り替えタブ */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: 'list', label: 'リスト', icon: List },
                { key: 'timeline', label: 'タイムライン', icon: Calendar },
                { key: 'stats', label: '統計', icon: BarChart3 },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setCurrentView(key as typeof currentView)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors font-['Noto_Sans_JP'] ${currentView === key
                    ? 'bg-white dark:bg-gray-600 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              {foreshadowings.length}件の伏線 / {chapters.length}章
            </div>
          </div>

          {/* リストビュー */}
          {currentView === 'list' && (
            <>
              {/* ヘッダーアクション */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {/* ステータスタブ */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedStatus('all')}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors font-['Noto_Sans_JP'] ${selectedStatus === 'all'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      全て ({filters.statusCounts.all || 0})
                    </button>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedStatus(key)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors font-['Noto_Sans_JP'] ${selectedStatus === key
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {config.label} ({filters.statusCounts[key] || 0})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      ai.setShowAIAssistant(true);
                      ai.setAiMode('suggest');
                      ai.setAiError(null);
                    }}
                    disabled={ai.isAILoading}
                    className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
                    title="AIアシスタント"
                  >
                    {ai.isAILoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    <span className="font-['Noto_Sans_JP']">AIアシスト</span>
                  </button>
                  <button
                    onClick={() => {
                      crud.resetForm();
                      crud.setEditingForeshadowing(null);
                      crud.setShowAddForm(true);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="font-['Noto_Sans_JP']">追加</span>
                  </button>
                </div>
              </div>

              {/* フィルタ */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="伏線を検索..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                >
                  <option value="all">全カテゴリ</option>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* 伏線リスト */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {filters.filteredForeshadowings.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <EmptyState
                      icon={Bookmark}
                      iconColor="text-rose-400 dark:text-rose-500"
                      title={foreshadowings.length === 0
                        ? 'まだ伏線が登録されていません'
                        : '条件に一致する伏線がありません'}
                      description={foreshadowings.length === 0
                        ? '物語に伏線を設定して、読者を引き込む仕掛けを作りましょう。キャラクター、プロット、世界観など、様々な要素に伏線を仕込むことで、物語に深みと興味を生み出せます。伏線の設置、ヒント、回収を管理して、物語の完成度を高めましょう。'
                        : '検索条件やフィルターを変更して、再度お試しください。'}
                      actionLabel={foreshadowings.length === 0 ? '最初の伏線を追加' : undefined}
                      onAction={foreshadowings.length === 0 ? () => crud.setShowAddForm(true) : undefined}
                    />
                  </div>
                ) : (
                  filters.filteredForeshadowings.map((foreshadowing) => (
                    <ForeshadowingCard
                      key={foreshadowing.id}
                      foreshadowing={foreshadowing}
                      chapters={chapters}
                      characters={characters}
                      isExpanded={expandedIds.has(foreshadowing.id)}
                      isAILoading={ai.isAILoading}
                      onToggleExpand={toggleExpand}
                      onEdit={crud.handleEditForeshadowing}
                      onDelete={crud.handleDeleteForeshadowing}
                      onAddPoint={crud.handleAddPoint}
                      onDeletePoint={crud.handleDeletePoint}
                      onEnhance={ai.handleEnhanceForeshadowing}
                      onSuggestPayoff={ai.handleSuggestPayoff}
                    />
                  ))
                )}
              </div>

              {/* 未回収伏線の警告 */}
              {foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                      {foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length}件の伏線が未回収です
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* タイムラインビュー */}
          {currentView === 'timeline' && (
            <TimelineView
              chapters={chapters}
              timelineData={filters.timelineData}
              foreshadowingFlows={filters.foreshadowingFlows}
            />
          )}

          {/* 統計ビュー */}
          {currentView === 'stats' && (
            <StatsView statsData={filters.statsData} />
          )}
        </div>
      </Modal>

      {/* 伏線追加/編集フォーム */}
      <ForeshadowingFormModal
        isOpen={crud.showAddForm}
        editingForeshadowing={crud.editingForeshadowing}
        formData={crud.formData}
        setFormData={crud.setFormData}
        plantChapterId={crud.plantChapterId}
        setPlantChapterId={crud.setPlantChapterId}
        tagInput={crud.tagInput}
        setTagInput={crud.setTagInput}
        chapters={chapters}
        characters={characters}
        onSave={crud.editingForeshadowing ? crud.handleUpdateForeshadowing : crud.handleAddForeshadowing}
        onClose={() => {
          crud.setShowAddForm(false);
          crud.setEditingForeshadowing(null);
          crud.resetForm();
        }}
        onAddTag={crud.handleAddTag}
        onRemoveTag={crud.handleRemoveTag}
      />

      {/* 整合性チェック結果モーダル */}
      <ConsistencyResultModal
        isOpen={ai.showConsistencyModal}
        consistencyResult={ai.consistencyResult}
        onClose={() => ai.setShowConsistencyModal(false)}
      />

      {/* 伏線強化提案モーダル */}
      <EnhanceResultModal
        isOpen={ai.showEnhanceModal}
        enhanceResult={ai.enhanceResult}
        selectedForEnhance={ai.selectedForEnhance}
        onClose={() => {
          ai.setShowEnhanceModal(false);
          ai.setSelectedForEnhance(null);
          ai.setEnhanceResult(null);
        }}
      />

      {/* 回収タイミング提案モーダル */}
      <PayoffResultModal
        isOpen={ai.showPayoffModal}
        payoffResult={ai.payoffResult}
        selectedForPayoff={ai.selectedForPayoff}
        onClose={() => {
          ai.setShowPayoffModal(false);
          ai.setSelectedForPayoff(null);
          ai.setPayoffResult(null);
        }}
      />

      {/* 確認ダイアログ - 伏線削除 */}
      <ConfirmDialog
        isOpen={crud.deletingForeshadowingId !== null}
        onClose={() => crud.setDeletingForeshadowingId(null)}
        onConfirm={crud.handleConfirmDeleteForeshadowing}
        title="この伏線を削除しますか？"
        message=""
        type="warning"
        confirmLabel="削除"
      />

      {/* 確認ダイアログ - ポイント削除 */}
      <ConfirmDialog
        isOpen={crud.deletingPointInfo !== null}
        onClose={() => crud.setDeletingPointInfo(null)}
        onConfirm={crud.handleConfirmDeletePoint}
        title="このポイントを削除しますか？"
        message=""
        type="warning"
        confirmLabel="削除"
      />

      {/* AIアシスタントモーダル */}
      <AIAssistantModal
        isOpen={ai.showAIAssistant}
        isConfigured={ai.isConfigured}
        isAILoading={ai.isAILoading}
        aiMode={ai.aiMode}
        setAiMode={ai.setAiMode}
        aiSuggestions={ai.aiSuggestions}
        aiError={ai.aiError}
        setAiError={ai.setAiError}
        setAiSuggestions={ai.setAiSuggestions}
        foreshadowingsCount={foreshadowings.length}
        onAISuggest={ai.handleAISuggest}
        onConsistencyCheck={ai.handleConsistencyCheck}
        onAddFromSuggestion={ai.handleAddFromSuggestion}
        onClose={() => {
          ai.setShowAIAssistant(false);
          ai.setAiSuggestions([]);
          ai.setAiError(null);
        }}
      />
    </>
  );
};
