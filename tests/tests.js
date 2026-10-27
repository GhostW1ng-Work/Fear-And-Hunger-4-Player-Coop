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
$gameMap.setup(__map.__id || 19);
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
check('T3b session saved with pad', JSON.stringify($gameSystem._coopSession) === '{"players":[2,3,4],"pads":{"4":0},"actors":{"2":3,"3":4,"4":5}}', JSON.stringify($gameSystem._coopSession));

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
// en red (LocalCoop_Net) las acciones llegan con injectAction: el turno manda igual
BattleManager._actorIndex = 2; // P3
frame();
CoopLocal.injectAction(1, 'ok', true); frame();
check('T5n1 network: P1 ok ignored in P3 turn', !Input.isPressed('ok'));
CoopLocal.injectAction(1, 'ok', false); frame();
CoopLocal.injectAction(3, 'ok', true); frame();
check('T5n2 network: P3 ok works in P3 turn', Input.isPressed('ok'));
CoopLocal.injectAction(3, 'ok', false); frame();
BattleManager._actorIndex = 0; // P1
frame();
CoopLocal.injectAction(1, 'ok', true); frame();
check('T5n3 network: P1 ok works in P1 turn', Input.isPressed('ok'));
CoopLocal.injectAction(1, 'ok', false); frame();
check('T5n4 network: P1 ok released', !Input.isPressed('ok'));
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
    $gameMap._interpreter._coopStarter = target._coopStarter; // lo que hace el juego al empezar el evento
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
    $gameMap._interpreter._coopStarter = target._coopStarter;
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

// --- T9: sale el personaje de P2 -> P2 espera; P3 y P4 siguen con los suyos ---
// (P2=3, P3=4, P4=5; nadie le quita el personaje a otro)
$gameParty.removeActor(3);
frame();
check('T9 P2 waiting when its character leaves', !$gamePlayer2 && !!$gamePlayer3 && !!$gamePlayer4);
check('T9b P3 keeps actor 4, P4 keeps 5', $gamePlayer3._coopActorId === 4 && $gamePlayer4._coopActorId === 5, $gamePlayer3._coopActorId + ',' + $gamePlayer4._coopActorId);
check('T9c session: P2 saved as waiting for actor 3, P4 keeps its gamepad', JSON.stringify($gameSystem._coopSession) === '{"players":[3,4,2],"pads":{"4":0},"actors":{"2":3,"3":4,"4":5}}', JSON.stringify($gameSystem._coopSession));
// vuelve su personaje: P2 vuelve solo
$gameParty._actors.push(3);
frame(); frame();
check('T9d waiting P2 comes back by itself', $gamePlayer2 && $gamePlayer2._coopActorId === 3, $gamePlayer2 && $gamePlayer2._coopActorId);
padB.axes[0] = 1; frame();
check('T9e P4 still has its gamepad', CoopLocal.keys(4).right === true);
padB.axes[0] = 0; frame();

// --- T10: grupo en solitario (partes de la historia): todos esperan ---
$gameParty._actors = [1];
frame();
check('T10 all extra players wait when party is solo', !$gamePlayer2 && !$gamePlayer3 && !$gamePlayer4);

// --- T11: vuelve un companero -> P2 vuelve solo ---
$gameParty._actors = [1, 3];
frame(); frame();
check('T11 waiting P2 comes back by itself', $gamePlayer2 && $gamePlayer2._coopActorId === 3, $gamePlayer2 && $gamePlayer2._coopActorId);
check('T11b P3/P4 still waiting', !$gamePlayer3 && !$gamePlayer4);

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
function fkey(code, shift) { (__listeners.keydown || []).forEach(function(f) { f({ keyCode: code, repeat: false, shiftKey: !!shift }); }); }
var before = $gameParty._actors.join(',');
fkey(117, true);
check('T13 Shift+F6 saved slot 99', DataManager.isThisGameFile(99));
$gameParty._actors = [1];
frame();
check('T13b party changed after save', !$gamePlayer2);
fkey(118, true);
var next = SceneManager._nextScene;
check('T13c Shift+F7 goes to a new map scene', next instanceof Scene_Map);
next.create();
check('T13d party restored from quick save', $gameParty._actors.join(',') === before, $gameParty._actors.join(','));
next._spriteset = null; next.addWindow = function() {}; next._windowLayer = { removeChild: function() {} };
SceneManager._scene = next; SceneManager._nextScene = null;
frame();
check('T13e players rejoin after quick load', !!$gamePlayer2 && !!$gamePlayer3 && !!$gamePlayer4);
// F6 / F7 sin Shift: las pantallas de Guardar / Cargar (se elige la ranura)
function sceneTick() { SceneManager._scene._active = true; try { Scene_Base.prototype.update.call(SceneManager._scene); } catch (e) { /* graficos */ } }
SceneManager._scene._active = true; fkey(117); sceneTick();
check('T13f F6 opens the save screen', SceneManager._nextScene instanceof Scene_Save, SceneManager._nextScene && SceneManager._nextScene.constructor.name);
SceneManager._nextScene = null; SceneManager._stack = [];
SceneManager._scene._active = true; fkey(118); sceneTick();
check('T13g F7 opens the load screen', SceneManager._nextScene instanceof Scene_Load, SceneManager._nextScene && SceneManager._nextScene.constructor.name);
SceneManager._nextScene = null; SceneManager._stack = [];

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

