#!/usr/bin/env node

/**
 * Windows向けTauriアプリケーションのビルドスクリプト
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Windows向けAI Story Builderのビルドを開始します...\n');

// 必要なツールの確認
function checkRequirements() {
  console.log('📋 必要なツールを確認中...');
  
  try {
    // Rustの確認
    execSync('rustc --version', { stdio: 'pipe' });
    console.log('✅ Rust: インストール済み');
  } catch (error) {
    console.error('❌ Rustがインストールされていません');
    console.error('https://rustup.rs/ からRustをインストールしてください');
    process.exit(1);
  }

  try {
    // Cargoの確認
    execSync('cargo --version', { stdio: 'pipe' });
    console.log('✅ Cargo: インストール済み');
  } catch (error) {
    console.error('❌ Cargoがインストールされていません');
    process.exit(1);
  }

  try {
    // Tauri CLIの確認
    execSync('npx tauri --version', { stdio: 'pipe' });
    console.log('✅ Tauri CLI: インストール済み');
  } catch (error) {
    console.error('❌ Tauri CLIがインストールされていません');
    console.error('npm install --save-dev @tauri-apps/cli を実行してください');
    process.exit(1);
  }

  console.log('✅ すべての要件が満たされています\n');
}

// フロントエンドのビルド
function buildFrontend() {
  console.log('🏗️  フロントエンドをビルド中...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ フロントエンドのビルドが完了しました\n');
  } catch (error) {
    console.error('❌ フロントエンドのビルドに失敗しました');
    process.exit(1);
  }
}

// Tauriアプリケーションのビルド
function buildTauriApp() {
  console.log('🦀 Tauriアプリケーションをビルド中...');
  
  try {
    // Windows向けの最適化オプション
    const buildCommand = process.env.TAURI_DEBUG === 'true' 
      ? 'npm run dev:tauri' 
      : 'npm run build:tauri';
    
    execSync(buildCommand, { stdio: 'inherit' });
    console.log('✅ Tauriアプリケーションのビルドが完了しました\n');
  } catch (error) {
    console.error('❌ Tauriアプリケーションのビルドに失敗しました');
    process.exit(1);
  }
}

// ビルド成果物の確認
function checkBuildOutput() {
  console.log('📦 ビルド成果物を確認中...');
  
  const outputPath = path.join(__dirname, '..', 'src-tauri', 'target', 'release');
  
  if (fs.existsSync(outputPath)) {
    console.log('✅ ビルド成果物が見つかりました');
    
    // 実行ファイルの確認
    const exeFiles = fs.readdirSync(outputPath).filter(file => file.endsWith('.exe'));
    if (exeFiles.length > 0) {
      console.log(`📁 実行ファイル: ${exeFiles.join(', ')}`);
    }
    
    // インストーラーの確認
    const installerPath = path.join(outputPath, 'bundle', 'nsis');
    if (fs.existsSync(installerPath)) {
      const installers = fs.readdirSync(installerPath).filter(file => file.endsWith('.exe'));
      if (installers.length > 0) {
        console.log(`📦 インストーラー: ${installers.join(', ')}`);
      }
    }
  } else {
    console.log('⚠️  ビルド成果物が見つかりません');
  }
  
  console.log('');
}

// メイン実行
async function main() {
  try {
    checkRequirements();
    buildFrontend();
    buildTauriApp();
    checkBuildOutput();
    
    console.log('🎉 Windows向けAI Story Builderのビルドが完了しました！');
    console.log('📁 実行ファイルは src-tauri/target/release/ にあります');
    console.log('📦 インストーラーは src-tauri/target/release/bundle/nsis/ にあります');
    
  } catch (error) {
    console.error('❌ ビルドプロセス中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, checkRequirements, buildFrontend, buildTauriApp };

