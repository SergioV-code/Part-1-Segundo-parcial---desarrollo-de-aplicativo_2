$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$backendUrl = 'http://localhost:5123/health'
$frontendUrl = 'http://localhost:5173'

Write-Host '==> Verificando SQL Server Express local...' -ForegroundColor Cyan
$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
    throw 'sqlcmd no está disponible en PATH.'
}

$sqlCheck = & sqlcmd -S 'lpc:localhost\SQLEXPRESS' -E -Q "IF DB_ID('EdumetricsDR_Dev') IS NULL CREATE DATABASE [EdumetricsDR_Dev]; SELECT name FROM sys.databases WHERE name='EdumetricsDR_Dev';" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'No fue posible conectar con SQL Server Express local.'
}

Write-Host '==> Iniciando backend...' -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    param($backendDir)
    Set-Location $backendDir
    $env:ALLOW_INMEMORY_FALLBACK = 'false'
    dotnet run --launch-profile http
} -ArgumentList $backendDir

$backendReady = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $using:backendUrl -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $backendReady) {
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    throw 'El backend no quedó listo en http://localhost:5123.'
}

Write-Host '==> Iniciando frontend...' -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    param($frontendDir)
    Set-Location $frontendDir
    npm run dev -- --host 0.0.0.0 --port 5173
} -ArgumentList $frontendDir

$frontendReady = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $using:frontendUrl -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
            break
        }
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $frontendReady) {
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    throw 'El frontend no quedó listo en http://localhost:5173.'
}

Write-Host '==> Ejecutando smoke test de becas...' -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Method Post -Uri 'http://localhost:5123/api/Auth/login/estudiante' -ContentType 'application/json' -Body (@{ cedula = '001-0000001-1' } | ConvertTo-Json)
$token = $loginResponse.token
if (-not $token) {
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    throw 'No se obtuvo token de autenticación.'
}

$payload = @{ scholarshipName = 'Beca smoke test'; institutionName = 'MESCYT'; studentComment = 'smoke test' } | ConvertTo-Json
$createResponse = Invoke-RestMethod -Method Post -Uri 'http://localhost:5123/api/ScholarshipApplications' -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body $payload
if (-not $createResponse) {
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    throw 'El smoke test de becas falló.'
}

Write-Host ''
Write-Host '=== ARRANQUE LISTO ===' -ForegroundColor Green
Write-Host "Backend: $backendUrl" -ForegroundColor Green
Write-Host "Frontend: $frontendUrl" -ForegroundColor Green
Write-Host 'Use Stop-Job para detener los procesos o cierre la terminal.' -ForegroundColor Yellow
