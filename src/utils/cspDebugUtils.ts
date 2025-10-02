// CSP設定の確認とデバッグ用スクリプト
console.log('🔍 CSP設定の確認を開始します...');

// 現在のCSP設定を確認
const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
console.log('📋 CSPメタタグ:', metaTags.length);

metaTags.forEach((tag, index) => {
  console.log(`CSP ${index + 1}:`, tag.getAttribute('content'));
});

// Tauri環境の詳細確認
if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  console.log('✅ Tauri環境が検出されました');
  console.log('Tauri詳細:', {
    version: (window as any).__TAURI__.version,
    os: (window as any).__TAURI__.os,
    arch: (window as any).__TAURI__.arch,
    platform: (window as any).__TAURI__.platform
  });
} else {
  console.log('❌ Tauri環境が検出されませんでした');
  console.log('Window object:', typeof window);
  console.log('Tauri object:', typeof window !== 'undefined' ? (window as any).__TAURI__ : 'N/A');
}

// ローカルLLM接続テスト（CSPエラーを確認）
async function testCSPConnection() {
  console.log('🧪 CSP接続テストを開始します...');
  
  try {
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'CSPテスト' }],
        temperature: 0.7,
        max_tokens: 10,
      }),
    });
    
    console.log('✅ CSP接続テスト成功:', response.status);
  } catch (error) {
    console.log('❌ CSP接続テスト失敗:', error.message);
    
    if (error.message.includes('Content Security Policy')) {
      console.log('🔧 CSPエラーが検出されました');
      console.log('解決策:');
      console.log('1. Tauri設定でCSPを修正');
      console.log('2. dangerousDisableAssetCspModificationをtrueに設定');
      console.log('3. Tauriプロキシ関数を使用');
    }
  }
}

// テスト実行
testCSPConnection();

// グローバルに公開
if (typeof window !== 'undefined') {
  (window as unknown as { testCSPConnection: typeof testCSPConnection }).testCSPConnection = testCSPConnection;
  console.log('🔧 CSPテスト関数が追加されました: window.testCSPConnection()');
}
