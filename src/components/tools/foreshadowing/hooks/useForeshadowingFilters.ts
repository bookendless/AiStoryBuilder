import { useMemo } from 'react';
import type { Foreshadowing, ForeshadowingPoint } from '../../../../contexts/ProjectContext';
import { categoryConfig } from '../config';

interface UseForeshadowingFiltersParams {
  foreshadowings: Foreshadowing[];
  chapters: Array<{ id: string; title: string }>;
  searchQuery: string;
  selectedStatus: string;
  selectedCategory: string;
}

export const useForeshadowingFilters = ({
  foreshadowings,
  chapters,
  searchQuery,
  selectedStatus,
  selectedCategory,
}: UseForeshadowingFiltersParams) => {
  // フィルタリング済み伏線リスト
  const filteredForeshadowings = useMemo(() => {
    let filtered = foreshadowings;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(f => f.status === selectedStatus);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
  }, [foreshadowings, selectedStatus, selectedCategory, searchQuery]);

  // ステータス別の件数
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: foreshadowings.length };
    foreshadowings.forEach(f => {
      counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return counts;
  }, [foreshadowings]);

  // タイムラインビュー用データ
  const timelineData = useMemo(() => {
    const chapterMap = new Map<string, {
      chapterId: string;
      chapterIndex: number;
      chapterTitle: string;
      points: Array<{ foreshadowing: Foreshadowing; point: ForeshadowingPoint }>;
      plannedPayoffs: Foreshadowing[];
    }>();

    chapters.forEach((chapter, idx) => {
      chapterMap.set(chapter.id, {
        chapterId: chapter.id,
        chapterIndex: idx,
        chapterTitle: chapter.title,
        points: [],
        plannedPayoffs: [],
      });
    });

    foreshadowings.forEach(f => {
      f.points.forEach(point => {
        const chapterData = chapterMap.get(point.chapterId);
        if (chapterData) {
          chapterData.points.push({ foreshadowing: f, point });
        }
      });

      if (f.plannedPayoffChapterId && f.status !== 'resolved') {
        const chapterData = chapterMap.get(f.plannedPayoffChapterId);
        if (chapterData) {
          chapterData.plannedPayoffs.push(f);
        }
      }
    });

    return Array.from(chapterMap.values()).sort((a, b) => a.chapterIndex - b.chapterIndex);
  }, [chapters, foreshadowings]);

  // 章IDからインデックスへのルックアップMap
  const chapterIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    chapters.forEach((c, idx) => map.set(c.id, idx));
    return map;
  }, [chapters]);

  // 伏線の流れ（設置から回収まで）を計算
  const foreshadowingFlows = useMemo(() => {
    return foreshadowings.map(f => {
      const sortedPoints = [...f.points].sort((a, b) => {
        const idxA = chapterIndexMap.get(a.chapterId) ?? -1;
        const idxB = chapterIndexMap.get(b.chapterId) ?? -1;
        return idxA - idxB;
      });

      const firstPoint = sortedPoints[0];
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const startChapterIdx = firstPoint ? (chapterIndexMap.get(firstPoint.chapterId) ?? -1) : -1;
      const endChapterIdx = lastPoint ? (chapterIndexMap.get(lastPoint.chapterId) ?? -1) : -1;
      const plannedPayoffIdx = f.plannedPayoffChapterId
        ? (chapterIndexMap.get(f.plannedPayoffChapterId) ?? -1)
        : -1;

      return {
        foreshadowing: f,
        points: sortedPoints,
        startChapterIdx,
        endChapterIdx,
        plannedPayoffIdx,
        hasPayoff: sortedPoints.some(p => p.type === 'payoff'),
      };
    }).filter(flow => flow.startChapterIdx >= 0);
  }, [foreshadowings, chapterIndexMap]);

  // 統計データ（1パスで集計）
  const statsData = useMemo(() => {
    const total = foreshadowings.length;
    const statusCnts = { resolved: 0, planted: 0, hinted: 0, abandoned: 0 };
    const categoryCnts: Record<string, number> = {};
    const importanceCnts = { high: 0, medium: 0, low: 0 };
    let unresolvedHighImportance = 0;
    const chapterDensityCnts = new Map<string, number>();

    for (const f of foreshadowings) {
      // ステータス集計
      if (f.status in statusCnts) statusCnts[f.status as keyof typeof statusCnts]++;

      // カテゴリ集計
      categoryCnts[f.category] = (categoryCnts[f.category] || 0) + 1;

      // 重要度集計
      if (f.importance in importanceCnts) importanceCnts[f.importance as keyof typeof importanceCnts]++;

      // 未回収の高重要度
      if (f.importance === 'high' && (f.status === 'planted' || f.status === 'hinted')) {
        unresolvedHighImportance++;
      }

      // 章ごとのポイント密度
      for (const p of f.points) {
        chapterDensityCnts.set(p.chapterId, (chapterDensityCnts.get(p.chapterId) || 0) + 1);
      }
    }

    const byCategory = Object.keys(categoryConfig).map(key => ({
      category: key as Foreshadowing['category'],
      count: categoryCnts[key] || 0,
    }));

    const chapterDensity = chapters.map((chapter, idx) => ({
      chapterIndex: idx,
      title: chapter.title,
      density: chapterDensityCnts.get(chapter.id) || 0,
    }));

    const resolutionRate = total > 0 ? Math.round((statusCnts.resolved / total) * 100) : 0;

    return {
      total,
      ...statusCnts,
      byCategory,
      byImportance: importanceCnts,
      unresolvedHighImportance,
      chapterDensity,
      resolutionRate,
    };
  }, [foreshadowings, chapters]);

  return {
    filteredForeshadowings,
    statusCounts,
    timelineData,
    foreshadowingFlows,
    statsData,
  };
};
