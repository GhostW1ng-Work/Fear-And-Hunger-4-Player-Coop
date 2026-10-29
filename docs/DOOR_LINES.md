# Реплики у двери башни (концовка B)

Что говорит каждый персонаж у каменной двери, когда в отряде несколько игроков и все выбрали: **Fight** (драться) или **Commit suicide** (покончить с собой). Первая строка — русская (с языком мода *Русский*), вторая — английская (с *English*): английские — перевод русских. Русские буквы рисуются шрифтом Crimson Text из самой игры (у основного шрифта Termina кириллицы нет), длинная реплика переносится на несколько строк.

Где в коде: английские — `plugins/LocalCoop_FearHunger.js`, таблица `DOOR_LINES` (номер персонажа → [драться, покончить с собой]) и `DOOR_LINES_ANY`; русские — перевод в `plugins/LookOutsideOnline.js` (`I18N_RU_EXACT`). Чтобы поменять реплику, достаточно заменить текст в кавычках (или прислать мне новый вариант этого файла).

| Персонаж | Fight (драться) | Commit suicide (покончить с собой) |
|---|---|---|
| **Levi** (1) | Простите меня, но я просто хочу выжить.<br>*Forgive me, but I just want to survive.* | ...Я больше не буду сражаться. Прощайте, ребята...<br>*...I won't fight anymore. Farewell, everyone...* |
| **Marina** (3) | Я вернулась в этот проклятый город не для того, чтобы умереть здесь.<br>*I didn't come back to this cursed town to die here.* | Я просто хочу покончить с этим... Со всем этим кошмаром...<br>*I just want to end this... All of this nightmare...* |
| **Daan** (4) | Я хочу жить дальше. Без сожалений о прошлом.<br>*I want to go on living. Without regrets about the past.* | Элиза, я иду к тебе.<br>*Eliza, I'm coming to you.* |
| **Abella** (5) | Что ж, видимо, другого выбора у меня нет. Я очень, очень сожалею.<br>*Well, it seems I have no other choice. I'm so, so sorry.* | Я никого из вас убивать не буду. С меня хватит.<br>*I won't kill any of you. I've had enough.* |
| **O'saa** (6) | Башня зовёт сильнейшего. Что ж, подходите.<br>*The tower calls for the strongest. Come, then.* | Да будет так. Мой путь кончается здесь, моей же рукой.<br>*So be it. My path ends here, by my own hand.* |
| **Marcoh** (13) | Ладно. Давайте покончим с этим.<br>*Fine. Let's get this over with.* | ...Я больше не хочу никого убивать.<br>*...I don't want to kill anyone anymore.* |
| **Karin** (14) | Кто-то должен выбраться и рассказать эту историю.<br>*Someone has to make it out and tell this story.* | Лучше я покончу с собой, чем стану убийцей.<br>*I'd rather kill myself than become a murderer.* |
| **Olivia** (15) | Прости... Я должна попытаться.<br>*I'm sorry... I have to try.* | Я не хочу никому причинять боль.<br>*I don't want to hurt anyone.* |
| Все остальные | Уйдёт только один. Это буду я.<br>*Only one leaves. It will be me.* | Я не стану с вами драться. Пусть всё кончится здесь.<br>*I won't fight you. Let it end here.* |

Остальной текст сцены:

- *The stone slab does not move. Something ancient is watching you all...* — Каменная плита не сдвигается. Что-то древнее наблюдает за вами всеми...
- *Only one may leave Termina. Only the last one standing.* — Покинуть Термину может только один. Только последний выживший.
- *P2 - Abella. What will you do?* — P2 — Абелла. Что ты сделаешь? (варианты: *Fight* / *Commit suicide*)
- *Abella ends their own life.* — Абелла обрывает свою жизнь.
