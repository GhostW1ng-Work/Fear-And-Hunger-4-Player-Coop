<#
  Builds the archive for Nexus Mods: dist\Termina-Local-Coop-v<version>-nexus.zip
  Usage: powershell -ExecutionPolicy Bypass -File tools\make_nexus.ps1
  No installer scripts (.bat / .ps1): only the plugins, laid out like the game folder (www\js\plugins),
  a main.js that adds them (plugins.js untouched), the co-op view page, the docs and INSTALL.txt.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$version = [regex]::Match([IO.File]::ReadAllText((Join-Path $root 'plugins\LookOutsideOnline.js')), "COOP_VERSION = '([^']+)'").Groups[1].Value
if (-not $version) { throw 'COOP_VERSION not found in plugins\LookOutsideOnline.js' }

$name = "Termina-Local-Coop-v$version-nexus"
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist $name
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
$plugins = Join-Path $stage 'www\js\plugins'
New-Item -ItemType Directory -Force $plugins, (Join-Path $stage 'docs') | Out-Null

foreach ($f in @('LookOutsideOnline.js', 'LocalCoop_FearHunger.js', 'LocalCoop_Net.js')) {
    Copy-Item (Join-Path $root ('plugins\' + $f)) $plugins
}
Copy-Item (Join-Path $root 'extras\coop_view.html') (Join-Path $stage 'www')
# (the game's main.js + the co-op plugins: unpacking is the whole install, plugins.js untouched)
Copy-Item (Join-Path $root 'extras\main.js') (Join-Path $stage 'www\js')
Copy-Item (Join-Path $root 'docs\INSTALL_MANUAL.txt') (Join-Path $stage 'INSTALL.txt')
foreach ($f in @('README.md', 'README.ru.md', 'LICENSE', 'CHANGELOG.md')) {
    Copy-Item (Join-Path $root $f) $stage
}
foreach ($f in @('NETPLAY.md', 'NETPLAY.ru.md', 'DOOR_LINES.md', 'ENDING_FOURTH_FESTIVAL.md', 'FREE_CONTESTANTS.md', 'FREE_CONTESTANTS.en.md', 'PERKELE_TOGETHER.md', 'PERKELE_TOGETHER.en.md')) {
    Copy-Item (Join-Path $root ('docs\' + $f)) (Join-Path $stage 'docs')
}

$zip = Join-Path $dist "$name.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
# (the files at the top of the archive, not inside a folder: Nexus / mod managers expect that;
# paths with "/" - Compress-Archive of Windows PowerShell writes "\", which some tools read badly)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
try {
    Get-ChildItem $stage -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, 'Optimal') | Out-Null
    }
} finally {
    $archive.Dispose()
}
Remove-Item $stage -Recurse -Force
Write-Host "Nexus: $zip"
