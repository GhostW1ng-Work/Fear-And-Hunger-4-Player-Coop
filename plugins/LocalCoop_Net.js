/*:
 * @target MV
 * @plugindesc v0.1 [PROTOTIPO] Co-op en red local: cada jugador en su PC con su copia del juego (lockstep). Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @help
 * PROTOTIPO. Sin el archivo www/coop_net.json este plugin no hace nada.
 *
 * Como funciona (lockstep)
 * ------------------------
 * Todos los PC ejecutan el juego entero. Por la red solo viajan las teclas: en cada
 * cuadro todos reciben las acciones de todos los jugadores y calculan exactamente el
 * mismo cuadro, cada uno con la camara de su jugador. El anfitrion (P1) recoge las
 * teclas de todos y reparte los cuadros. Para que todos calculen lo mismo:
 *  - el azar del juego (Math.random) sale de una semilla comun;
 *  - un cuadro de juego por cada cuadro de red (sin FluidTimestep);
 *  - al cambiar de escena (mapa, combate, menu) nadie empieza hasta que todos han
 *    terminado de cargar;
 *  - cada 60 cuadros se compara una "huella" del mundo y se avisa si los PC se separan.
 *
 * www/coop_net.json
 * -----------------
 *  Anfitrion:  { "role": "host", "port": 47810 }
 *  Invitado:   { "role": "join", "host": "192.168.1.20", "port": 47810 }
 *
 * Uso
 * ---
 *  1. El anfitrion carga su partida y se pone en el mapa; los invitados abren el juego
 *     (basta con la pantalla de titulo) y se conectan solos.
 *  2. Cuando estan todos, el anfitrion pulsa F11: todos cargan la misma partida y
 *     empieza el juego en red. Cada invitado es P2, P3 o P4 (por orden de conexion).
 *  3. En cada PC se juega con WASD o flechas, Z/Espacio/Enter, X/Esc/Retroceso,
 *     Shift, o con un mando (A, B, X/RT).
 *  Durante la partida en red no hay guardado rapido (F6/F7) ni ventanas F9.
 */

