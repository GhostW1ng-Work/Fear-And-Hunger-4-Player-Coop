<#
  Instalador de Local Co-op para RPG Maker MV/MZ.
  Uso:  .\install.ps1 -GamePath "D:\Juegos\Fear & Hunger 2"
        .\install.ps1            (sin -GamePath: si esta dentro de la carpeta del juego, ese juego; si no,
                                  busca los juegos en Steam, GOG y carpetas comunes y pregunta)
  Copia los plugins, registra los plugins en js\plugins.js (con copia de seguridad) y listo.
  -QuickSave instala tambien el plugin de pruebas F6/F7 (guardado rapido).
  El juego en red (experimental) se instala siempre: sin usarlo no hace nada, se abre en
   Opciones > Co-op > Network game... -NoNet no lo instala (y lo quita si estaba).
  -Net host | -Net join -NetHost 192.168.1.20  deja elegidos el modo y la IP en ese menu
   (www\coop_net.json; puerto: -NetPort, por defecto 47810).
#>
param(
    [string]$GamePath = '',
    [switch]$Uninstall,
    # auto = detecta por el titulo del juego. lookoutside = solo el plugin base. fearhunger = base + plugin de Fear & Hunger (luz de P2, disparo previo al combate).
    [ValidateSet('auto', 'lookoutside', 'fearhunger', 'generic')][string]$Profile = 'auto',
    # plugin de pruebas: F6 = guardado rapido, F7 = carga rapida
    [switch]$QuickSave,
    # juego en red: valores por defecto del menu (host = este PC es P1, join = se conecta a -NetHost)
    [ValidateSet('', 'host', 'join', 'menu')][string]$Net = '',
    [switch]$NoNet,
    [string]$NetHost = '127.0.0.1',
    [int]$NetPort = 47810
)

$ErrorActionPreference = 'Stop'

# ---- sin carpeta: buscar Fear & Hunger 1 / Termina (y Look Outside) en este PC ---------------
function Get-GameTitle([string]$dir) {
    foreach ($f in @("$dir\www\data\System.json", "$dir\data\System.json")) {
        if (Test-Path -LiteralPath $f) {
            try { return [regex]::Match([IO.File]::ReadAllText($f), '"gameTitle"\s*:\s*"([^"]*)"').Groups[1].Value } catch { return '' }
        }
    }
    return $null
}

