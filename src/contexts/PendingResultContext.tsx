import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useToast } from '../components/Toast';
import { CreativePoint, CreativePointSelection } from '../types/creativePoint';

/**
 * PendingResultContext - 重いAI生成の「結果保留 → 確認 → 反映/破棄」をグローバル管理する。
 *
 * 目的:
 * - ツールサイドバーの重い生成（構成・章立て・あらすじ・キャラ生成）は、即時自動反映せず、
 *   完了後にユーザーが反映するか否かを確認モーダルで選べるようにする。
 * - 生成完了時に生成元パネルがアンマウント済み（別ステップへ移動）でも機能するよう、
 *   保留結果とその反映処理（onApply クロージャ）をグローバルに保持する。
 * - 完了はグローバルトーストで通知し、「確認する」アクションからモーダルを開ける。
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

interface ProposeResultInput {
  label: string;
  preview: ReactNode;
  onApply: () => void | Promise<void>;
  applyLabel?: string;
  applySuccessMessage?: string;
  creativePoints?: CreativePoint[];
  onRegenerateWithSelections?: (selections: CreativePointSelection[]) => void | Promise<void>;
}

interface PendingResultContextType {
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

const PendingResultContext = createContext<PendingResultContextType | undefined>(undefined);

export const usePendingResult = (): PendingResultContextType => {
  const context = useContext(PendingResultContext);
  if (!context) {
    throw new Error('usePendingResult must be used within a PendingResultProvider');
  }
  return context;
};

const genId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const PendingResultProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showSuccess, showInfo, showError } = useToast();
  const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 最新の保留結果を同期参照（applyResult で onApply を引くため）
  const resultsRef = useRef<PendingResult[]>([]);
  resultsRef.current = pendingResults;

  const openResult = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const removeResult = useCallback((id: string) => {
    setPendingResults((prev) => prev.filter((r) => r.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const proposeResult = useCallback(
    (input: ProposeResultInput): string => {
      const id = genId();
      const result: PendingResult = {
        id,
        label: input.label,
        preview: input.preview,
        onApply: input.onApply,
        applyLabel: input.applyLabel,
        applySuccessMessage: input.applySuccessMessage,
        creativePoints: input.creativePoints,
        onRegenerateWithSelections: input.onRegenerateWithSelections,
      };
      setPendingResults((prev) => [...prev, result]);
      // どのステップにいても表示されるグローバルトースト＋「確認する」アクション。
      // トーストは一時的な通知（自動で消える）。消しても結果は保留に残り、
      // 左下インジケータの「確認待ち」からいつでも反映/破棄できる。
      showSuccess(`${input.label}の生成が完了しました`, 8000, {
        title: '生成が完了しました',
        action: {
          label: '確認する',
          onClick: () => setActiveId(id),
          variant: 'primary',
        },
      });
      return id;
    },
    [showSuccess]
  );

  const applyResult = useCallback(
    async (id: string) => {
      const target = resultsRef.current.find((r) => r.id === id);
      if (!target) return;
      try {
        await target.onApply();
        removeResult(id);
        showSuccess(target.applySuccessMessage ?? `${target.label}を反映しました`);
      } catch (error) {
        console.error('保留結果の反映に失敗しました:', error);
        showError(`${target.label}の反映に失敗しました`);
      }
    },
    [removeResult, showSuccess, showError]
  );

  const discardResult = useCallback(
    (id: string) => {
      const target = resultsRef.current.find((r) => r.id === id);
      removeResult(id);
      if (target) {
        showInfo(`${target.label}を破棄しました`);
      }
    },
    [removeResult, showInfo]
  );

  const closeActive = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeResult = useMemo(
    () => pendingResults.find((r) => r.id === activeId) ?? null,
    [pendingResults, activeId]
  );

  const value = useMemo(
    () => ({
      pendingResults,
      activeResult,
      proposeResult,
      openResult,
      applyResult,
      discardResult,
      removeResult,
      closeActive,
    }),
    [pendingResults, activeResult, proposeResult, openResult, applyResult, discardResult, removeResult, closeActive]
  );

  return <PendingResultContext.Provider value={value}>{children}</PendingResultContext.Provider>;
};
