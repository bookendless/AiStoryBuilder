/**
 * テスト環境セットアップ
 * 
 * このファイルは各テストファイルの実行前に自動的に読み込まれます。
 */

import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

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

// Crypto のモック（暗号化ユーティリティ用）
Object.defineProperty(window, 'crypto', {
    value: {
        getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        subtle: {
            digest: async () => new ArrayBuffer(32),
            encrypt: async () => new ArrayBuffer(16),
            decrypt: async () => new ArrayBuffer(16),
            importKey: async () => ({} as CryptoKey),
            deriveKey: async () => ({} as CryptoKey),
            deriveBits: async () => new ArrayBuffer(32),
        },
    },
});


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
    // eslint-disable-next-line no-var
    var vi: typeof import('vitest')['vi'];
}

export { };
