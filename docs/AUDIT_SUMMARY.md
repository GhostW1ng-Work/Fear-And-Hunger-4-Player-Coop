# Termina event audit: findings

`tools/audit_events.py` scans all 179 maps, common events and troop events of Fear & Hunger 2: Termina for commands that can conflict with the co-op mod. The full generated list (every place, by category) is in [AUDIT.md](AUDIT.md).

## Fixed

| Finding | What happened | Fix |
|---|---|---|
| **System events per map**: `arrow_check`, `arrow_player`, `backstab_check`, `bleeding`, `blood` (on ~144 maps) read the player's position every frame. | The mod shows every map event the *nearest* player (so enemies chase whoever is closest). For these protagonist systems that was wrong: P1's gun shot could start from P3's position, blood could drip under the wrong character, and during a P2 shot the event could pick P3. | These events always see P1 (or the shooter during a P2-P4 shot). List: `PlayerOnlyEvents` parameter. Traps (`bearTrap1`, `smoke_trap1`, `needles`) still react to whoever steps on them. |
| **`PartyREARRANGE`** (common event 70) removes and re-adds every companion in a fixed order after recruiting; summons (ghouls, villagers) come first. | Party slot N = player N, so every rearrange shuffled who controls whom (P2 could suddenly play a ghoul). | Each player keeps their character: after every event the party is reordered so P2-P4's characters sit in slots 2-4. |
| **Solo parts of the story**: `temporary_party_remove` / `temporary_party_back` (531 / 532) and similar party changes (1029 commands in 75 places). | Players dropped out and had to rejoin by hand. | A player without a character "waits" (keeps their gamepad) and comes back by themselves, preferably with the same character, as soon as someone is back in the party. Party changes are only evaluated when the event has finished. |
| **Player transparency** (1511 commands in 111 places: cutscenes hide the protagonist). | P2-P4 stayed visible in the middle of the scene. | P2-P4 are hidden / shown together with P1. |
| **Move routes on the player** (7261 commands in 158 places). | P2-P4 stood still while the cutscene walked P1 away. | While a scene moves P1, P2-P4 follow (passing through everything, so they never block the scene). |
| **Scroll map** in cutscenes (37 commands, e.g. Church statue, Moon tower, intro). | The co-op camera re-centred on the players right after the pan, and split screen ignored it. | While a scene scrolls the camera, the mod leaves it alone and uses the shared view until the scene ends. |
| **Player-centric checks** in events: conditions on the player's facing (717 in 78 places), variables from the player's position (15376), move routes / animations / balloons on the player. | Events started by P2-P4 (puzzles, examining, traps, items) checked and moved P1 instead. | An event "sees" the player who started it as the protagonist: `Game_Interpreter.character(-1)` returns that player (also for common events launched by an item from their menu). Parallel / autorun events still see P1. |
| **P2-P4 interaction rules** (mod bug). | The action button started any event under or in front of P2-P4, ignoring priority and counters. | Same rules as the player: own tile = below/above events, front = same-level events, through counters, touch on bump. |

Covered by tests T16-T21 and T27 in `tests/tests.js`.

## Known limitations (not fixed)

| Finding | Impact | Advice |
|---|---|---|
| **`run_double_tap`** (common events 577 / 578) read P1's arrow keys. | The double-tap sprint is P1 only. | P2-P4 have their own sprint key. |
| **Main character death** (`main_character_dead?`, `DEATH_MAIN_CHARACTER`). | The mod's rule is game over when any player's character dies in battle, stricter than Termina. | By design (see README); a "ghost mode" is on the roadmap. |

## How to test the risky places

Use the quick save plugin (`F6` / `F7`) before:

1. Recruiting a companion (party rearrange) and losing one.
2. A solo part of the story and the moment the companions come back.
3. Cutscenes in Church / Moon tower / Fortress / School (camera pans, hidden or walking protagonist).
4. Puzzles that need facing a specific direction, done by P2-P4.
