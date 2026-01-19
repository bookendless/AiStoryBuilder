#!/usr/bin/env node

/**
 * Androidキーストア作成スクリプト
 * 署名付きAPKを作成するためのキーストアファイルを生成します
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔐 Androidキーストア作成スクリプト\n');

// プロジェクトルートのパスを取得
const projectRoot = process.cwd();

// キーストアファイルのパス
const keystorePath = path.join(projectRoot, 'release.keystore');
const keystorePropertiesPath = path.join(projectRoot, 'src-tauri/gen/android/keystore.properties');

// キーストアが既に存在するか確認
if (fs.existsSync(keystorePath)) {
  console.log('⚠️  キーストアファイルは既に存在します:');
  console.log(`   ${keystorePath}\n`);
  console.log('既存のキーストアを使用する場合は、このスクリプトを終了してください。');
  console.log('新しいキーストアを作成する場合は、既存のファイルを削除してから再実行してください。\n');
  process.exit(1);
}

// keytoolコマンドが利用可能か確認
try {
  execSync('keytool -help', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ keytoolコマンドが見つかりません。');
  console.error('   Java JDKがインストールされ、PATHに追加されていることを確認してください。\n');
  process.exit(1);
}

console.log('📝 キーストア情報を入力してください:\n');

// 対話的な入力は難しいため、環境変数またはデフォルト値を使用
const keyAlias = process.env.KEYSTORE_ALIAS || 'aistorybuilder';
const keystorePassword = process.env.KEYSTORE_PASSWORD || '';
const validity = process.env.KEYSTORE_VALIDITY || '10000';

if (!keystorePassword) {
  console.log('⚠️  パスワードが設定されていません。');
  console.log('   環境変数 KEYSTORE_PASSWORD を設定するか、');
  console.log('   以下のコマンドを手動で実行してください:\n');
  console.log(`   keytool -genkey -v -keystore ${keystorePath} \\`);
  console.log(`     -alias ${keyAlias} \\`);
  console.log(`     -keyalg RSA -keysize 2048 -validity ${validity}\n`);
  console.log('   または、このスクリプトを実行する前に環境変数を設定してください:');
  console.log('   export KEYSTORE_PASSWORD="your-password"\n');
  process.exit(1);
}

console.log(`📦 キーストア情報:`);
console.log(`   - ファイル: ${keystorePath}`);
console.log(`   - エイリアス: ${keyAlias}`);
console.log(`   - 有効期限: ${validity}日\n`);

try {
  // keytoolコマンドを実行
  // 注意: 実際の実行では対話的な入力が必要なため、ここではコマンドを表示するだけ
  const command = `keytool -genkey -v -keystore "${keystorePath}" -alias ${keyAlias} -keyalg RSA -keysize 2048 -validity ${validity} -storepass ${keystorePassword} -keypass ${keystorePassword} -dname "CN=AI Story Builder, OU=Development, O=AI Story Builder Team, L=Unknown, ST=Unknown, C=JP"`;
  
  console.log('🔨 キーストアを作成中...\n');
  execSync(command, { stdio: 'inherit' });
  
  console.log('\n✅ キーストアファイルが作成されました！\n');
  
  // keystore.propertiesファイルを更新
  if (fs.existsSync(keystorePropertiesPath)) {
    const propertiesContent = `password=${keystorePassword}
keyAlias=${keyAlias}
storeFile=${keystorePath.replace(/\\/g, '/')}
`;
    
    fs.writeFileSync(keystorePropertiesPath, propertiesContent);
    console.log('✅ keystore.propertiesファイルを更新しました\n');
  } else {
    console.log('⚠️  keystore.propertiesファイルが見つかりません。');
    console.log(`   手動で ${keystorePropertiesPath} を作成してください。\n`);
  }
  
  console.log('📋 次のステップ:');
  console.log('   1. キーストアファイルとパスワードを安全に保管してください');
  console.log('   2. キーストアファイルは .gitignore に含まれています');
  console.log('   3. 以下のコマンドで署名付きAPKをビルドできます:');
  console.log('      npm run tauri:build:android:release\n');
  
} catch (error) {
  console.error('\n❌ キーストアの作成に失敗しました:');
  console.error(error.message);
  console.error('\n手動でキーストアを作成する場合は、以下のコマンドを実行してください:');
  console.log(`\n   keytool -genkey -v -keystore ${keystorePath} \\`);
  console.log(`     -alias ${keyAlias} \\`);
  console.log(`     -keyalg RSA -keysize 2048 -validity ${validity}\n`);
  process.exit(1);
}

