$ErrorActionPreference = 'Stop'
try {
	Write-Output 'START'
	$loginHeaders = @{ 'Content-Type' = 'application/json' }
	$loginBody = '{"rol":"Analista MINERD","correoInstitucional":"sergio@minerd.gob.do","password":"Minerd#2026"}'
	$login = Invoke-RestMethod -Uri 'https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app/api/Auth/login/analista' -Method Post -Headers $loginHeaders -Body $loginBody -TimeoutSec 30
	$token = $login.token
	$dataHeaders = @{ Authorization = "Bearer $token" }
	$data = Invoke-RestMethod -Uri 'https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app/api/AllExampleData' -Method Get -Headers $dataHeaders -TimeoutSec 30
	Write-Output "EXPEDIENTES=$($data.Count)"
	Write-Output 'END'
}
catch {
	Write-Output ('ERR=' + $_.Exception.Message)
}