# Network game (experimental, v1.8)

Every player runs **their own copy of the game** on their own PC. Only the inputs travel over the network: every frame all PCs get the actions of all players and compute exactly the same frame, each with the camera on its own player. The host (P1) collects the inputs and hands out the frames.

Plugin: `plugins/LocalCoop_Net.js`. Nothing connects when the game opens: everything is done from the menu.

## Install

The normal installer (`install.bat` / `install.ps1`) already installs it, on every PC; without using it, it does nothing.

`-Net host` / `-Net join -NetHost 192.168.1.20` (`-NetPort`) only preselect the mode, IP and port in the menu (saved in `www/coop_net.json`). `-NoNet` leaves it out.

## Play

Everything is in **Options > Co-op > Network game...** Shortcuts: **Host online** / **Join online** on the title screen (Host online: pick a save, and once loaded the game is open; Join online: the network menu on the list of games found) and **Online** in P1's game menu.

1. **Host**: load a save, open the menu, Mode = *Host*, **Open the game for other players**. The screen shows your IP. The party needs a companion for every guest (P2 controls party member 2, etc.).
2. **Guests** (the title screen is enough): Mode = *Join*, then either pick the game in **Games found** (left / right: the menu looks for open games on your networks every few seconds, OK searches again) or type it in *Host's IP* (OK, type the IP or a name, Enter); then **Connect to the host**. The host's screen lists them.
   - *Games found* asks on UDP port 47811 on every network of the PC (LAN, Radmin VPN, ZeroTier...) and on the PC itself. If the host isn't listed (some VPNs or routers block it, e.g. Hamachi), type the IP.
   - *Password* (optional): if the host sets one, guests must type the same.
   - *Bring character* (optional): one of the guest's own saves. Its main character (level, stats, skills, equipment worn - not the bag) joins the host's party and the guest plays it. Make a save with a new character first (Termina: the train / backstory; Fear & Hunger 1: the class choice). Not possible if the host's party already has 4 members or someone else plays that character - then the guest plays a companion. If the character is already in the host's party (the guest played it before), the guest simply gets it back as it is in the host's world.
   - When someone connects, the host checks the mod version, the game version and the active plugins: if they differ the guest is told what (e.g. *Different game version*) and not let in.
   - The ping of every player is shown at the top right of the screen (green / yellow / red) and in the lobby list; *Ping on screen* turns it off.