(() => {
    'use strict';

    const coop = window.CoopLocal;
    if (!coop || !coop.injectAction) {
        console.error('LocalCoop_Net: falta LookOutsideOnline.js (debe cargarse ANTES que este plugin).');
        return;
    }
    if (typeof require !== 'function') return; // solo en la app (NW.js), no en un navegador

    const fs = require('fs');
    const path = require('path');
    const netlib = require('net');

    const INPUT_DELAY = 3;      // cuadros de margen para que lleguen las teclas de todos
    const HASH_EVERY = 60;      // cada cuantos cuadros se compara la huella del mundo
    const MAX_CATCH_UP = 3;     // cuadros que se recuperan de golpe si un PC se queda atras
    const ACTIONS = coop.actions;
    const KEY_START = 122;      // F11: el anfitrion empieza la partida en red

    // ---- configuracion -------------------------------------------------------

    function readConfig() {
        try {
            const base = path.dirname(process.mainModule.filename);
            const file = path.join(base, 'coop_net.json');
            if (!fs.existsSync(file)) return null;
            const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (cfg.role !== 'host' && cfg.role !== 'join') return null;
            cfg.port = Number(cfg.port) || 47810;
            cfg.host = String(cfg.host || '127.0.0.1');
            return cfg;
        } catch (e) {
            console.error('LocalCoop_Net: coop_net.json no valido', e);
            return null;
        }
    }

    const config = readConfig();
    if (!config) return;

    // ---- estado ----------------------------------------------------------------

    const Net = {
        role: config.role,
        player: config.role === 'host' ? 1 : 0, // el invitado recibe su numero al conectarse
        active: false,          // partida en red en marcha
        players: [1],           // jugadores de la partida
        frame: 0,               // siguiente cuadro a ejecutar
        frames: {},             // cuadro -> acciones de todos ({ a: [ , p1, p2, p3, p4], rs })
        applied: {},            // jugador -> acciones aplicadas en el ultimo cuadro
        localKeys: 0,           // acciones del teclado de este PC
        localPads: {},          // indice del mando -> acciones
        sceneSeq: 0,            // cuantas escenas se han abierto en la partida en red
        allReady: 0,            // escena que ya han cargado todos (viene en cada cuadro)
        // anfitrion
        server: null,
        peers: [],              // { sock, player, ready, address }
        inputs: {},             // cuadro -> { jugador: acciones }
        nextBuild: 0,
        ownHashes: {},          // cuadro -> huella del anfitrion
        // invitado
        sock: null,
        lastDesync: -9999
    };

    function bitsOf(list) {
        let b = 0;
        ACTIONS.forEach((a, i) => { if (list[a]) b |= 1 << i; });
        return b;
    }

    function banner(title, sub, color, duration) {
        if (SceneManager._scene) coop.banner(title, sub || '', color || '#7fb3ff', duration || 180);
    }

    // ---- mensajes (JSON por lineas) ------------------------------------------------

    function send(sock, msg) {
        if (sock && !sock.destroyed) sock.write(JSON.stringify(msg) + '\n');
    }

    function readLines(sock, onMessage) {
        let buffer = '';
        sock.setEncoding('utf8');
        sock.setNoDelay(true);
        sock.on('data', chunk => {
            buffer += chunk;
            let i;
            while ((i = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, i);
                buffer = buffer.slice(i + 1);
                if (!line) continue;
                try {
                    onMessage(JSON.parse(line));
                } catch (e) {
                    console.error('LocalCoop_Net: mensaje no valido', e);
                }
            }
        });
    }

    // ---- azar comun --------------------------------------------------------------
    // Math.random del juego sale de una semilla comun. Lo que solo dibuja (sprites, luz,
    // clima...) usa otro generador, porque cada PC dibuja una parte distinta del mapa.

    const nativeRandom = Math.random;
    let rngState = 0;

    function seededRandom() {
        // mulberry32
        rngState = (rngState + 0x6D2B79F5) | 0;
        let t = rngState;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    const _Spriteset_Base_update = Spriteset_Base.prototype.update;
    Spriteset_Base.prototype.update = function() {
        if (!Net.active) {
            _Spriteset_Base_update.call(this);
            return;
        }
        const logic = Math.random;
        Math.random = nativeRandom;
        try {
            _Spriteset_Base_update.call(this);
        } finally {
            Math.random = logic;
        }
    };

    // ---- teclado y mandos de este PC -----------------------------------------------
    // Durante la partida en red las teclas no van al juego: se convierten en acciones de
    // este jugador y viajan por la red; el juego las recibe en el cuadro que toca.

    const LOCAL_KEYS = {
        87: 'up', 38: 'up', 83: 'down', 40: 'down', 65: 'left', 37: 'left', 68: 'right', 39: 'right',
        90: 'ok', 32: 'ok', 13: 'ok', 88: 'cancel', 27: 'cancel', 8: 'cancel', 16: 'shift'
    };
    // teclas que siguen funcionando en cada PC: camara (G), zoom (- =), medidor (F10),
    // pantalla (F2 F3 F4), consola (F8)
    const LOCAL_ONLY = [71, 187, 189, 121, 113, 114, 115, 119];

    const keyState = {};

    function onLocalKey(e, down) {
        if (!Net.active) return;
        if (LOCAL_ONLY.indexOf(e.keyCode) >= 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const action = LOCAL_KEYS[e.keyCode];
        if (!action) return;
        keyState[e.keyCode] = down;
        const list = {};
        Object.keys(LOCAL_KEYS).forEach(code => { if (keyState[code]) list[LOCAL_KEYS[code]] = true; });
        Net.localKeys = bitsOf(list);
    }

    window.addEventListener('keydown', e => onLocalKey(e, true), true);
    window.addEventListener('keyup', e => onLocalKey(e, false), true);
    window.addEventListener('blur', () => {
        Object.keys(keyState).forEach(k => { keyState[k] = false; });
        Net.localKeys = 0;
    });

    function capturePad(gamepad) {
        const b = gamepad.buttons;
        const pressed = i => !!b[i] && (b[i].pressed || b[i].value > 0.5);
        const ax = gamepad.axes || [];
        Net.localPads[gamepad.index] = bitsOf({
            up: pressed(12) || ax[1] < -0.5, down: pressed(13) || ax[1] > 0.5,
            left: pressed(14) || ax[0] < -0.5, right: pressed(15) || ax[0] > 0.5,
            ok: pressed(0), cancel: pressed(1), shift: pressed(2) || pressed(7)
        });
    }

    function localBits() {
        let b = Net.localKeys;
        Object.keys(Net.localPads).forEach(i => { b |= Net.localPads[i]; });
        return b;
    }

    // ---- cuadros ---------------------------------------------------------------------

    // escena que este PC ya tiene cargada y lista (si no, la anterior)
    function myReadySeq() {
        const sm = SceneManager;
        if (sm._nextScene || !sm._scene) return Net.sceneSeq - 1;
        return (sm._sceneStarted || sm._scene.isReady()) ? Net.sceneSeq : Net.sceneSeq - 1;
    }

    // entrada de este PC para un cuadro futuro
    function sendLocalInput(f) {
        const bits = localBits();
        if (Net.role === 'host') {
            hostStoreInput(f, 1, bits, myReadySeq());
        } else {
            send(Net.sock, { t: 'in', f: f, b: bits, rs: myReadySeq() });
        }
    }

    function applyActions(all) {
        for (const p of Net.players) {
            const prev = Net.applied[p] || 0;
            const cur = all[p] || 0;
            if (prev === cur) continue;
            ACTIONS.forEach((action, i) => {
                const was = (prev >> i) & 1;
                const now = (cur >> i) & 1;
                if (was !== now) coop.injectAction(p, action, !!now);
            });
            Net.applied[p] = cur;
        }
    }

    // un cuadro de juego con las acciones de todos
    function netStep(pkt) {
        sendLocalInput(Net.frame + INPUT_DELAY);
        Net.allReady = pkt.rs;
        applyActions(pkt.a);
        SceneManager.updateInputData();
        SceneManager.changeScene();
        SceneManager.updateScene();
        if (Net.frame % HASH_EVERY === 0) checkHash(Net.frame);
        Net.frame++;
    }

    const _SceneManager_updateMain = SceneManager.updateMain;
    SceneManager.updateMain = function() {
        if (!Net.active) {
            _SceneManager_updateMain.call(this);
            return;
        }
        // un cuadro por cada uno que llegue de la red (y alguno mas si este PC va atrasado)
        for (let i = 0; i < MAX_CATCH_UP && Net.frames[Net.frame]; i++) {
            const pkt = Net.frames[Net.frame];
            delete Net.frames[Net.frame];
            netStep(pkt);
            if (!Net.frames[Net.frame + 1]) break;
        }
        this.renderScene();
        this.requestUpdate();
    };

    // cada escena nueva solo empieza cuando todos la tienen cargada
    const _SceneManager_goto = SceneManager.goto;
    SceneManager.goto = function(sceneClass) {
        if (Net.active && sceneClass) Net.sceneSeq++;
        _SceneManager_goto.call(this, sceneClass);
    };

    const _SceneManager_updateScene = SceneManager.updateScene;
    SceneManager.updateScene = function() {
        if (Net.active && this._scene && !this._sceneStarted && Net.allReady < Net.sceneSeq) return;
        _SceneManager_updateScene.call(this);
    };

    // Los eventos se mueven solos si estan "cerca de la pantalla": aqui cerca de cualquier
    // jugador, no de la camara de este PC (cada PC mira a un sitio distinto)
    const _Game_CharacterBase_isNearTheScreen = Game_CharacterBase.prototype.isNearTheScreen;
    Game_CharacterBase.prototype.isNearTheScreen = function() {
        if (!Net.active) return _Game_CharacterBase_isNearTheScreen.call(this);
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        return coop.allPlayers().some(p => Math.abs($gameMap.deltaX(this._realX, p._realX)) * tw <= Graphics.width &&
            Math.abs($gameMap.deltaY(this._realY, p._realY)) * th <= Graphics.height);
    };

    // ---- cosas que dependen de lo rapido que carga cada PC ------------------------------
    // Las animaciones esperan a tener su imagen y los mensajes a tener la cara: en cada PC
    // tardan distinto y eso cambiaria cuantos cuadros duran. En red no esperan (si la imagen
    // aun no esta, se ve un momento sin ella).
    const _Sprite_Animation_isReady = Sprite_Animation.prototype.isReady;
    Sprite_Animation.prototype.isReady = function() {
        return Net.active || _Sprite_Animation_isReady.call(this);
    };

    const _Window_Message_updateLoading = Window_Message.prototype.updateLoading;
    Window_Message.prototype.updateLoading = function() {
        if (Net.active) return false;
        return _Window_Message_updateLoading.call(this);
    };

    // el raton de un PC no debe mover a nadie en los demas
    const _TouchInput_update = TouchInput.update;
    TouchInput.update = function() {
        _TouchInput_update.call(this);
        if (Net.active) this.clear();
    };

    // ---- huella del mundo (para detectar que los PC se han separado) -------------------

    function fnv(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16);
    }

    function worldParts() {
        const scene = SceneManager._scene ? SceneManager._scene.constructor.name : '-';
        const players = coop.allPlayers().map(p => [p._x, p._y, p._direction].join('.')).join('|');
        const events = $gameMap ? $gameMap.events().map(e => e ? [e._eventId, e._x, e._y, e._direction, e._pageIndex].join('.') : '').join('|') : '';
        const party = $gameParty ? $gameParty._actors.join('.') + ':' + $gameParty.members().map(a => a.hp + '/' + a.mp).join('.') : '';
        const switches = $gameSwitches ? $gameSwitches._data.map((v, i) => v ? i : '').join(',') : '';
        const vars = $gameVariables ? $gameVariables._data.join(',') : '';
        return [scene + ':' + ($gameMap ? $gameMap.mapId() : 0), players, events, party, switches, vars, String(rngState)];
    }
    const PART_NAMES = ['scene/map', 'players', 'events', 'party', 'switches', 'variables', 'random'];

    function checkHash(f) {
        const parts = worldParts().map(fnv);
        if (Net.role === 'host') {
            Net.ownHashes[f] = parts;
        } else {
            send(Net.sock, { t: 'h', f: f, h: parts });
        }
    }

    function compareHash(player, f, parts) {
        const own = Net.ownHashes[f];
        if (!own) return;
        const diff = PART_NAMES.filter((name, i) => own[i] !== parts[i]);
        if (diff.length === 0) return;
        console.warn('LocalCoop_Net: desync P' + player + ' frame ' + f + ':', diff.join(', '));
        if (f - Net.lastDesync > 600) {
            Net.lastDesync = f;
            banner('DESYNC with P' + player + ' (frame ' + f + ')', 'Different: ' + diff.join(', '), '#ff5555', 300);
        }
        Net.peers.forEach(peer => send(peer.sock, { t: 'desync', player: player, f: f, diff: diff }));
    }

    // ---- empezar / terminar la partida en red ----------------------------------------------

    function beginSession(seed, saveJson, players) {
        Net.players = players.slice();
        Net.frame = 0;
        Net.frames = {};
        Net.applied = {};
        Net.inputs = {};
        Net.nextBuild = 0;
        Net.ownHashes = {};
        Net.sceneSeq = 0;
        Net.allReady = 0;
        rngState = seed | 0;
        Math.random = seededRandom;
        Input.clear();
        // todos cargan la misma partida
        DataManager.createGameObjects();
        DataManager.extractSaveContents(JsonEx.parse(saveJson));
        $gameSystem.onAfterLoad();
        coop.forceRestore(players.filter(p => p !== 1));
        coop.setCamera('p' + Net.player);
        Net.active = true;
        coop.setPadCapture(capturePad);
        SceneManager.goto(Scene_Map);
        // los primeros cuadros van sin teclas (margen de INPUT_DELAY)
        for (let f = 0; f < INPUT_DELAY; f++) {
            if (Net.role === 'host') {
                Net.players.forEach(p => hostStoreInput(f, p, 0, -1));
            }
        }
        banner('Network game: you are P' + Net.player, 'Players: ' + players.map(p => 'P' + p).join(', '), '#7fb3ff', 240);
    }

    function endSession(reason) {
        if (!Net.active) return;
        Net.active = false;
        Math.random = nativeRandom;
        coop.setPadCapture(null);
        coop.setCamera('auto');
        banner('Network game stopped', reason || '', '#ffaa44', 300);
    }

    // ---- anfitrion ----------------------------------------------------------------------

    function hostStoreInput(f, player, bits, readySeq) {
        if (!Net.active || f < Net.nextBuild) return;
        if (!Net.inputs[f]) Net.inputs[f] = {};
        Net.inputs[f][player] = bits;
        if (player === 1) Net.hostReady = readySeq;
        else {
            const peer = Net.peers.find(pp => pp.player === player);
            if (peer) peer.ready = readySeq;
        }
        hostBuildFrames();
    }

    // reparte los cuadros que ya tienen las teclas de todos
    function hostBuildFrames() {
        while (true) {
            const f = Net.nextBuild;
            const got = Net.inputs[f];
            if (!got || !Net.players.every(p => got[p] !== undefined)) return;
            const a = [0, 0, 0, 0, 0];
            Net.players.forEach(p => { a[p] = got[p]; });
            const ready = [Net.hostReady].concat(Net.peers.filter(pp => Net.players.indexOf(pp.player) >= 0).map(pp => pp.ready));
            const pkt = { t: 'fr', f: f, a: a, rs: Math.min.apply(null, ready.map(r => (r === undefined ? -1 : r))) };
            Net.frames[f] = pkt;
            Net.peers.forEach(peer => send(peer.sock, pkt));
            delete Net.inputs[f];
            delete Net.ownHashes[f - HASH_EVERY * 10];
            Net.nextBuild++;
        }
    }

    function startHost() {
        Net.server = netlib.createServer(sock => {
            const used = Net.peers.map(pp => pp.player);
            const player = [2, 3, 4].find(n => used.indexOf(n) < 0);
            if (!player || Net.active) {
                send(sock, { t: 'full' });
                sock.end();
                return;
            }
            const peer = { sock: sock, player: player, ready: -1, address: sock.remoteAddress };
            Net.peers.push(peer);
            send(sock, { t: 'hi', player: player });
            banner('P' + player + ' connected', peer.address + '  -  F11 starts the network game', '#7fb3ff', 240);
            readLines(sock, msg => {
                if (msg.t === 'in') hostStoreInput(msg.f, player, msg.b | 0, msg.rs);
                else if (msg.t === 'h') compareHash(player, msg.f, msg.h);
            });
            const gone = () => {
                Net.peers = Net.peers.filter(pp => pp !== peer);
                if (Net.active && Net.players.indexOf(player) >= 0) {
                    Net.peers.forEach(pp => send(pp.sock, { t: 'stop', reason: 'P' + player + ' disconnected' }));
                    endSession('P' + player + ' disconnected');
                } else {
                    banner('P' + player + ' disconnected', '', '#ffaa44', 180);
                }
            };
            sock.on('close', gone);
            sock.on('error', () => {});
        });
        Net.server.on('error', e => banner('Network: cannot open port ' + config.port, String(e.code || e), '#ff5555', 400));
        Net.server.listen(config.port, () => console.log('LocalCoop_Net: host listening on ' + config.port));
    }

    function hostStartSession() {
        if (Net.active) return;
        if (!(SceneManager._scene instanceof Scene_Map) || !$gameParty.leader()) {
            banner('Load your game and stand on the map first', '', '#ffaa44', 180);
            return;
        }
        if (Net.peers.length === 0) {
            banner('Nobody connected yet', 'Port ' + config.port, '#ffaa44', 180);
            return;
        }
        const players = [1].concat(Net.peers.map(pp => pp.player)).sort();
        $gameSystem.onBeforeSave();
        const saveJson = JsonEx.stringify(DataManager.makeSaveContents());
        const seed = (nativeRandom() * 4294967296) | 0;
        Net.peers.forEach(peer => send(peer.sock, { t: 'start', seed: seed, save: saveJson, players: players }));
        beginSession(seed, saveJson, players);
    }

    window.addEventListener('keydown', e => {
        if (e.keyCode === KEY_START && Net.role === 'host' && !e.repeat) hostStartSession();
    });

    // ---- invitado -----------------------------------------------------------------------

    function startJoin() {
        const tryConnect = () => {
            const sock = netlib.connect(config.port, config.host);
            Net.sock = sock;
            readLines(sock, msg => {
                if (msg.t === 'hi') {
                    Net.player = msg.player;
                    banner('Connected to the host as P' + msg.player, 'Waiting for the host to press F11', '#7fb3ff', 300);
                } else if (msg.t === 'full') {
                    banner('The network game is full or already started', '', '#ffaa44', 300);
                } else if (msg.t === 'start') {
                    beginSession(msg.seed, msg.save, msg.players);
                } else if (msg.t === 'fr') {
                    Net.frames[msg.f] = msg;
                } else if (msg.t === 'desync') {
                    if (msg.player === Net.player && msg.f - Net.lastDesync > 600) {
                        Net.lastDesync = msg.f;
                        banner('DESYNC with the host (frame ' + msg.f + ')', 'Different: ' + msg.diff.join(', '), '#ff5555', 300);
                    }
                } else if (msg.t === 'stop') {
                    endSession(msg.reason);
                }
            });
            sock.on('error', () => {});
            sock.on('close', () => {
                if (Net.active) endSession('Lost the connection to the host');
                Net.sock = null;
                setTimeout(tryConnect, 3000); // se reconecta solo (antes de empezar)
            });
        };
        tryConnect();
    }

    if (Net.role === 'host') startHost();
    else startJoin();

    window.CoopNet = Net;
})();
