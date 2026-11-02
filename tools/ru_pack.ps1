<#
  The Russian translation of Termina (by savannstm) for the release archives: dot-source this and call
  Add-RussianTranslation <folder> <docsFolder>. It unpacks TerminaRus.zip (repository root, not in git)
  into <folder> (www\lang\ru of the game), without its changelog page (that goes to <docsFolder>) and
  its window icon, and adds a note with the authors. Without TerminaRus.zip nothing is added.
#>
function Add-RussianTranslation([string]$dest, [string]$docs) {
    $root = Split-Path $PSScriptRoot -Parent
    $zipPath = Join-Path $root 'TerminaRus.zip'
    if (-not (Test-Path $zipPath)) {
        Write-Warning 'TerminaRus.zip not found: the archive goes without the Russian translation'
        return
    }
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        foreach ($e in $zip.Entries) {
            $name = $e.FullName.Replace('\', '/')
            if ($name.EndsWith('/') -or $name.StartsWith('icon/')) { continue }
            if ($name.EndsWith('.html')) {
                $target = Join-Path $docs 'TerminaRus - changes.html'
            } else {
                $target = Join-Path $dest $name.Replace('/', '\')
            }
            New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
        }
    } finally {
        $zip.Dispose()
    }
    $about = @'
Russian translation of Fear & Hunger 2: Termina - by savannstm
https://github.com/savannstm/fh2-termina-translation
VK: https://vk.com/stivhuis228   Telegram: https://t.me/Arsen1337Curduke

The co-op mod uses it when its Language is Russian: Options > Co-op settings > Language
(the game restarts). The game's own files are not changed - English is one switch away.

Русский перевод Fear & Hunger 2: Termina - автор savannstm (ссылки выше).
Кооператив включает его, если язык мода - русский: Опции > Co-op settings > Language
(игра перезапустится). Файлы самой игры не меняются - английский остаётся.
'@
    [IO.File]::WriteAllText((Join-Path $dest 'ABOUT.txt'), $about, (New-Object Text.UTF8Encoding $false))
    Write-Host "Russian translation added: $dest"
}