// ======================= arreglos del analisis de eventos (tools/audit_events.py) =======================
SceneManager._scene = scene; SceneManager._nextScene = null;
$gameMap._interpreter.clear();
$gamePlayer.locate(px, py);
[$gamePlayer2, $gamePlayer3, $gamePlayer4].forEach(function(p, i) { p.locate(px + 1 + i, py); });
for (f = 0; f < 3; f++) frame();
var ids = function() { return [$gamePlayer2._coopActorId, $gamePlayer3._coopActorId, $gamePlayer4._coopActorId].join(','); };
var bound = ids();

// --- T16: el juego reordena el grupo (PartyREARRANGE): cada jugador conserva su personaje ---
var a = $gameParty._actors.slice();
$gameParty._actors = [a[0], a[3], a[1], a[2]];
frame();
check('T16 party reorder keeps each player character', ids() === bound, ids() + ' vs ' + bound);
check('T16b party order restored to P2/P3/P4 slots', $gameParty._actors.join(',') === a.join(','), $gameParty._actors.join(','));

// --- T17: parte en solitario (temporary_party_remove / back) durante un evento ---
$gameMap._interpreter.setup([{ code: 0, indent: 0, parameters: [] }, { code: 0, indent: 0, parameters: [] }], 0);
$gameParty._actors = [a[0]];
frame();
check('T17 nothing changes while the event runs', !!$gamePlayer2 && !!$gamePlayer4);
$gameMap._interpreter.clear();
frame();
check('T17b after the event everyone waits', !$gamePlayer2 && !$gamePlayer3 && !$gamePlayer4);
$gameParty._actors = [a[0], a[3], a[2], a[1]]; // vuelven en otro orden
for (f = 0; f < 5; f++) frame();
check('T17c everyone back with their own character', !!$gamePlayer4 && ids() === bound, ($gamePlayer4 ? ids() : 'P4 missing') + ' vs ' + bound);

// --- T18: el juego oculta al protagonista -> tambien a P2-P4 ---
$gamePlayer.setTransparent(true);
frame();
check('T18 extras hidden with P1', $gamePlayer2.isTransparent() && $gamePlayer4.isTransparent());
$gamePlayer.setTransparent(false);
frame();
check('T18b extras visible again', !$gamePlayer2.isTransparent() && !$gamePlayer4.isTransparent());

// --- T19: eventos del protagonista (arrow_check...) ven siempre a P1; los demas al mas cercano ---
var arrowEv = null, otherEv = null;
$gameMap.events().forEach(function(ev) {
    if (!ev) return;
    if (!arrowEv && ev.event().name === 'arrow_check') arrowEv = ev;
    if (!otherEv && ev.event().name !== 'arrow_check' && ev.event().name !== 'bleeding') otherEv = ev;
});
check('T19 map has arrow_check', !!arrowEv);
if (arrowEv && otherEv) {
    var seenX = {};
    [arrowEv, otherEv].forEach(function(ev) {
        ev.updateParallel = function() { seenX[ev.eventId()] = $gamePlayer.x; };
        $gamePlayer.locate(ev.x + 20, ev.y);
        $gamePlayer2.locate(ev.x + 1, ev.y);
        ev.update();
    });
    check('T19b arrow_check sees P1 even with P2 closer', seenX[arrowEv.eventId()] === arrowEv.x + 20, seenX[arrowEv.eventId()]);
    check('T19c other events see the nearest player', seenX[otherEv.eventId()] === otherEv.x + 1, seenX[otherEv.eventId()]);
    delete arrowEv.updateParallel; delete otherEv.updateParallel;
}

