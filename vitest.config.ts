/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [react()],
    test: {
        // テスト環境
        environment: 'jsdom',

        // グローバル設定
        globals: true,

        // セットアップファイル
        setupFiles: ['./src/tests/setup.ts'],

        // テストファイルのパターン
        include: ['src/**/*.{test,spec}.{ts,tsx}'],

        // 除外パターン
        exclude: ['node_modules', 'dist', 'src-tauri'],

        // カバレッジ設定
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.test.{ts,tsx}',
                'src/**/*.spec.{ts,tsx}',
                'src/tests/**',
                'src/types/**',
                'src/vite-env.d.ts',
            ],
        },

        // タイムアウト設定
        testTimeout: 10000,
        hookTimeout: 10000,

        // レポーター設定
        reporters: ['verbose'],

        // モック設定
        mockReset: true,
        restoreMocks: true,
    },

    // パス解決設定
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
