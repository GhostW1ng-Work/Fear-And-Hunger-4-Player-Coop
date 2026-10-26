<#
  Instalador de Local Co-op para RPG Maker MV/MZ.
  Uso:  .\install.ps1 -GamePath "D:\Juegos\Fear & Hunger 2"
  Copia los plugins, registra los plugins en js\plugins.js (con copia de seguridad) y listo.
  -QuickSave instala tambien el plugin de pruebas F6/F7 (guardado rapido).
  -Net host | -Net join -NetHost 192.168.1.20  instala el PROTOTIPO de juego en red y
   escribe www\coop_net.json (puerto: -NetPort, por defecto 47810).
#>
param(
    [Parameter(Mandatory = $true)][string]$GamePath,
    [switch]$Uninstall,
    # auto = detecta por el titulo del juego. lookoutside = solo el plugin base. fearhunger = base + plugin de Fear & Hunger (luz de P2, disparo previo al combate).
    [ValidateSet('auto', 'lookoutside', 'fearhunger', 'generic')][string]$Profile = 'auto',
    # plugin de pruebas: F6 = guardado rapido, F7 = carga rapida
    [switch]$QuickSave,
    # prototipo de juego en red (lockstep): host = este PC es P1, join = se conecta a -NetHost
    [ValidateSet('', 'host', 'join')][string]$Net = '',
    [string]$NetHost = '127.0.0.1',
    [int]$NetPort = 47810
)

$ErrorActionPreference = 'Stop'
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
if ($Net) { $names += 'LocalCoop_Net' }
$text = [IO.File]::ReadAllText($pluginsJs)

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
if ($Net) {
    $cfg = if ($Net -eq 'host') { "{ ""role"": ""host"", ""port"": $NetPort }" } else { "{ ""role"": ""join"", ""host"": ""$NetHost"", ""port"": $NetPort }" }
    [IO.File]::WriteAllText($netConfig, $cfg)
    Write-Host "Juego en red (prototipo): $netConfig -> $cfg"
}
[IO.File]::WriteAllText($pluginsJs, $text)
Write-Host "Listo. Copia de seguridad: $bak"
Write-Host 'Abre el juego: en el mapa X une a P2, U / Numpad 0 a P3 y Start en un mando une al siguiente jugador.'
