#!/usr/bin/env node

/**
 * Windows向けTauri開発環境のセットアップスクリプト
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Windows向けTauri開発環境のセットアップを開始します...\n');

// Rustのインストール確認とセットアップ
function setupRust() {
  console.log('🦀 Rustのセットアップを確認中...');
  
  try {
    execSync('rustc --version', { stdio: 'pipe' });
    console.log('✅ Rustは既にインストールされています');
  } catch (error) {
    console.log('📥 Rustをインストール中...');
    console.log('⚠️  手動で https://rustup.rs/ からRustをインストールしてください');
    console.log('   または以下のコマンドをPowerShellで実行してください:');
    console.log('   Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe');
    console.log('   .\\rustup-init.exe');
    console.log('');
  }

  try {
    execSync('cargo --version', { stdio: 'pipe' });
    console.log('✅ Cargoは利用可能です');
  } catch (error) {
    console.log('❌ Cargoが利用できません。Rustのインストールを完了してください');
    return false;
  }

  return true;
}

// Windows Build Toolsの確認
function checkWindowsBuildTools() {
  console.log('🔨 Windows Build Toolsを確認中...');
  
  try {
    // Visual Studio Build ToolsまたはMSVCの確認
    execSync('cl', { stdio: 'pipe' });
    console.log('✅ Visual Studio Build Toolsがインストールされています');
    return true;
  } catch (error) {
    console.log('⚠️  Visual Studio Build Toolsが見つかりません');
    console.log('📥 以下のいずれかをインストールしてください:');
    console.log('   1. Visual Studio Community (推奨)');
    console.log('   2. Visual Studio Build Tools');
    console.log('   3. Windows SDK');
    console.log('');
    console.log('🔗 ダウンロードリンク:');
    console.log('   https://visualstudio.microsoft.com/ja/vs/community/');
    console.log('');
    return false;
  }
}

// Node.jsとnpmの確認
function checkNodeEnvironment() {
  console.log('📦 Node.js環境を確認中...');
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js: ${nodeVersion}`);
  } catch (error) {
    console.error('❌ Node.jsがインストールされていません');
    return false;
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ npm: ${npmVersion}`);
  } catch (error) {
    console.error('❌ npmがインストールされていません');
    return false;
  }

  return true;
}

// 依存関係のインストール
function installDependencies() {
  console.log('📦 依存関係をインストール中...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ npm依存関係のインストールが完了しました');
  } catch (error) {
    console.error('❌ npm依存関係のインストールに失敗しました');
    return false;
  }

  return true;
}

// Tauri CLIのインストール確認
function checkTauriCLI() {
  console.log('🦀 Tauri CLIを確認中...');
  
  try {
    execSync('npx tauri --version', { stdio: 'pipe' });
    console.log('✅ Tauri CLIは利用可能です');
    return true;
  } catch (error) {
    console.log('📥 Tauri CLIをインストール中...');
    try {
      execSync('npm install --save-dev @tauri-apps/cli', { stdio: 'inherit' });
      console.log('✅ Tauri CLIのインストールが完了しました');
      return true;
    } catch (installError) {
      console.error('❌ Tauri CLIのインストールに失敗しました');
      return false;
    }
  }
}

// 開発用スクリプトの作成
function createDevelopmentScripts() {
  console.log('📝 開発用スクリプトを作成中...');
  
  const scripts = {
    'dev:tauri': 'tauri dev',
    'build:tauri': 'tauri build',
    'clean:tauri': 'rm -rf src-tauri/target'
  };

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // スクリプトが存在しない場合は追加
    let updated = false;
    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptCommand;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ 開発用スクリプトを追加しました');
    } else {
      console.log('✅ 開発用スクリプトは既に存在しています');
    }
  } catch (error) {
    console.error('❌ package.jsonの更新に失敗しました:', error.message);
    return false;
  }

  return true;
}

// アイコンファイルの準備
function prepareIcons() {
  console.log('🎨 アイコンファイルを準備中...');
  
  const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
  
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log('📁 アイコンディレクトリを作成しました');
  }

  // 基本的なアイコンファイルのプレースホルダーを作成
  const iconSizes = ['32x32', '128x128', '128x128@2x'];
  const iconFormats = ['.png', '.ico', '.icns'];
  
  console.log('⚠️  アイコンファイルを手動で追加してください:');
  console.log('   以下のファイルを src-tauri/icons/ に配置してください:');
  iconSizes.forEach(size => {
    iconFormats.forEach(format => {
      if (format === '.png' || size === '128x128') {
        console.log(`   - ${size}${format}`);
      }
    });
  });
  console.log('   - icon.icns (macOS用)');
  console.log('   - icon.ico (Windows用)');
  console.log('');

  return true;
}

// メイン実行
async function main() {
  console.log('🚀 Windows向けTauri開発環境のセットアップを開始します...\n');
  
  const steps = [
    { name: 'Node.js環境', fn: checkNodeEnvironment },
    { name: 'Rust環境', fn: setupRust },
    { name: 'Windows Build Tools', fn: checkWindowsBuildTools },
    { name: '依存関係', fn: installDependencies },
    { name: 'Tauri CLI', fn: checkTauriCLI },
    { name: '開発スクリプト', fn: createDevelopmentScripts },
    { name: 'アイコンファイル', fn: prepareIcons },
  ];

  let allStepsPassed = true;

  for (const step of steps) {
    console.log(`\n📋 ${step.name}のセットアップ中...`);
    const success = step.fn();
    if (!success) {
      console.log(`❌ ${step.name}のセットアップに失敗しました`);
      allStepsPassed = false;
    } else {
      console.log(`✅ ${step.name}のセットアップが完了しました`);
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allStepsPassed) {
    console.log('🎉 セットアップが完了しました！');
    console.log('\n📖 次のステップ:');
    console.log('   1. アイコンファイルを src-tauri/icons/ に配置してください');
    console.log('   2. npm run dev:tauri で開発サーバーを起動してください');
    console.log('   3. npm run build:tauri でアプリケーションをビルドしてください');
  } else {
    console.log('⚠️  一部のセットアップに失敗しました');
    console.log('   上記のエラーメッセージを確認し、必要なツールをインストールしてください');
  }
  
  console.log('\n🔗 参考リンク:');
  console.log('   - Tauri公式ドキュメント: https://tauri.app/');
  console.log('   - Rust公式サイト: https://www.rust-lang.org/');
  console.log('   - Visual Studio: https://visualstudio.microsoft.com/');
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ セットアップ中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { main };

