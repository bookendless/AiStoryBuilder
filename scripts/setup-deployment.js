#!/usr/bin/env node

/**
 * デプロイメント設定ヘルパースクリプト
 * 各プラットフォームのデプロイメント設定を自動化します
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deploymentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployment-config.json'), 'utf8'));

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function checkEnvironment() {
  const requiredFiles = [
    'package.json',
    'vite.config.ts',
    'vercel.json',
    'netlify.toml',
    '.github/workflows/deploy.yml'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    log(`❌ 必要なファイルが見つかりません: ${missingFiles.join(', ')}`, 'error');
    process.exit(1);
  }
  
  log('✅ 必要なファイルがすべて存在します', 'success');
}

function validateEnvironmentVariables(env) {
  const config = deploymentConfig[env];
  if (!config) {
    log(`❌ 無効な環境: ${env}`, 'error');
    process.exit(1);
  }
  
  log(`🔍 ${env}環境の設定を検証中...`, 'info');
  
  const requiredSecrets = config.requiredSecrets || [];
  const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);
  
  if (missingSecrets.length > 0) {
    log(`⚠️  以下の環境変数が設定されていません: ${missingSecrets.join(', ')}`, 'warning');
    log('   本番環境ではこれらの変数を設定してください', 'warning');
  } else {
    log('✅ 必要な環境変数がすべて設定されています', 'success');
  }
}

function generateDeploymentInstructions(platform, env) {
  const config = deploymentConfig[env];
  const instructions = {
    vercel: {
      title: 'Vercel デプロイメント手順',
      steps: [
        '1. Vercel CLIをインストール: npm install -g vercel',
        '2. Vercelにログイン: vercel login',
        '3. プロジェクトをデプロイ: vercel --prod',
        '4. 環境変数を設定: Vercelダッシュボード > Settings > Environment Variables',
        `5. 必要な環境変数: ${config.requiredSecrets.join(', ')}`
      ]
    },
    netlify: {
      title: 'Netlify デプロイメント手順',
      steps: [
        '1. Netlify CLIをインストール: npm install -g netlify-cli',
        '2. Netlifyにログイン: netlify login',
        '3. プロジェクトをデプロイ: netlify deploy --prod --dir=dist',
        '4. 環境変数を設定: Netlifyダッシュボード > Site settings > Environment variables',
        `5. 必要な環境変数: ${config.requiredSecrets.join(', ')}`
      ]
    },
    github: {
      title: 'GitHub Pages デプロイメント手順',
      steps: [
        '1. リポジトリのSettings > Pagesに移動',
        '2. Sourceを「GitHub Actions」に設定',
        '3. 環境変数を設定: Settings > Secrets and variables > Actions',
        `4. 必要なシークレット: ${config.requiredSecrets.join(', ')}`,
        '5. mainブランチにプッシュして自動デプロイ'
      ]
    }
  };
  
  const instruction = instructions[platform];
  if (!instruction) {
    log(`❌ サポートされていないプラットフォーム: ${platform}`, 'error');
    return;
  }
  
  log(`\n📋 ${instruction.title}`, 'info');
  instruction.steps.forEach(step => {
    log(`   ${step}`, 'info');
  });
}

function checkBuild() {
  log('🔨 ビルドテストを実行中...', 'info');
  
  try {
    execSync('npm run type-check', { stdio: 'pipe' });
    log('✅ 型チェックが成功しました', 'success');
  } catch (error) {
    log('❌ 型チェックが失敗しました', 'error');
    process.exit(1);
  }
  
  try {
    execSync('npm run lint', { stdio: 'pipe' });
    log('✅ リントが成功しました', 'success');
  } catch (error) {
    log('⚠️  リントエラーがありますが、続行します', 'warning');
  }
  
  try {
    execSync('npm run build', { stdio: 'pipe' });
    log('✅ ビルドが成功しました', 'success');
  } catch (error) {
    log('❌ ビルドが失敗しました', 'error');
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const platform = args[0] || 'vercel';
  const env = args[1] || 'production';
  
  log('🚀 AI Story Builder デプロイメント設定ヘルパー', 'info');
  log(`   プラットフォーム: ${platform}`, 'info');
  log(`   環境: ${env}`, 'info');
  log('', 'info');
  
  checkEnvironment();
  validateEnvironmentVariables(env);
  checkBuild();
  generateDeploymentInstructions(platform, env);
  
  log('\n🎉 デプロイメント準備が完了しました！', 'success');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  checkEnvironment,
  validateEnvironmentVariables,
  generateDeploymentInstructions,
  checkBuild
};
