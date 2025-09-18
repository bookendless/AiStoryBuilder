#!/usr/bin/env node

/**
 * クイックスタートスクリプト
 * 一般ユーザー向けの簡単なセットアップを提供
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 AI Story Builder クイックスタートを開始します...\n');

// 環境チェック
function checkEnvironment() {
  console.log('🔍 環境をチェック中...');
  
  // Node.js バージョンチェック
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.log('❌ Node.js 18以上が必要です');
    console.log(`   現在のバージョン: ${nodeVersion}`);
    console.log('   https://nodejs.org/ から最新版をダウンロードしてください');
    process.exit(1);
  }
  
  console.log(`✅ Node.js ${nodeVersion} を確認`);
  
  // npm バージョンチェック
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ npm ${npmVersion} を確認`);
  } catch (error) {
    console.log('❌ npm が見つかりません');
    process.exit(1);
  }
}

// 依存関係のインストール
function installDependencies() {
  console.log('\n📦 依存関係をインストール中...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ 依存関係のインストールが完了しました');
  } catch (error) {
    console.log('❌ 依存関係のインストールに失敗しました');
    console.log('   手動で npm install を実行してください');
    process.exit(1);
  }
}

// 環境設定ファイルの作成
function setupEnvironment() {
  console.log('\n⚙️  環境設定を作成中...');
  
  const envExamplePath = path.join(process.cwd(), 'env.local.example');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  if (fs.existsSync(envLocalPath)) {
    console.log('✅ .env.local ファイルは既に存在します');
    return;
  }
  
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    console.log('✅ .env.local ファイルを作成しました');
  } else {
    // 基本的な環境設定を作成
    const basicEnv = `# AI Story Builder 環境設定
VITE_APP_NAME=AI Story Builder
VITE_APP_VERSION=1.0.0
VITE_DEBUG_MODE=true
VITE_LOCAL_LLM_ENDPOINT=http://localhost:1234/v1/chat/completions
`;
    fs.writeFileSync(envLocalPath, basicEnv);
    console.log('✅ 基本的な .env.local ファイルを作成しました');
  }
}

// ローカルLLMの推奨設定を表示
function showLocalLLMInstructions() {
  console.log('\n🤖 ローカルLLMの設定について');
  console.log('');
  console.log('AI Story Builder を使用するには、ローカルLLMサーバーが必要です。');
  console.log('');
  console.log('【推奨】LM Studio を使用する場合:');
  console.log('1. https://lmstudio.ai/ からダウンロード');
  console.log('2. モデルをダウンロード（Llama 3.1 8B推奨）');
  console.log('3. 「Local Server」タブで「Start Server」をクリック');
  console.log('');
  console.log('【代替】Ollama を使用する場合:');
  console.log('1. https://ollama.ai/ からダウンロード');
  console.log('2. ollama pull llama3.1:8b でモデルをダウンロード');
  console.log('3. ollama serve でサーバーを起動');
  console.log('');
  console.log('ローカルLLMサーバーが起動したら、以下のコマンドでアプリケーションを起動できます:');
  console.log('');
  console.log('  npm run dev:local');
  console.log('');
  console.log('ブラウザで http://localhost:5173 にアクセスしてください');
}

// メイン実行
function main() {
  try {
    checkEnvironment();
    installDependencies();
    setupEnvironment();
    showLocalLLMInstructions();
    
    console.log('\n🎉 セットアップが完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. ローカルLLMサーバーを起動してください');
    console.log('2. npm run dev:local でアプリケーションを起動してください');
    console.log('3. ブラウザで http://localhost:5173 にアクセスしてください');
    console.log('');
    console.log('詳細な手順は README.md を参照してください');
    
  } catch (error) {
    console.error('❌ セットアップ中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
