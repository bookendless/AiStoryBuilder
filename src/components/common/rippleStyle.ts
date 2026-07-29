/**
 * リップルエフェクト用のスタイル
 *
 * MicroInteractions.tsx（RippleButton）から参照する定数。
 * コンポーネント専用ファイルに非コンポーネントのexportを混ぜないため独立ファイルに切り出している
 * （Fast Refresh を有効に保つ）。
 */

export const rippleStyle = `
@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.ripple-effect {
  position: relative;
  overflow: hidden;
}

.ripple-effect::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
  animation: ripple 0.6s;
  pointer-events: none;
}
`;
