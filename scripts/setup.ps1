$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $taskRandom = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskRandom)
  $taskSecret = [Convert]::ToBase64String($taskRandom)
  $taskDbRandom = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskDbRandom)
  $taskDbPassword = -join ($taskDbRandom | ForEach-Object { $_.ToString('x2') })
  if (!(Test-Path -LiteralPath '.env')) {
    $taskRootEnv = (Get-Content -LiteralPath '.env.example' -Raw).Replace('change_this_local_database_password', $taskDbPassword).Replace('replace_with_random_secret_at_least_32_characters', $taskSecret)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $taskRootEnv)
  } else {
    Write-Host 'Existing .env preserved.'
    $taskRootLines = Get-Content -LiteralPath '.env'
    $taskDbPassword = ($taskRootLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''
    $taskSecret = ($taskRootLines | Where-Object { $_ -match '^JWT_SECRET=' }) -replace '^JWT_SECRET=', ''
  }
  if (!(Test-Path -LiteralPath 'backend/.env')) {
    $taskApiEnv = (Get-Content -LiteralPath 'backend/.env.example' -Raw).Replace('postgres:password@', "postgres:$taskDbPassword@").Replace('replace_with_random_secret_at_least_32_characters', $taskSecret)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'backend/.env'), $taskApiEnv)
  } else { Write-Host 'Existing backend/.env preserved.' }
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  npm run db:generate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma generate failed.' }
  Write-Host 'Setup ready. Run: docker compose up -d --build'
} finally { Pop-Location }
