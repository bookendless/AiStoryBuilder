#!/usr/bin/env node

/**
 * リポジトリ最適化スクリプト
 * ユーザーに不要なファイルを削除してリポジトリサイズを最小化
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 リポジトリ最適化を開始します...\n');

// 削除対象のファイル・ディレクトリ
const filesToRemove = [
  // ビルド成果物
  'dist',
  'build',
  'out',
  
  // 依存関係
  'node_modules',
  
  // キャッシュ
  '.cache',
  '.parcel-cache',
  '.npm',
  '.yarn',
  '.pnpm-store',
  
  // テスト関連
  'coverage',
  '.nyc_output',
  'test-results',
  'playwright-report',
  
  // ログファイル
  'logs',
  '*.log',
  
  // 一時ファイル
  '.temp',
  'tmp',
  
  // バックアップファイル
  '*.bak',
  '*.backup',
  '*.old',
  
  // システムファイル
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  
  // エディタ設定
  '.vscode/settings.json',
  '.vscode/launch.json',
  '.vscode/extensions.json',
  '.idea',
  
  // 環境変数ファイル
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
];

// ファイル・ディレクトリを削除
function removeFiles() {
  console.log('🗑️  不要なファイルを削除中...');
  
  filesToRemove.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    
    if (fs.existsSync(filePath)) {
      try {
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`✅ ディレクトリを削除: ${file}`);
        } else {
          fs.unlinkSync(filePath);
          console.log(`✅ ファイルを削除: ${file}`);
        }
      } catch (error) {
        console.log(`⚠️  削除に失敗: ${file} - ${error.message}`);
      }
    }
  });
}

// Git履歴の最適化
function optimizeGitHistory() {
  // filter-branch による履歴書き換えと reflog 破棄は取り消せない。
  // 誤実行でローカルの復旧手段まで消えるため、明示的な --yes がない限り実行しない。
  if (!process.argv.includes('--yes')) {
    console.log('\n⏭️  Git履歴の最適化をスキップしました（取り消し不可の操作のため）。');
    console.log('   この処理は git filter-branch で全履歴を書き換え、reflog も破棄します。');
    console.log('   実行前にリポジトリのバックアップを取り、以下のように明示的に指定してください:');
    console.log('   npm run optimize-repo -- --yes\n');
    return;
  }

  console.log('\n📦 Git履歴を最適化中...');

  try {
    // 不要なファイルをGit履歴から完全に削除
    execSync('git filter-branch --force --index-filter "git rm --cached --ignore-unmatch -r node_modules dist build coverage .cache .parcel-cache" --prune-empty --tag-name-filter cat -- --all', { stdio: 'inherit' });
    
    // リポジトリを圧縮
    execSync('git reflog expire --expire=now --all', { stdio: 'inherit' });
    execSync('git gc --prune=now --aggressive', { stdio: 'inherit' });
    
    console.log('✅ Git履歴の最適化が完了しました');
  } catch (error) {
    console.log('⚠️  Git履歴の最適化に失敗しました:', error.message);
  }
}

// リポジトリサイズの確認
function checkRepositorySize() {
  console.log('\n📊 リポジトリサイズを確認中...');
  
  try {
    const size = execSync('du -sh .git', { encoding: 'utf8' }).trim();
    console.log(`📁 .git ディレクトリサイズ: ${size}`);
    
    const fileCount = execSync('find . -type f | wc -l', { encoding: 'utf8' }).trim();
    console.log(`📄 ファイル数: ${fileCount}`);
    
  } catch (error) {
    console.log('⚠️  サイズ確認に失敗しました:', error.message);
  }
}

// メイン実行
function main() {
  try {
    removeFiles();
    checkRepositorySize();
    
    console.log('\n🎉 リポジトリ最適化が完了しました！');
    console.log('\n次のステップ:');
    console.log('1. git add . で変更をステージング');
    console.log('2. git commit -m "Optimize repository for users" でコミット');
    console.log('3. git push --force-with-lease でプッシュ（注意：強制プッシュ）');
    console.log('\n⚠️  注意: この操作はGit履歴を変更するため、他の開発者と共有する前に実行してください');
    
  } catch (error) {
    console.error('❌ 最適化中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
