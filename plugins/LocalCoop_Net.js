/*:
 * @target MV
 * @plugindesc v0.2 [PROTOTIPO] Co-op en red local: cada jugador en su PC con su copia del juego (lockstep). Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @help
 * PROTOTIPO. Se configura en Opciones > Co-op > Network game... (o en www/coop_net.json).
 *
 * Como funciona (lockstep)
 * ------------------------
 * Todos los PC ejecutan el juego entero. Por la red solo viajan las teclas: en cada
 * cuadro todos reciben las acciones de todos los jugadores y calculan exactamente el
 * mismo cuadro, cada uno con la camara de su jugador. El anfitrion (P1) recoge las
 * teclas de todos y reparte los cuadros. Para que todos calculen lo mismo:
 *  - el azar del juego (Math.random), el reloj (Date) y el contador de cuadros son
 *    comunes durante cada cuadro de red;
 *  - 60 cuadros de juego por segundo segun el reloj (sin FluidTimestep);
 *  - al cambiar de escena nadie empieza hasta que todos han terminado de cargar;
 *  - cada 60 cuadros se compara una "huella" del mundo.
 *
 * Instantaneas: el anfitrion reparte su mundo (como una partida guardada) para empezar,
 * para corregir a los PC que se hayan separado (en el primer momento tranquilo: en el
 * mapa, sin dialogos ni eventos) y para que alguien entre o vuelva a mitad de partida.
 * Si un jugador se desconecta, su personaje pasa a la IA ("ausente") y los demas siguen;
 * al volver a conectarse recupera su personaje.
 *
 * www/coop_net.json
 * -----------------
 *  { "role": "host", "port": 47810 }                         anfitrion (P1)
 *  { "role": "join", "host": "192.168.1.20", "port": 47810 } invitado
 *  { "role": "off" }                                         apagado
 *
 * Uso: el anfitrion carga su partida y se pone en el mapa; los invitados abren el juego
 * (basta la pantalla de titulo) y se conectan solos; el anfitrion pulsa F11.
 * En cada PC: WASD o flechas, Z/Espacio/Enter, X/Esc/Retroceso, Shift, o un mando.
 * En la partida en red no hay guardado rapido (F6/F7), ventanas F9 ni recarga (F5).
 */

