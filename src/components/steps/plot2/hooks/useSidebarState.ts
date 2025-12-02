import { useState, useCallback } from 'react';
import { SidebarSection } from '../types';
import { DEFAULT_SIDEBAR_SECTIONS } from '../constants';

interface UseSidebarStateReturn {
  sidebarSections: SidebarSection[];
  draggedSectionId: string | null;
  dragOverSectionId: string | null;
  setDraggedSectionId: (id: string | null) => void;
  setDragOverSectionId: (id: string | null) => void;
  toggleSidebarSection: (sectionId: string) => void;
  handleDragStart: (e: React.DragEvent, sectionId: string) => void;
  handleDragOver: (e: React.DragEvent, sectionId: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetSectionId: string) => void;
  handleDragEnd: () => void;
  onSectionReorder: () => void;
}

export function useSidebarState(
  onSectionReorder?: () => void
): UseSidebarStateReturn {
  const [sidebarSections, setSidebarSections] = useState<SidebarSection[]>(DEFAULT_SIDEBAR_SECTIONS);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  // サイドバーセクションの折りたたみ切り替え
  const toggleSidebarSection = useCallback((sectionId: string) => {
    setSidebarSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, collapsed: !section.collapsed }
          : section
      )
    );
  }, []);

  // ドラッグ開始
  const handleDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    setDraggedSectionId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', sectionId);
  }, []);

  // ドラッグオーバー
  const handleDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSectionId !== null && draggedSectionId !== sectionId) {
      setDragOverSectionId(sectionId);
    }
  }, [draggedSectionId]);

  // ドラッグ離脱
  const handleDragLeave = useCallback(() => {
    setDragOverSectionId(null);
  }, []);

  // ドロップ
  const handleDrop = useCallback((e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();

    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    setSidebarSections(prev => {
      const newSections = [...prev];
      const draggedIndex = newSections.findIndex(s => s.id === draggedSectionId);
      const targetIndex = newSections.findIndex(s => s.id === targetSectionId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const [removed] = newSections.splice(draggedIndex, 1);
      newSections.splice(targetIndex, 0, removed);

      return newSections;
    });

    setDraggedSectionId(null);
    setDragOverSectionId(null);
    if (onSectionReorder) {
      onSectionReorder();
    }
  }, [draggedSectionId, onSectionReorder]);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  }, []);

  return {
    sidebarSections,
    draggedSectionId,
    dragOverSectionId,
    setDraggedSectionId,
    setDragOverSectionId,
    toggleSidebarSection,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    onSectionReorder: onSectionReorder || (() => {}),
  };
}