// --- T20: una escena mueve al protagonista -> P2-P4 lo siguen ---
$gamePlayer.locate(px, py);
$gamePlayer2.locate(px + 6, py);
$gameMap._interpreter.setup([{ code: 0, indent: 0, parameters: [] }, { code: 0, indent: 0, parameters: [] }], 0);
$gamePlayer.forceMoveRoute({ list: [{ code: 15, parameters: [600] }, { code: 0 }], repeat: false, skippable: true, wait: false });
var p2x0 = $gamePlayer2.x;
for (f = 0; f < 30; f++) frame();
check('T20 a route that does not move P1 (turn, wait): P2 stays where it is', $gamePlayer2.x === p2x0, p2x0 + ' -> ' + $gamePlayer2.x);
$gamePlayer.locate(px, py); $gamePlayer._x = px; // la escena lo lleva a otra casilla
$gamePlayer.locate(px - 1, py);
var d0 = Math.abs($gamePlayer2.x - $gamePlayer.x);
for (f = 0; f < 120; f++) { $gamePlayer.updateRoutineMove && $gamePlayer.updateRoutineMove(); frame(); }
var d1 = Math.abs($gamePlayer2.x - $gamePlayer.x) + Math.abs($gamePlayer2.y - $gamePlayer.y);
check('T20b the route moves P1: P2 walks to P1', d1 < d0 && d1 <= 2, d0 + ' -> ' + d1);
$gamePlayer._moveRouteForcing = false;

// --- T21: la escena desplaza la camara -> el mod no la recentra hasta que termina ---
Graphics._renderer = { gl: {} };
$gameMap.startScroll(6, 5, 6);
for (f = 0; f < 60; f++) { $gameMap.updateScroll(); frame(); }
var scrolledX = $gameMap.displayX();
for (f = 0; f < 10; f++) { $gamePlayer.updateScroll(0, 0); frame(); }
check('T21 camera stays where the cutscene scrolled it', $gameMap.displayX() === scrolledX, scrolledX + ' -> ' + $gameMap.displayX());
check('T21b split is not used during that cutscene', CoopLocal.mode() === 0, CoopLocal.mode());
$gameMap._interpreter.clear();
$gamePlayer.updateScroll(0, 0);
check('T21c after the cutscene the co-op camera is back', $gameMap.displayX() !== scrolledX, scrolledX + ' -> ' + $gameMap.displayX());

// --- T22: reparto de personajes por el anfitrion (menu "Co-op") ---
$gameMap._interpreter.clear();
SceneManager._scene = scene;
scene.coopRemovePlayer(4); scene.coopRemovePlayer(3);
frame();
var mem = $gameParty.members();
check('T22 two players, four characters', !!$gamePlayer2 && !$gamePlayer3 && mem.length === 4, mem.length);
// por defecto: por turnos (3.o -> P1, 4.o -> P2)
var p2main = $gamePlayer2._coopActorId;
var extras = mem.filter(function(a) { return a.actorId() !== mem[0].actorId() && a.actorId() !== p2main; });
check('T22b default: extras alternate P1 / P2', extras.length === 2 && !extras[0].isAutoBattle() && !extras[1].isAutoBattle());
$gameSystem._coopOwners = {};
$gameSystem._coopOwners[extras[0].actorId()] = 2;   // el 3.o para P2
$gameSystem._coopOwners[extras[1].actorId()] = 0;   // el 4.o lo lleva la IA
$gameSystem._coopOwners[p2main] = 0;                // el principal de P2 no se puede cambiar
check('T22c AI character fights by itself', extras[1].isAutoBattle() && !extras[1].canInput());
check('T22d main character of P2 stays with P2', !$gameActors.actor(p2main).isAutoBattle());
SceneManager._scene = Object.create(Scene_Battle.prototype);
BattleManager._phase = 'input';
BattleManager._actorIndex = mem.indexOf(extras[0]);
frame();
down('Enter', 13); frame();
check('T22e assigned extra: P2 Enter = ok on its turn', Input.isPressed('ok'));
up('Enter', 13); frame();
down('KeyZ', 90); frame();
check('T22f assigned extra: P1 Z ignored', !Input.isPressed('ok'));
up('KeyZ', 90); frame();
BattleManager._phase = '';
SceneManager._scene = scene;
frame();
// el comando "Co-op" solo aparece en el menu de P1
cmd._list = []; cmd.makeCommandList();
check('T22g P1 menu has "Co-op"', cmd._list.some(function(c) { return c.symbol === 'coopAssign'; }));
var menuP2 = Object.create(Window_MenuCommand.prototype);
scene.coopCallMenuFor && (function() {
    // simular menu de P2
    var keep = SceneManager._nextScene;
    scene.coopCallMenuFor(2);
    menuP2._list = []; menuP2.makeCommandList();
    SceneManager._nextScene = keep;
})();
check('T22h P2 menu has no "Co-op"', !menuP2._list.some(function(c) { return c.symbol === 'coopAssign'; }));
// la ventana "Co-op": izquierda / derecha cambian el dueno de un personaje extra (P1 -> P2 -> IA -> P1)
try {
    // la capa de ventanas de RPG Maker necesita graficos de verdad: aqui basta un contenedor
    Scene_Base.prototype.createWindowLayer = function() {
        this._windowLayer = new PIXI.Container();
        this.addChild(this._windowLayer);
    };
    Window_Base.prototype.initialize = function(x, y, w, h) {
        PIXI.Container.call(this);
        this._windowContentsSprite = { bitmap: null };
        this._padding = 18;
        this.x = x; this.y = y; this._width = w; this._height = h;
        this.contents = new Bitmap(w - 36, h - 36);
        this._opening = this._closing = false;
        this.windowskin = new Bitmap(1, 1);
        this._cursorRect = new Rectangle(0, 0, 0, 0);
        this._refreshCursor = function() {};
    };
    var assignScene = new Scene_CoopAssign();
    assignScene.create();
    var list = assignScene._coopList;
    $gameSystem._coopOwners = {};
    list.select(mem.indexOf(extras[0]));
    var seq = [];
    for (var k = 0; k < 3; k++) { list.cursorRight(); seq.push($gameSystem._coopOwners[extras[0].actorId()]); }
    check('T22i Co-op window cycles owners', seq.join(',') === '2,0,1', seq.join(','));
    list.select(0);
    list.cursorRight();
    check('T22j leader cannot be reassigned', $gameSystem._coopOwners[mem[0].actorId()] === undefined);
} catch (e) {
    check('T22i Co-op window opens', false, String(e.stack).slice(0, 600));
}
try { Scene_Map.prototype.start.call(scene); } catch (e) { /* graficos */ }

