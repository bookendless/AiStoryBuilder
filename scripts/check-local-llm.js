#!/usr/bin/env node

/**
 * ローカルLLM接続チェックスクリプト
 * ローカルLLMサーバーが正常に動作しているかを確認します
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ローカルLLM接続をチェック中...\n');

// .env.local ファイルの読み込み
const envLocalPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envLocalPath)) {
  console.log('❌ .env.local ファイルが見つかりません');
  console.log('   npm run setup:local を実行してセットアップしてください');
  process.exit(1);
}

const envContent = fs.readFileSync(envLocalPath, 'utf8');
const localEndpointMatch = envContent.match(/VITE_LOCAL_LLM_ENDPOINT=(.+)/);

if (!localEndpointMatch) {
  console.log('❌ VITE_LOCAL_LLM_ENDPOINT が設定されていません');
  console.log('   .env.local ファイルでローカルLLMエンドポイントを設定してください');
  process.exit(1);
}

const endpoint = localEndpointMatch[1].trim();
console.log(`📍 チェック対象エンドポイント: ${endpoint}`);

// ローカルLLMサーバーへの接続テスト
async function checkLocalLLM() {
  try {
    console.log('🔄 ローカルLLMサーバーに接続中...');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'こんにちは。テストメッセージです。',
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ ローカルLLMサーバーに正常に接続できました');
      console.log('📊 応答データ:', JSON.stringify(data, null, 2));
      
      // 応答の形式をチェック
      if (data.choices && data.choices[0] && data.choices[0].message) {
        console.log('✅ OpenAI互換形式の応答を確認しました');
        console.log('💬 テスト応答:', data.choices[0].message.content);
      } else if (data.content) {
        console.log('✅ 直接応答形式を確認しました');
        console.log('💬 テスト応答:', data.content);
      } else {
        console.log('⚠️  予期しない応答形式です');
        console.log('   応答データ:', JSON.stringify(data, null, 2));
      }
      
      console.log('\n🎉 ローカルLLM環境の準備が完了しました！');
      console.log('   npm run dev:local でアプリケーションを起動できます');
      
    } else {
      console.log(`❌ ローカルLLMサーバーへの接続に失敗しました (HTTP ${response.status})`);
      const errorText = await response.text();
      console.log('エラー詳細:', errorText);
      
      console.log('\n🔧 トラブルシューティング:');
      console.log('1. ローカルLLMサーバーが起動しているか確認してください');
      console.log('2. エンドポイントURLが正しいか確認してください');
      console.log('3. ファイアウォールやセキュリティソフトがブロックしていないか確認してください');
    }
    
  } catch (error) {
    console.log('❌ ローカルLLMサーバーへの接続中にエラーが発生しました');
    console.log('エラー詳細:', error.message);
    
    console.log('\n🔧 トラブルシューティング:');
    console.log('1. ローカルLLMサーバーが起動しているか確認してください');
    console.log('2. エンドポイントURLが正しいか確認してください');
    console.log('3. ネットワーク接続を確認してください');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 接続が拒否されました。サーバーが起動していない可能性があります');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 ホスト名が解決できません。URLを確認してください');
    }
  }
}

// Node.js 18+ でfetchが利用可能かチェック
if (typeof fetch === 'undefined') {
  console.log('❌ Node.js 18以上が必要です');
  console.log('   現在のバージョン:', process.version);
  console.log('   Node.js をアップデートするか、node-fetch をインストールしてください');
  process.exit(1);
}

checkLocalLLM();
