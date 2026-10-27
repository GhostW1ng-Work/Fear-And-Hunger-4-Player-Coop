# Changelog

## v1.8.3

- Network game, less work per frame: the battle log is written every 2 s in the background (it was written to disk on every key in a battle, the game waited for the disk) and kept under ~1 MB; the random-number trail for the desync log only turns call stacks into text when a desync is written.

## v1.8.2

- **Easier install**: double-click `install.bat` - unzipped inside the game folder, it installs right there; otherwise it finds Fear & Hunger 1 / Termina by itself (Steam and its libraries, GOG, `Games` folders) and asks which one (a number, several, or all). Dragging the game folder onto it still works.

## v1.8.1

- Network game: fixed frequent **desyncs between different PCs** in Fear & Hunger 1 and Termina: the flicker of TerraxLighting lights (and the film grain of FilterController) drew random numbers from the shared game seed - each PC draws a different part of the map, so the PCs drifted apart. Every desync re-sent the world (~400 KB) to the guests, which is what made the ping jump to seconds. Same fix for the noise / glitch of Olivia_HorrorEffects, the voice pitch of messages (DhoomMessageSE) and the first frame of UltraMode7 projectiles.

## v1.8.0

- **Death and soul stones** (Fear & Hunger 1 and Termina): only P1's death ends the game. A character who dies leaves a body; a player with a filled soul stone (*Lesser soul* / *Soul stone*) presses OK at the body to bring them back (the stone is used up; back with 30% HP and mind; the reviver loses 30% mind - both in *Co-op settings*). The game's "killed" switches are undone and Termina's corpse goes away. *When P2-P4 die*: *The party goes on* (new default) or *Game over* (the old rule). In the network game the host's rules apply to everyone.
- Bodies: Termina's corpse of a player appears where that player died (on a free tile, not under an enemy corpse); every body shows the name of the dead above it. In the network game the game checks for the dead only after a separate battle ends (before, the battle lost its fighters and pulled in P1's character); a lost battle where P1 survives does not bring the dead back; a player without a character watches P1.
- Network game: **F6 / F7 work on the host** (with the quick save plugin): F6 opens the save screen as P1's menu (guests keep a copy), Shift+F6 saves to slot 99; F7 / Shift+F7: everybody goes to the title for a moment, the host loads and the network game starts again by itself with the loaded world.
- Fix: OK did nothing in the **Co-op** menu (only left / right worked), so the soul stone cheat could not be used.
- **Co-op** menu: a player waiting for their (dead) character can be given a free one (*"Pn plays it"*); cheat: get 1 soul stone.
- Network game: a player who disconnects during a battle no longer leaves their character to the AI - the host commands it until the battle ends (in a separate battle, the next player fighting in it; the AI only if nobody is left). After the battle it is a normal party member.
- Fix: in a separate battle, if the player who started it disconnected, nobody could close the victory messages (the battle never ended). Now the next player still in the battle presses OK; if nobody is left, the messages go on by themselves.

## v1.7.1

- Network game: **every player's ping on screen** (top right, on the map and in battles: green under 80 ms, yellow under 160, red above) and in the lobby list. *Ping on screen* in the network menu turns it off.

## v1.7.0

- Network game **lobby**: connected guests press *I'm ready*; everybody sees who is ready, and when all guests are, the game starts by itself after a 3-second countdown (the host can still start earlier).
- Network game shortcuts: **Host online** on the title screen (load a save and the game is open for the others) and **Join online** (the network menu, straight on the list of games found); **Online** in P1's game menu (who is connected, start, stop).
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