// --- T23: jugador ausente (mando desconectado / desde el menu Co-op) ---
SceneManager._scene = scene; SceneManager._nextScene = null;
$gameMap._interpreter.clear();
var padC = makePad(3);
__pads = [padC];
padBtn(padC, 9, true); frame(); padBtn(padC, 9, false); frame(); frame();
check('T23 P3 joins with a new gamepad', !!$gamePlayer3);
var p3main = $gameActors.actor($gamePlayer3._coopActorId);
padC.connected = false; __pads = [];
frame();
check('T23b gamepad unplugged -> P3 away, AI plays its character', p3main.isAutoBattle() && !p3main.canInput());
$gamePlayer.locate(px, py); $gamePlayer3.locate(px + 7, py);
for (f = 0; f < 90; f++) frame();
var dAway = Math.abs($gamePlayer3.x - $gamePlayer.x) + Math.abs($gamePlayer3.y - $gamePlayer.y);
check('T23c away P3 follows P1 on the map', dAway <= 3, dAway);
padC.connected = true; __pads = [padC];
padBtn(padC, 0, true); frame(); padBtn(padC, 0, false); frame();
check('T23d any button -> P3 back', !p3main.isAutoBattle());
// combate: si se va justo en su turno, la IA elige por el y el turno pasa al siguiente
padC.connected = false; __pads = [];
frame();
SceneManager._scene = Object.create(Scene_Battle.prototype);
BattleManager._phase = 'input';
BattleManager._actorIndex = $gameParty.members().indexOf(p3main);
var idxBefore = BattleManager._actorIndex;
try { Scene_Battle.prototype.update.call(SceneManager._scene); } catch (e) { /* graficos del combate */ }
check('T23e away during own battle turn -> turn passes on', BattleManager._actorIndex !== idxBefore, idxBefore + ' -> ' + BattleManager._actorIndex);
BattleManager._phase = '';
SceneManager._scene = scene;
padC.connected = true; __pads = [padC];
padBtn(padC, 0, true); frame(); padBtn(padC, 0, false); frame();
// desde el menu Co-op: OK en el principal de P2 = ausente / de vuelta
var p2actor = $gameActors.actor($gamePlayer2._coopActorId);
var sc2 = new Scene_CoopAssign(); sc2.create();
sc2._coopList.select($gameParty.members().indexOf(p2actor));
sc2._coopList.processOk();
check('T23f Co-op menu: P2 marked away', p2actor.isAutoBattle());
sc2._coopList.processOk();
check('T23g Co-op menu: P2 back', !p2actor.isAutoBattle());

// --- T24: los acompanantes del juego muestran solo a los personajes sin jugador ---
function followerActors() {
    return $gamePlayer.followers()._data.map(function(fw) { return fw.actor(); }).filter(Boolean).map(function(a) { return a.actorId(); });
}
var mainsNow = [$gamePlayer2, $gamePlayer3, $gamePlayer4].filter(Boolean).map(function(p) { return p._coopActorId; });
var fa = followerActors();
check('T24 followers exclude players characters', mainsNow.every(function(id) { return fa.indexOf(id) < 0; }), 'followers=' + fa.join(',') + ' mains=' + mainsNow.join(','));

