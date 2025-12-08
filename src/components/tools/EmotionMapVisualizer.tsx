import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Activity,
  X,
  Info,
} from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { useToast } from '../Toast';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import {
  EmotionMap,
  ChapterEmotion,
  EmotionType,
} from '../../types/emotion';
import {
  generateEmotionMap,
} from '../../services/emotionAnalysisService';

interface EmotionMapVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

// 感情タイプのラベル
const emotionLabels: Record<EmotionType, string> = {
  joy: '喜び',
  sadness: '悲しみ',
  anger: '怒り',
  fear: '恐怖',
  surprise: '驚き',
  anticipation: '期待',
  disgust: '嫌悪',
  trust: '信頼',
  tension: '緊張',
  relief: '安堵',
  excitement: '興奮',
  melancholy: '憂鬱',
};

// 感情タイプの色
const emotionColors: Record<EmotionType, string> = {
  joy: '#fbbf24', // amber-400
  sadness: '#3b82f6', // blue-500
  anger: '#ef4444', // red-500
  fear: '#8b5cf6', // purple-500
  surprise: '#10b981', // green-500
  anticipation: '#f59e0b', // amber-500
  disgust: '#6b7280', // gray-500
  trust: '#06b6d4', // cyan-500
  tension: '#ec4899', // pink-500
  relief: '#14b8a6', // teal-500
  excitement: '#f97316', // orange-500
  melancholy: '#6366f1', // indigo-500
};

// 感情曲線グラフコンポーネント
const EmotionCurveChart: React.FC<{
  chapters: ChapterEmotion[];
  selectedEmotions: (EmotionType | 'overall')[];
  onChapterClick?: (chapterId: string) => void;
}> = ({ chapters, selectedEmotions, onChapterClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 800;
  const height = 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (chapters.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
          データがありません
        </p>
      </div>
    );
  }

  // データの正規化
  const maxValue = 100;
  const minValue = -100;
  const valueRange = maxValue - minValue;

  // ポイントの計算
  const points = chapters.map((chapter, index) => {
    const x = (index / (chapters.length - 1 || 1)) * chartWidth + padding.left;
    let y: number;
    
    if (selectedEmotions.length === 0 || selectedEmotions.includes('overall')) {
      // 総合スコアを使用
      y = padding.top + chartHeight - ((chapter.overallScore - minValue) / valueRange) * chartHeight;
    } else {
      // 選択された感情の平均を使用
      const avgEmotion = selectedEmotions
        .filter((type): type is EmotionType => type !== 'overall')
        .reduce((sum, type) => sum + chapter.emotions[type], 0) / selectedEmotions.filter((type) => type !== 'overall').length;
      y = padding.top + chartHeight - ((avgEmotion - 0) / 100) * chartHeight;
    }
    
    return { x, y, chapter };
  });

  // パス文字列の生成
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
        {/* グリッド線 */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-700" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" opacity="0.3" />

        {/* Y軸のラベル */}
        {[100, 50, 0, -50, -100].map((value) => {
          const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
          return (
            <g key={value}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#d1d5db"
                strokeWidth="1"
                strokeDasharray="2,2"
                className="dark:stroke-gray-600"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-600 dark:fill-gray-400 font-['Noto_Sans_JP']"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* X軸のラベル */}
        {chapters.map((chapter, index) => {
          const x = (index / (chapters.length - 1 || 1)) * chartWidth + padding.left;
          return (
            <text
              key={chapter.id}
              x={x}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              className="text-xs fill-gray-600 dark:fill-gray-400 font-['Noto_Sans_JP']"
            >
              第{index + 1}章
            </text>
          );
        })}

        {/* 感情曲線 */}
        <path
          d={pathData}
          fill="none"
          stroke="#6366f1"
          strokeWidth="3"
          className="cursor-pointer hover:stroke-indigo-600"
        />

        {/* ポイント - クリック可能な大きなアイコン */}
        {points.map((point, index) => {
          const isHovered = hoveredIndex === index;
          const baseRadius = 12;
          const hoverRadius = 18;
          const outerRingRadius = isHovered ? hoverRadius + 6 : baseRadius + 3;
          
          return (
            <g
              key={point.chapter.id}
              className="cursor-pointer group"
              onClick={() => onChapterClick?.(point.chapter.chapterId)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 外側のリング（ホバーエフェクトとクリック可能であることを示す） */}
              <circle
                cx={point.x}
                cy={point.y}
                r={outerRingRadius}
                fill="none"
                stroke="#6366f1"
                strokeWidth={isHovered ? "3" : "2"}
                opacity={isHovered ? 0.5 : 0.3}
                style={{ transition: 'all 0.2s ease' }}
              />
              
              {/* メインの円（大きく、目立つ） */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? hoverRadius : baseRadius}
                fill="#6366f1"
                stroke="#ffffff"
                strokeWidth="3"
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered 
                    ? 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.8))' 
                    : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))',
                }}
              />
              
              {/* 内側のアクセント（クリック可能であることを示す） */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? 7 : 5}
                fill="#ffffff"
                opacity={0.9}
                style={{ transition: 'all 0.2s ease' }}
              />
              
              {/* ツールチップ用の透明な大きなヒットエリア（クリックしやすくする） */}
              <circle
                cx={point.x}
                cy={point.y}
                r={outerRingRadius + 6}
                fill="transparent"
              >
                <title>{`第${index + 1}章をクリックして詳細を表示\n総合スコア: ${point.chapter.overallScore.toFixed(1)}`}</title>
              </circle>
            </g>
          );
        })}

        {/* ゼロライン */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight - ((0 - minValue) / valueRange) * chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight - ((0 - minValue) / valueRange) * chartHeight}
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="4,4"
          opacity="0.5"
        />
      </svg>
    </div>
  );
};

