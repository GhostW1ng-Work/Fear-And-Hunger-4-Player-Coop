# Termina Local Co-op (up to 4 players)

Local co-op for **Fear & Hunger 2: Termina** and **Fear & Hunger 1** (RPG Maker MV): up to 4 players on one PC, keyboard and gamepads, with split screen, per-player menus and combat turns.

Based on [TheTiranix/rpgmaker-local-coop](https://github.com/TheTiranix/rpgmaker-local-coop) (2 players, MIT). This version extends it to 3-4 players and adds gamepads, auto camera, per-player menus and more. The base plugin still works on other RPG Maker MV/MZ games (e.g. Look Outside), but development and testing target Termina.

[Русская версия](README.ru.md)

## Features

| | |
|---|---|
| **Up to 4 players** | P1 and P2 on the keyboard, P3 on the keyboard or a gamepad, P4 on a gamepad. Party slot N = player N. |
| **Gamepads** | Press `Start` on a free gamepad: the next free player joins and the pad becomes theirs. A free pad still controls P1. |
| **Auto camera** | Shared camera while everyone fits on screen, split screen when someone walks away, shared again when you regroup. |
| **Split screen** | 2 = halves, 3 = three equal views (two on top, one centered below), 4 = 2x2. `-` / `=` zoom each view out / in (by default every view sees as much map as the full screen). |
| **Combat** | Each character is controlled by its owner; a banner shows whose turn it is. Extra characters alternate between players unless the host assigns them. |
| **Events see who started them** | If P2-P4 started an event (talk, examine, puzzle, trap, an item from their menu), the event treats them as the protagonist: their position and facing, move routes and animations, and only they pick the dialogue answers. |
| **Who plays who** | In P1's menu, **Co-op** lets the host choose who controls each extra character in combat (P1..P4 or AI). On a player's main character: mark them away, or **take it** - the player leaves and the character becomes a normal companion that follows P1 and that P1 controls. Characters nobody plays follow P1 like normal companions. |
| **Away players** | If a player's gamepad is unplugged (or the host marks them away in **Co-op**), AI fights for their character and it follows P1 on the map; any button of that player brings them back. |
| **Network game** (experimental) | Every player on their own PC, over the LAN or the internet (Radmin VPN / ZeroTier or port forwarding): Options > Co-op > *Network game...*. Menus don't pause the game, players can join and leave mid-game. See [docs/NETPLAY.md](docs/NETPLAY.md). |
| **Own menus** | P2-P4 open the game menu for themselves (Skill / Equip / Status go straight to their character; if the host gave them companions in *Co-op*, they choose among their own). Options, Game End, Save and Formation stay with P1. |
| **Save / load** | Saves remember who was playing and with which gamepad; after loading everyone is back automatically. |
| **Fear & Hunger 1** | Same features; P2-P4 shoot with a bow (Short bow / Cursed short bow + arrows) like P1, and the character picker offers the four classes and the recruitable companions (Le'garde, Moonless, Nas'hrah). Event audit: [docs/AUDIT_FH1.md](docs/AUDIT_FH1.md). |
| **Termina specifics** | Vision circle and lantern light for every player, map shooting for P2-P4 (gun equipped + sprint key), enemies chase the nearest player. Each player keeps their character when the game rearranges the party; in solo story parts players wait and come back by themselves; in cutscenes P2-P4 follow / hide with P1. See [docs/AUDIT_SUMMARY.md](docs/AUDIT_SUMMARY.md). |
| **Player windows (experimental)** | `F9` opens one window per player with only their view, to put each one on a different monitor. |
| **Quick save (testing)** | Optional plugin: `F6` save screen (choose the slot) / `F7` load screen; `Shift+F6` / `Shift+F7` instant save / load in slot 99. |

Game over rule (as in the original mod): if any player's character dies in combat, it's game over.

## Controls

| | P1 | P2 | P3 (keyboard) | Gamepad (P2 / P3 / P4) |
|---|---|---|---|---|
| Join | - | `X` on the map (`Enter` once co-op is on) | `U` / `Numpad 0` | `Start` |
| Move | `W A S D` | Arrows | `Numpad 8 4 5 6` or `I J K L` | D-pad / left stick |
| Sprint / shoot | Left Shift | Right Shift | `Numpad +` or `H` | `X` or `RT` |
| OK / interact | `Z` / `Space` | `Enter` | `Numpad 0` / `Numpad Enter` or `U` | `A` |
| Cancel / own menu | `X` / `Esc` | `Backspace` | `Numpad .` or `O` | `B` |
| Camera | `G` (anyone): auto / shared / split / P1..P4 | | | `Back` / `Select` |
| Split zoom | `-` / `=` | | | |
| Player windows | `F9` | | | |

Numpad keys work with NumLock on or off.

## Install

1. Download the latest **Termina-Local-Coop-vX.Y.Z.zip** from [Releases](../../releases) (or Code > Download ZIP) and unzip it.
2. Drag your **game folder** (the one with `Game.exe`) onto `install.bat`,
   or run `powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "C:\path\to\game"`.
   Add `-QuickSave` to also install the F6/F7 save / load plugin.

The installer checks the game (title, RPG Maker version, Termina data version it was tested with) and only warns if something differs. It copies the plugins to `www/js/plugins`, registers them at the end of `www/js/plugins.js` (backup: `plugins.js.coop.bak`) and copies `extras/coop_view.html` next to `index.html` (needed by F9). Re-running it updates the files; `-Uninstall` removes everything.

## Settings

In the game: **Options > Co-op > Co-op settings...** - local co-op on / off (off: arrows, Enter, numpad and gamepads are normal P1 keys), camera, split screen layouts and zoom, gamepads, P3 keys, rejoin after loading, check for updates (a notice on the title screen when a newer version is out). They are saved with the game config (like the volume) and apply to every save.

## Parameters (`LookOutsideOnline`)

Defaults for the settings above, plus a few advanced ones. Set them in `www/js/plugins.js`, e.g. `"parameters": {"MaxPlayers": "3"}`.

| Parameter | Default | |
|---|---|---|
| `MaxPlayers` | 4 | 2, 3 or 4. |
| `P3Keys` | all | `all` = numpad and IJKL, `numpad`, `ijkl`. |
| `Gamepads` | true | `false` = gamepads always control P1. |
| `AutoRejoin` | true | Players rejoin automatically after loading. |
| `DefaultCameraMode` | auto | `auto`, `shared`, `split`, `p1`..`p4`. |
| `SplitDirection` | vertical | 2 players: `vertical` = side by side, `horizontal` = stacked. |
| `Split3Layout` | triangle | 3 players: `triangle`, `grid` (2x2 with a party HP/MP panel), `big` (P1 half screen). |
| `SplitZoom` | far | Starting split zoom: `far`, `medium`, `near`. |
| `P2ActorMode` / `P2ActorChoices` | auto / all | Character picker (see the plugin help). |
| `P2MoveSpeed` / `P2DashBonus` | 0 / 1 | Speed of P2-P4 (0 = copy P1). |

## Tests

`tests/` runs the real RPG Maker MV engine of your installed game in V8 (graphics stubbed) with the plugins from this repository, and checks ~60 co-op scenarios: joining, gamepads, combat turns, dialogue choices, menus, save/load, auto camera...

```
pip install mini-racer
set TERMINA_GAME=C:\Games\Fear2\www
python tests/run.py
```

Fear & Hunger 1: `set TERMINA_GAME=C:\Games\Fear1\www` and `set TEST_MAP=1`.

Graphics (split screen drawing, lights, windows) are not covered: check those in the game.

## Releases

`tools/make_release.ps1` builds `dist/Termina-Local-Coop-v<version>.zip` (the version is `COOP_VERSION` in `plugins/LookOutsideOnline.js`). Changes: [CHANGELOG.md](CHANGELOG.md).

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md), in particular **remote play with one view per player** (each friend sees only their own character in a browser).

## License

MIT (see [LICENSE](LICENSE)). Contains no game assets: you need your own copy of Fear & Hunger 2: Termina and/or Fear & Hunger 1.
