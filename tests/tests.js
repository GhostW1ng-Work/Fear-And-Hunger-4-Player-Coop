// Scenario tests for the co-op mod running on the real RPG Maker MV engine (graphics stubbed).
var __results = [];
function check(name, cond, extra) { __results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  [' + extra + ']' : '')); }

function keyEv(code, keyCode, location) {
    return { code: code, keyCode: keyCode, location: location || 0, repeat: false, key: '', preventDefault: function() {} };
}
function down(code, keyCode, location) {
    var e = keyEv(code, keyCode, location);
    Input._onKeyDown(e);
    (__listeners.keydown || []).forEach(function(f) { f(e); });
}
function up(code, keyCode, location) {
    var e = keyEv(code, keyCode, location);
    Input._onKeyUp(e);
    (__listeners.keyup || []).forEach(function(f) { f(e); });
}
function tap(code, keyCode, location) { down(code, keyCode, location); frame(); up(code, keyCode, location); frame(); }

function makePad(index) {
    var b = []; for (var i = 0; i < 17; i++) b.push({ pressed: false, value: 0 });
    return { index: index, connected: true, buttons: b, axes: [0, 0, 0, 0] };
}
function padBtn(pad, i, on) { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; }

var scene;
function frame() {
    Input.update();
    if (SceneManager._scene instanceof Scene_Map) {
        // solo la parte del mod de Scene_Map.update (la del juego necesita graficos)
        Scene_Map.prototype.update.call(SceneManager._scene);
    }
}

// ---- preparar partida ----
// el interprete del juego no corre aqui: sin autoejecutables (EV224 = preludio)
Game_Event.prototype.checkEventTriggerAuto = function() {};
DataManager.createGameObjects();
$dataMap = __map;
$gameMap.setup(19);
$gameParty._actors = [1, 3];
$gamePlayer.locate(10, 10);
$gamePlayer.refresh();
scene = new Scene_Map();
scene._spriteset = null;
scene.addWindow = function() {};
scene._windowLayer = { removeChild: function() {} };
SceneManager._scene = scene;
TouchInput.clear && TouchInput.clear();
frame();

// --- T1: P2 se une con X (grupo ya con 2 miembros) ---
tap('KeyX', 88);
check('T1 P2 joins with X as party slot 2', $gamePlayer2 && $gamePlayer2._coopActorId === 3, $gamePlayer2 && $gamePlayer2._coopActorId);

// --- T2: P3 se une con U ---
$gameParty._actors = [1, 3, 4];
tap('KeyU', 85);
check('T2 P3 joins with U as slot 3', $gamePlayer3 && $gamePlayer3._coopActorId === 4, $gamePlayer3 && $gamePlayer3._coopActorId);

// --- T3: P4 se une pulsando Start en un mando ---
$gameParty._actors = [1, 3, 4, 5];
var pad0 = makePad(0);
__pads = [pad0];
padBtn(pad0, 9, true); frame(); padBtn(pad0, 9, false); frame();
check('T3 Start on gamepad joins P4 as slot 4', $gamePlayer4 && $gamePlayer4._coopActorId === 5, $gamePlayer4 && $gamePlayer4._coopActorId);
check('T3b session saved with pad', JSON.stringify($gameSystem._coopSession) === '{"players":[2,3,4],"pads":{"4":0}}', JSON.stringify($gameSystem._coopSession));

// --- T4: cruceta del mando mueve a P4, no a P1 ---
pad0.axes[0] = 1; frame();
check('T4 pad stick -> P4 right', CoopLocal.keys(4).right === true && !Input.isPressed('right'));
pad0.axes[0] = 0; frame();
check('T4b release', CoopLocal.keys(4).right === false);

// --- T5: combate, turnos de 4 jugadores ---
var battle = Object.create(Scene_Battle.prototype);
SceneManager._scene = battle;
BattleManager._phase = 'input';
BattleManager._actorIndex = 2; // P3
frame();
down('Numpad0', 96); frame();
check('T5 P3 turn: Numpad0 = ok', Input.isPressed('ok'));
up('Numpad0', 96); frame();
down('KeyZ', 90); frame();
check('T5b P3 turn: P1 Z ignored', !Input.isPressed('ok'));
up('KeyZ', 90); frame();
padBtn(pad0, 0, true); frame();
check('T5c P3 turn: P4 pad A ignored', !Input.isPressed('ok'));
padBtn(pad0, 0, false); frame();
BattleManager._actorIndex = 3; // P4
frame();
padBtn(pad0, 0, true); frame();
check('T5d P4 turn: P4 pad A = ok', Input.isPressed('ok'));
padBtn(pad0, 0, false); frame();
// mando libre (P1) en turno de P4: no debe contar
var pad1 = makePad(1);
__pads = [pad0, pad1];
padBtn(pad1, 0, true); frame();
check('T5e P4 turn: free pad (P1) ignored', !Input.isPressed('ok'));
padBtn(pad1, 0, false); frame();
BattleManager._actorIndex = 0; // P1
frame();
padBtn(pad1, 0, true); frame();
check('T5f P1 turn: free pad works for P1', Input.isPressed('ok'));
padBtn(pad1, 0, false); frame();
// Bloq Num apagado: Numpad8 llega con keyCode 38 (flecha arriba) y no debe mover a P1
down('Numpad8', 38); frame();
check('T5g NumLock off numpad not P1 up', !Input.isPressed('up'));
up('Numpad8', 38); frame();
down('KeyW', 87); frame();
check('T5h P1 W works on P1 turn', Input.isPressed('up'));
up('KeyW', 87); frame();
down('ShiftRight', 16, 2); frame();
check('T5i Right Shift not P1 shift', !Input.isPressed('shift'));
up('ShiftRight', 16, 2); frame();
BattleManager._phase = '';
SceneManager._scene = scene;
frame();

// --- T6: dialogos - elige quien activo el evento ---
var target = null;
$gameMap.events().forEach(function(ev) {
    if (!target && ev && ev.page() && ev.list().length > 1 && ev._trigger === 0 && ev.isNormalPriority()) target = ev;
});
check('T6 found test event', !!target, target && target.eventId());
if (target) {
    $gamePlayer3.locate(target.x - 1, target.y);
    $gamePlayer3.setDirection(6);
    // asegurar que no haya otro evento delante
    $gamePlayer3.checkEventTriggerThere([0, 1, 2]);
    check('T6b event remembers P3 started it', target._coopStarter === 3, target._coopStarter);
    $gameMap._interpreter.setup(target.list(), target.eventId());
    scene._messageWindow = { _choiceWindow: { active: true } };
    frame();
    down('KeyZ', 90); frame();
    check('T6c choice by P3: P1 Z ignored', !Input.isPressed('ok'));
    up('KeyZ', 90); frame();
    down('Enter', 13); frame();
    check('T6d choice by P3: P2 Enter ignored', !Input.isPressed('ok'));
    up('Enter', 13); frame();
    down('Numpad0', 96); frame();
    check('T6e choice by P3: P3 Numpad0 = ok', Input.isPressed('ok'));
    up('Numpad0', 96); frame();
    // P1 inicia el evento: elige P1
    target._coopStarter = 0;
    $gamePlayer.locate(target.x - 1, target.y); $gamePlayer.setDirection(6);
    target.start();
    check('T6g P1-started event -> starter 1', target._coopStarter === 1, target._coopStarter);
    frame();
    down('KeyZ', 90); frame();
    check('T6h choice by P1: P1 Z = ok', Input.isPressed('ok'));
    up('KeyZ', 90); frame();
    scene._messageWindow = { _choiceWindow: { active: false } };
    $gameMap._interpreter.clear();
    target._starting = false;
    frame();
}

// --- T7: guardar / cargar: los jugadores vuelven solos con su mando ---
var contents = DataManager.makeSaveContents();
var json = JsonEx.stringify(contents);
DataManager.extractSaveContents(JsonEx.parse(json));
check('T7 after load players reset', !$gamePlayer2 && !$gamePlayer3 && !$gamePlayer4);
SceneManager._scene = scene;
frame();
check('T7b auto-rejoin P2,P3,P4', $gamePlayer2 && $gamePlayer3 && $gamePlayer4 && $gamePlayer4._coopActorId === 5);
pad0.axes[1] = -1; frame();
check('T7c pad back on P4', CoopLocal.keys(4).up === true);
pad0.axes[1] = 0; frame();

// --- T8: guardar sin mando conectado -> al cargar, Start lo recupera ---
contents = DataManager.makeSaveContents(); json = JsonEx.stringify(contents);
__pads = [];
DataManager.extractSaveContents(JsonEx.parse(json));
frame();
check('T8 rejoin without pad', !!$gamePlayer4);
var padB = makePad(0);
__pads = [padB];
padBtn(padB, 9, true); frame(); padBtn(padB, 9, false); frame();
padB.axes[0] = -1; frame();
check('T8b Start reclaims pad for P4 (no new join)', CoopLocal.keys(4).left === true && JSON.stringify($gameSystem._coopSession.pads) === '{"4":0}', JSON.stringify($gameSystem._coopSession));
padB.axes[0] = 0; frame();

// --- T9: sale un personaje -> los puestos se corren y P4 sale ---
$gameParty.removeActor(3);
frame();
check('T9 P4 removed when slot 4 empty', !$gamePlayer4);
check('T9b P2 now actor 4, P3 actor 5', $gamePlayer2._coopActorId === 4 && $gamePlayer3._coopActorId === 5, $gamePlayer2._coopActorId + ',' + $gamePlayer3._coopActorId);
check('T9c pad unbound and session updated', JSON.stringify($gameSystem._coopSession) === '{"players":[2,3],"pads":{}}', JSON.stringify($gameSystem._coopSession));
// el mando liberado vuelve a ser de P1 en el mapa... y Start lo une otra vez como P4
$gameParty._actors.push(3);
padBtn(padB, 9, true); frame(); padBtn(padB, 9, false); frame();
check('T9d Start rejoins P4', $gamePlayer4 && $gamePlayer4._coopActorId === 3, $gamePlayer4 && $gamePlayer4._coopActorId);

// --- T10: sin P2 nadie puede seguir: quitar P2 quita a todos ---
$gameParty._actors = [1];
frame();
check('T10 all extra players leave when party is solo', !$gamePlayer2 && !$gamePlayer3 && !$gamePlayer4);

// --- T11: Start como primer jugador extra -> P2 por mando ---
$gameParty._actors = [1, 3];
padBtn(padB, 9, true); frame(); padBtn(padB, 9, false); frame();
check('T11 Start with no P2 -> pad joins as P2', $gamePlayer2 && $gamePlayer2._coopActorId === 3);
padB.axes[0] = 1; frame();
check('T11b pad moves P2', CoopLocal.keys(2).right === true);
padB.axes[0] = 0; frame();

// --- T12: camara recorre P4 ---
$gameParty._actors = [1, 3, 4, 5];
tap('KeyU', 85);
padBtn(pad1, 9, true); __pads = [padB, pad1]; frame(); padBtn(pad1, 9, false); frame();
check('T12a P3 & P4 joined', !!$gamePlayer3 && !!$gamePlayer4, JSON.stringify($gameSystem._coopSession) + ' party=' + $gameParty._actors);
var seen = [];
for (var i = 0; i < 6; i++) { CoopLocal.cycleCamera(); seen.push(CoopLocal.mode()); }
check('T12 camera cycles through P4 (mode 5)', seen.indexOf(5) >= 0, seen.join(','));

// --- T13: F6 / F7 (guardado y carga rapida) con 4 jugadores ---
scene._active = true;
scene.stop = function() {}; // la escena de prueba no tiene graficos (fundido, ventanas)
DataManager.loadMapData = function() {};
function fkey(code) { (__listeners.keydown || []).forEach(function(f) { f({ keyCode: code, repeat: false }); }); }
var before = $gameParty._actors.join(',');
fkey(117);
check('T13 F6 saved slot 99', DataManager.isThisGameFile(99));
$gameParty._actors = [1];
frame();
check('T13b party changed after save', !$gamePlayer2);
fkey(118);
var next = SceneManager._nextScene;
check('T13c F7 goes to a new map scene', next instanceof Scene_Map);
next.create();
check('T13d party restored from quick save', $gameParty._actors.join(',') === before, $gameParty._actors.join(','));
next._spriteset = null; next.addWindow = function() {}; next._windowLayer = { removeChild: function() {} };
SceneManager._scene = next; SceneManager._nextScene = null;
frame();
check('T13e players rejoin after quick load', !!$gamePlayer2 && !!$gamePlayer3 && !!$gamePlayer4);

// --- T14: menu propio de P3 (Numpad .) ---
scene = next;
scene._mapNameWindow = { hide: function() {}, close: function() {} };
scene.isActive = function() { return true; };
$gameSystem.enableMenu && $gameSystem.enableMenu();
var p3Actor = $gamePlayer3._coopActorId;
down('NumpadDecimal', 110); frame(); up('NumpadDecimal', 110); frame(); frame(); frame();
var menuScene = SceneManager._nextScene;
check('T14 P3 cancel opens the menu', menuScene instanceof Scene_Menu, menuScene && menuScene.constructor.name);
check('T14b menu actor = P3 character', $gameParty.menuActor().actorId() === p3Actor, $gameParty.menuActor().actorId() + ' vs ' + p3Actor);
SceneManager._scene = menuScene; SceneManager._nextScene = null;
frame();
down('Numpad0', 96); frame();
check('T14c in P3 menu: Numpad0 = ok', Input.isPressed('ok'));
up('Numpad0', 96); frame();
down('KeyZ', 90); frame();
check('T14d in P3 menu: P1 Z ignored', !Input.isPressed('ok'));
up('KeyZ', 90); frame();
down('Enter', 13); frame();
check('T14e in P3 menu: P2 Enter ignored', !Input.isPressed('ok'));
up('Enter', 13); frame();
var cmd = Object.create(Window_MenuCommand.prototype);
cmd._list = [];
cmd.makeCommandList();
var syms = cmd._list.map(function(c) { return c.symbol; });
check('T14f P3 menu hides options/save/gameEnd/formation', syms.indexOf('options') < 0 && syms.indexOf('save') < 0 && syms.indexOf('gameEnd') < 0 && syms.indexOf('formation') < 0 && syms.indexOf('item') >= 0 && syms.indexOf('equip') >= 0, syms.join(','));
var fakeMenu = Object.create(Scene_Menu.prototype);
fakeMenu._commandWindow = { currentSymbol: function() { return 'equip'; } };
$gameParty.setMenuActor($gameActors.actor($gameParty._actors[0]));
fakeMenu.commandPersonal();
check('T14g Equip opens directly on P3 character', SceneManager._nextScene instanceof Scene_Equip && $gameParty.menuActor().actorId() === p3Actor, $gameParty.menuActor().actorId());
SceneManager._nextScene = null;
// vuelta al mapa: el menu ya no es de nadie
scene._spriteset = null;
try { Scene_Map.prototype.start.call(scene); } catch (e) { /* graficos de la escena de prueba */ }
SceneManager._scene = scene;
frame();
cmd._list = []; cmd.makeCommandList();
syms = cmd._list.map(function(c) { return c.symbol; });
check('T14h back on map: full menu again (P1)', syms.indexOf('gameEnd') >= 0, syms.join(','));
// menu de P1 con X: solo P1
down('KeyX', 88); frame(); up('KeyX', 88); frame(); frame(); frame();
var p1Menu = SceneManager._nextScene;
check('T14i P1 X opens menu', p1Menu instanceof Scene_Menu, p1Menu && p1Menu.constructor.name);
if (p1Menu) {
    SceneManager._scene = p1Menu; SceneManager._nextScene = null; frame();
    down('Numpad0', 96); frame();
    check('T14j in P1 menu: P3 Numpad0 ignored', !Input.isPressed('ok'));
    up('Numpad0', 96); frame();
    down('KeyZ', 90); frame();
    check('T14k in P1 menu: P1 Z = ok', Input.isPressed('ok'));
    up('KeyZ', 90); frame();
}

// --- T15: camara automatica ---
SceneManager._scene = scene; SceneManager._nextScene = null;
Graphics._renderer = { gl: {} }; // "hay WebGL": se puede dividir
while (CoopLocal.cameraSetting() !== 6) CoopLocal.cycleCamera();
var px = $gamePlayer.x, py = $gamePlayer.y;
extraPlayers = [$gamePlayer2, $gamePlayer3, $gamePlayer4];
extraPlayers.forEach(function(p) { p.locate(px + 1, py); });
for (var f = 0; f < 5; f++) frame();
check('T15 auto: together -> shared', CoopLocal.mode() === 0, CoopLocal.mode());
$gamePlayer3.locate(px + 15, py);
for (f = 0; f < 5; f++) frame();
check('T15b auto: apart but not long enough -> still shared', CoopLocal.mode() === 0, CoopLocal.mode());
for (f = 0; f < 10; f++) frame();
check('T15c auto: apart -> split', CoopLocal.mode() === 1, CoopLocal.mode());
$gamePlayer3.locate(px + 10, py); // entre los dos limites: se queda dividida
for (f = 0; f < 60; f++) frame();
check('T15d auto: in the middle zone stays split (no flicker)', CoopLocal.mode() === 1, CoopLocal.mode());
$gamePlayer3.locate(px + 2, py);
for (f = 0; f < 20; f++) frame();
check('T15e auto: back together, waits before merging', CoopLocal.mode() === 1, CoopLocal.mode());
for (f = 0; f < 30; f++) frame();
check('T15f auto: back together -> shared', CoopLocal.mode() === 0, CoopLocal.mode());
// en una escena (evento en curso) no cambia
$gameMap._interpreter.setup([{ code: 0, indent: 0, parameters: [] }, { code: 0, indent: 0, parameters: [] }], 0);
$gameMap._interpreter._index = 0;
$gamePlayer3.locate(px + 15, py);
for (f = 0; f < 30; f++) frame();
check('T15g auto: no switch during events', CoopLocal.mode() === 0, CoopLocal.mode() + ' running=' + $gameMap.isEventRunning());
$gameMap._interpreter.clear();
for (f = 0; f < 15; f++) frame();
check('T15h auto: switches after the event', CoopLocal.mode() === 1, CoopLocal.mode());

__results.join('\n') + '\n--log--\n' + __log.join('\n');
