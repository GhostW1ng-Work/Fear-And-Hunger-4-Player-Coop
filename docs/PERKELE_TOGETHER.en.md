# The top of the tower: everyone together

Termina only. Русский: `PERKELE_TOGETHER.md`. It happens when **all 12 contestants are free or dead** (sulfur idols, `FREE_CONTESTANTS.en.md`) and **2+ players** came up. Otherwise - the game's own scene.

The lines are the mod author's (written in Russian, translated). The game's own lines stay as they are in the game.

## How the scene goes

1. The beginning of the game's scene (the elevator, the moon, Per'kele). The characters of P2-P4 stand next to the protagonist.
2. Per'kele: the opening line (below).
3. **The game's own talk**, unchanged: Per'kele tells about the Moon God Rher, the festival, the Cult of Sulfur and his master, and **the protagonist (P1) asks the game's questions** (*You say the gods are gone, yet you talk about your master...*, *You haven't answered what it is that you do?*). Instead of joining or killing him there is *"..."* - go on: everybody decides together.
4. Per'kele: the offer (below), and right after it **the game's own words** about the souls in the sulfuric cage and the pits (*All the souls you sent to our master...* ... *...a true representative of the Cult of Sulfur.*).
5. **Each player picks a phrase on their own PC** (3 to join the Sulfur God, 3 to kill Per'kele). Then everybody sees what each one said.
6. Then:
   - **everybody against Per'kele** -> they all fight him -> his last words -> the ending **The Broken Circle**;
   - **some against him, some with him** -> side against side, to the death. If the ones against him win -> they fight Per'kele -> The Broken Circle. If the ones with him win -> as below;
   - **two or more with him** (everybody left agreed) -> they fight each other to the death until one is left: there is only one seat;
   - **one left with him** -> the game's sulfur ending (as in the game after *I'll join you.*: Per'kele, the battle, the ending).
7. **The Broken Circle:** the game's train with **everybody who survived** (the freed contestants + the protagonist) -> **the game's own ending of each player's character**, one after another (the photo in the book and the text; only the 8 playable ones have one) -> *The Broken Circle / Ending* -> the game's credits -> the title screen.

If the protagonist dies in the fight of the sides, the winner becomes the protagonist (as at the door).

Without playing through: Co-op menu -> **Cheat: play the ending The Broken Circle** (the ending only).

## Per'kele: the opening

| English | Русский |
|---|---|
| Ah, you are finally here. For the first time in the history of the festival, the winner is not alone. | А, вот вы наконец и здесь. Впервые в истории фестиваля победитель оказывается не один. |

## Per'kele: the offer

| English | Русский |
|---|---|
| By the rules of the festival, there can be only one winner. | По правилам фестиваля победитель должен быть только один. |
| The most worthy one. The one who will keep walking the path of Chaos. | Достойнейший. Тот, кто продолжит идти по пути Хаоса. |

Then the game's own words: *All the souls you sent to our master. Now boiling in the presence of his never-ending hatred...*, *To finish your transformation I need to send you too to his sulfuric cage.*, *Do not fret, it is like the summer and the winter at the same time...*, *When you rise back from those dark pits, only then will you be a true representative of the Cult of Sulfur.*

## What a player can say (the choice)

| Join the Sulfur God | Kill Per'kele |
|---|---|
| I will join you. | It ends with you, Per'kele. |
| The Sulfur God can have me. | No more festivals. |
| I didn't come this far to walk away with nothing. | I'll break this circle, even if it kills me. |

## Per'kele before the battle

| When | English |
|---|---|
| everybody against him | Then attack. Let us see what your unity is worth. |
| some against, some with him | I see there are still some sensible ones among you. |
| after the fight of the sides, the ones against him won | I will have to perform one more ritual, then. Farewell, foolish little creature. |
| several with him | All that is left is to decide which of you is the most worthy. |

## Per'kele's death

| English |
|---|
| Impressive... |
| But my death changes nothing. The festival will return. |

At the end: **The Broken Circle** / *Ending*.

In the code: English - `plugins/LocalCoop_FearHunger.js` (`TOP_PERKELE_INTRO`, `TOP_PERKELE_OFFER`, `TOP_JOIN_PHRASES`, `TOP_KILL_PHRASES`, `TOP_FIGHT_*`, `TOP_PERKELE_DEATH`); Russian - `plugins/LookOutsideOnline.js`, `I18N_RU_EXACT`.