// 感情ヒートマップコンポーネント
const EmotionHeatmap: React.FC<{
  chapters: ChapterEmotion[];
  emotionTypes: EmotionType[];
}> = ({ chapters, emotionTypes }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 dark:border-gray-600 p-2 text-left text-sm font-semibold bg-gray-100 dark:bg-gray-800 font-['Noto_Sans_JP']">
              章
            </th>
            {emotionTypes.map((type) => (
              <th
                key={type}
                className="border border-gray-300 dark:border-gray-600 p-2 text-center text-xs font-semibold bg-gray-100 dark:bg-gray-800 font-['Noto_Sans_JP']"
              >
                {emotionLabels[type]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chapters.map((chapter, index) => (
            <tr key={chapter.id}>
              <td className="border border-gray-300 dark:border-gray-600 p-2 text-sm font-medium font-['Noto_Sans_JP']">
                第{index + 1}章
              </td>
              {emotionTypes.map((type) => {
                const intensity = chapter.emotions[type];
                const opacity = intensity / 100;
                const color = emotionColors[type];
                return (
                  <td
                    key={type}
                    className="border border-gray-300 dark:border-gray-600 p-2 text-center"
                    style={{
                      backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                    }}
                    title={`${emotionLabels[type]}: ${intensity.toFixed(0)}`}
                  >
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {intensity.toFixed(0)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const EmotionMapVisualizer: React.FC<EmotionMapVisualizerProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showError, showWarning } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  const [emotionMap, setEmotionMap] = useState<EmotionMap | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedView, setSelectedView] = useState<'curve' | 'heatmap'>('curve');
  const [selectedEmotions, setSelectedEmotions] = useState<(EmotionType | 'overall')[]>(['overall']);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // プロジェクトの感情マップを読み込み
  useEffect(() => {
    if (currentProject?.emotionMap) {
      setEmotionMap(currentProject.emotionMap);
    } else {
      setEmotionMap(null);
    }
  }, [currentProject]);

  // 感情分析を実行
  const handleAnalyze = async () => {
    if (!currentProject || !isConfigured) {
      showWarning('AI設定が必要です', 3000);
      return;
    }

    if (currentProject.chapters.length === 0) {
      showWarning('章が設定されていません', 3000);
      return;
    }

    setIsAnalyzing(true);
    try {
      const projectContext = {
        genre: currentProject.mainGenre || currentProject.genre || '一般小説',
        theme: currentProject.theme || currentProject.projectTheme || '',
        targetReader: currentProject.targetReader,
      };

      const newEmotionMap = await generateEmotionMap(
        currentProject.id,
        currentProject.chapters,
        projectContext,
        settings
      );

      setEmotionMap(newEmotionMap);

      // プロジェクトに保存
      await updateProject({ emotionMap: newEmotionMap });

      showSuccess('感情分析が完了しました', 3000);
    } catch (error) {
      console.error('感情分析エラー:', error);
      showError(
        error instanceof Error ? error.message : '感情分析に失敗しました',
        5000
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 選択された章の詳細
  const selectedChapter = useMemo(() => {
    if (!selectedChapterId || !emotionMap) return null;
    return emotionMap.chapters.find((c) => c.chapterId === selectedChapterId);
  }, [selectedChapterId, emotionMap]);

  // 主要な感情タイプ（分析結果がある場合）
  const mainEmotionTypes: EmotionType[] = useMemo(() => {
    if (!emotionMap || emotionMap.chapters.length === 0) {
      return ['tension', 'excitement', 'joy', 'sadness', 'fear'];
    }

    // 全章で最も高いスコアを持つ感情を取得
    const emotionTotals: Record<EmotionType, number> = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      anticipation: 0,
      disgust: 0,
      trust: 0,
      tension: 0,
      relief: 0,
      excitement: 0,
      melancholy: 0,
    };

    emotionMap.chapters.forEach((chapter) => {
      Object.entries(chapter.emotions).forEach(([type, value]) => {
        emotionTotals[type as EmotionType] += value;
      });
    });

    return Object.entries(emotionTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type as EmotionType);
  }, [emotionMap]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            感情マップ・ビジュアライザー
          </span>
        </div>
      }
      size="lg"
      ref={modalRef}
    >
      <div className="space-y-4">
        {/* ヘッダーアクション */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedView('curve')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${
                selectedView === 'curve'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-1" />
              曲線グラフ
            </button>
            <button
              onClick={() => setSelectedView('heatmap')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${
                selectedView === 'heatmap'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-1" />
              ヒートマップ
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {isAnalyzing && <AILoadingIndicator />}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !isConfigured || !currentProject}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-['Noto_Sans_JP']"
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{emotionMap ? '再分析' : '分析開始'}</span>
            </button>
          </div>
        </div>

        {/* AI設定の警告 */}
        {!isConfigured && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300 font-['Noto_Sans_JP']">
                AI設定が必要です。設定画面でAPIキーを設定してください。
              </p>
            </div>
          </div>
        )}

        {/* データがない場合 */}
        {!emotionMap && !isAnalyzing && (
          <EmptyState
            icon={TrendingUp}
            iconColor="text-indigo-400 dark:text-indigo-500"
            title="感情マップがありません"
            description="「分析開始」ボタンをクリックして、章の感情を分析してください。"
            actionLabel="分析開始"
            onAction={handleAnalyze}
          />
        )}

        {/* 感情マップの表示 */}
        {emotionMap && emotionMap.chapters.length > 0 && (
          <>
            {/* 感情曲線グラフ */}
            {selectedView === 'curve' && (
              <div className="space-y-4">
                <EmotionCurveChart
                  chapters={emotionMap.chapters}
                  selectedEmotions={selectedEmotions}
                  onChapterClick={setSelectedChapterId}
                />

                {/* 感情選択 */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    表示する感情を選択:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEmotions(['overall'])}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors font-['Noto_Sans_JP'] ${
                        selectedEmotions.includes('overall')
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      総合スコア
                    </button>
                    {mainEmotionTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          if (selectedEmotions.includes(type)) {
                            setSelectedEmotions(selectedEmotions.filter((t) => t !== type));
                          } else {
                            setSelectedEmotions([...selectedEmotions.filter((t) => t !== 'overall'), type]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors font-['Noto_Sans_JP'] flex items-center space-x-1 ${
                          selectedEmotions.includes(type)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                        }`}
                        style={{
                          backgroundColor: selectedEmotions.includes(type)
                            ? emotionColors[type]
                            : undefined,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: emotionColors[type] }}
                        />
                        <span>{emotionLabels[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 感情ヒートマップ */}
            {selectedView === 'heatmap' && (
              <EmotionHeatmap chapters={emotionMap.chapters} emotionTypes={mainEmotionTypes} />
            )}

            {/* 全体分析結果 */}
            {emotionMap.overallAnalysis && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 font-['Noto_Sans_JP']">
                    全体分析結果
                  </h3>
                </div>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                  <p>
                    平均感情スコア: <span className="font-semibold">{emotionMap.overallAnalysis.averageEmotion.toFixed(1)}</span>
                  </p>
                  <p>
                    感情の幅: <span className="font-semibold">{emotionMap.overallAnalysis.emotionalRange.toFixed(1)}</span>
                  </p>
                  <p>
                    リズム: <span className="font-semibold">{emotionMap.overallAnalysis.rhythm}</span>
                  </p>
                  {emotionMap.overallAnalysis.recommendations.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold mb-1">推奨事項:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {emotionMap.overallAnalysis.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 選択された章の詳細 */}
            {selectedChapter && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    章の詳細
                  </h3>
                  <button
                    onClick={() => setSelectedChapterId(null)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2 text-sm font-['Noto_Sans_JP']">
                  <p>
                    総合スコア: <span className="font-semibold">{selectedChapter.overallScore.toFixed(1)}</span>
                  </p>
                  <p>
                    テンポ: <span className="font-semibold">{selectedChapter.pace.toFixed(0)}</span>
                  </p>
                  <p>
                    没入度: <span className="font-semibold">{selectedChapter.immersionScore.toFixed(0)}</span>
                  </p>
                  {selectedChapter.aiAnalysis && (
                    <>
                      <p>
                        主要感情: <span className="font-semibold">{emotionLabels[selectedChapter.aiAnalysis.dominantEmotion]}</span>
                      </p>
                      {selectedChapter.aiAnalysis.issues && selectedChapter.aiAnalysis.issues.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">問題点:</p>
                          <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
                            {selectedChapter.aiAnalysis.issues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedChapter.aiAnalysis.suggestions && selectedChapter.aiAnalysis.suggestions.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold text-green-600 dark:text-green-400 mb-1">改善提案:</p>
                          <ul className="list-disc list-inside space-y-1 text-green-700 dark:text-green-300">
                            {selectedChapter.aiAnalysis.suggestions.map((suggestion, index) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* AI分析ログの表示 */}
                  {selectedChapter.aiLogs && (
                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                      <details className="space-y-2">
                        <summary className="cursor-pointer text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-['Noto_Sans_JP']">
                          AI分析ログを表示
                        </summary>
                        <div className="mt-2 space-y-3">
                          {/* 分析メモ */}
                          {selectedChapter.aiLogs.analysisNotes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                分析メモ:
                              </p>
                              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-['Noto_Sans_JP']">
                                {selectedChapter.aiLogs.analysisNotes}
                              </div>
                            </div>
                          )}
                          
                          {/* 生のレスポンス */}
                          {selectedChapter.aiLogs.rawResponse && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                AI生レスポンス:
                              </p>
                              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto font-['Noto_Sans_JP']">
                                {selectedChapter.aiLogs.rawResponse}
                              </div>
                            </div>
                          )}
                          
                          {/* パースされたデータ */}
                          {selectedChapter.aiLogs.parsedData && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                パースされたデータ:
                              </p>
                              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                                {selectedChapter.aiLogs.parsedData}
                              </div>
                            </div>
                          )}
                          
                          {/* プロンプト */}
                          {selectedChapter.aiLogs.prompt && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                使用したプロンプト:
                              </p>
                              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto font-['Noto_Sans_JP']">
                                {selectedChapter.aiLogs.prompt}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

