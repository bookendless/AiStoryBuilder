#!/bin/bash

# AI Story Builder デプロイメントスクリプト

set -e

echo "🚀 AI Story Builder デプロイメントを開始します..."

# 環境変数の確認
if [ -z "$DEPLOY_TARGET" ]; then
    echo "❌ DEPLOY_TARGET が設定されていません"
    echo "使用可能なオプション: vercel, netlify, github"
    exit 1
fi

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm ci

# 型チェック
echo "🔍 型チェックを実行中..."
npm run type-check

# リント
echo "🔧 リントを実行中..."
npm run lint

# ビルド
echo "🏗️  アプリケーションをビルド中..."
npm run build

# デプロイターゲットに応じた処理
case $DEPLOY_TARGET in
    "vercel")
        echo "🚀 Vercelにデプロイ中..."
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo "❌ Vercel CLIがインストールされていません"
            echo "npm install -g vercel を実行してください"
            exit 1
        fi
        ;;
    "netlify")
        echo "🚀 Netlifyにデプロイ中..."
        if command -v netlify &> /dev/null; then
            netlify deploy --prod --dir=dist
        else
            echo "❌ Netlify CLIがインストールされていません"
            echo "npm install -g netlify-cli を実行してください"
            exit 1
        fi
        ;;
    "github")
        echo "🚀 GitHub Pagesにデプロイ中..."
        echo "GitHub Actionsを使用してデプロイします"
        echo "mainブランチにプッシュしてください"
        ;;
    *)
        echo "❌ 不明なデプロイターゲット: $DEPLOY_TARGET"
        exit 1
        ;;
esac

echo "✅ デプロイメントが完了しました！"
