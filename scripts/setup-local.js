#!/usr/bin/env node

/**
 * ローカル環境セットアップスクリプト
 * AI Story Builder をローカルLLM環境で動作させるための設定を行います
 */

const fs = require('fs');
const path = require('path');

console.log('🏠 AI Story Builder ローカル環境セットアップを開始します...\n');

// 環境変数ファイルのパス
const envExamplePath = path.join(process.cwd(), 'env.local.example');
const envLocalPath = path.join(process.cwd(), '.env.local');

// .env.local ファイルが存在しない場合は作成
if (!fs.existsSync(envLocalPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📄 .env.local ファイルを作成中...');
    fs.copyFileSync(envExamplePath, envLocalPath);
    console.log('✅ .env.local ファイルが作成されました');
  } else {
    console.log('⚠️  env.local.example ファイルが見つかりません');
    console.log('   手動で .env.local ファイルを作成してください');
  }
} else {
  console.log('✅ .env.local ファイルは既に存在します');
}

// ローカルLLM設定の確認
console.log('\n🔍 ローカルLLM設定を確認中...');

const envContent = fs.readFileSync(envLocalPath, 'utf8');
const localEndpointMatch = envContent.match(/VITE_LOCAL_LLM_ENDPOINT=(.+)/);

if (localEndpointMatch) {
  const endpoint = localEndpointMatch[1].trim();
  console.log(`📍 ローカルLLMエンドポイント: ${endpoint}`);
  
  if (endpoint.includes('localhost:1234')) {
    console.log('💡 LM Studio 用の設定が検出されました');
    console.log('   LM Studio を起動してAPIサーバーを開始してください');
  } else if (endpoint.includes('localhost:11434')) {
    console.log('💡 Ollama 用の設定が検出されました');
    console.log('   Ollama を起動してモデルをロードしてください');
  } else {
    console.log('💡 カスタムローカルLLM設定が検出されました');
    console.log(`   エンドポイント: ${endpoint}`);
  }
} else {
  console.log('⚠️  VITE_LOCAL_LLM_ENDPOINT が設定されていません');
  console.log('   .env.local ファイルでローカルLLMエンドポイントを設定してください');
}

// 推奨設定の表示
console.log('\n📋 推奨設定:');
console.log('1. ローカルLLMサーバーを起動してください');
console.log('2. 以下のコマンドでアプリケーションを起動してください:');
console.log('   npm run dev:local');
console.log('3. ブラウザで http://localhost:5173 にアクセスしてください');

// ローカルLLMサーバーの起動方法
console.log('\n🚀 ローカルLLMサーバーの起動方法:');

console.log('\n【LM Studio の場合】');
console.log('1. LM Studio をダウンロード・インストール');
console.log('2. モデルをダウンロード（例：Llama 3.1, CodeLlama等）');
console.log('3. モデルをロードしてAPIサーバーを開始');
console.log('4. デフォルトで http://localhost:1234 でAPIが利用可能');

console.log('\n【Ollama の場合】');
console.log('1. Ollama をインストール: https://ollama.ai/');
console.log('2. モデルをダウンロード: ollama pull llama3.1');
console.log('3. APIサーバーを起動: ollama serve');
console.log('4. デフォルトで http://localhost:11434 でAPIが利用可能');

console.log('\n【その他のローカルLLM】');
console.log('- vLLM, Text Generation WebUI, LocalAI等も対応');
console.log('- OpenAI互換のAPIエンドポイントを提供する必要があります');

console.log('\n✅ セットアップが完了しました！');
console.log('   詳細な手順は README.md の「ローカル環境での使用」セクションを参照してください');
