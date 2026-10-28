# Online game (experimental)

Every player plays on **their own PC with their own copy of the game**. Only the key presses travel over the network: every PC gets the keys of all players and computes exactly the same world. The host (P1) collects the keys and sends them out. Each PC shows the world with the camera on its own player.

[Русская версия](NETPLAY.ru.md)

---

## Before you start

- Every player needs **the game** and **the same version of the mod**. The normal installer (`install.bat`) puts the online part in too.
- Same game version too. When someone connects, the host checks the mod version, the game version and the active plugins. If something differs, the guest sees what (e.g. *Different game version*) and is not let in.
- The host's party needs a companion for every guest: P2 plays party member 2, P3 member 3, and so on. A guest can also bring their own character (see below).
- Windows asks to allow the game in the firewall the first time - press **Allow** (also for "public networks": VPN networks often count as public).

Nothing connects by itself when the game starts: everything is done from the menu.

---

## Playing: step by step

### 1. The host opens the game

On the title screen press **Host online** and pick a save. Once it is loaded, the game is open for the others, and the screen shows your IP.

(Or later: game menu > **Online**, or *Options > Co-op > Network game...*, Mode = **Host**, **Open the game for other players**.)

### 2. The others connect

On the title screen press **Join online**. The network menu opens:
- **Games found** - the mod looks for open games on all your networks every few seconds (left / right to choose, OK to search again). Pick the host's game.
- If it is not in the list (some VPNs like Hamachi and some routers block the search), type the IP in **Host's IP**: OK, type the IP or a name, Enter.
- **Connect to the host**. The host's screen shows who connected.

### 3. Lobby

Every guest presses **I'm ready** (press again to cancel). Everybody sees the list, like *P1 Levi (host) - P2 Marina, ready - P3 waiting*. When all connected guests are ready, a 3-second countdown starts and the game begins by itself. The host can also press **Start now** without waiting.

Everybody now plays in the host's world.

### 4. Playing

On every PC you can use WASD or the arrows, Z / Space / Enter (OK), X / Esc / Backspace (cancel, menu), Shift (run), or a gamepad (A, B, X / RT). There is one player per PC, so all these keys are yours.

**Close the game (stop hosting)** / **Disconnect** in the same menu end the online game.

---

## The network menu

*Options > Co-op > Network game...* (or **Online** in the game menu, or the title screen buttons):

| Row | What it does |
|---|---|
| **Mode** | *Host* (you are P1) or *Join a host*. |
| **Games found** | Open games on your networks (guest). |
| **Host's IP** | The host's address, typed by hand (guest). Letters work too, e.g. a DDNS name. |
| **Port** | 47810 by default. Change only if you know why. |
| **Password** | Optional. If the host sets one, guests must type the same. |
| **Bring character** | A guest can play the main character of one of their own saves (see below). |
| **Input delay** | *Auto* (recommended) or a fixed number of frames (see below). |
| **Battles** | *Together* or *Separate* (see below). The host's choice counts; set it before starting. |
| **Revive (soul stones)** | On / Off - can dead players be brought back. The host's choice; can be changed during the game. |
| **Played chars' NPCs** | Hidden / Shown - is a character a player plays also standing around as an NPC. The host's choice; can be changed during the game. |
| **Cheats** | On / Off. The host's choice; can be changed during the game. |
| **Ping on screen** | Show every player's ping at the top right (green / yellow / red). |

When the host changes *Revive*, *Played chars' NPCs* or *Cheats* during the game, everybody sees a message.

---

## Bring your own character

A guest can choose one of their **own saves** in **Bring character**. Its main character (level, stats, skills, equipment worn - not the bag) joins the host's party and the guest plays it.

- Make a save with a new character first (Termina: after the train / backstory; Fear & Hunger 1: after choosing the class).
- It does not work if the host's party already has 4 members or someone else plays that character - then the guest plays a companion.
- If the character is already in the host's party (the guest played it before), the guest just gets it back as it is in the host's world.

---

## What is different from playing on one PC

**Menus don't pause the game.** When you open your menu, the world and the others go on; your character stands still. Several players can be in their menus at once. *Load* and *Game End* are not in the menu during an online game. Menus opened by events (shops...) still pause everybody.

**Options.** Game options (*Always Dash*, *Command Remember*, battle speed...) are the host's on every PC. Volume, keys and camera are each player's own. A guest's own options come back when the online game ends.

**Co-op rules** (*Co-op settings*: death, revive, cheats, NPCs) are the host's too.

