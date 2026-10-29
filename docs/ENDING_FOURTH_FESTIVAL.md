# Концовка «The Fourth Festival»

Когда у двери башни **все** игроки выбрали *Commit suicide*. Можно вызвать в любой момент для проверки: меню Co-op → **Cheat: play the ending The Fourth Festival** (нужны включённые читы, только Termina).

## Как идёт сцена

1. Музыка затихает, экран гаснет.
2. Три удара колокола Рхера (`rher_bell_01_01`), справа и слева.
3. Начинается музыка `breath_of_the_moon`, медленно проступает вид на башню (`tower_view2`, полупрозрачно).
4. **Медленно поднимается текст** (ниже). Ускорить его нельзя.
5. Ещё один колокол — посреди экрана надпись **The Fourth Festival** / *Ending*.
6. Затемнение — титульный экран.

`{names}` — имена персонажей отряда в этот момент, через запятую и «и» (например: *Marcoh, Abella и Levi*). Пустые строки — паузы между абзацами.

## Текст

Первая колонка — английский (черновик), вторая — русский (**черновик, замените на свой**). С языком мода *English* идёт первая, с *Русский* — вторая.

| English | Русский (черновик) |
|---|---|
| The festival of Termina has ended without a winner. | Фестиваль Термины закончился без победителя. |
| *(пусто)* | *(пусто)* |
| No one climbed the tower. | Никто не поднялся на башню. |
| No one stood before the moon. | Никто не предстал перед луной. |
| *(пусто)* | *(пусто)* |
| The last contestants chose to die | Последние участники выбрали смерть, |
| rather than to kill each other. | лишь бы не убивать друг друга. |
| *(пусто)* | *(пусто)* |
| {names}. | {names}. |
| *(пусто)* | *(пусто)* |
| Their bodies were left by the stone door, | Их тела остались у каменной двери, |
| and the town forgot them soon enough. | и город быстро о них забыл. |
| *(пусто)* | *(пусто)* |
| Prehevil does not mourn. Prehevil waits. | Прехевиль не скорбит. Прехевиль ждёт. |
| *(пусто)* | *(пусто)* |
| Before long, the Fourth Festival of Termina will begin. | Совсем скоро начнётся четвёртый фестиваль Термины. |
| New contestants will come to the town of the moon... | В город луны придут новые участники... |
| ...and none of them will know these names. | ...и никто из них не узнает этих имён. |

Надпись в конце:

| English | Русский |
|---|---|
| The Fourth Festival | Четвёртый фестиваль |
| Ending | Концовка |

Строки можно добавлять, убирать и менять местами — пришлите файл, я перенесу. Одна строка должна быть не длиннее примерно 55 символов (иначе сожмётся по ширине экрана).

Где в коде: английский — `plugins/LocalCoop_FearHunger.js`, `FOURTH_FESTIVAL_TEXT`; русский — `plugins/LookOutsideOnline.js`, `I18N_RU_EXACT`.
