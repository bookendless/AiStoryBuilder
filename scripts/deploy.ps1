# AI Story Builder デプロイメントスクリプト (PowerShell)

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("vercel", "netlify", "github")]
    [string]$DeployTarget
)

Write-Host "🚀 AI Story Builder デプロイメントを開始します..." -ForegroundColor Green

# 依存関係のインストール
Write-Host "📦 依存関係をインストール中..." -ForegroundColor Yellow
npm ci

# 型チェック
Write-Host "🔍 型チェックを実行中..." -ForegroundColor Yellow
npm run type-check

# リント
Write-Host "🔧 リントを実行中..." -ForegroundColor Yellow
npm run lint

# ビルド
Write-Host "🏗️  アプリケーションをビルド中..." -ForegroundColor Yellow
npm run build

# デプロイターゲットに応じた処理
switch ($DeployTarget) {
    "vercel" {
        Write-Host "🚀 Vercelにデプロイ中..." -ForegroundColor Green
        if (Get-Command vercel -ErrorAction SilentlyContinue) {
            vercel --prod
        } else {
            Write-Host "❌ Vercel CLIがインストールされていません" -ForegroundColor Red
            Write-Host "npm install -g vercel を実行してください" -ForegroundColor Red
            exit 1
        }
    }
    "netlify" {
        Write-Host "🚀 Netlifyにデプロイ中..." -ForegroundColor Green
        if (Get-Command netlify -ErrorAction SilentlyContinue) {
            netlify deploy --prod --dir=dist
        } else {
            Write-Host "❌ Netlify CLIがインストールされていません" -ForegroundColor Red
            Write-Host "npm install -g netlify-cli を実行してください" -ForegroundColor Red
            exit 1
        }
    }
    "github" {
        Write-Host "🚀 GitHub Pagesにデプロイ中..." -ForegroundColor Green
        Write-Host "GitHub Actionsを使用してデプロイします" -ForegroundColor Yellow
        Write-Host "mainブランチにプッシュしてください" -ForegroundColor Yellow
    }
}

Write-Host "✅ デプロイメントが完了しました！" -ForegroundColor Green
