import React from 'react';
import { AlertCircle } from 'lucide-react';
import { categoryConfig } from '../config';
import type { Foreshadowing } from '../../../../contexts/ProjectContext';

interface StatsData {
  total: number;
  resolved: number;
  planted: number;
  hinted: number;
  abandoned: number;
  byCategory: Array<{ category: Foreshadowing['category']; count: number }>;
  byImportance: { high: number; medium: number; low: number };
  unresolvedHighImportance: number;
  chapterDensity: Array<{ chapterIndex: number; title: string; density: number }>;
  resolutionRate: number;
}

interface StatsViewProps {
  statsData: StatsData;
}

export const StatsView: React.FC<StatsViewProps> = ({ statsData }) => {
  return (
    <div className="flex-1 overflow-y-auto space-y-6">
      {/* 概要カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-4 rounded-xl text-white">
          <div className="text-3xl font-bold">{statsData.total}</div>
          <div className="text-sm opacity-80 font-['Noto_Sans_JP']">総伏線数</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl text-white">
          <div className="text-3xl font-bold">{statsData.resolutionRate}%</div>
          <div className="text-sm opacity-80 font-['Noto_Sans_JP']">回収率</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-xl text-white">
          <div className="text-3xl font-bold">{statsData.planted + statsData.hinted}</div>
          <div className="text-sm opacity-80 font-['Noto_Sans_JP']">未回収</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-4 rounded-xl text-white">
          <div className="text-3xl font-bold">{statsData.unresolvedHighImportance}</div>
          <div className="text-sm opacity-80 font-['Noto_Sans_JP']">重要未回収</div>
        </div>
      </div>

      {/* ステータス別内訳 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">ステータス別内訳</h4>
        <div className="space-y-3">
          {[
            { key: 'planted', label: '設置済み', count: statsData.planted, color: 'bg-blue-500' },
            { key: 'hinted', label: '進行中', count: statsData.hinted, color: 'bg-amber-500' },
            { key: 'resolved', label: '回収済み', count: statsData.resolved, color: 'bg-green-500' },
            { key: 'abandoned', label: '破棄', count: statsData.abandoned, color: 'bg-gray-500' },
          ].map(item => (
            <div key={item.key} className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] w-24">{item.label}</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: statsData.total > 0 ? `${(item.count / statsData.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                {item.count}件
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* カテゴリ別内訳 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">カテゴリ別内訳</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {statsData.byCategory.map(item => {
            const categoryInfo = categoryConfig[item.category] || categoryConfig.other;
            return (
              <div key={item.category} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryInfo.color} text-white font-bold text-sm`}>
                  {item.count}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                  {categoryInfo.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 重要度別内訳 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">重要度別内訳</h4>
        <div className="flex items-center justify-around">
          <div className="text-center">
            <div className="text-red-500 text-2xl font-bold">{statsData.byImportance.high}</div>
            <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★★★ 高</div>
          </div>
          <div className="text-center">
            <div className="text-amber-500 text-2xl font-bold">{statsData.byImportance.medium}</div>
            <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★★☆ 中</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 text-2xl font-bold">{statsData.byImportance.low}</div>
            <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★☆☆ 低</div>
          </div>
        </div>
      </div>

      {/* 章別密度 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">章別伏線密度</h4>
        {statsData.chapterDensity.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            章がまだ作成されていません
          </p>
        ) : (
          <div className="space-y-2">
            {statsData.chapterDensity.map((chapter, idx) => {
              const maxDensity = Math.max(...statsData.chapterDensity.map(c => c.density), 1);
              return (
                <div key={idx} className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-16 font-['Noto_Sans_JP']">
                    第{chapter.chapterIndex + 1}章
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${chapter.density > 5 ? 'bg-red-500' :
                        chapter.density > 2 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${(chapter.density / maxDensity) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-6 text-right">
                    {chapter.density}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 警告 */}
      {statsData.unresolvedHighImportance > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
              重要度「高」の伏線が{statsData.unresolvedHighImportance}件未回収です。物語の完成度に影響する可能性があります。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
