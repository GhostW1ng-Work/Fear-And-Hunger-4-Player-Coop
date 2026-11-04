"""Network game scenarios without a network: 2-3 independent copies of the engine (V8 each),
with fake sockets between them pumped by this script. Checks start, sync, resync after a
desync, disconnect (another player takes over), reconnect and joining mid-game.
Usage: python tests/netharness.py   (same setup as run.py: mini-racer, TERMINA_GAME)"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load_ctx, read, GAME, PLUGINS, load_game_plugins, game_plugins_ready, GAME_PLUGIN_REPORT  # noqa: E402

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
Scene_Base.prototype.createWindowLayer = function() {
    this._windowLayer = new PIXI.Container();
    this._windowLayer.update = function() { this.children.forEach(function(c) { if (c.update) c.update(); }); };
    this.addChild(this._windowLayer);
};
SceneManager.requestUpdate = function() {};
ConfigManager.save = function() {};
Window.prototype.setTone = function() {};
Window.prototype._updateContents = Window.prototype._updateArrows = Window.prototype._updatePauseSign = Window.prototype._updateCursor = function() {};
Window_Base.prototype.initialize = function(x, y, w, h) {
    PIXI.Container.call(this);
    this._windowContentsSprite = { bitmap: null };
    this._padding = 18;
    this.x = x; this.y = y; this._width = w; this._height = h;
    this.contents = new Bitmap(w - 36, h - 36);
    this._opening = this._closing = false;
    this._openness = 255;
    this._colorTone = [0, 0, 0];
    this.windowskin = new Bitmap(1, 1);
    this._cursorRect = new Rectangle(0, 0, 0, 0);
    this._refreshCursor = function() {};
};
Graphics.startLoading = Graphics.endLoading = Graphics.updateLoading = function() {};
Graphics.render = function() {};
Graphics.isFontLoaded = function() { return true; };
ImageManager.isReady = function() { return true; };
Scene_Base.prototype.isReady = function() { return true; };
AudioManager.playBgm = AudioManager.playBgs = AudioManager.playMe = AudioManager.playSe = AudioManager.stopAll = function() {};
AudioManager.fadeOutBgm = AudioManager.fadeOutBgs = AudioManager.fadeOutMe = AudioManager.stopBgm = AudioManager.stopBgs = function() {};
SceneManager.renderScene = function() {};
Scene_Title.prototype.create = function() { Scene_Base.prototype.create.call(this); };
Scene_Title.prototype.start = function() { Scene_Base.prototype.start.call(this); };
Scene_Title.prototype.update = function() { Scene_Base.prototype.update.call(this); };
Scene_Title.prototype.terminate = function() {};
"""

