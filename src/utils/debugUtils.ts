// ローカルLLM接続テスト用のユーティリティ関数
export const testLocalLLMConnection = async () => {
  console.log('🧪 ローカルLLM接続テストを開始します...');
  
  try {
    const testRequest = {
      prompt: 'こんにちは。接続テストです。',
      settings: {
        provider: 'local' as const,
        model: 'local-model',
        temperature: 0.7,
        maxTokens: 100,
        localEndpoint: 'http://localhost:1234/v1/chat/completions'
      }
    };

    console.log('📤 テストリクエスト送信中...', testRequest);
    
    const response = await aiService.generateContent(testRequest);
    
    console.log('📥 テストレスポンス受信:', response);
    
    if (response.error) {
      console.error('❌ ローカルLLM接続エラー:', response.error);
      return { success: false, error: response.error };
    } else {
      console.log('✅ ローカルLLM接続成功:', response.content);
      return { success: true, content: response.content };
    }
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開（デバッグ用）
if (typeof window !== 'undefined') {
  (window as unknown as { testLocalLLMConnection: typeof testLocalLLMConnection }).testLocalLLMConnection = testLocalLLMConnection;
  console.log('🔧 デバッグ用関数が追加されました: window.testLocalLLMConnection()');
}
