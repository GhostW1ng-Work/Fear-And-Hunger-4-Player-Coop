# Реплики у двери башни (концовка B)

Что говорит каждый персонаж у каменной двери, когда в отряде несколько игроков и все выбрали: **Fight** (драться) или **Commit suicide** (покончить с собой). **В игре идут русские реплики** (вторая строка в каждой клетке); английские — первый вариант, для справки. Русские буквы рисуются шрифтом Crimson Text из самой игры (у основного шрифта Termina кириллицы нет), длинная реплика переносится на несколько строк.

Где в коде: `plugins/LocalCoop_FearHunger.js`, таблица `DOOR_LINES` (номер персонажа → [драться, покончить с собой]); `DOOR_LINES_ANY` — для всех остальных. Чтобы поменять реплику, достаточно заменить текст в кавычках (или прислать мне новый вариант этого файла).

| Персонаж | Fight (драться) | Commit suicide (покончить с собой) |
|---|---|---|
| **Levi** (1) | I've survived worse than this. I'm not stopping now.<br>*Простите меня, но я просто хочу выжить.* | ...I'm done fighting. Tell them I tried.<br>*...Я больше не буду сражаться. Прощайте, ребята..* |
| **Marina** (3) | I didn't come back to this cursed town to die at its door.<br>*Я вернулась в этот проклятый город не для того, чтобы умереть здесь.* | The visions were right... This is where my story ends.<br>*Я просто хочу покончить с этим... Со всем этим кошмаром..* |
| **Daan** (4) | Forgive me. I want to live.<br>*Я хочу жить дальше.Без сожалений о прошлом.* | I've seen enough suffering. I won't add to it.<br>*Элиза, я иду к тебе.* |
| **Abella** (5) | Sorry, mates. I'm getting out of here, ay?<br>*Что ж, видимо другого выбора у меня нет. Я очень, очень сожалею.* | Nah... I'm not killing any of you. I'm done.<br>*Я никого из вас убивать не буду. С меня хватит.* |
| **O'saa** (6) | The tower calls for the strongest. Come, then.<br>*Башня зовёт сильнейшего. Что ж, подходите.* | So be it. My path ends here, by my own hand.<br>*Да будет так. Мой путь кончается здесь, моей же рукой.* |
| **Marcoh** (13) | Fine. Let's get this over with.<br>*Ладно. Давайте покончим с этим.* | ...Go on. Get out of this hell for the both of us.<br>*...Я больше не хочу никого убивать.* |
| **Karin** (14) | Someone has to make it out and tell the story. It'll be me.<br>*Кто-то должен выбраться и рассказать эту историю.* | I'd rather end it myself than become one of them.<br>*Лучше я покончу с собой, чем стану убийцей.* |
| **Olivia** (15) | I'm sorry... I have to try.<br>*Прости... Я должна попытаться.* | I can't hurt anyone. Not anymore.<br>*Я не хочу никому причинять боль.* |
| Все остальные | Only one leaves. It will be me.<br>*Уйдёт только один. Это буду я.* | I won't fight you. Let it end here.<br>*Я не стану с вами драться. Пусть всё кончится здесь.* |

Остальной текст сцены:

- *The stone slab does not move. Something ancient is watching you all...* — Каменная плита не сдвигается. Что-то древнее наблюдает за вами всеми...
- *Only one may leave Termina. Only the last one standing.* — Покинуть Термину может только один. Только последний выживший.
- *P2 - Abella. What will you do?* — P2 — Абелла. Что ты сделаешь? (варианты: *Fight* / *Commit suicide*)
- *Abella ends their own life.* — Абелла обрывает свою жизнь.
