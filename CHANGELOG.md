# Changelog

## Unreleased

- **Ending The Fourth Festival** (Termina): when everybody at the tower door chooses *Commit suicide* - the music fades, Rher's bells, the tower, a slowly rising text with the party's names, the name of the ending, then the title screen. Cheat *Play the ending The Fourth Festival* in the Co-op menu shows it at once. Text: `docs/ENDING_FOURTH_FESTIVAL.md`.
- **Language setting** (*Language*: English / Русский): the mod's menus, settings, messages, questions and scenes in Russian; online the host's language (messages must last the same on every PC). Cyrillic uses the game's Crimson Text where the main font has none.
- **Hero dies (not by a player)** (Termina, default *The next one takes over*): when the protagonist dies (a monster, a trap...), the next player alive becomes the protagonist (online their PC plays P1); with no players, a companion who can be; the old one is a dead companion. A battle lost by a protagonist fighting alone ends without game over then. *Game over* = as in the game.
- The door lines in English are now the translations of the Russian ones.
- The tower door: the choice is *Fight* / *Commit suicide*; the characters' lines are in Russian (written by the mod's author; see `docs/DOOR_LINES.md`); Russian letters in message windows use Crimson Text from the game (Termina's font has no Cyrillic); long lines wrap.
- Termina, the tower door with other players in the party: before the fight each player chooses *Fight* or *Commit suicide*; everyone says their line (a line of their own for each playable character); who ends it dies; those who fight fight to the death (the others watch); if only one fights, they are the one left (and the protagonist; P1 who chose to end it dies at the end); everybody ends it - game over.

## v1.8.9

- **The protagonist can change hands (Termina).** Whoever kills the protagonist (P1) in a fight to the death becomes the protagonist: first in the party, with the game's protagonist switch (the story treats them as the protagonist). Online the killer's PC plays P1 from then on and the dead one's PC the killer's old number - on every PC in the same frame; the host stays the host; kept in the save. On one PC the players swap places (the screen says so). The old protagonist is a dead companion: body, waiting, back with a soul stone - as a companion. If the PC playing P1 disconnects, the host plays the protagonist.
- **PvP of several sides.**
  - *Attack everyone* (3+ players): every player in one fight, each on their own.
  - Online, OK next to players fighting each other: *Help P1 / Help P2 / Attack everyone / Leave* - you join at the next turn on that side (or your own), with your double.
  - Everybody fights the doubles of the other sides; the fallen leave; it ends when one side is left. Killing P1 makes the main player of the side that finished them the protagonist (even if a helper or a companion hit).
  - Several enemies stand side by side, smaller.
- **Ending B with players.** The tower door with other players in the party: instead of the moonscorched scene, *Only one may leave Termina* and a fight of everybody against everybody, to the death, in normal form (even with PvP off).
- **Cheats for testing ending B** (Co-op menu, *Cheats* on): *Contestants left: N*, *Kill all contestants not in the party*, *Teleport to the tower door*.
- **Watching:** online, a player with no character (dead, waiting) watches the battle going on (P1's first), with its music.
- **Crash log:** when the game crashes (*Game has encountered a bug*) the mod writes what happened and where to `www/coop_crash.log`.
- **Fixed:** online, a battle started by a story scene that starts by itself (Per'kele on the Moon tower) began the scene again after the battle - the fight repeated forever.

## v1.8.8

- **PvP in Termina** (setting *PvP (Termina)*: Off / On - not to the death / On - to the death; the host's in the network game, also a row in the network menu, can be changed while playing). Works in local co-op and online.
  - **Attack:** OK next to another player (any side, also diagonally; if you face someone to talk to or a chest, OK does that) -> *Attack X?* -> the other player is pulled into the battle, no consent needed. From behind, the attacked player loses their first turn.
  - **The battle:** each player sees the other player's character as the enemy, the way Termina shows that contestant in a fight (their picture and body parts), and only their own character in the party; each one takes their own turns and chooses which body part to hit. On one PC the screen shows the enemy of whoever is choosing.
  - **Balance:** the enemy has the HP of that contestant in the game and every hit takes the same share of the real character's HP, so a fight lasts several turns. Setting *PvP damage* (x1 / x0.5 / x0.25 / x2).
  - **Body parts:** a limb is lost the way Termina does it (battle picture without it, bleeding, weapon dropped with no arms, the game's message). A leg cut off makes the head easy to hit (it normally dodges most attacks); an arm cut off halves that player's damage, both arms nearly stop it. Limbs lost before the fight are missing from the start. The head is fatal.
  - **Not to the death:** whoever reaches 0 HP stays with 1 HP and the fight ends; limbs cut in the fight (and a dropped weapon) come back.
  - **To the death:** the loser dies by the normal rules, cut limbs stay; if the protagonist (P1) is killed, the game is over.
  - *Run* ends the fight for both (HP and states kept). No experience or money.

## v1.8.7

- Setting **Revive with soul stones: On / Off** (Co-op settings, and a row in the network menu; the host's in the network game, can be changed while playing). Off: death is for good - the mod leaves no body to revive; the dead player waits until the host gives them a free character (Co-op menu) or a new companion joins. Turned on again, bodies already lying there can be revived.
- The network menu no longer runs off the bottom of the screen (it scrolls when the rows don't fit).
- README (English and Russian) and the online guide rewritten in simpler words, with every feature and setting; the online guide is now also in Russian (`docs/NETPLAY.ru.md`). The release ZIP has a `docs` folder: both online guides and the test checklist.

## v1.8.6

- Network game, separate battles: **several battles at once, each with its own enemy.** Before there was only one separate battle: when P2 was fighting one enemy and P1 touched another, P1 was pulled into P2's battle (and the second enemy waited to fight them too). Now P1 gets their own battle with that enemy, both run at the same time, each PC shows the battle of its player. Touching the *same* enemy, or pressing OK next to a fighter, still joins that battle. Each battle keeps its own troop and battle state; the map event that started it waits aside (the map stays free for the others: talking, chests, another battle) and goes on ("if you win...") as soon as the map is free; what it then does to the whole party ("AFTER BATTLE": recover, states...) does not touch those still fighting in another battle.
- With two battles at once they don't disturb each other: when one battle started or ended, the game prepared / cleaned up the WHOLE party (actions, battle states), also the characters fighting in the other battle - their next attack failed and their battle closed ("won" by itself). Now only that battle's fighters. And the battle state the games keep in common switches and variables (*SKILLS_BATTLE*, *battle_phase1*, *Beartrap_set*...: troop pages start from them) is per battle: each battle sees what it changed itself, not what the other one did; the map sees the latest values, as before.

- Network game: **the host no longer waits for a player who stops answering, and drops nobody.** Before, everybody waited for every key of every player; a game that stalled (minimized, hidden, busy) froze the others and after 5 s the host dropped that player. Now the host waits 0.5 s at most, then that player's frames go on without their keys; when their game comes back it catches up quickly (up to 8 frames at a time) and plays on, same world.
- Network game: a guest that loses the host (or stops) goes back to the title and reconnects from there. Before, its copy of the host's world went on alone (its own battles and events) and broke.
- A separate battle whose players all left ends at once as an escape (before it could go on forever with the AI, and its enemy then started new battles again and again).

## v1.8.5

- The character a player picks in the mod is no longer also standing around as an NPC (Fear & Hunger 1: e.g. Cahara in his cell, in Mahabre or in the prison; Termina: e.g. Marina, Daan, Abella, Karin, Olivia). The games hide a companion who is already in the party (or the protagonist) with an empty page of the event ("Cahara_InTheParty!", "INITIAL_MERCENARY", "OCCULTIST_SELECT"...); while a player plays the character (or their body lies on the map) those pages count as met - only those empty pages: the NPC is gone and nothing else changes (no game switch is touched, the story does not think they were hired; if the player gives the character up, the NPC is back).
- The same for NPCs that wait for the character (the train in Termina: Levi, Marina, Daan, Abella, O'saa...; Le'garde and the "wait here" spots in Fear & Hunger 1): the game turns their "waiting" switch off when it hires them; for the events of a played character it counts as off - only if the event then shows nothing (if a scene would show instead, the game's page stays).
- Setting **Played characters' NPCs: Hidden / Shown** (Options > Co-op > Co-op settings, and a row in the network menu; the host's in the network game, can be changed while playing): Shown keeps the NPCs as in the game.

## v1.8.4

- Fix (network game, separate battles): when the fighters of a separate battle died and the game took them out of the party during the battle (Fear & Hunger 1 does it from the enemy troop's page), the battle pulled in P1's character - P1 then "lost" in their place and the protagonist's defeat scenes (guards, blood pit...) played for everybody. Now a separate battle never takes other players' characters: if its fighters are all gone, the battle ends there and the dead stay as bodies.
- Fix: a separate battle lost without P1 no longer counts as "lost" for the map event that started it. Fear & Hunger 1 guards (and many other battles) have an *If lose* branch - capture, blood pit, cut legs - that is the protagonist's defeat and hit everybody; now the event sees the battle as ended (like an escape) and the fighters stay dead as bodies (before, a "can lose" battle stood them up with 1 HP and the enemy touched them again - an endless battle).
- Fix: after bringing someone back, their body (the picture drawn by the mod, e.g. in Fear & Hunger 1) and its name are removed at once.
- **Cheats** setting (Options > Co-op > Co-op settings, the host's in the network game): F6 / F7 save / load anywhere and the cheats of the Co-op menu (soul stone). On by default.
- New cheats for testing (Co-op settings, need *Cheats* On, the host's in the network game): **immortal party** (never below 1 HP, nothing kills it outright), **keep limbs** (no arm / leg / head cut), **one-hit kills** (any damage the party deals kills the enemy or enemy part).
- More cheats: **open locks** (Co-op settings: a door / chest / cell that asks for a key or a lockpick opens as if you had it), and in the Co-op menu **restore HP, mind and hunger** and **get torches and fire** (Torch x3 + Tinderbox / Matches / Lighter).
- Fix: Fear & Hunger 1 puts its own corpse of a dead companion on the map (event "DeadDarkpriest"... with the "...BODY" switch); after bringing them back with a soul stone that corpse stayed (and came back). Now its switch is turned off too; while dead, the game's corpse is the body (OK with a filled soul stone brings them back; without it the game's own options stay, e.g. catching the soul with an empty one) and the mod does not draw a second one.
- Network menu: a **Cheats** row - the host turns cheats on / off, also during the game (for everybody).
- Fix (critical): leaving the map where a body lies and coming back made the body disappear (Fear & Hunger 1 puts its own corpse event back to its starting place when the map is loaded again) - it could not be revived any more. Now the game's corpse always lies where the player died, and on other maps it is not shown.
- Fix (network game): after the network game stopped (Stop, or the host left), the menus did not respond - the cursor did not move, you could not even quit to the title. The players of the other PCs stayed as local co-op players P2-P4, so the keyboard was split between them (the arrows belonged to P2). Now their characters go back to the party as followers; they get them again when the game starts again.
- **Every player has their own torch.** A torch lit from the menu of P2-P4 is theirs: it lights up around their character, they hold it in their hand (Fear & Hunger 1), and it burns down on its own timer (like the game's). P1's torch is the game's as before. Each one goes out by itself - before, any torch lit P1 and P1 held it.
- Fix (network game): on the other PCs the light around P1 vanished and P2-P4 stood in black whenever their camera was to the right of or below P1. TerraxLighting puts P1's light "on the other side of the map" then (meant for maps that wrap around); now on normal maps it stays where P1 is, and the others get theirs.
- Fix: the light the game keeps around the protagonist (Termina always has some) was only around P1 - on the other PCs, away from P1, everything was black. Now every player has that same light around them (in Fear & Hunger 1 without P1's torch: that one is P1's; with their own torch, the light of their torch).
- Fix (network game, Termina): the darkness with a circle of sight (GALV_VisibilityRange) was always around P1, so on the other PCs everything around their own character was black. Now each PC sees it around its own character (like the camera); without a character, around P1.
- Network game, separate battles: while somebody is fighting on the map, the others cannot leave it, sleep, save or be teleported (doors, beds, save points, F6, Save in the menu): the transfer took the fighters along too, and that was a way to run from any battle. A message says who is fighting; it works again when the battle ends.
- Fix: P2-P4 walked after P1 by themselves (like the AI, through doors and walls) whenever an event moved P1 a step - e.g. going through a door or a doorway. Now they only follow P1 when a scene takes P1 at least 3 tiles away and does not end by taking everybody to another place anyway.
- Fix: a character that followed P1 through walls (while its player was disconnected, or in a scene) could stay stuck inside a wall when it got control back. Now it is put next to P1.
- Fix (network game, Fear & Hunger 1): choosing an enemy (or enemy part) could pick a different one on each PC (the list was ordered by where each PC had drawn the enemies) - the battle went different ways (desync, a resync and a lag spike). Now the order is the same everywhere. The desync log also shows longer call stacks, and the battle log the size of the list.

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
