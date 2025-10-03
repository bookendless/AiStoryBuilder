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
    strictPort: true,
    host: true,
    open: false, // Tauriでは自動で開かない
    cors: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // ローカルLLM用のプロキシ設定
    proxy: {
      '/api/local': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local/, '/v1/chat/completions'),
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