// --- T25: el anfitrion se queda el personaje de P3 (menu Co-op: P3 -> IA -> P1) ---
var p3actor = $gameActors.actor($gamePlayer3._coopActorId);
var sc3 = new Scene_CoopAssign(); sc3.create();
sc3._coopList.select($gameParty.members().indexOf(p3actor));
sc3._coopList.processOk(); // ausente
sc3._coopList.processOk(); // P1 se lo queda
check('T25 still in the menu: nothing applied yet', !!$gamePlayer3);
sc3.terminate();
SceneManager._scene = scene;
frame();
check('T25b P3 left, its character stays in the party', !$gamePlayer3 && $gameParty._actors.indexOf(p3actor.actorId()) >= 0);
check('T25c that character is now a normal follower', followerActors().indexOf(p3actor.actorId()) >= 0, followerActors().join(','));
check('T25d P1 controls it in combat (not AI)', !p3actor.isAutoBattle() && (function() {
    SceneManager._scene = Object.create(Scene_Battle.prototype);
    BattleManager._phase = 'input';
    BattleManager._actorIndex = $gameParty.members().indexOf(p3actor);
    frame();
    down('KeyZ', 90); frame();
    var ok = Input.isPressed('ok');
    up('KeyZ', 90); frame();
    BattleManager._phase = '';
    SceneManager._scene = scene;
    frame();
    return ok;
})());
// P3 vuelve: recupera su personaje
tap('KeyU', 85);
check('T25e P3 rejoins with its old character', $gamePlayer3 && $gamePlayer3._coopActorId === p3actor.actorId(), $gamePlayer3 && $gamePlayer3._coopActorId);
check('T25f no longer a follower', followerActors().indexOf(p3actor.actorId()) < 0);

// --- T26: el anfitrion se queda el de P2 y P3 sigue jugando (hueco en P2) ---
var p2a = $gameActors.actor($gamePlayer2._coopActorId);
var sc4 = new Scene_CoopAssign(); sc4.create();
sc4._coopList.select($gameParty.members().indexOf(p2a));
sc4._coopList.processOk(); sc4._coopList.processOk();
sc4.terminate();
SceneManager._scene = scene;
frame();
check('T26 P2 gone, P3 still playing', !$gamePlayer2 && !!$gamePlayer3 && CoopLocal.isOn());
SceneManager._scene = Object.create(Scene_Battle.prototype);
BattleManager._phase = 'input';
BattleManager._actorIndex = $gameParty.members().indexOf($gameActors.actor($gamePlayer3._coopActorId));
frame();
down('Numpad0', 96); frame();
check('T26b P3 still controls its character in combat', Input.isPressed('ok'));
up('Numpad0', 96); frame();
BattleManager._phase = '';
SceneManager._scene = scene;
frame();
// P2 vuelve con su Enter (con co-op en marcha)
tap('Enter', 13);
check('T26c P2 rejoins with Enter and gets its character back', $gamePlayer2 && $gamePlayer2._coopActorId === p2a.actorId(), $gamePlayer2 && $gamePlayer2._coopActorId);

// --- T27: el evento "ve" al jugador que lo activo (posicion, direccion, rutas) ---
var probe = [
    { code: 122, indent: 0, parameters: [1, 1, 0, 3, 5, -1, 0] },   // var1 = x del jugador
    { code: 122, indent: 0, parameters: [2, 2, 0, 3, 5, -1, 2] },   // var2 = direccion del jugador
    { code: 205, indent: 0, parameters: [-1, { list: [{ code: 15, parameters: [30] }, { code: 0 }], repeat: false, skippable: true, wait: false }] },
    { code: 0, indent: 0, parameters: [] }
];
var savedList = target.page().list;
target.page().list = probe;
$gameMap._interpreter.clear();
$gameMessage.clear();
$gamePlayer.locate(target.x - 6, target.y + 3);
$gamePlayer2.locate(target.x - 1, target.y); $gamePlayer2.setDirection(6);
frame();
tap('Enter', 13);
frame();
check('T27 P2-started event reads P2 position', $gameVariables.value(1) === $gamePlayer2.x, $gameVariables.value(1) + ' vs P2 ' + $gamePlayer2.x + ' / P1 ' + $gamePlayer.x);
check('T27b ... and P2 direction', $gameVariables.value(2) === 6, $gameVariables.value(2));
check('T27c move route on "the player" moves P2, not P1', $gamePlayer2.isMoveRouteForcing() && !$gamePlayer.isMoveRouteForcing());
for (f = 0; f < 40; f++) frame();
$gamePlayer2._moveRouteForcing = false;
// P1 activa el mismo evento: el jugador es P1
$gameMap._interpreter.clear();
$gamePlayer2.locate(target.x - 6, target.y + 3);
$gamePlayer.locate(target.x - 1, target.y); $gamePlayer.setDirection(6);
frame();
$gamePlayer.checkEventTriggerThere([0, 1, 2]);
frame();
check('T27d P1-started event reads P1 position', $gameVariables.value(1) === $gamePlayer.x, $gameVariables.value(1) + ' vs P1 ' + $gamePlayer.x);
for (f = 0; f < 40; f++) frame();
$gamePlayer._moveRouteForcing = false;
target.page().list = savedList;
// objeto usado desde el menu de P2 que lanza un evento comun
$gameMap._interpreter.clear();
$dataCommonEvents.push({ id: $dataCommonEvents.length, name: 'coop_probe', trigger: 0, switchId: 1,
    list: [{ code: 122, indent: 0, parameters: [3, 3, 0, 3, 5, -1, 0] }, { code: 0, indent: 0, parameters: [] }] });
