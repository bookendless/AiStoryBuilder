import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';

// Tauri 2.0ではViteの設定を調整する必要があります
export default defineConfig({
  plugins: [react()],

  // Tauri用の設定
  clearScreen: false,
  optimizeDeps: {
    include: ['react', 'react-dom', 'dexie', 'axios', 'lucide-react']
  },
  server: {
    port: 5173,
    strictPort: true, // ポートが使用中の場合はエラーにする（Android開発での整合性確保）
    host: '0.0.0.0', // すべてのネットワークインターフェースでリッスン
    open: false, // Tauriでは自動で開かない
    cors: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // HMR設定（Android開発用）
    hmr: process.env.TAURI_DEV_HOST
      ? {
          protocol: 'ws',
          host: process.env.TAURI_DEV_HOST,
          port: 5173,
        }
      : undefined,
    // ローカルLLM & クラウドAI用のプロキシ設定（開発環境のCORS回避）
    proxy: {
      // ローカルLLM（LM Studio）
      '/api/local': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local/, '/v1/chat/completions'),
      },
      // ローカルLLM（Ollama）
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '/v1/chat/completions'),
      },
      // クラウドAPI（OpenAI）
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      } as ProxyOptions,
      // クラウドAPI（Claude/Anthropic）
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      } as ProxyOptions,
      // クラウドAPI（Gemini）
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      } as ProxyOptions,
      // クラウドAPI（xAI Grok）
      '/api/xai': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/xai/, ''),
      } as ProxyOptions,
    },
  },
  build: {
    // 本番環境用の最適化設定
    sourcemap: false, // 本番ではソースマップを無効化
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser', // より強力な圧縮
    terserOptions: {
      compress: {
        drop_console: true, // console.logを削除
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    rollupOptions: {
      output: {
        // チャンク分割による最適化
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          ai: ['openai', '@google/generative-ai'],
          storage: ['dexie']
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // バンドルサイズの警告閾値を設定
    chunkSizeWarningLimit: 1000,
  },
});
