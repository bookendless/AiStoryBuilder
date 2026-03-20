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

  // 伏線の流れ（設置から回収まで）を計算
  const foreshadowingFlows = useMemo(() => {
    return foreshadowings.map(f => {
      const sortedPoints = [...f.points].sort((a, b) => {
        const idxA = chapters.findIndex(c => c.id === a.chapterId);
        const idxB = chapters.findIndex(c => c.id === b.chapterId);
        return idxA - idxB;
      });

      const firstPoint = sortedPoints[0];
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const startChapterIdx = firstPoint ? chapters.findIndex(c => c.id === firstPoint.chapterId) : -1;
      const endChapterIdx = lastPoint ? chapters.findIndex(c => c.id === lastPoint.chapterId) : -1;
      const plannedPayoffIdx = f.plannedPayoffChapterId
        ? chapters.findIndex(c => c.id === f.plannedPayoffChapterId)
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
  }, [foreshadowings, chapters]);

  // 統計データ
  const statsData = useMemo(() => {
    const total = foreshadowings.length;
    const resolved = foreshadowings.filter(f => f.status === 'resolved').length;
    const planted = foreshadowings.filter(f => f.status === 'planted').length;
    const hinted = foreshadowings.filter(f => f.status === 'hinted').length;
    const abandoned = foreshadowings.filter(f => f.status === 'abandoned').length;

    const byCategory = Object.keys(categoryConfig).map(key => ({
      category: key as Foreshadowing['category'],
      count: foreshadowings.filter(f => f.category === key).length,
    }));

    const byImportance = {
      high: foreshadowings.filter(f => f.importance === 'high').length,
      medium: foreshadowings.filter(f => f.importance === 'medium').length,
      low: foreshadowings.filter(f => f.importance === 'low').length,
    };

    const unresolvedHighImportance = foreshadowings.filter(
      f => f.importance === 'high' && (f.status === 'planted' || f.status === 'hinted')
    ).length;

    const chapterDensity = chapters.map((chapter, idx) => {
      const pointsInChapter = foreshadowings.reduce((acc, f) => {
        return acc + f.points.filter(p => p.chapterId === chapter.id).length;
      }, 0);
      return { chapterIndex: idx, title: chapter.title, density: pointsInChapter };
    });

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      resolved,
      planted,
      hinted,
      abandoned,
      byCategory,
      byImportance,
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
