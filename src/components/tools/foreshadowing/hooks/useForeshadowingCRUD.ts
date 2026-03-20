import { useState } from 'react';
import { useProject, Chapter, Foreshadowing, ForeshadowingPoint } from '../../../../contexts/ProjectContext';
import { useToast } from '../../../Toast';
import type { DeletingPointInfo } from '../types';

// 伏線ポイントのタイプに応じたプレフィックスを返す
const getForeshadowingEventPrefix = (type: ForeshadowingPoint['type']): string => {
  switch (type) {
    case 'plant': return '【伏線：設置】';
    case 'hint': return '【伏線：ヒント】';
    case 'payoff': return '【伏線：回収】';
  }
};

// 伏線のポイント情報を元に、対象チャプターの keyEvents と foreshadowingRefs を更新する
const syncForeshadowingToChapters = (
  foreshadowingTitle: string,
  foreshadowingId: string,
  points: { chapterId: string; type: ForeshadowingPoint['type']; description: string }[],
  existingChapters: Chapter[],
  additionalChapterUpdates?: { chapterId: string; eventText: string }[]
): Chapter[] => {
  const chapterUpdates = new Map<string, { events: string[]; refId: string }>();

  for (const point of points) {
    const prefix = getForeshadowingEventPrefix(point.type);
    const eventText = `${prefix}${foreshadowingTitle} - ${point.description}`;
    const existing = chapterUpdates.get(point.chapterId);
    if (existing) {
      existing.events.push(eventText);
    } else {
      chapterUpdates.set(point.chapterId, { events: [eventText], refId: foreshadowingId });
    }
  }

  if (additionalChapterUpdates) {
    for (const update of additionalChapterUpdates) {
      const existing = chapterUpdates.get(update.chapterId);
      if (existing) {
        existing.events.push(update.eventText);
      } else {
        chapterUpdates.set(update.chapterId, { events: [update.eventText], refId: foreshadowingId });
      }
    }
  }

  return existingChapters.map(chapter => {
    const update = chapterUpdates.get(chapter.id);
    if (!update) return chapter;

    const currentKeyEvents = chapter.keyEvents || [];
    const currentRefs = chapter.foreshadowingRefs || [];
    const newEvents = update.events.filter(evt => !currentKeyEvents.includes(evt));
    const newRefs = currentRefs.includes(update.refId)
      ? currentRefs
      : [...currentRefs, update.refId];

    if (newEvents.length === 0 && newRefs.length === currentRefs.length) {
      return chapter;
    }

    return {
      ...chapter,
      keyEvents: [...currentKeyEvents, ...newEvents],
      foreshadowingRefs: newRefs,
    };
  });
};

