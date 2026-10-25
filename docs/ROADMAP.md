# Roadmap

## Next big feature: remote play, one view per player

Goal: friends play over the internet, each one sees **only their own character** in a normal browser and plays with their own gamepad. No Parsec / Sunshine / virtual monitors.

### How it would work

```
 Host PC (the game)                                  Friend's PC (Chrome)
 ┌──────────────────────────────┐                   ┌──────────────────────┐
 │ Termina + co-op plugins      │                   │ http://host:PORT/p2  │
 │  F9 player windows           │ ── WebRTC video ─▶│  <video> = P2 view   │
 │   canvas P2 ─ captureStream  │                   │                      │
 │  small Node HTTP server      │ ◀─ DataChannel ── │  Gamepad API +       │
 │   (page + signaling + PIN)   │    (inputs)       │  keyboard            │
 └──────────────────────────────┘                   └──────────────────────┘
```

1. **Video**: each F9 player window already has a 2D canvas with that player's view. `canvas.captureStream(30)` gives a video track to send with `RTCPeerConnection`.
2. **Input**: the friend's page reads the gamepad (Gamepad API) and keyboard and sends button states over an `RTCDataChannel`. The host feeds them through the same path as local gamepads (fake `PadN*` keys for player N), so combat turns, menus and dialogue choices keep working.
3. **Audio**: RPG Maker MV plays BGM/SE through WebAudio; route the master gain into a `MediaStreamAudioDestinationNode` and add that track to every stream.
4. **Signaling / page**: NW.js can run Node, so the plugin starts a tiny HTTP server that serves the viewer page and exchanges SDP offers/answers. A PIN per player slot.
5. **Network**: Tailscale (no router setup) or port forwarding.

### Steps

1. Validate F9 player windows in the real game (views, dialogue, combat, performance).
2. LAN prototype: one viewer, video only.
3. Inputs over DataChannel (gamepad first, then keyboard).
4. Audio track.
5. Up to 3 viewers, lobby page, PINs, reconnect.

### Risks

- The game runs on **NW.js 0.29 / Chromium 65** (2018). It has `captureStream`, `RTCPeerConnection` and `addTrack`, but uses the old "Plan B" SDP by default and only software VP8: quality and latency must be measured. Fallback: JPEG frames over WebSocket for the video.
- CPU cost of encoding up to 3 streams plus rendering 4 views per frame.
- Browser autoplay rules on the viewer page (start with a click).

## Other ideas

- **Ghost mode instead of game over**: a dead player becomes a ghost scout until revived.
- **Story voting**: on big choices every player votes, majority wins.
- **Simultaneous combat input**: everyone picks actions at the same time.
- **Player-controlled monster**: one player hunts the others as a map enemy.
- **Separate inventories** with trading.
- Smaller: teleport to P1, labels over characters, cutscene handling, screen-edge arrows, picker limited to met characters, P2/P3 key remapping, backstory choices for P2/P3.
