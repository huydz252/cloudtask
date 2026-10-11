$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (!(Test-Path -LiteralPath 'backend/.env')) { throw 'Run scripts/setup.ps1 first.' }
  $taskEnvLines = Get-Content -LiteralPath 'backend/.env'
  $taskDbUrl = ($taskEnvLines | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
  if (!$taskDbUrl) { throw 'DATABASE_URL missing.' }
  if ($taskDbUrl -notmatch '@(?:localhost|127\.0\.0\.1):5432/cloudtask_db\?') {
    throw 'This script only supports local cloudtask_db on port 5432. For a custom test server, explicitly set TEST_DATABASE_URL and run migrations/tests yourself.'
  }
  # A separate database, never the main project database. Records are preserved after tests.
  $env:TEST_DATABASE_URL = $taskDbUrl -replace '/cloudtask_db\?', '/cloudtask_test?'
  $env:DATABASE_URL = $env:TEST_DATABASE_URL
  Push-Location backend
  try {
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Test DB migration failed. Create cloudtask_test first; see README.' }
    npm run test:integration
    if ($LASTEXITCODE -ne 0) { throw 'Integration tests failed.' }
  } finally { Pop-Location }
} finally {
  $env:TEST_DATABASE_URL = $null
  $env:DATABASE_URL = $null
  Pop-Location
}
