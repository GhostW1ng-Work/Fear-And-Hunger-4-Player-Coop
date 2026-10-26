# Network game (prototype, branch `netplay`)

Every player runs **their own copy of the game** on their own PC. Only the inputs travel over the network: every frame all PCs get the actions of all players and compute exactly the same frame, each with the camera on its own player. The host (P1) collects the inputs and hands out the frames.

Plugin: `plugins/LocalCoop_Net.js`. It does nothing until a mode is chosen.

## Install and set up

```
install.ps1 -GamePath "C:\Games\Fear2" -QuickSave -Net menu
```

Then in the game: **Options > Co-op > Network game...**
- *Mode*: Off / Host (I am P1) / Join a host (left / right).
- *Host's IP* (Join only): OK, type the digits and dots, Enter. The host sees its own IP on this screen.
- *Port*: default 47810 (Windows asks to allow it in the firewall the first time).
- *Save and connect*: saved to `www/coop_net.json`, takes effect at once.

The installer can also write the setting directly: `-Net host`, or `-Net join -NetHost 192.168.1.20` (`-NetPort` for the port). `127.0.0.1` is for two copies on one PC.

## Play

1. Host: load a save and stand on the map. The party needs a companion for every guest (P2 controls party member 2, etc.).
2. Guests: start the game (the title screen is enough). They connect by themselves: "Connected to the host as P2".
3. Host presses **F11**: everybody loads the host's game and the network game starts.
4. On every PC: WASD or arrows, Z / Space / Enter, X / Esc / Backspace, Shift, or a gamepad (A, B, X / RT). `G`, `-` / `=` and `F10` stay local.

During the network game F6 / F7 (quick save), F9 (player windows) and F5 (reload) are disabled.

**F10** shows the network status next to the FPS: host — ping of every guest; guest — ping to the host; *buffer* = frames received and waiting (0 for a long time = the network is the bottleneck).

## Joining, leaving, coming back

- **Disconnect**: the game goes on for the others; that player's character is *away* (AI in battle, follows P1 on the map) and the guest keeps trying to reconnect every 3 s.
- **Reconnect / join mid-game**: when a guest connects during the game, the host waits for the next quiet moment (on the map, no event or dialogue running) and sends its world to everybody, like a save; the player gets their character back (a new guest gets the next free number, up to P4).
- **Out of sync**: if the fingerprints differ, the host shows *PCs out of sync* and at the next quiet moment sends its world to everybody (*Back in sync*). Details go to `www/coop_net_desync.log` on both PCs.

## Two copies on one PC

1. Copy the whole game folder (e.g. `C:\Games\Fear2-net2`).
2. In the copy's `package.json` change `"name": ""` to `"name": "termina-net2"` and add `"single-instance": false` (otherwise Windows opens the first copy again instead of a second one).
3. Install: original with `-Net host`, copy with `-Net join -NetHost 127.0.0.1`.
4. Start both; the copy is P2.

## How it stays in sync

- The game's randomness (`Math.random`) comes from a seed shared at start; drawing-only code (sprites, light, weather) uses its own random numbers because each PC draws a different part of the map.
- One game step per network frame (FluidTimestep is bypassed).
- A new scene (map, battle, menu) only starts when every PC has loaded it.
- Animations and message faces don't wait for their images (load speed differs per PC).
- Events move "near any player" instead of "near this PC's camera".
- Every 60 frames the PCs compare a fingerprint of the world (scene, players, events, party, switches, variables, random state); a difference triggers a resync (above).

Tests:
- `tests/netsync.py` runs two independent copies of the engine with the same start and inputs and checks they end identical (1200 frames on Shopping street: in sync).
- `tests/netharness.py` runs host + 2 guests (3 engines) with fake sockets: start, walking, a forced desync and its fix, unplugging a guest (AI takes over), reconnecting, a third PC joining mid-game (20 checks).

## Known limits of the prototype

- If the **host** disconnects, the game stops for the guests (they reconnect automatically and wait for F11 again).
- A resync or a join waits for a quiet moment: during a long cutscene or a battle it happens after it.
- LAN only for now (fixed input delay of 3 frames); internet play needs adaptive delay.
- Menus and battles are shared screens: when P2 opens their menu, everybody sees it (as in local co-op).
- One player per PC.