**Keys:** keyboard and gamepads only - no mouse. `G`, `-` / `=` and `F10` work only on your own PC. **F6 / F7** (quick save plugin) work only on the host: F6 = save screen (everybody sees it as the host's menu; guests keep a copy of the save), Shift+F6 = slot 99; F7 / Shift+F7 = everybody goes to the title for a moment, the host loads, and the game starts again by itself. F9 (player windows) and F5 (reload) are off.

---

## Battles

*Battles* row in the network menu:

- **Together** (default) - everybody fights, like on one PC.
- **Separate** (experimental) - a battle is only for the player an enemy touched (or who touched it): their character and the companions they control fight; everybody else stays on the map and keeps walking. Only the fighters see the battle and hear its music.

With **Separate**:
- **Joining a battle:** stand next to a fighting player (any of the 8 tiles around them) and press OK - or touch **that same** enemy. You enter at the start of the next turn.
- **Several battles at once:** a player who touches **another** enemy gets their own battle with it, at the same time. Each PC shows the battle of its own player.
- Enemies on the map don't chase or touch players who are already fighting.
- During a battle the others can still talk, open chests and use items.
- **Nobody leaves while somebody fights:** doors and other transfers, beds (sleeping), save points, F6 and *Save* in the menu are refused until the battle ends - a message says who is fighting. (A transfer would take the fighters along too.)
- A separate battle lost without P1 counts as an escape for the event that started it - the protagonist's defeat scenes (capture, blood pit...) don't play for everybody. The fighters stay dead as bodies.
- If every player of a battle disconnects, that battle ends at once as an escape.
- Battles without a player (cutscenes, story battles) are for everybody, as before.

---

## Disconnects, lag, coming back

- **Nobody gets kicked for lagging.** If a player's game stops for a moment (minimized, loading, busy), the others don't wait more than half a second: the game goes on without that player's keys. When their game comes back, it quickly catches up and plays on in the same world.
- **A player leaves** (closes the game, loses the connection): the game goes on for the others; their character becomes a normal companion following P1. In a battle, the host plays it until the battle ends (in a separate battle, the next player in it).
- **A guest loses the host:** it goes back to the title (its copy of the world does not go on alone) and keeps trying to reconnect by itself.
- **Coming back / joining later:** connect from the menu as at the start. The host waits for a quiet moment (on the map, no event, dialogue, menu or battle) and sends its world to everybody, like a save. The player gets their character back; a new player gets the next free number (up to P4).
- **"PCs out of sync":** the PCs compare their worlds every second. If they differ, the host sends its world to everybody at the next quiet moment (*Back in sync*). Details go to `www/coop_net_desync.log` on every PC.
- Errors of the online game go to `www/coop_net_error.log`, the separate battles to `www/coop_net_battle.log`. Send these files if something goes wrong.

---

## Over the internet

The game works the same; the only question is how the others reach the host's PC.

### The easiest: a virtual network (Radmin VPN, ZeroTier, Hamachi)

Nothing to set up on the router.

1. Everybody installs the same program, e.g. **Radmin VPN** (free). The host creates a network (name + password), the others join it.
2. The program shows each PC's address in that network (Radmin: `26.x.x.x`).
3. In the game the host opens it as usual; the others type **the host's VPN address** in *Host's IP* (or find it in *Games found*).
4. Windows firewall: allow the game when it asks.

### Without a VPN: forward the port

1. On the host's router: forward **TCP port 47810** to the host PC (its local IP is shown in the game's network menu).
2. Windows firewall on the host: allow the game (or TCP 47810).
3. The others type the host's **public IP** (e.g. from whatismyip.com) or a DDNS name.
4. If the internet provider uses CGNAT (the router's "WAN IP" is not the same as the public IP), port forwarding can't work - use a VPN.

### Input delay

Every key press travels to the host and back, so the game sends keys a few frames ahead. *Input delay* in the network menu:
- **Auto** (default, recommended): each PC measures its ping and chooses the delay by itself (at least 3 frames, at most 20). It changes during play without any hiccup.
- **2-15 frames**: fixed. Lower = more responsive, but if it is too low for the ping, the game runs in slow motion.

Roughly: ping 30 ms -> 4 frames, ping 100 ms -> 8, ping 200 ms -> 14 (1 frame = 17 ms). With a ping over ~250 ms the game becomes hard to play. **F10** shows the ping and the current delay next to the FPS.

---

## Two copies on one PC (for testing)

1. Copy the whole game folder (e.g. `C:\Games\Fear2-net2`).
2. In the copy's `package.json` change `"name": ""` to `"name": "termina-net2"` and add `"single-instance": false` (otherwise Windows opens the first copy again).
3. Install the mod in both. In each copy set *Co-op settings > Local co-op: Off* (so the keyboard doesn't control two players). In the copy, join `127.0.0.1`.

Two copies on one PC share the graphics card, so they run slower than one. On separate PCs it is smooth.

---

## Known limits

- If the host leaves, the game stops for everybody (the guests go to the title and wait for the host to open the game again).
- A resync or a player joining waits for a quiet moment: during a long cutscene or a battle, it happens after it.
- No relay server: over the internet use a VPN or port forwarding.
- One player per PC.

---

## For developers: how it stays in sync

- The game's random numbers come from a shared seed; drawing-only code (sprites, light, weather) uses its own random numbers, because every PC draws a different part of the map.
- 60 game steps per second by the clock; the clock (`Date`) and the frame counter are shared during each step.
- A new scene (map, battle) starts only when every PC has loaded it.
- Animations and message faces don't wait for their images (loading speed differs per PC).
- Events move "near any player" instead of "near this PC's camera".
- Every second the PCs compare a fingerprint of the world (scene, players, events, party, switches, variables, random state); a difference starts a resync.
- Separate battles each keep their own troop, battle state and view of the switches / variables, so two battles at once don't disturb each other.

Tests: `tests/netharness.py` runs a host and 1-2 guests (separate engines) with fake sockets: starting from the menu, walking, a forced desync and its fix, menus that don't pause, unplugging a guest, a guest coming back, a frozen guest that catches up, a third PC joining mid-game, a 200 ms ping, and more (~95 checks). `tests/netsync.py` checks that two engines with the same start and keys end up identical.
