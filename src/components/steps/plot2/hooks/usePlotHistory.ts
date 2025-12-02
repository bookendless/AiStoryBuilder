import { useCallback, useRef, useEffect } from 'react';
import { HistoryState, PlotFormData, PlotStructureType } from '../types';
import { MAX_HISTORY_SIZE, HISTORY_SAVE_DELAY } from '../constants';

interface UsePlotHistoryProps {
  formData: PlotFormData;
  plotStructure: PlotStructureType;
  projectId?: string;
}

interface UsePlotHistoryReturn {
  saveToHistory: (data: PlotFormData, structure: PlotStructureType) => void;
  handleUndo: () => HistoryState | null;
  handleRedo: () => HistoryState | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  initializeHistory: (initialState: HistoryState) => void;
}

export function usePlotHistory({
  formData,
  plotStructure,
  projectId,
}: UsePlotHistoryProps): UsePlotHistoryReturn {
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);

  // 履歴に状態を保存
  const saveToHistory = useCallback((data: PlotFormData, structure: PlotStructureType) => {
    const newState: HistoryState = {
      formData: { ...data },
      plotStructure: structure,
      timestamp: Date.now(),
    };

    // 現在の位置より後ろの履歴を削除（分岐した履歴を削除）
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // 新しい状態を追加
    historyRef.current.push(newState);

    // 履歴サイズ制限
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  }, []);

  // 初期状態を設定
  const initializeHistory = useCallback((initialState: HistoryState) => {
    historyRef.current = [initialState];
    historyIndexRef.current = 0;
  }, []);

  // プロジェクトIDが変わったときに履歴をリセット
  useEffect(() => {
    if (projectId) {
      historyRef.current = [];
      historyIndexRef.current = -1;
    }
  }, [projectId]);

  const canUndo = useCallback(() => {
    return historyIndexRef.current > 0;
  }, []);

  const canRedo = useCallback(() => {
    return historyIndexRef.current < historyRef.current.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      return historyRef.current[historyIndexRef.current];
    }
    return null;
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      return historyRef.current[historyIndexRef.current];
    }
    return null;
  }, []);

  return {
    saveToHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    initializeHistory,
  };
}

