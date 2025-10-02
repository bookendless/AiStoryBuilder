#!/usr/bin/env node

/**
 * Tauriプロキシ関数のテストスクリプト
 * ローカルLLM接続をTauriプロキシ経由でテストします
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Tauriプロキシ関数のテストを開始します...\n');

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
console.log(`📍 テスト対象エンドポイント: ${endpoint}`);

// テスト用のリクエストボディ
const testRequestBody = JSON.stringify({
  messages: [
    {
      role: 'system',
      content: '日本語の小説創作を支援するAIアシスタントです。自然で読みやすい日本語で回答してください。',
    },
    {
      role: 'user',
      content: 'こんにちは。Tauriプロキシのテストです。',
    },
  ],
  temperature: 0.7,
  max_tokens: 100,
});

const testHeaders = {
  'Content-Type': 'application/json',
};

console.log('📝 テストリクエスト:', {
  endpoint,
  bodyLength: testRequestBody.length,
  headers: testHeaders,
});

// 直接fetchでのテスト
async function testDirectFetch() {
  console.log('\n🔄 直接fetchでのテスト...');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: testHeaders,
      body: testRequestBody,
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 直接fetchテスト成功');
      console.log('📊 応答データ:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ 直接fetchテスト失敗 (HTTP ${response.status})`);
      const errorText = await response.text();
      console.log('エラー詳細:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ 直接fetchテストエラー:', error.message);
    return false;
  }
}

// Tauriプロキシ関数のシミュレーション
async function testTauriProxySimulation() {
  console.log('\n🔄 Tauriプロキシシミュレーションテスト...');
  
  try {
    // Tauriプロキシ関数の動作をシミュレート
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: testHeaders,
      body: testRequestBody,
    });

    if (response.ok) {
      const responseText = await response.text();
      console.log('✅ Tauriプロキシシミュレーション成功');
      console.log('📝 生レスポンス:', responseText.substring(0, 200) + '...');
      
      // JSON解析テスト
      try {
        const data = JSON.parse(responseText);
        console.log('✅ JSON解析成功');
        console.log('📊 解析済みデータ:', JSON.stringify(data, null, 2));
        
        // 応答形式の検証
        if (data.choices && data.choices[0] && data.choices[0].message) {
          console.log('✅ OpenAI互換形式の応答を確認');
          console.log('💬 テスト応答:', data.choices[0].message.content);
        } else if (data.content) {
          console.log('✅ 直接応答形式を確認');
          console.log('💬 テスト応答:', data.content);
        } else {
          console.log('⚠️  予期しない応答形式');
        }
        
        return true;
      } catch (parseError) {
        console.log('❌ JSON解析エラー:', parseError.message);
        return false;
      }
    } else {
      console.log(`❌ Tauriプロキシシミュレーション失敗 (HTTP ${response.status})`);
      const errorText = await response.text();
      console.log('エラー詳細:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Tauriプロキシシミュレーションエラー:', error.message);
    return false;
  }
}

// メイン実行
async function main() {
  const directFetchSuccess = await testDirectFetch();
  const proxySimulationSuccess = await testTauriProxySimulation();
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 テスト結果サマリー:');
  console.log(`   直接fetch: ${directFetchSuccess ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`   プロキシシミュレーション: ${proxySimulationSuccess ? '✅ 成功' : '❌ 失敗'}`);
  
  if (directFetchSuccess && proxySimulationSuccess) {
    console.log('\n🎉 すべてのテストが成功しました！');
    console.log('   Tauriプロキシ関数は正常に動作するはずです');
  } else if (directFetchSuccess && !proxySimulationSuccess) {
    console.log('\n⚠️  直接fetchは成功するが、プロキシシミュレーションが失敗');
    console.log('   Tauriプロキシ関数の実装に問題がある可能性があります');
  } else if (!directFetchSuccess) {
    console.log('\n❌ 直接fetchが失敗');
    console.log('   ローカルLLMサーバーの接続に問題があります');
  }
  
  console.log('\n🔧 トラブルシューティング:');
  console.log('1. ローカルLLMサーバーが起動しているか確認してください');
  console.log('2. エンドポイントURLが正しいか確認してください');
  console.log('3. ファイアウォールやセキュリティソフトがブロックしていないか確認してください');
  console.log('4. Tauriアプリケーション内でコンソールログを確認してください');
}

// Node.js 18+ でfetchが利用可能かチェック
if (typeof fetch === 'undefined') {
  console.log('❌ Node.js 18以上が必要です');
  console.log('   現在のバージョン:', process.version);
  process.exit(1);
}

main().catch(error => {
  console.error('❌ テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});

