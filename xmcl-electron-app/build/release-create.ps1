param([string]$Token)

$ErrorActionPreference = 'Stop'
$notes = Get-Content ".\docs\release-notes-0.0.2-beta.1.md" -Raw -Encoding UTF8
$exe = Resolve-Path ".\xmcl-electron-app\build\output\DiscoLauncher-Setup-0.0.2-beta.1.exe"
$shaFile = Resolve-Path ".\xmcl-electron-app\build\output\DiscoLauncher-Setup-0.0.2-beta.1.exe.sha256"

$sha256 = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
Write-Output "sha256=$sha256"

$body = @{
  tag_name = "v0.0.2-beta.1"
  name = "Disco Launcher 0.0.2-beta.1"
  body = $notes
  draft = $false
  prerelease = $true
  target_commitish = "master"
} | ConvertTo-Json -Depth 10 -Compress

$headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-Github-Api-Version" = "2022-11-28"
  "User-Agent" = "Disco-Launcher-Release"
}

Write-Output "Creating release..."
$rel = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/Discoheadmc/Disco-Launcher/releases" `
  -Headers $headers -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 120

Write-Output "ID=$($rel.id)"
Write-Output "URL=$($rel.html_url)"
Write-Output "UPLOAD=$($rel.upload_url)"
