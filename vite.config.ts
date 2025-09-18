import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    // CORS設定を追加
    cors: true,
    // ローカルモード用の設定
    ...(mode === 'local' && {
      // ローカルLLM用のプロキシ設定
      proxy: {
        '/api/local': {
          target: 'http://localhost:1234',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/local/, '/v1/chat/completions'),
        },
      },
    }),
  },
  build: {
    // 本番環境ではソースマップを無効化
    sourcemap: mode === 'development',
    // チャンクサイズの警告を調整
    chunkSizeWarningLimit: 1000,
    // アセットの最適化
    assetsInlineLimit: 4096,
    // ロールアップの最適化
    rollupOptions: {
      output: {
        // チャンクの分割戦略
        manualChunks: {
          // React関連を分離
          'react-vendor': ['react', 'react-dom'],
          // AI関連ライブラリを分離
          'ai-vendor': ['openai', '@google/generative-ai'],
          // UI関連ライブラリを分離
          'ui-vendor': ['@tiptap/react', '@tiptap/starter-kit', 'lucide-react'],
          // その他のライブラリ
          'utils-vendor': ['dexie', 'axios']
        },
        // アセットファイル名の最適化
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) {
            return `assets/[name]-[hash][extname]`;
          }
          if (/\.(css)$/.test(assetInfo.name)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // JSファイル名の最適化
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // 本番環境での最適化
    minify: 'esbuild',
  },
  // 開発時の設定
  define: {
    // 開発環境ではReact DevToolsの警告を抑制しない
    ...(mode === 'production' && {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: 'undefined',
    }),
  },
  // パフォーマンス最適化
  esbuild: {
    // 本番環境でconsole.logを削除
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
