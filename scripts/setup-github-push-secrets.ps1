# HAN OPS — GitHub Actions Secret 일괄 등록
# 사전: gh auth login (한 번만)
# 사용: .\scripts\setup-github-push-secrets.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repoRoot ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local 을 찾을 수 없습니다: $envFile"
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "먼저 로그인하세요: gh auth login" -ForegroundColor Yellow
    exit 1
}

function Get-EnvValue([string]$key) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if ($line) { return ($line -split "=", 2)[1].Trim() }
    return ""
}

function Set-GhSecret([string]$name, [string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "  SKIP $name (값 없음)" -ForegroundColor DarkYellow
        return
    }
    $value | gh secret set $name --repo geniusKing0214/Han_OPS
    Write-Host "  OK   $name" -ForegroundColor Green
}

Write-Host "`n=== GitHub Secrets 등록 (geniusKing0214/Han_OPS) ===`n" -ForegroundColor Cyan

$vapid = Get-EnvValue "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
$pushSecret = Get-EnvValue "NEXT_PUBLIC_PUSH_API_SECRET"
$relayUrl = Get-EnvValue "NEXT_PUBLIC_PUSH_RELAY_URL"

Set-GhSecret "NEXT_PUBLIC_FIREBASE_VAPID_KEY" $vapid
Set-GhSecret "PUSH_API_SECRET" $pushSecret
Set-GhSecret "NEXT_PUBLIC_PUSH_API_SECRET" $pushSecret
Set-GhSecret "NEXT_PUBLIC_PUSH_RELAY_URL" $relayUrl

# Cloudflare — 프롬프트
$cfToken = Read-Host "CLOUDFLARE_API_TOKEN (3단계 토큰, 없으면 Enter로 건너뜀)"
if ($cfToken) { Set-GhSecret "CLOUDFLARE_API_TOKEN" $cfToken }

$cfAccount = Read-Host "CLOUDFLARE_ACCOUNT_ID (대시보드 Account ID, 없으면 Enter)"
if ($cfAccount) { Set-GhSecret "CLOUDFLARE_ACCOUNT_ID" $cfAccount }

# Firebase 서비스 계정 JSON
$jsonPath = Read-Host "Firebase 서비스 계정 JSON 파일 경로 (예: C:\Users\New\Downloads\han-ops-xxxxx.json, 없으면 Enter)"
if ($jsonPath -and (Test-Path $jsonPath)) {
    $json = Get-Content $jsonPath -Raw -Encoding UTF8
    Set-GhSecret "FIREBASE_SERVICE_ACCOUNT" $json
} elseif ($jsonPath) {
    Write-Host "  SKIP FIREBASE_SERVICE_ACCOUNT (파일 없음)" -ForegroundColor DarkYellow
}

Write-Host "`n완료. GitHub → Actions → Deploy Push Relay 실행하세요.`n" -ForegroundColor Cyan
