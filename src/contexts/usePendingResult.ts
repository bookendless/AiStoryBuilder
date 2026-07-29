import { createContext, useContext, ReactNode } from 'react';
import { CreativePoint, CreativePointSelection } from '../types/creativePoint';

/**
 * PendingResultContext の型定義・Contextオブジェクト・参照フック
 *
 * Provider（PendingResultContext.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

export interface PendingResult {
  id: string;
  label: string; // 例: 「構成全体」
  preview: ReactNode; // 確認モーダルに表示する要約・プレビュー
  onApply: () => void | Promise<void>; // 反映処理（パネル側クロージャ。updateProject 等を捕捉）
  applyLabel?: string; // 反映ボタンの表示（既定: 「反映する」）
  applySuccessMessage?: string; // 反映完了トースト文言（既定: 「○○を反映しました」）
  /** 創造ポイント（Phase C）。あれば確認モーダルにカードを表示する */
  creativePoints?: CreativePoint[];
  /** 別案再生成ハンドラ（Phase C）。選択した複数別案をまとめて1回再実行する */
  onRegenerateWithSelections?: (selections: CreativePointSelection[]) => void | Promise<void>;
}

export interface ProposeResultInput {
  label: string;
  preview: ReactNode;
  onApply: () => void | Promise<void>;
  applyLabel?: string;
  applySuccessMessage?: string;
  creativePoints?: CreativePoint[];
  onRegenerateWithSelections?: (selections: CreativePointSelection[]) => void | Promise<void>;
}

export interface PendingResultContextType {
  pendingResults: PendingResult[];
  activeResult: PendingResult | null;
  /** 結果を保留に登録し、完了トースト（「確認する」アクション付き）を発火 */
  proposeResult: (input: ProposeResultInput) => string;
  /** 指定IDの結果を確認モーダルで開く */
  openResult: (id: string) => void;
  /** 反映（onApply実行）して保留から除去 */
  applyResult: (id: string) => Promise<void>;
  /** 破棄して保留から除去 */
  discardResult: (id: string) => void;
  /** トースト無しで保留から除去（別案再生成などで静かに差し替える場合） */
  removeResult: (id: string) => void;
  /** モーダルを閉じる（保留は残す） */
  closeActive: () => void;
}

export const PendingResultContext = createContext<PendingResultContextType | undefined>(undefined);

export const usePendingResult = (): PendingResultContextType => {
  const context = useContext(PendingResultContext);
  if (!context) {
    throw new Error('usePendingResult must be used within a PendingResultProvider');
  }
  return context;
};
