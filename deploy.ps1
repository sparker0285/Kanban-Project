# deploy.ps1 — Build frontend and zip-deploy to Azure App Service
# Usage: .\deploy.ps1 -AppName <your-app-service-name> -ResourceGroup <your-rg-name>

param(
  [Parameter(Mandatory=$true)][string]$AppName,
  [Parameter(Mandatory=$true)][string]$ResourceGroup
)

$ErrorActionPreference = 'Stop'

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location frontend
npm run build
Set-Location ..

Write-Host "Copying build output to backend/public..." -ForegroundColor Cyan
if (Test-Path backend\public) { Remove-Item -Recurse -Force backend\public }
Copy-Item -Recurse frontend\dist backend\public

Write-Host "Creating deployment zip..." -ForegroundColor Cyan
$zipPath = "$PSScriptRoot\kanban-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path backend\* -DestinationPath $zipPath

Write-Host "Deploying to App Service '$AppName'..." -ForegroundColor Cyan
az webapp deployment source config-zip `
  --resource-group $ResourceGroup `
  --name $AppName `
  --src $zipPath

Write-Host "Done! App deployed to https://$AppName.azurewebsites.net" -ForegroundColor Green