$gamePlayer2.locate(px + 4, py);
scene.coopCallMenuFor(2);
$gameTemp.reserveCommonEvent($dataCommonEvents.length - 1);
SceneManager._nextScene = null;
try { Scene_Map.prototype.start.call(scene); } catch (e) { /* graficos */ }
SceneManager._scene = scene;
frame();
check('T27e item common event from P2 menu reads P2 position', $gameVariables.value(3) === $gamePlayer2.x, $gameVariables.value(3) + ' vs P2 ' + $gamePlayer2.x + ' / P1 ' + $gamePlayer.x);

// --- T28: ajustes del co-op (Opciones > Co-op) ---
$gameMap._interpreter.clear();
$gameMessage.clear();
var optWin = Object.create(Window_Options.prototype);
optWin._list = []; optWin.makeCommandList();
check('T28 Options has "Co-op settings..."', optWin._list.some(function(c) { return c.symbol === 'coopSettings'; }));
var cfg = ConfigManager.makeData();
check('T28b settings saved with the config', !!cfg.coopSettings && cfg.coopSettings.p3Keys === 'all', JSON.stringify(cfg.coopSettings));
var setScene = new Scene_CoopSettings(); setScene.create();
var setList = setScene._coopList;
function selectSetting(key) { setList.select(['localCoop', 'camera', 'splitZoom', 'splitDirection', 'split3Layout', 'gamepads', 'p3Keys', 'autoRejoin', 'keepCharacters', 'updateCheck'].indexOf(key)); }
// P3 solo con teclado numerico: I/J/K/L ya no son de P3
SceneManager._scene = scene;
selectSetting('p3Keys'); setList.cursorRight();
check('T28c P3 keyboard -> Numpad', ConfigManager.makeData().coopSettings.p3Keys === 'numpad');
var p3now = !!$gamePlayer3;
down('KeyI', 73); frame();
check('T28d IJKL no longer moves P3', !CoopLocal.keys(3).up);
up('KeyI', 73); frame();
down('Numpad8', 104); frame();
check('T28e Numpad still moves P3', CoopLocal.keys(3).up === true);
up('Numpad8', 104); frame();
setList.cursorLeft(); // vuelve a "Numpad + IJKL"
check('T28f back to Numpad + IJKL', ConfigManager.makeData().coopSettings.p3Keys === 'all');
// mandos apagados: un mando libre no une a nadie
selectSetting('gamepads'); setList.cursorRight();
var padD = makePad(5); __pads = []; __pads[5] = padD;
var before4 = !!$gamePlayer4;
padBtn(padD, 9, true); frame(); padBtn(padD, 9, false); frame(); frame();
check('T28g gamepads off: Start does not join', !!$gamePlayer4 === before4);
setList.cursorRight(); // mandos otra vez
check('T28h gamepads on again', ConfigManager.makeData().coopSettings.gamepads === true);
// la configuracion guardada se aplica al cargarla
ConfigManager.applyData({ coopSettings: { camera: 'shared', splitZoom: 'near' } });
check('T28i loaded config: camera shared', CoopLocal.cameraSetting() === 0, CoopLocal.cameraSetting());
check('T28j loaded config: values kept', ConfigManager.makeData().coopSettings.splitZoom === 'near');
ConfigManager.applyData({ coopSettings: { camera: 'auto', splitZoom: 'far' } });
check('T28k invalid values are ignored', (ConfigManager.applyData({ coopSettings: { p3Keys: 'banana' } }), ConfigManager.makeData().coopSettings.p3Keys === 'all'));