export const useForeshadowingCRUD = () => {
  const { currentProject, updateProject } = useProject();
  const { showWarning } = useToast();

  const foreshadowings = currentProject?.foreshadowings || [];
  const chapters = currentProject?.chapters || [];

  // 削除確認用の状態
  const [deletingForeshadowingId, setDeletingForeshadowingId] = useState<string | null>(null);
  const [deletingPointInfo, setDeletingPointInfo] = useState<DeletingPointInfo | null>(null);

  // フォームデータの状態
  const [formData, setFormData] = useState<Partial<Foreshadowing>>({
    title: '',
    description: '',
    importance: 'medium',
    status: 'planted',
    category: 'plot',
    points: [],
    relatedCharacterIds: [],
    plannedPayoffChapterId: '',
    plannedPayoffDescription: '',
    tags: [],
    notes: '',
  });
  const [plantChapterId, setPlantChapterId] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingForeshadowing, setEditingForeshadowing] = useState<Foreshadowing | null>(null);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      importance: 'medium',
      status: 'planted',
      category: 'plot',
      points: [],
      relatedCharacterIds: [],
      plannedPayoffChapterId: '',
      plannedPayoffDescription: '',
      tags: [],
      notes: '',
    });
    setPlantChapterId('');
    setTagInput('');
  };

  // タグ追加
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim();
    if (!formData.tags?.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag],
      });
    }
    setTagInput('');
  };

  // タグ削除
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
    });
  };

  // 伏線の追加
  const handleAddForeshadowing = () => {
    if (!formData.title || !formData.description) {
      showWarning('タイトルと説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const now = new Date();
    const initialPoints: ForeshadowingPoint[] = [];
    if (plantChapterId) {
      initialPoints.push({
        id: `${Date.now()}-plant`,
        chapterId: plantChapterId,
        type: 'plant',
        description: '伏線の設置',
        createdAt: now,
      });
    }

    const newForeshadowing: Foreshadowing = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      importance: formData.importance || 'medium',
      status: formData.status || 'planted',
      category: formData.category || 'plot',
      points: [...initialPoints, ...(formData.points || [])],
      relatedCharacterIds: formData.relatedCharacterIds,
      plannedPayoffChapterId: formData.plannedPayoffChapterId || undefined,
      plannedPayoffDescription: formData.plannedPayoffDescription || undefined,
      tags: formData.tags || [],
      notes: formData.notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const additionalUpdates: { chapterId: string; eventText: string }[] = [];
    if (newForeshadowing.plannedPayoffChapterId && newForeshadowing.plannedPayoffDescription) {
      additionalUpdates.push({
        chapterId: newForeshadowing.plannedPayoffChapterId,
        eventText: `【伏線：回収予定】${newForeshadowing.title} - ${newForeshadowing.plannedPayoffDescription}`,
      });
    } else if (newForeshadowing.plannedPayoffChapterId) {
      additionalUpdates.push({
        chapterId: newForeshadowing.plannedPayoffChapterId,
        eventText: `【伏線：回収予定】${newForeshadowing.title} - 回収予定`,
      });
    }

    const updatedChapters = syncForeshadowingToChapters(
      newForeshadowing.title,
      newForeshadowing.id,
      newForeshadowing.points.map(p => ({ chapterId: p.chapterId, type: p.type, description: p.description })),
      chapters,
      additionalUpdates
    );

    updateProject({
      foreshadowings: [...foreshadowings, newForeshadowing],
      chapters: updatedChapters,
    });

    resetForm();
    setShowAddForm(false);
  };

  // 伏線の編集フォームを開く
  const handleEditForeshadowing = (foreshadowing: Foreshadowing) => {
    setEditingForeshadowing(foreshadowing);
    setFormData({
      title: foreshadowing.title,
      description: foreshadowing.description,
      importance: foreshadowing.importance,
      status: foreshadowing.status,
      category: foreshadowing.category,
      points: foreshadowing.points,
      relatedCharacterIds: foreshadowing.relatedCharacterIds || [],
      plannedPayoffChapterId: foreshadowing.plannedPayoffChapterId || '',
      plannedPayoffDescription: foreshadowing.plannedPayoffDescription || '',
      tags: foreshadowing.tags || [],
      notes: foreshadowing.notes || '',
    });
    const firstPlantPoint = foreshadowing.points.find(p => p.type === 'plant');
    setPlantChapterId(firstPlantPoint?.chapterId || '');
    setShowAddForm(true);
  };

  // 伏線の更新
  const handleUpdateForeshadowing = () => {
    if (!editingForeshadowing || !formData.title || !formData.description) {
      showWarning('タイトルと説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    let updatedPoints = [...(formData.points || [])];
    if (plantChapterId) {
      const hasPlantPoint = updatedPoints.some(p => p.type === 'plant' && p.chapterId === plantChapterId);
      if (!hasPlantPoint) {
        const existingPlantPoint = updatedPoints.find(p => p.type === 'plant');
        if (existingPlantPoint) {
          updatedPoints = updatedPoints.filter(p => p.id !== existingPlantPoint.id);
        }
        updatedPoints.unshift({
          id: `${Date.now()}-plant`,
          chapterId: plantChapterId,
          type: 'plant',
          description: existingPlantPoint?.description || '伏線の設置',
          createdAt: existingPlantPoint?.createdAt || new Date(),
        });
      }
    }

    const updatedForeshadowing: Foreshadowing = {
      ...editingForeshadowing,
      title: formData.title,
      description: formData.description,
      importance: formData.importance || 'medium',
      status: formData.status || 'planted',
      category: formData.category || 'plot',
      points: updatedPoints,
      relatedCharacterIds: formData.relatedCharacterIds,
      plannedPayoffChapterId: formData.plannedPayoffChapterId || undefined,
      plannedPayoffDescription: formData.plannedPayoffDescription || undefined,
      tags: formData.tags || [],
      notes: formData.notes || undefined,
      updatedAt: new Date(),
    };

    updateProject({
      foreshadowings: foreshadowings.map(f =>
        f.id === editingForeshadowing.id ? updatedForeshadowing : f
      ),
    });

    resetForm();
    setEditingForeshadowing(null);
    setShowAddForm(false);
  };

  // 伏線の削除（確認ダイアログ表示）
  const handleDeleteForeshadowing = (id: string) => {
    setDeletingForeshadowingId(id);
  };

  // 伏線削除確認
  const handleConfirmDeleteForeshadowing = () => {
    if (!deletingForeshadowingId) return;

    const deletingForeshadowing = foreshadowings.find(f => f.id === deletingForeshadowingId);
    const updatedChapters = chapters.map(chapter => {
      const currentKeyEvents = chapter.keyEvents || [];
      const currentRefs = chapter.foreshadowingRefs || [];

      const filteredEvents = deletingForeshadowing
        ? currentKeyEvents.filter(evt => {
          if (!evt.startsWith('【伏線：')) return true;
          return !evt.includes(deletingForeshadowing.title);
        })
        : currentKeyEvents;

      const filteredRefs = currentRefs.filter(ref => ref !== deletingForeshadowingId);

      if (filteredEvents.length === currentKeyEvents.length && filteredRefs.length === currentRefs.length) {
        return chapter;
      }

      return {
        ...chapter,
        keyEvents: filteredEvents,
        foreshadowingRefs: filteredRefs,
      };
    });

    updateProject({
      foreshadowings: foreshadowings.filter(f => f.id !== deletingForeshadowingId),
      chapters: updatedChapters,
    });
    setDeletingForeshadowingId(null);
  };

  // ポイントの追加
  const handleAddPoint = (
    foreshadowingId: string,
    pointFormData: Partial<ForeshadowingPoint>,
    onSuccess: () => void
  ) => {
    if (!pointFormData.chapterId || !pointFormData.description) {
      showWarning('章と説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const newPoint: ForeshadowingPoint = {
      id: Date.now().toString(),
      chapterId: pointFormData.chapterId,
      type: pointFormData.type || 'plant',
      description: pointFormData.description,
      lineReference: pointFormData.lineReference || undefined,
      createdAt: new Date(),
    };

    const updatedForeshadowings = foreshadowings.map(f => {
      if (f.id === foreshadowingId) {
        let newStatus = f.status;
        if (newPoint.type === 'payoff') {
          newStatus = 'resolved';
        } else if (newPoint.type === 'hint' && f.status === 'planted') {
          newStatus = 'hinted';
        }
        return {
          ...f,
          points: [...f.points, newPoint],
          status: newStatus,
          updatedAt: new Date(),
        };
      }
      return f;
    });

    const targetForeshadowing = foreshadowings.find(f => f.id === foreshadowingId);
    const syncedChapters = syncForeshadowingToChapters(
      targetForeshadowing?.title || '',
      foreshadowingId,
      [{ chapterId: newPoint.chapterId, type: newPoint.type, description: newPoint.description }],
      chapters
    );

    updateProject({ foreshadowings: updatedForeshadowings, chapters: syncedChapters });
    onSuccess();
  };

  // ポイントの削除（確認ダイアログ表示）
  const handleDeletePoint = (foreshadowingId: string, pointId: string) => {
    setDeletingPointInfo({ foreshadowingId, pointId });
  };

  // ポイント削除確認
  const handleConfirmDeletePoint = () => {
    if (!deletingPointInfo) return;

    const targetForeshadowing = foreshadowings.find(f => f.id === deletingPointInfo.foreshadowingId);
    const deletingPoint = targetForeshadowing?.points.find(p => p.id === deletingPointInfo.pointId);

    const updatedForeshadowings = foreshadowings.map(f => {
      if (f.id === deletingPointInfo.foreshadowingId) {
        const newPoints = f.points.filter(p => p.id !== deletingPointInfo.pointId);
        let newStatus: Foreshadowing['status'] = 'planted';
        if (newPoints.some(p => p.type === 'payoff')) {
          newStatus = 'resolved';
        } else if (newPoints.some(p => p.type === 'hint')) {
          newStatus = 'hinted';
        }
        return {
          ...f,
          points: newPoints,
          status: (f.status === 'abandoned' ? 'abandoned' : newStatus) as Foreshadowing['status'],
          updatedAt: new Date(),
        };
      }
      return f;
    });

    let updatedChapters = chapters;
    if (deletingPoint && targetForeshadowing) {
      const prefix = getForeshadowingEventPrefix(deletingPoint.type);
      const eventText = `${prefix}${targetForeshadowing.title} - ${deletingPoint.description}`;

      updatedChapters = chapters.map(chapter => {
        if (chapter.id !== deletingPoint.chapterId) return chapter;

        const currentKeyEvents = chapter.keyEvents || [];
        const filteredEvents = currentKeyEvents.filter(evt => evt !== eventText);

        if (filteredEvents.length === currentKeyEvents.length) return chapter;

        const remainingPointsInChapter = targetForeshadowing.points
          .filter(p => p.id !== deletingPointInfo.pointId && p.chapterId === chapter.id);
        const hasRemainingForeshadowingEvents = filteredEvents.some(
          evt => evt.startsWith('【伏線：') && evt.includes(targetForeshadowing.title)
        );

        return {
          ...chapter,
          keyEvents: filteredEvents,
          foreshadowingRefs: (remainingPointsInChapter.length === 0 && !hasRemainingForeshadowingEvents)
            ? (chapter.foreshadowingRefs || []).filter(ref => ref !== targetForeshadowing.id)
            : chapter.foreshadowingRefs,
        };
      });
    }

    updateProject({ foreshadowings: updatedForeshadowings, chapters: updatedChapters });
    setDeletingPointInfo(null);
  };

  return {
    formData,
    setFormData,
    plantChapterId,
    setPlantChapterId,
    tagInput,
    setTagInput,
    showAddForm,
    setShowAddForm,
    editingForeshadowing,
    setEditingForeshadowing,
    deletingForeshadowingId,
    setDeletingForeshadowingId,
    deletingPointInfo,
    setDeletingPointInfo,
    resetForm,
    handleAddTag,
    handleRemoveTag,
    handleAddForeshadowing,
    handleEditForeshadowing,
    handleUpdateForeshadowing,
    handleDeleteForeshadowing,
    handleConfirmDeleteForeshadowing,
    handleAddPoint,
    handleDeletePoint,
    handleConfirmDeletePoint,
  };
};
