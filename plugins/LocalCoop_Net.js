/*:
 * @target MV
 * @plugindesc v1.9.3 [EXPERIMENTAL] Co-op en red (LAN o internet): cada jugador en su PC con su copia del juego (lockstep). Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @help
 * EXPERIMENTAL. Todo se hace en Opciones > Co-op > Network game...: el anfitrion abre la
 * partida ("Host") y la empieza cuando los demas estan conectados; los invitados escriben
 * la IP del anfitrion y pulsan "Connect". Nada se conecta solo al abrir el juego.
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
 * Si un jugador se desconecta, los demas siguen: su personaje vuelve a la fila como un
 * seguidor normal (si estaba en un combate, hasta el final del combate lo lleva la IA);
 * al volver a conectarse recupera su personaje.
 *
 * Menus: el menu de cada jugador no para el juego. Funciona por encima del mapa (en todos
 * los PC, para que todos calculen lo mismo) y solo lo ve quien lo abrio, como siempre;
 * su personaje se queda quieto. En un combate los menus se cierran. Cargar partida
 * y Salir no estan en la partida en red.
 *
 * En www/coop_net.json se guardan el modo elegido, la IP y el puerto (solo como valores
 * por defecto del menu). Los errores de la partida en red van a www/coop_net_error.log.
 *
 * Uso: el anfitrion carga su partida, elige Host y "Open the game"; los invitados (basta
 * la pantalla de titulo) eligen Join, escriben la IP y "Connect"; el anfitrion pulsa
 * "Start the network game".
 * En cada PC: WASD o flechas, Z/Espacio/Enter, X/Esc/Retroceso, Shift, o un mando.
 * En la partida en red F6/F7 solo en el anfitrion (ver "F6 / F7"); no hay ventanas F9 ni recarga (F5).
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
    let dgram = null; // para buscar partidas en la red (UDP); sin el, solo se escribe la IP
    try {
        dgram = require('dgram');
    } catch (e) {
        dgram = null;
    }

    const DEFAULT_DELAY = 3;    // cuadros de margen para que lleguen las teclas de todos (al empezar)
    const MIN_DELAY = 2;        // a mano (en la misma red puede bastar)
    const AUTO_MIN_DELAY = 3;   // en Auto: el ping no ve los tirones del ritmo de cuadros de cada PC
    const MAX_DELAY = 20;       // 20 cuadros = 1/3 s: mas alla no se puede jugar bien
    const PING_KEEP = 5;        // pings que se miran para la espera automatica (el peor de ellos)
    const HASH_EVERY = 60;      // cada cuantos cuadros se compara la huella del mundo
    const MAX_CATCH_UP = 3;     // cuadros que se recuperan de golpe si un PC se queda atras
    const STEP_MS = 1000 / 60;  // el juego va a 60 cuadros por segundo, sea cual sea el monitor
    const LOG_KEEP = 12;        // huellas completas que se guardan para el registro de desync
    const PING_MS = 1000;
    const DEFAULT_PORT = 47810;
    const ACTIONS = coop.actions;
    // ms que el anfitrion espera las teclas de un invitado para un cuadro; despues ese cuadro va sin
    // teclas suyas (su PC se habra parado: minimizado, cargando...). Nadie espera mas ni se suelta a
    // nadie: cuando su juego vuelve, recupera los cuadros (los tiene todos) y sigue.
    const STALL_MS = 500;
    const COLOR_NET = '#7fb3ff';

    // ---- configuracion (www/coop_net.json) --------------------------------------

    const baseDir = path.dirname(process.mainModule.filename);
    const configFile = path.join(baseDir, 'coop_net.json');

    function readConfig() {
        const off = { role: 'host', host: '127.0.0.1', port: DEFAULT_PORT, delay: 'auto', password: '', battles: 'together', bring: 0, showPing: true };
        try {
            if (!fs.existsSync(configFile)) return off;
            const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            return {
                role: cfg.role === 'join' ? 'join' : 'host',
                host: String(cfg.host || '127.0.0.1'),
                port: Number(cfg.port) || DEFAULT_PORT,
                delay: Number(cfg.delay) >= MIN_DELAY && Number(cfg.delay) <= MAX_DELAY ? Number(cfg.delay) : 'auto',
                password: String(cfg.password || ''),
                battles: cfg.battles === 'separate' ? 'separate' : 'together',
                bring: Number(cfg.bring) > 0 ? Number(cfg.bring) : 0,
                showPing: cfg.showPing !== false
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

    function logError(where, e) {
        console.error('LocalCoop_Net: ' + where, e);
        try {
            fs.appendFileSync(path.join(baseDir, 'coop_net_error.log'), new Date().toISOString() + '  ' + where + '\n' +
                (e && e.stack ? e.stack : String(e)) + '\n\n');
        } catch (e2) {
            // nada
        }
    }

    // errores sin capturar durante la partida en red (para poder ver que ha pasado)
    window.addEventListener('error', e => {
        if (Net.role !== 'off') logError('uncaught (' + (Net.active ? 'playing' : Net.role) + ')', e.error || e.message);
    });

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
        player: 0,              // jugador de este PC en el juego (P1 = el protagonista)
        seat: 0,                // numero de este PC en la red (1 = anfitrion); casi siempre = player
        active: false,          // partida en red en marcha
        players: [1],           // jugadores de la partida
        frame: 0,               // siguiente cuadro a ejecutar
        frames: {},             // cuadro -> paquete { a: [, p1, p2, p3, p4], rs, ev }
        applied: {},            // jugador -> acciones que recibe el mapa (sin las de su menu)
        raw: {},                // jugador -> acciones del cuadro tal como llegan
        mask: {},               // jugador -> teclas que al cerrar su menu seguian pulsadas
        left: {},               // jugador -> se fue: su personaje vuelve a la fila en el mapa
        localKeys: 0,
        localPads: {},
        sceneSeq: 0,            // cuantas escenas se han abierto en la partida en red
        allReady: 0,            // lo que ya tienen listo todos (ver myReadySeq; viene en cada cuadro)
        clockAcc: 0,
        clockLast: 0,
        timeBase: 0,
        frameBase: 0,
        history: {},            // cuadro -> huella completa (registro de desync)
        pendingExtras: null,    // tras una instantanea: posiciones de P2-P4 a recolocar
        lastDesync: -9999,
        connected: false,
        rejected: '',           // por que el anfitrion no nos dejo entrar (no se reintenta)
        ping: 0,
        pings: [],              // ultimos pings al anfitrion (invitado)
        delay: DEFAULT_DELAY,   // cuadros por delante a los que este PC manda sus teclas
        separate: false,        // combates aparte (lo decide el anfitrion al empezar)
        battleSeq: 0,           // cuantos combates aparte ha habido (igual en todos los PC)
        battleReadyAll: 0,      // combate aparte que ya han cargado todos (viene en cada cuadro)
        prevRaw: {},            // acciones del cuadro anterior (para ver pulsaciones nuevas)
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
        blockedSince: 0,        // desde cuando se espera la tecla de algun invitado
        waitSince: {},          // jugador -> desde cuando se esperan sus teclas
        stalledLog: {},
        blockedOn: [],
        startRequested: false,
        stopRequested: false,
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
        if (sock.setKeepAlive) sock.setKeepAlive(true, 5000);
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
                if (!msg) continue;
                try {
                    onMessage(msg);
                } catch (e) {
                    logError('message ' + msg.t, e);
                    banner('Network error: ' + (e && e.message), 'Details in www/coop_net_error.log', '#ff5555', 400);
                    sock.destroy(); // mejor desconectarse que dejar a los demas esperando
                    return;
                }
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

    // cada numero al azar de la logica, con quien lo pidio: si los PC se separan, el registro de
    // desync muestra la primera llamada distinta (asi se encuentra que plugin hace algo distinto)
    const RAND_KEEP = 4000;
    const randTrail = [];

    // (solo se guarda el Error: convertir la pila en texto cuesta, y solo hace falta si hay desync)
    function noteRandom() {
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 10;
        randTrail.push({ f: Net.frame, e: new Error() });
        Error.stackTraceLimit = limit;
        if (randTrail.length > RAND_KEEP + 500) randTrail.splice(0, randTrail.length - RAND_KEEP);
    }

    function trailLine(t) {
        const st = (t.e.stack || '').split('\n').slice(3, 10)
            .map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < ');
        return t.f + ' ' + st;
    }

    function seededRandom() {
        noteRandom();
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

    // Otros dibujos que piden numeros al azar fuera de Spriteset_Base.update (cada PC dibuja una
    // parte distinta: si tomaran de la semilla comun, los PC se separarian): la luz de
    // TerraxLighting (parpadeo de las luces, tambien en cada vista de la pantalla dividida) y el
    // grano de pelicula de FilterController.
    function visualOnly(proto, name) {
        const orig = proto && proto[name];
        if (typeof orig !== 'function' || orig._coopVisual) return;
        const wrapped = function() {
            if (!Net.active) return orig.apply(this, arguments);
            const logic = Math.random;
            Math.random = nativeRandom;
            try {
                return orig.apply(this, arguments);
            } finally {
                Math.random = logic;
            }
        };
        wrapped._coopVisual = true;
        proto[name] = wrapped;
    }

    if (typeof Filter_Controller !== 'undefined') visualOnly(Filter_Controller.prototype, 'updateFilter');
    // ruido y "glitch" de Olivia_HorrorEffects, tono de la voz de los mensajes (DhoomMessageSE),
    // primer cuadro de los proyectiles (UltraMode7)
    ['updateHorrorNoise', 'updateHorrorGlitchEffect'].forEach(name => visualOnly(Sprite.prototype, name));
    visualOnly(Window_Message.prototype, 'updateMessageSE');
    if (typeof Sprite_MapProjectile !== 'undefined') visualOnly(Sprite_MapProjectile.prototype, 'setBitmap');
    // (la clase de la luz no es global: se toma de la primera que se crea)
    if (Spriteset_Map.prototype.createLightmask) {
        const _createLightmask = Spriteset_Map.prototype.createLightmask;
        Spriteset_Map.prototype.createLightmask = function() {
            _createLightmask.apply(this, arguments);
            const proto = this._lightmask && Object.getPrototypeOf(this._lightmask);
            if (proto) ['update', '_updateMask'].forEach(name => visualOnly(proto, name));
        };
    }

    // GALV_VisibilityRange (Termina): la oscuridad con un agujero de vista alrededor del
    // protagonista. Cada PC la ve alrededor de su personaje (como la camara); si no tiene, de P1.
    // Es solo dibujo. (La clase del dibujo no es global: se toma de la primera que se crea.)
    function ownCharacter() {
        return Net.active && Net.player >= 2 ? coop.player(Net.player) || null : null;
    }
    if (Spriteset_Map.prototype.setVisibilityRange) {
        const _setVisibilityRange = Spriteset_Map.prototype.setVisibilityRange;
        Spriteset_Map.prototype.setVisibilityRange = function() {
            _setVisibilityRange.apply(this, arguments);
            const proto = this._galvVisRange && Object.getPrototypeOf(this._galvVisRange);
            if (!proto || proto._coopOwnView) return;
            proto._coopOwnView = true;
            const _update = proto.update;
            proto.update = function() {
                const own = ownCharacter();
                if (!own) return _update.apply(this, arguments);
                const real = $gamePlayer;
                $gamePlayer = own;
                try {
                    return _update.apply(this, arguments);
                } finally {
                    $gamePlayer = real;
                }
            };
        };
    }

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
        if (down && !e.repeat && (e.keyCode === 117 || e.keyCode === 118)) quickSaveKey(e.keyCode === 117, e.shiftKey);
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
        // el mando solo cuenta en la ventana activa (dos copias del juego en un PC leen el mismo mando)
        if (typeof document !== 'undefined' && document.hasFocus && !document.hasFocus()) {
            Net.localPads[gamepad.index] = 0;
            return;
        }
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
    // Cuanto tiene listo este PC de la escena actual, como un numero que solo crece:
    // escena * 2 + 1 = el mapa ya esta leido (falta prepararlo), escena * 2 + 2 = lista para empezar.
    // El mapa se prepara (Scene_Map.onMapLoaded: traslado del jugador, eventos...) cuando
    // TODOS lo han leido, en el mismo cuadro: si cada PC lo hiciera al terminar de leerlo,
    // el mundo cambiaria en cuadros distintos.
    function myReadySeq() {
        const sm = SceneManager;
        const seq = Net.sceneSeq;
        if (sm._nextScene || !sm._scene) return seq * 2;
        if (sm._sceneStarted) return seq * 2 + 2;
        const scene = sm._scene;
        if (scene instanceof Scene_Map && !scene._mapLoaded) return DataManager.isMapLoaded() ? seq * 2 + 1 : seq * 2;
        return scene.isReady() ? seq * 2 + 2 : seq * 2 + 1;
    }

    // combate aparte que este PC ya tiene cargado (sus imagenes): empieza cuando lo tienen todos
    function myBattleReady() {
        const pending = battles.filter(b => !b.started).sort((x, y) => x.seq - y.seq);
        for (const b of pending) if (!b.scene.isReady()) return b.seq - 1;
        return Net.battleSeq;
    }

    function sendInput(f, bits) {
        if (Net.role === 'host') hostStoreInput(f, 1, bits, myReadySeq(), myBattleReady());
        else send(Net.sock, { t: 'in', f: f, b: bits, rs: myReadySeq(), br: myBattleReady() });
    }

    // ---- quien lleva a quien -------------------------------------------------------------
    // Cada PC tiene su numero en la red (seat: el anfitrion es 1, los invitados por orden de llegada)
    // y lleva a un jugador del juego (player: P1 es el protagonista). Casi siempre son iguales; cuando
    // alguien mata al protagonista en un PvP a muerte pasa a ser P1 (y el muerto, su numero): eso se
    // guarda en la partida ($gameSystem._coopSeats: seat -> player) y las teclas de cada PC van a su
    // jugador. Cambia en el mismo cuadro en todos los PC.
    function seatTable() {
        return (typeof $gameSystem !== 'undefined' && $gameSystem && $gameSystem._coopSeats) || null;
    }
    function slotOf(seat) {
        const t = seatTable();
        return t && t[seat] ? t[seat] : seat;
    }
    function seatOf(slot) {
        const t = seatTable();
        if (!t) return slot;
        for (const k of Object.keys(t)) if (t[k] === slot) return Number(k);
        return t[slot] ? 0 : slot;
    }
    function swapSeats(x, y) {
        const t = Object.assign({}, seatTable() || {});
        [x, y].concat(Net.players).forEach(n => { const st = seatOf(n); if (st && !t[st]) t[st] = n; });
        const sx = seatOf(x), sy = seatOf(y);
        t[sx] = y;
        t[sy] = x;
        $gameSystem._coopSeats = t;
        const before = Net.player;
        Net.player = slotOf(Net.seat);
        // nadie sigue con las teclas que tenia el otro: se sueltan y cuentan al soltarlas
        closeSub(x);
        closeSub(y);
        Net.players.forEach(n => {
            if (Net.applied[n]) ACTIONS.forEach((action, i) => { if ((Net.applied[n] >> i) & 1) coop.injectAction(n, action, false); });
            Net.applied[n] = 0;
            Net.mask[n] = (Net.lastAll && Net.lastAll[seatOf(n)]) || 0; // (lo que su PC tiene pulsado: cuenta al soltarlo)
        });
        // los combates aparte siguen con sus jugadores: cambian sus numeros (si no, el de P2 que pasa
        // a ser P1 se quedaba en un combate "de P2", del otro, y se daba por perdido)
        const swapN = n => (n === x ? y : (n === y ? x : n));
        battles.forEach(b => {
            b.involved = b.involved.map(swapN);
            b.joins = b.joins.map(swapN);
            const inputs = {};
            Object.keys(b.inputs).forEach(k => { inputs[swapN(Number(k))] = b.inputs[k]; });
            b.inputs = inputs;
            if (b.pvpSides) {
                const sides = {};
                Object.keys(b.pvpSides).forEach(k => { sides[swapN(Number(k))] = b.pvpSides[k]; });
                b.pvpSides = sides;
            }
        });
        cameraHadChar = !coop.player(Net.player);
        coop.setCamera(Net.player === 1 ? 'p1' : 'p' + Net.player);
        battleLog('seats: P' + x + ' <-> P' + y + ' (this PC: P' + before + ' -> P' + Net.player + ')');
        return Net.player;
    }
    Net.swapSeats = swapSeats;
    Net.slotOf = slotOf;

    function applyActions(all) {
        Net.lastAll = all;
        for (const p of Net.players) {
            const prev = Net.applied[p] || 0;
            const raw = all[seatOf(p)] || 0;
            Net.raw[p] = raw;
            // con su menu abierto, sus teclas son del menu; al cerrarlo, las que siguen pulsadas
            // no cuentan en el mapa hasta soltarlas (si no, Cancelar volveria a abrir el menu)
            Net.mask[p] = (Net.mask[p] || 0) & raw;
            const cur = (subs[p] || inSeparateBattle(p)) ? 0 : (raw & ~Net.mask[p]);
            if (prev === cur) continue;
            ACTIONS.forEach((action, i) => {
                const was = (prev >> i) & 1;
                const now = (cur >> i) & 1;
                if (was !== now) coop.injectAction(p, action, !!now);
            });
            Net.applied[p] = cur;
        }
    }

    // ---- F6 / F7 (con LocalCoop_QuickSave) en la partida en red: solo el anfitrion ----------
    // Viajan como sucesos del cuadro. F6: la pantalla de Guardar como menu de P1 (en todos los PC:
    // cada invitado guarda tambien una copia). Shift+F6: guardar ya en la ranura 99.
    // F7 / Shift+F7: todos vuelven al titulo (la partida en red se para a la vez), el anfitrion
    // carga y, de vuelta en el mapa, la partida en red empieza otra vez con su mundo.
    const QUICK_SLOT = 99;

    function hasQuickSave() {
        return typeof $plugins !== 'undefined' && $plugins.some(pl => pl && pl.status && pl.name === 'LocalCoop_QuickSave');
    }

    function quickSaveKey(save, shift) {
        if (!hasQuickSave()) return;
        if (coop.setting('cheats') === false) {
            banner('Cheats are off', 'Options > Co-op > Co-op settings > Cheats', '#ffaa44', 120);
            return;
        }
        if (Net.role !== 'host') {
            banner(save ? 'Only the host saves' : 'Only the host loads', 'F6 / F7 work on the host\'s PC', '#ffaa44', 120);
            return;
        }
        if (battles.length) {
            SoundManager.playBuzzer();
            banner(fightersText() + ' fighting', 'No saving until the battle ends', '#ffaa44', 120);
            return;
        }
        if (!(SceneManager._scene instanceof Scene_Map) || $gameMap.isEventRunning() || subs[1]) {
            SoundManager.playBuzzer();
            return;
        }
        if (!save && shift && !DataManager.isThisGameFile(QUICK_SLOT)) {
            SoundManager.playBuzzer();
            banner('No quick save yet', 'Press Shift+F6 first', '#ffaa44', 120);
            return;
        }
        Net.pendingEvents.push({ k: 'qs', save: !!save, shift: !!shift });
    }

    function applyQuickSave(ev) {
        const map = SceneManager._scene;
        if (!(map instanceof Scene_Map) || battles.length || $gameMap.isEventRunning() || subs[1]) return;
        if (ev.save && ev.shift) {
            $gameSystem.onBeforeSave();
            const ok = DataManager.saveGame(QUICK_SLOT);
            if (Net.role === 'host') banner(ok ? 'Quick save' : 'Quick save failed', 'Slot ' + QUICK_SLOT, ok ? COLOR_NET : '#ffaa44', 120);
        } else if (ev.save) {
            openSub(map, 1, () => SceneManager.push(Scene_Save));
        } else {
            if (Net.role === 'host') Net.loadAfterTitle = ev.shift ? QUICK_SLOT : 'screen';
            else banner('The host is loading a save', 'The game comes back by itself', COLOR_NET, 300);
            SceneManager.goto(Scene_Title);
        }
    }

    // sucesos que viajan con el cuadro, para que pasen a la vez en todos los PC
    function applyEvents(list) {
        (list || []).forEach(ev => {
            if (ev.k === 'qs') applyQuickSave(ev);
            if (ev.k === 'away') {
                // se va el PC que lleva al protagonista (P1): lo lleva el anfitrion desde ahora
                if (slotOf(ev.n) === 1 && ev.n !== 1) {
                    const hostSlot = slotOf(1);
                    swapSeats(1, hostSlot);
                    banner('P1 left', 'The host plays the protagonist now', '#ffaa44', 240);
                }
                ev = Object.assign({}, ev, { n: slotOf(ev.n) });
                closeSub(ev.n);
                // en un combate su personaje lo lleva hasta el final otro jugador de ese combate:
                // el anfitrion, o en un combate aparte el siguiente que lucha en el (si no queda nadie, la IA)
                const fb = battleOf(ev.n);
                const others = fb ? fb.involved.filter(m => m !== ev.n && !Net.left[m]) : [1];
                const takeover = others[0] || 0;
                coop.setAway(ev.n, true, takeover);
                Net.left[ev.n] = true;
                banner('P' + ev.n + ' disconnected', takeover ? 'P' + takeover + ' plays their character until the battle ends' :
                    'Their character follows the party until they come back', '#ffaa44', 240);
            }
        });
    }

    // cada PC mira a su jugador; si no tiene personaje (murio, espera a alguien...), a P1
    let cameraHadChar = true;
    function followOwnCamera() {
        if (!Net.active || !Net.player || Net.player === 1 || !(SceneManager._scene instanceof Scene_Map)) return;
        // (mientras carga el mapa no hay datos del mapa: centrar la camara fallaria)
        if (!SceneManager._sceneStarted || SceneManager._nextScene || !$dataMap || !$gameMap.mapId()) return;
        const has = !!coop.player(Net.player);
        if (has === cameraHadChar) return;
        cameraHadChar = has;
        coop.setCamera(has ? 'p' + Net.player : 'p1');
        if (!has) {
            try {
                $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
            } catch (e) {
                logError('camera on P1', e);
            }
        }
    }

    // quien se fue vuelve a ser un seguidor normal en cuanto se esta en el mapa
    function processLeft() {
        Object.keys(Net.left).map(Number).forEach(n => {
            if (inSeparateBattle(n)) return; // su personaje acaba el combate con la IA
            if (!coop.player(n)) delete Net.left[n];
            else if (SceneManager._sceneStarted && !SceneManager._nextScene && coop.removePlayer(n)) {
                delete Net.left[n];
                Net.applied = {}; // al quitarlo se limpia Input: las teclas que siguen pulsadas se vuelven a aplicar
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
            if (e.actor && $gameParty._actors.indexOf(e.actor) >= 0) p._coopActorId = e.actor;
            p.locate(e.x, e.y);
            p.setDirection(e.d);
        });
        $gamePlayer.refresh();
        pend.away.forEach(n => { if (pend.back.indexOf(n) < 0) coop.setAway(n, true); });
    }

    // momento tranquilo para una instantanea: en el mapa, sin eventos ni dialogos
    function isSafePoint() {
        return SceneManager._scene instanceof Scene_Map && SceneManager._sceneStarted && !SceneManager._nextScene &&
            !$gameMap.isEventRunning() && !$gameMessage.isBusy() && !$gamePlayer.isTransferring() && !Net.pendingExtras &&
            Object.keys(subs).length === 0 && Object.keys(Net.left).length === 0 && battles.length === 0 && pendingRoots.length === 0;
    }

    // Cuantos cuadros por delante manda este PC sus teclas. Tienen que llegar antes de que
    // se necesiten: un invitado, ida y vuelta al anfitrion; el anfitrion, ida hasta el invitado
    // mas lejano. Cada PC decide la suya y la puede cambiar cuando quiera: lo que vale es el
    // cuadro que reparte el anfitrion, asi que no hace falta ponerse de acuerdo.
    function worstPing(list) {
        return list.length ? Math.max.apply(null, list) : 0;
    }

    function targetDelay() {
        if (Net.config.delay !== 'auto') return Net.config.delay;
        let ms;
        if (Net.role === 'host') {
            ms = Math.max.apply(null, [0].concat(Net.peers.filter(pp => pp.inSession).map(pp => worstPing(pp.pings)))) / 2;
        } else {
            ms = worstPing(Net.pings);
        }
        const frames = Math.ceil(ms / STEP_MS) + 2;
        return Math.max(AUTO_MIN_DELAY, Math.min(MAX_DELAY, frames));
    }

    // manda las teclas de este cuadro; si la espera sube, rellena los cuadros de en medio con
    // las mismas teclas (si no, el anfitrion se quedaria esperandolos); si baja, de uno en uno
    function sendLocalInput() {
        const bits = localBits();
        const target = targetDelay();
        if (target > Net.delay) {
            for (let d = Net.delay; d <= target; d++) sendInput(Net.frame + d, bits);
            Net.delay = target;
            return;
        }
        if (target < Net.delay && Net.frame % 30 === 0) Net.delay--;
        sendInput(Net.frame + Net.delay, bits);
    }

    // un cuadro de juego con las acciones de todos
    function netStep(pkt) {
        sendLocalInput();
        Net.allReady = pkt.rs;
        if (pkt.br !== undefined) Net.battleReadyAll = pkt.br;
        Graphics.frameCount = Net.frameBase + Net.frame;
        window.Date = NetDate;
        try {
            applyEvents(pkt.ev);
            applyActions(pkt.a);
            SceneManager.updateInputData();
            SceneManager.changeScene();
            SceneManager.updateScene();
            applyPendingExtras();
            processLeft();
            followOwnCamera();
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
        if (Net.startRequested) {
            Net.startRequested = false;
            hostStartSession();
        }
        updateLobby();
        if (Net.stopRequested) {
            Net.stopRequested = false;
            stopNetworking();
        }
        if (!Net.active) {
            _SceneManager_updateMain.call(this);
            return;
        }
        if (Net.role === 'host') hostBuildFrames();
        // 60 cuadros de juego por segundo segun el reloj (no segun el monitor). Los cuadros que
        // llegan antes de tiempo esperan: son el margen de Net.delay. Si este PC se ha quedado
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
        // (muy atras - estuvo parado: minimizado, cargando... -: recupera varios por cuadro de dibujo)
        for (let extra = 0; Net.active && extra < 8 && framesWaiting() > Net.delay + 2; extra++) runFrame();
        this.renderScene();
        this.requestUpdate();
    };

    // cada escena nueva solo empieza cuando todos la tienen cargada
    const _SceneManager_goto = SceneManager.goto;
    SceneManager.goto = function(sceneClass) {
        if (Net.active && !inSub && sceneClass) {
            if (closesMenus(sceneClass)) closeAllSubs();
            Net.sceneSeq++;
        }
        _SceneManager_goto.call(this, sceneClass);
        // De vuelta al titulo (fin de la partida, o Salir): la partida en red termina en todos a
        // la vez. Seguir en red ahi no sirve: si el anfitrion cargara una partida, cada PC cargaria
        // su propio archivo. Las conexiones siguen: el anfitrion carga y vuelve a empezar.
        if (Net.active && !inSub && sceneClass === Scene_Title) {
            endSession(Net.role === 'host' ? 'Load a save, then Options > Co-op > Network game > Start' : 'Wait for the host to start again');
        }
    };

    const _SceneManager_updateScene = SceneManager.updateScene;
    SceneManager.updateScene = function() {
        if (Net.active && this._scene && !this._sceneStarted) {
            const scene = this._scene;
            if (scene instanceof Scene_Map && !scene._mapLoaded) {
                if (Net.allReady >= Net.sceneSeq * 2 + 1) scene.isReady(); // todos lo han leido: se prepara
                return;
            }
            if (Net.allReady < Net.sceneSeq * 2 + 2) return;
        }
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

    // YEP_BattleEngineCore ordena los enemigos a elegir por donde esta su dibujo; el dibujo puede
    // no estar igual en cada PC (en un combate aparte solo se dibuja en el PC de quien lucha) y
    // con otro orden la misma tecla elegia otro enemigo. En red: por su sitio en el combate.
    if (Window_BattleEnemy.prototype.sortTargets) {
        const _Window_BattleEnemy_sortTargets = Window_BattleEnemy.prototype.sortTargets;
        Window_BattleEnemy.prototype.sortTargets = function() {
            if (!Net.active) return _Window_BattleEnemy_sortTargets.call(this);
            this._enemies.sort((a, b) => (a.screenX() - b.screenX()) || (a.screenY() - b.screenY()) || (a.index() - b.index()));
        };
    }

    const _Window_Message_updateLoading = Window_Message.prototype.updateLoading;
    Window_Message.prototype.updateLoading = function() {
        if (Net.active) return false;
        return _Window_Message_updateLoading.call(this);
    };

    // Los menus siguen parando el juego para todos (como en el co-op local), pero solo los ve
    // quien los abrio; en los demas PC se ve el mapa con un aviso. Es solo dibujo: no cambia nada.
    const _Scene_MenuBase_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function() {
        _Scene_MenuBase_update.call(this);
        if (!this._windowLayer) return;
        const owner = coop.menuOwner();
        const hide = Net.active && owner > 0 && owner !== Net.player;
        this._windowLayer.visible = !hide;
        if (hide && this._netMenuOwner !== owner) {
            this._netMenuOwner = owner;
            if (!this._netMenuNote) {
                this._netMenuNote = new Sprite(new Bitmap(Graphics.width, 64));
                this._netMenuNote.y = Math.floor(Graphics.height / 2 - 32);
                this.addChild(this._netMenuNote);
            }
            const bmp = this._netMenuNote.bitmap;
            bmp.clear();
            bmp.fontSize = 26;
            bmp.fillRect(0, 0, Graphics.width, 64, 'rgba(0, 0, 0, 0.6)');
            bmp.drawText(coop.tr('P' + owner + ' is in their menu...'), 0, 0, Graphics.width, 64, 'center');
        }
        if (this._netMenuNote) this._netMenuNote.visible = hide;
    };

    // El raton (y la pantalla tactil) no van por la red: en la partida en red no llegan al juego
    // (si no, elegir con el raton una parte del cuerpo en un combate solo pasaba en ese PC)
    ['mousedown', 'mousemove', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
        window.addEventListener(type, e => { if (Net.active) e.stopPropagation(); }, true);
    });

    // el raton de un PC no debe mover a nadie en los demas
    const _TouchInput_update = TouchInput.update;
    TouchInput.update = function() {
        _TouchInput_update.call(this);
        if (Net.active) {
            this.clear();
            // YEP_BattleEngineCore elige el objetivo con el raton encima (guarda la ultima posicion
            // del raton): fuera de la pantalla, o el raton quieto sobre un enemigo lo elegia solo en ese PC
            this._mouseOverX = this._mouseOverY = -10000;
        }
    };

    // ---- menus que no paran el juego ---------------------------------------------------
    // El menu de cada jugador es una escena aparte que se actualiza dentro del mapa, en todos
    // los PC igual (lo que se haga en el cambia el mundo). Mientras se actualiza, para el
    // juego es "la escena actual": SceneManager._scene, su pila de escenas, el dueno del
    // menu, el personaje del menu y las teclas (Input) son los de ese jugador. Solo el PC
    // de ese jugador lo dibuja (como un menu normal, con la foto del mapa de fondo).

    const subs = {};        // jugador -> { scene, stack, menuActor, targetActor, input }
    let inSub = false;
    const INPUT_FIELDS = ['_currentState', '_previousState', '_latestButton', '_pressedTime', '_dir4', '_dir8', '_preferredAxis', '_date'];

    function stateOf(bits) {
        const st = {};
        ACTIONS.forEach((a, i) => { st[a] = !!((bits >> i) & 1); });
        return st;
    }

    function newVirtualInput(bits) {
        const st = stateOf(bits); // lo que ya estaba pulsado al abrir no cuenta como pulsacion nueva
        return { _currentState: st, _previousState: Object.assign({}, st), _latestButton: null, _pressedTime: 0,
            _dir4: 0, _dir8: 0, _preferredAxis: '', _date: 0 };
    }

    // como Input.update, pero con las acciones de un jugador (sin teclado ni mandos)
    function updateVirtualInput(bits) {
        Input._currentState = stateOf(bits);
        stepInput();
    }

    // un paso de Input.update sin leer teclado ni mandos (y sin el Input.clear del co-op local
    // al cambiar de dueno: borraria la pulsacion y contaria otra vez en el cuadro siguiente)
    function stepInput() {
        const cur = Input._currentState;
        if (Input._latestButton && cur[Input._latestButton]) {
            Input._pressedTime++;
        } else {
            Input._latestButton = null;
        }
        Object.keys(cur).forEach(name => {
            if (cur[name] && !Input._previousState[name]) {
                Input._latestButton = name;
                Input._pressedTime = 0;
                Input._date = Date.now();
            }
        });
        Input._previousState = Object.assign({}, cur);
        Input._updateDirection();
    }

    // ejecuta fn como si el menu del jugador n fuera la escena actual; devuelve la escena
    // a la que el menu quiere pasar (o null)
    function withSub(n, sub, fn) {
        const sm = SceneManager;
        const saved = {
            scene: sm._scene, stack: sm._stack, next: sm._nextScene, owner: coop.menuOwner(),
            menuActor: $gameParty._menuActorId, targetActor: $gameParty._targetActorId, input: {}
        };
        INPUT_FIELDS.forEach(f => {
            saved.input[f] = Input[f];
            Input[f] = sub.input[f];
        });
        sm._scene = sub.scene;
        sm._stack = sub.stack;
        sm._nextScene = null;
        coop.setMenuOwner(n);
        $gameParty._menuActorId = sub.menuActor;
        $gameParty._targetActorId = sub.targetActor;
        inSub = true;
        let next = null;
        try {
            fn();
        } finally {
            inSub = false;
            next = sm._nextScene;
            sub.stack = sm._stack;
            sub.menuActor = $gameParty._menuActorId;
            sub.targetActor = $gameParty._targetActorId;
            INPUT_FIELDS.forEach(f => {
                sub.input[f] = Input[f];
                Input[f] = saved.input[f];
            });
            sm._scene = saved.scene;
            sm._stack = saved.stack;
            sm._nextScene = saved.next;
            coop.setMenuOwner(saved.owner);
            $gameParty._menuActorId = saved.menuActor;
            $gameParty._targetActorId = saved.targetActor;
        }
        return next;
    }

    function closeSub(n) {
        const sub = subs[n];
        if (!sub) return;
        delete subs[n];
        Net.mask[n] = Net.raw[n] || 0;
        try {
            withSub(n, sub, () => sub.scene.terminate());
        } catch (e) {
            logError('closing the menu of P' + n, e);
        }
    }

    function closeAllSubs() {
        Object.keys(subs).map(Number).forEach(closeSub);
    }

    // el menu pasa a otra escena (Objetos, Equipo...) o vuelve al mapa
    function changeSub(n, next) {
        for (let guard = 0; next && guard < 5; guard++) {
            const sub = subs[n];
            if (!sub) return;
            if (next instanceof Scene_Map) {
                closeSub(n);
                return;
            }
            if (!(next instanceof Scene_MenuBase)) {
                // sale del menu a otra cosa (p.ej. fin de partida): se cierra y esa escena va para todos
                closeSub(n);
                Net.sceneSeq++;
                SceneManager._nextScene = next;
                return;
            }
            next = withSub(n, sub, () => {
                sub.scene.terminate();
                sub.scene = next;
                SceneManager._scene = next;
                next.create();
                next.start();
            });
            // en la escena nueva, lo que sigue pulsado no es una pulsacion nueva (al cambiar de
            // escena el juego limpia Input, y Cancelar cerraria tambien el menu de detras)
            sub.input = newVirtualInput(Net.raw[n] || 0);
        }
    }

    function openSub(map, n, callOriginal) {
        // el menu que abriria el juego (con plugins de menu incluidos), sin salir del mapa
        const sm = SceneManager;
        const savedStack = sm._stack;
        const savedNext = sm._nextScene;
        sm._stack = [];
        sm._nextScene = null;
        map.stop = function() {}; // el mapa sigue activo
        inSub = true;
        let next = null;
        let stack = null;
        try {
            callOriginal();
        } finally {
            inSub = false;
            delete map.stop;
            next = sm._nextScene;
            stack = sm._stack;
            sm._stack = savedStack;
            sm._nextScene = savedNext;
        }
        const owner = coop.menuOwner() || n;
        coop.setMenuOwner(0);
        map.menuCalling = false;
        if (!next || subs[owner]) return;
        // la foto del mapa para el fondo del menu (solo dibujo: solo en el PC de quien lo abre)
        if (owner === Net.player) SceneManager.snapForBackground();
        // cada menu empieza en el personaje de su jugador (P1: el lider), no en el ultimo de otro
        const own = owner === 1 ? $gameParty.leader() : (coop.player(owner) && coop.player(owner).actor());
        const sub = { scene: next, stack: stack, menuActor: own ? own.actorId() : $gameParty._menuActorId, targetActor: $gameParty._targetActorId,
            input: newVirtualInput(Net.raw[owner] || 0) };
        subs[owner] = sub;
        const again = withSub(owner, sub, () => {
            next.create();
            next.start();
        });
        if (again) changeSub(owner, again);
    }

    function updateSubs() {
        Object.keys(subs).map(Number).sort().forEach(n => {
            const sub = subs[n];
            if (!sub) return;
            let next = null;
            try {
                next = withSub(n, sub, () => {
                    updateVirtualInput(Net.raw[n] || 0);
                    sub.scene.update();
                });
            } catch (e) {
                logError('menu of P' + n, e);
                closeSub(n);
                return;
            }
            if (next) changeSub(n, next);
        });
    }

    // las ventanas llaman a Input.update al aceptar (para "gastar" la pulsacion)
    const _Input_update = Input.update;
    Input.update = function() {
        if (inSub) {
            stepInput();
            return;
        }
        _Input_update.call(this);
    };

    const _Scene_Map_callMenu = Scene_Map.prototype.callMenu;
    Scene_Map.prototype.callMenu = function() {
        if (!Net.active || inSub) {
            _Scene_Map_callMenu.call(this);
            return;
        }
        openSub(this, coop.menuOwner() || 1, () => _Scene_Map_callMenu.call(this));
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        if (Net.active && !inSub) {
            updateBattles();
            updateSubs();
        } else if (!Net.active) {
            removeLeftovers();
        }
        _Scene_Map_update.call(this);
    };

    // Con un combate aparte en marcha, el fin de la partida lo decide ese combate al perderlo (y va
    // para todos). Si no, el mapa pasaba solo a "fin" (todos muertos) y el combate se quedaba
    // dibujado a medias en la pantalla: parecia colgado.
    const _Scene_Map_checkGameover = Scene_Map.prototype.checkGameover;
    Scene_Map.prototype.checkGameover = function() {
        if (Net.active && !inSub && battles.length > 0) return;
        _Scene_Map_checkGameover.call(this);
    };

    // en un combate (o fin de partida) los menus se cierran
    function closesMenus(sceneClass) {
        return sceneClass === Scene_Battle || sceneClass === Scene_Gameover || sceneClass === Scene_Title;
    }

    // el personaje de quien esta en su menu no se mueve ni interactua
    coop.setBusy(n => Net.active && (!!subs[n] || inSeparateBattle(n)));
    coop.setHidden(n => Net.active && inSeparateBattle(n));

    // Cargar partida y Salir no sirven en la partida en red (cada PC tiene sus archivos)
    const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function() {
        _Window_MenuCommand_makeCommandList.call(this);
        if (Net.active) this._list = this._list.filter(cmd => cmd.symbol !== 'load' && cmd.symbol !== 'gameEnd');
    };

    // dibujo: el PC del jugador con menu ve su menu como siempre (con la foto del mapa de fondo);
    // el juego sigue igual por detras
    const _SceneManager_renderScene = SceneManager.renderScene;
    SceneManager.renderScene = function() {
        // (fin de partida o titulo: ya no hay combates aparte que ver)
        if (Net.active && battles.length > 0 && (this._scene instanceof Scene_Gameover || this._scene instanceof Scene_Title)) closeAllBattles();
        // quien lucha ve su combate (tambien mientras los demas cargan otro mapa: sin "Loading")
        const mine = Net.active ? battleOf(Net.player) : null;
        if (mine && mine.started) {
            Graphics.render(mine.scene);
            return;
        }
        const sub = Net.active && subs[Net.player];
        const watch = sub ? null : watchedBattle();
        updateWatchAudio(watch);
        if (watch) {
            Graphics.render(watch.scene);
            return;
        }
        if (!sub || !(this._scene instanceof Scene_Map) || !this._sceneStarted) {
            _SceneManager_renderScene.call(this);
            return;
        }
        Graphics.render(sub.scene);
    };

    // (solo el sonido de este PC: al empezar a mirar suena el combate; al dejarlo, el mapa)
    let watching = null;
    function updateWatchAudio(watch) {
        if (watch === watching) return;
        const prev = watching;
        watching = watch;
        if (watch) {
            const mapBgm = AudioManager.saveBgm();
            const mapBgs = AudioManager.saveBgs();
            watch._watchMapAudio = [mapBgm, mapBgs];
            AudioManager.stopBgs();
            AudioManager.playBgm(watch._bgm || $gameSystem.battleBgm());
            banner('Watching P' + watch.involved[0] + "'s battle", 'You have no character now', '#9fb6ff', 150);
        } else if (prev && battles.indexOf(prev) >= 0 && prev._watchMapAudio) {
            // (sigue el combate pero ya no se mira: vuelve la musica del mapa)
            AudioManager.playBgm(prev._watchMapAudio[0]);
            AudioManager.playBgs(prev._watchMapAudio[1]);
        }
    }

    // ---- combates aparte ------------------------------------------------------------------
    // Con "Battles: Separate", un combate que empieza un jugador (un enemigo le toca, o habla
    // con el) es solo suyo: lo luchan su personaje y los companeros que maneja; los demas
    // siguen en el mapa. Como los menus, el combate es una escena aparte que se actualiza en
    // todos los PC (cambia el mundo) y solo la ven los que luchan. Tiene sus propios mensajes,
    // pantalla (destellos, imagenes) y eventos comunes pendientes, para no mezclarse con el
    // mapa. Mientras dura:
    //  - el evento que lo empezo espera, pero el mapa no se para (los demas andan);
    //  - los eventos que los demas activen esperan a que termine (no hay dos dialogos a la vez);
    //  - los enemigos no ven a los que luchan;
    //  - otro jugador se une si un enemigo le toca o si pulsa OK al lado de uno que lucha
    //    (entra al empezar el siguiente turno);
    //  - un combate que empieza sin jugador (escena, evento comun) es para todos, como siempre.

    // Puede haber varios a la vez (cada uno con su enemigo): P2 lucha con uno y P1 con otro.
    // Cada combate lleva su propio estado del juego para el combate: su tropa ($gameTroop) y el
    // de BattleManager; se ponen mientras se actualiza ese combate. El evento del mapa que lo
    // empezo se aparta (el mapa queda libre para los demas) y sigue cuando termina el combate.
    let battles = [];       // [{ scene, stack, involved, inputs, started, seq, screen, message, temp, inBattle, interp, joins, troop, bm, root }]
    let battle = null;      // el combate que se esta actualizando (o null)
    let inBattleCtx = false;
    let pendingRoots = [];  // eventos del mapa que empezaron un combate ya terminado: siguen cuando el mapa esta libre

    function battleOf(n) {
        return battles.find(b => b.involved.indexOf(n) >= 0) || null;
    }

    // el estado de BattleManager (sus datos, no sus funciones)
    function bmState() {
        const o = {};
        Object.keys(BattleManager).forEach(k => { if (typeof BattleManager[k] !== 'function') o[k] = BattleManager[k]; });
        return o;
    }

    // Los combates del juego guardan su estado en interruptores y variables comunes ("SKILLS_BATTLE",
    // "battle_phase1", "Beartrap_set"...: las paginas de la tropa saltan con ellos, "AFTER BATTLE" los
    // apaga). Con dos combates a la vez se pisaban: lo que activaba un combate lo veia el otro (y
    // acababa: "Abortar combate", partes del enemigo muertas...). Cada combate ve lo que el mismo
    // cambio; lo que cambio OTRO combate en marcha lo ve como estaba antes. El mapa ve lo ultimo
    // (y al terminar, lo que dejo cada combate se queda).
    const scopeOwner = { sw: {}, vars: {} };  // id -> combate que lo cambio (mientras dura)
    const scopeBase = { sw: {}, vars: {} };   // id -> valor antes de que lo cambiara un combate
    function scoped(kind, proto) {
        const _value = proto.value;
        const _setValue = proto.setValue;
        proto.value = function(id) {
            const b = inBattleCtx ? battle : null;
            if (!b || !b.scope || (this !== $gameSwitches && this !== $gameVariables)) return _value.call(this, id);
            const own = b.scope[kind];
            if (Object.prototype.hasOwnProperty.call(own, id)) return own[id];
            const o = scopeOwner[kind][id];
            if (o && o !== b && battles.indexOf(o) >= 0) return scopeBase[kind][id];
            return _value.call(this, id);
        };
        proto.setValue = function(id, value) {
            const b = inBattleCtx ? battle : null;
            if (b && b.scope && (this === $gameSwitches || this === $gameVariables)) {
                if (!scopeOwner[kind][id] || battles.indexOf(scopeOwner[kind][id]) < 0) scopeBase[kind][id] = _value.call(this, id);
                scopeOwner[kind][id] = b;
                _setValue.call(this, id, value);
                b.scope[kind][id] = _value.call(this, id); // (como lo guarda el juego: true/false, numero...)
                return;
            }
            _setValue.call(this, id, value);
        };
    }
    scoped('sw', Game_Switches.prototype);
    scoped('vars', Game_Variables.prototype);

    // al terminar un combate, lo que cambio ya es lo de todos
    function releaseScope(b) {
        ['sw', 'vars'].forEach(kind => Object.keys(scopeOwner[kind]).forEach(id => {
            if (scopeOwner[kind][id] === b) {
                delete scopeOwner[kind][id];
                delete scopeBase[kind][id];
            }
        }));
    }

    function setBmState(o) {
        Object.keys(BattleManager).forEach(k => { if (typeof BattleManager[k] !== 'function' && !(k in o)) delete BattleManager[k]; });
        Object.assign(BattleManager, o);
    }
    const AUDIO_CALLS = ['playBgm', 'playBgs', 'playMe', 'playSe', 'playStaticSe', 'replayBgm', 'replayBgs', 'fadeOutBgm',
        'fadeOutBgs', 'fadeOutMe', 'fadeInBgm', 'fadeInBgs', 'stopBgm', 'stopBgs', 'stopMe', 'stopSe', 'stopAll'];

    // registro corto de los combates aparte (para saber que paso si algo no va)
    // (se escribe cada 2 s y sin parar el juego: escribir en disco a cada tecla del combate
    // hacia esperar al juego; y no pasa de ~1 MB)
    let battleLogLines = [];
    function battleLog(msg) {
        battleLogLines.push(new NativeDate().toISOString() + '  frame ' + Net.frame + '  ' + msg);
    }

    setInterval(() => {
        if (battleLogLines.length === 0) return;
        const text = battleLogLines.join('\n') + '\n';
        battleLogLines = [];
        const file = path.join(baseDir, 'coop_net_battle.log');
        try {
            fs.stat(file, (err, st) => {
                const write = () => fs.appendFile(file, text, () => {});
                if (!err && st && st.size > 1024 * 1024) fs.rename(file, file + '.old', write);
                else write();
            });
        } catch (e) {
            // nada
        }
    }, 2000);

    function inSeparateBattle(n) {
        return !!battleOf(n);
    }

    // quien no tiene personaje (muerto, esperando) mira un combate en marcha: el de P1 si lo hay
    // (y la pelea de la puerta de la torre la miran todos los que no luchan)
    function watchedBattle() {
        if (!Net.active || battleOf(Net.player)) return null;
        const story = battles.find(b => b.started && b.troop && b.troop._coopPvp && b.troop._coopPvp.story);
        if (story) return story;
        // (con personaje vivo no mira: el suyo muerto cuenta como sin personaje)
        const own = Net.player === 1 ? $gameParty.leader() : (coop.player(Net.player) ? coop.player(Net.player).actor() : null);
        if (Net.player === 1 || (own && own.isAlive())) return null;
        return battles.find(b => b.started && b.involved.indexOf(1) >= 0) || battles.find(b => b.started) || null;
    }

    // de quien son las teclas en el combate (si es de alguien que no lucha o que se fue, del primero
    // que sigue luchando: el que empezo el combate puede haberse desconectado)
    function battleInputOwner() {
        const n = coop.inputOwner();
        const here = battle.involved.filter(m => !Net.left[m]);
        if (here.indexOf(n) >= 0) return n;
        return here.length ? here[0] : battle.involved[0];
    }

    // se fueron todos los de este combate: lo acaba la IA y los mensajes pasan solos
    function battleAbandoned() {
        return !!battle && battle.involved.every(m => Net.left[m]);
    }

    const _Window_Message_isTriggered = Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered = function() {
        if (inBattleCtx && battleAbandoned()) {
            battle.autoOk = (battle.autoOk || 0) + 1;
            if (battle.autoOk % 30 === 0) return true; // (cuenta en el combate: igual en todos los PC)
        }
        return _Window_Message_isTriggered.call(this);
    };

    // ejecuta fn como si el combate fuera la escena actual (ver withSub)
    function withBattle(b, fn) {
        const sm = SceneManager;
        const saved = {
            scene: sm._scene, stack: sm._stack, next: sm._nextScene, message: $gameMessage, screen: $gameScreen,
            temp: $gameTemp, inBattle: $gameParty._inBattle, owner: coop.menuOwner(), timer: $gameTimer.update, input: {}, audio: {},
            battle: battle, troop: $gameTroop, bm: bmState()
        };
        battle = b;
        $gameTroop = b.troop;
        setBmState(b.bm);
        sm._scene = b.scene;
        sm._stack = b.stack;
        sm._nextScene = null;
        $gameMessage = b.message;
        $gameScreen = b.screen;
        $gameTemp = b.temp;
        $gameParty._inBattle = b.inBattle;
        coop.setMenuOwner(0);
        $gameTimer.update = function() {}; // el mapa ya lo avanza
        // el sonido del combate solo en los PC de los que luchan (es solo sonido)
        const muted = b.involved.indexOf(Net.player) < 0 && watchedBattle() !== b;
        if (!muted) {
            const play = saved.audio.playBgm = AudioManager.playBgm;
            AudioManager.playBgm = function(bgm) {
                if (bgm && bgm.name) b._bgm = bgm;
                return play.apply(this, arguments);
            };
        }
        if (muted) {
            AUDIO_CALLS.forEach(name => {
                saved.audio[name] = AudioManager[name];
                AudioManager[name] = function() {};
            });
            // (la musica que pone el combate: para quien empiece a mirarlo)
            AudioManager.playBgm = function(bgm) { if (bgm && bgm.name) b._bgm = bgm; };
        }
        inSub = true;
        inBattleCtx = true;
        const owner = battleInputOwner();
        const vin = b.inputs[owner] || (b.inputs[owner] = newVirtualInput(Net.raw[owner] || 0));
        INPUT_FIELDS.forEach(f => {
            saved.input[f] = Input[f];
            Input[f] = vin[f];
        });
        let next = null;
        try {
            fn();
        } finally {
            INPUT_FIELDS.forEach(f => {
                vin[f] = Input[f];
                Input[f] = saved.input[f];
            });
            inSub = false;
            inBattleCtx = false;
            next = sm._nextScene;
            b.stack = sm._stack;
            b.inBattle = $gameParty._inBattle;
            sm._scene = saved.scene;
            sm._stack = saved.stack;
            sm._nextScene = saved.next;
            $gameMessage = saved.message;
            $gameScreen = saved.screen;
            $gameTemp = saved.temp;
            $gameParty._inBattle = saved.inBattle;
            coop.setMenuOwner(saved.owner);
            $gameTimer.update = saved.timer;
            if (muted) AUDIO_CALLS.forEach(name => { AudioManager[name] = saved.audio[name]; });
            else AudioManager.playBgm = saved.audio.playBgm;
            b.troop = $gameTroop;
            b.bm = bmState();
            $gameTroop = saved.troop;
            setBmState(saved.bm);
            battle = saved.battle;
        }
        return next;
    }

    const _Game_CommonEvent_isActive = Game_CommonEvent.prototype.isActive;
    Game_CommonEvent.prototype.isActive = function() {
        if (battles.length && Net.active) {
            const ev = this.event();
            if (ev && /^deathCheck$/i.test(ev.name)) return false;
        }
        return _Game_CommonEvent_isActive.call(this);
    };

    // en el combate aparte solo luchan los personajes de los que estan en el
    const _Game_Party_battleMembers = Game_Party.prototype.battleMembers;
    Game_Party.prototype.battleMembers = function() {
        const list = _Game_Party_battleMembers.call(this);
        if (!inBattleCtx || !battle) return list;
        const mine = list.filter(a => battle.involved.indexOf(coop.battleOwnerOf(a)) >= 0);
        return mine.length > 0 || battle.started ? mine : list;
    };

    // Al empezar y al acabar un combate el juego prepara / limpia a todo el grupo (acciones, estados
    // de combate...): lo hace cuando aun no / ya no cuenta como "en combate", asi que tocaba a todos
    // los personajes del grupo, tambien a los que luchan en OTRO combate aparte (se quedaban sin
    // accion y su combate fallaba al atacar). En un combate aparte: solo a los suyos.
    function onlyFighters(fn) {
        return function() {
            if (!(inBattleCtx && battle)) return fn.apply(this, arguments);
            const mine = this.battleMembers();
            this.allMembers = function() { return mine.slice(); };
            try {
                return fn.apply(this, arguments);
            } finally {
                delete this.allMembers;
            }
        };
    }
    Game_Party.prototype.onBattleStart = onlyFighters(Game_Party.prototype.onBattleStart);
    Game_Party.prototype.onBattleEnd = onlyFighters(Game_Party.prototype.onBattleEnd);

    // la pagina lleva "Procesar combate" (o llama a un evento comun que lo lleva: asi lo hacen
    // los enemigos de Termina)
    function listStartsBattle(list, depth) {
        if (!list || depth > 3) return false;
        return list.some(c => {
            if (!c) return false;
            if (c.code === 301) return true;
            if (c.code === 117) {
                const ce = $dataCommonEvents[c.parameters[0]];
                return !!ce && listStartsBattle(ce.list, depth + 1);
            }
            return false;
        });
    }

    // la pagina lleva a otro sitio o guarda (o llama a un evento comun que lo hace): puertas,
    // camas (dormir), guardar
    function listLeavesPlace(list, depth) {
        if (!list || depth > 3) return false;
        return list.some(c => {
            if (!c) return false;
            if (c.code === 201 || c.code === 352) return true;
            if (c.code === 117) {
                const ce = $dataCommonEvents[c.parameters[0]];
                return !!ce && listLeavesPlace(ce.list, depth + 1);
            }
            return false;
        });
    }

    function fightersText() {
        const all = [];
        battles.forEach(b => b.involved.forEach(n => { if (all.indexOf(n) < 0) all.push(n); }));
        return all.length ? 'P' + all.join(', P') + (all.length > 1 ? ' are' : ' is') : 'Someone is';
    }

    let refusedAt = -999;
    function refuseLeaving() {
        if (Net.frame - refusedAt > 90) {
            banner(fightersText() + ' fighting here', 'Nobody leaves, sleeps or saves until the battle ends', '#ffaa44', 150);
            SoundManager.playBuzzer();
        }
        refusedAt = Net.frame;
    }

    // y si un evento ya en marcha (o un objeto) quiere trasladar o guardar: tampoco
    const _Game_Interpreter_command201 = Game_Interpreter.prototype.command201;
    Game_Interpreter.prototype.command201 = function() {
        if (Net.active && battles.length && !inBattleCtx && this._coopStarter && !inSeparateBattle(this._coopStarter) && !$gameParty.inBattle()) {
            refuseLeaving();
            return true;
        }
        return _Game_Interpreter_command201.call(this);
    };

    const _Game_Interpreter_command352 = Game_Interpreter.prototype.command352;
    Game_Interpreter.prototype.command352 = function() {
        if (Net.active && battles.length && !inBattleCtx) {
            refuseLeaving();
            return true;
        }
        return _Game_Interpreter_command352.call(this);
    };

    const _Window_MenuCommand_isSaveEnabled = Window_MenuCommand.prototype.isSaveEnabled;
    Window_MenuCommand.prototype.isSaveEnabled = function() {
        if (Net.active && battles.length) return false;
        return _Window_MenuCommand_isSaveEnabled.call(this);
    };

    function pageStartsBattle(ev) {
        return listStartsBattle(ev.list ? ev.list() : null, 0);
    }

    // los que luchan tienen las teclas del combate (cada uno las suyas, se usan las del que elige)
    function stepBattleInputs() {
        battle.involved.forEach(n => {
            const vin = battle.inputs[n] || (battle.inputs[n] = newVirtualInput(Net.raw[n] || 0));
            const saved = {};
            INPUT_FIELDS.forEach(f => {
                saved[f] = Input[f];
                Input[f] = vin[f];
            });
            updateVirtualInput(Net.raw[n] || 0);
            INPUT_FIELDS.forEach(f => {
                vin[f] = Input[f];
                Input[f] = saved[f];
            });
        });
    }

    function battleStartAudio(b) {
        // como Scene_Map.launchBattle, solo el sonido (la musica del mapa la guarda ese combate)
        const bm = inBattleCtx ? BattleManager : b.bm;
        bm._mapBgm = AudioManager.saveBgm();
        bm._mapBgs = AudioManager.saveBgs();
        AudioManager.stopBgs();
        AudioManager.stopMe();
        SoundManager.playBattleStart();
    }

    function queueJoin(n, how, b) {
        if (!b || inSeparateBattle(n) || b.joins.indexOf(n) >= 0 || battles.some(x => x.joins.indexOf(n) >= 0)) return;
        if (n !== 1 && !coop.player(n)) return;
        b.joins.push(n);
        battleLog('P' + n + ' wants to join battle ' + b.seq + ' (' + how + '), phase ' + (b.bm && b.bm._phase));
        if (n === Net.player) banner('Joining the battle...', 'At the next turn', COLOR_NET, 150);
        if (!b.started) applyJoins(b);
    }

    // (la respuesta a "Join it?": ayudar a un bando o contra todos)
    function pvpJoin(n, seq, side) {
        const b = battles.find(x => x.seq === seq);
        if (!b || !b.troop || !b.troop._coopPvp) return;
        b.pvpSides = b.pvpSides || {};
        b.pvpSides[n] = side;
        queueJoin(n, side >= 0 ? 'helps side ' + side + ' in a PvP' : 'attacks everyone in a PvP', b);
    }
    Net.pvpJoin = pvpJoin;

    function applyJoins(b) {
        const joins = b.joins.splice(0);
        if (joins.length === 0) return;
        const before = $gameParty.battleMembers();
        battleLog('joined: P' + joins.join(', P') + ' (phase ' + BattleManager._phase + ')');
        // PvP: su doble y su bando, antes de que cuente en el grupo del combate
        if (b.troop && b.troop._coopPvp && window.CoopPvp) {
            joins.forEach(n => {
                const side = b.pvpSides && b.pvpSides[n] !== undefined ? b.pvpSides[n] : -1;
                if (b.pvpSides) delete b.pvpSides[n];
                CoopPvp.addFighter(n, side);
            });
        }
        joins.forEach(n => {
            closeSub(n);
            b.involved.push(n);
            b.inputs[n] = newVirtualInput(Net.raw[n] || 0);
            banner('P' + n + ' joins the battle', '', COLOR_NET, 160);
            if (n === Net.player) {
                battleStartAudio(b);
                BattleManager.playBattleBgm();
            }
        });
        if (b.started) {
            const after = $gameParty.battleMembers();
            after.filter(a => before.indexOf(a) < 0).forEach(a => {
                a.onBattleStart();
                a.makeActions(); // sus casillas de accion para este turno
            });
            if (b.scene._statusWindow && b.scene._statusWindow.refresh) b.scene._statusWindow.refresh();
        }
    }

    // los que se unen entran al empezar un turno (no a mitad de las acciones)
    const _BattleManager_startInput = BattleManager.startInput;
    BattleManager.startInput = function() {
        if (inBattleCtx && battle && battle.joins.length > 0) applyJoins(battle);
        _BattleManager_startInput.call(this);
    };

    // OK al lado de uno que lucha (en cualquiera de las 8 casillas de alrededor) = unirse
    function checkJoinPresses() {
        const OK = 1 << ACTIONS.indexOf('ok');
        Net.players.forEach(n => {
            const raw = Net.raw[n] || 0;
            const pressed = (raw & OK) && !((Net.prevRaw[n] || 0) & OK);
            Net.prevRaw[n] = raw;
            if (!pressed || inSeparateBattle(n) || subs[n]) return;
            const p = coop.player(n);
            if (!p) return;
            // (el combate del que lucha a su lado)
            const near = battles.find(b => b.involved.some(m => {
                const q = m === 1 ? $gamePlayer : coop.player(m);
                return q && Math.abs($gameMap.deltaX(q.x, p.x)) <= 1 && Math.abs($gameMap.deltaY(q.y, p.y)) <= 1;
            }));
            if (!near) return;
            // un PvP: antes, de que lado (ayudar a uno, o contra todos)
            const pvp = near.troop && near.troop._coopPvp;
            if (pvp && window.CoopPvp && CoopPvp.joinEventList) {
                const it = $gameMap._interpreter;
                if (it.isRunning() || $gameMessage.isBusy()) return;
                it.setup(CoopPvp.joinEventList(n, near.seq, pvp), 0);
                it._coopStarter = n; // (elige quien llega)
                return;
            }
            queueJoin(n, 'OK next to a fighter', near);
        });
    }

    // Un combate aparte sin P1 que se pierde: para el evento del mapa no es "Perder" sino que se
    // termino (como huir). Las ramas "Si pierdes" del juego (los guardias de Fear & Hunger 1 te
    // capturan: foso de sangre, piernas...) son la derrota del protagonista y le pasaban a todos;
    // los que lucharon quedan muertos (cuerpos).
    const _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        if (Net.active && inBattleCtx && battle && result === 2 && battle.involved.indexOf(1) < 0) {
            battleLog('battle ' + battle.seq + ' lost by P' + battle.involved.join(', P') + ' (without P1): ends as escaped for the map event');
            result = 1;
            // y siguen muertos: con "se puede perder" RPG Maker los levantaria con 1 PV (y el
            // enemigo los volvia a tocar: combate sin fin)
            this._coopNoRevive = true;
        } else if (Net.active && inBattleCtx && battle) {
            battleLog('battle ' + battle.seq + ' result ' + ['won', 'escaped / aborted', 'lost'][result]);
        }
        _BattleManager_endBattle.call(this, result);
    };

    // GALV_LayerGraphics (Termina): las capas de los combates estan en $gameSystem, una sola para
    // todos. "AFTER BATTLE" de un combate que acaba las borra (Galv.LG.bLayer(1)) y el dibujo de esa
    // capa en OTRO combate aparte en marcha fallaba: ese combate se cerraba a medias (y el enemigo
    // volvia a atacar). Sin su capa, ese dibujo no se ve y el combate sigue.
    if (typeof Sprite_LayerGraphic !== 'undefined') {
        const _Sprite_LayerGraphic_update = Sprite_LayerGraphic.prototype.update;
        Sprite_LayerGraphic.prototype.update = function() {
            if (!this.lValue()) {
                this.visible = false;
                this._coopNoLayer = true;
                return;
            }
            if (this._coopNoLayer) {
                this._coopNoLayer = false;
                this.visible = true;
            }
            _Sprite_LayerGraphic_update.call(this);
        };
    }

    function closeBattle(b) {
        if (!b || battles.indexOf(b) < 0) return;
        try {
            withBattle(b, () => b.scene.terminate());
        } catch (e) {
            logError('closing the separate battle', e);
        }
        battles = battles.filter(x => x !== b);
        releaseScope(b);
        // el evento que lo empezo sigue ("si gana...") cuando el mapa quede libre
        if (b.root) pendingRoots.push(b.root);
        battleLog('battle ' + b.seq + ' ended (P' + b.involved.join(', P') + ')');
        // un evento comun que el combate dejo pendiente sigue en el mapa
        if (b.temp.isCommonEventReserved()) $gameTemp.reserveCommonEvent(b.temp._commonEventId);
        b.involved.forEach(n => { Net.mask[n] = Net.raw[n] || 0; });
    }

    function closeAllBattles() {
        battles.slice().forEach(closeBattle);
    }

    function changeBattle(b, next) {
        if (next instanceof Scene_Map) {
            closeBattle(b);
            return;
        }
        // fin de partida, titulo...: se cierran los combates y esa escena va para todos
        closeAllBattles();
        Net.sceneSeq++;
        SceneManager._nextScene = next;
    }

    function updateBattles() {
        if (battles.length === 0) return;
        checkJoinPresses();
        battles.slice().sort((x, y) => x.seq - y.seq).forEach(b => {
            if (battles.indexOf(b) < 0) return; // (se cerro con otro)
            battle = b;
            try {
                updateOneBattle(b);
            } finally {
                battle = null;
            }
        });
    }

    function updateOneBattle(b) {
        if (!b.started) {
            if (Net.battleReadyAll < b.seq) return; // alguien aun lo esta cargando
            b.started = true;
            const first = withBattle(b, () => b.scene.start());
            if (first) changeBattle(b, first);
            return;
        }
        stepBattleInputs();
        logBattleInput();
        // se fueron todos los que luchaban: se acaba como una huida (la IA no siempre lo acababa)
        if (!b.aborting && battleAbandoned()) {
            b.aborting = true;
            battleLog('battle ' + b.seq + ': everybody in it left - ends as escaped');
            withBattle(b, () => BattleManager.abort());
        }
        let next = null;
        try {
            next = withBattle(b, () => {
                // mientras se eligen acciones se puede entrar ya (elige la suya en este turno)
                if (b.joins.length > 0 && BattleManager._phase === 'input') applyJoins(b);
                b.scene.update();
            });
        } catch (e) {
            logError('separate battle', e);
            closeBattle(b);
            return;
        }
        if (next) changeBattle(b, next);
    }

    // el evento apartado sigue en el mapa en cuanto este libre
    const _Game_Map_updateInterpreter = Game_Map.prototype.updateInterpreter;
    Game_Map.prototype.updateInterpreter = function() {
        if (pendingRoots.length && !this._interpreter.isRunning() && !$gameMessage.isBusy()) {
            this._interpreter = pendingRoots.shift();
            this._interpreter._coopAfterBattle = true;
        }
        _Game_Map_updateInterpreter.call(this);
    };

    // Lo que hace despues ("AFTER BATTLE": recuperar, estados... a todo el grupo) no toca a los que
    // siguen luchando en otro combate aparte
    const _Game_Interpreter_update = Game_Interpreter.prototype.update;
    Game_Interpreter.prototype.update = function() {
        if (!this._coopAfterBattle || !Net.active || battles.length === 0) {
            if (this._coopAfterBattle && !this.isRunning()) this._coopAfterBattle = false;
            return _Game_Interpreter_update.call(this);
        }
        const party = $gameParty;
        const all = Game_Party.prototype.allMembers;
        // (quien lucha se mira antes de cambiar la lista: battleOwnerOf mira el grupo, y con la lista
        // ya cambiada se llamaba a si mismo sin fin)
        const fighting = all.call(party).filter(a => battles.some(b => b.involved.indexOf(coop.battleOwnerOf(a)) >= 0)).map(a => a.actorId());
        party.allMembers = function() {
            return all.call(this).filter(a => fighting.indexOf(a.actorId()) < 0);
        };
        try {
            return _Game_Interpreter_update.call(this);
        } finally {
            delete party.allMembers;
            if (!this.isRunning()) this._coopAfterBattle = false;
        }
    };

    // registro: cuando cambian las teclas de alguien que lucha, quien tiene el control y que
    // ventana y casilla estan activas (igual en todos los PC si todo va bien)
    function logBattleInput() {
        const raws = battle.involved.map(n => 'P' + n + '=' + (Net.raw[n] || 0)).join(' ');
        if (raws === battle.lastRaws) return;
        battle.lastRaws = raws;
        let owner = '?';
        let win = '-';
        let actorName = '-';
        try {
            withBattle(battle, () => {
                owner = 'P' + battleInputOwner();
                if (BattleManager.actor()) actorName = BattleManager.actor().name();
                const layer = battle.scene._windowLayer;
                const active = layer ? layer.children.filter(w => w && w.active && w.visible && typeof w.index === 'function') : [];
                win = active.map(w => w.constructor.name + '#' + w.index() + '/' + w.maxItems()).join(',') || 'none';
            });
        } catch (e) {
            win = 'error ' + e.message;
        }
        battleLog('battle ' + battle.seq + ' keys ' + raws + ' -> owner ' + owner + ', phase ' + (battle.bm || {})._phase + ', actor ' +
            actorName + ', active ' + win);
    }

    // "Procesar combate" de un evento que empezo un jugador: combate aparte
    const _Game_Interpreter_command301 = Game_Interpreter.prototype.command301;
    Game_Interpreter.prototype.command301 = function() {
        if (!Net.active || !Net.separate || inSub) return _Game_Interpreter_command301.call(this);
        const starter = this._coopStarter;
        if (starter && inSeparateBattle(starter)) return false; // (ya lucha: espera)
        const map = SceneManager._scene;
        if (!(map instanceof Scene_Map) || !starter || (starter !== 1 && !coop.player(starter)) || $gameParty.inBattle()) {
            return _Game_Interpreter_command301.call(this);
        }
        const b = {
            scene: null, stack: null, involved: [starter], inputs: {}, started: false, seq: Net.battleSeq + 1, joins: [],
            screen: new Game_Screen(), message: new Game_Message(), temp: new Game_Temp(), inBattle: false, interp: this,
            troop: new Game_Troop(), bm: null, root: null, scope: { sw: {}, vars: {} }
        };
        b.screen._tone = $gameScreen._tone.slice(); // el tono del mapa (noche, interiores...)
        // el combate se prepara con sus propios mensajes y pantalla, sin salir del mapa
        const sm = SceneManager;
        const saved = { stack: sm._stack, next: sm._nextScene, message: $gameMessage, screen: $gameScreen, temp: $gameTemp,
            troop: $gameTroop, bm: bmState() };
        sm._stack = [];
        sm._nextScene = null;
        $gameMessage = b.message;
        $gameScreen = b.screen;
        $gameTemp = b.temp;
        $gameTroop = b.troop; // (su propia tropa y su BattleManager: puede haber otro combate en marcha)
        map.stop = function() {};
        inSub = true;
        let result = true;
        let next = null;
        try {
            result = _Game_Interpreter_command301.call(this);
        } finally {
            inSub = false;
            delete map.stop;
            next = sm._nextScene;
            b.stack = sm._stack;
            sm._stack = saved.stack;
            sm._nextScene = saved.next;
            $gameMessage = saved.message;
            $gameScreen = saved.screen;
            $gameTemp = saved.temp;
            b.troop = $gameTroop;
            b.bm = bmState();
            $gameTroop = saved.troop;
            setBmState(saved.bm);
        }
        if (!(next instanceof Scene_Battle)) return result;
        b.scene = next;
        b.inputs[starter] = newVirtualInput(Net.raw[starter] || 0);
        // el enemigo que empezo el combate se queda quieto hasta el final (el mapa sigue para los
        // demas; normalmente ya esta parado, pero no siempre si el combate lo empezo P2-P4).
        // Lo suelta el propio juego cuando termina su evento.
        const foe = this._eventId > 0 && this._mapId === $gameMap.mapId() ? $gameMap.event(this._eventId) : null;
        if (foe) foe._locked = true;
        b.foe = foe;
        Net.battleSeq = b.seq;
        battles.push(b);
        // PvP: todos los jugadores de los bandos luchan en el mismo combate, con sus turnos
        const pvp = b.troop && b.troop._coopPvp;
        ((pvp && pvp.players) || []).forEach(n => {
            if (n === starter || b.involved.indexOf(n) >= 0 || inSeparateBattle(n)) return;
            closeSub(n);
            b.involved.push(n);
            b.inputs[n] = newVirtualInput(Net.raw[n] || 0);
            if (n === Net.player) battleStartAudio(b);
        });
        // todos juntos, como en un solo PC: el combate de una figura de barro, o el de una escena de
        // la historia que empieza sola (Per'kele en la torre...: nadie puede acercarse a unirse)
        if (!pvp && ((b.bm && b.bm._coopForm) || isAutorunRoot($gameMap._interpreter))) {
            for (let n = 1; n <= coop.maxPlayers; n++) {
                if (n === starter || b.involved.indexOf(n) >= 0 || Net.left[n] || inSeparateBattle(n)) continue;
                if (n !== 1 && !coop.player(n)) continue;
                closeSub(n);
                b.involved.push(n);
                b.inputs[n] = newVirtualInput(Net.raw[n] || 0);
                if (n === Net.player) battleStartAudio(b);
            }
        }
        // el evento del mapa que lo empezo se aparta: el mapa queda libre (otro jugador puede
        // empezar su combate con otro enemigo, hablar, abrir cofres...)
        // (no una escena de la historia que empieza sola: con el mapa libre volveria a empezar
        // desde el principio; esa espera al combate como siempre)
        for (let it = $gameMap._interpreter; it && !isAutorunRoot($gameMap._interpreter); it = it._childInterpreter) {
            if (it !== this) continue;
            b.root = $gameMap._interpreter;
            $gameMap._interpreter = new Game_Interpreter();
            break;
        }
        battleLog('battle ' + b.seq + ' for P' + starter + ' (troop ' + b.troop._troopId + ')' + (battles.length > 1 ? ', ' + battles.length + ' battles now' : ''));
        closeSub(starter);
        this._waitMode = 'coopBattle';
        if (starter === Net.player) battleStartAudio(b);
        else banner('P' + starter + ' is in a battle', 'Stand next to them and press OK to join', '#ffaa44', 240);
        try {
            withBattle(b, () => {
                b.scene.create();
                // los filtros de pantalla del mapa (FilterController) los lleva el mapa
                if (typeof b.scene.updateTKMfilters === 'function') b.scene.updateTKMfilters = function() {};
            });
        } catch (e) {
            logError('starting the separate battle', e);
            battles = battles.filter(x => x !== b);
            if (b.root) {
                pendingRoots.push(b.root);
                b.root = null;
            }
            this._waitMode = '';
        }
        return result;
    };

    // un evento de "Autorun" (o un evento comun de inicio automatico): empieza solo en cuanto el
    // mapa queda libre
    function isAutorunRoot(it) {
        if (!it || !it.isRunning()) return false;
        const ev = it._eventId > 0 && it._mapId === $gameMap.mapId() ? $gameMap.event(it._eventId) : null;
        if (ev) return !!ev.page() && ev.page().trigger === 3;
        return ($dataCommonEvents || []).some(ce => ce && ce.trigger === 1 && ce.list === it._list);
    }

    // el evento que empezo el combate espera a que termine (y luego sigue: "si gana", etc.)
    const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'coopBattle') {
            if (battles.some(b => b.interp === this)) return true;
            this._waitMode = '';
            return false;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };

    // ... pero no para el mapa: para los demas no hay "evento en marcha" (andan, abren su menu)
    const _Game_Map_isEventRunning = Game_Map.prototype.isEventRunning;
    Game_Map.prototype.isEventRunning = function() {
        const running = _Game_Map_isEventRunning.call(this);
        if (running && !inBattleCtx && this._interpreter._waitMode === 'coopBattle' && battles.some(b => b.interp === this._interpreter)) return false;
        return running;
    };

    // El enemigo del combate ni se mueve en el mapa: algunos persiguen con rutas que les pone otro
    // evento (eso no lo para el "bloqueo" del juego) e iban a por los que no luchan
    const _Game_Event_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        if (battles.length && battles.some(b => b.foe === this)) return;
        _Game_Event_update.call(this);
    };

    // eventos durante un combate aparte: los que luchan no estan; un enemigo que toca a otro
    // jugador le mete en el combate (en vez de empezar otro)
    const _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        const wasLocked = this._locked; // (el enemigo del combate esta parado: que siga parado)
        _Game_Event_start.call(this);
        if (!battles.length || !this._starting) return;
        const n = this._coopStarter || 1;
        // el enemigo con el que ya lucha alguien: entra en ese combate (otro enemigo: su propio combate)
        const theirs = battles.find(b => b.foe === this ||
            (b.interp && b.interp._eventId === this.eventId() && b.interp._mapId === $gameMap.mapId()));
        if (inSeparateBattle(n)) {
            this._starting = false;
            if (!wasLocked) this.unlock();
        } else if (theirs) {
            this._starting = false;
            if (!wasLocked) this.unlock();
            queueJoin(n, 'touched the enemy of that battle', theirs);
        } else if (pageStartsBattle(this)) {
            // (otro enemigo: empieza su propio combate)
        } else if (listLeavesPlace(this.list(), 0)) {
            // mientras alguien lucha aqui nadie se va (puertas, dormir, guardar...): el traslado
            // se llevaria tambien a los que luchan (y asi se huia de cualquier combate)
            this._starting = false;
            if (!wasLocked) this.unlock();
            refuseLeaving();
        }
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
        const scene = (SceneManager._scene ? SceneManager._scene.constructor.name : '-') +
            Object.keys(subs).map(n => ' P' + n + ' ' + subs[n].scene.constructor.name).join('') +
            battles.map(b => ' battle[' + b.involved.join(',') + (b.started ? '' : ' loading') + ']').join('');
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
        // los numeros al azar del ultimo tramo (desde la huella anterior), para comparar entre PC
        const from = f - HASH_EVERY;
        const calls = randTrail.filter(t => t.f >= from && t.f <= f).map(trailLine);
        lines.push('[random calls ' + from + '..' + f + ': ' + calls.length + ']');
        calls.forEach(l => lines.push('  ' + l));
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
            // (una escena a medio crear, p.ej. un mapa que aun cargaba, no siempre se deja cerrar)
            try {
                old.terminate();
            } catch (e) {
                logError('closing the scene', e);
            }
            try {
                old.detachReservation();
            } catch (e) {
                // nada
            }
        }
        SceneManager._scene = null;
        SceneManager._sceneStarted = false;
        SceneManager._nextScene = null;
        SceneManager.clearStack(); // puede venir de un menu (Opciones > Co-op)
    }

    // Opciones: las que cambian el juego (correr siempre, recordar comando, velocidad del
    // combate...) son las del anfitrion en todos los PC; volumen, teclas y camara, las de cada uno.
    // Los invitados no guardan las del anfitrion: al terminar vuelven las suyas.
    function isLocalOption(key) {
        return /volume/i.test(key) || ['keyMapper', 'wasdMap', 'gamepadInput', 'coopSettings'].indexOf(key) >= 0;
    }

    function applySharedConfig(hostData) {
        if (!hostData) return;
        const local = ConfigManager.makeData();
        const merged = Object.assign({}, hostData);
        Object.keys(local).forEach(key => { if (isLocalOption(key)) merged[key] = local[key]; });
        // de los ajustes del co-op, los que cambian el juego (muerte, resurreccion...) son del anfitrion
        if (local.coopSettings && hostData.coopSettings) {
            merged.coopSettings = Object.assign({}, local.coopSettings);
            coop.ruleKeys().forEach(key => {
                if (hostData.coopSettings[key] !== undefined) merged.coopSettings[key] = hostData.coopSettings[key];
            });
        }
        ConfigManager.applyData(merged);
    }

    const _ConfigManager_save = ConfigManager.save;
    ConfigManager.save = function() {
        if (Net.active && Net.role !== 'host') return;
        _ConfigManager_save.call(this);
    };

    function enterSession() {
        if (Net.active) return;
        Net.localConfig = ConfigManager.makeData();
        Net.active = true;
        Net.leftovers = [];
        Math.random = seededRandom;
        Net.clockAcc = 0;
        Net.clockLast = 0;
        Net.frames = {};
        Net.history = {};
        coop.setPadCapture(capturePad);
    }

    // TerraxLighting lleva el reloj dia/noche por dentro y solo lo lee de la partida guardada al
    // cargar desde la pantalla de Cargar: con la instantanea cada invitado se quedaba con su hora.
    // Se pone con sus propios comandos ("daynight speed", "daynight hour h m"), igual en todos.
    function syncTerraxClock() {
        if (typeof Imported === 'undefined' || !Imported.TerraxLighting) return;
        const v = $gameVariables;
        if (!v || typeof v.valueDayNightSave !== 'function') return;
        const it = new Game_Interpreter();
        try {
            const speed = typeof v.valueSpeedDayNightSave === 'function' ? v.valueSpeedDayNightSave() : 0;
            if (speed > 0) it.pluginCommand('daynight', ['speed', String(speed)]);
            const hour = v.valueDayNightSave() || 0;
            const minutes = typeof v.valueDayNightSaveMin === 'function' ? (v.valueDayNightSaveMin() || 0) : 0;
            it.pluginCommand('daynight', ['hour', String(hour), String(minutes)]);
        } catch (e) {
            logError('TerraxLighting clock', e);
        }
    }

    function applySnapshot(meta, saveJson) {
        enterSession();
        rngState = meta.rng | 0;
        Net.frame = meta.f;
        Net.players = meta.players.slice();
        Net.frameBase = meta.frameBase;
        Net.timeBase = meta.timeBase;
        Net.sceneSeq = meta.sceneSeq;
        Net.battleSeq = meta.battleSeq || 0;
        Net.battleReadyAll = Net.battleSeq;
        Net.separate = !!meta.separate;
        closeAllSubs();
        if (battles.length) closeAllBattles();
        Net.applied = {};
        Net.raw = {};
        Net.mask = {};
        Net.left = {};
        Net.history = {};
        Object.keys(Net.frames).forEach(f => { if (Number(f) < meta.f) delete Net.frames[f]; });
        closeSceneNow();
        DataManager.createGameObjects();
        DataManager.extractSaveContents(JsonEx.parse(saveJson));
        Net.player = slotOf(Net.seat); // (la partida dice a quien lleva cada PC)
        $gameSystem.onAfterLoad(); // musica de la partida (si sigue siendo la misma, no se corta)
        syncTerraxClock();
        applySharedConfig(meta.config);
        coop.clearInputs();
        // vuelven todos menos quien sigue fuera (su personaje va en la fila)
        coop.forceRestore(meta.players.filter(p => p !== 1 && (meta.gone || []).indexOf(p) < 0), meta.actors);
        Net.pendingExtras = { extras: meta.extras || [], away: meta.away || [], back: meta.back || [] };
        SceneManager.goto(Scene_Map); // sceneSeq + 1, igual en todos
        coop.setCamera('p' + Net.player);
        // los primeros cuadros despues de la instantanea van sin teclas (el margen de la espera)
        Net.delay = Math.max(Net.delay, targetDelay());
        for (let f = meta.f; f < meta.f + Net.delay; f++) sendInput(f, 0);
        if (meta.first) {
            banner('Network game: you are P' + Net.player, meta.reason || ('Players: ' + meta.players.map(p => 'P' + p).join(', ')), COLOR_NET, 240);
        } else if (meta.reason) {
            banner(meta.reason, '', COLOR_NET, 160);
        }
    }

    function endSession(reason) {
        if (!Net.active) return;
        closeAllSubs();
        if (battles.length) closeAllBattles();
        Net.active = false;
        if (Net.localConfig) ConfigManager.applyData(Net.localConfig);
        Math.random = nativeRandom;
        window.Date = NativeDate;
        coop.setPadCapture(null);
        coop.setCamera('auto');
        Net.hold = null;
        Net.joinQueue = [];
        Net.lost = {};
        // los jugadores de los otros PC ya no estan aqui: sus personajes vuelven a ser seguidores
        // (si no, seguian como P2-P4 del co-op local y el teclado se repartia entre ellos: las
        // flechas eran de P2 y en el menu de P1 no se movia el cursor)
        Net.leftovers = Net.players.filter(n => n !== 1);
        removeLeftovers();
        Net.player = Net.seat; // (fuera de la partida en red cada PC vuelve a ser su numero)
        Net.players = [1];
        Net.peers.forEach(pp => { pp.inSession = false; });
        // el invitado jugaba el mundo del anfitrion: sin el, esa copia seguia sola (y se separaba:
        // combates, eventos...). Vuelve al titulo; desde ahi se reconecta solo.
        if (Net.role === 'join' && !(SceneManager._scene instanceof Scene_Title)) {
            closeSceneNow();
            SceneManager.goto(Scene_Title);
            setTimeout(() => banner('Network game stopped', reason || '', '#ffaa44', 300), 500);
            return;
        }
        banner('Network game stopped', reason || '', '#ffaa44', 300);
    }

    function removeLeftovers() {
        if (!Net.leftovers || Net.leftovers.length === 0) return;
        if (!(SceneManager._scene instanceof Scene_Map) || !SceneManager._sceneStarted || SceneManager._nextScene) return;
        Net.leftovers = Net.leftovers.filter(n => coop.player(n) && !coop.removePlayer(n));
    }

    // ---- presentacion --------------------------------------------------------------------
    // Al conectarse, el invitado dice que tiene: version del mod, version del juego, plugins
    // activos y la contrasena. Con algo distinto la partida se separaria sin saber por que:
    // el anfitrion no le deja entrar y le dice que es lo que no coincide.

    const LOCAL_ONLY_PLUGINS = ['LocalCoop_QuickSave', 'LocalCoop_NetAutotest'];

    function activePlugins() {
        if (typeof $plugins === 'undefined' || !Array.isArray($plugins)) return [];
        return $plugins.filter(pl => pl && pl.status && LOCAL_ONLY_PLUGINS.indexOf(pl.name) < 0).map(pl => pl.name);
    }

    function gameVersion() {
        return ($dataSystem && $dataSystem.versionId) || 0;
    }

    // El invitado puede traer su propio personaje: el protagonista de una de SUS partidas guardadas
    // (nivel, atributos, habilidades, equipo puesto). El anfitrion lo suma a su grupo al entrar.
    const savedHeroCache = {};
    function savedHero(slot) {
        if (!slot) return null;
        if (savedHeroCache[slot] !== undefined) return savedHeroCache[slot];
        let hero = null;
        try {
            if (DataManager.isThisGameFile(slot)) {
                const contents = JsonEx.parse(StorageManager.load(slot));
                const id = contents.party._actors[0];
                const actor = contents.actors._data[id];
                if (actor && $dataActors[id]) {
                    hero = { actorId: id, name: actor._name || $dataActors[id].name, level: actor._level || 1, json: JsonEx.stringify(actor) };
                }
            }
        } catch (e) {
            logError('reading save ' + slot, e);
        }
        savedHeroCache[slot] = hero;
        return hero;
    }

    function savedSlots() {
        const max = DataManager.maxSavefiles ? DataManager.maxSavefiles() : 20;
        const out = [];
        for (let i = 1; i <= max; i++) if (DataManager.isThisGameFile(i)) out.push(i);
        return out;
    }

    function helloMessage() {
        const hero = savedHero(Net.config.bring);
        return { t: 'hello', mod: coop.version, game: gameVersion(), plugins: activePlugins(), pw: Net.config.password || '',
            bring: hero ? { actorId: hero.actorId, name: hero.name, level: hero.level, json: hero.json } : null };
    }

    // devuelve por que no puede entrar (o '' si todo coincide)
    function helloProblem(msg) {
        if (Net.config.password && msg.pw !== Net.config.password) return 'Wrong password';
        if (msg.mod !== coop.version) return 'Different mod version: host ' + coop.version + ', you ' + msg.mod;
        if (msg.game !== gameVersion()) return 'Different game version (update both copies of the game)';
        const mine = activePlugins();
        const theirs = Array.isArray(msg.plugins) ? msg.plugins : [];
        const missing = mine.filter(n => theirs.indexOf(n) < 0);
        const extra = theirs.filter(n => mine.indexOf(n) < 0);
        if (missing.length || extra.length) {
            return 'Different plugins' + (missing.length ? ' - missing: ' + missing.slice(0, 3).join(', ') : '') +
                (extra.length ? ' - extra: ' + extra.slice(0, 3).join(', ') : '');
        }
        return '';
    }

    // ---- anfitrion ----------------------------------------------------------------------

    function hostStoreInput(f, player, bits, readySeq, battleReady) {
        if (!Net.active || f < Net.nextBuild) return;
        if (f < Net.nextBuild) return; // (llego tarde: ese cuadro ya salio sin ella)
        if (!Net.inputs[f]) Net.inputs[f] = {};
        Net.inputs[f][player] = bits;
        if (player === 1) {
            Net.hostReady = readySeq;
            Net.hostBattleReady = battleReady;
        } else {
            const peer = Net.peers.find(pp => pp.player === player);
            if (peer) {
                peer.ready = readySeq;
                peer.battleReady = battleReady;
            }
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
            const missing = Net.players.filter(p => p !== 1 && !Net.lost[p] && got[p] === undefined);
            if (got[1] === undefined) return; // (la tecla del propio anfitrion aun no)
            const now = performance.now();
            Net.players.forEach(p => { if (missing.indexOf(p) < 0) delete Net.waitSince[p]; });
            if (missing.length > 0) {
                missing.forEach(p => { if (!Net.waitSince[p]) Net.waitSince[p] = now; });
                if (missing.some(p => now - Net.waitSince[p] < STALL_MS)) {
                    Net.blockedSince = Net.blockedSince || now;
                    Net.blockedOn = missing;
                    return;
                }
                // los que no llegan: este cuadro sin sus teclas
                missing.forEach(p => {
                    got[p] = 0;
                    if (!Net.stalledLog[p]) {
                        Net.stalledLog[p] = true;
                        battleLog('P' + p + ' is not answering: the game goes on without their keys');
                    }
                });
            } else {
                Net.stalledLog = {};
            }
            Net.blockedSince = 0;
            const a = [0, 0, 0, 0, 0];
            Net.players.forEach(p => { a[p] = Net.lost[p] ? 0 : got[p]; });
            const ready = [Net.hostReady].concat(sessionPeers().map(pp => pp.ready));
            const pkt = { t: 'fr', f: f, a: a, rs: Math.min.apply(null, ready.map(r => (r === undefined ? -1 : r))) };
            const bready = [Net.hostBattleReady].concat(sessionPeers().map(pp => pp.battleReady));
            pkt.br = Math.min.apply(null, bready.map(r => (r === undefined ? -1 : r)));
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

    // El reloj comun (Date durante cada cuadro) se coloca en cada instantanea un poco por delante
    // del reloj de verdad, y nunca hacia atras. Hay plugins que solo cuentan tiempo cuando la hora
    // pasa de la ultima que vieron, y esa la guardan por dentro, fuera de la partida guardada
    // (el ciclo dia/noche de TerraxLighting en Fear & Hunger 1): un invitado que habia visto la
    // hora real (mas adelantada que el reloj comun) dejaba de contar y se separaba una y otra vez.
    const CLOCK_LEAD = 5 * 60 * 1000;
    function sharedClockBase(first, f) {
        const now = first ? 0 : Net.timeBase + Math.floor(f * STEP_MS);
        return Math.max(now, NativeDate.now() + CLOCK_LEAD) - Math.floor(f * STEP_MS);
    }

    // devuelve el actor que llevara ese invitado (0 = ninguno: un companero libre, como siempre)
    function bringHero(peer) {
        const b = peer.bring;
        if (!b || peer.broughtDone) return peer.broughtId || 0;
        peer.broughtDone = true;
        const id = b.actorId;
        const name = b.name || ($dataActors[id] && $dataActors[id].name) || 'that character';
        const say = (title, sub) => send(peer.sock, { t: 'note', title: title, sub: sub || '' });
        if (!$dataActors[id]) {
            say('Your character could not join', 'Unknown character (another game?)');
            return 0;
        }
        const takenBy = $gameParty._actors[0] === id ? 1 : (coop.players().find(p => p._coopActorId === id) || { coopIndex: () => 0 }).coopIndex();
        if (takenBy && takenBy !== peer.player) {
            say(name + ' is already played by P' + takenBy, 'You play a companion instead');
            return 0;
        }
        if ($gameParty._actors.indexOf(id) < 0) {
            if ($gameParty._actors.length >= 4) {
                say("The host's party is full", 'You play a companion instead');
                return 0;
            }
            try {
                $gameActors._data[id] = JsonEx.parse(b.json);
            } catch (e) {
                logError('brought character', e);
                say('Your character could not join', 'The save could not be read');
                return 0;
            }
            $gameParty.addActor(id);
            peer.broughtNew = true;
        }
        // (si ya estaba en el grupo, p.ej. vuelve tras irse, sigue como estaba en este mundo)
        peer.broughtId = id;
        return id;
    }

    function hostSnapshot(first) {
        const back = Net.joinQueue.filter(n => Net.players.indexOf(n) >= 0);
        Net.joinQueue.forEach(n => {
            if (Net.players.indexOf(n) < 0) Net.players.push(n);
            delete Net.lost[n];
        });
        Net.players.sort();
        const peersNow = Net.peers.filter(pp => Net.players.indexOf(pp.player) >= 0);
        // quien entra con su personaje guardado: al grupo
        const brought = {};
        const joinedWith = [];
        peersNow.filter(pp => Net.joinQueue.indexOf(pp.player) >= 0).forEach(pp => {
            const id = bringHero(pp);
            if (id) {
                brought[slotOf(pp.player)] = id;
                if (pp.broughtNew) joinedWith.push('P' + pp.player + ' with ' + $gameActors.actor(id).name());
            }
        });
        if (joinedWith.length > 0) $gamePlayer.refresh();
        const reason = first ? (joinedWith.length ? joinedWith.join(', ') : '') :
            (Net.joinQueue.length > 0 ? (joinedWith.length ? joinedWith.join(', ') + ' joined' : 'P' + Net.joinQueue.join(', P') + ' joined') : 'Back in sync');
        // el personaje de cada uno (para que nadie cambie de personaje al cargar la instantanea)
        const actors = {};
        Net.players.filter(n => n !== 1).forEach(n => {
            const p = coop.player(n);
            const id = brought[n] || (p && p._coopActorId) || coop.lastActor(n);
            if (id) actors[n] = id;
        });
        peersNow.forEach(pp => {
            pp.inSession = true;
            pp.ready = -1;
            pp.battleReady = Net.battleSeq;
        });
        Net.hostBattleReady = Net.battleSeq;
        Net.blockedSince = 0;
        $gameSystem.onBeforeSave();
        const meta = {
            f: Net.frame,
            first: !!first,
            rng: first ? ((nativeRandom() * 4294967296) | 0) : rngState,
            players: Net.players.slice(),
            frameBase: first ? $gameSystem._framesOnSave : Net.frameBase,
            timeBase: sharedClockBase(first, Net.frame),
            sceneSeq: Net.sceneSeq,
            battleSeq: Net.battleSeq,
            separate: Net.config.battles === 'separate',
            extras: first ? [] : coop.players().map(p => ({ n: p.coopIndex(), actor: p._coopActorId, x: p._x, y: p._y, d: p._direction }))
                // quien vuelve tras irse: su personaje de antes, junto a P1
                .concat(back.filter(n => !coop.player(n)).map(n => ({ n: n, actor: coop.lastActor(n), x: $gamePlayer.x, y: $gamePlayer.y, d: $gamePlayer.direction() }))),
            away: first ? [] : coop.awayPlayers(),
            gone: Object.keys(Net.lost).map(Number).map(slotOf),
            back: back.map(slotOf),
            reason: reason,
            actors: actors,
            config: ConfigManager.makeData()
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

    // hay una partida cargada (en el mapa o en un menu abierto desde el mapa)
    function gameLoaded() {
        const sm = SceneManager;
        const onMap = sm._scene instanceof Scene_Map || sm._stack.indexOf(Scene_Map) >= 0;
        return onMap && !!$gameMap && $gameMap.mapId() > 0 && !!$gameParty && !!$gameParty.leader();
    }

    function hostStartSession() {
        if (Net.role !== 'host' || Net.active || !gameLoaded() || Net.peers.length === 0) return false;
        Net.seat = 1;
        Net.player = slotOf(1);
        Net.players = [1];
        Net.lost = {};
        Net.pendingEvents = [];
        Net.joinQueue = Net.peers.map(pp => pp.player);
        Net.frame = 0;
        Net.sceneSeq = 0;
        enterSession();
        hostSnapshot(true);
        return true;
    }

    // un invitado ya presentado: se le da numero de jugador (o se le dice que esta lleno)
    function acceptPeer(sock, hello) {
        const used = Net.peers.map(pp => pp.player);
        // vuelve alguien que se habia ido: recupera su numero; si no, el primero libre
        const lostOnes = Object.keys(Net.lost).map(Number).filter(n => used.indexOf(n) < 0).sort();
        // (fuera de la partida en red no cuentan los jugadores de la sesion anterior: si no, al cerrar
        // y volver a abrir la partida el invitado pasaba a ser P3)
        const inGame = Net.active ? Net.players : [1];
        const player = lostOnes[0] || [2, 3, 4].find(n => used.indexOf(n) < 0 && inGame.indexOf(n) < 0);
        if (!player) {
            send(sock, { t: 'full' });
            sock.end();
            return null;
        }
        setTimeout(sendLobby, 0);
        const peer = { sock: sock, player: player, ready: -1, address: sock.remoteAddress, ping: 0, pings: [], inSession: false, lobbyReady: false,
            bring: hello && hello.bring && hello.bring.actorId ? hello.bring : null };
        Net.peers.push(peer);
        send(sock, { t: 'hi', player: player });
        if (Net.active) {
            Net.joinQueue.push(player);
            banner('P' + player + ' connected', 'Joining at the next quiet moment...', COLOR_NET, 200);
        } else {
            banner('P' + player + ' connected', peer.address + '  -  Options > Co-op > Network game to start', COLOR_NET, 240);
        }
        return peer;
    }

    // ---- lobby: antes de empezar, cada invitado dice "listo"; cuando lo estan todos, cuenta atras
    // y la partida empieza sola (el anfitrion tambien puede empezar antes con Start)
    const COUNTDOWN_FRAMES = 180;
    Net.lobby = [];         // invitado: lo que manda el anfitrion [{ n, name, ready, host }]
    Net.lobbyReady = false; // invitado: yo estoy listo
    Net.countdown = 0;      // cuadros que faltan (0 = sin cuenta atras)

    Net.allPings = {};      // invitado: el ping de cada jugador al anfitrion { 2: 35, 3: 120 }

    // ping de cada jugador al anfitrion (el anfitrion no tiene)
    function playerPings() {
        if (Net.role === 'host') {
            const out = {};
            Net.peers.forEach(pp => { out[pp.player] = pp.ping; });
            return out;
        }
        const out = Object.assign({}, Net.allPings);
        if (Net.seat) out[Net.seat] = Net.ping;
        return out;
    }

    // verde / amarillo / rojo (colores del windowskin para \C[n])
    function pingColor(ms) {
        return ms < 80 ? 3 : (ms < 160 ? 6 : 2);
    }

    function pingText(ms) {
        return '\\C[' + pingColor(ms) + ']' + ms + 'ms\\C[0]';
    }

    function lobbyList() {
        const leader = typeof $gameParty !== 'undefined' && $gameParty && $gameParty.leader && $gameParty.leader();
        return [{ n: 1, name: leader ? leader.name() : '', ready: true, host: true }].concat(Net.peers.map(pp => ({
            n: pp.player, name: pp.bring ? pp.bring.name : '', ready: !!pp.lobbyReady
        })));
    }

    // colored: con el ping en color (para drawTextEx; los avisos no lo entienden)
    function lobbyText(list, colored) {
        const pings = colored ? playerPings() : {};
        return list.map(e => 'P' + e.n + (e.name ? ' ' + e.name : '') + (e.host ? ' (host)' : (e.ready ? ' - ready' : ' - waiting')) +
            (pings[e.n] !== undefined ? ' ' + pingText(pings[e.n]) : '')).join('   ');
    }

    function sendLobby() {
        if (Net.role !== 'host' || Net.active) return;
        const msg = { t: 'lobby', list: lobbyList(), countdown: Math.ceil(Net.countdown / 60) };
        Net.peers.forEach(pp => send(pp.sock, msg));
    }

    function allGuestsReady() {
        return Net.peers.length > 0 && Net.peers.every(pp => pp.lobbyReady);
    }

    // cada cuadro (fuera de la partida en red): la cuenta atras del anfitrion
    function updateLobby() {
        if (Net.role !== 'host' || Net.active) {
            Net.countdown = 0;
            return;
        }
        const go = allGuestsReady() && gameLoaded();
        if (!go) {
            if (Net.countdown > 0) {
                Net.countdown = 0;
                banner('Start cancelled', 'Not everybody is ready', '#ffaa44', 150);
                sendLobby();
            }
            return;
        }
        if (Net.countdown === 0) Net.countdown = COUNTDOWN_FRAMES + 1;
        const before = Math.ceil(Net.countdown / 60);
        Net.countdown--;
        const now = Math.ceil(Net.countdown / 60);
        if (now !== before && now > 0) {
            banner('Everybody is ready - starting in ' + now + '...', lobbyText(lobbyList()), COLOR_NET, 70);
            sendLobby();
        }
        if (Net.countdown <= 0) {
            Net.countdown = 0;
            hostStartSession();
        }
    }

    function peerGone(peer) {
        if (Net.peers.indexOf(peer) < 0) return;
        const player = peer.player;
        Net.peers = Net.peers.filter(pp => pp !== peer);
        setTimeout(sendLobby, 0);
        Net.joinQueue = Net.joinQueue.filter(n => n !== player);
        if (Net.active && Net.players.indexOf(player) >= 0) {
            // su personaje vuelve a la fila en todos los PC a la vez (viaja con el proximo cuadro)
            Net.lost[player] = true;
            Net.pendingEvents.push({ k: 'away', n: player });
            hostBuildFrames();
        } else {
            banner('P' + player + ' disconnected', '', '#ffaa44', 180);
        }
    }

    // ---- buscar partidas en la red ---------------------------------------------------------
    // El invitado pregunta por UDP (a todas sus redes y a este mismo PC) quien tiene una partida
    // abierta; cada anfitrion contesta con su nombre, juego y jugadores. Asi no hace falta escribir
    // la IP. Con una VPN (Radmin, ZeroTier) funciona igual: son redes como las demas.
    const DISCOVERY_PORT = 47811;
    const DISCOVERY_ASK = 'termina-coop?';
    Net.found = [];          // [{ address, port, name, game, players, pw, active, seen }]
    Net.searching = false;
    let discoveryServer = null;

    function broadcastAddresses() {
        const out = ['255.255.255.255', '127.0.0.1'];
        const all = os.networkInterfaces();
        Object.keys(all).forEach(name => (all[name] || []).forEach(a => {
            if (a.family !== 'IPv4' || a.internal || !a.netmask) return;
            const ip = a.address.split('.').map(Number);
            const mask = a.netmask.split('.').map(Number);
            out.push(ip.map((b, i) => (b & mask[i]) | (~mask[i] & 255)).join('.'));
        }));
        return out.filter((v, i) => out.indexOf(v) === i);
    }

    function hostInfo() {
        const leader = typeof $gameParty !== 'undefined' && $gameParty && $gameParty.leader && $gameParty.leader();
        return {
            t: 'termina-coop', name: leader ? leader.name() : 'Host', game: ($dataSystem && $dataSystem.gameTitle) || '',
            mod: coop.version, players: 1 + Net.peers.length, port: Net.config.port, pw: !!Net.config.password, active: Net.active
        };
    }

    function startDiscoveryResponder() {
        if (!dgram || discoveryServer) return;
        try {
            const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            sock.on('message', (msg, rinfo) => {
                if (String(msg) !== DISCOVERY_ASK) return;
                const reply = Buffer.from(JSON.stringify(hostInfo()));
                sock.send(reply, 0, reply.length, rinfo.port, rinfo.address);
            });
            sock.on('error', e => logError('game search (host)', e));
            sock.bind(DISCOVERY_PORT);
            discoveryServer = sock;
        } catch (e) {
            logError('game search (host)', e);
        }
    }

    function stopDiscoveryResponder() {
        if (!discoveryServer) return;
        try {
            discoveryServer.close();
        } catch (e) {
            // nada
        }
        discoveryServer = null;
    }

    // busca durante 1,5 s; Net.found queda con lo encontrado
    function searchGames() {
        if (!dgram || Net.searching) return;
        Net.searching = true;
        const found = [];
        let sock = null;
        try {
            sock = dgram.createSocket('udp4');
            sock.on('message', (msg, rinfo) => {
                let info = null;
                try {
                    info = JSON.parse(String(msg));
                } catch (e) {
                    return;
                }
                if (!info || info.t !== 'termina-coop') return;
                // (el mismo PC contesta por varias direcciones: una vez, mejor la de la red que la 127.0.0.1)
                const same = found.find(f => f.port === info.port && f.name === info.name && f.game === info.game);
                if (same) {
                    if (same.address === '127.0.0.1' && rinfo.address !== '127.0.0.1') same.address = rinfo.address;
                    return;
                }
                found.push(Object.assign({ address: rinfo.address }, info));
            });
            sock.on('error', () => {});
            sock.bind(0, () => {
                try {
                    sock.setBroadcast(true);
                } catch (e) {
                    // nada
                }
                const ask = Buffer.from(DISCOVERY_ASK);
                broadcastAddresses().forEach(addr => {
                    try {
                        sock.send(ask, 0, ask.length, DISCOVERY_PORT, addr);
                    } catch (e) {
                        // nada
                    }
                });
            });
        } catch (e) {
            logError('game search', e);
        }
        setTimeout(() => {
            Net.searching = false;
            Net.found = found;
            try {
                if (sock) sock.close();
            } catch (e) {
                // nada
            }
        }, 1500);
    }

    function startHost() {
        startDiscoveryResponder();
        Net.server = netlib.createServer(sock => {
            let peer = null;
            let rejected = false;
            // quien no se presenta (otra version antigua, otro programa...) se va a los 5 s
            const helloTimer = setTimeout(() => { if (!peer) sock.destroy(); }, 5000);
            readLines(sock, msg => {
                if (rejected) return;
                if (!peer) {
                    if (msg.t !== 'hello') return;
                    clearTimeout(helloTimer);
                    const problem = helloProblem(msg);
                    if (problem) {
                        rejected = true;
                        send(sock, { t: 'reject', reason: problem });
                        sock.end();
                        banner('A player could not join (' + sock.remoteAddress + ')', problem, '#ffaa44', 300);
                        return;
                    }
                    peer = acceptPeer(sock, msg);
                    return;
                }
                if (msg.t === 'in') hostStoreInput(msg.f, peer.player, msg.b | 0, msg.rs, msg.br);
                else if (msg.t === 'h') compareHash(peer.player, msg.f, msg.h);
                else if (msg.t === 'ping') send(sock, { t: 'pong', ts: msg.ts });
                else if (msg.t === 'ready') {
                    peer.lobbyReady = !!msg.on;
                    const ready = Net.peers.filter(pp => pp.lobbyReady).length;
                    banner('P' + peer.player + (peer.lobbyReady ? ' is ready' : ' is not ready'), ready + '/' + Net.peers.length + ' ready', COLOR_NET, 150);
                    sendLobby();
                }
                else if (msg.t === 'pong') {
                    peer.ping = Math.round(performance.now() - msg.ts);
                    peer.pings = peer.pings.concat(peer.ping).slice(-PING_KEEP);
                }
            });
            sock.on('close', () => {
                clearTimeout(helloTimer);
                if (peer) peerGone(peer);
            });
            sock.on('error', () => {});
        });
        Net.server.on('error', e => banner('Network: cannot open port ' + Net.config.port, String(e.code || e), '#ff5555', 400));
        Net.server.listen(Net.config.port, () => console.log('LocalCoop_Net: host listening on ' + Net.config.port));
    }

    // ---- invitado -----------------------------------------------------------------------

    function startJoin() {
        const tryConnect = () => {
            Net.reconnectTimer = null;
            if (Net.role !== 'join') return;
            const sock = netlib.connect(Net.config.port, Net.config.host);
            Net.sock = sock;
            sock.on('connect', () => {
                Net.connected = true;
                Net.pings = [];
                Net.lobbyReady = false;
                Net.lobby = [];
                send(sock, helloMessage());
            });
            readLines(sock, msg => {
                if (msg.t === 'hi') {
                    Net.seat = msg.player;
                    Net.player = msg.player;
                    banner('Connected to the host as P' + msg.player, 'Waiting for the host to start...', COLOR_NET, 300);
                } else if (msg.t === 'full') {
                    banner('The network game is full', '', '#ffaa44', 300);
                } else if (msg.t === 'pings') {
                    Net.allPings = msg.list && typeof msg.list === 'object' ? msg.list : {};
                } else if (msg.t === 'lobby') {
                    Net.lobby = Array.isArray(msg.list) ? msg.list : [];
                    if (msg.countdown > 0) banner('Everybody is ready - starting in ' + msg.countdown + '...', lobbyText(Net.lobby), COLOR_NET, 70);
                } else if (msg.t === 'note') {
                    banner(String(msg.title || ''), String(msg.sub || ''), '#ffaa44', 300);
                } else if (msg.t === 'reject') {
                    Net.rejected = String(msg.reason || 'Rejected');
                    banner('The host did not let you in', Net.rejected, '#ff5555', 400);
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
                    Net.pings = Net.pings.concat(Net.ping).slice(-PING_KEEP);
                }
            });
            sock.on('error', () => {});
            sock.on('close', () => {
                if (Net.sock !== sock) return;
                Net.sock = null;
                Net.connected = false;
                if (Net.active) endSession('Lost the connection to the host - reconnecting...');
                if (Net.role === 'join' && !Net.rejected) Net.reconnectTimer = setTimeout(tryConnect, 3000);
            });
        };
        tryConnect();
    }

    // ---- arrancar / cambiar la configuracion --------------------------------------------

    function stopNetworking() {
        if (Net.active) endSession('Network settings changed');
        stopDiscoveryResponder();
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

    function startNetworking(role) {
        stopNetworking();
        Net.rejected = '';
        Net.role = role;
        Net.player = Net.role === 'host' ? 1 : 0;
        Net.seat = Net.player;
        if (Net.role === 'host') startHost();
        else if (Net.role === 'join') startJoin();
    }

    // ping cada segundo (lo que se ve en F10); el anfitrion suelta a quien lleva mucho sin teclas
    setInterval(() => {
        const ts = performance.now();
        if (Net.role === 'host') {
            Net.peers.forEach(pp => send(pp.sock, { t: 'ping', ts: ts }));
            // (cada invitado ve tambien el ping de los demas)
            const all = {};
            Net.peers.forEach(pp => { all[pp.player] = pp.ping; });
            Net.peers.forEach(pp => send(pp.sock, { t: 'pings', list: all }));
        } else if (Net.role === 'join' && Net.sock) {
            send(Net.sock, { t: 'ping', ts: ts });
        }
    }, PING_MS);

    coop.setNetStatus(() => {
        if (Net.role === 'off') return '';
        if (Net.role === 'host') {
            const pings = Net.peers.map(pp => 'P' + pp.player + ' ' + pp.ping + 'ms').join(' ');
            return 'NET host ' + (Net.active ? 'playing' : 'lobby') + ' [' + (pings || 'nobody') + '] delay ' + Net.delay + ' buffer ' + framesWaiting();
        }
        return 'NET P' + (Net.player || '?') + ' ' + (Net.active ? 'playing' : (Net.connected ? 'waiting' : 'connecting')) +
            ' ping ' + Net.ping + 'ms delay ' + Net.delay + ' buffer ' + framesWaiting();
    });

    // ---- ventana de opciones: Opciones > Co-op > Network game... -------------------------

    // (la fila de los NPC solo si el plugin de Fear & Hunger la pone)
    const NET_ROWS = ['role', 'found', 'host', 'port', 'password', 'bring', 'delay', 'battles', 'pvp', 'revive', 'npcs', 'cheats', 'showPing', 'action', 'stop']
        .filter(k => (k !== 'npcs' || coop.setting('hideNpcs') !== undefined) && (k !== 'revive' || coop.setting('reviveAllowed') !== undefined) &&
            (k !== 'pvp' || coop.setting('pvp') !== undefined));
    const ACTION_ROW = NET_ROWS.indexOf('action');
    const DELAY_VALUES = ['auto'];
    for (let d = MIN_DELAY; d <= 15; d++) DELAY_VALUES.push(d);
    const ROLE_LABELS = { host: 'Host (I am P1)', join: 'Join a host' };

    function Window_CoopNet() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopNet.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopNet.prototype.constructor = Window_CoopNet;

    Window_CoopNet.prototype.initialize = function(x, y, w, h) {
        this._cfg = Object.assign({}, Net.config);
        this._editing = null;  // fila que se esta escribiendo ('host' / 'port')
        this._text = '';
        this._stateKey = '';
        Window_Selectable.prototype.initialize.call(this, x, y, w, h);
        this._onKey = this.onKey.bind(this);
        window.addEventListener('keydown', this._onKey, true);
        this._foundIndex = 0;
        this._searchTimer = 0;
        const joinNow = Net.openAs === 'join' && Net.role === 'off';
        Net.openAs = null;
        if (joinNow) this._cfg.role = 'join';
        this.refresh();
        this.select(joinNow ? NET_ROWS.indexOf('found') : (Net.role === 'off' ? 0 : ACTION_ROW));
        this.activate();
    };

    // En la partida en red el menu de P1 (y este) se ejecuta en todos los PC: lo que toca la red o
    // la configuracion de este PC solo lo hace el PC del jugador que tiene el menu
    function isMyMenu() {
        return !inSub || coop.menuOwner() === Net.player;
    }

    // la partida encontrada que esta elegida (y su IP / puerto pasan a ser los del anfitrion)
    Window_CoopNet.prototype.pickFound = function(step) {
        const list = Net.found;
        if (list.length === 0) {
            SoundManager.playBuzzer();
            return;
        }
        this._foundIndex = (this._foundIndex + step + list.length) % list.length;
        const f = list[this._foundIndex];
        this._cfg.host = f.address;
        this._cfg.port = f.port;
        SoundManager.playCursor();
        this.refresh();
    };

    Window_CoopNet.prototype.maxItems = function() {
        return NET_ROWS.length;
    };

    // lo que hace la fila de accion segun el estado de la red
    Window_CoopNet.prototype.actionInfo = function() {
        if (Net.role === 'off') {
            return this._cfg.role === 'host' ? { text: 'Open the game for other players', on: true } : { text: 'Connect to the host', on: true };
        }
        if (Net.role === 'host') {
            if (Net.active) return { text: 'Playing (P' + Net.players.join(', P') + ')', on: false };
            if (Net.peers.length === 0) return { text: 'Waiting for players to connect...', on: false };
            if (!gameLoaded()) return { text: 'Load your game first, then start', on: false };
            const ready = Net.peers.filter(pp => pp.lobbyReady).length;
            return { text: 'Start now (' + ready + '/' + Net.peers.length + ' ready - starts by itself when all are)', on: true };
        }
        if (Net.active) return { text: 'Playing as P' + Net.player, on: false };
        if (Net.rejected) return { text: 'Not let in: ' + Net.rejected, on: false };
        if (Net.connected && Net.player) return { text: Net.lobbyReady ? 'Ready! (OK: not ready)' : "I'm ready", on: true };
        return { text: 'Connecting to ' + Net.config.host + '...', on: false };
    };

    Window_CoopNet.prototype.rowValue = function(key) {
        if (key === 'role') return Net.role === 'off' ? '< ' + ROLE_LABELS[this._cfg.role] + ' >' : ROLE_LABELS[Net.role];
        if (key === 'host') return this._editing === 'host' ? this._text + '_' : (this._cfg.role === 'join' ? this._cfg.host : '-');
        if (key === 'found') {
            if (this._cfg.role !== 'join') return '-';
            if (!dgram) return '(not available here)';
            const list = Net.found;
            if (list.length === 0) return Net.searching ? 'Searching...' : 'None found  (OK: search again)';
            const f = list[Math.min(this._foundIndex, list.length - 1)];
            const game = String(f.game || '').replace(/^Fear & Hunger 2: /i, '');
            return '< ' + f.name + ' - ' + game + ' (' + f.players + '/4' + (f.pw ? ', password' : '') + ')  ' + f.address + ' >' +
                (list.length > 1 ? '  ' + (this._foundIndex + 1) + '/' + list.length : '');
        }
        if (key === 'port') return this._editing === 'port' ? this._text + '_' : String(this._cfg.port);
        if (key === 'password') {
            if (this._editing === 'password') return this._text + '_';
            return this._cfg.password ? '*'.repeat(this._cfg.password.length) : '(none)';
        }
        if (key === 'bring') {
            if (this._cfg.role !== 'join') return '-';
            const hero = savedHero(this._cfg.bring);
            return '< ' + (hero ? 'Slot ' + this._cfg.bring + ': ' + hero.name + ' (Lv ' + hero.level + ')' : 'None (a companion)') + ' >';
        }
        if (key === 'showPing') return '< ' + (this._cfg.showPing ? 'On' : 'Off') + ' >';
        if (key === 'pvp') {
            const m = coop.setting('pvp');
            return (Net.role === 'join' && !Net.active) ? "(the host's)" : '< ' + (m === 'death' ? 'On - to the death' : m === 'duel' ? 'On - not to the death' : 'Off') + ' >';
        }
        if (key === 'revive') {
            return (Net.role === 'join' && !Net.active) ? "(the host's)" : '< ' + (coop.setting('reviveAllowed') === false ? 'Off (death is for good)' : 'On') + ' >';
        }
        if (key === 'npcs') {
            return (Net.role === 'join' && !Net.active) ? "(the host's)" : '< ' + (coop.setting('hideNpcs') === false ? 'Shown' : 'Hidden') + ' >';
        }
        if (key === 'cheats') {
            const on = coop.setting('cheats') !== false;
            const list = [['cheatGod', 'immortal'], ['cheatLimbs', 'limbs'], ['cheatOneShot', 'one-hit']]
                .filter(c => coop.setting(c[0])).map(c => c[1]);
            return (Net.role === 'join' && !Net.active) ? "(the host's)" : '< ' + (on ? 'On' : 'Off') + ' >' +
                (on && list.length ? '  ' + list.join(', ') : (on ? '  (more in Co-op settings)' : ''));
        }
        if (key === 'battles') {
            const label = this._cfg.battles === 'separate' ? 'Separate (experimental)' : 'Together';
            return Net.role === 'join' ? "(the host's)" : '< ' + label + ' >';
        }
        if (key === 'delay') {
            const now = Net.active ? '  (now ' + Net.delay + ')' : '';
            return '< ' + (this._cfg.delay === 'auto' ? 'Auto (by ping)' : this._cfg.delay + ' frames') + ' >' + now;
        }
        if (key === 'action') return this.actionInfo().text;
        if (Net.role === 'host') return 'Close the game (stop hosting)';
        if (Net.role === 'join') return 'Disconnect';
        return '';
    };

    Window_CoopNet.prototype.isRowEnabled = function(key) {
        if (key === 'action') return this.actionInfo().on;
        if (key === 'stop') return Net.role !== 'off';
        if (key === 'host') return Net.role === 'off' && this._cfg.role === 'join';
        if (key === 'delay') return true; // se puede cambiar jugando (solo afecta a este PC)
        if (key === 'showPing') return true;
        // (jugando, este menu es el de P1 y va igual en todos los PC: el cambio llega a todos)
        if (key === 'cheats' || key === 'npcs' || key === 'revive' || key === 'pvp') return Net.active || Net.role !== 'join';
        if (key === 'battles') return !Net.active && Net.role !== 'join'; // lo decide el anfitrion al empezar
        if (key === 'bring') return Net.role === 'off' && this._cfg.role === 'join';
        if (key === 'found') return Net.role === 'off' && this._cfg.role === 'join' && !!dgram;
        return Net.role === 'off';
    };

    Window_CoopNet.prototype.drawItem = function(index) {
        const key = NET_ROWS[index];
        const rect = this.itemRect(index);
        const names = { role: 'Mode', found: 'Games found', host: "Host's IP", port: 'Port', password: 'Password', bring: 'Bring character', delay: 'Input delay', battles: 'Battles', pvp: 'PvP (Termina)', revive: 'Revive (soul stones)', npcs: "Played chars' NPCs", cheats: 'Cheats', showPing: 'Ping on screen', action: '', stop: '' };
        const wide = key === 'action' || key === 'stop';
        this.resetTextColor();
        this.changePaintOpacity(this.isRowEnabled(key));
        if (!wide) this.drawText(names[key], rect.x + 8, rect.y, rect.width / 3, 'left');
        if (key === 'action') this.changeTextColor(COLOR_NET);
        if (wide) this.drawText(this.rowValue(key), rect.x + 8, rect.y, rect.width - 16, 'center');
        else this.drawText(this.rowValue(key), rect.x + rect.width / 3, rect.y, rect.width * 2 / 3 - 8, 'right');
        this.changePaintOpacity(true);
        this.resetTextColor();
    };

    // se vuelve a dibujar si cambia el estado de la red (alguien se conecta, etc.)
    Window_CoopNet.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        if (Net.role === 'off' && this._cfg.role === 'join' && dgram && --this._searchTimer <= 0) {
            this._searchTimer = 240; // cada 4 s
            searchGames();
        }
        const key = NET_ROWS.map(k => this.rowValue(k) + this.isRowEnabled(k)).join('|');
        if (key !== this._stateKey) {
            this._stateKey = key;
            this.refresh();
        }
    };

    Window_CoopNet.prototype.changeRole = function() {
        if (Net.role !== 'off') {
            SoundManager.playBuzzer();
            return;
        }
        this._cfg.role = this._cfg.role === 'host' ? 'join' : 'host';
        SoundManager.playCursor();
        this.refresh();
    };

    // espera de las teclas: Auto o un numero fijo de cuadros (se guarda y vale enseguida)
    Window_CoopNet.prototype.changeDelay = function(step) {
        const i = DELAY_VALUES.indexOf(this._cfg.delay);
        this._cfg.delay = DELAY_VALUES[(i + step + DELAY_VALUES.length) % DELAY_VALUES.length];
        if (isMyMenu()) {
            Net.config.delay = this._cfg.delay;
            writeConfig(Object.assign({}, Net.config));
        }
        SoundManager.playCursor();
        this.refresh();
    };

    Window_CoopNet.prototype.cursorRight = function() {
        if (this._editing) return;
        if (NET_ROWS[this.index()] === 'role') this.changeRole();
        if (NET_ROWS[this.index()] === 'delay') this.changeDelay(1);
        if (NET_ROWS[this.index()] === 'battles') this.changeBattles();
        if (NET_ROWS[this.index()] === 'bring') this.changeBring(1);
        if (NET_ROWS[this.index()] === 'found') this.pickFound(1);
        if (NET_ROWS[this.index()] === 'showPing') this.changeShowPing();
        if (NET_ROWS[this.index()] === 'cheats') this.changeCheats();
        if (NET_ROWS[this.index()] === 'npcs') this.changeNpcs();
        if (NET_ROWS[this.index()] === 'revive') this.changeRevive();
        if (NET_ROWS[this.index()] === 'pvp') this.changePvp(1);
    };

    Window_CoopNet.prototype.cursorLeft = function() {
        if (this._editing) return;
        if (NET_ROWS[this.index()] === 'role') this.changeRole();
        if (NET_ROWS[this.index()] === 'delay') this.changeDelay(-1);
        if (NET_ROWS[this.index()] === 'battles') this.changeBattles();
        if (NET_ROWS[this.index()] === 'bring') this.changeBring(-1);
        if (NET_ROWS[this.index()] === 'found') this.pickFound(-1);
        if (NET_ROWS[this.index()] === 'showPing') this.changeShowPing();
        if (NET_ROWS[this.index()] === 'cheats') this.changeCheats();
        if (NET_ROWS[this.index()] === 'npcs') this.changeNpcs();
        if (NET_ROWS[this.index()] === 'revive') this.changeRevive();
        if (NET_ROWS[this.index()] === 'pvp') this.changePvp(-1);
    };

    // traer el protagonista de una de mis partidas guardadas (o nada: un companero del anfitrion)
    Window_CoopNet.prototype.changeBring = function(step) {
        if (!this.isRowEnabled('bring')) {
            SoundManager.playBuzzer();
            return;
        }
        const options = [0].concat(savedSlots().filter(slot => !!savedHero(slot)));
        const i = Math.max(0, options.indexOf(this._cfg.bring));
        this._cfg.bring = options[(i + step + options.length) % options.length];
        SoundManager.playCursor();
        this.refresh();
    };

    // combates juntos (como siempre) o aparte (solo los que toca el enemigo)
    Window_CoopNet.prototype.changePvp = function(dir) {
        if (!this.isRowEnabled('pvp')) {
            SoundManager.playBuzzer();
            return;
        }
        const modes = ['off', 'duel', 'death'];
        const i = Math.max(0, modes.indexOf(coop.setting('pvp') || 'off'));
        coop.setSetting('pvp', modes[(i + dir + modes.length) % modes.length]);
        SoundManager.playCursor();
        if (Net.active && Net.role === 'host') {
            const m = coop.setting('pvp');
            banner('PvP: ' + (m === 'death' ? 'on - to the death' : m === 'duel' ? 'on - not to the death' : 'off'), 'For everybody', COLOR_NET, 150);
        }
        this.refresh();
    };

    Window_CoopNet.prototype.changeRevive = function() {
        if (!this.isRowEnabled('revive')) {
            SoundManager.playBuzzer();
            return;
        }
        coop.setSetting('reviveAllowed', coop.setting('reviveAllowed') === false);
        SoundManager.playCursor();
        if (Net.active && Net.role === 'host') {
            banner('Revive with soul stones: ' + (coop.setting('reviveAllowed') === false ? 'off - death is for good' : 'on'), 'For everybody', COLOR_NET, 150);
        }
        this.refresh();
    };

    // (como los trucos: es un ajuste del co-op; jugando, este menu va igual en todos los PC)
    Window_CoopNet.prototype.changeNpcs = function() {
        if (!this.isRowEnabled('npcs')) {
            SoundManager.playBuzzer();
            return;
        }
        coop.setSetting('hideNpcs', coop.setting('hideNpcs') === false);
        SoundManager.playCursor();
        if (Net.active && Net.role === 'host') {
            banner("Played characters' NPCs: " + (coop.setting('hideNpcs') === false ? 'shown' : 'hidden'), 'For everybody', COLOR_NET, 120);
        }
        this.refresh();
    };

    Window_CoopNet.prototype.changeCheats = function() {
        if (!this.isRowEnabled('cheats')) {
            SoundManager.playBuzzer();
            return;
        }
        coop.setSetting('cheats', coop.setting('cheats') === false);
        SoundManager.playCursor();
        if (Net.active && Net.role === 'host') banner('Cheats ' + (coop.setting('cheats') !== false ? 'on' : 'off'), 'For everybody', COLOR_NET, 120);
        this.refresh();
    };

    Window_CoopNet.prototype.changeShowPing = function() {
        this._cfg.showPing = !this._cfg.showPing;
        if (isMyMenu()) {
            Net.config.showPing = this._cfg.showPing;
            writeConfig(Object.assign({}, Net.config));
        }
        SoundManager.playCursor();
        this.refresh();
    };

    Window_CoopNet.prototype.changeBattles = function() {
        if (!this.isRowEnabled('battles')) {
            SoundManager.playBuzzer();
            return;
        }
        this._cfg.battles = this._cfg.battles === 'separate' ? 'together' : 'separate';
        Net.config.battles = this._cfg.battles;
        writeConfig(Object.assign({}, Net.config));
        SoundManager.playCursor();
        this.refresh();
    };

    // OK lo procesa la propia ventana (la escena no le da un manejador 'ok')
    Window_CoopNet.prototype.isOkEnabled = function() {
        return true;
    };

    Window_CoopNet.prototype.processOk = function() {
        if (this._editing) return;
        const key = NET_ROWS[this.index()];
        if (!this.isRowEnabled(key)) {
            SoundManager.playBuzzer();
            return;
        }
        if (key === 'role') {
            this.changeRole();
        } else if (key === 'delay') {
            this.changeDelay(1);
        } else if (key === 'battles') {
            this.changeBattles();
        } else if (key === 'showPing') {
            this.changeShowPing();
        } else if (key === 'cheats') {
            this.changeCheats();
        } else if (key === 'npcs') {
            this.changeNpcs();
        } else if (key === 'revive') {
            this.changeRevive();
        } else if (key === 'pvp') {
            this.changePvp(1);
        } else if (key === 'bring') {
            this.changeBring(1);
        } else if (key === 'found') {
            SoundManager.playOk();
            this._searchTimer = 0; // buscar otra vez ya
            if (Net.found.length > 0) this.pickFound(0);
        } else if (key === 'host' || key === 'port' || key === 'password') {
            this._editing = key;
            this._text = '';
            SoundManager.playOk();
            this.refresh();
        } else if (key === 'action' && Net.role === 'off') {
            Net.config = Object.assign({}, this._cfg);
            writeConfig(Net.config);
            startNetworking(Net.config.role);
            SoundManager.playOk();
            this.select(ACTION_ROW);
        } else if (key === 'action' && Net.role === 'join') {
            // invitado en el lobby: listo / no listo
            Net.lobbyReady = !Net.lobbyReady;
            send(Net.sock, { t: 'ready', on: Net.lobbyReady });
            SoundManager.playOk();
        } else if (key === 'action') {
            SoundManager.playOk();
            if (isMyMenu()) Net.startRequested = true; // se empieza fuera de la escena (cierra este menu)
        } else if (key === 'stop') {
            if (isMyMenu()) Net.stopRequested = true; // (puede estar dentro del menu de la partida en red)
            SoundManager.playCancel();
            this.select(0);
        }
        this.refresh();
    };

    // escribir la IP (o un nombre, p.ej. de DDNS) o el puerto: cifras, letras, punto, guion y
    // retroceso; Enter acepta, Esc cancela
    Window_CoopNet.prototype.onKey = function(e) {
        if (!this._editing) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const k = e.keyCode;
        if (k >= 48 && k <= 57) this._text += String(k - 48);
        else if (k >= 96 && k <= 105) this._text += String(k - 96);
        else if ((k === 190 || k === 110) && this._editing === 'host') this._text += '.';
        else if (k >= 65 && k <= 90 && this._editing !== 'port') this._text += String.fromCharCode(k).toLowerCase();
        else if ((k === 189 || k === 109) && this._editing !== 'port') this._text += '-';
        else if (k === 8) this._text = this._text.slice(0, -1);
        else if (k === 13) {
            if (this._editing === 'host' && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(this._text)) this._cfg.host = this._text;
            if (this._editing === 'port' && Number(this._text) > 0 && Number(this._text) < 65536) this._cfg.port = Number(this._text);
            if (this._editing === 'password') this._cfg.password = this._text.slice(0, 24); // vacio = sin contrasena
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
        lines.forEach((line, i) => this.drawTextEx(line, 0, i * 30));
    };

    Window_CoopNetHelp.prototype.standardFontSize = function() {
        return 20;
    };

    Window_CoopNetHelp.prototype.lines = function() {
        const cfg = Net.config;
        if (Net.role === 'host') {
            return ['You are the host (P1). Your IP: ' + (localAddresses().join(', ') || '?') + '  port ' + cfg.port,
                Net.peers.length ? 'Lobby: ' + lobbyText(lobbyList(), true) : 'Connected: nobody yet',
                Net.active ? 'Players can join or come back during the game.' :
                    (Net.peers.length ? 'Starts by itself when everybody is ready.' : 'LAN: tell them this IP. Internet: VPN IP or public IP (docs/NETPLAY.md).')];
        }
        if (Net.role === 'join') {
            return ['Joining ' + cfg.host + ':' + cfg.port + ' - ' + (Net.connected ? 'connected as P' + (Net.player || '?') : 'connecting...'),
                Net.active ? 'In the network game as P' + Net.player + '.' : (Net.lobby.length ? 'Lobby: ' + lobbyText(Net.lobby, true) : 'The host starts the game; you will see their world.'),
                Net.active ? '' : 'Press "I\'m ready" - the game starts when everybody is.'];
        }
        return ['Play over the network, each player on their own PC.',
            'Host: load your game and open it.  Join: type the host\'s IP and connect.',
            'Left / Right changes the mode, OK on a line to change it.'];
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
        this._netList = new Window_CoopNet(0, helpH, w, Math.min(NET_ROWS.length * 36 + 36, Graphics.boxHeight - helpH));
        this._netList.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._netList);
    };

    Scene_CoopNet.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        this._netList.stopListening();
    };

    window.Scene_CoopNet = Scene_CoopNet;

    // ---- ping de cada jugador en la esquina de arriba a la derecha (mapa y combate) -----------
    // Solo se dibuja en este PC: no toca la partida.
    function Sprite_CoopPings() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CoopPings.prototype = Object.create(Sprite.prototype);
    Sprite_CoopPings.prototype.constructor = Sprite_CoopPings;

    Sprite_CoopPings.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this, new Bitmap(320, 24));
        this.x = Graphics.width - 324;
        this.y = 4;
        this._key = null;
    };

    Sprite_CoopPings.prototype.update = function() {
        Sprite.prototype.update.call(this);
        const show = Net.config.showPing && Net.role !== 'off' && (Net.role === 'host' ? Net.peers.length > 0 : Net.connected);
        const pings = show ? playerPings() : {};
        const list = Object.keys(pings).map(Number).sort((a, b) => a - b);
        const key = list.map(n => n + ':' + pings[n]).join(',');
        if (key === this._key) return;
        this._key = key;
        const b = this.bitmap;
        b.clear();
        if (!list.length) return;
        b.fontSize = 16;
        b.outlineWidth = 3;
        const colors = { 3: '#66ee66', 6: '#eedd44', 2: '#ff6655' };
        let x = b.width;
        list.slice().reverse().forEach(n => {
            const text = 'P' + n + ' ' + pings[n] + 'ms';
            const w = b.measureTextWidth(text) + 12;
            x -= w;
            b.textColor = colors[pingColor(pings[n])];
            b.drawText(text, x, 0, w, 24, 'right');
        });
    };

    const _Scene_Base_update_pings = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update_pings.call(this);
        if (!(this instanceof Scene_Map || this instanceof Scene_Battle || this instanceof Scene_CoopNet)) return;
        if (!this._coopPings) {
            this._coopPings = new Sprite_CoopPings();
            this.addChild(this._coopPings);
        } else if (this.children[this.children.length - 1] !== this._coopPings) {
            this.addChild(this._coopPings); // siempre por encima de todo
        }
    };

    // ---- atajos: "Host online" / "Join online" en el titulo y "Online" en el menu de P1 -------
    // Host online: elegir partida, y al cargarla la partida queda abierta para los demas.
    // Join online: el menu de red ya en modo "unirse", en la lista de partidas encontradas.

    const _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function() {
        _Window_TitleCommand_makeCommandList.call(this);
        const cmds = [
            { name: 'Host online', symbol: 'coopHost', enabled: DataManager.isAnySavefileExists(), ext: null },
            { name: 'Join online', symbol: 'coopJoin', enabled: true, ext: null }
        ];
        const at = this._list.findIndex(c => c.symbol === 'options');
        if (at >= 0) this._list.splice.apply(this._list, [at, 0].concat(cmds));
        else this._list = this._list.concat(cmds);
    };

    const _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _Scene_Title_createCommandWindow.call(this);
        this._commandWindow.setHandler('coopHost', () => {
            Net.hostAfterLoad = true;
            this._commandWindow.close();
            SceneManager.push(Scene_Load);
        });
        this._commandWindow.setHandler('coopJoin', () => {
            Net.openAs = 'join';
            this._commandWindow.close();
            SceneManager.push(Scene_CoopNet);
        });
    };

    // de vuelta en el titulo (Cargar cancelado): ya no se abre la partida al cargar
    const _Scene_Title_start = Scene_Title.prototype.start;
    Scene_Title.prototype.start = function() {
        _Scene_Title_start.call(this);
        Net.hostAfterLoad = false;
        const load = Net.loadAfterTitle;
        Net.loadAfterTitle = null;
        if (!load || Net.role !== 'host') return;
        Net.restartAfterLoad = true;
        if (load === 'screen') {
            SceneManager.push(Scene_Load);
        } else if (DataManager.loadGame(load)) {
            SoundManager.playLoad();
            $gameSystem.onAfterLoad();
            SceneManager.goto(Scene_Map);
        } else {
            Net.restartAfterLoad = false;
            SoundManager.playBuzzer();
        }
    };

    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (Net.restartAfterLoad && Net.role === 'host' && !Net.active) {
            Net.restartAfterLoad = false;
            Net.startRequested = true; // los invitados siguen conectados: reciben el mundo cargado
            return;
        }
        if (!Net.hostAfterLoad) return;
        Net.hostAfterLoad = false;
        if (Net.role !== 'host') {
            Net.config.role = 'host';
            writeConfig(Object.assign({}, Net.config));
            startNetworking('host');
        }
        banner('Online game open  -  your IP: ' + (localAddresses().join(', ') || '?'),
            'Friends: Join online. When they are in: Menu > Online > Start', COLOR_NET, 420);
    };

    // "Online" en el menu de P1 (antes de Opciones / Salir): el menu de red
    const _Window_MenuCommand_makeCommandList2 = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function() {
        _Window_MenuCommand_makeCommandList2.call(this);
        if (coop.menuOwner() >= 2 || this._list.some(c => c.symbol === 'coopOnline')) return;
        const command = { name: 'Online', symbol: 'coopOnline', enabled: true, ext: null };
        const at = this._list.findIndex(c => c.symbol === 'options' || c.symbol === 'gameEnd');
        if (at >= 0) this._list.splice(at, 0, command);
        else this._list.push(command);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('coopOnline', () => SceneManager.push(Scene_CoopNet));
    };

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

    // para pruebas y otros plugins: CoopNet.open('host' / 'join'), CoopNet.close()
    Net.open = startNetworking;
    Net.menus = subs;
    Net.battle = () => battles[0] || null;
    Net.battles = () => battles;
    Net.withBattle = withBattle; // (para pruebas: mirar un combate como si fuera la escena actual)
    Net.isAutorunRoot = isAutorunRoot; // (para pruebas)
    Net.close = stopNetworking;
    window.CoopNet = Net;
})();
