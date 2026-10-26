"""Lockstep check: two independent copies of the engine get the same start, the same seed and
the same inputs (through CoopLocal.injectAction, as the network game does) and must end with
the same world. Usage: python tests/netsync.py [map_id] [frames]
Needs the same setup as run.py (mini-racer, TERMINA_GAME)."""
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load_ctx, read, GAME  # noqa: E402

MAP_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 58
FRAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 1200

SETUP = r"""
Game_Event.prototype.checkEventTriggerAuto = function() {};   // sin autoejecutables (no hay interprete de escenas)
var __seed = 12345;
Math.random = function() {
    __seed = (__seed + 0x6D2B79F5) | 0;
    var t = __seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
DataManager.createGameObjects();
$dataMap = __map;
$gameMap.setup(__mapId);
$gameParty._actors = [1, 3, 4];
$gamePlayer.reserveTransfer(__mapId, __x, __y, 2, 0);
$gamePlayer.performTransfer();
$gamePlayer.refresh();
var scene = new Scene_Map();
scene._spriteset = null; scene.addWindow = function() {}; scene._windowLayer = { removeChild: function() {} };
scene._mapNameWindow = { hide: function() {}, close: function() {} };
scene.isActive = function() { return true; };
SceneManager._scene = scene;
CoopLocal.forceRestore([2]);
function step(b1, b2) {
    apply(1, b1); apply(2, b2);
    Input.update();
    Scene_Map.prototype.update.call(scene);
}
var __prev = {1: 0, 2: 0};
function apply(p, bits) {
    var prev = __prev[p];
    CoopLocal.actions.forEach(function(a, i) {
        var was = (prev >> i) & 1, now = (bits >> i) & 1;
        if (was !== now) CoopLocal.injectAction(p, a, !!now);
    });
    __prev[p] = bits;
}
function world() {
    var players = CoopLocal.allPlayers().map(function(p) { return [p._x, p._y, p._direction].join('.'); }).join('|');
    var events = $gameMap.events().map(function(e) { return e ? [e._eventId, e._x, e._y, e._direction, e._pageIndex].join('.') : ''; }).join('|');
    return JSON.stringify({ players: players, events: events, seed: __seed, sw: $gameSwitches._data.join(','), v: $gameVariables._data.join(',') });
}
"""


def make():
    ctx = load_ctx()
    ctx.eval('var __map = ' + read(GAME + '/data/Map%03d.json' % MAP_ID) + ';')
    ctx.eval('Graphics._width = 816; Graphics._height = 624; Graphics._boxWidth = 816; Graphics._boxHeight = 624;')
    # una casilla transitable para empezar: la del primer evento con posicion
    ctx.eval('var __mapId = %d; var __x = Math.floor(__map.width / 2), __y = Math.floor(__map.height / 2);' % MAP_ID)
    ctx.eval(SETUP)
    return ctx


a = make()
b = make()
rng = random.Random(7)
moving = 0
for f in range(FRAMES):
    # cada ~20 cuadros cambia lo que pulsa cada jugador (andar, correr, aceptar...)
    if f % 20 == 0:
        b1 = rng.choice([1, 2, 4, 8, 1 | 64, 2 | 64, 16, 0])
        b2 = rng.choice([1, 2, 4, 8, 4 | 64, 8 | 64, 16, 0])
    for ctx in (a, b):
        ctx.eval('step(%d, %d)' % (b1, b2))
    if f % 200 == 0 or f == FRAMES - 1:
        wa = a.eval('world()')
        wb = b.eval('world()')
        if wa != wb:
            import json
            ja, jb = json.loads(wa), json.loads(wb)
            print('DESYNC at frame', f, 'in', [k for k in ja if ja[k] != jb[k]])
            sys.exit(1)
moved = a.eval('JSON.stringify(CoopLocal.allPlayers().map(function(p){return [p._x,p._y];}))')
print('in sync after %d frames on map %d; players at %s' % (FRAMES, MAP_ID, moved))
print('P2 joined in both:', a.eval('!!$gamePlayer2'), b.eval('!!$gamePlayer2'))