(() => {
    'use strict';

    const coop = window.CoopLocal;
    if (!coop || !coop.injectAction || !coop.clearInputs) {
        console.error('LocalCoop_Net: falta LookOutsideOnline.js (debe cargarse ANTES que este plugin).');
        return;
    }
    if (typeof require !== 'function') return; // solo en la app (NW.js), no en un navegador

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const netlib = require('net');

    const INPUT_DELAY = 3;      // cuadros de margen para que lleguen las teclas de todos
    const HASH_EVERY = 60;      // cada cuantos cuadros se compara la huella del mundo
    const MAX_CATCH_UP = 3;     // cuadros que se recuperan de golpe si un PC se queda atras
    const STEP_MS = 1000 / 60;  // el juego va a 60 cuadros por segundo, sea cual sea el monitor
    const LOG_KEEP = 12;        // huellas completas que se guardan para el registro de desync
    const PING_MS = 1000;
    const DEFAULT_PORT = 47810;
    const ACTIONS = coop.actions;
    const KEY_START = 122;      // F11: el anfitrion empieza la partida en red
    const COLOR_NET = '#7fb3ff';

    // ---- configuracion (www/coop_net.json) --------------------------------------

    const baseDir = path.dirname(process.mainModule.filename);
    const configFile = path.join(baseDir, 'coop_net.json');

    function readConfig() {
        const off = { role: 'off', host: '127.0.0.1', port: DEFAULT_PORT };
        try {
            if (!fs.existsSync(configFile)) return off;
            const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            return {
                role: ['host', 'join'].indexOf(cfg.role) >= 0 ? cfg.role : 'off',
                host: String(cfg.host || '127.0.0.1'),
                port: Number(cfg.port) || DEFAULT_PORT
            };
        } catch (e) {
            console.error('LocalCoop_Net: coop_net.json no valido', e);
            return off;
        }
    }

    function writeConfig(cfg) {
        try {
            fs.writeFileSync(configFile, JSON.stringify(cfg, null, 4));
        } catch (e) {
            console.error('LocalCoop_Net: no se pudo guardar coop_net.json', e);
        }
    }

    function localAddresses() {
        const out = [];
        const all = os.networkInterfaces();
        Object.keys(all).forEach(name => (all[name] || []).forEach(a => {
            if (a.family === 'IPv4' && !a.internal) out.push(a.address);
        }));
        return out;
    }

    // ---- estado ----------------------------------------------------------------

    const Net = {
        config: readConfig(),
        role: 'off',
        player: 0,              // jugador de este PC (1 = anfitrion)
        active: false,          // partida en red en marcha
        players: [1],           // jugadores de la partida
        frame: 0,               // siguiente cuadro a ejecutar
        frames: {},             // cuadro -> paquete { a: [, p1, p2, p3, p4], rs, ev }
        applied: {},            // jugador -> acciones aplicadas en el ultimo cuadro
        localKeys: 0,
        localPads: {},
        sceneSeq: 0,            // cuantas escenas se han abierto en la partida en red
        allReady: 0,            // escena que ya han cargado todos (viene en cada cuadro)
        clockAcc: 0,
        clockLast: 0,
        timeBase: 0,
        frameBase: 0,
        history: {},            // cuadro -> huella completa (registro de desync)
        pendingExtras: null,    // tras una instantanea: posiciones de P2-P4 a recolocar
        lastDesync: -9999,
        connected: false,
        ping: 0,
        // anfitrion
        server: null,
        peers: [],              // { sock, player, ready, address, ping, inSession }
        inputs: {},             // cuadro -> { jugador: acciones }
        nextBuild: 0,
        ownHashes: {},
        hostReady: -1,
        lost: {},               // jugador -> true: desconectado (su personaje va con la IA)
        hold: null,             // { at }: no se reparten cuadros >= at hasta la instantanea
        resyncWanted: false,
        joinQueue: [],          // jugadores que entran / vuelven en la proxima instantanea
        pendingEvents: [],      // sucesos para el proximo cuadro (p.ej. alguien se fue)
        // invitado
        sock: null,
        reconnectTimer: null
    };

    function bitsOf(list) {
        let b = 0;
        ACTIONS.forEach((a, i) => { if (list[a]) b |= 1 << i; });
        return b;
    }

    function banner(title, sub, color, duration) {
        if (SceneManager._scene) coop.banner(title, sub || '', color || COLOR_NET, duration || 180);
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
                let msg = null;
                try {
                    msg = JSON.parse(line);
                } catch (e) {
                    console.error('LocalCoop_Net: mensaje no valido', e);
                }
                if (msg) onMessage(msg);
            }
        });
    }

    // ---- azar y tiempo comunes -------------------------------------------------------
    // Math.random del juego sale de una semilla comun; lo que solo dibuja (sprites, luz,
    // clima...) usa otro generador, porque cada PC dibuja una parte distinta del mapa.
    // Durante cada cuadro de red el reloj (Date) y Graphics.frameCount tambien son comunes:
    // el dia/noche de TerraxLighting, VE_BasicModule en combate y el tiempo de juego.

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

    const NativeDate = Date;
    function netTimeMs() {
        return Net.timeBase + Math.floor(Net.frame * STEP_MS);
    }
    function NetDate() {
        if (arguments.length === 0) return new NativeDate(netTimeMs());
        return new (Function.prototype.bind.apply(NativeDate, [null].concat(Array.prototype.slice.call(arguments))))();
    }
    NetDate.prototype = NativeDate.prototype;
    NetDate.now = netTimeMs;
    NetDate.UTC = NativeDate.UTC;
    NetDate.parse = NativeDate.parse;

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
        if (!LOCAL_KEYS[e.keyCode]) return;
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

    function sendInput(f, bits) {
        if (Net.role === 'host') hostStoreInput(f, 1, bits, myReadySeq());
        else send(Net.sock, { t: 'in', f: f, b: bits, rs: myReadySeq() });
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

    // sucesos que viajan con el cuadro, para que pasen a la vez en todos los PC
    function applyEvents(list) {
        (list || []).forEach(ev => {
            if (ev.k === 'away') {
                coop.setAway(ev.n, true);
                banner('P' + ev.n + ' disconnected', 'AI plays their character until they come back', '#ffaa44', 240);
            }
        });
    }

    // tras una instantanea, P2-P4 vuelven a su sitio en cuanto el mapa los crea
    function applyPendingExtras() {
        const pend = Net.pendingExtras;
        if (!pend || !SceneManager._sceneStarted) return;
        Net.pendingExtras = null;
        pend.extras.forEach(e => {
            const p = coop.player(e.n);
            if (!p) return;
            p._coopActorId = e.actor;
            p.locate(e.x, e.y);
            p.setDirection(e.d);
        });
        pend.away.forEach(n => { if (pend.back.indexOf(n) < 0) coop.setAway(n, true); });
    }

    // momento tranquilo para una instantanea: en el mapa, sin eventos ni dialogos
    function isSafePoint() {
        return SceneManager._scene instanceof Scene_Map && SceneManager._sceneStarted && !SceneManager._nextScene &&
            !$gameMap.isEventRunning() && !$gameMessage.isBusy() && !$gamePlayer.isTransferring() && !Net.pendingExtras;
    }

    // un cuadro de juego con las acciones de todos
    function netStep(pkt) {
        sendInput(Net.frame + INPUT_DELAY, localBits());
        Net.allReady = pkt.rs;
        Graphics.frameCount = Net.frameBase + Net.frame;
        window.Date = NetDate;
        try {
            applyEvents(pkt.ev);
            applyActions(pkt.a);
            SceneManager.updateInputData();
            SceneManager.changeScene();
            SceneManager.updateScene();
            applyPendingExtras();
            // durante un cambio de escena no se compara: cada PC termina de cargar el mapa nuevo
            // en un momento distinto, aunque el juego no avanza hasta que todos estan listos
            if (Net.frame % HASH_EVERY === 0 && SceneManager._sceneStarted && !SceneManager._nextScene) checkHash(Net.frame);
        } finally {
            window.Date = NativeDate;
        }
        Net.frame++;
        if (Net.role === 'host') hostAfterStep();
    }

    function runFrame() {
        const pkt = Net.frames[Net.frame];
        delete Net.frames[Net.frame];
        netStep(pkt);
    }

    function framesWaiting() {
        let n = 0;
        while (n < 30 && Net.frames[Net.frame + n]) n++;
        return n;
    }

    const _SceneManager_updateMain = SceneManager.updateMain;
    SceneManager.updateMain = function() {
        if (!Net.active) {
            _SceneManager_updateMain.call(this);
            return;
        }
        // 60 cuadros de juego por segundo segun el reloj (no segun el monitor). Los cuadros que
        // llegan antes de tiempo esperan: son el margen de INPUT_DELAY. Si este PC se ha quedado
        // atras (hay muchos esperando), recupera alguno de mas.
        const now = performance.now();
        Net.clockAcc += Math.min(250, now - (Net.clockLast || now));
        Net.clockLast = now;
        let steps = 0;
        while (Net.active && Net.clockAcc >= STEP_MS && steps < MAX_CATCH_UP) {
            if (!Net.frames[Net.frame]) {
                Net.clockAcc = Math.min(Net.clockAcc, STEP_MS); // esperando a la red: no se acumula tiempo
                break;
            }
            runFrame();
            Net.clockAcc -= STEP_MS;
            steps++;
        }
        if (Net.active && steps < MAX_CATCH_UP && framesWaiting() > INPUT_DELAY + 2) runFrame();
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
    // tardan distinto y eso cambiaria cuantos cuadros duran. En red no esperan.
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

    function writeDesyncLog(f, who, diff) {
        const full = Net.history[f];
        if (!full) return;
        const lines = ['=== frame ' + f + '  (' + who + ')  ' + new NativeDate().toISOString() + '  different: ' + diff.join(', ')];
        PART_NAMES.forEach((name, i) => {
            if (diff.indexOf(name) >= 0) lines.push('[' + name + '] ' + full[i]);
        });
        try {
            fs.appendFileSync(path.join(baseDir, 'coop_net_desync.log'), lines.join('\n') + '\n');
        } catch (e) {
            console.error('LocalCoop_Net: no se pudo escribir el registro', e);
        }
    }

    function checkHash(f) {
        const full = worldParts();
        Net.history[f] = full;
        delete Net.history[f - HASH_EVERY * LOG_KEEP];
        const parts = full.map(fnv);
        if (Net.role === 'host') Net.ownHashes[f] = parts;
        else send(Net.sock, { t: 'h', f: f, h: parts });
    }

    // anfitrion: compara la huella de un invitado; si no coincide, pide una instantanea
    function compareHash(player, f, parts) {
        const own = Net.ownHashes[f];
        if (!own) return;
        const diff = PART_NAMES.filter((name, i) => own[i] !== parts[i]);
        if (diff.length === 0) return;
        console.warn('LocalCoop_Net: desync P' + player + ' frame ' + f + ':', diff.join(', '));
        if (f - Net.lastDesync > 600) {
            Net.lastDesync = f;
            writeDesyncLog(f, 'host, vs P' + player, diff);
            const peer = Net.peers.find(pp => pp.player === player);
            if (peer) send(peer.sock, { t: 'desync', f: f, diff: diff });
        }
        if (!Net.resyncWanted) {
            Net.resyncWanted = true;
            banner('PCs out of sync (P' + player + ': ' + diff.join(', ') + ')', 'Fixing it at the next quiet moment...', '#ffaa44', 200);
        }
    }

    // ---- instantaneas: el mundo del anfitrion para todos ---------------------------------
    // Sirven para empezar, para corregir un desync y para que alguien entre o vuelva. Todos
    // (tambien el anfitrion) cargan la misma instantanea en el mismo cuadro.

    function closeSceneNow() {
        const old = SceneManager._scene;
        if (old) {
            old.terminate();
            old.detachReservation();
        }
        SceneManager._scene = null;
        SceneManager._sceneStarted = false;
        SceneManager._nextScene = null;
    }

    function enterSession() {
        if (Net.active) return;
        Net.active = true;
        Math.random = seededRandom;
        Net.clockAcc = 0;
        Net.clockLast = 0;
        Net.frames = {};
        Net.history = {};
        coop.setPadCapture(capturePad);
    }

    function applySnapshot(meta, saveJson) {
        enterSession();
        rngState = meta.rng | 0;
        Net.frame = meta.f;
        Net.players = meta.players.slice();
        Net.frameBase = meta.frameBase;
        Net.timeBase = meta.timeBase;
        Net.sceneSeq = meta.sceneSeq;
        Net.applied = {};
        Net.history = {};
        Object.keys(Net.frames).forEach(f => { if (Number(f) < meta.f) delete Net.frames[f]; });
        closeSceneNow();
        DataManager.createGameObjects();
        DataManager.extractSaveContents(JsonEx.parse(saveJson));
        if (meta.first) $gameSystem.onAfterLoad(); // musica de la partida (al empezar)
        coop.clearInputs();
        coop.forceRestore(meta.players.filter(p => p !== 1));
        Net.pendingExtras = { extras: meta.extras || [], away: meta.away || [], back: meta.back || [] };
        SceneManager.goto(Scene_Map); // sceneSeq + 1, igual en todos
        coop.setCamera('p' + Net.player);
        // los primeros cuadros despues de la instantanea van sin teclas (margen de INPUT_DELAY)
        for (let f = meta.f; f < meta.f + INPUT_DELAY; f++) sendInput(f, 0);
        if (meta.first) {
            banner('Network game: you are P' + Net.player, 'Players: ' + meta.players.map(p => 'P' + p).join(', '), COLOR_NET, 240);
        } else if (meta.reason) {
            banner(meta.reason, '', COLOR_NET, 160);
        }
    }

    function endSession(reason) {
        if (!Net.active) return;
        Net.active = false;
        Math.random = nativeRandom;
        window.Date = NativeDate;
        coop.setPadCapture(null);
        coop.setCamera('auto');
        Net.hold = null;
        Net.joinQueue = [];
        Net.lost = {};
        Net.peers.forEach(pp => { pp.inSession = false; });
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

    function sessionPeers() {
        return Net.peers.filter(pp => pp.inSession);
    }

    // reparte los cuadros que ya tienen las teclas de todos (los desconectados no pulsan nada)
    function hostBuildFrames() {
        while (Net.active) {
            const f = Net.nextBuild;
            if (Net.hold && f >= Net.hold.at) return;
            const got = Net.inputs[f] || {};
            if (Net.players.some(p => !Net.lost[p] && got[p] === undefined)) return;
            const a = [0, 0, 0, 0, 0];
            Net.players.forEach(p => { a[p] = Net.lost[p] ? 0 : got[p]; });
            const ready = [Net.hostReady].concat(sessionPeers().map(pp => pp.ready));
            const pkt = { t: 'fr', f: f, a: a, rs: Math.min.apply(null, ready.map(r => (r === undefined ? -1 : r))) };
            if (Net.pendingEvents.length > 0) pkt.ev = Net.pendingEvents.splice(0);
            Net.frames[f] = pkt;
            sessionPeers().forEach(peer => send(peer.sock, pkt));
            delete Net.inputs[f];
            delete Net.ownHashes[f - HASH_EVERY * LOG_KEEP];
            Net.nextBuild++;
        }
    }

    // despues de cada cuadro: preparar o hacer una instantanea pendiente
    function hostAfterStep() {
        const wanted = Net.resyncWanted || Net.joinQueue.length > 0;
        if (!Net.hold && wanted && isSafePoint()) Net.hold = { at: Net.nextBuild };
        if (Net.hold && Net.frame >= Net.hold.at) {
            if (isSafePoint()) {
                hostSnapshot(false);
            } else {
                Net.hold = null; // dejo de ser un momento tranquilo: se reintenta luego
                hostBuildFrames();
            }
        }
    }

    function hostSnapshot(first) {
        const back = Net.joinQueue.filter(n => Net.players.indexOf(n) >= 0);
        Net.joinQueue.forEach(n => {
            if (Net.players.indexOf(n) < 0) Net.players.push(n);
            delete Net.lost[n];
        });
        Net.players.sort();
        const reason = first ? '' : (Net.joinQueue.length > 0 ? 'P' + Net.joinQueue.join(', P') + ' joined' : 'Back in sync');
        const peersNow = Net.peers.filter(pp => Net.players.indexOf(pp.player) >= 0);
        peersNow.forEach(pp => { pp.inSession = true; pp.ready = -1; });
        $gameSystem.onBeforeSave();
        const meta = {
            f: Net.frame,
            first: !!first,
            rng: first ? ((nativeRandom() * 4294967296) | 0) : rngState,
            players: Net.players.slice(),
            frameBase: first ? $gameSystem._framesOnSave : Net.frameBase,
            timeBase: first ? NativeDate.now() : Net.timeBase,
            sceneSeq: Net.sceneSeq,
            extras: first ? [] : coop.players().map(p => ({ n: p.coopIndex(), actor: p._coopActorId, x: p._x, y: p._y, d: p._direction })),
            away: first ? [] : coop.awayPlayers().concat(Object.keys(Net.lost).map(Number)),
            back: back,
            reason: reason
        };
        const saveJson = JsonEx.stringify(DataManager.makeSaveContents());
        Net.inputs = {};
        Net.nextBuild = meta.f;
        Net.hold = null;
        Net.resyncWanted = false;
        Net.joinQueue = [];
        Net.ownHashes = {};
        Net.hostReady = -1;
        peersNow.forEach(peer => send(peer.sock, { t: 'snap', meta: meta, save: saveJson }));
        applySnapshot(meta, saveJson);
    }

    function hostStartSession() {
        if (Net.role !== 'host' || Net.active) return;
        if (!(SceneManager._scene instanceof Scene_Map) || !$gameParty.leader()) {
            banner('Load your game and stand on the map first', '', '#ffaa44', 180);
            return;
        }
        if (Net.peers.length === 0) {
            banner('Nobody connected yet', 'Your IP: ' + (localAddresses().join(', ') || '?') + '  port ' + Net.config.port, '#ffaa44', 240);
            return;
        }
        Net.player = 1;
        Net.players = [1];
        Net.lost = {};
        Net.pendingEvents = [];
        Net.joinQueue = Net.peers.map(pp => pp.player);
        Net.frame = 0;
        Net.sceneSeq = 0;
        enterSession();
        hostSnapshot(true);
    }

    function startHost() {
        Net.server = netlib.createServer(sock => {
            const used = Net.peers.map(pp => pp.player);
            // vuelve alguien que se habia ido: recupera su numero; si no, el primero libre
            const lostOnes = Object.keys(Net.lost).map(Number).filter(n => used.indexOf(n) < 0).sort();
            const player = lostOnes[0] || [2, 3, 4].find(n => used.indexOf(n) < 0 && Net.players.indexOf(n) < 0);
            if (!player) {
                send(sock, { t: 'full' });
                sock.end();
                return;
            }
            const peer = { sock: sock, player: player, ready: -1, address: sock.remoteAddress, ping: 0, inSession: false };
            Net.peers.push(peer);
            send(sock, { t: 'hi', player: player });
            if (Net.active) {
                Net.joinQueue.push(player);
                banner('P' + player + ' connected', 'Joining at the next quiet moment...', COLOR_NET, 200);
            } else {
                banner('P' + player + ' connected', peer.address + '  -  F11 starts the network game', COLOR_NET, 240);
            }
            readLines(sock, msg => {
                if (msg.t === 'in') hostStoreInput(msg.f, player, msg.b | 0, msg.rs);
                else if (msg.t === 'h') compareHash(player, msg.f, msg.h);
                else if (msg.t === 'ping') send(sock, { t: 'pong', ts: msg.ts });
                else if (msg.t === 'pong') peer.ping = Math.round(performance.now() - msg.ts);
            });
            const gone = () => {
                if (Net.peers.indexOf(peer) < 0) return;
                Net.peers = Net.peers.filter(pp => pp !== peer);
                Net.joinQueue = Net.joinQueue.filter(n => n !== player);
                if (Net.active && Net.players.indexOf(player) >= 0) {
                    // su personaje pasa a la IA en todos los PC a la vez (viaja con el proximo cuadro)
                    Net.lost[player] = true;
                    Net.pendingEvents.push({ k: 'away', n: player });
                    hostBuildFrames();
                } else {
                    banner('P' + player + ' disconnected', '', '#ffaa44', 180);
                }
            };
            sock.on('close', gone);
            sock.on('error', () => {});
        });
        Net.server.on('error', e => banner('Network: cannot open port ' + Net.config.port, String(e.code || e), '#ff5555', 400));
        Net.server.listen(Net.config.port, () => console.log('LocalCoop_Net: host listening on ' + Net.config.port));
    }

    window.addEventListener('keydown', e => {
        if (e.keyCode === KEY_START && Net.role === 'host' && !e.repeat) hostStartSession();
    });

    // ---- invitado -----------------------------------------------------------------------

    function startJoin() {
        const tryConnect = () => {
            Net.reconnectTimer = null;
            if (Net.role !== 'join') return;
            const sock = netlib.connect(Net.config.port, Net.config.host);
            Net.sock = sock;
            sock.on('connect', () => { Net.connected = true; });
            readLines(sock, msg => {
                if (msg.t === 'hi') {
                    Net.player = msg.player;
                    banner('Connected to the host as P' + msg.player, 'Waiting for the host...', COLOR_NET, 300);
                } else if (msg.t === 'full') {
                    banner('The network game is full', '', '#ffaa44', 300);
                } else if (msg.t === 'snap') {
                    applySnapshot(msg.meta, msg.save);
                } else if (msg.t === 'fr') {
                    if (Net.active && msg.f >= Net.frame) Net.frames[msg.f] = msg;
                } else if (msg.t === 'desync') {
                    writeDesyncLog(msg.f, 'P' + Net.player, msg.diff);
                } else if (msg.t === 'ping') {
                    send(sock, { t: 'pong', ts: msg.ts });
                } else if (msg.t === 'pong') {
                    Net.ping = Math.round(performance.now() - msg.ts);
                }
            });
            sock.on('error', () => {});
            sock.on('close', () => {
                if (Net.sock !== sock) return;
                Net.sock = null;
                Net.connected = false;
                if (Net.active) endSession('Lost the connection to the host - reconnecting...');
                if (Net.role === 'join') Net.reconnectTimer = setTimeout(tryConnect, 3000);
            });
        };
        tryConnect();
    }

    // ---- arrancar / cambiar la configuracion --------------------------------------------

    function stopNetworking() {
        if (Net.active) endSession('Network settings changed');
        if (Net.server) {
            Net.server.close();
            Net.peers.forEach(pp => pp.sock.destroy());
            Net.server = null;
            Net.peers = [];
        }
        if (Net.reconnectTimer) clearTimeout(Net.reconnectTimer);
        Net.reconnectTimer = null;
        Net.role = 'off';
        if (Net.sock) {
            const s = Net.sock;
            Net.sock = null;
            s.destroy();
        }
        Net.connected = false;
    }

    function startNetworking() {
        stopNetworking();
        Net.role = Net.config.role;
        Net.player = Net.role === 'host' ? 1 : 0;
        if (Net.role === 'host') startHost();
        else if (Net.role === 'join') startJoin();
    }

    // ping cada segundo (lo que se ve en F10)
    setInterval(() => {
        const ts = performance.now();
        if (Net.role === 'host') Net.peers.forEach(pp => send(pp.sock, { t: 'ping', ts: ts }));
        else if (Net.role === 'join' && Net.sock) send(Net.sock, { t: 'ping', ts: ts });
    }, PING_MS);

    coop.setNetStatus(() => {
        if (Net.role === 'off') return '';
        if (Net.role === 'host') {
            const pings = Net.peers.map(pp => 'P' + pp.player + ' ' + pp.ping + 'ms').join(' ');
            return 'NET host ' + (Net.active ? 'playing' : 'lobby') + ' [' + (pings || 'nobody') + '] buffer ' + framesWaiting();
        }
        return 'NET P' + (Net.player || '?') + ' ' + (Net.active ? 'playing' : (Net.connected ? 'waiting' : 'connecting')) +
            ' ping ' + Net.ping + 'ms buffer ' + framesWaiting();
    });

    startNetworking();

    // ---- ventana de opciones: Opciones > Co-op > Network game... -------------------------

    const NET_ROWS = ['role', 'host', 'port', 'apply'];
    const ROLE_LABELS = { off: 'Off', host: 'Host (I am P1)', join: 'Join a host' };

    function Window_CoopNet() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopNet.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopNet.prototype.constructor = Window_CoopNet;

    Window_CoopNet.prototype.initialize = function(x, y, w, h) {
        this._cfg = Object.assign({}, Net.config);
        this._editing = null;  // fila que se esta escribiendo ('host' / 'port')
        this._text = '';
        Window_Selectable.prototype.initialize.call(this, x, y, w, h);
        this._onKey = this.onKey.bind(this);
        window.addEventListener('keydown', this._onKey, true);
        this.refresh();
        this.select(0);
        this.activate();
    };

    Window_CoopNet.prototype.maxItems = function() {
        return NET_ROWS.length;
    };

    Window_CoopNet.prototype.rowValue = function(key) {
        if (key === 'role') return '< ' + ROLE_LABELS[this._cfg.role] + ' >';
        if (key === 'host') return this._editing === 'host' ? this._text + '_' : (this._cfg.role === 'join' ? this._cfg.host : '-');
        if (key === 'port') return this._editing === 'port' ? this._text + '_' : String(this._cfg.port);
        return Net.active ? '(in a network game)' : 'Save and connect';
    };

    Window_CoopNet.prototype.drawItem = function(index) {
        const key = NET_ROWS[index];
        const rect = this.itemRect(index);
        const names = { role: 'Mode', host: "Host's IP", port: 'Port', apply: '' };
        this.resetTextColor();
        this.drawText(names[key], rect.x + 8, rect.y, rect.width / 3, 'left');
        if (key === 'apply') this.changeTextColor(COLOR_NET);
        this.drawText(this.rowValue(key), rect.x + rect.width / 3, rect.y, rect.width * 2 / 3 - 8, key === 'apply' ? 'center' : 'right');
        this.resetTextColor();
    };

    Window_CoopNet.prototype.changeRole = function(step) {
        if (Net.active) {
            SoundManager.playBuzzer();
            return;
        }
        const roles = ['off', 'host', 'join'];
        const i = roles.indexOf(this._cfg.role);
        this._cfg.role = roles[(i + step + roles.length) % roles.length];
        SoundManager.playCursor();
        this.refresh();
    };

    Window_CoopNet.prototype.cursorRight = function() {
        if (!this._editing && NET_ROWS[this.index()] === 'role') this.changeRole(1);
    };

    Window_CoopNet.prototype.cursorLeft = function() {
        if (!this._editing && NET_ROWS[this.index()] === 'role') this.changeRole(-1);
    };

    Window_CoopNet.prototype.processOk = function() {
        if (this._editing) return;
        const key = NET_ROWS[this.index()];
        if (Net.active) {
            SoundManager.playBuzzer();
            return;
        }
        if (key === 'role') {
            this.changeRole(1);
        } else if (key === 'host' || key === 'port') {
            if (key === 'host' && this._cfg.role !== 'join') {
                SoundManager.playBuzzer();
                return;
            }
            this._editing = key;
            this._text = '';
            SoundManager.playOk();
            this.refresh();
        } else if (key === 'apply') {
            Net.config = Object.assign({}, this._cfg);
            writeConfig(Net.config);
            startNetworking();
            SoundManager.playOk();
            banner('Network: ' + ROLE_LABELS[Net.config.role], Net.config.role === 'host'
                ? 'Your IP: ' + (localAddresses().join(', ') || '?') : (Net.config.role === 'join' ? 'Connecting to ' + Net.config.host : ''), COLOR_NET, 240);
        }
    };

    // escribir la IP o el puerto (cifras, punto y retroceso; Enter acepta, Esc cancela)
    Window_CoopNet.prototype.onKey = function(e) {
        if (!this._editing) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const k = e.keyCode;
        if (k >= 48 && k <= 57) this._text += String(k - 48);
        else if (k >= 96 && k <= 105) this._text += String(k - 96);
        else if ((k === 190 || k === 110) && this._editing === 'host') this._text += '.';
        else if (k === 8) this._text = this._text.slice(0, -1);
        else if (k === 13) {
            if (this._editing === 'host' && /^\d{1,3}(\.\d{1,3}){3}$/.test(this._text)) this._cfg.host = this._text;
            if (this._editing === 'port' && Number(this._text) > 0 && Number(this._text) < 65536) this._cfg.port = Number(this._text);
            this._editing = null;
            SoundManager.playOk();
        } else if (k === 27) {
            this._editing = null;
            SoundManager.playCancel();
        }
        this.refresh();
    };

    Window_CoopNet.prototype.processCancel = function() {
        if (this._editing) return;
        Window_Selectable.prototype.processCancel.call(this);
    };

    Window_CoopNet.prototype.stopListening = function() {
        window.removeEventListener('keydown', this._onKey, true);
    };

    function Window_CoopNetHelp() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopNetHelp.prototype = Object.create(Window_Base.prototype);
    Window_CoopNetHelp.prototype.constructor = Window_CoopNetHelp;

    Window_CoopNetHelp.prototype.initialize = function(x, y, w, h) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this._key = '';
    };

    Window_CoopNetHelp.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        const lines = this.lines();
        const key = lines.join('|');
        if (key === this._key) return;
        this._key = key;
        this.contents.clear();
        this.contents.fontSize = 20;
        lines.forEach((line, i) => this.drawText(line, 0, i * 30, this.contents.width, 'left'));
    };

    Window_CoopNetHelp.prototype.lines = function() {
        const cfg = Net.config;
        const playing = Net.active ? 'In a network game as P' + Net.player + '.' : '';
        if (Net.role === 'host') {
            return ['You are the host (P1). Your IP: ' + (localAddresses().join(', ') || '?') + '  port ' + cfg.port,
                'Connected: ' + (Net.peers.map(pp => 'P' + pp.player + ' ' + pp.address).join(', ') || 'nobody yet'),
                playing || 'Load your game, stand on the map and press F11 to start.'];
        }
        if (Net.role === 'join') {
            return ['Joining ' + cfg.host + ':' + cfg.port + ' - ' + (Net.connected ? 'connected as P' + (Net.player || '?') : 'connecting...'),
                playing || 'Wait for the host to press F11.',
                'Every PC needs its own copy of the game (same version).'];
        }
        return ['Network game is off.', 'Host: your friends connect to you.  Join: type the host\'s IP.',
            'Left / Right / OK to change, then "Save and connect".'];
    };

    function Scene_CoopNet() {
        this.initialize.apply(this, arguments);
    }

    Scene_CoopNet.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_CoopNet.prototype.constructor = Scene_CoopNet;

    Scene_CoopNet.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const w = Graphics.boxWidth;
        const helpH = 130;
        this._netHelp = new Window_CoopNetHelp(0, 0, w, helpH);
        this.addWindow(this._netHelp);
        this._netList = new Window_CoopNet(0, helpH, w, NET_ROWS.length * 36 + 36);
        this._netList.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._netList);
    };

    Scene_CoopNet.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        this._netList.stopListening();
    };

    window.Scene_CoopNet = Scene_CoopNet;

    // entrada en Opciones > Co-op (YEP_OptionsCore) o una linea mas en Opciones
    if (typeof Yanfly !== 'undefined' && Yanfly.Param && Array.isArray(Yanfly.Param.OptionsCategories)) {
        const cat = Yanfly.Param.OptionsCategories.find(c => c.Name === 'Co-op');
        const code = text => JSON.stringify(text);
        if (cat) {
            cat.OptionsList.push({
                Name: 'Network game...', Symbol: 'coopNet', HelpDesc: code('Play over the local network, each player on their own PC.'),
                ShowHide: code('show = true;'), Enable: code('enabled = true;'), Ext: code('ext = 0;'),
                MakeCommandCode: code('this.addCommand(name, symbol, enabled, ext);'), DrawItemCode: code('this.drawOptionsName(index);'),
                ProcessOkCode: code('SoundManager.playOk(); SceneManager.push(Scene_CoopNet);'),
                CursorRightCode: code(''), CursorLeftCode: code(''), DefaultConfigCode: code(''), SaveConfigCode: code(''), LoadConfigCode: code('')
            });
        }
    } else {
        const _Window_Options_makeCommandList = Window_Options.prototype.makeCommandList;
        Window_Options.prototype.makeCommandList = function() {
            _Window_Options_makeCommandList.call(this);
            this.addCommand('Network game...', 'coopNet');
        };
        const _Window_Options_statusText = Window_Options.prototype.statusText;
        Window_Options.prototype.statusText = function(index) {
            return this.commandSymbol(index) === 'coopNet' ? '' : _Window_Options_statusText.call(this, index);
        };
        const _Window_Options_processOk = Window_Options.prototype.processOk;
        Window_Options.prototype.processOk = function() {
            if (this.commandSymbol(this.index()) === 'coopNet') {
                SoundManager.playOk();
                SceneManager.push(Scene_CoopNet);
                return;
            }
            _Window_Options_processOk.call(this);
        };
    }

    window.CoopNet = Net;
})();
