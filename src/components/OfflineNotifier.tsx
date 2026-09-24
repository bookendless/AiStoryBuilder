import { useEffect, useRef } from 'react';
import { useToast } from './useToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

// 低速ネットワーク警告の設定
const SLOW_WARNING_COOLDOWN_MS = 5 * 60 * 1000; // 5分
const SLOW_DETECTION_DELAY_MS = 3000;           // 3秒

/**
 * オフライン状態・低速回線を検知して通知するコンポーネント
 */
export const OfflineNotifier: React.FC = () => {
  const { showWarning, showSuccess, showInfo } = useToast();
  const { isOnline, quality, lastOfflineAt } = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);
  const lastSlowWarningTimeRef = useRef<number>(0);

  // オンライン/オフライン状態の変化を検知
  useEffect(() => {
    // 初回レンダリングはスキップ
    if (prevOnlineRef.current === isOnline) {
      return;
    }

    if (!isOnline) {
      // オフライン状態
      showWarning(
        'オフライン状態です',
        0,
        {
          title: 'インターネット接続が切断されました',
          details: '一部の機能（AI生成、クラウドAIなど）が使用できません。\n\n使用可能な機能:\n- ローカルでの執筆\n- プロジェクトの編集\n- データの保存（ローカル）',
          persistent: true,
        }
      );
    } else {
      // オンライン状態に復帰
      showSuccess('インターネット接続が復旧しました', 5000);
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline, showWarning, showSuccess]);

  // 低速ネットワークの警告
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (isOnline && quality === 'slow') {
      const now = Date.now();
      // クールダウン期間内に既に警告を表示している場合は無視
      if (now - lastSlowWarningTimeRef.current < SLOW_WARNING_COOLDOWN_MS) {
        return;
      }

      // 値のぶれを防ぐため、一定時間持続した場合のみ表示
      timeoutId = setTimeout(() => {
        lastSlowWarningTimeRef.current = Date.now();
        showInfo(
          '低速なネットワーク接続を検出しました',
          5000
        );
      }, SLOW_DETECTION_DELAY_MS);
    }

    return () => clearTimeout(timeoutId);
  }, [quality, isOnline, showInfo]);

  // オフライン時間の算出（デバッグ用）
  useEffect(() => {
    if (!isOnline && lastOfflineAt) {
      console.log(`[OfflineNotifier] オフライン開始: ${lastOfflineAt.toLocaleString()}`);
    }
  }, [isOnline, lastOfflineAt]);

  return null;
};

