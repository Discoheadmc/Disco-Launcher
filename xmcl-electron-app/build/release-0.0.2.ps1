$ErrorActionPreference = 'Stop'
$ExePath = ".\xmcl-electron-app\build\output\DiscoLauncher-Setup-0.0.2-beta.1.exe"
$ShaFile = ".\xmcl-electron-app\build\output\DiscoLauncher-Setup-0.0.2-beta.1.exe.sha256"

$exe = Resolve-Path $ExePath
$shaFile = Resolve-Path $ShaFile
Write-Output "exe: $exe"
Write-Output "sha: $shaFile"

$bytes = [System.IO.File]::ReadAllBytes($exe.Path)
$shaBytes = [System.IO.File]::ReadAllBytes($shaFile.Path)

Write-Output "exe size: $($bytes.Length) bytes"
Write-Output "sha size: $($shaBytes.Length) bytes"

# GitHub API via gh CLI
$ghExe = "$env:ProgramFiles\GitHub CLI\gh.exe"
if (Test-Path $ghExe) {
  Write-Output "gh CLI found"
  & $ghExe release create v0.0.2-beta.1 $exe.Path $shaFile.Path `
    --title "Disco Launcher 0.0.2-beta.1" `
    --notes "$(Get-Content docs\release-notes-0.0.2-beta.1.md -Raw)" `
    --prerelease 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Output 'release uploaded' ; exit 0 }
  Write-Error "gh release failed"
  exit 1
}
Write-Output "gh CLI not found, fallback to direct API..."

# Fallback: GitHub API (no release yet if tag exists)
$notes = Get-Content "docs\release-notes-0.0.2-beta.1.md" -Raw -Encoding UTF8
$body = @{
  tag_name = "v0.0.2-beta.1"
  name = "Disco Launcher 0.0.2-beta.1"
  body = $notes
  draft = $false
  prerelease = $true
  target_commitish = "master"
} | ConvertTo-Json -Depth 10

$resp = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/Discoheadmc/Disco-Launcher/releases" `
  -Headers @{ "User-Agent" = "Disco-Launcher-Release" } `
  -Body $body -ContentType "application/json" `
  -Authentication Bearer -Token $token

Write-Output "created: $($resp.html_url)"
