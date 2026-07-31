/**
 * テスト環境セットアップ
 * 
 * このファイルは各テストファイルの実行前に自動的に読み込まれます。
 */

import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';

// グローバルモック設定

// IndexedDBのモック（Dexie用）
const indexedDB = {
    open: () => Promise.resolve({} as IDBDatabase),
    deleteDatabase: () => Promise.resolve(),
    cmp: () => 0,
    databases: () => Promise.resolve([]),
};

Object.defineProperty(window, 'indexedDB', {
    value: indexedDB,
    writable: true,
});

// MatchMedia のモック（レスポンシブ対応コンポーネント用）
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// ResizeObserver のモック
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
});

// IntersectionObserver のモック
class IntersectionObserverMock {
    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
    }
    callback: IntersectionObserverCallback;
    root = null;
    rootMargin = '';
    thresholds = [];
    observe() { }
    unobserve() { }
    disconnect() { }
    takeRecords() { return []; }
}

Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
});

// Crypto: jsdom は crypto.subtle を実装していないため Node の WebCrypto を使う。
// ここをダミー実装にすると暗号化・復号が常に「成功」してしまい、
// 復号失敗時の挙動（fail-closed）をテストで検証できなくなる。
Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
});

// localStorage: Node の実験的な localStorage グローバルが未設定のまま
// jsdom のものを覆い隠すことがあるため、使える実装を保証する。
const ensureStorage = (key: 'localStorage' | 'sessionStorage') => {
    const existing = (globalThis as Record<string, unknown>)[key];
    if (existing && typeof (existing as Storage).clear === 'function') {
        return;
    }

    const store = new Map<string, string>();
    const storage: Storage = {
        get length() { return store.size; },
        clear: () => store.clear(),
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (k: string) => { store.delete(k); },
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
    };

    Object.defineProperty(globalThis, key, { value: storage, writable: true, configurable: true });
    Object.defineProperty(window, key, { value: storage, writable: true, configurable: true });
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');


// console.error のカスタマイズ（テスト中の不要な警告を抑制）
const originalError = console.error;
console.error = (...args: unknown[]) => {
    // React の act() 警告を抑制
    if (
        typeof args[0] === 'string' &&
        args[0].includes('Warning: An update to')
    ) {
        return;
    }
    originalError.call(console, ...args);
};

// テスト後のクリーンアップ
afterEach(() => {
    // localStorage をクリア（clearメソッドが存在する場合のみ）
    if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
        try {
            localStorage.clear();
        } catch {
            // クリアに失敗しても無視
        }
    }
    // sessionStorage をクリア（clearメソッドが存在する場合のみ）
    if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.clear === 'function') {
        try {
            sessionStorage.clear();
        } catch {
            // クリアに失敗しても無視
        }
    }
});

// グローバル型定義の拡張
declare global {
    // vi はVitestが自動的に提供
    var vi: typeof import('vitest')['vi'];
}

export { };
