import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface PanelPosition {
  x: number;
  y: number;
}

interface UseDraggablePanelOptions {
  /** パネルが開いているか。閉じている間はイベントを張らない */
  isOpen: boolean;
  /** パネル本体のref。サイズ計測に使う */
  panelRef: React.RefObject<HTMLElement | null>;
  /** ドラッグされていないときの既定位置（ビューポート座標） */
  getDefaultPosition: () => PanelPosition | null;
  /** ドラッグ位置を永続化するlocalStorageキー。省略時は保存しない */
  storageKey?: string;
  /** 画面端に残す余白(px) */
  margin?: number;
}

interface UseDraggablePanelResult {
  /** パネルに適用する left/top。未計測時はnull */
  position: PanelPosition | null;
  isDragging: boolean;
  /** ドラッグハンドルの onPointerDown に渡す */
  startDrag: (event: React.PointerEvent) => void;
  /** 既定位置（ボタン直下）に戻す */
  resetPosition: () => void;
  /** ユーザーが動かした位置を使っているか */
  hasMoved: boolean;
}

const DEFAULT_MARGIN = 8;

const clampToViewport = (
  position: PanelPosition,
  size: { width: number; height: number },
  margin: number
): PanelPosition => {
  // パネルが画面より大きい場合でも左上は必ず見えるようにする
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  };
};

const isSamePosition = (a: PanelPosition | null, b: PanelPosition | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
};

const readStoredPosition = (storageKey?: string): PanelPosition | null => {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelPosition>;
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return null;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
};

/**
 * フローティングパネルをドラッグで移動できるようにする。
 * ドラッグされるまではgetDefaultPositionの位置に追従し、
 * どちらの場合もビューポート内に収まるよう座標を丸める。
 */
export const useDraggablePanel = ({
  isOpen,
  panelRef,
  getDefaultPosition,
  storageKey,
  margin = DEFAULT_MARGIN,
}: UseDraggablePanelOptions): UseDraggablePanelResult => {
  // ユーザーがドラッグした位置。nullなら既定位置に追従する
  const [movedPosition, setMovedPosition] = useState<PanelPosition | null>(() => readStoredPosition(storageKey));
  // 計測後にビューポート内へ丸めた既定位置
  const [anchorPosition, setAnchorPosition] = useState<PanelPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // ビューポート変化を再計測のトリガーにする
  const [layoutTick, setLayoutTick] = useState(0);

  const dragOffsetRef = useRef<PanelPosition>({ x: 0, y: 0 });
  const panelSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  // 毎レンダリングで同一性が変わるため、最新の関数をrefで保持する
  const getDefaultPositionRef = useRef(getDefaultPosition);
  getDefaultPositionRef.current = getDefaultPosition;

  // 開いた直後とビューポート変化時に、実寸を測って位置を画面内へ丸める
  useLayoutEffect(() => {
    if (!isOpen) return;
    const element = panelRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    panelSizeRef.current = size;

    if (movedPosition) {
      const clamped = clampToViewport(movedPosition, size, margin);
      if (!isSamePosition(clamped, movedPosition)) {
        setMovedPosition(clamped);
      }
      return;
    }

    const fallback = getDefaultPositionRef.current();
    const nextAnchor = fallback ? clampToViewport(fallback, size, margin) : null;
    setAnchorPosition((prev) => (isSamePosition(prev, nextAnchor) ? prev : nextAnchor));
    // movedPositionは丸め処理の中でのみ更新する。panelRefはref容器なので同一性を追わない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layoutTick, margin]);

  // 閉じたら既定位置のキャッシュを捨て、次に開くときに測り直す
  useEffect(() => {
    if (!isOpen) setAnchorPosition(null);
  }, [isOpen]);

  // ウィンドウサイズが変わったら測り直す
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => setLayoutTick((tick) => tick + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const startDrag = useCallback((event: React.PointerEvent) => {
    // ハンドル内のボタン（リセット等）はドラッグ開始の対象外
    if ((event.target as HTMLElement).closest('button, input, a')) return;
    const element = panelRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    panelSizeRef.current = { width: rect.width, height: rect.height };
    setIsDragging(true);
    // preventDefaultは呼ばない。pointerdownをキャンセルするとclick/dblclickが
    // 発火しなくなり、ダブルクリックでの位置リセットが効かなくなるため。
    // 文字選択はハンドル側のselect-noneで抑止している。
  }, [panelRef]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const next = clampToViewport(
        {
          x: event.clientX - dragOffsetRef.current.x,
          y: event.clientY - dragOffsetRef.current.y,
        },
        panelSizeRef.current,
        margin
      );
      setMovedPosition((prev) => (isSamePosition(prev, next) ? prev : next));
    };
    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, margin]);

  // ドラッグ位置を保存する。既定位置に追従している間は保存しない
  useEffect(() => {
    if (!storageKey || isDragging) return;
    try {
      if (movedPosition) {
        localStorage.setItem(storageKey, JSON.stringify(movedPosition));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // 保存できなくても移動自体は機能するため無視する
    }
  }, [movedPosition, isDragging, storageKey]);

  const resetPosition = useCallback(() => {
    setMovedPosition(null);
    setLayoutTick((tick) => tick + 1);
  }, []);

  return {
    position: movedPosition ?? anchorPosition,
    isDragging,
    startDrag,
    resetPosition,
    hasMoved: movedPosition !== null,
  };
};
