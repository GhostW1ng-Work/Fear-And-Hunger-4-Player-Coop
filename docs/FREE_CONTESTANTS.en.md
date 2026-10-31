# Freeing the contestants (sulfur idols)

Termina only. Русский: `FREE_CONTESTANTS.md`. The goal: free every contestant who has a moonscorched form - then the tower door opens for all players at once, with no *Only one may leave* and no companions going mad.

## How it works

1. From the start of the game a **small figure of sulfur** (the game's picture `$clay_statue1`) stands where each contestant's moonscorched form is met. The 8 playable contestants have their own faces, like the "idols of yourself" in Church_alternate (*You made an idol of yourself*); Henryk, Samarie, Tanaka and Caligura get the spare and the faceless ones.
2. Any player can look at it: *A small figure of sulfur. It looks like ...* -> **Touch it** / **Leave**.
3. **Touch it** - the whole party fights that contestant's moonscorched form (the game's own battle, with its body parts). You can run; losing is a normal death in battle.
4. **Victory** - the contestant is **free**:
   - the figure crumbles to yellow dust and is gone;
   - they **never turn** (the game's switches that turn them are not switched on);
   - they **do not die**: whatever the battle changed in the game's switches and variables (cut parts of the form and so on) is put back after it.
5. **A contestant who died** - their figure is gone and they count for the tower: dying as a person, or being **killed after turning** (as a monster) - then they are not saved, but the way for everybody is not closed.
6. **Too late:** a contestant who turned before being freed cannot be saved; their figure **disappears** (also when they turned earlier, e.g. while you slept - the mod looks at the game's switches). To still go into the tower together, their form (the monster) has to be killed. **On the evening of day 3** everybody not yet free turns (the players' characters too) and all the remaining figures disappear.
7. **All 12 free or dead** -> at the tower door: *The stone slab trembles under your hands... No one is left for the festival to claim... The door of the tower opens for all of you*, and everybody goes in together (as if all the other contestants were dead). What happens at the top: `PERKELE_TOGETHER.en.md`.

Co-op menu: **Freed contestants: N/12** - how many are free or dead (and how many turned and are still alive: they have to be killed).

**Planning matters:** Henryk becomes the Mayor already at dusk of day 1, Levi and Caligura turn from the evening of day 2 - sleeping moves time on.

## Contestants, forms, places

| Contestant | Form (battle) | Figure: map (x, y) | Turns (after that - too late) |
|---|---|---|---|
| Levi | Weeping scope | School, level 1 (23, 37) | from the evening of day 2 (`sniper_scene1`) |
| Marcoh | Giant | Apartments_2F_Alternate (36, 32) | day 3 (`Marcoh_gone_crazy`) |
| Abella | Chaugnar | tunnels_7, at the elevator (55, 40) | evening of day 3 (`Abella_gone`) |
| Marina | Cocoon | Church_Passageway (25, 43) | evening of day 3 |
| Olivia | Mechanical dance | Museum (27, 65) | evening of day 3 (`mechanical_dance_appear`) |
| Daan | Pocketcat | Museum, next to Pocketcat (7, 21) | day 3 (`Pocketdaan_appear`) |
| O'saa | Mastermind | Mausoleum_alley (10, 10) | evening of day 3 (`mastermind_mausoleum_alley`) |
| Karin | Valkyrie | D'ábel's island (devils_island) (29, 23) | evening of day 3 (`valkyrie_active`) |
| Henryk | Mayor (Gentleman) | Mayors_manor (4, 54) | **already at dusk of day 1** (`Mayor_appears`) |
| Samarie | Dysmorphia | Church_alternate, the room with the circles (16, 22) | dusk of day 3 (`samarie_full_transformation`) |
| Tanaka | Judgement | Deserted cottage (Cottage1), near the start of the game (18, 20) | day 3 (`Tanaka_alone`, `Tanaka_final`) |
| Caligura | Monster (the thing in the sewers) | Sewers1, the walkway by the water (17, 51) | from the evening of day 2 (`caligura_monster`) |

August and Pav have no form and do not count.

## Cheats (for testing)

Co-op menu, with cheats on:
- **Cheat: free all contestants** - every contestant counts as saved;
- **Cheat: teleport to the sulfur figure: < name >** - **left/right** picks the contestant (any of the 12; next to the name: *free* - saved or dead, *turned* - already a monster), **OK** - everybody goes to their figure;
- **Cheat: teleport to the character: < name >** - to **the contestant themselves**, where they are now by the state of the game (as a person, or their form if they turned). Left/right picks, OK goes there; with several places, every next OK goes to the next one. If they are in the party or on no map now, it says so.

In the code: `plugins/LocalCoop_FearHunger.js`, `FORMS` (contestants, battles, places, the figure's picture); Russian texts - `plugins/LookOutsideOnline.js`, `I18N_RU_EXACT`.
