import React from 'react';
import { Calendar, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import type { Foreshadowing, ForeshadowingPoint } from '../../../../contexts/ProjectContext';
import { categoryConfig, importanceConfig, pointTypeConfig } from '../config';

interface TimelineChapterData {
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  points: Array<{ foreshadowing: Foreshadowing; point: ForeshadowingPoint }>;
  plannedPayoffs: Foreshadowing[];
}

interface ForeshadowingFlow {
  foreshadowing: Foreshadowing;
  points: ForeshadowingPoint[];
  startChapterIdx: number;
  endChapterIdx: number;
  plannedPayoffIdx: number;
  hasPayoff: boolean;
}

interface TimelineViewProps {
  chapters: Array<{ id: string; title: string }>;
  timelineData: TimelineChapterData[];
  foreshadowingFlows: ForeshadowingFlow[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  chapters,
  timelineData,
  foreshadowingFlows,
}) => {
  if (chapters.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
            章が作成されていません。先に章立てを設定してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative">
        {/* 章のタイムライン */}
        <div className="space-y-4">
          {timelineData.map((chapterData, idx) => {
            const plantPoints = chapterData.points.filter(p => p.point.type === 'plant');
            const hintPoints = chapterData.points.filter(p => p.point.type === 'hint');
            const payoffPoints = chapterData.points.filter(p => p.point.type === 'payoff');
            const hasContent = chapterData.points.length > 0 || chapterData.plannedPayoffs.length > 0;

            return (
              <div key={chapterData.chapterId} className="relative">
                {/* 章ヘッダー */}
                <div className={`flex items-center space-x-4 p-3 rounded-lg ${hasContent
                  ? 'bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${hasContent ? 'bg-rose-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>
                    <span className="font-bold text-sm">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] break-words">
                      第{idx + 1}章: {chapterData.chapterTitle}
                    </h4>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {plantPoints.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <span>📍</span>
                          <span>{plantPoints.length}設置</span>
                        </span>
                      )}
                      {hintPoints.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <span>💡</span>
                          <span>{hintPoints.length}ヒント</span>
                        </span>
                      )}
                      {payoffPoints.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <span>🎯</span>
                          <span>{payoffPoints.length}回収</span>
                        </span>
                      )}
                      {chapterData.plannedPayoffs.length > 0 && (
                        <span className="flex items-center space-x-1 text-amber-500">
                          <span>⏳</span>
                          <span>{chapterData.plannedPayoffs.length}回収予定</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${chapterData.points.length > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      chapterData.points.length > 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      密度: {chapterData.points.length}
                    </span>
                  </div>
                </div>

                {/* 伏線ポイント詳細 */}
                {hasContent && (
                  <div className="ml-14 mt-2 space-y-2">
                    {/* 設置ポイント */}
                    {plantPoints.map(({ foreshadowing, point }) => {
                      const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
                      const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
                      return (
                        <div
                          key={point.id}
                          className="flex items-start space-x-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500"
                        >
                          <span className="text-lg">📍</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-blue-700 dark:text-blue-300 text-sm font-['Noto_Sans_JP']">
                                {foreshadowing.title}
                              </span>
                              <span className={`text-xs ${importanceInfo.color}`}>{importanceInfo.stars}</span>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP'] mt-0.5">
                              {point.description}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${categoryInfo.color} text-white`}>
                            {categoryInfo.label}
                          </span>
                        </div>
                      );
                    })}

                    {/* ヒントポイント */}
                    {hintPoints.map(({ foreshadowing, point }) => (
                      <div
                        key={point.id}
                        className="flex items-start space-x-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-500"
                      >
                        <span className="text-lg">💡</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-amber-700 dark:text-amber-300 text-sm font-['Noto_Sans_JP']">
                              {foreshadowing.title}
                            </span>
                          </div>
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP'] mt-0.5">
                            {point.description}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* 回収ポイント */}
                    {payoffPoints.map(({ foreshadowing, point }) => (
                      <div
                        key={point.id}
                        className="flex items-start space-x-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500"
                      >
                        <span className="text-lg">🎯</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-green-700 dark:text-green-300 text-sm font-['Noto_Sans_JP']">
                              {foreshadowing.title}
                            </span>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP'] mt-0.5">
                            {point.description}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* 回収予定 */}
                    {chapterData.plannedPayoffs.map(f => (
                      <div
                        key={`planned-${f.id}`}
                        className="flex items-start space-x-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-dashed border-amber-400"
                      >
                        <span className="text-lg opacity-50">🎯</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-500 dark:text-gray-400 text-sm font-['Noto_Sans_JP']">
                              {f.title}
                            </span>
                            <span className="text-xs text-amber-500 font-['Noto_Sans_JP']">回収予定</span>
                          </div>
                          {f.plannedPayoffDescription && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-['Noto_Sans_JP'] mt-0.5">
                              {f.plannedPayoffDescription}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 接続線 */}
                {idx < timelineData.length - 1 && (
                  <div className="absolute left-[34px] top-[56px] w-0.5 h-6 bg-gray-300 dark:bg-gray-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* 伏線フロー可視化 */}
        {foreshadowingFlows.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP'] flex items-center space-x-2">
              <ArrowRight className="h-5 w-5" />
              <span>伏線の流れ</span>
            </h4>
            <div className="space-y-3">
              {foreshadowingFlows
                .filter(flow => flow.points.length > 0)
                .sort((a, b) => a.startChapterIdx - b.startChapterIdx)
                .map(flow => {
                  const categoryInfo = categoryConfig[flow.foreshadowing.category] || categoryConfig.other;
                  return (
                    <div
                      key={flow.foreshadowing.id}
                      className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <span className={`px-2 py-1 text-xs rounded-full ${categoryInfo.color} text-white`}>
                        {categoryInfo.label}
                      </span>
                      <span
                        className="font-medium text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP'] min-w-0 break-words flex-shrink-0"
                        style={{ maxWidth: '200px' }}
                      >
                        {flow.foreshadowing.title}
                      </span>
                      <div className="flex-1 flex items-center space-x-1 overflow-x-auto">
                        {flow.points.map((point, idx) => {
                          const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                          return (
                            <React.Fragment key={point.id}>
                              <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded ${point.type === 'plant' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                point.type === 'hint' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              }`}>
                                {pointTypeInfo.icon} {chapters.findIndex(c => c.id === point.chapterId) + 1}章
                              </span>
                              {idx < flow.points.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              )}
                            </React.Fragment>
                          );
                        })}
                        {!flow.hasPayoff && flow.plannedPayoffIdx >= 0 && (
                          <>
                            <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600">
                              🎯 {flow.plannedPayoffIdx + 1}章(予定)
                            </span>
                          </>
                        )}
                      </div>
                      {!flow.hasPayoff && (
                        <span title="未回収">
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                      {flow.hasPayoff && (
                        <span title="回収済み">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
