import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
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
  },
  build: {
    sourcemap: true,
  },
  // 開発時の設定
  define: {
    // React DevToolsの競合を回避
    __REACT_DEVTOOLS_GLOBAL_HOOK__: 'undefined',
  },
});
