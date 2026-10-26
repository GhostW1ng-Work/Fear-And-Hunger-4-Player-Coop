# Changelog

## v1.3.0

- Network game: **separate battles** (experimental, *Battles: Separate*): only the player an enemy touches (and their companions) fight; the others keep playing and can join by pressing OK next to a fighter or by touching an enemy. Off by default (*Battles: Together*). A short log of each battle goes to `www/coop_net_battle.log`.

## v1.2.0

**Network game (experimental)** - every player on their own PC with their own copy of the game, over the LAN or the internet. See [docs/NETPLAY.md](docs/NETPLAY.md).
- Options > Co-op > *Network game...*: the host opens the game and starts it, guests type the host's IP (or a name) and connect. Nothing connects by itself.
- Lockstep: only the keys travel; every PC computes the same game (shared randomness, clock and frame counter, scenes and new maps start on the same frame everywhere, the host's game options). Every second the PCs compare the world; if they ever differ, the host sends its world to everybody and the game goes on.
- Join or come back in the middle of the game; a player who leaves goes back into the party as a follower; a frozen guest is dropped after 5 s.
- Menus don't pause the game: each player's menu runs on its own over the live map and only its owner sees it.
- Adaptive input delay by ping (Auto, or 2-15 frames), password, and a check of mod version, game version and plugins when someone connects.
- F10 shows ping, input delay and frames waiting.


**Fixes**
- Termina: when the game removed and put back the vision circle (fog), the co-op copy of the old one stayed on screen, frozen, hiding the players until the next battle or map change.

**Menus**
- P2-P4: Skill / Equip / Status also let them pick the companions they control in battle (given by the host in *Co-op*, or by turn); with only their own character it still opens directly.

**Local co-op on / off**
- Options > Co-op > Co-op settings > *Local co-op*: Off turns the P2/P3 keys and the gamepads back into normal P1 keys; local players leave (their characters follow the party). The network game still works.

**Fear & Hunger 1 support**
- The Fear & Hunger plugin detects the game by its title: Termina (guns) or Fear & Hunger 1 (bow: Short bow / Cursed short bow, arrows, the game's own `arrow_check`). In other games it only adds the light and never touches the shooting switches.
- In Fear & Hunger 1 the shot no longer touches switches 2252-2254 (story switches there) or treats the spear / swords as guns.
- Character picker for Fear & Hunger 1: the four classes and the recruitable companions.
- Installer: knows the tested Fear & Hunger 1 version; event audit `docs/AUDIT_FH1.md`; tests run on both games (`TEST_MAP`).

## v1.1.0

**Performance (split screen and F9 windows)**
- Each split view keeps its own tile layers: the map geometry is no longer rebuilt several times per frame.
- Each view only draws the characters inside it (Termina maps have up to ~900 events).
- `F10` shows per-frame timings.
- F9 player windows always update at 30 FPS and full resolution (60 FPS stalled the game; half resolution looked too blurry); the window FPS setting was removed.

**Fixes**
- The "Player N is waiting" banner was not shown.

## v1.0.0

First release of the 3-4 player version, based on [TheTiranix/rpgmaker-local-coop](https://github.com/TheTiranix/rpgmaker-local-coop) (2 players).

**Players and controls**
- Up to 4 players: P1 and P2 on the keyboard, P3 on the keyboard (numpad and/or IJKL) or a gamepad, P4 on a gamepad.
- Gamepads: `Start` on a free gamepad joins the next free player; NumLock on or off both work.
- Any player can leave and join on their own (no "P3 needs P2"); a player gets their character back when rejoining.

**Camera and views**
- Auto camera: shared while everyone fits, split screen when someone walks away.
- Split screen for 2 / 3 / 4 players with per-view zoom (`-` / `=`).
- Experimental player windows (`F9`), one per player, for separate monitors.

**Gameplay**
- Combat turns per player; the host assigns extra characters (P1 menu > Co-op: P1..P4 or AI).
- Own menus for P2-P4 (Skill / Equip straight to their character; Options / Save stay with P1).
- Events see the player who started them: dialogue choices, position and facing checks, move routes, items from their menu.
- Away players (gamepad unplugged or marked by the host): AI fights for them and they follow P1.
- The host can take a player's character: it becomes a normal companion controlled by P1.
- Characters nobody plays follow P1 as the game's normal followers.

**Termina compatibility** (see `docs/AUDIT_SUMMARY.md`)
- Protagonist systems (gun shot, backstab, bleeding) always use P1 or the shooter.
- Players keep their character when the game rearranges the party; in solo story parts they wait and come back.
- In cutscenes P2-P4 hide / follow with P1, and camera pans are respected.
- P2-P4 start events with the same rules as the player (priority, counters, touch).

**Settings and tools**
- Options > Co-op: camera, split layouts, zoom, gamepads, P3 keys, rejoin after loading, F9 window FPS (saved with the game config).
- Saves remember who was playing and with which gamepad.
- Optional quick save plugin for testing (`F6` / `F7`, slot 99).
- Installer checks the game and the engine version; `-QuickSave`, `-Uninstall`.
- Test harness (`tests/`, ~120 scenarios on the real engine) and event audit (`tools/audit_events.py`).
