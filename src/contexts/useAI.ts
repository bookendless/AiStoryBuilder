import { createContext, useContext } from 'react';
import { AISettings } from '../types/ai';

/**
 * AIContext の型定義・Contextオブジェクト・参照フック
 *
 * Provider（AIContext.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

export interface AIContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
  isStorageReady: boolean; // ストレージの準備状態
}

export const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
