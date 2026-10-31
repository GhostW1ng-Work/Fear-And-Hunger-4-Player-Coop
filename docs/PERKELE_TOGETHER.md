# Вершина башни: все вместе

Только Termina. Работает, когда **все 12 участников освобождены** (фигурки из серы, `FREE_CONTESTANTS.md`) и наверх поднялись **2+ игрока**. Иначе — обычная сцена игры.

Русский текст — автора мода, английский — перевод. Строки из самой игры (оригинал) остаются на английском, как в игре.

## Как идёт сцена

1. Начало сцены игры (лифт, луна, Перкеле). Персонажи P2–P4 стоят рядом с героем.
2. Перкеле: вступление (ниже).
3. **Разговор из игры** без изменений: Перкеле рассказывает о Лунном боге Рхере, о фестивале, о культе серы и своём господине, а **герой (P1) задаёт вопросы игры** (*«You say the gods are gone, yet you talk about your master...»*, *«You haven't answered what it is that you do?»*). Вместо «присоединиться / убить» там вариант *«...»* — идти дальше: решают все вместе.
4. Перкеле: предложение (ниже), и сразу за ним **слова из игры** про души в серной клетке и серные ямы (*«All the souls you sent to our master...»* … *«...a true representative of the Cult of Sulfur.»*).
5. **Каждый игрок выбирает на своём ПК фразу** (3 — присоединиться, 3 — убить Перкеле). Потом всем показывается, кто что сказал (по фразам и по реакции Перкеле понятно, кто за, кто против).
6. Дальше:
   - **все против Перкеле** → все вместе дерутся с ним → его последние слова → концовка **«Разорванный круг»**;
   - **одни против, другие с ним** → бой сторона против стороны, насмерть. Победили те, кто против → бой с Перкеле → «Разорванный круг». Победили те, кто с ним → как ниже;
   - **с ним двое и больше** (все, кто остался, согласились) → бой между ними насмерть, пока не останется один: место одно;
   - **с ним остался один** → концовка игры «Культ серы» (как в игре после *«I'll join you.»*: Перкеле, бой, концовка).
7. **«Разорванный круг»:** поезд игры со **всеми выжившими** (освобождённые участники + герой) → **личная концовка игры каждого игрока** по очереди (фото в книге и текст; есть только у 8 играбельных) → надпись *The Broken Circle / Ending* → титры игры → титульный экран.

Если главный герой гибнет в бою сторон, героем становится победитель (как у двери).

Проверка без прохождения: меню Co-op → **Cheat: play the ending The Broken Circle** (только концовка).

## Перкеле: вступление

| Русский | English |
|---|---|
| А, вот вы наконец и здесь. Впервые в истории фестиваля победитель оказывается не один. | Ah, you are finally here. For the first time in the history of the festival, the winner is not alone. |

## Перкеле: предложение

| Русский | English |
|---|---|
| По правилам фестиваля победитель должен быть только один. | By the rules of the festival, there can be only one winner. |
| Достойнейший. Тот, кто продолжит идти по пути Хаоса. | The most worthy one. The one who will keep walking the path of Chaos. |

Дальше — слова из игры (на английском, как в игре): *«All the souls you sent to our master. Now boiling in the presence of his never-ending hatred...»*, *«To finish your transformation I need to send you too to his sulfuric cage.»*, *«Do not fret, it is like the summer and the winter at the same time...»*, *«When you rise back from those dark pits, only then will you be a true representative of the Cult of Sulfur.»*

## Что может сказать игрок (выбор)

| Присоединиться к Серному богу | Убить Перкеле |
|---|---|
| Я присоединюсь к вам.<br>*I will join you.* | На тебе всё и закончится, Перкеле.<br>*It ends with you, Per'kele.* |
| Пусть Серный бог забирает меня.<br>*The Sulfur God can have me.* | Больше никаких фестивалей.<br>*No more festivals.* |
| Я не для того прошёл весь этот путь, чтобы уйти ни с чем.<br>*I didn't come this far to walk away with nothing.* | Я разорву этот круг, даже если это меня убьёт.<br>*I'll break this circle, even if it kills me.* |

## Перкеле перед боем

| Когда | Русский | English |
|---|---|---|
| все против него | Тогда нападайте. Посмотрим, чего стоит ваше единство. | Then attack. Let us see what your unity is worth. |
| одни против, другие с ним | Вижу, в ваших рядах ещё остались здравомыслящие. | I see there are still some sensible ones among you. |
| с ним несколько | Вам осталось лишь решить, кто из вас самый достойный. | All that is left is to decide which of you is the most worthy. |
| после боя сторон победили те, кто против *(черновик)* | Значит, победили здравомыслящие. Что ж, нападайте — посмотрим, чего вы стоите. | So the sensible ones won. Then come, let us see what you are worth. |

## Смерть Перкеле

| Русский | English |
|---|---|
| Впечатляет... | Impressive... |
| Но моя смерть ничего не изменит. Фестиваль вернётся. | But my death changes nothing. The festival will return. |

Надпись в конце: **The Broken Circle** / *Ending* — «Разорванный круг» / «Концовка».

Где в коде: английский — `plugins/LocalCoop_FearHunger.js` (`TOP_PERKELE_INTRO`, `TOP_PERKELE_OFFER`, `TOP_JOIN_PHRASES`, `TOP_KILL_PHRASES`, `TOP_FIGHT_*`, `TOP_PERKELE_DEATH`); русский — `plugins/LookOutsideOnline.js`, `I18N_RU_EXACT`.
