# AI Story Builder インストール支援スクリプト
# ウイルス検出を回避するための設定を行います

Write-Host "AI Story Builder インストール支援スクリプト" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# 管理者権限チェック
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "このスクリプトは管理者権限で実行する必要があります。" -ForegroundColor Red
    Write-Host "PowerShellを管理者として実行してから、再度このスクリプトを実行してください。" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Enterキーを押して終了"
    exit 1
}

Write-Host "1. Windows Defenderの除外設定を確認しています..." -ForegroundColor Cyan

# Windows Defenderの除外設定を確認
$exclusions = Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
$currentDir = Get-Location
$installerPath = Join-Path $currentDir "src-tauri\target\release\bundle\nsis\AI Story Builder_1.0.0_x64-setup.exe"

Write-Host "現在のディレクトリ: $currentDir" -ForegroundColor Gray
Write-Host "インストーラーパス: $installerPath" -ForegroundColor Gray

# 除外設定を追加
try {
    Write-Host "2. 一時的な除外設定を追加しています..." -ForegroundColor Cyan
    
    # インストーラーファイルの除外を追加
    Add-MpPreference -ExclusionPath $installerPath -ErrorAction SilentlyContinue
    Write-Host "✓ インストーラーファイルを除外に追加しました" -ForegroundColor Green
    
    # ダウンロードフォルダの除外を追加
    $downloadsPath = [Environment]::GetFolderPath("UserProfile") + "\Downloads"
    Add-MpPreference -ExclusionPath $downloadsPath -ErrorAction SilentlyContinue
    Write-Host "✓ ダウンロードフォルダを除外に追加しました" -ForegroundColor Green
    
    # 一時フォルダの除外を追加
    $tempPath = $env:TEMP
    Add-MpPreference -ExclusionPath $tempPath -ErrorAction SilentlyContinue
    Write-Host "✓ 一時フォルダを除外に追加しました" -ForegroundColor Green
    
} catch {
    Write-Host "除外設定の追加でエラーが発生しました: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. インストーラーの実行準備が完了しました" -ForegroundColor Green
Write-Host ""
Write-Host "次の手順でインストールを実行してください:" -ForegroundColor Yellow
Write-Host "1. インストーラーファイルを右クリック" -ForegroundColor White
Write-Host "2. '管理者として実行'を選択" -ForegroundColor White
Write-Host "3. インストールウィザードに従って進める" -ForegroundColor White
Write-Host ""
Write-Host "インストール完了後、以下のコマンドで除外設定を削除できます:" -ForegroundColor Cyan
Write-Host "Remove-MpPreference -ExclusionPath '$installerPath'" -ForegroundColor Gray
Write-Host "Remove-MpPreference -ExclusionPath '$downloadsPath'" -ForegroundColor Gray
Write-Host "Remove-MpPreference -ExclusionPath '$tempPath'" -ForegroundColor Gray
Write-Host ""

Read-Host "Enterキーを押して終了"


