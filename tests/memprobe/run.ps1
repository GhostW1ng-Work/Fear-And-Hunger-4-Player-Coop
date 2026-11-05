# Memory test on the real game: adds coop_memprobe.js for one run and takes it away after it.
# The games close by themselves. Results: tests\memprobe\out\<Name>.*
param(
    [string]$Name, [string]$Mode, [int]$Seconds = 480, [int]$Dwell = 3, [int]$BattleEvery = 4,
    [int]$NoAudio = 0, [int]$Clean = 0, [string]$WalkAt = '', [int]$NoLights = 0,
    [string]$HostDir = 'C:\Games\Fear2', [string]$SoloDir = 'C:\Games\Fear2MP'
)
$Here = Split-Path $MyInvocation.MyCommand.Path -Parent
$OutDir = "$Here\out"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$games = @(@{ Dir = $SoloDir; Role = 'host' })
if ($Mode -eq 'online') { $games = @(@{ Dir = $HostDir; Role = 'host' }, @{ Dir = $SoloDir; Role = 'join' }) }
foreach ($g in $games) {
    $www = "$($g.Dir)\www"
    Copy-Item "$Here\coop_memprobe.js" "$www\js\coop_memprobe.js" -Force
    if (-not (Test-Path "$www\index.html.memprobe.bak")) { Copy-Item "$www\index.html" "$www\index.html.memprobe.bak" }
    $html = [IO.File]::ReadAllText("$www\index.html.memprobe.bak")
    $html = $html.Replace('<script type="text/javascript" src="js/main.js"></script>', '<script type="text/javascript" src="js/coop_memprobe.js"></script><script type="text/javascript" src="js/main.js"></script>')
    [IO.File]::WriteAllText("$www\index.html", $html)
    $json = '{"mode":"' + $Mode + '","role":"' + $g.Role + '","seconds":' + $Seconds + ',"dwell":' + $Dwell + ',"battleEvery":' + $BattleEvery + ',"noAudio":' + $NoAudio + ',"clean":' + $Clean + ',"walkAt":"' + $WalkAt + '","noLights":' + $NoLights + '}'
    [IO.File]::WriteAllText("$www\coop_memprobe.json", $json)
}
$samples = "$OutDir\$Name.samples.csv"
'sec,dir,id,privateMB,virtualMB,workingMB' | Out-File $samples -Encoding ascii
foreach ($g in $games) {
    Start-Process -FilePath "$($g.Dir)\Game.exe" -WorkingDirectory $g.Dir | Out-Null
    Start-Sleep -Seconds 6
}
$t0 = Get-Date
$limit = $Seconds + 120
while ($true) {
    $sec = [int]((Get-Date) - $t0).TotalSeconds
    $list = Get-Process -Name Game -ErrorAction SilentlyContinue | Where-Object { $_.Path -like 'C:\Games\*' }
    if (-not $list) { break }
    foreach ($p in $list) {
        "$sec,$(Split-Path (Split-Path $p.Path -Parent) -Leaf),$($p.Id),$([int]($p.PrivateMemorySize64/1MB)),$([int]($p.VirtualMemorySize64/1MB)),$([int]($p.WorkingSet64/1MB))" | Out-File $samples -Append -Encoding ascii
    }
    if ($sec -gt $limit) { "STILL RUNNING after $limit s" | Out-File "$OutDir\$Name.stuck.txt"; break }
    Start-Sleep -Seconds 5
}
foreach ($g in $games) {
    $www = "$($g.Dir)\www"
    $leaf = Split-Path $g.Dir -Leaf
    if (Test-Path "$www\coop_memprobe.log") { Copy-Item "$www\coop_memprobe.log" "$OutDir\$Name.$leaf.log" -Force; Remove-Item "$www\coop_memprobe.log" }
    Copy-Item "$www\index.html.memprobe.bak" "$www\index.html" -Force
    Remove-Item "$www\index.html.memprobe.bak", "$www\js\coop_memprobe.js", "$www\coop_memprobe.json" -ErrorAction SilentlyContinue
}
"finished $Name"
