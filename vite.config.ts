import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ローカル環境専用のVite設定
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true,
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
    // ローカル環境用のビルド設定
    sourcemap: true, // デバッグ用にソースマップを有効
    outDir: 'dist',
    assetsDir: 'assets',
    // ローカル環境では最適化を控えめに
    minify: false,
    rollupOptions: {
      output: {
        // シンプルな出力設定
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
