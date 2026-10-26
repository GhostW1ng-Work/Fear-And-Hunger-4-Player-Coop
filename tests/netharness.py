"""Network game scenarios without a network: 2-3 independent copies of the engine (V8 each),
with fake sockets between them pumped by this script. Checks start, sync, resync after a
desync, disconnect (AI takes over), reconnect and joining mid-game.
Usage: python tests/netharness.py   (same setup as run.py: mini-racer, TERMINA_GAME)"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load_ctx, read, GAME, PLUGINS  # noqa: E402

MAP_ID = int(os.environ.get('NET_MAP', '58'))
MAP_JSON = read(GAME + '/data/Map%03d.json' % MAP_ID)

POST = r"""
// escenas sin graficos
Game_Event.prototype.checkEventTriggerAuto = function() {};
DataManager.loadMapData = function(id) { $dataMap = JSON.parse(JSON.stringify(__mapData)); };
Scene_Map.prototype.createDisplayObjects = function() {
    this._spriteset = null;
    this._mapNameWindow = { open: function() {}, close: function() {}, hide: function() {}, show: function() {} };
};
Scene_Map.prototype.terminate = function() { $gameScreen.clearZoom(); };
Scene_Base.prototype.createFadeSprite = function() { this._fadeSprite = { opacity: 0, setBlack: function() {}, setWhite: function() {} }; };
Scene_Base.prototype.createWindowLayer = function() { this._windowLayer = new PIXI.Container(); this.addChild(this._windowLayer); };
SceneManager.requestUpdate = function() {};
Graphics.startLoading = Graphics.endLoading = Graphics.updateLoading = function() {};
Graphics.render = function() {};
Graphics.isFontLoaded = function() { return true; };
ImageManager.isReady = function() { return true; };
Scene_Base.prototype.isReady = function() { return true; };
AudioManager.playBgm = AudioManager.playBgs = AudioManager.playMe = AudioManager.playSe = AudioManager.stopAll = function() {};
AudioManager.fadeOutBgm = AudioManager.fadeOutBgs = AudioManager.fadeOutMe = AudioManager.stopBgm = AudioManager.stopBgs = function() {};
SceneManager.renderScene = function() {};
"""

FAKES = r"""
var __now = 1000;
performance.now = function() { return __now; };
var __timers = [];
var __timerId = 0;
setTimeout = function(fn, ms) { __timers.push({ id: ++__timerId, at: __now + (ms || 0), fn: fn }); return __timerId; };
clearTimeout = function(id) { __timers = __timers.filter(function(t) { return t.id !== id; }); };
setInterval = function() { return 0; };
function __tickTimers() {
    var due = __timers.filter(function(t) { return t.at <= __now; });
    __timers = __timers.filter(function(t) { return t.at > __now; });
    due.forEach(function(t) { t.fn(); });
}
var __files = {};
var __outbox = [];
var __sockets = {};
var __server = null;
var __connects = [];
function FakeSocket(id) { this.id = id; this.handlers = {}; this.destroyed = false; this.remoteAddress = '10.0.0.' + id; __sockets[id] = this; }
FakeSocket.prototype.on = function(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; };
FakeSocket.prototype.emit = function(ev, arg) { (this.handlers[ev] || []).slice().forEach(function(f) { f(arg); }); };
FakeSocket.prototype.setEncoding = function() {};
FakeSocket.prototype.setNoDelay = function() {};
FakeSocket.prototype.write = function(d) { if (!this.destroyed) __outbox.push([this.id, d]); };
FakeSocket.prototype.end = FakeSocket.prototype.destroy = function() {
    if (this.destroyed) return;
    this.destroyed = true;
    __outbox.push([this.id, null]);
    this.emit('close');
};
var __netlib = {
    createServer: function(cb) { __server = cb; return { listen: function(p, f) { if (f) f(); }, on: function() {}, close: function() {} }; },
    connect: function(port, host) { var s = new FakeSocket(__peerId * 100 + (++__timerId)); __connects.push(s.id); return s; }
};
function __accept(id) { var s = new FakeSocket(id); __server(s); }
function __deliver(id, data) {
    var s = __sockets[id];
    if (!s || s.destroyed) return;
    if (data === null) { s.destroyed = true; s.emit('close'); } else s.emit('data', data);
}
var process = { mainModule: { filename: '/game/www/index.html' } };
var require = function(name) {
    if (name === 'fs') return {
        existsSync: function(p) { return p in __files; }, readFileSync: function(p) { return __files[p]; },
        writeFileSync: function(p, d) { __files[p] = d; }, appendFileSync: function(p, d) { __files[p] = (__files[p] || '') + d; }
    };
    if (name === 'path') return {
        dirname: function(p) { return p.replace(/\/[^\/]*$/, ''); },
        join: function() { return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/'); }
    };
    if (name === 'os') return { networkInterfaces: function() { return { eth: [{ family: 'IPv4', internal: false, address: '10.0.0.' + __peerId }] }; } };
    if (name === 'net') return __netlib;
    throw new Error('no ' + name);
};
function __tick(ms) { __now += ms; __tickTimers(); SceneManager.updateMain(); }
function __world() {
    var players = CoopLocal.allPlayers().map(function(p) { return [p._x, p._y, p._direction].join('.'); }).join('|');
    var events = $gameMap.events().map(function(e) { return e ? [e._eventId, e._x, e._y, e._direction].join('.') : ''; }).join('|');
    return JSON.stringify({ map: $gameMap.mapId(), players: players, events: events, party: $gameParty._actors.join(','), sw: $gameSwitches._data.join(','), v: $gameVariables._data.join(',') });
}
function __key(code) { (__listeners.keydown || []).forEach(function(f) { f({ keyCode: code, repeat: false, stopImmediatePropagation: function() {}, preventDefault: function() {} }); }); }
"""


class Peer:
    def __init__(self, pid, role):
        self.pid = pid
        ctx = load_ctx(plugins=False)
        ctx.eval('var __peerId = %d; var __mapData = %s;' % (pid, MAP_JSON))
        ctx.eval('Graphics._width = 816; Graphics._height = 624; Graphics._boxWidth = 816; Graphics._boxHeight = 624;')
        ctx.eval(FAKES)
        cfg = {'role': role, 'host': '10.0.0.1', 'port': 47810}
        ctx.eval('__files["/game/www/coop_net.json"] = %s;' % json.dumps(json.dumps(cfg)))
        ctx.eval('PluginManager.parameters = function(n){ return {}; }; Input.initialize(); TouchInput.clear();')
        for f in ['LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_Net']:
            ctx.eval(read(os.path.join(PLUGINS, f + '.js')))
        ctx.eval(POST)
        self.ctx = ctx

    def ev(self, code):
        return self.ctx.eval(code)

    def outbox(self):
        return json.loads(self.ctx.eval('JSON.stringify(__outbox.splice(0))'))

    def connects(self):
        return json.loads(self.ctx.eval('JSON.stringify(__connects.splice(0))'))


class Net:
    """Fake LAN: pairs sockets between the host and the guests and moves the data."""

    def __init__(self, host, guests):
        self.host = host
        self.guests = list(guests)
        self.links = {}  # (peer, sockId) -> (peer, sockId)
        self.next_id = 5000

    def add_guest(self, g):
        self.guests.append(g)

    def pump(self):
        for g in self.guests:
            for cid in g.connects():
                hid = self.next_id
                self.next_id += 1
                self.links[(g.pid, cid)] = (self.host, hid)
                self.links[(self.host.pid, hid)] = (g, cid)
                self.host.ev('__accept(%d)' % hid)
                g.ev('__sockets[%d].emit("connect")' % cid)
        moved = True
        while moved:
            moved = False
            for p in [self.host] + self.guests:
                for sid, data in p.outbox():
                    dest = self.links.get((p.pid, sid))
                    if not dest:
                        continue
                    peer, did = dest
                    peer.ev('__deliver(%d, %s)' % (did, json.dumps(data)))
                    moved = True

    def cut(self, g):
        """unplug a guest: both ends see the socket close"""
        for (pid, sid), (peer, did) in list(self.links.items()):
            if pid == g.pid:
                g.ev('if (__sockets[%d]) __sockets[%d].destroy()' % (sid, sid))
                peer.ev('__deliver(%d, null)' % did)
                del self.links[(pid, sid)]
                self.links.pop((peer.pid, did), None)


results = []


def check(name, cond, extra=''):
    results.append(('PASS ' if cond else 'FAIL ') + name + ('  [%s]' % extra if extra != '' else ''))


def tick(net, peers, n, ms=1000 / 60):
    for _ in range(n):
        for p in peers:
            p.ev('__tick(%f)' % ms)
            net.pump()


def frame(p):
    return p.ev('CoopNet.frame')


def aligned_worlds(net, peers):
    """advance every PC to the same network frame and compare their worlds"""
    for _ in range(40):
        frames = [frame(p) for p in peers]
        target = max(frames)
        if min(frames) == target:
            break
        for p in peers:
            if frame(p) < target:
                p.ev('__tick(%f)' % (1000 / 60))
            net.pump()
    worlds = [p.ev('__world()') for p in peers]
    return all(w == worlds[0] for w in worlds), [frame(p) for p in peers]


HOST_SETUP = r"""
DataManager.createGameObjects();
$gameParty._actors = [1, 3, 4];
$gamePlayer.reserveTransfer(%d, Math.floor(__mapData.width / 2), Math.floor(__mapData.height / 2), 2, 0);
SceneManager.goto(Scene_Map);
for (var i = 0; i < 20; i++) __tick(1000 / 60);
""" % MAP_ID

host = Peer(1, 'host')
g2 = Peer(2, 'join')
net = Net(host, [g2])
host.ev(HOST_SETUP)
check('host is on the map before starting', host.ev('SceneManager._scene instanceof Scene_Map && SceneManager._sceneStarted'))
tick(net, [host, g2], 3)
check('guest connected as P2', g2.ev('CoopNet.player') == 2, g2.ev('CoopNet.player'))

# --- start (F11) ---
host.ev('__key(122)')
net.pump()
tick(net, [host, g2], 40)
check('network game active on both', host.ev('CoopNet.active') and g2.ev('CoopNet.active'))
check('both on the map and started', all(p.ev('SceneManager._scene instanceof Scene_Map && SceneManager._sceneStarted') for p in (host, g2)))
check('P2 exists on both PCs', host.ev('!!$gamePlayer2') and g2.ev('!!$gamePlayer2'))
f0 = frame(host)
p2start = host.ev('$gamePlayer2.x')

# --- moving: P1 walks down on the host, P2 walks right on the guest ---
host.ev('CoopNet.localKeys = 2')  # down
g2.ev('CoopNet.localKeys = 8')    # right
tick(net, [host, g2], 240)
host.ev('CoopNet.localKeys = 0')
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
same, frames = aligned_worlds(net, [host, g2])
check('after 4 s of walking: same world', same, frames)
p2x = host.ev('$gamePlayer2.x')
check('P2 moved right (driven by the guest PC)', p2x != p2start, '%s -> %s' % (p2start, p2x))
check('game ran at about 60 frames per second', abs((frame(host) - f0) - 260) < 15, frame(host) - f0)
check('no desync reported', '"/game/www/coop_net_desync.log"' not in host.ev('JSON.stringify(Object.keys(__files))'))

# --- desync on purpose: the guest moves an event, the host must fix it with a snapshot ---
p2before = host.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")')
g2.ev('(function(){ var e = $gameMap.events().filter(function(e){ return e; })[0]; e._x += 3; e._realX += 3; })()')
tick(net, [host, g2], 200)
log = host.ev('__files["/game/www/coop_net_desync.log"] || ""')
check('desync detected and logged', 'different: events' in log, log[:80])
same, frames = aligned_worlds(net, [host, g2])
check('back in sync after the snapshot', same, frames)
p2after = [p.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")') for p in (host, g2)]
check('P2 kept its place after the snapshot', p2after == [p2before, p2before], '%s %s' % (p2before, p2after))

# --- the guest is unplugged: the host goes on, AI plays P2 ---
fcut = frame(host)
net.cut(g2)
tick(net, [host], 120)
check('host keeps playing without P2', frame(host) > fcut + 100, frame(host) - fcut)
check('P2 is away (AI) on the host', host.ev('CoopLocal.awayPlayers().indexOf(2) >= 0'))

# --- the guest comes back (it retries every 3 s) ---
tick(net, [host, g2], 240)
check('guest reconnected as P2', g2.ev('CoopNet.player') == 2 and g2.ev('CoopNet.active'))
tick(net, [host, g2], 60)
check('P2 no longer away', not host.ev('CoopLocal.awayPlayers().indexOf(2) >= 0'))
same, frames = aligned_worlds(net, [host, g2])
check('same world after the reconnect', same, frames)

# --- a third PC joins in the middle ---
g3 = Peer(3, 'join')
net.add_guest(g3)
tick(net, [host, g2, g3], 120)
check('third PC joined as P3', g3.ev('CoopNet.player') == 3 and g3.ev('CoopNet.active'))
check('P3 exists on every PC', all(p.ev('!!$gamePlayer3') for p in (host, g2, g3)))
g3.ev('CoopNet.localKeys = 4')  # left
tick(net, [host, g2, g3], 120)
g3.ev('CoopNet.localKeys = 0')
same, frames = aligned_worlds(net, [host, g2, g3])
check('three PCs in the same world', same, frames)

print('\n'.join(results))
failed = [r for r in results if r.startswith('FAIL')]
print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
sys.exit(1 if failed else 0)
