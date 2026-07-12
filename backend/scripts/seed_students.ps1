param(
  [string]$ApiBaseUrl = "https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app"
)

$seedUrl = "$ApiBaseUrl/api/SeedExampleData"

try {
  $response = Invoke-RestMethod -Method Post -Uri $seedUrl -Headers @{ "X-User-Role" = "Admin" }
  Write-Host "Seed ejecutado correctamente."
  $response | ConvertTo-Json -Depth 5
}
catch {
  Write-Host "Error al ejecutar seed: $($_.Exception.Message)"
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
