<#
  Builds the release ZIP: dist\Termina-Local-Coop-v<version>.zip
  Usage: powershell -ExecutionPolicy Bypass -File tools\make_release.ps1
  The ZIP has what players need (plugins, extras, installer, README, LICENSE, CHANGELOG, docs: NETPLAY + TEST_CHECKLIST);
  tests, tools and docs stay in the repository.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$version = [regex]::Match([IO.File]::ReadAllText((Join-Path $root 'plugins\LookOutsideOnline.js')), "COOP_VERSION = '([^']+)'").Groups[1].Value
if (-not $version) { throw 'COOP_VERSION not found in plugins\LookOutsideOnline.js' }

$name = "Termina-Local-Coop-v$version"
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist $name
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $stage 'plugins'), (Join-Path $stage 'extras') | Out-Null

Copy-Item (Join-Path $root 'plugins\*.js') (Join-Path $stage 'plugins')
Copy-Item (Join-Path $root 'extras\*') (Join-Path $stage 'extras')
foreach ($f in @('install.bat', 'install.ps1', 'README.md', 'README.ru.md', 'LICENSE', 'CHANGELOG.md')) {
    Copy-Item (Join-Path $root $f) $stage
}
New-Item -ItemType Directory -Force (Join-Path $stage 'docs') | Out-Null
foreach ($f in @('NETPLAY.md', 'NETPLAY.ru.md', 'TEST_CHECKLIST.md', 'DOOR_LINES.md', 'ENDING_FOURTH_FESTIVAL.md')) {
    Copy-Item (Join-Path $root ('docs\' + $f)) (Join-Path $stage 'docs')
}

$zip = Join-Path $dist "$name.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path $stage -DestinationPath $zip
Remove-Item $stage -Recurse -Force
Write-Host "Release: $zip"
