import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// グローバルエラーハンドラー: ブラウザ拡張機能のエラーを無視
window.addEventListener('error', (event) => {
  // Extension context invalidated エラーは無視（ブラウザ拡張機能のリロード時に発生）
  const message = event.message || '';
  const filename = event.filename || '';
  const errorString = event.error?.toString() || '';
  
  if (
    message.includes('Extension context invalidated') ||
    message.includes('content.js') ||
    filename.includes('content.js') ||
    filename.includes('extension') ||
    filename.includes('chrome-extension://') ||
    filename.includes('moz-extension://') ||
    errorString.includes('Extension context invalidated')
  ) {
    event.preventDefault();
    event.stopPropagation();
    // コンソールに表示しない（完全に無視）
    return false;
  }
});

// 未処理のPromise拒否をハンドル
window.addEventListener('unhandledrejection', (event) => {
  // Extension context invalidated エラーは無視
  const reason = event.reason || {};
  const reasonString = String(reason);
  const reasonMessage = reason?.message || '';
  
  if (
    reasonMessage.includes('Extension context invalidated') ||
    reasonMessage.includes('content.js') ||
    reasonString.includes('Extension context invalidated') ||
    reasonString.includes('content.js')
  ) {
    event.preventDefault();
    // コンソールに表示しない（完全に無視）
    return false;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
