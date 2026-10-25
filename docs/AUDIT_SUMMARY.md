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

Covered by tests T16-T21 in `tests/tests.js`.

## Known limitations (not fixed)

| Finding | Impact | Advice |
|---|---|---|
| **Conditions on the player's facing** (717 in 78 places, e.g. `fall_scene`, `School`, `Fortress`, `tunnels`). | Puzzles / interactions check P1's direction and position even when P2-P4 pressed the button. | Let **P1** do puzzles and "examine" interactions in those maps. |
| **Animations / balloons on the player** (2317). | Always shown on P1, even if P2 triggered the event. | Cosmetic. |
| **`run_double_tap`** (common events 577 / 578) read P1's arrow keys. | The double-tap sprint is P1 only. | P2-P4 have their own sprint key. |
| **Main character death** (`main_character_dead?`, `DEATH_MAIN_CHARACTER`). | The mod's rule is game over when any player's character dies in battle, stricter than Termina. | By design (see README); a "ghost mode" is on the roadmap. |

## How to test the risky places

Use the quick save plugin (`F6` / `F7`) before:

1. Recruiting a companion (party rearrange) and losing one.
2. A solo part of the story and the moment the companions come back.
3. Cutscenes in Church / Moon tower / Fortress / School (camera pans, hidden or walking protagonist).
4. Puzzles that need facing a specific direction (do them with P1).
