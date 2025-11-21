import { useEffect } from 'react';
import { useToast } from './Toast';
import { onOnlineStatusChange } from '../utils/performanceUtils';

/**
 * オフライン状態を検知して通知するコンポーネント
 */
export const OfflineNotifier: React.FC = () => {
  const { showWarning, showSuccess } = useToast();

  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      if (!isOnline) {
        // オフライン状態
        showWarning(
          'オフライン状態です',
          0,
          {
            title: 'インターネット接続が切断されました',
            details: '一部の機能（AI生成、クラウドAIなど）が使用できません。\n\n使用可能な機能:\n- ローカルでの執筆\n- プロジェクトの編集\n- データの保存（ローカル）\n\n使用不可な機能:\n- AI生成（クラウドAI）\n- 画像分析\n- オンライン同期',
            persistent: true,
          }
        );
      } else {
        // オンライン状態に復帰
        showSuccess('インターネット接続が復旧しました', 5000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [showWarning, showSuccess]);

  return null;
};