3. **Lobby**: each guest presses **I'm ready** (same line, again to cancel). Everybody sees the list (*P1 Levi (host)  P2 Marina - ready  P3 - waiting*); when every connected guest is ready, a 3-second countdown starts and the game begins by itself. The host can also press **Start now** without waiting. Everybody loads the host's game.
4. On every PC: WASD or arrows (a gamepad only counts in the focused window, so two copies on one PC don't share it; *Options > Co-op > Co-op settings > Local co-op: Off* is handy for testing), Z / Space / Enter, X / Esc / Backspace, Shift, or a gamepad (A, B, X / RT). `G`, `-` / `=` and `F10` stay local.

*Close the game (stop hosting)* / *Disconnect* on the same screen end it. Port: default 47810 (Windows asks to allow it in the firewall the first time).

During the network game F6 / F7 (quick save plugin) work on the host only: F6 = save screen (everybody sees it as the host's menu; guests keep a copy of the save), Shift+F6 = slot 99; F7 / Shift+F7 = everybody goes to the title for a moment, the host loads and the network game starts again by itself. F9 (player windows) and F5 (reload) are disabled.

**F10** shows the network status next to the FPS: host — ping of every guest; guest — ping to the host; *delay* = input delay in frames; *buffer* = frames received and waiting (0 for a long time = the network is the bottleneck).

## Menus

A player's menu **does not pause the game**: the world and the other players go on. The menu player sees their menu as usual; their character stands still. Several players can be in their menus at once. Skill / Equip / Status: the host picks any party member; P2-P4 their own character and the companions they control in battle. Menus close when a battle starts. *Load* and *Game End* are not in the menu during a network game.

(How: each menu is a scene of its own that runs inside the map on every PC, with that player's keys; only that player's PC draws it.)

Menus opened by events (shops...) still pause everybody.

## Separate battles (experimental)

*Options > Co-op > Network game > Battles*: **Together** (default, as in local co-op) or **Separate**. The host's choice counts; set it before starting.

With *Separate*, a battle that a player starts (an enemy touches them, or they touch it) is only theirs: their character and the companions they control in battle fight; everybody else stays on the map and keeps walking. Only the fighters see the battle (and hear its music).
- Enemies on the map don't chase or touch players who are in a battle.
- **Joining**: stand next to the fighting player's character (any of the 8 tiles around it) and press OK (Z / Space / Enter / A) - or touch an enemy / let one touch you. You enter at the start of the next turn.
- While a battle is on, the others can still talk, open chests and use items on the map (doors, beds and saving wait - see below).
- **Several battles at once**: a player who touches (or is touched by) another enemy gets their own battle with it, at the same time as the others. Touching the enemy somebody is already fighting joins that battle. Each PC shows the battle of its own player.
- **Nobody leaves while somebody fights**: doors and other transfers, beds (sleeping), save points, F6 and *Save* in the menu are refused until the battle ends (a message says who is fighting). The transfer would take the fighters along too - and that was a way to run from any battle.
- A separate battle lost without P1 ends for the map event like an escape (the protagonist's defeat scenes - guards, blood pit... - don't play for everybody); the fighters stay dead as bodies.
- Battles without a player (cutscenes, common events) are for everybody, as before.


The co-op rules (*Co-op settings*: death rule, revive, cheats, *Played characters' NPCs*) are the host's too. The network menu has rows for **Cheats** and **Played chars' NPCs**: the host changes them before or during the game, for everybody.

Options that change the game (*Always Dash*, *Command Remember*, battle speed...) are the host's on every PC; volume, keys and camera stay each player's own. A guest's own settings come back when the network game ends (they are not overwritten on disk).

## Joining, leaving, coming back

- **Disconnect** (or the game closed / crashed): the game goes on for the others; that player's character goes back into the party as a normal follower (in a battle, the host commands it until the battle ends - in a separate battle, the next player fighting in it). A guest whose game freezes is dropped after 5 s, so the host never hangs.
- **Reconnect / join mid-game**: the guest connects from the menu as at the start. The host waits for the next quiet moment (on the map, no event, dialogue or menu) and sends its world to everybody, like a save; the player gets their character back (a new guest gets the next free number, up to P4).
- **Out of sync**: if the fingerprints differ, the host shows *PCs out of sync* and at the next quiet moment sends its world to everybody (*Back in sync*). Details go to `www/coop_net_desync.log` on both PCs.
- Errors of the network game are written to `www/coop_net_error.log`.

## Over the internet

The game itself works the same; the only question is how the guests reach the host's PC.

### Easiest: a virtual LAN (Radmin VPN, ZeroTier, Hamachi)

Nothing to configure on the router.

1. Everybody installs the same program, e.g. **Radmin VPN** (free): the host creates a network (name + password), the others join it.
2. The program shows each PC's address in that network (Radmin: `26.x.x.x`; ZeroTier: what you set up).
3. In the game the host opens it as usual; guests type **the host's VPN address** as *Host's IP*.
4. Windows firewall: allow the game when it asks (also for "public" networks: VPN networks often count as public).

### Without a VPN: forward the port

1. On the host's router: forward **TCP port 47810** to the host PC's LAN IP (shown in the game's network screen).
2. Windows firewall on the host: allow the game (or TCP 47810).
3. Guests type the host's **public IP** (e.g. from whatismyip.com) or a DDNS name - the IP field takes letters too.
4. If the provider uses CGNAT (the router's "WAN IP" differs from the public IP), port forwarding cannot work: use a VPN instead.

### Input delay

Every keypress travels to the host and the frame comes back, so the game needs to send keys a few frames ahead. **Options > Co-op > Network game > Input delay**:
- **Auto** (default): each PC measures its ping and picks the delay by itself (guest: round trip to the host; host: one way to the farthest guest), at least 3 frames, up to 20. It changes during play without any hiccup.
- **2-15 frames**: fixed. Lower = more responsive, but if it is too low for the ping the game runs in slow motion.

F10 shows `ping` and the current `delay` (1 frame = 17 ms). Roughly: ping 30 ms -> delay 4, ping 100 ms -> 8 on the guest, ping 200 ms -> 14. With a ping over ~250 ms the game becomes hard to play.

## Two copies on one PC

1. Copy the whole game folder (e.g. `C:\Games\Fear2-net2`).
2. In the copy's `package.json` change `"name": ""` to `"name": "termina-net2"` and add `"single-instance": false` (otherwise Windows opens the first copy again instead of a second one).
3. Install both; in the copy join `127.0.0.1`.

## How it stays in sync

- The game's randomness (`Math.random`) comes from a seed shared at start; drawing-only code (sprites, light, weather) uses its own random numbers because each PC draws a different part of the map.
- 60 game steps per second by the clock (FluidTimestep is bypassed); the clock (`Date`) and the frame counter are shared during each step.
- A new scene (map, battle) only starts when every PC has loaded it. A new map is also *set up* (player placed, events created) on the same frame everywhere, once every PC has read its file.
- Animations and message faces don't wait for their images (load speed differs per PC).
- Events move "near any player" instead of "near this PC's camera".
- Every 60 frames the PCs compare a fingerprint of the world (scene, players, events, party, switches, variables, random state); a difference triggers a resync (above).

Tests:
- `tests/netsync.py` runs two independent copies of the engine with the same start and inputs and checks they end identical (1200 frames on Shopping street: in sync).
- `tests/netharness.py` runs host + guests (up to 3 engines) with fake sockets: nothing connects by itself, start from the menu, walking, a forced desync and its fix, host options shared, menus that don't pause (P1 walks while P2 is in the menu, two menus at once, Skills and back, close and walk), unplugging a guest with its menu open (their character becomes a follower), a guest restarting its game and coming back, a frozen guest dropped, a third PC joining mid-game, the host's and P2's choice of character in menus, P1 alone after the guest left, and a 200 ms ping (adaptive delay keeps 60 FPS, a fixed 3-frame delay would not) (70 checks).

## Known limits

- If the **host** disconnects, the game stops for the guests (they keep reconnecting and wait for the host to start again).
- A resync or a join waits for a quiet moment: during a long cutscene or a battle it happens after it.
- No NAT punching or relay server: over the internet use a VPN or port forwarding (above).
- One player per PC.
