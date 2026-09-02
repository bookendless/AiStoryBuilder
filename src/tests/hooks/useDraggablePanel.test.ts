import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraggablePanel } from '../../hooks/useDraggablePanel';

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 200;
const STORAGE_KEY = 'test-panel-position';

let panelElement: HTMLDivElement;

/** jsdomはレイアウトしないため、パネルの実寸と位置を差し替える */
const stubRect = (left: number, top: number) => {
  panelElement.getBoundingClientRect = vi.fn(() => ({
    left,
    top,
    right: left + PANEL_WIDTH,
    bottom: top + PANEL_HEIGHT,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    x: left,
    y: top,
    toJSON: () => ({}),
  })) as unknown as HTMLDivElement['getBoundingClientRect'];
};

const pointerEvent = (type: string, clientX: number, clientY: number) =>
  new MouseEvent(type, { clientX, clientY, bubbles: true });

const renderPanel = (getDefaultPosition: () => { x: number; y: number } | null) =>
  renderHook(() => useDraggablePanel({
    isOpen: true,
    panelRef: { current: panelElement },
    getDefaultPosition,
    storageKey: STORAGE_KEY,
  }));

describe('useDraggablePanel', () => {
  beforeEach(() => {
    window.innerWidth = 1024;
    window.innerHeight = 768;
    localStorage.clear();
    panelElement = document.createElement('div');
    document.body.appendChild(panelElement);
    stubRect(0, 0);
  });

  afterEach(() => {
    panelElement.remove();
  });

  it('既定位置が画面外にはみ出す場合はビューポート内へ丸める', () => {
    // ボタンが画面下部にある想定。そのまま出すと下端をはみ出す
    const { result } = renderPanel(() => ({ x: 900, y: 700 }));

    // maxX = 1024 - 320 - 8 = 696 / maxY = 768 - 200 - 8 = 560
    expect(result.current.position).toEqual({ x: 696, y: 560 });
    expect(result.current.hasMoved).toBe(false);
  });

  it('ハンドルのドラッグで位置が追従し、localStorageに保存される', () => {
    const { result } = renderPanel(() => ({ x: 100, y: 100 }));

    act(() => {
      result.current.startDrag({
        target: panelElement,
        clientX: 100,
        clientY: 50,
      } as unknown as React.PointerEvent);
    });
    expect(result.current.isDragging).toBe(true);

    // つかんだ位置(パネル左上から100,50)を保ったまま移動する
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 500, 400));
    });
    expect(result.current.position).toEqual({ x: 400, y: 350 });

    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 500, 400));
    });
    expect(result.current.isDragging).toBe(false);
    expect(result.current.hasMoved).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({ x: 400, y: 350 });
  });

  it('画面外へはドラッグできない', () => {
    const { result } = renderPanel(() => ({ x: 100, y: 100 }));

    act(() => {
      result.current.startDrag({
        target: panelElement,
        clientX: 0,
        clientY: 0,
      } as unknown as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 5000, 5000));
    });

    expect(result.current.position).toEqual({ x: 696, y: 560 });
  });

  it('ハンドル内のボタン上ではドラッグを開始しない', () => {
    const button = document.createElement('button');
    panelElement.appendChild(button);
    const { result } = renderPanel(() => ({ x: 100, y: 100 }));

    act(() => {
      result.current.startDrag({
        target: button,
        clientX: 10,
        clientY: 10,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('resetPositionで保存を消して既定位置に戻る', () => {
    const { result } = renderPanel(() => ({ x: 100, y: 100 }));

    act(() => {
      result.current.startDrag({
        target: panelElement,
        clientX: 0,
        clientY: 0,
      } as unknown as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 300, 300));
      window.dispatchEvent(pointerEvent('pointerup', 300, 300));
    });
    expect(result.current.hasMoved).toBe(true);

    act(() => {
      result.current.resetPosition();
    });

    expect(result.current.hasMoved).toBe(false);
    expect(result.current.position).toEqual({ x: 100, y: 100 });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('保存済みの位置があれば次に開いたときに復元する', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 200, y: 150 }));
    const { result } = renderPanel(() => ({ x: 900, y: 700 }));

    expect(result.current.position).toEqual({ x: 200, y: 150 });
    expect(result.current.hasMoved).toBe(true);
  });

  it('ウィンドウが縮んだら保存済みの位置も画面内へ戻す', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 900, y: 700 }));
    const { result } = renderPanel(() => ({ x: 100, y: 100 }));

    // 初回計測の時点で丸められる
    expect(result.current.position).toEqual({ x: 696, y: 560 });

    act(() => {
      window.innerWidth = 600;
      window.innerHeight = 400;
      window.dispatchEvent(new Event('resize'));
    });

    // maxX = 600 - 320 - 8 = 272 / maxY = 400 - 200 - 8 = 192
    expect(result.current.position).toEqual({ x: 272, y: 192 });
  });
});
