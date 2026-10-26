# Network game (prototype, branch `netplay`)

Every player runs **their own copy of the game** on their own PC. Only the inputs travel over the network: every frame all PCs get the actions of all players and compute exactly the same frame, each with the camera on its own player. The host (P1) collects the inputs and hands out the frames.

Plugin: `plugins/LocalCoop_Net.js`. It does nothing unless `www/coop_net.json` exists.

## Install

```
install.ps1 -GamePath "C:\Games\Fear2" -QuickSave -Net host
install.ps1 -GamePath "D:\Games\Fear2-copy" -QuickSave -Net join -NetHost 192.168.1.20
```

`-NetHost` is the host PC's IP on the LAN (`ipconfig` on the host), or `127.0.0.1` for two copies on one PC. Port: `-NetPort` (default 47810; Windows asks to allow it in the firewall the first time).

## Play

1. Host: load a save and stand on the map. The party needs a companion for every guest (P2 controls party member 2, etc.).
2. Guests: start the game (the title screen is enough). They connect by themselves: "Connected to the host as P2".
3. Host presses **F11**: everybody loads the host's game and the network game starts.
4. On every PC: WASD or arrows, Z / Space / Enter, X / Esc / Backspace, Shift, or a gamepad (A, B, X / RT). `G`, `-` / `=` and `F10` stay local.

During the network game F6 / F7 (quick save), F9 (player windows) and F5 (reload) are disabled.

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
- Every 60 frames the PCs compare a fingerprint of the world (scene, players, events, party, switches, variables, random state); a difference shows **DESYNC ... Different: ...** on screen and in the console.

`tests/netsync.py` runs two independent copies of the engine with the same start and inputs and checks they end identical (1200 frames on Shopping street: in sync).

## Known limits of the prototype

- No recovery from a desync yet (planned: the host re-sends its state, like a save).
- A guest can't join or rejoin after the start (planned: same mechanism).
- If a player disconnects, the network game stops for everybody.
- Menus and battles are shared screens: when P2 opens their menu, everybody sees it (as in local co-op).
- One player per PC.
