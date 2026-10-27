# Changelog

## Unreleased

- Network game: **games found** - the network menu lists the games open on your networks (LAN, Radmin VPN / ZeroTier, or another copy on this PC): pick one with left / right instead of typing the IP (UDP port 47811). Typing the IP still works.

## v1.6.0

- Network game: after the host closes and opens the game again, a guest gets their old number back (P2 used to come back as P3).
- Network game: **bring your own character**. A guest picks one of their own saves (*Bring character* in the network menu); its main character (level, stats, skills, equipment worn) joins the host's party and the guest plays it. Not if the host's party already has 4 members or that character is played by someone else (then the guest plays a companion, as before). Coming back later, the guest gets the same character again.

## v1.5.1

- A battle started by a shot of P2-P4 (an enemy hit) is the shooter's: in separate battles the shooter fights, not the host.
- Shooting of P2-P4: the muzzle flash and the shot effects play on the shooter and in the direction the shooter looks (Termina chose it from where P1 looked), not on P1 (the shot events "show animation on the player"), and the shot lasts until the bullet / arrow stops flying.

## v1.5.0

**Network game in Fear & Hunger 1**
- No more drifting apart every few seconds (looked like constant reconnects): the day/night clock of TerraxLighting is now the same on every PC.
- Battles stay in sync: the mouse is off in the network game (YEP_BattleEngineCore picked the target under the resting mouse on one PC only).

**Separate battles**
- The enemy of a battle stays frozen on the map until the battle ends, whoever started it (it used to walk on, chase the other players and could start a second battle).
- A player who joins while actions are being chosen no longer crashes the battle (WeaponSkill `setAttack`).

**Scenes**
- P2-P4 follow P1 in a scene only when it really moves P1 (not when it just turns him, e.g. opening a barrel), not after a map transfer, and never stay stuck inside a wall.

**F6 / F7**
- F6 opens the save screen (choose the slot - even where the game doesn't let you save), F7 the load screen (also on the title screen). Shift+F6 / Shift+F7 keep the instant save / load in slot 99. Off in the network game.

**Diagnostics**
- The desync log lists the random-number calls of the last second on each PC; separate battles log the keys, the active window and the cursor.

## v1.4.0

- **Players keep their characters**: when a story event removes the character of P2-P4 from the party, it stays with its player (*Co-op settings > Keep players' characters*, on by default). In Termina's solo parts (`temporary_party_remove`) it does leave: the player waits and comes back with the same character afterwards - never with someone else.
- Saves remember which character each player had; after loading everybody gets their own back.
- Network game: a game over (back to the title) ends the network session for everybody instead of hanging when the host loads a save; the guests stay connected and the host starts again.

- **Update notice**: once at start the mod checks GitHub; if there is a newer version, the title screen says so (*Co-op settings > Check for updates* turns it off).

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
