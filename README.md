# Fear & Hunger Co-op: Termina and Fear & Hunger 1 (up to 4 players)

A mod that lets **2 to 4 people play Fear & Hunger 2: Termina or Fear & Hunger 1 together**:

- **On one PC** - with a keyboard and gamepads. The screen splits when you walk apart.
- **Online** (experimental) - every player on their own PC with their own copy of the game, over the local network or the internet.

Every player controls their own character: walks around, talks to people, opens their own menu and takes their own turns in battle.

Based on [TheTiranix/rpgmaker-local-coop](https://github.com/TheTiranix/rpgmaker-local-coop) (2 players, MIT). The base part still works in other RPG Maker MV/MZ games (e.g. Look Outside), but everything is made and tested for Termina and Fear & Hunger 1.

[Русская версия](README.ru.md)

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Controls](#controls)
- [How co-op works](#how-co-op-works)
- [Death and soul stones](#death-and-soul-stones)
- [Torches, light and NPCs](#torches-light-and-npcs)
- [Players against each other (PvP, Termina)](#players-against-each-other-pvp-termina)
- [The Co-op menu](#the-co-op-menu)
- [Settings](#settings)
- [Cheats](#cheats)
- [Online game](#online-game)
- [Problems](#problems)
- [For developers](#for-developers)

---

## Install

1. Download the latest **Termina-Local-Coop-vX.Y.Z.zip** from [Releases](../../releases) and unzip it anywhere.
2. **Double-click `install.bat`.**
   - If you unzipped it **inside the game folder** (next to `Game.exe`), it installs right there.
   - Otherwise it **looks for the games itself**: Steam (all its libraries), GOG and `Games` folders on every drive. It shows a list (with the mod version already installed, if any) and asks where to install: type a number, several numbers (`1,3`) or `A` for all.
   - Not found? **Drag the game folder** (the one with `Game.exe`) onto `install.bat`.
3. Start the game as usual. On the title screen you will see **Host online** and **Join online** - that means the mod is installed.

To **update**, do the same with the new version - your saves stay as they are.

Extra options for `install.ps1` (run it with `powershell -ExecutionPolicy Bypass -File install.ps1 ...`):

| Option | What it does |
|---|---|
| `-GamePath "C:\...\game"` | Install into this folder. |
| `-QuickSave` | Also install the F6 / F7 save / load plugin (handy for testing). |
| `-NoNet` | Do not install the online part. |
| `-Uninstall` | Remove the mod. |

The installer only copies the mod's files and adds them to `www/js/plugins.js` (it keeps a backup, `plugins.js.coop.bak`). It never touches your saves.

---

## Quick start

**On one PC:**
1. Load a save. The party needs a companion for every extra player: P2 plays party member 2, P3 member 3, and so on.
2. Player 2 presses `X` on the map (or `Start` on a gamepad), chooses a character and appears next to P1.
3. P3 and P4 join the same way (`U` / `Numpad 0` on the keyboard, or `Start` on a gamepad).

**Online:** see [Online game](#online-game). In short: the host presses **Host online** on the title screen, the others press **Join online**, pick the game from the list and press **I'm ready**.

---

## Controls

| | P1 | P2 | P3 (keyboard) | Gamepad (P2 / P3 / P4) |
|---|---|---|---|---|
| Join | - | `X` on the map (`Enter` once co-op is on) | `U` / `Numpad 0` | `Start` |
| Move | `W A S D` | Arrows | `Numpad 8 4 5 6` or `I J K L` | D-pad / left stick |
| Run / shoot | Left Shift | Right Shift | `Numpad +` or `H` | `X` or `RT` |
| OK / interact | `Z` / `Space` | `Enter` | `Numpad 0` / `Numpad Enter` or `U` | `A` |
| Cancel / own menu | `X` / `Esc` | `Backspace` | `Numpad .` or `O` | `B` |
| Camera | `G` (anyone): auto / shared / split / P1..P4 | | | `Back` / `Select` |
| Split screen zoom | `-` / `=` | | | |
| Player windows | `F9` | | | |

Numpad keys work with NumLock on or off. In the online game each PC has only one player, who can use **any** of these keys (WASD or arrows, Z / Space / Enter, X / Esc / Backspace, Shift) or a gamepad.

---

## How co-op works

- **Your own character.** Player N plays party member N. Characters that nobody plays follow P1 like normal companions; in battle a player of the host's choice or the AI plays them.
- **Camera.** While everybody fits on the screen, the camera is shared. When someone walks away, the screen splits (2 halves, 3 views or 2x2) and joins again when you regroup. `G` switches the camera by hand.
- **Events know who started them.** If P2 talks to someone, opens a chest, solves a puzzle, steps on a trap or uses an item from their menu, the game treats **P2** as the hero: it happens where P2 stands and P2 picks the answers.
- **Own menu.** P2-P4 open the game menu for themselves: Skill / Equip / Status go straight to their character. Options, Save, Game End and Formation stay with P1.
- **Battles.** Everybody takes the turns of their own character; at the top you see whose turn it is.
- **Scenes.** If a scene moves P1 far away, P2-P4 follow. Short steps (a door, a push) don't drag them along. If somebody ends up inside a wall, they are put back next to P1.
- **A player who left.** If a gamepad gets unplugged (or the host marks the player as away), the AI fights for that character and it follows P1 on the map. Any button of that player brings them back.
- **Saving.** A save remembers who played and with which gamepad; after loading everybody is back by themselves.
- **Fear & Hunger 1.** P2-P4 can shoot with a bow (Short bow / Cursed short bow + arrows) like P1. The character list has the four classes and the companions you can hire (Le'garde, Moonless, Nas'hrah).
- **Termina.** P2-P4 can shoot on the map (gun equipped + run key), enemies go after the nearest player. Every player keeps their character when the game rearranges the party; in the solo parts of the story the others wait and come back by themselves.
- **Player windows (F9, experimental).** One window per player with only their view - to put each one on a different monitor.

---

## Death and soul stones

Only **the death of P1 ends the game**. When another character dies:

- **Their body stays where they died** (in Fear & Hunger 1 it is the game's own corpse). It stays there even if you leave the map and come back.
- **That player waits.** The host can give them a free character in the Co-op menu (`< Pn >`), or they wait for a new companion. Online, while they wait, their screen **shows the battle going on** (P1's first), with its music.
- **Bringing them back:** any player with a **filled soul stone** (*Lesser soul* in Fear & Hunger 1, *Soul stone* in Termina) stands at the body and presses OK - *bring them back?* The stone is used up, the character comes back with 30% of HP and mind, and the one who did it loses 30% of their mind. Both numbers can be changed in the settings.
- In Fear & Hunger 1, without a filled stone the game's own options for the body stay (for example catching the soul with an empty stone).

Settings for this (Co-op settings):
- **Revive with soul stones: Off** - death is for good: there is no body to revive; the player waits for a free character or a new companion.
- **When P2-P4 die: Game over** - the original rule: the death of any player ends the game.

---

## Torches, light and NPCs

- **Everybody has their own torch.** A torch lit from a player's menu is theirs: it lights up around their character, they hold it in their hand (Fear & Hunger 1) and it burns down on its own timer. P1's torch is the game's, as before. When one goes out, the others keep burning.
- **Light around everybody.** The light the game keeps around the hero (and Termina's circle of sight) is around every player, not only P1. Online, each PC shows it around its own character.
- **No double NPCs.** If a player picks a character in the mod who also lives somewhere in the world as an NPC (Cahara in his cell, Marina waiting on the train...), that NPC disappears while the player plays the character. The mod uses the game's own "already in the party" pages, so the story does not think you hired them. If the player gives the character up, the NPC comes back. Setting: *Played characters' NPCs: Hidden / Shown*.

---

## Players against each other (PvP, Termina)

Only in Termina, and only if the host turns it on: setting **PvP (Termina)** - *Off*, *On - not to the death* or *On - to the death*.

- **How to attack:** stand right next to another player (on any side, also diagonally) and press OK - *Attack Marina (P2)?* - **Attack**. The other player is not asked: they are pulled into the battle at once. (If you are facing someone to talk to or a chest, OK does that instead.)
- **From behind:** if the other player is looking away from you, they **lose their first turn**.
- **Attack everyone:** with three or more players the question also has *Attack everyone* - every player with a living character (not in another battle) is pulled into one fight, each on their own. Everybody sees all the others as enemies and only themselves in the party; whoever falls leaves the fight; it ends when one is left. With several enemies they stand side by side, smaller.
- **Joining a fight (online):** press OK next to players who are fighting each other - *Help P1 (Marcoh) / Help P2 (Abella) / Attack everyone / Leave*. You join at the next turn, on that side (or on your own).
- **The battle:** both players fight each other. Each one sees **the other player's character as an enemy**, the way Termina shows that contestant in a fight - their own picture with body parts (torso, head, arms, legs) - and in their party only their own character. Each player takes their own turns: chooses their skills or weapon and which body part of the other one to hit. The enemy has the HP and stats of that player's character, and what you do to it you do to them.
- On one PC (local co-op) the screen shows the enemy of whoever is choosing right now.
- **HP:** the enemy has the HP of that contestant in the game (e.g. Abella's torso: 2500), and each hit takes the same **share** of the real character's HP (250 of 2500 = 10%). So a fight lasts several turns, like a fight against that contestant. *PvP damage* (x1 / x0.5 / x0.25 / x2) changes it.
- **Body parts:**
  - **a leg cut off** - the head of that player is easy to hit (normally it dodges most attacks);
  - **an arm cut off** - that player hits only half as hard; **both arms** - almost no damage;
  - **the head** - death (or the end of the fight when not to the death);
  - the limb is lost the same way as in a normal Termina fight: the character's battle picture changes, they bleed, with no arms they drop the weapon; everybody sees a message. Limbs already lost before the fight are missing from the start (on the enemy and on the character).
- **Not to the death:** whoever reaches 0 HP stays with 1 HP, and the battle ends. Limbs cut off in the fight **come back** after it.
- **To the death:** the loser dies by the normal rules - a body that can be brought back with a soul stone (unless *Revive* is off); cut limbs stay.
- **Killing the protagonist (P1):** **the killer becomes the protagonist** (in a fight of several sides: the main player of the side whose hit finished P1, even if a helper or a companion hit) - their character goes first in the party and the story now treats them as the protagonist. **Online** the killer's PC plays P1 from then on and the dead one's PC plays the killer's old number (the host stays the host: rules, saving); this is kept in the save. **On one PC** the screen tells the players to swap places (P1's controls go to the killer). The old protagonist is now a dead companion: their body stays, their player waits (a free character from the Co-op menu, or watching the battles), and a soul stone brings them back - as a companion, not as the protagonist. If the killer's character can't be a protagonist in Termina (only the 7 playable contestants and O'saa can), it is game over.
- **Running away:** the *Run* skill ends the fight for both; everybody goes back to the map as they are (HP, states).
- No experience or money for these fights.
- Online it works with both *Together* and *Separate* battles; in a separate battle the attacked player joins the attacker's battle.

---

## The Co-op menu

In P1's game menu, **Co-op**:
- **Who plays each extra character in battle** - P1..P4 or the AI.
- On a player's main character: **mark them away** or **take the character** (the player leaves, the character becomes a normal companion).
- **`< Pn >`** - give a free character to a player who is waiting (for example after their death).
- With *Cheats* on: **get a soul stone**, **restore HP, mind and hunger** of the whole party, **get torches and fire**.

**Online** in the same menu (and **Host online / Join online** on the title screen) opens the online game menu.

---

## Settings

In the game: **Options > Co-op > Co-op settings...** They are saved like the volume and work in every save.

**Controls and screen:**

| Setting | What it does |
|---|---|
| *Local co-op* | Off: arrows, Enter, numpad and gamepads are normal P1 keys again. |
| *Camera* | Auto (shared while together, split when apart), always shared, or always split. `G` also switches it during play. |
| *Split screen view* | How far each split view sees (far / medium / near). |
| *Split with 2 players* | Side by side or one above the other. |
| *Split with 3 players* | 2 views on top + 1 below, 2x2 with a party panel, or P1 on half the screen. |
| *Gamepads for P2-P4* | Off: every gamepad controls P1. |
| *P3 keyboard* | Numpad, IJKL or both. |
| *Rejoin after loading* | Players come back by themselves after loading a save. |
| *Check for updates* | A note on the title screen when a new version is out. |

**Rules** (online, the **host's** rules count for everybody):

| Setting | Default | What it does |
|---|---|---|
| *When P2-P4 die* | The party goes on | Only the death of P1 ends the game. *Game over* = the original rule. |
| *Keep players' characters* | On | If the story removes the character of P2-P4 from the party, it stays (the solo parts of the story still work). |
| *Revive with soul stones* | On | Off: death is for good, there is no body to revive. |
| *Revived with* | 30% | HP and mind of a character brought back. |
| *Mind cost of reviving* | 30% | How much mind the one who revives loses. |
| *Played characters' NPCs* | Hidden | Hidden: a played character is not also an NPC on the map. Shown: as in the game. |
| *PvP (Termina)* | Off | Players can attack each other (OK next to another player). Not to the death / to the death. |
| *PvP damage* | x1 | Damage in PvP fights: x1, x0.5, x0.25 or x2. |
| *Cheats* | On | Allows F6 / F7 anywhere and the cheats below. |

---

## Cheats

For testing. They need *Cheats: On*; online, the host's choice counts.

| Cheat | Where | What it does |
|---|---|---|
| F6 / F7 | keys | Save / load anywhere (with the quick save plugin, `-QuickSave`). Shift+F6 / Shift+F7 = instantly, slot 99. |
| Get a soul stone | Co-op menu | One soul stone. |
| Restore HP, mind and hunger | Co-op menu | For the whole party. |
| Get torches and fire | Co-op menu | 3 torches + Tinderbox / Matches / Lighter. |
| *Contestants left: N* | Co-op menu (Termina) | Shows how many contestants are still alive. The tower door (ending B) opens only at 1, with nobody else in the party. |
| Kill all contestants not in the party | Co-op menu (Termina) | Every contestant not in your party (and not a player's character) dies the way the game records it: gone from the map, their soul can be taken, the count goes down. **Cannot be undone - use a separate save slot.** |
| Teleport to the tower door | Co-op menu (Termina) | When you close the menu, everybody is moved in front of the stone door of the tower (Temple site). |
| Immortal party | Co-op settings | Never below 1 HP, nothing kills the party outright. |
| Keep limbs | Co-op settings | Arms, legs and head are never cut off. |
| One-hit kills | Co-op settings | Any damage the party deals kills the enemy (or the enemy part). |
| Open locks | Co-op settings | Doors, chests and cells that need a key or a lockpick open as if you had it. |

---

## Online game

Experimental. Every player needs the game and **the same version of the mod** (the game checks this when someone connects).

**Short version:**
1. **Host:** on the title screen press **Host online** and pick a save. The game is now open for others (the screen shows your IP).
2. **Others:** press **Join online**. The mod searches your network for games: pick the host's game in **Games found** (or type the host's IP) and press **Connect to the host**.
3. Everybody presses **I'm ready**. When all are ready, the game starts by itself after 3 seconds (the host can also press **Start now**). Everybody plays in the host's world, each with the camera on their own character.

**Good to know:**
- **Over the internet**, the easiest way is a virtual network like **Radmin VPN** or **ZeroTier** (free): everybody joins the same network and types the host's VPN address. Or forward TCP port 47810 on the host's router.
- **Menus don't pause the game** - the others keep playing while you are in your menu.
- **Battles**: *Together* (everybody fights, like on one PC) or *Separate* (only who an enemy touches; the others keep walking and can join by pressing OK next to a fighter). Several separate battles can run at once - P1 with one enemy, P2 with another.
- While somebody fights a separate battle on the map, nobody can leave the map, sleep or save (otherwise the transfer would take the fighters along).
- **Nobody gets kicked for lagging.** If someone's game stops for a moment (minimized, loading), the others go on and that game catches up. A player who loses the host goes back to the title and reconnects by themselves.
- The host can change **PvP**, **Revive**, **Cheats** and **Played chars' NPCs** right in the online menu, also during the game.
- You can **bring your own character** from one of your saves, and set a **password**.
- In the online game only the keyboard and gamepads work (no mouse). F6 / F7 work on the host only.

Full guide: **[docs/NETPLAY.md](docs/NETPLAY.md)** ([по-русски](docs/NETPLAY.ru.md)) - also in the release ZIP.

---

## Problems

| Problem | What to do |
|---|---|
| The installer doesn't find the game | Drag the game folder (with `Game.exe`) onto `install.bat`. |
| No "Host online" on the title screen | The mod is not installed in this copy of the game - run the installer again. |
| Online: "Different mod version" / "Different game version" | Update everybody to the same version of the mod and of the game. |
| Online: the game is not in "Games found" | Type the host's IP by hand. Some VPNs (Hamachi) and routers block the search. |
| Online: can't connect over the internet | Use Radmin VPN / ZeroTier, or check the port forwarding (TCP 47810) and the Windows firewall. |
| Online: "PCs out of sync" | The game fixes it by itself at the next quiet moment. If it keeps happening, send the `www/coop_net_desync.log` file from every PC. |
| Something broke online | Send `www/coop_net_error.log` and `www/coop_net_battle.log` from every PC. |
| The game crashed (*Game has encountered a bug*) | The mod writes what happened and where to `www/coop_crash.log` (no screenshot needed) - send that file. |
| Two copies on one PC are slow | Normal: they share the graphics card. With separate PCs it is smooth. |

Report bugs on the [Issues](../../issues) page. A checklist of things to test: [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md).

---

## For developers

**Plugins** (`plugins/`):
- `LookOutsideOnline.js` - the base: up to 4 players, controls, camera, split screen, menus, battle turns, character picker, settings.
- `LocalCoop_FearHunger.js` - Fear & Hunger 1 / Termina: light, shooting, death and soul stones, torches, NPC hiding, cheats.
- `LocalCoop_Net.js` - the online game (lockstep: only the keys travel over the network, every PC computes the same world).
- `LocalCoop_QuickSave.js` - F6 / F7 (testing).

**Parameters** of `LookOutsideOnline` (in `www/js/plugins.js`, e.g. `"parameters": {"MaxPlayers": "3"}`) - the defaults for the settings above:

| Parameter | Default | |
|---|---|---|
| `MaxPlayers` | 4 | 2, 3 or 4. |
| `P3Keys` | all | `all` = numpad and IJKL, `numpad`, `ijkl`. |
| `Gamepads` | true | `false` = gamepads always control P1. |
| `AutoRejoin` | true | Players rejoin after loading. |
| `DefaultCameraMode` | auto | `auto`, `shared`, `split`, `p1`..`p4`. |
| `SplitDirection` | vertical | 2 players: `vertical` = side by side, `horizontal` = stacked. |
| `Split3Layout` | triangle | 3 players: `triangle`, `grid` (2x2 with a party panel), `big` (P1 half screen). |
| `SplitZoom` | far | `far`, `medium`, `near`. |
| `P2ActorMode` / `P2ActorChoices` | auto / all | Character picker (see the plugin help). |
| `P2MoveSpeed` / `P2DashBonus` | 0 / 1 | Speed of P2-P4 (0 = same as P1). |

**Tests** (`tests/`) run the real RPG Maker engine of your installed game in V8 (graphics stubbed):

```
pip install mini-racer
set TERMINA_GAME=C:\Games\Fear2\www
python tests/run.py            # ~180 co-op scenarios (set WITH_NET=1 to load the online plugin too)
python tests/netharness.py     # ~95 online scenarios: 2-3 engines with fake sockets
```

Fear & Hunger 1: `set TERMINA_GAME=C:\Games\Fear1\www` and `set TEST_MAP=1`. Drawing (split screen, light, windows) is not covered - check that in the game.

**Release:** `tools/make_release.ps1` builds `dist/Termina-Local-Coop-v<version>.zip` (the version is `COOP_VERSION` in `LookOutsideOnline.js`). Changes: [CHANGELOG.md](CHANGELOG.md). Plans: [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT (see [LICENSE](LICENSE)). The mod contains no game files: you need your own copy of Fear & Hunger 2: Termina and/or Fear & Hunger 1.
