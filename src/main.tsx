import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// グローバルエラーハンドラー: ブラウザ拡張機能のエラーを無視
window.addEventListener('error', (event) => {
  // Extension context invalidated エラーは無視（ブラウザ拡張機能のリロード時に発生）
  if (
    event.message?.includes('Extension context invalidated') ||
    event.message?.includes('content.js') ||
    event.filename?.includes('content.js') ||
    event.filename?.includes('extension')
  ) {
    event.preventDefault();
    console.warn('ブラウザ拡張機能のエラーを無視しました:', event.message);
    return false;
  }
});

// 未処理のPromise拒否をハンドル
window.addEventListener('unhandledrejection', (event) => {
  // Extension context invalidated エラーは無視
  if (
    event.reason?.message?.includes('Extension context invalidated') ||
    event.reason?.message?.includes('content.js') ||
    String(event.reason).includes('Extension context invalidated')
  ) {
    event.preventDefault();
    console.warn('ブラウザ拡張機能のPromise拒否を無視しました:', event.reason);
    return false;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