function Find-Games {
    $roots = New-Object System.Collections.Generic.List[string]
    # Steam: la carpeta de Steam y todas sus bibliotecas (libraryfolders.vdf)
    $steam = @()
    foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam')) {
        try {
            $item = Get-ItemProperty -Path $key -ErrorAction Stop
            foreach ($v in @($item.SteamPath, $item.InstallPath)) { if ($v) { $steam += ($v -replace '/', '\') } }
        } catch { }
    }
    foreach ($st in ($steam | Select-Object -Unique)) {
        $roots.Add("$st\steamapps\common")
        $vdf = "$st\steamapps\libraryfolders.vdf"
        if (Test-Path -LiteralPath $vdf) {
            foreach ($m in [regex]::Matches([IO.File]::ReadAllText($vdf), '"path"\s+"([^"]+)"')) {
                $roots.Add((($m.Groups[1].Value -replace '\\\\', '\') + '\steamapps\common'))
            }
        }
    }
    # GOG
    foreach ($key in @('HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games', 'HKLM:\SOFTWARE\GOG.com\Games')) {
        try {
            Get-ChildItem -Path $key -ErrorAction Stop | ForEach-Object {
                $path = (Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue).path
                if ($path) { $roots.Add((Split-Path $path -Parent)) }
            }
        } catch { }
    }
    # carpetas comunes en cada disco
    foreach ($d in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | Where-Object { $_.Free -ne $null })) {
        $r = $d.Root.TrimEnd('\')
        foreach ($sub in @('Games', 'Игры', 'SteamLibrary\steamapps\common', 'Steam\steamapps\common', 'GOG Games', 'Program Files (x86)\Steam\steamapps\common', 'Program Files\Steam\steamapps\common', 'Program Files (x86)\GOG Galaxy\Games')) {
            $roots.Add("$r\$sub")
        }
    }
    $found = @()
    $seen = @{}
    foreach ($root in ($roots | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        foreach ($dir in (Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            $full = $dir.FullName
            if ($seen[$full.ToLower()]) { continue }
            $seen[$full.ToLower()] = $true
            $t = Get-GameTitle $full
            if ($t -and ($t -match 'fear\s*(&|and)\s*hunger|termina|look\s*outside')) {
                $js = @("$full\www\js\plugins.js", "$full\js\plugins.js") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
                $inst = ''
                if ($js) {
                    $pl = Join-Path (Split-Path $js -Parent) 'plugins\LookOutsideOnline.js'
                    if (Test-Path -LiteralPath $pl) {
                        $inst = [regex]::Match([IO.File]::ReadAllText($pl), "COOP_VERSION = '([^']+)'").Groups[1].Value
                    }
                }
                $found += [pscustomobject]@{ Path = $full; Title = $t; Installed = $inst }
            }
        }
    }
    return $found
}

# el mod se descomprimio dentro de la carpeta del juego (junto a Game.exe o en una subcarpeta):
# ese juego, sin buscar mas
function Find-HereGame {
    $dir = $PSScriptRoot
    for ($i = 0; $i -lt 4 -and $dir; $i++) {
        $t = Get-GameTitle $dir
        if ($t -ne $null) { return [pscustomobject]@{ Path = $dir; Title = $t; Installed = '' } }
        $dir = Split-Path $dir -Parent
    }
    return $null
}

if (-not $GamePath) {
    $here = Find-HereGame
    if ($here) {
        Write-Host "Found the game this folder is in: $($here.Title)  -  $($here.Path)"
        $GamePath = $here.Path
    }
}

if (-not $GamePath) {
    Write-Host 'Looking for Fear & Hunger / Termina on this PC (Steam, GOG, Games folders)...'
    $games = @(Find-Games)
    if ($games.Count -eq 0) {
        Write-Host ''
        Write-Host 'No game found. Drag the game folder (where Game.exe is) onto install.bat,'
        Write-Host 'or type its path here (empty = cancel):'
        $typed = (Read-Host 'Game folder').Trim('"', ' ')
        if (-not $typed) { return }
        $games = @([pscustomobject]@{ Path = $typed; Title = ''; Installed = '' })
        $pick = @($games)
    } else {
        Write-Host ''
        for ($i = 0; $i -lt $games.Count; $i++) {
            $g = $games[$i]
            $note = if ($g.Installed) { "  (co-op v$($g.Installed) installed)" } else { '' }
            Write-Host ("  {0}) {1}  -  {2}{3}" -f ($i + 1), $g.Title, $g.Path, $note)
        }
        Write-Host ''
        if ($games.Count -eq 1) {
            $answer = Read-Host 'Install the co-op mod there? [Y/n]'
            if ($answer -match '^\s*(n|no|н|нет)\s*$') { return }
            $pick = @($games[0])
        } else {
            $answer = Read-Host ("Which one? 1-{0}, several like 1,3, A = all, empty = cancel" -f $games.Count)
            if (-not $answer.Trim()) { return }
            if ($answer.Trim() -match '^(a|all|все|в)$') {
                $pick = @($games)
            } else {
                $pick = @()
                foreach ($part in ($answer -split '[,; ]+')) {
                    $n = 0
                    if ([int]::TryParse($part, [ref]$n) -and $n -ge 1 -and $n -le $games.Count) { $pick += $games[$n - 1] }
                }
                if ($pick.Count -eq 0) { Write-Host 'Nothing chosen.'; return }
            }
        }
    }
    # cada juego elegido: este mismo script con su carpeta (y las demas opciones tal cual)
    $forward = @{}
    foreach ($k in $PSBoundParameters.Keys) { if ($k -ne 'GamePath') { $forward[$k] = $PSBoundParameters[$k] } }
    foreach ($g in $pick) {
        Write-Host ''
        Write-Host "=== $($g.Path)"
        try {
            & $PSCommandPath -GamePath $g.Path @forward
        } catch {
            Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    return
}

$allNames = @('LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_QuickSave', 'LocalCoop_Net', 'LocalCoop_FearHunger_Actions', 'LookOutsideOnline_Actions')

$candidates = @("$GamePath\js", "$GamePath\www\js")
$jsDir = $candidates | Where-Object { Test-Path "$_\plugins.js" } | Select-Object -First 1
if (-not $jsDir) { throw "No encuentro js\plugins.js en '$GamePath'. Apunta a la carpeta donde esta Game.exe (o index.html)." }

$pluginDir = Join-Path $jsDir 'plugins'
$pluginsJs = Join-Path $jsDir 'plugins.js'
$src = Join-Path $PSScriptRoot 'plugins'
# pagina de las ventanas por jugador (F9) y configuracion de red: van junto a index.html
$viewPage = Join-Path (Split-Path $jsDir -Parent) 'coop_view.html'
$netConfig = Join-Path (Split-Path $jsDir -Parent) 'coop_net.json'

# Version del mod y comprobaciones del juego (solo avisos: el mod puede funcionar igual)
$modVersion = [regex]::Match([IO.File]::ReadAllText((Join-Path $src 'LookOutsideOnline.js')), "COOP_VERSION = '([^']+)'").Groups[1].Value
Write-Host "Termina Local Co-op v$modVersion"
# data/System.json versionId de las versiones con las que se probo el mod
$testedVersionIds = @{ 'Fear & Hunger 2: Termina' = 41801202; 'Fear & Hunger' = 14145329 }
$title = ''
$versionId = ''
$dataDir = @("$GamePath\data", "$GamePath\www\data") | Where-Object { Test-Path "$_\System.json" } | Select-Object -First 1
if ($dataDir) {
    $system = [IO.File]::ReadAllText("$dataDir\System.json")
    $title = [regex]::Match($system, '"gameTitle"\s*:\s*"([^"]*)"').Groups[1].Value
    $versionId = [regex]::Match($system, '"versionId"\s*:\s*(\d+)').Groups[1].Value
}
$coreFile = Join-Path $jsDir 'rpg_core.js'
if (Test-Path $coreFile) {
    $engine = [regex]::Match([IO.File]::ReadAllText($coreFile), 'RPGMAKER_VERSION = "([^"]+)"').Groups[1].Value
    if ($engine -and -not $engine.StartsWith('1.6')) { Write-Warning "RPG Maker MV $engine`: el mod se probo con MV 1.6." }
}
$gameName = $null
if ($title -match 'termina') { $gameName = 'Fear & Hunger 2: Termina' }
elseif ($title -match 'fear\s*(&|and)\s*hunger') { $gameName = 'Fear & Hunger' }
if ($gameName -and $versionId -and [int64]$versionId -ne $testedVersionIds[$gameName]) {
    Write-Warning "Esta version de $gameName ($versionId) no es la probada ($($testedVersionIds[$gameName])). Deberia funcionar; si algo falla, avisa."
}

# Perfil: el plugin de disparo previo al combate solo va en juegos que lo tienen (Fear & Hunger 2)
if ($Profile -eq 'auto') {
    if ($title -match 'look\s*outside') { $Profile = 'lookoutside' }
    elseif ($title -match 'fear|hunger|termina') { $Profile = 'fearhunger' }
    else { $Profile = 'generic' }
    Write-Host "Juego detectado: '$title' -> perfil $Profile"
}
$names = @('LookOutsideOnline')
if ($Profile -eq 'fearhunger') { $names += 'LocalCoop_FearHunger' }
if ($QuickSave) { $names += 'LocalCoop_QuickSave' }
if (-not $NoNet) { $names += 'LocalCoop_Net' }
$text = [IO.File]::ReadAllText($pluginsJs)
if ($NoNet -and -not $Uninstall) {
    $text = [regex]::Replace($text, ',?\s*\{\s*"name"\s*:\s*"LocalCoop_Net".*?\}\s*(?=[,\]])', '', 'Singleline')
    Remove-Item (Join-Path $pluginDir 'LocalCoop_Net.js') -ErrorAction SilentlyContinue
}

if ($Uninstall) {
    Copy-Item $pluginsJs "$pluginsJs.coop-uninstall.bak" -Force
    foreach ($n in $allNames) {
        $text = [regex]::Replace($text, ',?\s*\{\s*"name"\s*:\s*"' + $n + '".*?\}\s*(?=[,\]])', '', 'Singleline')
        Remove-Item (Join-Path $pluginDir "$n.js") -ErrorAction SilentlyContinue
    }
    Remove-Item $viewPage -ErrorAction SilentlyContinue
    Remove-Item $netConfig -ErrorAction SilentlyContinue
    [IO.File]::WriteAllText($pluginsJs, $text)
    Write-Host 'Desinstalado.'
    return
}

$bak = "$pluginsJs.coop.bak"
if (-not (Test-Path $bak)) { Copy-Item $pluginsJs $bak }

foreach ($n in $names) {
    Copy-Item (Join-Path $src "$n.js") (Join-Path $pluginDir "$n.js") -Force
    if ($text -notmatch '"name"\s*:\s*"' + $n + '"') {
        $entry = @"

    {
        "name": "$n",
        "status": true,
        "description": "Local Co-op",
        "parameters": {}
    }
"@
        $idx = $text.LastIndexOf(']')
        $head = $text.Substring(0, $idx).TrimEnd()
        $text = $head + ",`n" + $entry.TrimStart("`r", "`n") + "`n" + $text.Substring($idx)
        Write-Host "Registrado: $n"
    } else {
        Write-Host "Ya estaba registrado: $n (archivo actualizado)"
    }
}
Copy-Item (Join-Path $PSScriptRoot 'extras\coop_view.html') $viewPage -Force
if ($Net -eq 'host' -or $Net -eq 'join') {
    $cfg = if ($Net -eq 'host') { "{ ""role"": ""host"", ""port"": $NetPort }" } else { "{ ""role"": ""join"", ""host"": ""$NetHost"", ""port"": $NetPort }" }
    [IO.File]::WriteAllText($netConfig, $cfg)
    Write-Host "Juego en red: $netConfig -> $cfg"
}
[IO.File]::WriteAllText($pluginsJs, $text)
Write-Host "Listo. Copia de seguridad: $bak"
Write-Host 'Abre el juego: en el mapa X une a P2, U / Numpad 0 a P3 y Start en un mando une al siguiente jugador.'
if (-not $NoNet) { Write-Host 'Juego en red (experimental): Opciones > Co-op > Network game... (ver NETPLAY.md)' }
