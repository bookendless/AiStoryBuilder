import React, { useState, useCallback } from 'react';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

export type SidebarItemId = string;

interface DraggableSidebarItem {
  id: SidebarItemId;
  content: React.ReactNode;
  header?: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconBgClass?: string;
  defaultExpanded?: boolean;
  className?: string;
}

interface DraggableSidebarProps {
  items: DraggableSidebarItem[];
  defaultOrder?: SidebarItemId[];
  storageKey?: string; // localStorageのキー（オプション）
  onOrderChange?: (newOrder: SidebarItemId[]) => void;
}

export const DraggableSidebar: React.FC<DraggableSidebarProps> = ({
  items,
  defaultOrder,
  storageKey,
  onOrderChange,
}) => {
  // localStorageから並び順を読み込む
  const loadOrder = useCallback((): SidebarItemId[] => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // 保存された順序が現在のitemsと一致するか確認
          if (Array.isArray(parsed) && parsed.every(id => items.some(item => item.id === id))) {
            return parsed;
          }
        }
      } catch (error) {
        console.error('Failed to load sidebar order:', error);
      }
    }
    return defaultOrder || items.map(item => item.id);
  }, [storageKey, defaultOrder, items]);

  const [itemOrder, setItemOrder] = useState<SidebarItemId[]>(loadOrder);
  const [expandedItems, setExpandedItems] = useState<Set<SidebarItemId>>(
    new Set(items.filter(item => item.defaultExpanded).map(item => item.id))
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 並び順を保存
  const saveOrder = useCallback((newOrder: SidebarItemId[]) => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch (error) {
        console.error('Failed to save sidebar order:', error);
      }
    }
    onOrderChange?.(newOrder);
  }, [storageKey, onOrderChange]);

  // 展開/折りたたみの切り替え
  const toggleExpansion = useCallback((itemId: SidebarItemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // ドラッグ開始
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // ドラッグ中
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  // ドラッグ離脱
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // ドロップ
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...itemOrder];
    const draggedItem = newOrder[draggedIndex];

    // ドラッグされた項目を削除
    newOrder.splice(draggedIndex, 1);

    // 新しい位置に挿入
    newOrder.splice(dropIndex, 0, draggedItem);

    setItemOrder(newOrder);
    saveOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, itemOrder, saveOrder]);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // 順序に従ってアイテムを取得
  const orderedItems = itemOrder
    .map(id => items.find(item => item.id === id))
    .filter((item): item is DraggableSidebarItem => item !== undefined);

  return (
    <div className="space-y-6">
      {orderedItems.map((item, index) => {
        const isExpanded = expandedItems.has(item.id);
        const isDragged = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`rounded-2xl shadow-lg border transition-all duration-200 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 ${
              isDragged
                ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                : isDragOver
                  ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                  : 'cursor-move hover:shadow-xl'
            } ${item.className || ''}`}
          >
            <div
              className="p-6 border-b border-gray-100 dark:border-gray-700 cursor-pointer"
              onClick={() => toggleExpansion(item.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {item.icon && (
                    <div className={`${item.iconBgClass || 'bg-gradient-to-br from-indigo-500 to-purple-600'} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                  )}
                  {item.title ? (
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  ) : item.header ? (
                    <div className="flex-1 min-w-0">
                      {item.header}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="p-6">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

