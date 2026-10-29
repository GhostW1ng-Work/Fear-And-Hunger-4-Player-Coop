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
$gamePlayer.locate(px - 3, py); // (lejos: un paso o dos no cuentan)
var d0 = Math.abs($gamePlayer2.x - $gamePlayer.x);
for (f = 0; f < 120; f++) { $gamePlayer.updateRoutineMove && $gamePlayer.updateRoutineMove(); frame(); }
var d1 = Math.abs($gamePlayer2.x - $gamePlayer.x) + Math.abs($gamePlayer2.y - $gamePlayer.y);
check('T20b the route takes P1 3 tiles away: P2 walks to P1', d1 < d0 && d1 <= 2, d0 + ' -> ' + d1);
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

    // ---- muerte de P3 y resurreccion con una piedra de alma ----
    if (window.CoopRevive && CoopRevive.soulStone()) {
        for (k = 0; k < 10; k++) frame();
        if (!$gamePlayer3 && $gameParty._actors.indexOf(mine) < 0) $gameParty.addActor(mine);
        for (k = 0; k < 10; k++) frame();
        // (tras la parte en solitario el lider puede ser el de P3: entonces se prueba con P2)
        var who = [3, 2, 4].filter(function(n) { return CoopLocal.player(n) && CoopLocal.player(n)._coopActorId !== $gameParty._actors[0]; })[0];
        if (!who) {
            var free = [3, 4, 5, 6, 7].filter(function(id) { return $dataActors[id] && id !== $gameParty._actors[0]; })[0];
            if ($gameParty._actors.indexOf(free) < 0) $gameParty.addActor(free);
            SceneManager._scene.spawnPlayer(2, free, true);
            for (k = 0; k < 10; k++) frame();
            who = 2;
        }
        var whoP = function() { return CoopLocal.player(who); };
        mine = whoP()._coopActorId;
        var dead = $gameActors.actor(mine);
        var fx = CoopRevive.deathEffectsOf(mine);
        check('T33 the death effects of the game are known (deathCheck)', fx.switches.length > 0, JSON.stringify(fx));
        dead.addState(dead.deathStateId());
        check('T33b P3 died: no game over (the party goes on)', !$gameParty.isAllDead());
        fx.switches.forEach(function(id) { $gameSwitches.setValue(id, true); });
        $gameParty.removeActor(mine); // lo que hace deathCheck
        for (k = 0; k < 10; k++) frame();
        var body = CoopRevive.corpses().filter(function(c) { return c.actorId === mine; })[0];
        check('T33c the body stays on the map, P3 waits', !!body && !whoP(), JSON.stringify(body));
        if (!body) return;
        // el cadaver del propio juego (Fear & Hunger 1: evento "DeadDarkpriest" con "DarkpriestBODY")
        var bodySw = CoopRevive.bodySwitchesOf(mine);
        bodySw.forEach(function(id) { $gameSwitches.setValue(id, true); });
        var stone = CoopRevive.soulStone();
        $gameParty.gainItem(stone, 1);
        body.x = $gamePlayer.x;
        body.y = $gamePlayer.y;
        for (k = 0; k < 25; k++) frame();
        var ss = SceneManager._scene._spriteset;
        var bodySprites = function() { return ss ? (ss._coopCorpseSprites || []).filter(function(sp) { return !!sp.parent; }).length + '/' + (ss._coopCorpseNames || []).filter(function(sp) { return !!sp.parent; }).length : 'no spriteset'; };
        var spritesBefore = bodySprites();
        var gev = CoopRevive.gameBodyEvent(mine);
        if (gev) {
            check('T33c2 the body of the game lies where P3 died', gev.x === body.x && gev.y === body.y, gev.x + ',' + gev.y + ' vs ' + body.x + ',' + body.y);
            gev.locate(0, 0); // como al salir del mapa y volver: el evento vuelve a su sitio inicial
            for (k = 0; k < 5; k++) frame();
            check('T33c3 back on the map: the body is still where P3 died', gev.x === body.x && gev.y === body.y, gev.x + ',' + gev.y);
        }
        $gamePlayer.checkEventTriggerHere([0]);
        check('T33d OK on the body: the "bring them back?" question', $gameMap._interpreter.isRunning() && $gameMap._interpreter._coopRevive === $gameMap._interpreter._list);
        $gameMap._interpreter.clear();
        var leader = $gameParty.leader();
        leader.setMp(leader.mmp);
        CoopRevive.revive(mine, 1);
        for (k = 0; k < 10; k++) frame();
        check('T33e back in the party with 30% HP and mind, the stone is gone',
            $gameParty._actors.indexOf(mine) >= 0 && dead.isAlive() && dead.hp === Math.max(1, Math.round(dead.mhp * 0.3)) && !$gameParty.hasItem(stone),
            dead.hp + '/' + dead.mhp + ' stones=' + $gameParty.numItems(stone));
        check('T33f the game no longer sees them dead (switches off)', fx.switches.every(function(id) { return !$gameSwitches.value(id); }));
        check('T33f2 the body of the game is gone too (its BODY switch off)', bodySw.every(function(id) { return !$gameSwitches.value(id); }), 'body switches ' + JSON.stringify(bodySw));
        check('T33g the one who did it lost mind', leader.mp === leader.mmp - Math.round(leader.mmp * 0.3), leader.mp + '/' + leader.mmp);
        check('T33h P3 plays their character again', !!whoP() && whoP()._coopActorId === mine, (whoP() && whoP()._coopActorId));
        check('T33i the body is gone', CoopRevive.corpses().length === 0);
        for (k = 0; k < 25; k++) frame();
        if (ss) check('T33j the body picture is gone too', bodySprites() === '0/0', 'before ' + spritesBefore + ' after ' + bodySprites());
        // "Revive with soul stones: Off": la muerte es para siempre (no queda cuerpo que revivir)
        CoopLocal.setSetting('reviveAllowed', false);
        var dead2 = $gameActors.actor(mine);
        dead2.addState(dead2.deathStateId());
        $gameParty.removeActor(mine);
        for (k = 0; k < 10; k++) frame();
        check('T33k revive Off: no body to revive, the player waits', CoopRevive.corpses().length === 0 && !whoP(),
            JSON.stringify(CoopRevive.corpses()));
        CoopLocal.setSetting('reviveAllowed', true);
        dead2.removeState(dead2.deathStateId());
        dead2.setHp(dead2.mhp);
        $gameParty.addActor(mine);
        for (k = 0; k < 10; k++) frame();
        // truco del menu "Co-op": la ultima fila da una piedra
        var before = $gameParty.numItems(stone);
        var err = '';
        try {
            var w = new Window_CoopAssign(0, 0, 816, 500);
            for (var rr = $gameParty.members().length; rr < w.maxItems(); rr++) {
                if (/soul|lesser/i.test(w.actionAt(rr).name())) w.select(rr);
            }
            w.processOk();
        } catch (e) { err = e.message; }
        check('T34 Co-op menu cheat gives a soul stone', $gameParty.numItems(stone) === before + 1, before + ' -> ' + $gameParty.numItems(stone) + ' ' + err);

        // trucos: inmortal, sin perder miembros, enemigos de un golpe
        var hero = $gameParty.leader();
        var limb = $dataStates.filter(function(st) { return st && /^(arm cut|leg cut)/i.test(st.name); })[0];
        CoopLocal.setSetting('cheatGod', true);
        CoopLocal.setSetting('cheatLimbs', true);
        hero.setHp(0);
        hero.addState(hero.deathStateId());
        if (limb) hero.addState(limb.id);
        check('T35 cheat immortal: HP stays at 1, no death', hero.hp === 1 && !hero.isDead(), hero.hp + ' dead=' + hero.isDead());
        check('T35b cheat keep limbs: no limb cut', !limb || !hero.isStateAffected(limb.id), limb && limb.name);
        CoopLocal.setSetting('cheats', false);
        hero.setHp(0);
        check('T35c with Cheats Off the cheats do nothing', hero.isDead(), hero.hp);
        hero.removeState(hero.deathStateId());
        hero.setHp(hero.mhp);
        if (limb) hero.removeState(limb.id);
        CoopLocal.setSetting('cheats', true);
        CoopLocal.setSetting('cheatGod', false);
        CoopLocal.setSetting('cheatLimbs', false);
        CoopLocal.setSetting('cheatOneShot', true);
        var foe = new Game_Enemy(1, 0, 0);
        var act = new Game_Action(hero);
        act.setAttack();
        var dmg = act.makeDamageValue(foe, false);
        check('T35d cheat one-hit kills: the damage is at least the enemy HP', dmg >= foe.hp || foe.hp === 0, dmg + ' vs ' + foe.hp);
        CoopLocal.setSetting('cheatOneShot', false);
        // abrir cerraduras: "si tiene la llave" es si
        var keyItem = $dataItems.filter(function(i) { return i && /\bkeys?\b/i.test(i.name); })[0];
        if (keyItem) {
            $gameParty.loseItem(keyItem, 99);
            var it36 = new Game_Interpreter();
            it36.setup([{ code: 111, indent: 0, parameters: [8, keyItem.id] }, { code: 121, indent: 1, parameters: [1999, 1999, 0] },
                { code: 0, indent: 1, parameters: [] }, { code: 412, indent: 0, parameters: [] }, { code: 0, indent: 0, parameters: [] }], 0);
            $gameSwitches.setValue(1999, false);
            CoopLocal.setSetting('cheatUnlock', true);
            for (k = 0; k < 5 && it36.isRunning(); k++) it36.update();
            check('T36 cheat open locks: "has the key?" says yes', $gameSwitches.value(1999), keyItem.name);
            CoopLocal.setSetting('cheatUnlock', false);
            $gameSwitches.setValue(1999, false);
        }
        // reponer vida, mente y hambre; antorchas
        var wNow = new Window_CoopAssign(0, 0, 816, 500);
        var rows = [];
        for (var r = $gameParty.members().length; r < wNow.maxItems(); r++) rows.push(wNow.actionAt(r).name());
        hero.setHp(1);
        hero.setMp(0);
        var restoreRow = rows.findIndex(function(t) { return /restore/i.test(t); });
        wNow.select($gameParty.members().length + restoreRow);
        wNow.processOk();
        check('T36b cheat restore: full HP and mind', restoreRow >= 0 && hero.hp === hero.mhp && hero.mp === hero.mmp,
            hero.hp + '/' + hero.mhp + ' ' + hero.mp + '/' + hero.mmp + ' dead=' + hero.isDead() + ' inParty=' + ($gameParty.members().indexOf(hero) >= 0));
        var torch = $dataItems.filter(function(i) { return i && i.name === 'Torch'; })[0];
        var torches = torch ? $gameParty.numItems(torch) : -1;
        wNow.select($gameParty.members().length + rows.findIndex(function(t) { return /torches/i.test(t); }));
        wNow.processOk();
        check('T36c cheat fire: torches given', !!torch && $gameParty.numItems(torch) === torches + 3, torches + ' -> ' + (torch && $gameParty.numItems(torch)));
    }

    // ---- la antorcha que enciende P2 desde su menu es suya (luz, tiempo, dibujo) ----
    var carrierN = [2, 3, 4].filter(function(n) { return !!CoopLocal.player(n); })[0];
    var lightCe = $dataCommonEvents.filter(function(ce) { return ce && /^light torch$/i.test(ce.name); })[0];
    if (carrierN && lightCe && !window.__skipT37) {
        var cp = CoopLocal.player(carrierN);
        var gameVarsBefore = $gameVariables._data.join(',');
        var gameSwBefore = $gameSwitches._data.map(function(v, i) { return v ? i : ''; }).join(',');
        var li = new Game_Interpreter();
        li.setup(lightCe.list.filter(function(c) { return c.code !== 101 && c.code !== 401; }), 0); // (sin el mensaje)
        li._coopUsedItem = true; // (como el evento comun del objeto)
        li._coopStarter = carrierN;
        for (k = 0; k < 20 && li.isRunning(); k++) li.update();
        var tc = CoopRevive.torches()[carrierN];
        check('T37 P' + carrierN + ' lights a torch from their menu: it is theirs', !!tc && tc.actorId === cp.actor().actorId() && tc.units > 0 && tc.radius > 0, JSON.stringify(tc));
        check("T37b the game's torch (P1's timer and switch) is not touched", $gameVariables._data.join(',') === gameVarsBefore &&
            $gameSwitches._data.map(function(v, i) { return v ? i : ''; }).join(',') === gameSwBefore);
        var torchSwP = Object.keys($dataSystem.switches).filter(function(id) {
            return /_torch$/i.test($dataSystem.switches[id] || '');
        });
        for (k = 0; k < 3; k++) frame();
        var onNames = torchSwP.filter(function(id) { return $gameSwitches.value(Number(id)); }).map(function(id) { return $dataSystem.switches[id]; });
        if (torchSwP.length > 0) {
            var words = cp.actor().name().toLowerCase().split(/[^a-z]+/).filter(function(w) { return w.length > 2; });
            check('T37c the torch in the hand: on ' + cp.actor().name() + ' (P' + carrierN + ') only',
                onNames.length === 1 && words.some(function(w) { return onNames[0].toLowerCase().indexOf(w.slice(0, 4)) === 0; }), 'on: ' + onNames.join(','));
        }
        tc.units = 1;
        tc.wait = 1;
        for (k = 0; k < 3; k++) frame();
        check('T37d it burns out by itself (and the torch in the hand goes)', !CoopRevive.torches()[carrierN] &&
            torchSwP.every(function(id) { return !$gameSwitches.value(Number(id)); }), JSON.stringify(CoopRevive.torches()));
    }

    // ---- la luz que el juego pone alrededor de P1 la tiene tambien cada jugador ----
    if (carrierN) {
        var lt = CoopRevive.lightTest;
        var lcalls = [];
        var fakeBmp = { _context: { globalCompositeOperation: 'source-over' },
            radialgradientFillRect: function(x, y, r1, r2, c) { lcalls.push([x, y, r2, c, this._context.globalCompositeOperation]); } };
        lt.watchPlayerLight(fakeBmp);
        var lmask = { _maskBitmap: fakeBmp };
        var lp = CoopLocal.player(carrierN);
        lp.locate($gamePlayer.x + 4, $gamePlayer.y);
        var tw = $gameMap.tileWidth(), th = $gameMap.tileHeight();
        var sx = function(ch) { return tw / 2 + $gameMap.adjustX(ch._realX) * tw; };
        var sy = function(ch) { return th / 2 + $gameMap.adjustY(ch._realY) * th; };
        lt.beginMask(lmask);
        fakeBmp._coopFilled = true; // (la mascara se dibuja este cuadro)
        fakeBmp._context.globalCompositeOperation = 'lighter';
        fakeBmp.radialgradientFillRect(sx($gamePlayer), sy($gamePlayer) - 10, 20, 325, '#FFEEDD', '#000000', false, 0); // la de P1
        fakeBmp._context.globalCompositeOperation = 'source-over';
        lt.endMask(lmask);
        var mine = lcalls[1];
        check('T41 P' + carrierN + ' has the same light as P1 around them (not darkness)', lcalls.length === 2 && !!mine &&
            mine[0] === sx(lp) && mine[1] === sy(lp) - 10 && mine[2] === 325 && mine[3] === '#FFEEDD' && mine[4] === 'lighter', JSON.stringify(lcalls));
        // la camara a la derecha de P1 (en otro PC mira a su personaje): TerraxLighting pide la luz
        // de P1 "al otro lado del mapa"; va en su sitio y la de P2 tambien sale
        var oldDx = $gameMap._displayX;
        $gameMap._displayX = $gamePlayer._realX + 1;
        lcalls = [];
        lt.beginMask(lmask);
        fakeBmp._coopFilled = true;
        fakeBmp._context.globalCompositeOperation = 'lighter';
        var jumpX = tw / 2 + ($gameMap.width() - Math.floor($gameMap.displayX() - $gamePlayer._realX)) * tw;
        fakeBmp.radialgradientFillRect(jumpX, sy($gamePlayer) - 10, 20, 325, '#FFEEDD', '#000000', false, 0);
        fakeBmp._context.globalCompositeOperation = 'source-over';
        lt.endMask(lmask);
        check('T41b camera right of P1: P1 light where P1 is (not across the map), P' + carrierN + ' has one too',
            lcalls.length === 2 && lcalls[0][0] === sx($gamePlayer) && lcalls[1][0] === sx(lp), 'jump ' + jumpX + ' ' + JSON.stringify(lcalls));
        $gameMap._displayX = oldDx;
        lp.locate($gamePlayer.x, $gamePlayer.y);
    }

    // ---- el personaje que lleva P2 no esta ademas como NPC (paginas vacias "ya en el grupo") ----
    var hp = carrierN && CoopLocal.player(carrierN);
    var hx = hp && hp.actor() && hp.actor().actorId();
    var freeSw = function(from) { for (var i = from; i < from + 400; i++) if (!$dataSystem.switches[i] && !$gameSwitches.value(i)) return i; return 0; };
    if (hx) {
        var joinSw = freeSw(4600), otherSw = freeSw(joinSw + 1);
        var origNames = [$dataSystem.switches[joinSw], $dataSystem.switches[otherSw]];
        $dataSystem.switches[joinSw] = 'Test_InTheParty!';
        $dataSystem.switches[otherSw] = 'Test_unrelated';
        var npcImg = { characterName: 'npc', characterIndex: 0, direction: 2, pattern: 1, tileId: 0 };
        var noImg = { characterName: '', characterIndex: 0, direction: 2, pattern: 1, tileId: 0 };
        var cond = function(sw) { return { actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: 'A', selfSwitchValid: false,
            switch1Id: sw || 1, switch1Valid: !!sw, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 }; };
        var pg = function(sw, img, list) { return { conditions: cond(sw), image: img, list: list, moveType: 0, moveSpeed: 3, moveFrequency: 3,
            moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false }, walkAnime: true, stepAnime: false, directionFix: false, through: false, priorityType: 1, trigger: 0 }; };
        var recruit = [{ code: 121, indent: 0, parameters: [joinSw, joinSw, 0] }, { code: 129, indent: 0, parameters: [hx, 0, false] }, { code: 0, indent: 0, parameters: [] }];
        var talk = [{ code: 101, indent: 0, parameters: ['', 0, 0, 2] }, { code: 0, indent: 0, parameters: [] }];
        var realDataMap = $dataMap;
        $dataMap = Object.assign({}, realDataMap, { events: realDataMap.events.slice() }); // (otro mapa cargado)
        var idA = $dataMap.events.length, idB = idA + 1;
        // A: el NPC que se contrata (pagina 1: "ya en el grupo" vacia); B: otro evento con una pagina vacia por otra cosa
        $dataMap.events[idA] = { id: idA, name: 'npc_test', note: '', x: 0, y: 0, pages: [pg(0, npcImg, recruit), pg(joinSw, noImg, [{ code: 0, indent: 0, parameters: [] }])] };
        $dataMap.events[idB] = { id: idB, name: 'other_test', note: '', x: 1, y: 0, pages: [pg(0, npcImg, talk), pg(otherSw, noImg, [{ code: 0, indent: 0, parameters: [] }])] };
        var evA = new Game_Event($gameMap.mapId(), idA), evB = new Game_Event($gameMap.mapId(), idB);
        $gameMap._events[idA] = evA; $gameMap._events[idB] = evB;
        for (k = 0; k < 3; k++) frame();
        evA.refresh(); evB.refresh();
        check('T42 the NPC of the character P' + carrierN + ' plays is hidden (its "in the party" page)', evA._pageIndex === 1 && evB._pageIndex === 0,
            'A page ' + evA._pageIndex + ' B page ' + evB._pageIndex + ' by ' + JSON.stringify(CoopRevive.npcSwitchesByActor()[hx]));
        check('T42b the game switch itself is not touched', !$gameSwitches.value(joinSw));
        CoopLocal.setSetting('hideNpcs', false); // el anfitrion lo quiere como en el juego
        for (k = 0; k < 3; k++) frame();
        evA.refresh();
        check("T42f setting \"Played characters' NPCs: Shown\": the NPC stays", evA._pageIndex === 0, 'A page ' + evA._pageIndex);
        CoopLocal.setSetting('hideNpcs', true);
        for (k = 0; k < 3; k++) frame();
        evA.refresh();
        // P2 deja el personaje: el NPC vuelve
        // "esperando": el juego apaga ese interruptor al contratarle; y si asi saldria otra pagina con algo, nada
        var waitSw = freeSw(otherSw + 1), sceneSw = freeSw(waitSw + 1);
        var origNames2 = [$dataSystem.switches[waitSw], $dataSystem.switches[sceneSw]];
        $dataSystem.switches[waitSw] = 'Test_waiting_at_train';
        $dataSystem.switches[sceneSw] = 'Test_scene_waiting';
        $gameSwitches.setValue(waitSw, true);
        $gameSwitches.setValue(sceneSw, true);
        var recruitOff = function(sw) { return [{ code: 121, indent: 0, parameters: [sw, sw, 1] }, { code: 129, indent: 0, parameters: [hx, 0, false] }, { code: 0, indent: 0, parameters: [] }]; };
        var idC = idB + 1, idD = idB + 2;
        $dataMap = Object.assign({}, $dataMap, { events: $dataMap.events.slice() });
        $dataMap.events[idC] = { id: idC, name: 'waiting_test', note: '', x: 2, y: 0, pages: [pg(waitSw, npcImg, recruitOff(waitSw))] };
        $dataMap.events[idD] = { id: idD, name: 'scene_test', note: '', x: 3, y: 0, pages: [pg(0, npcImg, talk), pg(sceneSw, npcImg, recruitOff(sceneSw))] };
        var evC = new Game_Event($gameMap.mapId(), idC), evD = new Game_Event($gameMap.mapId(), idD);
        $gameMap._events[idC] = evC; $gameMap._events[idD] = evD;
        for (k = 0; k < 3; k++) frame();
        evC.refresh(); evD.refresh();
        check('T42d the NPC waiting for them (switch the game turns off when hiring) is hidden too', evC._pageIndex === -1, 'C page ' + evC._pageIndex);
        check('T42e but if that would show something else (a scene), the game page stays', evD._pageIndex === 1, 'D page ' + evD._pageIndex);
        $gameSwitches.setValue(waitSw, false);
        $gameSwitches.setValue(sceneSw, false);
        delete $gameMap._events[idC]; delete $gameMap._events[idD];
        $dataSystem.switches[waitSw] = origNames2[0]; $dataSystem.switches[sceneSw] = origNames2[1];
        $gameParty.removeActor(hx); // (sale del grupo: P2 espera)
        for (k = 0; k < 5; k++) frame();
        evA.refresh();
        check('T42c nobody plays it any more: the NPC is back', evA._pageIndex === 0, 'A page ' + evA._pageIndex + ' P2 ' + (CoopLocal.player(carrierN) ? 'plays' : 'waits'));
        $gameParty.addActor(hx);
        for (k = 0; k < 10; k++) frame();
        delete $gameMap._events[idA]; delete $gameMap._events[idB];
        $dataMap = realDataMap;
        $dataSystem.switches[joinSw] = origNames[0]; $dataSystem.switches[otherSw] = origNames[1];
        for (k = 0; k < 3; k++) frame();
    }

    // ---- (con el plugin de red) un combate de una escena que empieza sola ("Autorun"): el evento no se
    // aparta (con el mapa libre volveria a empezar desde el principio: Per'kele en la torre) ----
    if (window.CoopNet && CoopNet.isAutorunRoot) {
        var arCond = { actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: 'A', selfSwitchValid: false,
            switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 };
        var arPage = function(trigger) { return { conditions: arCond, image: { characterName: '', characterIndex: 0, direction: 2, pattern: 0, tileId: 0 },
            list: [{ code: 301, indent: 0, parameters: [0, 1, false, false] }, { code: 0, indent: 0, parameters: [] }], moveType: 0, moveSpeed: 3, moveFrequency: 3,
            moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false }, walkAnime: true, stepAnime: false, directionFix: false, through: false, priorityType: 1, trigger: trigger }; };
        var realMap2 = $dataMap;
        $dataMap = Object.assign({}, realMap2, { events: realMap2.events.slice() });
        var idAr = $dataMap.events.length, idTalk = idAr + 1;
        $dataMap.events[idAr] = { id: idAr, name: 'autorun_test', note: '', x: 0, y: 1, pages: [arPage(3)] };
        $dataMap.events[idTalk] = { id: idTalk, name: 'talk_test', note: '', x: 1, y: 1, pages: [arPage(0)] };
        $gameMap._events[idAr] = new Game_Event($gameMap.mapId(), idAr);
        $gameMap._events[idTalk] = new Game_Event($gameMap.mapId(), idTalk);
        $gameMap._events[idAr]._erased = true; // (que no empiece de verdad)
        var itAr = new Game_Interpreter(), itTalk = new Game_Interpreter();
        $gameMap._events[idAr]._erased = false;
        $gameMap._events[idAr].refresh(); $gameMap._events[idTalk].refresh();
        itAr.setup($dataMap.events[idAr].pages[0].list, idAr);
        itTalk.setup($dataMap.events[idTalk].pages[0].list, idTalk);
        check('T46 a battle from a scene that starts by itself (Autorun) keeps its event (the map waits), one from talking to someone does not',
            CoopNet.isAutorunRoot(itAr) === true && CoopNet.isAutorunRoot(itTalk) === false,
            'autorun ' + CoopNet.isAutorunRoot(itAr) + ' talk ' + CoopNet.isAutorunRoot(itTalk));
        delete $gameMap._events[idAr]; delete $gameMap._events[idTalk];
        $dataMap = realMap2;
    }

    // ---- (con el plugin de red) dos combates aparte a la vez: cada uno ve sus interruptores y variables ----
    if (window.CoopNet && CoopNet.withBattle && CoopNet.battles) {
        var fakeBattle = function(n) { return { scene: new Scene_Base(), stack: [], involved: [n], inputs: {}, message: new Game_Message(), screen: new Game_Screen(),
            temp: new Game_Temp(), inBattle: true, troop: new Game_Troop(), bm: {}, scope: { sw: {}, vars: {} } }; };
        var bA = fakeBattle(2), bB = fakeBattle(3);
        var list = CoopNet.battles();
        list.push(bA, bB);
        var tsw = $dataSystem.switches.length - 1, tvar = $dataSystem.variables.length - 1;
        $gameSwitches.setValue(tsw, false);
        $gameVariables.setValue(tvar, 5);
        var seen = {};
        CoopNet.withBattle(bA, function() { $gameSwitches.setValue(tsw, true); $gameVariables.setValue(tvar, 7); seen.a = [$gameSwitches.value(tsw), $gameVariables.value(tvar)]; });
        CoopNet.withBattle(bB, function() { seen.b = [$gameSwitches.value(tsw), $gameVariables.value(tvar)]; $gameVariables.setValue(tvar, 9); seen.b2 = $gameVariables.value(tvar); });
        CoopNet.withBattle(bA, function() { seen.a2 = [$gameSwitches.value(tsw), $gameVariables.value(tvar)]; });
        seen.map = [$gameSwitches.value(tsw), $gameVariables.value(tvar)];
        check('T43 two battles at once: each sees its own switches / variables, not those of the other battle',
            JSON.stringify(seen.a) === '[true,7]' && JSON.stringify(seen.b) === '[false,5]' && seen.b2 === 9 && JSON.stringify(seen.a2) === '[true,7]',
            JSON.stringify(seen));
        check('T43b the map sees the latest values (they stay after the battles)', JSON.stringify(seen.map) === '[true,9]', JSON.stringify(seen.map));
        // lo que hace el evento del enemigo despues ("Recuperar todo" el grupo) no toca a quien lucha en otro combate
        list.splice(list.indexOf(bB), 1);
        var fighterP = CoopLocal.player(2);
        var fighterA = fighterP && fighterP.actor();
        if (fighterA) {
            bA.involved = [2];
            var lead = $gameParty.leader();
            fighterA.setHp(1);
            lead.setHp(1);
            var ai = new Game_Interpreter();
            ai.setup([{ code: 314, indent: 0, parameters: [0, 0] }, { code: 0, indent: 0, parameters: [] }], 0);
            ai._coopAfterBattle = true;
            var aerr = '';
            CoopNet.active = true;
            try { ai.update(); } catch (e) { aerr = String(e); } finally { CoopNet.active = false; }
            check('T43c after a battle, "recover all" while another battle runs: no error, the fighter of the other battle is not touched',
                !aerr && lead.hp === lead.mhp && fighterA.hp === 1, aerr + ' lead ' + lead.hp + '/' + lead.mhp + ' fighter ' + fighterA.hp);
            fighterA.setHp(fighterA.mhp);
        }
        list.splice(list.indexOf(bA), 1);
        $gameSwitches.setValue(tsw, false);
        $gameVariables.setValue(tvar, 0);
    }

    // ---- trucos de la torre (final B de Termina) ----
    if (window.CoopTower && /termina/i.test($dataSystem.gameTitle)) {
        var cs = CoopTower.contestants();
        var leftVar = $dataSystem.variables.indexOf('CHARACTERS_LEFT');
        var swBefore = cs.map(function(c) { return $gameSwitches.value(c.deadSwitch); });
        var leftBefore = $gameVariables.value(leftVar);
        $gameVariables.setValue(leftVar, 14);
        var inParty = cs.filter(function(c) { return c.actorId && $gameParty._actors.indexOf(c.actorId) >= 0; });
        check('T45 the 14 contestants with their dead / soul switches (and the character of those that can join)',
            cs.length === 14 && cs.every(function(c) { return c.deadSwitch > 0 && c.soul > 0; }) && cs.filter(function(c) { return c.actorId; }).length >= 8,
            cs.map(function(c) { return c.name + '/' + c.actorId; }).join(' '));
        cs.forEach(function(c) { $gameSwitches.setValue(c.deadSwitch, false); });
        CoopTower.kill();
        var dead = cs.filter(function(c) { return $gameSwitches.value(c.deadSwitch); });
        check('T45b kill cheat: everybody not in the party is dead, the party is not; contestants left = 14 - dead',
            dead.length === 14 - inParty.length && inParty.every(function(c) { return !$gameSwitches.value(c.deadSwitch); }) &&
            $gameVariables.value(leftVar) === 14 - dead.length,
            'dead ' + dead.length + ' in party ' + inParty.map(function(c) { return c.name; }) + ' left ' + $gameVariables.value(leftVar));
        cs.forEach(function(c, i) { $gameSwitches.setValue(c.deadSwitch, swBefore[i]); if (c.soul > 0) $gameSwitches.setValue(c.soul, false); });
        $gameVariables.setValue(leftVar, leftBefore);
    }

    // ---- PvP (Termina): P1 ataca a P2; hay dos dobles, cada uno es su personaje ----
    if (window.CoopPvp && /termina/i.test($dataSystem.gameTitle) && carrierN) {
        var defN = carrierN, defA = CoopLocal.player(defN).actor(), lead = $gameParty.leader();
        var limbNames = function(a) { return a.states().filter(function(st) { return /^(arm|leg) cut$/i.test(st.name); }).map(function(st) { return st.name; }); };
        var startPvp = function(lethal, backstab) {
            var tid = CoopPvp.troopFor(lead.actorId(), defA.actorId());
            var lb = {};
            [lead, defA].forEach(function(a) { lb[a.actorId()] = CoopPvp.snapshot(a); });
            CoopPvp.pending[tid] = { attacker: 1, defender: defN, attActorId: lead.actorId(), actorId: defA.actorId(), lethal: lethal, backstab: !!backstab, before: lb };
            BattleManager.setup(tid, true, false);
            $gameParty.onBattleStart();
        };
        var endPvp = function() {
            $gameParty.onBattleEnd();
            $gameParty._inBattle = false;
            $gameTroop._coopPvp = null;
            BattleManager._phase = '';
        };
        var runReserved = function() {
            var n = 0;
            while ($gameTemp.isCommonEventReserved() && n++ < 5) {
                var ce = $gameTemp.reservedCommonEvent();
                $gameTemp.clearCommonEvent();
                var it = new Game_Interpreter();
                it.setup(ce.list);
                for (var k = 0; k < 2000 && it.isRunning(); k++) { it.update(); if ($gameMessage.isBusy()) $gameMessage.clear(); }
            }
        };
        var armSw = CoopPvp.limbSwitches(defA.actorId()).arm;
        var mirrorOf = function(actor) { return $gameTroop.members().filter(function(e) { return e._coopMirror === actor.actorId(); })[0]; };
        var partOf = function(actor, kind) { return $gameTroop.members().filter(function(e) { return e._coopOwner === actor.actorId() && e._coopPart === kind; })[0]; };
        CoopLocal.setSetting('pvp', 'duel');
        defA.setHp(defA.mhp);
        lead.setHp(lead.mhp);
        startPvp(false);
        var mDef = mirrorOf(defA), mLead = mirrorOf(lead);
        check('T44 PvP: two doubles with the HP of the game\'s enemy (the character is at full HP: so is the double)',
            !!mDef && !!mLead && mDef.mhp === mDef.enemy().params[0] && mDef.hp === mDef.mhp && mLead.hp === mLead.mhp,
            (mDef ? mDef.enemy().name + ' ' + mDef.hp + '/' + mDef.mhp : 'no def double') + ' | ' + (mLead ? mLead.enemy().name + ' ' + mLead.hp + '/' + mLead.mhp : '-'));
        var bm = $gameParty.battleMembers();
        var act = new Game_Action(lead);
        act.setAttack();
        act.setTarget(mLead.index());
        var tLead = act.makeTargets();
        var act2 = new Game_Action(defA);
        act2.setAttack();
        act2.setTarget(mDef.index());
        var tDef = act2.makeTargets();
        check('T44b each one hits the double of the other (never their own)', bm.indexOf(lead) >= 0 && bm.indexOf(defA) >= 0 &&
            tLead.length > 0 && tLead.every(function(e) { return e._coopOwner === defA.actorId(); }) &&
            tDef.length > 0 && tDef.every(function(e) { return e._coopOwner === lead.actorId(); }),
            'P1 -> ' + tLead.map(function(e) { return e.enemy().name; }).join(',') + ' | P2 -> ' + tDef.map(function(e) { return e.enemy().name; }).join(','));
        mDef.setHp(mDef.hp - Math.round(mDef.mhp * 0.1));
        check('T44c 10% of the double\'s HP = 10% of the character\'s HP (several hits to win, not one)', defA.hp === Math.ceil(defA.mhp * 0.9),
            defA.hp + '/' + defA.mhp + ' double ' + mDef.hp + '/' + mDef.mhp);
        // piernas: la cabeza ya no esquiva; brazos: pega mas flojo
        var head = partOf(defA, 'head'), leg = partOf(defA, 'leg'), arm = partOf(defA, 'arm');
        var eva0 = head ? head.eva : 0;
        if (leg) leg.addState(leg.deathStateId());
        check('T44d leg cut off: the head of that double is easy to hit, "Leg cut" on the character', !head || (eva0 > 0.5 && head.eva <= 0.05) && limbNames(defA).indexOf('Leg cut') >= 0,
            'head eva ' + eva0 + ' -> ' + (head && head.eva) + ' states ' + limbNames(defA));
        if (arm) {
            arm.addState(arm.deathStateId());
            // el juego refresca la parte ya muerta y vuelve a ponerle la muerte: no es otro brazo
            arm._states = arm._states.filter(function(id) { return id !== arm.deathStateId(); });
            arm.refresh();
        }
        check('T44e arm cut off: that character hits much weaker', CoopPvp.armFactor(defA) < 1 && CoopPvp.armFactor(lead) === 1 && limbNames(defA).indexOf('Arm cut') >= 0,
            'factor ' + CoopPvp.armFactor(defA) + ' / ' + CoopPvp.armFactor(lead));
        // como en el combate: el interprete de la tropa (reservado + paginas) y el del mapa
        for (var q = 0; q < 60; q++) {
            if (!$gameTroop._interpreter.isRunning()) $gameTroop.setupBattleEvent();
            $gameTroop.updateInterpreter();
            if ($gameMessage.isBusy()) $gameMessage.clear();
            if (q === 30) { BattleManager._phase = 'turnEnd'; $gameTroop._eventFlags = {}; }
        }
        runReserved();
        check('T44e2 the game records ONE lost arm (its switch, as in a normal fight: battle picture, weapon)', armSw.length > 0 && $gameSwitches.value(armSw[0]) && !$gameSwitches.value(armSw[1]),
            'arm switches ' + armSw + ' -> ' + armSw.map(function(id) { return $gameSwitches.value(id); }));
        // huir ("Run") acaba el combate; sin muerte lo cortado vuelve
        var runCe = $dataCommonEvents.filter(function(ce) { return ce && /skills_run/i.test(ce.name); })[0];
        if (runCe) $gameTemp.reserveCommonEvent(runCe.id);
        check('T44f "Run" ends the PvP fight', !runCe || BattleManager.isAborting(), 'phase ' + BattleManager._phase);
        var hpBefore = defA.hp;
        BattleManager.endBattle(1);
        check('T44g not to the death: after the fight the cut limbs are back, HP stays as it was', limbNames(defA).length === 0 && defA.hp === hpBefore &&
            !armSw.some(function(id) { return $gameSwitches.value(id); }),
            'states ' + limbNames(defA) + ' hp ' + hpBefore + ' -> ' + defA.hp + ' switches ' + armSw.map(function(id) { return $gameSwitches.value(id); }));
        endPvp();
        // ya sin un brazo (de antes): el doble sale sin el (antes esto rompia el juego)
        if (armSw.length) {
            $gameSwitches.setValue(armSw[0], true);
            var okStart = true, err = '';
            try { startPvp(false); } catch (e) { okStart = false; err = String(e); }
            var arms = $gameTroop.members().filter(function(e) { return e._coopOwner === defA.actorId() && e._coopPart === 'arm'; });
            check('T44g2 an arm lost before the fight: the double starts without it (no crash)', okStart && arms.filter(function(e) { return e.isDead(); }).length === 1 && CoopPvp.armFactor(defA) < 1,
                err + ' dead arms ' + arms.filter(function(e) { return e.isDead(); }).length + '/' + arms.length);
            // a muerte y huye: lo perdido sigue perdido
            BattleManager.endBattle(1);
            endPvp();
            startPvp(true);
            arms = $gameTroop.members().filter(function(e) { return e._coopOwner === defA.actorId() && e._coopPart === 'arm' && e.isAlive(); });
            if (arms[0]) arms[0].addState(arms[0].deathStateId());
            runReserved();
            BattleManager.endBattle(1);
            check('T44g3 to the death, then running away: the limbs cut stay cut', armSw.length < 2 || (armSw.every(function(id) { return $gameSwitches.value(id); })),
                armSw.map(function(id) { return $gameSwitches.value(id); }));
            endPvp();
            armSw.forEach(function(id) { $gameSwitches.setValue(id, false); });
            defA.clearStates();
            defA.setHp(defA.mhp);
            lead.setHp(lead.mhp);
            BattleManager._coopPvpEnded = false;
        }
        // por la espalda: el atacado pierde el primer turno
        startPvp(false, true);
        check('T44h attacked from behind: they lose their first turn', !defA.canInput() && lead.canInput(), 'def ' + defA.canInput() + ' att ' + lead.canInput());
        endPvp();
        // a muerte: la cabeza
        startPvp(true);
        mDef = mirrorOf(defA);
        head = partOf(defA, 'head');
        if (head) {
            defA.clearResult(); // (como tras cada accion del combate)
            head.addState(head.deathStateId());
            var defParts = $gameTroop.members().filter(function(e) { return e._coopOwner === defA.actorId(); });
            check('T44i to the death: the head = the character dies, their double falls, the battle ends',
                defA.isDead() && defParts.every(function(e) { return e.isDead(); }) && BattleManager.isAborting() && lead.isAlive(),
                'dead ' + defA.isDead() + ' parts ' + defParts.filter(function(e) { return e.isDead(); }).length + '/' + defParts.length + ' phase ' + BattleManager._phase);
            BattleManager.endBattle(1);
            check('T44j to the death: the cut limbs stay (none here) and P1 alive: no game over', !BattleManager._coopPvpGameOver);
        }
        endPvp();
        // a muerte y cae el protagonista (P1): fin de partida
        defA.removeState(defA.deathStateId());
        defA.setHp(defA.mhp);
        startPvp(true);
        var leadHead = partOf(lead, 'head');
        if (leadHead) {
            lead.clearResult();
            leadHead.addState(leadHead.deathStateId());
            var killerPl = CoopLocal.player(defN);
            var swLead = CoopPvp.selectSwitchOf(lead.actorId()), swDef = CoopPvp.selectSwitchOf(defA.actorId());
            var swBefore2 = [$gameSwitches.value(swLead), $gameSwitches.value(swDef)];
            var posP1 = [$gamePlayer.x, $gamePlayer.y], posK = [killerPl.x, killerPl.y];
            var partyBefore = $gameParty._actors.slice();
            $gameSwitches.setValue(swLead, true); $gameSwitches.setValue(swDef, false);
            BattleManager.endBattle(1);
            check('T44k to the death, P2 kills the protagonist (P1): no game over, the killer is the protagonist now (first in the party, its SELECT switch, played as P1)',
                lead.isDead() && !BattleManager._coopPvpGameOver && $gameParty._actors[0] === defA.actorId() &&
                $gameSwitches.value(swDef) && !$gameSwitches.value(swLead) && $gameParty.leader() === defA,
                'lead dead ' + lead.isDead() + ' over ' + BattleManager._coopPvpGameOver + ' party ' + $gameParty._actors + ' sw ' + [$gameSwitches.value(swLead), $gameSwitches.value(swDef)]);
            check('T44l the dead old protagonist is now the dead companion of the killer player number; the new one stands where the killer was',
                killerPl._coopActorId === lead.actorId() && $gamePlayer.x === posK[0] && $gamePlayer.y === posK[1] && killerPl.x === posP1[0] && killerPl.y === posP1[1],
                'P' + defN + ' actor ' + killerPl._coopActorId + ' P1 at ' + [$gamePlayer.x, $gamePlayer.y] + ' was ' + posK);
            BattleManager._phase = '';
            $gameParty._inBattle = false;
            var startSw = $dataSystem.switches.indexOf('START');
            var startWas = startSw > 0 && $gameSwitches.value(startSw);
            if (startSw > 0) $gameSwitches.setValue(startSw, true); // (el suceso comun "deathCheck" va con START)
            var hadGalv = typeof Galv !== 'undefined';
            if (!hadGalv) window.Galv = { SPAWN: { overlap: '', event: function() {} } };
            for (k = 0; k < 30; k++) frame();
            var body = ($gameSystem._coopCorpses || []).filter(function(c) { return c.actorId === lead.actorId(); })[0];
            check('T44m then the game treats the old protagonist as a dead companion: out of the party, their body stays, their player waits',
                $gameParty._actors.indexOf(lead.actorId()) < 0 && !!body && !CoopLocal.player(defN),
                'party ' + $gameParty._actors + ' body ' + JSON.stringify(body) + ' P' + defN + ' ' + (CoopLocal.player(defN) ? 'plays' : 'waits'));
            if (startSw > 0) $gameSwitches.setValue(startSw, startWas);
            if (!hadGalv) delete window.Galv;
            // (todo como estaba para las pruebas siguientes: vuelve con una piedra de alma, ya de companero)
            BattleManager._coopPvpGameOver = false;
            if (body && window.CoopRevive && CoopRevive.revive) CoopRevive.revive(lead.actorId(), 1);
            for (k = 0; k < 10; k++) frame();
            check('T44n brought back with a soul stone: back as a companion (P' + defN + '), not the protagonist',
                $gameParty._actors[0] === defA.actorId() && !!CoopLocal.player(defN) && CoopLocal.player(defN)._coopActorId === lead.actorId(),
                'party ' + $gameParty._actors + ' P' + defN + ' ' + (CoopLocal.player(defN) ? CoopLocal.player(defN)._coopActorId : 'waits'));
            lead.removeState(lead.deathStateId());
            lead.setHp(lead.mhp);
            if ($gameParty._actors.indexOf(lead.actorId()) < 0) $gameParty.addActor(lead.actorId());
            $gameParty._actors = partyBefore;
            killerPl = CoopLocal.player(defN) || killerPl;
            killerPl._coopActorId = defA.actorId();
            $gameSwitches.setValue(swLead, swBefore2[0]); $gameSwitches.setValue(swDef, swBefore2[1]);
            $gamePlayer.locate(posP1[0], posP1[1]); killerPl.locate(posK[0], posK[1]);
            $gamePlayer.refresh();
            $gameSystem._coopProtagonistChanges = 0;
        }
        endPvp();
        defA.clearStates();
        defA.setHp(defA.mhp);
        lead.setHp(lead.mhp);
        BattleManager._coopPvpEnded = false;
        CoopLocal.setSetting('pvp', 'off');
        for (k = 0; k < 5; k++) frame();
    }

    // ---- PvP de varios bandos: todos contra todos, y dos contra uno ----
    var addedP3 = false, partyBefore3 = $gameParty._actors.slice();
    if (window.CoopPvp && /termina/i.test($dataSystem.gameTitle) && window.$gamePlayer2 && !window.$gamePlayer3) {
        // (un tercer jugador para estas pruebas: Abella)
        if ($gameParty._actors.indexOf(5) < 0) $gameParty._actors.splice(2, 0, 5);
        tap('KeyU', 85);
        for (k = 0; k < 5; k++) frame();
        addedP3 = !!window.$gamePlayer3;
    }
    if (window.CoopPvp && /termina/i.test($dataSystem.gameTitle) && window.$gamePlayer2 && window.$gamePlayer3) {
        var pA = $gameParty.leader(), pB = $gamePlayer2.actor(), pC = $gamePlayer3.actor();
        var startSides = function(sides, lethal) {
            var ids = [];
            sides.forEach(function(sd) { sd.forEach(function(n) { ids.push((n === 1 ? pA : n === 2 ? pB : pC).actorId()); }); });
            var tid = CoopPvp.troopFor(ids);
            var bf = {};
            [pA, pB, pC].forEach(function(a) { bf[a.actorId()] = CoopPvp.snapshot(a); });
            CoopPvp.pending[tid] = { sides: sides.map(function(sd) { return { players: sd }; }), lethal: lethal, before: bf };
            BattleManager.setup(tid, true, false);
            $gameParty.onBattleStart();
        };
        var stopSides = function() {
            $gameParty.onBattleEnd(); $gameParty._inBattle = false; $gameTroop._coopPvp = null; BattleManager._phase = ''; BattleManager._coopPvpEnded = false;
            BattleManager._subject = null;
        };
        var torsoOf = function(a) { return $gameTroop.members().filter(function(e) { return e._coopMirror === a.actorId(); })[0]; };
        var hitBy = function(hitter, victim) {
            var t = torsoOf(victim);
            BattleManager._subject = hitter;
            if (t) t.setHp(0);
            if (t && t.isAlive()) t.addState(t.deathStateId());
            BattleManager._subject = null;
        };
        [pA, pB, pC].forEach(function(a) { a.setHp(a.mhp); });
        CoopLocal.setSetting('pvp', 'duel');
        // "Attack everyone" en la pregunta (hay un tercero) y lo que prepara
        var evl = CoopPvp.eventList(1, 2);
        var choiceCmd = evl.filter(function(c) { return c.code === 102; })[0];
        var fakeIt = { _list: [{ code: 355, indent: 0, parameters: [''] }, { code: 301, indent: 0, parameters: [0, 0, true, false] }], _index: 0 };
        CoopPvp.prepareAll(fakeIt, 2);
        var ffaTroop = fakeIt._list[1].parameters[1];
        var ffa = CoopPvp.pending[ffaTroop];
        check('T48 with a third player the question has "Attack everyone"; it puts every player in the fight, each on their own side (the attacker first)',
            choiceCmd && choiceCmd.parameters[0].join('/') === 'Attack/Attack everyone/Leave' && choiceCmd.parameters[1] === 2 &&
            !!ffa && ffa.sides.length === 3 && ffa.sides[0].players[0] === 2 && ffa.sides.every(function(sd) { return sd.players.length === 1; }),
            (choiceCmd ? choiceCmd.parameters[0].join('/') : '-') + ' sides ' + (ffa ? JSON.stringify(ffa.sides) : '-'));
        delete CoopPvp.pending[ffaTroop];
        startSides([[1], [2], [3]], false);
        var own = function(a) { return CoopPvp.rivals(a).slice().sort().join(','); };
        check('T47 everybody against everybody: three doubles, each one can hit the two others (never their own)',
            !!torsoOf(pA) && !!torsoOf(pB) && !!torsoOf(pC) && own(pA) === [pB.actorId(), pC.actorId()].sort().join(',') &&
            own(pB) === [pA.actorId(), pC.actorId()].sort().join(',') && $gameParty.battleMembers().length >= 3,
            'P1 -> ' + own(pA) + ' P2 -> ' + own(pB) + ' P3 -> ' + own(pC) + ' members ' + $gameParty.battleMembers().map(function(a) { return a.name(); }));
        hitBy(pA, pB);
        check('T47b P2 is down (not to the death: 1 HP): out of the fight, the other two go on',
            pB.hp === 1 && $gameParty.battleMembers().indexOf(pB) < 0 && !BattleManager.isAborting() && CoopPvp.rivals(pA).join(',') === String(pC.actorId()),
            'P2 hp ' + pB.hp + ' members ' + $gameParty.battleMembers().map(function(a) { return a.name(); }) + ' phase ' + BattleManager._phase);
        hitBy(pC, pA);
        check('T47c then P1 is down too: one side left, the fight is over', BattleManager.isAborting(), 'phase ' + BattleManager._phase);
        BattleManager.endBattle(2);
        stopSides();
        [pA, pB, pC].forEach(function(a) { a.setHp(a.mhp); });
        // P3 llega a una pelea de P1 y P2: ayuda a P2, o contra todos
        startSides([[1], [2]], false);
        var jl = CoopPvp.joinEventList(3, 7, CoopPvp.info());
        var jc = jl.filter(function(c) { return c.code === 102; })[0];
        CoopPvp.addFighter(3, 1);
        check('T49 P3 arrives at a fight of P1 and P2: "Help P1 / Help P2 / Attack everyone / Leave"; helping P2 = P2 side, their double appears, P1 sees two doubles',
            jc && jc.parameters[0].length === 4 && /^Help P1/.test(jc.parameters[0][0]) && /^Help P2/.test(jc.parameters[0][1]) && jc.parameters[0][2] === 'Attack everyone' &&
            CoopPvp.rivals(pC).join(',') === String(pA.actorId()) && !!torsoOf(pC) && own(pA) === [pB.actorId(), pC.actorId()].sort().join(',') &&
            $gameParty.battleMembers().indexOf(pC) >= 0 && CoopPvp.shownOwners(CoopPvp.info(), pA).length === 2,
            (jc ? jc.parameters[0].join(' / ') : '-') + ' | P3 -> ' + own(pC) + ' P1 -> ' + own(pA));
        BattleManager.endBattle(2);
        stopSides();
        startSides([[1], [2]], false);
        CoopPvp.addFighter(3, -1);
        check('T49b or against everyone: a side of their own (hits both, both hit them)',
            own(pC) === [pA.actorId(), pB.actorId()].sort().join(',') && own(pB) === [pA.actorId(), pC.actorId()].sort().join(','), 'P3 -> ' + own(pC) + ' P2 -> ' + own(pB));
        BattleManager.endBattle(2);
        stopSides();
        [pA, pB, pC].forEach(function(a) { a.setHp(a.mhp); });
        // dos contra uno: P2 y P3 juntos contra P1
        startSides([[1], [2, 3]], false);
        var friends = pB.friendsUnit().members().map(function(a) { return a.actorId(); });
        check('T47d two against one: P2 and P3 are on the same side (can only hit P1, can help each other)',
            CoopPvp.rivals(pB).join(',') === String(pA.actorId()) && CoopPvp.rivals(pC).join(',') === String(pA.actorId()) &&
            own(pA) === [pB.actorId(), pC.actorId()].sort().join(',') && friends.indexOf(pC.actorId()) >= 0,
            'P2 -> ' + own(pB) + ' P3 -> ' + own(pC) + ' P1 -> ' + own(pA) + ' P2 friends ' + friends);
        hitBy(pA, pB);
        check('T47e one of the two is down: their side still fights (P3)', !BattleManager.isAborting() && CoopPvp.rivals(pA).join(',') === String(pC.actorId()),
            'phase ' + BattleManager._phase + ' P1 -> ' + own(pA));
        BattleManager.endBattle(2);
        stopSides();
        [pA, pB, pC].forEach(function(a) { a.setHp(a.mhp); });
        // a muerte: P3 (que ayuda a P2) mata a P1 -> el protagonista es P2 (el principal de ese bando)
        startSides([[1], [2, 3]], true);
        var info = CoopPvp.info();
        info.killedBy[pA.actorId()] = pC.actorId();
        var heir = CoopPvp.heir(info, pA);
        check('T47f to the death, the helper (P3) kills P1: the new protagonist is the main player of that side (P2), not the helper',
            heir === pB, 'heir ' + (heir ? heir.name() : 'none') + ' P2 ' + pB.name() + ' P3 ' + pC.name());
        stopSides();
        [pA, pB, pC].forEach(function(a) { a.clearStates(); a.setHp(a.mhp); });
        CoopLocal.setSetting('pvp', 'off');
        // la puerta de la torre con jugadores en el grupo: en vez de volverlos "moonscorched", todos contra todos
        var crazedVar = $dataSystem.variables.indexOf('TEMPLE_SQ_CRAZED_SCENE');
        if (crazedVar > 0) {
            $gameVariables.setValue(crazedVar, 0);
            var doorIt = new Game_Interpreter();
            doorIt.setup([{ code: 122, indent: 0, parameters: [crazedVar, crazedVar, 0, 0, 1] }, { code: 0, indent: 0, parameters: [] }], 0);
            doorIt.executeCommand();
            var child = doorIt._childInterpreter;
            var texts = child ? child._list.filter(function(c) { return c.code === 401; }).map(function(c) { return c.parameters[0]; }).join(' ') : '';
            var asks = child ? child._list.filter(function(c) { return c.code === 102; }) : [];
            check('T50 tower door with players in the party: no moonscorched scene - "only one may leave", and each player is asked: Fight / Commit suicide',
                $gameVariables.value(crazedVar) === 0 && /Only one may leave/.test(texts) && asks.length === 3 &&
                asks.every(function(c) { return c.parameters[0].join('/') === 'Fight/Commit suicide' && c.parameters[1] === -1; }),
                'var ' + $gameVariables.value(crazedVar) + ' asks ' + asks.length);
            // P1 y P3 luchan, P2 acaba con su vida
            CoopPvp.doorChoice(1, 'fight'); CoopPvp.doorChoice(2, 'end'); CoopPvp.doorChoice(3, 'fight');
            var resIt = new Game_Interpreter();
            resIt.setup([{ code: 0, indent: 0, parameters: [] }], 0);
            CoopPvp.doorResolve(resIt);
            var rl = resIt._childInterpreter ? resIt._childInterpreter._list : [];
            var said = rl.filter(function(c) { return c.code === 401; }).map(function(c) { return c.parameters[0]; }).join(' | ');
            var scripts = rl.filter(function(c) { return c.code === 355; }).map(function(c) { return c.parameters[0]; }).join(' ; ');
            check('T50b then everyone says their line; who ends it dies (P2); the ones who fight (P1, P3) fight to the death',
                said.indexOf(pA.name() + ': "') >= 0 && said.indexOf(pB.name() + ': "') >= 0 && /ends their own life/.test(said) &&
                /doorEnd\(2\)/.test(scripts) && /prepareDoorFight\(this, \[1,3\]\)/.test(scripts) && rl.some(function(c) { return c.code === 301; }),
                said.slice(0, 120) + ' || ' + scripts);
            var fakeDoor = { _list: [{ code: 355, indent: 0, parameters: [''] }, { code: 301, indent: 0, parameters: [0, 0, false, false] }], _index: 0 };
            CoopPvp.prepareDoorFight(fakeDoor, [1, 3]);
            var doorFight = CoopPvp.pending[fakeDoor._list[1].parameters[1]];
            check('T50c the door fight: only those who fight, to the death', !!doorFight && doorFight.lethal === true && doorFight.sides.length === 2,
                doorFight ? JSON.stringify(doorFight.sides) : '-');
            // solo uno lucha y P1 acaba con su vida: sin pelea, P1 muere al final y el otro es el protagonista
            CoopPvp.doorChoice(1, 'end'); CoopPvp.doorChoice(2, 'end'); CoopPvp.doorChoice(3, 'fight');
            var res2 = new Game_Interpreter();
            res2.setup([{ code: 0, indent: 0, parameters: [] }], 0);
            CoopPvp.doorResolve(res2);
            var rl2 = res2._childInterpreter ? res2._childInterpreter._list : [];
            var sc2 = rl2.filter(function(c) { return c.code === 355; }).map(function(c) { return c.parameters[0]; }).join(' ; ');
            check('T50d 3 of them end it: no fight - the one left becomes the protagonist (P1 dies last)',
                !rl2.some(function(c) { return c.code === 301; }) && /doorEnd\(2\)/.test(sc2) && !/doorEnd\(1\)/.test(sc2) && /doorEndProtagonist/.test(sc2), sc2);
            // todos acaban: fin de partida
            CoopPvp.doorChoice(1, 'end'); CoopPvp.doorChoice(2, 'end'); CoopPvp.doorChoice(3, 'end');
            var res3 = new Game_Interpreter();
            res3.setup([{ code: 0, indent: 0, parameters: [] }], 0);
            CoopPvp.doorResolve(res3);
            var rl3 = res3._childInterpreter ? res3._childInterpreter._list : [];
            var sc3 = rl3.filter(function(c) { return c.code === 355; }).map(function(c) { return c.parameters[0]; }).join(' ; ');
            check('T50e everybody commits suicide: the ending The Fourth Festival (P1 is not killed before it)', /fourthFestival/.test(sc3) && !/doorEnd\(1\)/.test(sc3) && /doorEnd\(2\)/.test(sc3), sc3);
            var endIt = new Game_Interpreter();
            endIt.setup([{ code: 0, indent: 0, parameters: [] }], 0);
            CoopPvp.fourthFestival(endIt);
            var el = endIt._childInterpreter ? endIt._childInterpreter._list : [];
            var scroll = el.filter(function(c) { return c.code === 405; }).map(function(c) { return c.parameters[0]; }).join(' / ');
            check('T50f the ending: bells, the tower picture, slow rising text with the names of the party, its name, then the title screen',
                el.some(function(c) { return c.code === 250; }) && el.some(function(c) { return c.code === 231 && c.parameters[1] === 'tower_view2'; }) &&
                el.some(function(c) { return c.code === 105; }) && /third festival/.test(scroll) && /fourth festival/.test(scroll) &&
                el.some(function(c) { return c.code === 401 && /The Fourth Festival/.test(c.parameters[0]); }) && el.some(function(c) { return c.code === 354; }),
                scroll.slice(0, 160));
            $gameSystem._coopDoorChoices = {};
            // correr: cada uno con su resistencia y su imagen (P1 corre: los demas no)
            var swDash = 1956;
            var st2 = CoopTower.runState($gamePlayer2);
            st2.meter = 0; st2.cooldown = false; st2.t = 0;
            var spd0 = $gamePlayer._moveSpeed;
            $gameSwitches.setValue(swDash, true); $gamePlayer._moveSpeed = spd0 + 0.5; // (P1 corre)
            var p2Speed = $gamePlayer2.realMoveSpeed();
            var walkKeep = pB._coopWalkImage;
            pB._coopWalkImage = [pB.characterName(), pB.characterIndex()];
            var runImg = CoopTower.runImageOf(pB);
            var pBimg = [pB.characterName(), pB.characterIndex()];
            if (runImg) pB._characterName = runImg[0], pB._characterIndex = runImg[1]; // (el juego le pone la de correr a todos)
            $gamePlayer2.syncActorImage();
            var p2Shown = $gamePlayer2._characterName;
            pB._characterName = pBimg[0]; pB._characterIndex = pBimg[1]; pB._coopWalkImage = walkKeep;
            $gameSwitches.setValue(swDash, false); $gamePlayer._moveSpeed = spd0;
            check('T54 P1 runs: P2 does not get faster and does not show the running picture',
                p2Speed === spd0 && !!runImg && !/^run/i.test(p2Shown), 'P1 ' + spd0 + ' P2 ' + p2Speed + ' P2 picture ' + p2Shown + ' run picture ' + runImg);
            // P2 corre solo: su barra sube; a 51, agotado; luego baja
            $gamePlayer2.keys().shift = true;
            var origMoving = $gamePlayer2.isMoving;
            $gamePlayer2.isMoving = function() { return true; };
            var fast = $gamePlayer2.realMoveSpeed();
            for (k = 0; k < 20 * 52; k++) Game_CoopPlayer.prototype.update.call($gamePlayer2);
            var tired = st2.cooldown && !$gamePlayer2.isDashing();
            $gamePlayer2.keys().shift = false;
            $gamePlayer2.isMoving = origMoving;
            for (k = 0; k < 15 * 30; k++) Game_CoopPlayer.prototype.update.call($gamePlayer2);
            check('T54b P2 runs on their own stamina: faster (+0.5), exhausted at the top, runs again after resting',
                fast === spd0 + 0.5 && tired && !st2.cooldown && st2.meter <= 26, 'fast ' + fast + ' tired ' + tired + ' meter ' + st2.meter + ' cooldown ' + st2.cooldown);
            st2.meter = 0; st2.cooldown = false;
            // ramas de Hexen: la de cada jugador abierta mientras lo lleva; la de un companero, no
            var csB = CoopTower.contestants();
            var soulOf = function(a) { var c = csB.filter(function(x) { return x.actorId === a.actorId(); })[0]; return c ? c.soul : 0; };
            var deadOf = function(a) { var c = csB.filter(function(x) { return x.actorId === a.actorId(); })[0]; return c ? c.deadSwitch : 0; };
            var sB = soulOf(pB), sC = soulOf(pC), dB = deadOf(pB);
            var soulsWas = [$gameSwitches.value(sB), $gameSwitches.value(sC), $gameSwitches.value(dB)];
            $gameSwitches.setValue(sB, false); $gameSwitches.setValue(sC, false); $gameSwitches.setValue(dB, false);
            $gameSystem._coopOpenedSouls = {};
            CoopLocal.setSetting('playerBranches', true);
            CoopTower.updateBranches();
            var openB = $gameSwitches.value(sB), openC = $gameSwitches.value(sC);
            var compId = $gameParty._actors.filter(function(id) { return id !== pA.actorId() && CoopLocal.players().every(function(pl) { return pl._coopActorId !== id; }); })[0];
            var compSoul = compId ? soulOf($gameActors.actor(compId)) : 0;
            var compOpen = compSoul ? $gameSwitches.value(compSoul) : false;
            var p2Keep = $gamePlayer2._coopActorId;
            $gamePlayer2._coopActorId = 0; // (P2 deja de llevar su personaje)
            CoopTower.updateBranches();
            var closedB = !$gameSwitches.value(sB);
            $gamePlayer2._coopActorId = p2Keep;
            check('T53 Hexen: the skill branch of each character a player plays is open; it closes when nobody plays it; a companion does not open one',
                sB > 0 && openB && openC && closedB && !compOpen, 'P2 soul ' + openB + ' P3 soul ' + openC + ' after leaving ' + !closedB + ' companion ' + compId + ' ' + compOpen);
            CoopLocal.setSetting('playerBranches', false);
            CoopTower.updateBranches();
            check('T53b setting Closed: as in the game', !$gameSwitches.value(sB) && !$gameSwitches.value(sC));
            $gameSwitches.setValue(sB, soulsWas[0]); $gameSwitches.setValue(sC, soulsWas[1]); $gameSwitches.setValue(dB, soulsWas[2]);
            $gameSystem._coopOpenedSouls = {};
            CoopLocal.setSetting('playerBranches', true);
            // el idioma del mod
            var langWas = CoopLocal.setting('language');
            CoopLocal.setSetting('language', 'ru');
            var ru = [CoopLocal.tr('Cheats are off'), CoopLocal.tr('P1 attacks P2!'), CoopLocal.tr('< On - to the death >'),
                CoopLocal.tr('Marcoh: "Fine. Let' + "'" + 's get this over with."'), CoopLocal.tr('  Cheat: keep limbs'), CoopLocal.tr('Abella')];
            CoopLocal.setSetting('language', 'en');
            var en = CoopLocal.tr('Cheats are off');
            check('T51 language Russian: the mod texts are translated (whole phrases, with names, labels, the door lines); English: as written',
                ru[0] === 'Читы выключены' && ru[1] === 'P1 нападает на P2!' && ru[2] === '< Вкл — насмерть >' &&
                ru[3] === 'Marcoh: «Ладно. Давайте покончим с этим.»' && ru[4] === '  Чит: не терять конечности' && ru[5] === 'Abella' && en === 'Cheats are off',
                ru.join(' | ') + ' | en ' + en);
            CoopLocal.setSetting('language', langWas || 'en');
            // el protagonista muere (no por un jugador): el siguiente jugador vivo es el protagonista
            var swA = CoopPvp.selectSwitchOf(pA.actorId()), swB = CoopPvp.selectSwitchOf(pB.actorId());
            var swWas = [$gameSwitches.value(swA), $gameSwitches.value(swB)];
            var partyWas = $gameParty._actors.slice();
            var p2Was = $gamePlayer2._coopActorId;
            $gameSwitches.setValue(swA, true); $gameSwitches.setValue(swB, false);
            CoopLocal.setSetting('heroDeath', 'next');
            Game_BattlerBase.prototype.setHp.call(pA, 0); pA.addState(pA.deathStateId());
            var took = CoopPvp.heroDied();
            check('T52 the protagonist dies (a monster): no game over - the next player alive (P2) is the protagonist now',
                took === true && $gameParty._actors[0] === pB.actorId() && $gameSwitches.value(swB) && !$gameSwitches.value(swA) && $gamePlayer2._coopActorId === pA.actorId(),
                'took ' + took + ' party ' + $gameParty._actors + ' sw ' + [$gameSwitches.value(swA), $gameSwitches.value(swB)]);
            // (como estaba)
            pA.removeState(pA.deathStateId()); pA.setHp(pA.mhp);
            $gameParty._actors = partyWas; $gamePlayer2._coopActorId = p2Was;
            $gameSwitches.setValue(swA, swWas[0]); $gameSwitches.setValue(swB, swWas[1]);
            $gamePlayer.refresh();
            CoopLocal.setSetting('heroDeath', 'gameover');
            Game_BattlerBase.prototype.setHp.call(pA, 0); pA.addState(pA.deathStateId());
            check('T52b setting "Game over": the protagonist dies = game over, as in the game', CoopPvp.heroDied() === false && $gameParty._actors[0] === pA.actorId());
            pA.removeState(pA.deathStateId()); pA.setHp(pA.mhp);
            CoopLocal.setSetting('heroDeath', 'next');
            if (doorFight) delete CoopPvp.pending[fakeDoor._list[1].parameters[1]];
        }
        for (k = 0; k < 5; k++) frame();
    }
    if (addedP3) {
        CoopLocal.removePlayer(3);
        $gameParty._actors = partyBefore3;
        for (k = 0; k < 5; k++) frame();
    }

    // ---- quien seguia a P1 a traves de todo (se fue y volvio, escena) no se queda en la pared ----
    var walker = carrierN && CoopLocal.player(carrierN);
    var wall = null;
    for (var wy = 0; walker && !wall && wy < $gameMap.height(); wy++) {
        for (var wx = 0; wx < $gameMap.width(); wx++) {
            if ([2, 4, 6, 8].every(function(d) { return !$gameMap.isPassable(wx, wy, d); })) { wall = [wx, wy]; break; }
        }
    }
    if (walker && wall) {
        walker.locate(wall[0], wall[1]);
        walker._through = true; // como al seguir a P1
        for (k = 0; k < 5; k++) frame();
        check('T38 left inside a wall after following P1: back next to P1', walker.x === $gamePlayer.x && walker.y === $gamePlayer.y && !walker._through,
            walker.x + ',' + walker.y + ' through=' + walker._through + ' wall ' + wall);
    }

    // ---- una escena mueve a P1 un paso (entrar por una puerta): P2 no va detras ----
    if (walker) {
        walker.locate($gamePlayer.x, $gamePlayer.y);
        for (k = 0; k < 5; k++) frame();
        var wFrom = walker.x + ',' + walker.y;
        var dirs = [2, 4, 6, 8].filter(function(d) { return $gamePlayer.canPass($gamePlayer.x, $gamePlayer.y, d); });
        if (dirs.length) {
            var mcode = { 2: 1, 4: 2, 6: 3, 8: 4 }[dirs[0]];
            $gameMap._interpreter.setup([{ code: 205, indent: 0, parameters: [-1, { list: [{ code: mcode, indent: null }, { code: 15, parameters: [60], indent: null }, { code: 0 }], repeat: false, skippable: true, wait: true }] },
                { code: 0, indent: 0, parameters: [] }], 0);
            for (k = 0; k < 90; k++) frame();
            check('T40 a scene moves P1 one step: P2 does not walk after them', walker.x + ',' + walker.y === wFrom, wFrom + ' -> ' + walker.x + ',' + walker.y);
        }
    }
})();

__results.join('\n') + '\n--log--\n' + __log.join('\n');
