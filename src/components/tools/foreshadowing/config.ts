import { Clock, Target, CheckCircle, EyeOff } from 'lucide-react';
import type { Foreshadowing, ForeshadowingPoint } from '../../../contexts/ProjectContext';

// ステータスラベルとカラー
export const statusConfig: Record<Foreshadowing['status'], { label: string; color: string; icon: typeof Clock }> = {
  planted: { label: '設置済み', color: 'bg-blue-500', icon: Target },
  hinted: { label: '進行中', color: 'bg-amber-500', icon: Clock },
  resolved: { label: '回収済み', color: 'bg-green-500', icon: CheckCircle },
  abandoned: { label: '破棄', color: 'bg-gray-500', icon: EyeOff },
};

// カテゴリラベルとカラー
export const categoryConfig: Record<Foreshadowing['category'], { label: string; color: string }> = {
  character: { label: 'キャラクター', color: 'bg-pink-500' },
  plot: { label: 'プロット', color: 'bg-blue-500' },
  world: { label: '世界観', color: 'bg-green-500' },
  mystery: { label: 'ミステリー', color: 'bg-purple-500' },
  relationship: { label: '人間関係', color: 'bg-rose-500' },
  other: { label: 'その他', color: 'bg-gray-500' },
};

// 重要度ラベル
export const importanceConfig: Record<Foreshadowing['importance'], { label: string; stars: string; color: string }> = {
  high: { label: '高', stars: '★★★', color: 'text-red-500' },
  medium: { label: '中', stars: '★★☆', color: 'text-amber-500' },
  low: { label: '低', stars: '★☆☆', color: 'text-gray-500' },
};

// ポイントタイプラベル
export const pointTypeConfig: Record<ForeshadowingPoint['type'], { label: string; icon: string; color: string }> = {
  plant: { label: '設置', icon: '📍', color: 'text-blue-600' },
  hint: { label: 'ヒント', icon: '💡', color: 'text-amber-600' },
  payoff: { label: '回収', icon: '🎯', color: 'text-green-600' },
};
