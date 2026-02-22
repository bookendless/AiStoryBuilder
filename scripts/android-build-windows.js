#!/usr/bin/env node
/**
 * Windows でシンボリックリンクが使えない環境向けの Android APK ビルド。
 * 1. フロントエンドをビルド
 * 2. 各 Android ターゲットで Rust をビルド
 * 3. Gradle で .so をコピーして APK を組み立て（-Ptauri.android.copyLibs）
 *
 * 使い方: npm run tauri:build:android:windows
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcTauri = path.join(rootDir, 'src-tauri');
const genAndroid = path.join(srcTauri, 'gen', 'android');

const TARGETS = [
  'aarch64-linux-android',
  'armv7-linux-androideabi',
  'i686-linux-android',
  'x86_64-linux-android',
];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const cwd = opts.cwd || rootDir;
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

async function main() {
  console.log('1/3 Building frontend...');
  await run('npm', ['run', 'build']);

  console.log('2/3 Building Rust for Android targets...');
  for (const target of TARGETS) {
    console.log(`  Building ${target}...`);
    await run('cargo', ['build', '--release', '--target', target], { cwd: srcTauri });
  }

  if (!fs.existsSync(path.join(genAndroid, 'gradlew.bat'))) {
    console.error('gen/android が見つかりません。先に npm run tauri:android:init を実行してください。');
    process.exit(1);
  }

  console.log('3/3 Building APK with Gradle (copy libs)...');
  await run(path.join(genAndroid, 'gradlew.bat'), [
    'assembleUniversalRelease',
    '-Ptauri.android.copyLibs=true',
  ], { cwd: genAndroid });

  const apkPath = path.join(genAndroid, 'app', 'build', 'outputs', 'apk', 'universal', 'release', 'app-universal-release.apk');
  console.log('\nビルド完了。APK:', apkPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
