# Network game (prototype, branch `netplay`)

Every player runs **their own copy of the game** on their own PC. Only the inputs travel over the network: every frame all PCs get the actions of all players and compute exactly the same frame, each with the camera on its own player. The host (P1) collects the inputs and hands out the frames.

Plugin: `plugins/LocalCoop_Net.js`. Nothing connects when the game opens: everything is done from the menu.

## Install

```
install.ps1 -GamePath "C:\Games\Fear2" -QuickSave -Net menu
```

`-Net host` / `-Net join -NetHost 192.168.1.20` (`-NetPort`) only preselect the mode, IP and port in the menu (saved in `www/coop_net.json`).

## Play

Everything is in **Options > Co-op > Network game...**

1. **Host**: load a save, open the menu, Mode = *Host*, **Open the game for other players**. The screen shows your IP. The party needs a companion for every guest (P2 controls party member 2, etc.).
2. **Guests** (the title screen is enough): Mode = *Join*, *Host's IP* (OK, type the digits and dots, Enter), **Connect to the host**. The host's screen lists them.
3. **Host**: **Start the network game**. Everybody loads the host's game.
4. On every PC: WASD or arrows, Z / Space / Enter, X / Esc / Backspace, Shift, or a gamepad (A, B, X / RT). `G`, `-` / `=` and `F10` stay local.

*Close the game (stop hosting)* / *Disconnect* on the same screen end it. Port: default 47810 (Windows asks to allow it in the firewall the first time).

During the network game F6 / F7 (quick save), F9 (player windows) and F5 (reload) are disabled.

**F10** shows the network status next to the FPS: host — ping of every guest; guest — ping to the host; *buffer* = frames received and waiting (0 for a long time = the network is the bottleneck).

## Menus

A menu still pauses the game for everybody (as in local co-op), but **only the player who opened it sees it**; the others see the map and *P2 is in their menu...*. If that player disconnects, P1 gets control of the menu and can close it.

## Joining, leaving, coming back

- **Disconnect** (or the game closed / crashed): the game goes on for the others; that player's character is *away* (AI in battle, follows P1 on the map). A guest whose game freezes is dropped after 5 s, so the host never hangs.
- **Reconnect / join mid-game**: the guest connects from the menu as at the start. The host waits for the next quiet moment (on the map, no event, dialogue or menu) and sends its world to everybody, like a save; the player gets their character back (a new guest gets the next free number, up to P4).
- **Out of sync**: if the fingerprints differ, the host shows *PCs out of sync* and at the next quiet moment sends its world to everybody (*Back in sync*). Details go to `www/coop_net_desync.log` on both PCs.
- Errors of the network game are written to `www/coop_net_error.log`.

## Two copies on one PC

1. Copy the whole game folder (e.g. `C:\Games\Fear2-net2`).
2. In the copy's `package.json` change `"name": ""` to `"name": "termina-net2"` and add `"single-instance": false` (otherwise Windows opens the first copy again instead of a second one).
3. Install both with `-Net menu`; in the copy join `127.0.0.1`.

## How it stays in sync

- The game's randomness (`Math.random`) comes from a seed shared at start; drawing-only code (sprites, light, weather) uses its own random numbers because each PC draws a different part of the map.
- 60 game steps per second by the clock (FluidTimestep is bypassed); the clock (`Date`) and the frame counter are shared during each step.
- A new scene (map, battle, menu) only starts when every PC has loaded it.
- Animations and message faces don't wait for their images (load speed differs per PC).
- Events move "near any player" instead of "near this PC's camera".
- Every 60 frames the PCs compare a fingerprint of the world (scene, players, events, party, switches, variables, random state); a difference triggers a resync (above).

Tests:
- `tests/netsync.py` runs two independent copies of the engine with the same start and inputs and checks they end identical (1200 frames on Shopping street: in sync).
- `tests/netharness.py` runs host + guests (up to 3 engines) with fake sockets: nothing connects by itself, start from the menu, walking, a forced desync and its fix, a menu seen only by its owner, unplugging a guest with its menu open (AI takes over, P1 closes the menu), a guest restarting its game and coming back, a frozen guest dropped, a third PC joining mid-game (31 checks).

## Known limits of the prototype

- If the **host** disconnects, the game stops for the guests (they keep reconnecting and wait for the host to start again).
- A resync or a join waits for a quiet moment: during a long cutscene or a battle it happens after it.
- LAN only for now (fixed input delay of 3 frames); internet play needs adaptive delay.
- One player per PC.
