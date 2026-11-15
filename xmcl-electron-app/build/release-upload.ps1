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
} | ConvertTo-Json -Depth 10

$headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-Github-Api-Version" = "2022-11-28"
  "User-Agent" = "Disco-Launcher-Release"
}

Write-Output "Creating release..."
$rel = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/Discoheadmc/Disco-Launcher/releases" `
  -Headers $headers -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 300

Write-Output "REL_ID=$($rel.id)"
Write-Output "REL_URL=$($rel.html_url)"
Write-Output "UPLOAD_URL=$($rel.upload_url)"

$exeName = "DiscoLauncher-Setup-0.0.2-beta.1.exe"
$shaName = "DiscoLauncher-Setup-0.0.2-beta.1.exe.sha256"
$exeUploadUrl = ($rel.upload_url -replace '\{\?name,label\}', "?name=$exeName&label=Setup%20EXE")
$shaUploadUrl = ($rel.upload_url -replace '\{\?name,label\}', "?name=$shaName&label=SHA256")

Write-Output "EXE_UPLOAD_URL=$exeUploadUrl"
Write-Output "SHA_UPLOAD_URL=$shaUploadUrl"

# Use curl.exe for large file upload (more reliable than Invoke-RestMethod for 94MB)
Write-Output "Uploading EXE (94MB) via curl.exe..."
& curl.exe -L -X POST -H "Authorization: Bearer $Token" -H "Content-Type: application/octet-stream" -H "User-Agent: Disco-Launcher-Release" --data-binary "@$ExePath" $exeUploadUrl
Write-Output "EXE upload done exit=$LASTEXITCODE"

Write-Output "Uploading SHA256..."
& curl.exe -L -X POST -H "Authorization: Bearer $Token" -H "Content-Type: application/octet-stream" -H "User-Agent: Disco-Launcher-Release" --data-binary "@$ShaFile" $shaUploadUrl
Write-Output "SHA upload done exit=$LASTEXITCODE"

Write-Output "DONE"