// --- T29: disparo de P2 segun el juego (Termina: pistola / Fear & Hunger 1: arco) ---
(function() {
    var isTermina = /termina/i.test($dataSystem.gameTitle);
    $gameMap._interpreter.clear(); $gameMessage.clear();
    SceneManager._scene = scene;
    // P2 lleva al Caballero (actor 3, con interruptor SELECT propio en los dos juegos)
    var wanted = 3;
    if ($gameParty._actors.indexOf(wanted) < 0) $gameParty._actors.push(wanted);
    $gameParty._actors.splice($gameParty._actors.indexOf(wanted), 1);
    $gameParty._actors.splice(1, 0, wanted);
    $gamePlayer2._coopActorId = wanted;
    var p2a = $gameActors.actor(wanted);
    var weaponId = isTermina ? 13 : 11; // pistola / arco corto
    p2a.forceChangeEquip(0, $dataWeapons[weaponId]);
    check('T29 ' + (isTermina ? 'pistol' : 'bow') + ' equipped on P2 (' + p2a.name() + ')', p2a.weapons().some(function(w) { return w.id === weaponId; }));
    var story = [2252, 2253, 2254].map(function(id) { return $gameSwitches.value(id); });
    [242, 243, 244, 245, 246].forEach(function(id) { $gameSwitches.setValue(id, false); });
    $gameSwitches.setValue(410, false); $gameSwitches.setValue(297, false); $gameSwitches.setValue(300, false);
    for (var k = 0; k < 30; k++) frame();
    $gamePlayer.setDirection(6); $gamePlayer2.setDirection(4); // P1 mira a la derecha, P2 a la izquierda
    down('ShiftRight', 16, 2); frame(); frame();
    var selectOn = $gameSwitches.value(242);
    var after = [2252, 2253, 2254].map(function(id) { return $gameSwitches.value(id); });
    check('T29b P2 shot: the game sees the Knight as shooter (KNIGHT_SELECT on)', selectOn === true);
    var shotEv = $gameMap.events().filter(function(e) { return e && e.event().name === 'arrow_check'; })[0];
    var otherEv2 = $gameMap.events().filter(function(e) { return e && e.event().name !== 'arrow_check' && e.event().name !== 'arrow_player'; })[0];
    if (shotEv && otherEv2) {
        var it1 = new Game_Interpreter(); it1._eventId = shotEv.eventId();
        var it2 = new Game_Interpreter(); it2._eventId = otherEv2.eventId();
        check('T29e during the shot, arrow_check sees P2 as "the player" (flash animation on P2)', it1.character(-1) === $gamePlayer2);
        check('T29f other events still see P1', it2.character(-1) === $gamePlayer);
        if (shotEv._interpreter) check('T29h what the shot starts belongs to P2 (a battle from the hit is for P2)', shotEv._interpreter._coopStarter === 2, shotEv._interpreter._coopStarter);
    }
    if (isTermina) {
        check('T29g the flash follows where P2 looks (FACE_LEFT on, FACE_RIGHT off)', $gameSwitches.value(12) === true && $gameSwitches.value(13) === false,
            [10, 11, 12, 13].map(function(id) { return $gameSwitches.value(id); }).join(','));
    }
    if (isTermina) {
        check('T29c Termina: pistol switch on during the shot', after[2] === true, after.join(','));
    } else {
        check('T29c Fear & Hunger 1: story switches 2252-2254 untouched', after.join(',') === story.join(','), story.join(',') + ' -> ' + after.join(','));
    }
    up('ShiftRight', 16, 2);
    for (k = 0; k < 40; k++) frame();
    var shotEv2 = $gameMap.events().filter(function(e) { return e && e.event().name === 'arrow_check'; })[0];
    if (shotEv2 && shotEv2._interpreter) check('T29i after the shot, shots belong to nobody again (shots of P1 stay with P1)', !shotEv2._interpreter._coopStarter, shotEv2._interpreter._coopStarter);
    check('T29d after the shot the switches are restored', $gameSwitches.value(242) === false && [2252, 2253, 2254].map(function(id) { return $gameSwitches.value(id); }).join(',') === story.join(','));
    p2a.forceChangeEquip(0, null);
})();

// --- T30: co-op local apagado (Opciones > Co-op > Local co-op: Off) ---
(function() {
    $gameMap._interpreter.clear(); $gameMessage.clear();
    SceneManager._scene = scene;
    for (var k = 0; k < 10; k++) frame();
    var hadP2 = !!$gamePlayer2;
    var offScene = new Scene_CoopSettings(); offScene.create();
    var lst = offScene._coopList;
    lst.select(0); lst.cursorRight();
    SceneManager._scene = scene;
    check('T30 local co-op off: saved in the config', ConfigManager.makeData().coopSettings.localCoop === false);
    check('T30b local players leave (their characters follow the party)', hadP2 && !$gamePlayer2 && !$gamePlayer3 && !$gamePlayer4);
    // Enter y X ya no unen a P2
    for (k = 0; k < 5; k++) frame();
    down('Enter', 13); frame(); up('Enter', 13); frame();
    down('KeyX', 88); frame(); up('KeyX', 88); frame();
    for (k = 0; k < 5; k++) frame();
    check('T30c Enter / X do not join P2', !$gamePlayer2 && !CoopLocal.isOn());
    // las flechas son de P1 (como en el juego normal)
    SceneManager._scene = scene;
    $gameMap._interpreter.clear(); $gameMessage.clear();
    down('ArrowUp', 38); frame();
    check('T30d arrows are P1 keys again', Input.isPressed('up'));
    up('ArrowUp', 38); frame();
    // un mando libre no une a nadie
    var padE = makePad(6); __pads = []; __pads[6] = padE;
    padBtn(padE, 9, true); frame(); padBtn(padE, 9, false); frame(); frame();
    check('T30e gamepad Start does not join', !$gamePlayer2 && !$gamePlayer4);
    __pads = [];
    lst.cursorRight();
    SceneManager._scene = scene;
    check('T30f local co-op on again', ConfigManager.makeData().coopSettings.localCoop === true);
})();

