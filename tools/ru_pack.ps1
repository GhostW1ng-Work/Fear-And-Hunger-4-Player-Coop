<#
  The Russian translations of the games for the release archives: dot-source this and call
  Add-RussianTranslations <langFolder> <docsFolder>. Each one is unpacked from its archive in the
  repository root (not in git) into its own folder of <langFolder> (www\lang of the game); the mod's
  main.js uses the one made for the game it runs in. A missing archive is just left out.
#>
$RussianTranslations = @(
    @{
        Zip = 'TerminaRus.zip'; Folder = 'ru-termina'
        # (all of it but its changelog page - to the docs - and its window icon)
        Take = { param($n) -not $n.StartsWith('icon/') }
        Doc = @{ '.html' = 'Termina - Russian translation - changes.html' }
        About = @'
Russian translation of Fear & Hunger 2: Termina - by savannstm
https://github.com/savannstm/fh2-termina-translation
VK: https://vk.com/stivhuis228   Telegram: https://t.me/Arsen1337Curduke
License: WTFPL (as in that repository) - included in the co-op mod with credit to the author.
'@
    },
    @{
        Zip = 'FearHunger_khoohatt.zip'; Folder = 'ru-fh1'
        # (its texts and pictures and the code files it changed - the rest of its js is the game's own)
        Take = { param($n) $n -match '^(data|img)/' -or $n -in @('js/plugins.js', 'js/rpg_windows.js', 'js/plugins/YEP_BattleEngineCore.js', 'js/plugins/YEP_ItemSynthesis.js') }
        Doc = @{ 'README.txt' = 'Fear & Hunger 1 - Russian translation - README.txt' }
        About = @'
Russian translation of Fear & Hunger (1) - by khoohatt (version 1.0, made for the game 1.4.1)
'@
    }
)

function Add-RussianTranslations([string]$lang, [string]$docs) {
    $root = Split-Path $PSScriptRoot -Parent
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    foreach ($t in $RussianTranslations) {
        $zipPath = Join-Path $root $t.Zip
        if (-not (Test-Path $zipPath)) {
            Write-Warning "$($t.Zip) not found: the archive goes without that translation"
            continue
        }
        $dest = Join-Path $lang $t.Folder
        $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
        try {
            foreach ($e in $zip.Entries) {
                $name = $e.FullName.Replace('\', '/')
                if ($name.EndsWith('/') -or $name -match '(^|/)\.DS_Store$') { continue }
                $doc = $t.Doc.Keys | Where-Object { $name -eq $_ -or ($_.StartsWith('.') -and $name.EndsWith($_)) } | Select-Object -First 1
                if ($doc) {
                    $target = Join-Path $docs $t.Doc[$doc]
                } elseif (& $t.Take $name) {
                    $target = Join-Path $dest $name.Replace('/', '\')
                } else {
                    continue
                }
                New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
            }
        } finally {
            $zip.Dispose()
        }
        $about = $t.About + @'

The co-op mod uses it when its Language is Russian: Options > Co-op settings > Language
(the game restarts). The game's own files are not changed - English is one switch away.

Кооператив включает этот перевод, если язык мода - русский: Options > Co-op settings >
Language (на русском: Опции > Кооп > Настройки кооператива > Язык; игра перезапустится). Файлы самой игры не меняются - английский остаётся.
'@
        [IO.File]::WriteAllText((Join-Path $dest 'ABOUT.txt'), $about, (New-Object Text.UTF8Encoding $false))
        Write-Host "Russian translation added: $dest"
    }
}