FAKES = r"""
var __now = 1000;
performance.now = function() { return __now; };
var __timers = [];
var __timerId = 0;
setTimeout = function(fn, ms) { __timers.push({ id: ++__timerId, at: __now + (ms || 0), fn: fn }); return __timerId; };
clearTimeout = function(id) { __timers = __timers.filter(function(t) { return t.id !== id; }); };
setInterval = function(fn, ms) {
    var id = ++__timerId;
    var again = function() { fn(); __timers.push({ id: id, at: __now + ms, fn: again }); };
    __timers.push({ id: id, at: __now + ms, fn: again });
    return id;
};
function __tickTimers() {
    var due = __timers.filter(function(t) { return t.at <= __now; });
    __timers = __timers.filter(function(t) { return t.at > __now; });
    due.forEach(function(t) { t.fn(); });
}
var __files = {};
var LZString = { compressToBase64: function(s) { return s; }, decompressFromBase64: function(s) { return s; } };
var __outbox = [];
var __sockets = {};
var __server = null;
var __connects = [];
function FakeSocket(id) { this.id = id; this.handlers = {}; this.destroyed = false; this.remoteAddress = '10.0.0.' + id; __sockets[id] = this; }
FakeSocket.prototype.on = function(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; };
FakeSocket.prototype.emit = function(ev, arg) { (this.handlers[ev] || []).slice().forEach(function(f) { f(arg); }); };
FakeSocket.prototype.setEncoding = function() {};
FakeSocket.prototype.setNoDelay = function() {};
FakeSocket.prototype.write = function(d) { if (!this.destroyed) { if (d.indexOf('"t":"snap"') >= 0) __sentSnap = d; __outbox.push([this.id, d]); } };
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
var __sentSnap = '';
function __accept(id) { var s = new FakeSocket(id); __server(s); }
function __deliver(id, data) {
    var s = __sockets[id];
    if (!s || s.destroyed) return;
    if (data === null) { s.destroyed = true; s.emit('close'); } else s.emit('data', data);
}
var Buffer = { from: function(x) { return { data: x }; } };
var process = { mainModule: { filename: '/game/www/index.html' } };
var require = function(name) {
    if (name === 'fs') return {
        existsSync: function(p) { return p in __files; }, readFileSync: function(p) { return __files[p]; },
        mkdirSync: function() {}, unlinkSync: function(p) { delete __files[p]; }, renameSync: function(a, b) { __files[b] = __files[a]; delete __files[a]; },
        writeFileSync: function(p, d) { __files[p] = d; }, appendFileSync: function(p, d) { __files[p] = (__files[p] || '') + d; }
    };
    if (name === 'path') return {
        dirname: function(p) { return p.replace(/\/[^\/]*$/, ''); },
        join: function() { return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/'); }
    };
    if (name === 'os') return { networkInterfaces: function() { return { eth: [{ family: 'IPv4', internal: false, address: '10.0.0.' + __peerId }] }; } };
    if (name === 'net') return __netlib;
    if (name === 'zlib') return {
        deflateSync: function(b) { return { toString: function() { return 'Z:' + b.data; } }; },
        inflateSync: function(b) { if (b.data.slice(0, 2) !== 'Z:') throw new Error('not packed'); return { toString: function() { return b.data.slice(2); } }; }
    };
    throw new Error('no ' + name);
};
function __menuPress(role) {
    if (!$gameParty) DataManager.createGameObjects(); // como al arrancar el juego (Scene_Boot)
    var sc = new Scene_CoopNet();
    sc.create();
    var w = sc._netList;
    if (w._cfg.role !== role) w.cursorRight();
    w.select(w.maxItems() - 2); // la fila de accion
    Input.clear();
    Input._currentState.ok = true;
    Input._latestButton = 'ok';
    Input._pressedTime = 0;
    w.processHandling();
    Input.clear();
    sc.terminate();
}
function __tick(ms) { __now += ms; __tickTimers(); SceneManager.updateMain(); }
function __world() {
    var players = CoopLocal.allPlayers().map(function(p) { return p ? [p._x, p._y, p._direction].join('.') : 'null'; }).join('|');
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
        ctx.eval('var __params = {}; PluginManager.parameters = function(n){ return __params[n.toLowerCase()] || {}; }; Input.initialize(); TouchInput.clear();')
        # (los plugins del juego: aqui aun no - piden graficos que este banco no tiene: el fondo de los
        # menus, el efecto de empezar un combate; NET_GAME_PLUGINS=1 para probarlo)
        with_game = os.environ.get('NET_GAME_PLUGINS') == '1'
        if with_game:
            load_game_plugins(ctx)
        for f in ['LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_Net']:
            ctx.eval(read(os.path.join(PLUGINS, f + '.js')))
        if with_game:
            game_plugins_ready(ctx)
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

    def __init__(self, host, guests, latency=0):
        self.host = host
        self.guests = list(guests)
        self.links = {}  # (peer, sockId) -> (peer, sockId)
        self.next_id = 5000
        self.latency = latency  # ms one way (0 = at once)
        self.time = 0.0         # ms, advanced by tick()
        self.queue = []         # [deliver_at, peer, sockId, data]
        self.blocked_until = 0  # ms: un paron de la red: nada llega hasta entonces
        self.slow_snap = 0      # ms que tarda en llegar el mundo (un mensaje grande por una VPN lenta)
        self.link_last = {}     # (TCP: en cada conexion nada adelanta a lo anterior)

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
                    if self.latency or self.blocked_until or self.slow_snap:
                        at = max(self.time + self.latency, self.blocked_until)
                        if data and '"t":"snap"' in data:
                            at += self.slow_snap
                        at = max(at, self.link_last.get((p.pid, sid), 0))
                        self.link_last[(p.pid, sid)] = at
                        self.queue.append([at, peer, did, data])
                        continue
                    peer.ev('__deliver(%d, %s)' % (did, json.dumps(data)))
                    moved = True
            if self.queue:
                due = [q for q in self.queue if q[0] <= self.time]
                self.queue = [q for q in self.queue if q[0] > self.time]
                for _, peer, did, data in due:
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


def _report_on_crash(kind, value, tb):
    import traceback
    print('\n'.join(results))
    traceback.print_exception(kind, value, tb)


sys.excepthook = _report_on_crash


def check(name, cond, extra=''):
    results.append(('PASS ' if cond else 'FAIL ') + name + ('  [%s]' % extra if extra != '' else ''))


def tick(net, peers, n, ms=1000 / 60):
    for _ in range(n):
        net.time += ms
        for p in peers:
            p.ev('__tick(%f)' % ms)
            net.pump()


def frame(p):
    return p.ev('CoopNet.frame')


def aligned_worlds(net, peers):
    """advance every PC to the same network frame and compare their worlds"""
    for _ in range(200):
        frames = [frame(p) for p in peers]
        target = max(frames)
        if min(frames) == target:
            break
        net.time += 1000 / 60
        for p in peers:
            if frame(p) < target:
                p.ev('__tick(%f)' % (1000 / 60))
            net.pump()
    worlds = [p.ev('__world()') for p in peers]
    if os.environ.get('NET_DEBUG') and len(set(worlds)) > 1:
        for w in worlds:
            print('WORLD', w[:400])
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
check('nothing connects by itself when the game opens',
      host.ev('CoopNet.role') == 'off' and g2.ev('CoopNet.role') == 'off' and not g2.ev('CoopNet.connected'))
# the buttons of Options > Co-op > Network game, pressed with a real OK (Input)
host.ev("__menuPress('host')")
g2.ev("__menuPress('join')")
check('menu buttons open the game / connect', host.ev('CoopNet.role') == 'host' and g2.ev('CoopNet.role') == 'join')
tick(net, [host, g2], 3)
check('guest connected as P2 (after "Connect")', g2.ev('CoopNet.player') == 2, g2.ev('CoopNet.player'))

# --- start from the menu (Options > Co-op > Network game > Start) ---
# different options on each PC: the host's are used in the network game (always dash moves faster)
host.ev('ConfigManager.alwaysDash = true; ConfigManager.bgmVolume = 30')
g2.ev('ConfigManager.alwaysDash = false; ConfigManager.bgmVolume = 70')
host.ev("CoopLocal.setSetting('hideNpcs', false)")  # the host wants the NPCs as in the game
g2.ev("CoopLocal.setSetting('hideNpcs', true)")
host.ev('SceneManager.push(Scene_Options)')
tick(net, [host, g2], 5)
host.ev('CoopNet.startRequested = true')
tick(net, [host, g2], 40)
check('network game active on both', host.ev('CoopNet.active') and g2.ev('CoopNet.active'))
check('both on the map and started', all(p.ev('SceneManager._scene instanceof Scene_Map && SceneManager._sceneStarted') for p in (host, g2)))
check('the menu the host started from is gone', host.ev('SceneManager._stack.length') == 0, host.ev('SceneManager._stack.length'))
check('P2 exists on both PCs', host.ev('!!$gamePlayer2') and g2.ev('!!$gamePlayer2'))
check("guest uses the host's game options, keeps its own volume",
      g2.ev('ConfigManager.alwaysDash') is True and g2.ev('ConfigManager.bgmVolume') == 70)
check("the guest uses the host's co-op rules (Played characters' NPCs: Shown)", g2.ev("CoopLocal.setting('hideNpcs')") is False,
      g2.ev("CoopLocal.setting('hideNpcs')"))
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
host.ev('(function coopTestCaller(){ Math.random(); })()')  # a random call with a known caller, for the log
tick(net, [host, g2], 200)
log = host.ev('__files["/game/www/coop_net_desync.log"] || ""')
check('desync detected and logged', 'different: events' in log, log[:80])
check('the desync log has the frame-by-frame state of the game', '[state ' in log and '| keys ' in log and 'ev ' in log, log.split('[state ')[1][:120] if '[state ' in log else '')
check('the desync log lists the random calls with who made them', '[random calls' in log and 'coopTestCaller' in log.split('[random calls')[1], log.split('[random calls')[1][:160] if '[random calls' in log else '')
same, frames = aligned_worlds(net, [host, g2])
check('back in sync after the snapshot', same, frames)
p2after = [p.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")') for p in (host, g2)]
check('P2 kept its place after the snapshot', p2after == [p2before, p2before], '%s %s' % (p2before, p2after))

# --- P2 opens their menu: the game goes on for everybody, P2 stands still ---
g2.ev('CoopNet.localKeys = 32')  # cancel = menu
tick(net, [host, g2], 6)
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
check('P2 menu open (on both PCs), the map is still the scene',
      all(p.ev('!!CoopNet.menus[2] && SceneManager._scene instanceof Scene_Map') for p in (host, g2)),
      [p.ev('JSON.stringify([Object.keys(CoopNet.menus), SceneManager._scene.constructor.name])') for p in (host, g2)])
p1before = host.ev('$gamePlayer.y')
p2pos = host.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")')
fmenu = frame(host)
host.ev('CoopNet.localKeys = 1')  # P1 walks up
g2.ev('CoopNet.localKeys = 8')    # P2 presses right: moves the menu cursor, not the character
tick(net, [host, g2], 90)
host.ev('CoopNet.localKeys = 0')
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 10)
check('the world goes on while P2 is in the menu', frame(host) > fmenu + 90, frame(host) - fmenu)
check('P1 walks while P2 is in the menu', host.ev('$gamePlayer.y') != p1before, '%s -> %s' % (p1before, host.ev('$gamePlayer.y')))
check('P2 stays put while in the menu', host.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")') == p2pos)
same, frames = aligned_worlds(net, [host, g2])
check('same world with a menu open', same, frames)

# P1 opens their menu too: two menus at once
host.ev('CoopNet.localKeys = 32')
tick(net, [host, g2], 6)
host.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
check('P1 and P2 in their menus at the same time', host.ev('!!CoopNet.menus[1] && !!CoopNet.menus[2]') and g2.ev('!!CoopNet.menus[1] && !!CoopNet.menus[2]'))
check('each menu has its owner', host.ev('CoopNet.menus[1].scene !== CoopNet.menus[2].scene'))
check('no Load / Game End in the network game',
      host.ev('(function(){ var w = CoopNet.menus[1].scene._commandWindow; return !w || !w._list.some(function(c){ return c.symbol === "load" || c.symbol === "gameEnd"; }); })()'))
# P1 closes theirs with cancel: it must not open again
host.ev('CoopNet.localKeys = 32')
tick(net, [host, g2], 20)
host.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
check('P1 closed their menu (and it did not reopen)', not host.ev('!!CoopNet.menus[1]') and host.ev('!!CoopNet.menus[2]'))
same, frames = aligned_worlds(net, [host, g2])
check('same world after closing a menu', same, frames)

# P2 goes into Skills and back: cancel returns to the main menu, not to the map
def p2press(bits, frames=6, after=20):
    g2.ev('CoopNet.localKeys = %d' % bits)
    tick(net, [host, g2], frames)
    g2.ev('CoopNet.localKeys = 0')
    tick(net, [host, g2], after)


def p2menu():
    return host.ev('CoopNet.menus[2] ? CoopNet.menus[2].scene.constructor.name : "-"')


p2press(2)   # down: Skill
p2press(16)  # ok
check('P2 opened Skills inside their menu', p2menu() == 'Scene_Skill', p2menu())
p2press(32, frames=10)
check('cancel in Skills goes back to the main menu', p2menu() == 'Scene_Menu', p2menu())
same, frames = aligned_worlds(net, [host, g2])
check('same world after moving between menu scenes', same, frames)

# the sounds of a menu: only on the PC of its player
for p_ in (host, g2):
    p_.ev('window.__se = 0; window.__seKeep = AudioManager.playStaticSe; AudioManager.playStaticSe = function() { window.__se++; };')
p2press(2)
check('the sound of the menu of P2 is heard on their PC', g2.ev('window.__se') > 0, g2.ev('window.__se'))
check('and not on the other PC', host.ev('window.__se') == 0, host.ev('window.__se'))
p2press(1)
for p_ in (host, g2):
    p_.ev('AudioManager.playStaticSe = window.__seKeep;')
same, frames = aligned_worlds(net, [host, g2])
check('same world after the quiet menu', same, frames)

# --- who you can pick in Skills / Equip ---
def hpress(bits, frames=6, after=20):
    host.ev('CoopNet.localKeys = %d' % bits)
    tick(net, [host, g2], frames)
    host.ev('CoopNet.localKeys = 0')
    tick(net, [host, g2], after)


def menu_info(n):
    return json.loads(host.ev("""(function(){ var s = CoopNet.menus[%d]; if (!s) return 'null';
        var sc = s.scene, w = sc._statusWindow, c = sc._commandWindow;
        return JSON.stringify({ scene: sc.constructor.name, actor: sc._actor ? sc._actor.actorId() : 0,
            choosing: !!(w && w.index && w.active), index: w && w.index ? w.index() : -1,
            symbol: c && c.currentSymbol ? c.currentSymbol() : null }); })()""" % n))


def goto_symbol(press, n, symbol):
    for _ in range(8):
        info = menu_info(n)
        if not info or info['symbol'] == symbol:
            return
        press(2)


members = json.loads(host.ev('JSON.stringify($gameParty.members().map(function(a){ return a.actorId(); }))'))
p2main = host.ev('$gamePlayer2._coopActorId')

# P1 (host): chooses who, starting on the leader
hpress(32)  # open P1 menu
goto_symbol(hpress, 1, 'skill')
hpress(16)
info = menu_info(1)
check('P1 Skills: chooses the character (not straight to P2s)', info and info['choosing'] and info['scene'] == 'Scene_Menu', info)
check('P1 choice starts on the leader', info and info['index'] == 0, info)
hpress(16)
info = menu_info(1)
check('P1 opens the leader\'s Skills', info and info['scene'] == 'Scene_Skill' and info['actor'] == members[0], info)
for _ in range(5):
    if not host.ev('!!CoopNet.menus[1]'):
        break
    hpress(32, frames=6, after=15)
check('P1 menu closed again', not host.ev('!!CoopNet.menus[1]'))
same, frames = aligned_worlds(net, [host, g2])
check('same world after P1 skills', same, frames)

# P2 with a companion: the host gives the third member to P2 in "Co-op"
companion = [a for a in members if a not in (members[0], p2main)][0]
for p in (host, g2):
    p.ev('$gameSystem._coopOwners = {}; $gameSystem._coopOwners[%d] = 2;' % companion)
goto_symbol(p2press, 2, 'skill')
p2press(16)
info = menu_info(2)
check('P2 with a companion: chooses between them', info and info['choosing'], info)
check('P2 choice starts on their own character', info and info['index'] == members.index(p2main), info)
p2press(1)  # up: the leader (P1's) - not allowed
if members.index(p2main) > 1:
    p2press(1)
p2press(16)
info = menu_info(2)
check("P2 cannot open P1's character", info and info['scene'] == 'Scene_Menu', info)
for _ in range(4):
    info = menu_info(2)
    if info and info['index'] == members.index(companion):
        break
    p2press(2)
p2press(16)
info = menu_info(2)
check("P2 opens their companion's Skills", info and info['scene'] == 'Scene_Skill' and info['actor'] == companion, info)
p2press(32, frames=6, after=15)
for p in (host, g2):
    p.ev('$gameSystem._coopOwners = {};')
same, frames = aligned_worlds(net, [host, g2])
check('same world after P2 companion skills', same, frames)
for _ in range(3):
    info = menu_info(2)
    if info and info['scene'] == 'Scene_Menu' and not info['choosing']:
        break
    p2press(32, frames=6, after=15)

# P2 closes their menu with cancel and walks again
g2.ev('CoopNet.localKeys = 32')
tick(net, [host, g2], 20)
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 10)
check('P2 closed their menu (and it did not reopen)', not host.ev('!!CoopNet.menus[2]') and not g2.ev('!!CoopNet.menus[2]'))
p2x0 = host.ev('$gamePlayer2.x')
g2.ev('CoopNet.localKeys = 4')  # left
tick(net, [host, g2], 40)
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 10)
check('P2 walks again after the menu', host.ev('$gamePlayer2.x') != p2x0, '%s -> %s' % (p2x0, host.ev('$gamePlayer2.x')))
# --- Fear & Hunger 1: the host's ritual circle offers P2's character; P2 is asked (on both PCs) ---
# (no message window here: the answers are given on both PCs on the same frame)
if host.ev("/^fear & hunger$/i.test($dataSystem.gameTitle)") and host.ev('$gamePlayer2._coopActorId') == 3:
    ce48 = host.ev("$dataCommonEvents.filter(function(c){ return c && c.name === 'RITUAL CIRCLE'; })[0].id")
    aligned_worlds(net, [host, g2])
    for p_ in (host, g2):
        p_.ev('$gameTemp.reserveCommonEvent(%d)' % ce48)
    STEP = r"""(function(){ var t = $gameMessage._texts.join(' '), out = '';
      if ($gameMessage.isChoice()) {
        var ch = $gameMessage._choices, pick;
        if (CoopLocal.askPlayer()) { pick = 0; out = 'ASK' + CoopLocal.askPlayer() + ' ' + t; }
        else if (/D'arce\?/.test(t)) pick = 0;
        else { pick = ch.indexOf('Sacrifice'); if (pick < 0) pick = ch.indexOf('No'); if (pick < 0) pick = ch.length - 1; }
        $gameMessage.onChoice(pick);
      }
      if ($gameMessage.isBusy()) $gameMessage.clear();
      return out; })()"""
    asks = []
    for _ in range(400):
        aligned_worlds(net, [host, g2])
        r = [p_.ev(STEP) for p_ in (host, g2)]
        if r[0] or r[1]:
            asks.append(r)
        tick(net, [host, g2], 5)
        if not host.ev('$gameMap.isEventRunning()') and not host.ev('$gameTemp.isCommonEventReserved()') and _ > 3:
            break
    check("FH1 net: the host's circle offers P2's D'arce, P2 is asked on both PCs",
          len(asks) == 1 and asks[0][0].startswith('ASK2 Player 2:') and asks[0][1].startswith('ASK2 Player 2:'), asks)
    check("FH1 net: P2 said yes - D'arce is sacrificed on both PCs, P2 takes another character",
          host.ev('$gameParty._actors.indexOf(3) < 0') and g2.ev('$gameParty._actors.indexOf(3) < 0') and host.ev('$gamePlayer2._coopActorId') != 3,
          [p_.ev('JSON.stringify($gameParty._actors)') for p_ in (host, g2)])
    same, frames = aligned_worlds(net, [host, g2])
    check('FH1 net: same world after the sacrifice', same, frames)
    # (D'arce back for P2, for the rest)
    for p_ in (host, g2):
        p_.ev('$gameParty.addActor(3)')
    tick(net, [host, g2], 20)
    for p_ in (host, g2):
        p_.ev('SceneManager._scene.coopRemovePlayer(2, true); SceneManager._scene.spawnPlayer(2, 3, true)')
    tick(net, [host, g2], 20)
    same, frames = aligned_worlds(net, [host, g2])
    check('FH1 net: P2 plays D\'arce again (same world)', same and host.ev('$gamePlayer2 && $gamePlayer2._coopActorId') == 3, frames)

# and opens it again for the next test
g2.ev('CoopNet.localKeys = 32')
tick(net, [host, g2], 6)
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
check('P2 can open the menu again', host.ev('!!CoopNet.menus[2]'))

# --- the guest is unplugged with the menu open: the menu closes, P2's character follows the party ---
p2actor = host.ev('$gamePlayer2._coopActorId')
fcut = frame(host)
net.cut(g2)
net.guests.remove(g2)
tick(net, [host], 30)
check('the menu of the gone player closed', not host.ev('!!CoopNet.menus[2]'))
check('P2 left: their character is a normal follower', not host.ev('!!$gamePlayer2') and
      host.ev('$gamePlayer.followers().visibleFollowers().some(function(f){ return f.actor() && f.actor().actorId() === %d; })' % p2actor))
tick(net, [host], 60)
check('host keeps playing without P2', frame(host) > fcut + 80, frame(host) - fcut)
# alone again, P1 still walks (W/A/S/D are not normal RPG Maker keys without co-op)
pos0 = host.ev('[$gamePlayer.x, $gamePlayer.y].join(",")')
seen = set()
for bits in (2, 4, 1, 8):  # down, left, up, right (whichever is not a wall)
    host.ev('CoopNet.localKeys = %d' % bits)
    tick(net, [host], 30)
    seen.add(host.ev('[$gamePlayer.x, $gamePlayer.y].join(",")'))
host.ev('CoopNet.localKeys = 0')
tick(net, [host], 10)
check('P1 can still walk after the guest left', len(seen - {pos0}) > 0, pos0 + ' -> ' + ' '.join(sorted(seen)))
host.ev('CoopNet.localKeys = 32')  # cancel = menu
tick(net, [host], 6)
host.ev('CoopNet.localKeys = 0')
tick(net, [host], 20)
check('P1 can still open the menu (X is not "join P2")', host.ev('!!CoopNet.menus[1]') and not host.ev('!!$gamePlayer2'))
host.ev('CoopNet.localKeys = 32')
tick(net, [host], 6)
host.ev('CoopNet.localKeys = 0')
tick(net, [host], 20)
check('and close it', not host.ev('!!CoopNet.menus[1]'))

# --- P2 restarts their game (fresh copy at the title) and connects again ---
g2 = Peer(2, 'join')
net.add_guest(g2)
g2.ev("CoopNet.open('join')")
tick(net, [host, g2], 60)
check('restarted guest got P2 back and is playing', g2.ev('CoopNet.player') == 2 and g2.ev('CoopNet.active'))
check('no error on the restarted guest', 'coop_net_error' not in g2.ev('JSON.stringify(Object.keys(__files))'),
      g2.ev('JSON.stringify(__files)')[:300])
tick(net, [host, g2], 60)
check('P2 has their character again', all(p.ev('!!$gamePlayer2 && $gamePlayer2._coopActorId === %d' % p2actor) for p in (host, g2)),
      [p.ev('$gamePlayer2 && $gamePlayer2._coopActorId') for p in (host, g2)])
same, frames = aligned_worlds(net, [host, g2])
check('same world after the reconnect', same, frames)
g2.ev('CoopNet.localKeys = 1')  # up
tick(net, [host, g2], 60)
g2.ev('CoopNet.localKeys = 0')
same, frames = aligned_worlds(net, [host, g2])
check('P2 plays after the reconnect, same world', same, frames)

# --- a guest that stops answering (frozen / minimized game): the host neither waits nor drops it ---
fz = frame(host)
for _ in range(600):  # 10 s: the host runs, the guest is frozen
    host.ev('__tick(%f)' % (1000 / 60))
    net.pump()
check('frozen guest: the host goes on (it waits 0.5 s at most)', frame(host) > fz + 500, frame(host) - fz)
check('frozen guest: not dropped, P2 is still in the game', host.ev('!!$gamePlayer2') and host.ev('CoopNet.peers.length') == 1)
gz = frame(g2)
tick(net, [host, g2], 300)  # it comes back: it has every frame, it catches up
check('the guest comes back and catches up', frame(g2) > gz + 500, [gz, frame(g2), frame(host)])
same, frames = aligned_worlds(net, [host, g2])
check('after catching up: same world', same, frames)
p2y = host.ev('$gamePlayer2.y')
g2.ev('CoopNet.localKeys = 2')  # down
tick(net, [host, g2], 40)
g2.ev('CoopNet.localKeys = 0')
tick(net, [host, g2], 20)
same, frames = aligned_worlds(net, [host, g2])
check('and plays again (same world)', same, frames)
check('and P2 really walks with their keys again', host.ev('$gamePlayer2.y') != p2y, '%s -> %s' % (p2y, host.ev('$gamePlayer2.y')))

# --- a third PC joins in the middle ---
g3 = Peer(3, 'join')
net.add_guest(g3)
g3.ev("CoopNet.open('join')")
tick(net, [host, g2, g3], 120)
check('third PC joined as P3', g3.ev('CoopNet.player') == 3 and g3.ev('CoopNet.active'))
check('P3 exists on every PC', all(p.ev('!!$gamePlayer3') for p in (host, g2, g3)))
g3.ev('CoopNet.localKeys = 4')  # left
tick(net, [host, g2, g3], 120)
g3.ev('CoopNet.localKeys = 0')
same, frames = aligned_worlds(net, [host, g2, g3])
check('three PCs in the same world', same, frames)

# --- who may come in: password and versions ---
ph = Peer(11, 'host')
pnet = Net(ph, [])
ph.ev(HOST_SETUP)
ph.ev("CoopNet.config.password = 'wolf'; CoopNet.open('host')")
bad = Peer(12, 'join')
pnet.add_guest(bad)
bad.ev("CoopNet.config.password = 'cat'; CoopNet.open('join')")
tick(pnet, [ph, bad], 30)
check('wrong password: not let in', bad.ev('CoopNet.player') == 0 and ph.ev('CoopNet.peers.length') == 0,
      [bad.ev('CoopNet.player'), ph.ev('CoopNet.peers.length')])
check('wrong password: the guest is told why', bad.ev('CoopNet.rejected') == 'Wrong password', bad.ev('CoopNet.rejected'))
tick(pnet, [ph, bad], 400)  # 6 s: it must not keep knocking
check('a rejected guest does not retry by itself', bad.ev('!CoopNet.sock && !CoopNet.reconnectTimer'))
old = Peer(13, 'join')
pnet.add_guest(old)
old.ev("CoopNet.config.password = 'wolf'; $dataSystem.versionId = 12345; CoopNet.open('join')")
tick(pnet, [ph, old], 30)
check('different game version: not let in, with the reason', old.ev('CoopNet.player') == 0 and 'game version' in old.ev('CoopNet.rejected'),
      old.ev('CoopNet.rejected'))
good = Peer(14, 'join')
pnet.add_guest(good)
good.ev("CoopNet.config.password = 'wolf'; CoopNet.open('join')")
tick(pnet, [ph, good], 30)
check('right password and same versions: let in as P2', good.ev('CoopNet.player') == 2 and ph.ev('CoopNet.peers.length') == 1,
      [good.ev('CoopNet.player'), ph.ev('CoopNet.peers.length')])

# --- a guest brings the hero of their own save ---
bh = Peer(21, 'host')
bg = Peer(22, 'join')
bnet = Net(bh, [bg])
bh.ev(HOST_SETUP)
bg.ev("""
DataManager.createGameObjects();
$gameParty._actors = [5];
$gameActors.actor(5).changeLevel(7, false);
$gameSystem.onBeforeSave();
DataManager.saveGame(1);
""")
check('bring: the guest has a save with its hero', bg.ev('DataManager.isThisGameFile(1)'))
bh.ev("CoopNet.open('host')")
bg.ev("CoopNet.config.bring = 1; CoopNet.open('join')")
tick(bnet, [bh, bg], 10)
bh.ev('CoopNet.startRequested = true')
tick(bnet, [bh, bg], 60)
check('bring: the hero joined the host party (on both PCs)',
      all(p.ev('$gameParty._actors.indexOf(5) >= 0') for p in (bh, bg)), [p.ev('$gameParty._actors.join(",")') for p in (bh, bg)])
check('bring: with the level of the save', all(p.ev('$gameActors.actor(5).level') == 7 for p in (bh, bg)),
      [p.ev('$gameActors.actor(5).level') for p in (bh, bg)])
check('bring: the guest plays it', all(p.ev('!!$gamePlayer2 && $gamePlayer2._coopActorId === 5') for p in (bh, bg)),
      [p.ev('$gamePlayer2 && $gamePlayer2._coopActorId') for p in (bh, bg)])
same, frames = aligned_worlds(bnet, [bh, bg])
check('bring: same world', same, frames)
# the guest leaves and comes back: same hero, not added twice
bnet.cut(bg)
bnet.guests.remove(bg)
tick(bnet, [bh], 60)
bg2 = Peer(23, 'join')
bnet.add_guest(bg2)
bg2.ev('DataManager.createGameObjects(); $gameParty._actors = [5]; $gameSystem.onBeforeSave(); DataManager.saveGame(1);')
bg2.ev("CoopNet.config.bring = 1; CoopNet.open('join')")
tick(bnet, [bh, bg2], 90)
check('bring: coming back, same hero again and only once in the party',
      bh.ev('!!$gamePlayer2 && $gamePlayer2._coopActorId === 5') and bh.ev('$gameParty._actors.filter(function(a){ return a === 5; }).length') == 1,
      bh.ev('$gameParty._actors.join(",")'))

# the host closes and opens the game again: the guest comes back as P2 (not P3)
bh.ev("CoopNet.close(); CoopNet.open('host')")
tick(bnet, [bh, bg2], 20)
check('guest lost the host: back at the title (its copy of the world does not go on alone)',
      bg2.ev('SceneManager._scene instanceof Scene_Title || SceneManager._nextScene instanceof Scene_Title'),
      bg2.ev('SceneManager._scene && SceneManager._scene.constructor.name'))
tick(bnet, [bh, bg2], 280)  # the guest retries every 3 s
check('host reopened the game: the guest is P2 again', bg2.ev('CoopNet.player') == 2 and bh.ev('CoopNet.peers.length') == 1,
      [bg2.ev('CoopNet.player'), bh.ev('CoopNet.peers.length')])

# the network game stopped: the guest's character went back to the party (P2 is not a local player of the host)
check('stopped game: P2 is no longer a local player on the host', not bh.ev('!!$gamePlayer2'))
bh.ev('CoopNet.startRequested = true')
tick(bnet, [bh, bg2], 90)
check('started again: P2 has the same hero', bh.ev('!!$gamePlayer2 && $gamePlayer2._coopActorId === 5'), bh.ev('$gamePlayer2 && $gamePlayer2._coopActorId'))

# --- a player who leaves: in the battle another player (the host) commands their character, not the AI ---
tk = "(function(){ var a = $gameActors.actor($gamePlayer2._coopActorId); return [CoopLocal.battleOwnerOf(a), a.isAutoBattle()].join(','); })()"
bh.ev('CoopLocal.setAway(2, true, 1)')
check('takeover: the host commands the character of the gone player', bh.ev(tk) == '1,false', bh.ev(tk))
bh.ev('CoopLocal.setAway(2, false)')
bh.ev('CoopLocal.setAway(2, true, 0)')
check('takeover: nobody to take it - the AI', bh.ev(tk) == '2,true', bh.ev(tk))
bh.ev('CoopLocal.setAway(2, false)')
check('takeover: back - their own again', bh.ev(tk) == '2,false', bh.ev(tk))

# --- lobby: the game starts by itself when every guest is ready ---
lh2 = Peer(31, 'host')
lg2 = Peer(32, 'join')
lnet2 = Net(lh2, [lg2])
lh2.ev(HOST_SETUP)
lh2.ev("CoopNet.open('host')")
lg2.ev("CoopNet.open('join')")
tick(lnet2, [lh2, lg2], 300)
check('lobby: connected but not ready - the game does not start', not lh2.ev('CoopNet.active') and lg2.ev('CoopNet.player') == 2)
check('lobby: the guest sees the lobby list', lg2.ev('CoopNet.lobby.length') == 2, lg2.ev('JSON.stringify(CoopNet.lobby)'))
lg2.ev("__menuPress('join')")  # "I'm ready"
tick(lnet2, [lh2, lg2], 30)
check('lobby: the host sees the guest ready', lh2.ev('CoopNet.peers[0].lobbyReady') is True)
tick(lnet2, [lh2, lg2], 240)  # 3 s countdown
check('lobby: everybody ready - it started by itself', lh2.ev('CoopNet.active') and lg2.ev('CoopNet.active'))

# --- over the internet: 100 ms each way (ping 200 ms) ---
lh = Peer(7, 'host')
lg = Peer(8, 'join')
lnet = Net(lh, [lg], latency=100)
lh.ev(HOST_SETUP)
lh.ev("CoopNet.open('host')")
lg.ev("CoopNet.open('join')")
tick(lnet, [lh, lg], 30)
check('internet: guest connected', lg.ev('CoopNet.player') == 2)
lh.ev('CoopNet.startRequested = true')
tick(lnet, [lh, lg], 240)  # the snapshot travels, pings are measured (once a second)
check('internet: network game running on both', lh.ev('CoopNet.active') and lg.ev('CoopNet.active'))
gdelay = lg.ev('CoopNet.delay')
hdelay = lh.ev('CoopNet.delay')
check('internet: guest waits for the round trip (ping 200 ms -> >= 13 frames)', gdelay >= 13, gdelay)
check('internet: host waits for one way (>= 7 frames)', hdelay >= 7, hdelay)
f0 = frame(lh)
g0 = frame(lg)
lh.ev('CoopNet.localKeys = 2')
lg.ev('CoopNet.localKeys = 8')
tick(lnet, [lh, lg], 300)
lh.ev('CoopNet.localKeys = 0')
lg.ev('CoopNet.localKeys = 0')
check('internet: 60 frames per second on the host (no stalls)', frame(lh) - f0 >= 285, frame(lh) - f0)
check('internet: 60 frames per second on the guest', frame(lg) - g0 >= 285, frame(lg) - g0)
check('internet: the guest moved P2', lh.ev('!!$gamePlayer2 && $gamePlayer2.x') != 0)
tick(lnet, [lh, lg], 60)
same, frames = aligned_worlds(lnet, [lh, lg])
check('internet: same world', same, frames)
# for comparison: the old fixed delay (3 frames) at this ping stalls
for p in (lh, lg):
    p.ev('CoopNet.config.delay = 3')
tick(lnet, [lh, lg], 120)
f1 = frame(lh)
tick(lnet, [lh, lg], 300)
check('internet: a fixed 3-frame delay would stall (sanity check of the test)', frame(lh) - f1 < 200, frame(lh) - f1)
for p in (lh, lg):
    p.ev("CoopNet.config.delay = 'auto'")
tick(lnet, [lh, lg], 300)
f2 = frame(lh)
tick(lnet, [lh, lg], 300)
check('internet: back to Auto, full speed again', frame(lh) - f2 >= 285, frame(lh) - f2)
same, frames = aligned_worlds(lnet, [lh, lg])
check('internet: same world at the end', same, frames)

# --- whoever kills the protagonist becomes P1: the PCs swap who they play (same frame on all) ---
same, frames = aligned_worlds(lnet, [lh, lg])
# (a separate battle of P2 going on: after the swap it is P1's - the same player goes on fighting)
fake = "CoopNet.battles().push({ __fake: true, involved: [2], joins: [], inputs: { 2: 'p2keys' } })"
lh.ev(fake); lg.ev(fake)
mine = [lh.ev('CoopNet.swapSeats(1, 2)'), lg.ev('CoopNet.swapSeats(1, 2)')]
fb = lh.ev("(function(){ var b = CoopNet.battles().filter(function(x){ return x.__fake; })[0]; return b.involved.join(',') + ' ' + b.inputs[1]; })()")
check("seats swapped during a separate battle of P2: that battle is now P1's (same player, same keys)", fb == '1 p2keys', fb)
drop = "(function(){ var a = CoopNet.battles(); for (var i = a.length - 1; i >= 0; i--) if (a[i].__fake) a.splice(i, 1); })()"
lh.ev(drop); lg.ev(drop)
check('seats swapped: the guest PC plays P1 now, the host PC P2 (the host is still the host)',
      mine == [2, 1] and lh.ev('CoopNet.role') == 'host' and lh.ev('CoopNet.seat') == 1 and lg.ev('CoopNet.seat') == 2, mine)
pos = lambda p: p.ev('[$gamePlayer.x, $gamePlayer.y, $gamePlayer2 ? $gamePlayer2.x : -1, $gamePlayer2 ? $gamePlayer2.y : -1].join(",")')
before = pos(lh)
lg.ev('CoopNet.localKeys = 4')  # the guest presses left
tick(lnet, [lh, lg], 60)
lg.ev('CoopNet.localKeys = 0')
tick(lnet, [lh, lg], 60)
after = pos(lh)
b, a = [int(v) for v in before.split(',')], [int(v) for v in after.split(',')]
check("the guest's keys move P1 ($gamePlayer) now, not P2", a[0] != b[0] and a[2] == b[2], before + ' -> ' + after)
before = after
lh.ev('CoopNet.localKeys = 4')  # the host presses left
tick(lnet, [lh, lg], 60)
lh.ev('CoopNet.localKeys = 0')
tick(lnet, [lh, lg], 60)
after = pos(lh)
b, a = [int(v) for v in before.split(',')], [int(v) for v in after.split(',')]
check("the host's keys go to P2 now, not P1", a[0] == b[0] and (a[2] != b[2] or b[2] == -1), before + ' -> ' + after)
same, frames = aligned_worlds(lnet, [lh, lg])
check('same world after swapping who plays whom', same, frames)
check('the swap is in the saved game (a snapshot keeps it)', lh.ev('JSON.stringify($gameSystem._coopSeats)') == lg.ev('JSON.stringify($gameSystem._coopSeats)') and lh.ev('CoopNet.slotOf(2)') == 1)
# the guest PC (now playing P1, the protagonist) disconnects: the host plays P1, nothing breaks
lnet.cut(lg)
tick(lnet, [lh], 120)
fa = frame(lh)
tick(lnet, [lh], 120)
fb = frame(lh)
check('the PC playing the protagonist leaves: the host plays P1 now, the game goes on (no crash)',
      lh.ev('CoopNet.player') == 1 and lh.ev('CoopNet.slotOf(1)') == 1 and fb - fa >= 100 and lh.ev('SceneManager._scene instanceof Scene_Map'),
      [lh.ev('CoopNet.player'), lh.ev('CoopNet.slotOf(1)'), fb - fa])

# --- lag (a VPN): whatever happens, P2 keeps their controls and the game does not hang ---
def lag_game(latency, slow_snap=0, pid=20):
    h = Peer(pid, 'host')
    g = Peer(pid + 1, 'join')
    n = Net(h, [g], latency=latency)
    n.slow_snap = slow_snap
    # (andando se puede entrar en un evento con combate: este banco no tiene los graficos del combate)
    for p_ in (h, g):
        p_.ev('Game_Interpreter.prototype.command301 = function() { return true; };')
    h.ev(HOST_SETUP)
    tick(n, [h, g], 3)
    h.ev("__menuPress('host')")
    g.ev("__menuPress('join')")
    tick(n, [h, g], 10 + int(latency / 8))
    h.ev('SceneManager.push(Scene_Options)')
    tick(n, [h, g], 5)
    h.ev('CoopNet.startRequested = true')
    tick(n, [h, g], 80 + int(latency / 4) + int(slow_snap * 60 / 1000))
    return h, g, n


def p2_walks(h, g, n):
    moved = False
    for key in (2, 8, 1, 4):
        before = h.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")')
        g.ev('CoopNet.localKeys = %d' % key)
        tick(n, [h, g], 90)
        g.ev('CoopNet.localKeys = 0')
        tick(n, [h, g], 20)
        moved = moved or h.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")') != before
    return moved


def freeze_guest(h, n, frames_):
    for _ in range(frames_):
        n.time += 1000 / 60
        h.ev('__tick(%f)' % (1000 / 60))
        n.pump()


def door(h, g, n):
    aligned_worlds(n, [h, g])
    ev = "$gameMap._interpreter.setup([{code:201,indent:0,parameters:[0,$gameMap.mapId(),$gamePlayer.x,$gamePlayer.y,2,0]},{code:0,indent:0,parameters:[]}],0)"
    h.ev(ev)
    g.ev(ev)
    tick(n, [h, g], 200)
    return h.ev('SceneManager._sceneStarted') and g.ev('SceneManager._sceneStarted')


# a window that loses the focus (Alt+Tab, a click on another window, a popup) does not touch the shared keys
def focus_test(who, pid):
    h, g, n = lag_game(40, pid=pid)
    other = g if who == 'guest' else h
    h.ev('CoopNet.localKeys = 2')       # P1 holds a direction and keeps it
    tick(n, [h, g], 12)
    held = [h.ev("!!Input._currentState.down"), g.ev("!!Input._currentState.down")]
    other.ev('Input._onLostFocus()')
    tick(n, [h, g], 3)
    after = [h.ev("!!Input._currentState.down"), g.ev("!!Input._currentState.down")]
    h.ev('CoopNet.localKeys = 0')
    tick(n, [h, g], 20)
    # P1 walks with a held key while that window goes on losing the focus, as in the logs of a real game
    walked = False
    pos = '[$gamePlayer.x, $gamePlayer.y].join(",")'
    for key in (2, 8, 1, 4):
        before = h.ev(pos)
        h.ev('CoopNet.localKeys = %d' % key)
        tick(n, [h, g], 30)
        other.ev('Input._onLostFocus()')
        tick(n, [h, g], 60)
        h.ev('CoopNet.localKeys = 0')
        tick(n, [h, g], 25)
        walked = walked or h.ev(pos) != before
    check('focus (' + who + '): P1 did walk in this test', walked)
    aligned_worlds(n, [h, g])
    check('focus (' + who + '): the PCs did not go apart (no repair was needed)',
          not h.ev('!!__files["/game/www/coop_net_desync.log"]'), (h.ev('__files["/game/www/coop_net_desync.log"] || ""'))[:90])
    same, frames = aligned_worlds(n, [h, g])
    log = other.ev('CoopNet.focusLost')
    return held, after, same, frames, log

held, after, same, frames, flog = focus_test('guest', 60)
check('focus: P1 holds a key on both PCs', held == [True, True], held)
check('focus: the guest loses the focus: P1 keeps their key there too', after == [True, True], after)
check('focus: the same world after that', same, frames)
check('focus: it is counted (and written in the log)', flog == 5, flog)
held, after, same, frames, flog = focus_test('host', 62)
if after[1]:
    check('focus: the host loses the focus: P1 keeps their key on both PCs until the release arrives', after == [True, True], after)
else:
    check('focus: the host loses the focus: P1 keeps their key on both PCs until the release arrives', False, after)
check('focus: the host loses the focus: the same world', same, frames)
# the log says when P1 loses a key on one PC, and who cleared the keys
dh, dg, dn = lag_game(40, pid=66)
dh.ev('CoopNet.localKeys = 2')
tick(dn, [dh, dg], 12)
dg.ev('Input.clear()')
tick(dn, [dh, dg], 3)
check('diary: the clear of the keys is noted on that PC', dg.ev('CoopNet.inputClears') == 1, dg.ev('CoopNet.inputClears'))
check('diary: P1 losing a held key is noted on that PC only', dg.ev('CoopNet.p1LostCount') == 1 and not dh.ev('CoopNet.p1LostCount'), [dg.ev('CoopNet.p1LostCount'), dh.ev('CoopNet.p1LostCount')])
dh.ev('CoopNet.localKeys = 0')
tick(dn, [dh, dg], 10)

# P2 lets go of a key: P1 keeps holding the same one
dh, dg, dn = lag_game(40, pid=68)
dh.ev('CoopNet.localKeys = 2')
dg.ev('CoopNet.localKeys = 2')
tick(dn, [dh, dg], 12)
dg.ev('CoopNet.localKeys = 0')
tick(dn, [dh, dg], 12)
states = [dh.ev('!!Input._currentState.down'), dg.ev('!!Input._currentState.down')]
check('keys: P2 lets go of Down, P1 still holds it on both PCs', states == [True, True], states)
dh.ev('CoopNet.localKeys = 0')
tick(dn, [dh, dg], 12)
states = [dh.ev('!!Input._currentState.down'), dg.ev('!!Input._currentState.down')]
check('keys: and P1 lets go of it too', states == [False, False], states)

# the language of the game (the menu of the mod can be Russian in a copy without the translation)
def lang_game(host_lang, guest_lang, guest_has, pid):
    h = Peer(pid, 'host')
    g = Peer(pid + 1, 'join')
    n = Net(h, [g], latency=20)
    for p_ in (h, g):
        p_.ev('CoopLocal.setGameLanguage = function(v) { window.__switched = v; };')
    h.ev(HOST_SETUP)
    h.ev("window.$coopGameLang = '%s'; window.$coopHasRu = true;" % host_lang)
    g.ev("window.$coopGameLang = '%s'; window.$coopHasRu = %s;" % (guest_lang, 'true' if guest_has else 'false'))
    tick(n, [h, g], 3)
    h.ev("__menuPress('host')")
    g.ev("__menuPress('join')")
    tick(n, [h, g], 20)
    return g.ev('CoopNet.rejected'), g.ev('window.__switched || ""')

why, sw = lang_game('ru', 'en', False, 90)
check('language: a copy without the translation is told so', 'not translated' in why and not sw, [why, sw])
why, sw = lang_game('ru', 'en', True, 92)
check('language: with the translation installed, the guest switches to the language of the host', 'Different game language' in why and sw == 'ru', [why, sw])
why, sw = lang_game('en', 'ru', True, 94)
check('language: and to English too', sw == 'en', [why, sw])
why, sw = lang_game('ru', 'ru', True, 96)
check('language: the same language: let in', not why and not sw, [why, sw])

# without a network game the game clears the keys as always
vf = Peer(64, 'host')
vf.ev("Input._currentState.down = true; Input._onLostFocus();")
check('focus: outside a network game the keys are cleared as always', vf.ev("!Input._currentState.down"))

# the world is sent packed, and it unpacks to the same game
vh, vg, vn = lag_game(40, pid=20)
check('lag: the host sends the world packed', 'Z:' in vh.ev('__sentSnap || ""'), vh.ev('(__sentSnap || "").slice(0, 60)'))
check('lag: ping 80 ms: P2 walks', p2_walks(vh, vg, vn))
# the network stops for a second
vn.blocked_until = vn.time + 1000
tick(vn, [vh, vg], 180)
vn.blocked_until = 0
check('lag: after the network stopped for 1 s, P2 still walks with their keys', p2_walks(vh, vg, vn), vg.ev('CoopNet.frame'))
same, frames = aligned_worlds(vn, [vh, vg])
check('lag: same world after that', same, frames)
# the guest's game stops for a second (dragging the window, loading...)
freeze_guest(vh, vn, 60)
tick(vn, [vh, vg], 120)
check('lag: after the guest froze for 1 s, P2 still walks with their keys', p2_walks(vh, vg, vn), vg.ev('CoopNet.frame'))
check('lag: after that, the guest is not stuck behind (no more than its margin + a little)',
      vg.ev('(function(){var n=0;while(n<60&&CoopNet.frames[CoopNet.frame+n])n++;return n;})()') <= 4,
      vg.ev('(function(){var n=0;while(n<60&&CoopNet.frames[CoopNet.frame+n])n++;return n;})()'))
check('lag: and a door after that opens for both (the game does not hang)', door(vh, vg, vn), [vh.ev('CoopNet.allReady'), vh.ev('CoopNet.sceneSeq * 2 + 2')])
same, frames = aligned_worlds(vn, [vh, vg])
check('lag: same world after the door', same, frames)
# the same on a LAN (no ping at all)
lh2, lg2, ln2 = lag_game(0, pid=30)
freeze_guest(lh2, ln2, 60)
tick(ln2, [lh2, lg2], 120)
check('lag: LAN, guest froze 1 s: P2 still walks', p2_walks(lh2, lg2, ln2))
check('lag: LAN, and a door opens for both', door(lh2, lg2, ln2))
# a key pressed while the guest is behind is not lost
freeze_guest(lh2, ln2, 60)
before = lh2.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")')
lg2.ev('CoopNet.localKeys = 2')
tick(ln2, [lh2, lg2], 15)
lg2.ev('CoopNet.localKeys = 8')
tick(ln2, [lh2, lg2], 60)
lg2.ev('CoopNet.localKeys = 0')
tick(ln2, [lh2, lg2], 30)
check('lag: keys pressed right after a stop are not lost', lh2.ev('[$gamePlayer2.x, $gamePlayer2.y].join(",")') != before)
# a slow world: the game starts anyway, for both
sh, sg, sn = lag_game(40, slow_snap=3000, pid=40)
check('lag: the world took 3 s to arrive: the game started on both', sh.ev('SceneManager._sceneStarted') and sg.ev('SceneManager._sceneStarted') and sh.ev('!!$gamePlayer2'),
      [sh.ev('CoopNet.allReady'), sh.ev('CoopNet.sceneSeq * 2 + 2')])
check('lag: and P2 walks', sh.ev('!!$gamePlayer2') and p2_walks(sh, sg, sn))
same, frames = aligned_worlds(sn, [sh, sg])
check('lag: same world', same, frames)

print('\n'.join(results))
failed = [r for r in results if r.startswith('FAIL')]
print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
sys.exit(1 if failed else 0)
