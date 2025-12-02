import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri 2.0ではViteの設定を調整する必要があります
export default defineConfig({
  plugins: [react()],
  
  // Tauri用の設定
  clearScreen: false,
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['react', 'react-dom', 'dexie', 'axios']
  },
  server: {
    port: 5173,
    strictPort: false, // ポートが使用中の場合は別のポートを自動選択
    host: true,
    open: false, // Tauriでは自動で開かない
    cors: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
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
      },
      // クラウドAPI（Claude/Anthropic）
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
      // クラウドAPI（Gemini）
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      },
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
