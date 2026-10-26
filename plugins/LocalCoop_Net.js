/*:
 * @target MV
 * @plugindesc v0.2 [PROTOTIPO] Co-op en red local: cada jugador en su PC con su copia del juego (lockstep). Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @help
 * PROTOTIPO. Todo se hace en Opciones > Co-op > Network game...: el anfitrion abre la
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
    const PEER_TIMEOUT = 5000;  // ms sin teclas de un invitado: se le da por desconectado
    const COLOR_NET = '#7fb3ff';

    // ---- configuracion (www/coop_net.json) --------------------------------------

    const baseDir = path.dirname(process.mainModule.filename);
    const configFile = path.join(baseDir, 'coop_net.json');

    function readConfig() {
        const off = { role: 'host', host: '127.0.0.1', port: DEFAULT_PORT };
        try {
            if (!fs.existsSync(configFile)) return off;
            const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            return {
                role: cfg.role === 'join' ? 'join' : 'host',
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
        player: 0,              // jugador de este PC (1 = anfitrion)
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
        blockedSince: 0,        // desde cuando se espera la tecla de algun invitado
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

    function sendInput(f, bits) {
        if (Net.role === 'host') hostStoreInput(f, 1, bits, myReadySeq());
        else send(Net.sock, { t: 'in', f: f, b: bits, rs: myReadySeq() });
    }

    function applyActions(all) {
        for (const p of Net.players) {
            const prev = Net.applied[p] || 0;
            const raw = all[p] || 0;
            Net.raw[p] = raw;
            // con su menu abierto, sus teclas son del menu; al cerrarlo, las que siguen pulsadas
            // no cuentan en el mapa hasta soltarlas (si no, Cancelar volveria a abrir el menu)
            Net.mask[p] = (Net.mask[p] || 0) & raw;
            const cur = subs[p] ? 0 : (raw & ~Net.mask[p]);
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
                closeSub(ev.n);
                coop.setAway(ev.n, true); // si es en un combate, hasta el final lo lleva la IA
                Net.left[ev.n] = true;
                banner('P' + ev.n + ' disconnected', 'Their character follows the party until they come back', '#ffaa44', 240);
            }
        });
    }

    // quien se fue vuelve a ser un seguidor normal en cuanto se esta en el mapa
    function processLeft() {
        Object.keys(Net.left).map(Number).forEach(n => {
            if (!coop.player(n)) delete Net.left[n];
            else if (SceneManager._sceneStarted && !SceneManager._nextScene && coop.removePlayer(n)) delete Net.left[n];
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
            Object.keys(subs).length === 0 && Object.keys(Net.left).length === 0;
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
            processLeft();
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
        if (Net.stopRequested) {
            Net.stopRequested = false;
            stopNetworking();
        }
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
        if (Net.active && !inSub && sceneClass) {
            if (closesMenus(sceneClass)) closeAllSubs();
            Net.sceneSeq++;
        }
        _SceneManager_goto.call(this, sceneClass);
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
            bmp.drawText('P' + owner + ' is in their menu...', 0, 0, Graphics.width, 64, 'center');
        }
        if (this._netMenuNote) this._netMenuNote.visible = hide;
    };

    // el raton de un PC no debe mover a nadie en los demas
    const _TouchInput_update = TouchInput.update;
    TouchInput.update = function() {
        _TouchInput_update.call(this);
        if (Net.active) this.clear();
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
        const cur = stateOf(bits);
        Input._currentState = cur;
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
        const sub = { scene: next, stack: stack, menuActor: $gameParty._menuActorId, targetActor: $gameParty._targetActorId,
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
        if (Net.active && !inSub) updateSubs();
        _Scene_Map_update.call(this);
    };

    // en un combate (o fin de partida) los menus se cierran
    function closesMenus(sceneClass) {
        return sceneClass === Scene_Battle || sceneClass === Scene_Gameover || sceneClass === Scene_Title;
    }

    // el personaje de quien esta en su menu no se mueve ni interactua
    coop.setBusy(n => Net.active && !!subs[n]);

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
        const sub = Net.active && subs[Net.player];
        if (!sub || !(this._scene instanceof Scene_Map) || !this._sceneStarted) {
            _SceneManager_renderScene.call(this);
            return;
        }
        Graphics.render(sub.scene);
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
            Object.keys(subs).map(n => ' P' + n + ' ' + subs[n].scene.constructor.name).join('');
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
        closeAllSubs();
        Net.applied = {};
        Net.raw = {};
        Net.mask = {};
        Net.left = {};
        Net.history = {};
        Object.keys(Net.frames).forEach(f => { if (Number(f) < meta.f) delete Net.frames[f]; });
        closeSceneNow();
        DataManager.createGameObjects();
        DataManager.extractSaveContents(JsonEx.parse(saveJson));
        $gameSystem.onAfterLoad(); // musica de la partida (si sigue siendo la misma, no se corta)
        applySharedConfig(meta.config);
        coop.clearInputs();
        // vuelven todos menos quien sigue fuera (su personaje va en la fila)
        coop.forceRestore(meta.players.filter(p => p !== 1 && (meta.gone || []).indexOf(p) < 0));
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
        closeAllSubs();
        Net.active = false;
        if (Net.localConfig) ConfigManager.applyData(Net.localConfig);
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
            const missing = Net.players.filter(p => !Net.lost[p] && got[p] === undefined);
            if (missing.length > 0) {
                // el anfitrion ya tiene su tecla y espera a otros: se cuenta cuanto tiempo
                if (got[1] !== undefined && !Net.blockedSince) Net.blockedSince = performance.now();
                Net.blockedOn = missing;
                return;
            }
            Net.blockedSince = 0;
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
        Net.blockedSince = 0;
        $gameSystem.onBeforeSave();
        const meta = {
            f: Net.frame,
            first: !!first,
            rng: first ? ((nativeRandom() * 4294967296) | 0) : rngState,
            players: Net.players.slice(),
            frameBase: first ? $gameSystem._framesOnSave : Net.frameBase,
            timeBase: first ? NativeDate.now() : Net.timeBase,
            sceneSeq: Net.sceneSeq,
            extras: first ? [] : coop.players().map(p => ({ n: p.coopIndex(), actor: p._coopActorId, x: p._x, y: p._y, d: p._direction }))
                // quien vuelve tras irse: su personaje de antes, junto a P1
                .concat(back.filter(n => !coop.player(n)).map(n => ({ n: n, actor: coop.lastActor(n), x: $gamePlayer.x, y: $gamePlayer.y, d: $gamePlayer.direction() }))),
            away: first ? [] : coop.awayPlayers(),
            gone: Object.keys(Net.lost).map(Number),
            back: back,
            reason: reason,
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
        Net.player = 1;
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
                banner('P' + player + ' connected', peer.address + '  -  Options > Co-op > Network game to start', COLOR_NET, 240);
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
                    banner('Connected to the host as P' + msg.player, 'Waiting for the host to start...', COLOR_NET, 300);
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

    function startNetworking(role) {
        stopNetworking();
        Net.role = role;
        Net.player = Net.role === 'host' ? 1 : 0;
        if (Net.role === 'host') startHost();
        else if (Net.role === 'join') startJoin();
    }

    // ping cada segundo (lo que se ve en F10); el anfitrion suelta a quien lleva mucho sin teclas
    setInterval(() => {
        const ts = performance.now();
        if (Net.role === 'host') {
            Net.peers.forEach(pp => send(pp.sock, { t: 'ping', ts: ts }));
            if (Net.active && Net.blockedSince && ts - Net.blockedSince > PEER_TIMEOUT) {
                Net.blockedSince = 0;
                Net.peers.filter(pp => pp.inSession && Net.blockedOn.indexOf(pp.player) >= 0).forEach(pp => {
                    logError('P' + pp.player + ' sent nothing for ' + PEER_TIMEOUT + ' ms: dropped', '');
                    pp.sock.destroy();
                });
            }
        } else if (Net.role === 'join' && Net.sock) {
            send(Net.sock, { t: 'ping', ts: ts });
        }
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

    // ---- ventana de opciones: Opciones > Co-op > Network game... -------------------------

    const NET_ROWS = ['role', 'host', 'port', 'action', 'stop'];
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
        this.refresh();
        this.select(Net.role === 'off' ? 0 : 3);
        this.activate();
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
            return { text: 'Start the network game (P' + [1].concat(Net.peers.map(pp => pp.player)).join(', P') + ')', on: true };
        }
        if (Net.active) return { text: 'Playing as P' + Net.player, on: false };
        return { text: Net.connected ? 'Connected as P' + (Net.player || '?') + ' - waiting for the host' : 'Connecting to ' + Net.config.host + '...', on: false };
    };

    Window_CoopNet.prototype.rowValue = function(key) {
        if (key === 'role') return Net.role === 'off' ? '< ' + ROLE_LABELS[this._cfg.role] + ' >' : ROLE_LABELS[Net.role];
        if (key === 'host') return this._editing === 'host' ? this._text + '_' : (this._cfg.role === 'join' ? this._cfg.host : '-');
        if (key === 'port') return this._editing === 'port' ? this._text + '_' : String(this._cfg.port);
        if (key === 'action') return this.actionInfo().text;
        if (Net.role === 'host') return 'Close the game (stop hosting)';
        if (Net.role === 'join') return 'Disconnect';
        return '';
    };

    Window_CoopNet.prototype.isRowEnabled = function(key) {
        if (key === 'action') return this.actionInfo().on;
        if (key === 'stop') return Net.role !== 'off';
        if (key === 'host') return Net.role === 'off' && this._cfg.role === 'join';
        return Net.role === 'off';
    };

    Window_CoopNet.prototype.drawItem = function(index) {
        const key = NET_ROWS[index];
        const rect = this.itemRect(index);
        const names = { role: 'Mode', host: "Host's IP", port: 'Port', action: '', stop: '' };
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

    Window_CoopNet.prototype.cursorRight = function() {
        if (!this._editing && NET_ROWS[this.index()] === 'role') this.changeRole();
    };

    Window_CoopNet.prototype.cursorLeft = function() {
        if (!this._editing && NET_ROWS[this.index()] === 'role') this.changeRole();
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
        } else if (key === 'host' || key === 'port') {
            this._editing = key;
            this._text = '';
            SoundManager.playOk();
            this.refresh();
        } else if (key === 'action' && Net.role === 'off') {
            Net.config = Object.assign({}, this._cfg);
            writeConfig(Net.config);
            startNetworking(Net.config.role);
            SoundManager.playOk();
            this.select(3);
        } else if (key === 'action') {
            SoundManager.playOk();
            Net.startRequested = true; // se empieza fuera de la escena (cierra este menu)
        } else if (key === 'stop') {
            Net.stopRequested = true; // (puede estar dentro del menu de la partida en red)
            SoundManager.playCancel();
            this.select(0);
        }
        this.refresh();
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
        if (Net.role === 'host') {
            return ['You are the host (P1). Your IP: ' + (localAddresses().join(', ') || '?') + '  port ' + cfg.port,
                'Connected: ' + (Net.peers.map(pp => 'P' + pp.player + ' ' + pp.address).join(', ') || 'nobody yet'),
                Net.active ? 'Players can join or come back during the game.' : 'Tell the others your IP. When they are connected, start.'];
        }
        if (Net.role === 'join') {
            return ['Joining ' + cfg.host + ':' + cfg.port + ' - ' + (Net.connected ? 'connected as P' + (Net.player || '?') : 'connecting...'),
                Net.active ? 'In the network game as P' + Net.player + '.' : 'The host starts the game; you will see their world.',
                'Every PC needs its own copy of the game (same version).'];
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

    // para pruebas y otros plugins: CoopNet.open('host' / 'join'), CoopNet.close()
    Net.open = startNetworking;
    Net.menus = subs;
    Net.close = stopNetworking;
    window.CoopNet = Net;
})();
