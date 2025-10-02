#!/usr/bin/env node

/**
 * ローカルLLMサーバーの起動状況を確認するスクリプト
 */

const http = require('http');
const https = require('https');

// テストするエンドポイント
const endpoints = [
  { url: 'http://localhost:1234/v1/chat/completions', name: 'LM Studio (Port 1234)' },
  { url: 'http://localhost:11434/v1/chat/completions', name: 'Ollama (Port 11434)' },
  { url: 'http://localhost:8080/v1/chat/completions', name: 'Custom LLM (Port 8080)' },
  { url: 'http://localhost:3000/v1/chat/completions', name: 'Custom LLM (Port 3000)' },
];

// HTTPリクエストを送信する関数
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: timeout,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          success: true,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
      });
    });

    // テスト用のリクエストボディを送信
    const testBody = JSON.stringify({
      messages: [{ role: 'user', content: 'Test connection' }],
      temperature: 0.7,
      max_tokens: 10,
    });

    req.write(testBody);
    req.end();
  });
}

// メイン関数
async function checkLocalLLM() {
  console.log('🔍 ローカルLLMサーバーの起動状況を確認中...\n');

  let foundAny = false;

  for (const endpoint of endpoints) {
    console.log(`📍 テスト中: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    const result = await makeRequest(endpoint.url);
    
    if (result.success) {
      if (result.status === 200) {
        console.log(`✅ 接続成功 (${result.status})`);
        foundAny = true;
      } else if (result.status === 404) {
        console.log(`⚠️  サーバーは起動しているが、エンドポイントが見つからない (${result.status})`);
        console.log(`   正しいパスを確認してください: /v1/chat/completions`);
      } else {
        console.log(`⚠️  サーバーは起動しているが、エラー応答 (${result.status})`);
      }
    } else {
      console.log(`❌ 接続失敗: ${result.error}`);
    }
    
    console.log(''); // 空行
  }

  console.log('📋 確認結果:');
  if (foundAny) {
    console.log('✅ 利用可能なローカルLLMサーバーが見つかりました');
    console.log('💡 AI Story BuilderでローカルLLMを使用できます');
  } else {
    console.log('❌ 利用可能なローカルLLMサーバーが見つかりませんでした');
    console.log('');
    console.log('🔧 解決方法:');
    console.log('1. LM Studio を起動してください');
    console.log('   - ダウンロード: https://lmstudio.ai/');
    console.log('   - モデルを読み込んで、ローカルサーバーを開始してください');
    console.log('');
    console.log('2. または Ollama を使用してください');
    console.log('   - インストール: https://ollama.ai/');
    console.log('   - モデルをダウンロード: ollama pull llama2');
    console.log('   - サーバーを開始: ollama serve');
    console.log('');
    console.log('3. その他のローカルLLMサーバーを使用している場合');
    console.log('   - ポート番号とエンドポイントを確認してください');
    console.log('   - 通常は /v1/chat/completions パスを使用します');
  }

  console.log('');
  console.log('🔄 このスクリプトを再実行して状況を確認できます');
}

// スクリプト実行
if (require.main === module) {
  checkLocalLLM().catch(console.error);
}

module.exports = { checkLocalLLM, makeRequest };