// --- T31: aviso de nueva version ---
check('T31 newer version: 1.4.0 > 1.3.0', CoopLocal.versionNewer('1.4.0', '1.3.0'));
check('T31b same version is not newer', !CoopLocal.versionNewer('1.3.0', '1.3.0'));
check('T31c 1.10.0 > 1.9.2 (numbers, not text)', CoopLocal.versionNewer('1.10.0', '1.9.2'));
check('T31d older is not newer', !CoopLocal.versionNewer('1.2.5', '1.3.0'));
check('T31e update check saved with the config (on by default)', ConfigManager.makeData().coopSettings.updateCheck === true);

// --- T32: el personaje es del jugador ---
(function() {
    $gameMap._interpreter.clear(); $gameMessage.clear();
    SceneManager._scene = scene;
    for (var k = 0; k < 5; k++) frame();
    if (!$gamePlayer3) { $gameParty._actors = [1, 3, 4]; tap('KeyU', 85); for (k = 0; k < 5; k++) frame(); }
    var p3 = $gamePlayer3;
    if (!p3) { check('T32 setup: P3 joined', false); return; }
    var mine = p3._coopActorId;
    function runEvent(list) {
        var it = new Game_Interpreter();
        it.setup(list, 0);
        for (var i = 0; i < 200 && it.isRunning(); i++) it.update();
    }
    // un evento de la historia quita su personaje: se queda
    runEvent([{ code: 129, indent: 0, parameters: [mine, 1, false] }, { code: 0, indent: 0, parameters: [] }]);
    for (k = 0; k < 5; k++) frame();
    check("T32 story removes P3's character: it stays with P3", !!$gamePlayer3 && $gamePlayer3._coopActorId === mine && $gameParty._actors.indexOf(mine) >= 0,
        ($gamePlayer3 ? $gamePlayer3._coopActorId : 'gone') + ' party=' + $gameParty._actors);
    // si de todas formas sale (otro plugin, escena en solitario...), espera al suyo y no toma a otro libre
    var spare = [6, 7, 8, 9, 10].filter(function(id) { return $dataActors[id] && $gameParty._actors.indexOf(id) < 0; })[0];
    $gameParty.addActor(spare);
    for (k = 0; k < 5; k++) frame();
    $gameParty.removeActor(mine);
    for (k = 0; k < 10; k++) frame();
    check('T32b gone anyway: P3 waits for its character, does not take the free one', !$gamePlayer3 && $gameParty._actors.indexOf(spare) >= 0,
        ($gamePlayer3 ? $gamePlayer3._coopActorId : 'waiting') + ' free=' + spare);
    $gameParty.addActor(mine);
    for (k = 0; k < 10; k++) frame();
    check('T32c P3 comes back with its own character', !!$gamePlayer3 && $gamePlayer3._coopActorId === mine, $gamePlayer3 && $gamePlayer3._coopActorId);
    $gameParty.removeActor(spare);
    for (k = 0; k < 5; k++) frame();
    // parte en solitario de Termina: ahi si se va (y vuelve con "temporary_party_back")
    var solo = $dataCommonEvents.filter(function(ce) { return ce && /temporary_party_remove/i.test(ce.name); })[0];
    var back = $dataCommonEvents.filter(function(ce) { return ce && /temporary_party_back/i.test(ce.name); })[0];
    if (solo && back) {
        runEvent(solo.list);
        for (k = 0; k < 10; k++) frame();
        check('T32d solo part of the story: the character leaves, P3 waits', !$gamePlayer3 && $gameParty._actors.indexOf(mine) < 0, 'party=' + $gameParty._actors);
        $gameParty.addActor(1); // la parte en solitario: el protagonista
        for (k = 0; k < 5; k++) frame();
        runEvent(back.list);
        for (k = 0; k < 10; k++) frame();
        // (la vuelta termina con el reordenado del grupo de Termina, que elige al lider segun la
        // historia: si eligio al personaje de P3, ese es de P1)
        var leadIsMine = $gameParty._actors[0] === mine;
        check('T32e after the solo part P3 is back with its character', leadIsMine || (!!$gamePlayer3 && $gamePlayer3._coopActorId === mine),
            ($gamePlayer3 && $gamePlayer3._coopActorId) + ' party=' + $gameParty._actors);
    }
})();

__results.join('\n') + '\n--log--\n' + __log.join('\n');
