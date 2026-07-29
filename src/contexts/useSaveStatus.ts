import { createContext, useContext } from 'react';

/**
 * 保存ステータス専用 Context とその参照フック
 *
 * 保存ステータス（isLoading/lastSaved）は自動保存のたびに変化するため、
 * メインContextから分離して全消費者の再レンダリングを防ぐ。
 * Provider は ProjectContext.tsx（コンポーネント専用ファイル）に置くため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

export interface SaveStatusContextType {
  isLoading: boolean;
  lastSaved: Date | null;
}

export const SaveStatusContext = createContext<SaveStatusContextType | undefined>(undefined);

/** 保存インジケータ等、保存ステータスのみ必要なコンポーネント用フック */
export const useSaveStatus = () => {
  const context = useContext(SaveStatusContext);
  if (!context) {
    throw new Error('useSaveStatus must be used within a ProjectProvider');
  }
  return context;
};
