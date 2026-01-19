import { useEffect, useRef } from 'react';
import { useToast } from './Toast';
import { useNetworkStatus, useOfflineQueueSize } from '../hooks/useNetworkStatus';
import { getOfflineQueueManager } from '../utils/networkRetryUtils';

/**
 * オフライン状態を検知して通知し、キュー状態を表示するコンポーネント
 */
export const OfflineNotifier: React.FC = () => {
  const { showWarning, showSuccess, showInfo } = useToast();
  const { isOnline, quality, lastOfflineAt } = useNetworkStatus();
  const queueSize = useOfflineQueueSize();
  const prevOnlineRef = useRef(isOnline);
  const prevQueueSizeRef = useRef(0);

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
          details: '一部の機能（AI生成、クラウドAIなど）が使用できません。\n\nリクエストはキューに保存され、接続復旧時に自動的に実行されます。\n\n使用可能な機能:\n- ローカルでの執筆\n- プロジェクトの編集\n- データの保存（ローカル）',
          persistent: true,
        }
      );
    } else {
      // オンライン状態に復帰
      const queue = getOfflineQueueManager();
      const pendingCount = queue.pendingCount();

      if (pendingCount > 0) {
        showSuccess(
          `インターネット接続が復旧しました（${pendingCount}件のリクエストを処理中）`,
          8000
        );
        // キューの処理を開始
        queue.processQueue();
      } else {
        showSuccess('インターネット接続が復旧しました', 5000);
      }
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline, showWarning, showSuccess]);

  // 低速ネットワークの警告
  useEffect(() => {
    if (isOnline && quality === 'slow') {
      showInfo(
        '低速なネットワーク接続を検出しました',
        5000
      );
    }
  }, [quality, isOnline, showInfo]);

  // キューサイズの変化を通知
  useEffect(() => {
    if (isOnline && prevQueueSizeRef.current > 0 && queueSize === 0) {
      showSuccess('保留中のリクエストがすべて完了しました', 3000);
    }
    prevQueueSizeRef.current = queueSize;
  }, [queueSize, isOnline, showSuccess]);

  // オフライン時間の算出（デバッグ用）
  useEffect(() => {
    if (!isOnline && lastOfflineAt) {
      console.log(`[OfflineNotifier] オフライン開始: ${lastOfflineAt.toLocaleString()}`);
    }
  }, [isOnline, lastOfflineAt]);

  return null;
};

