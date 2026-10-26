/*:
 * @target MV MZ
 * @plugindesc v1.1.0 Co-op local de hasta 4 jugadores (teclado + mandos): pantalla dividida, luz para cada jugador, turnos de batalla por jugador, selector de personaje. Pensado para Look Outside, Fear & Hunger y otros juegos de RPG Maker.
 * @author TheTiranix
 *
 * @param MaxPlayers
 * @text Maximo de jugadores
 * @desc 2 = como el mod original. 3 = hasta P3. 4 = hasta P4 (P4 solo con mando).
 * @type select
 * @option 2
 * @option 3
 * @option 4
 * @default 4
 *
 * @param P3Keys
 * @text Teclas de P3
 * @desc all = teclado numerico Y TAMBIEN I J K L. numpad = solo teclado numerico. ijkl = solo I J K L / U / O / H.
 * @type select
 * @option all
 * @option numpad
 * @option ijkl
 * @default all
 *
 * @param Gamepads
 * @text Mandos para P2/P3/P4
 * @desc true = pulsar Start en un mando une a un jugador nuevo y el mando pasa a ser suyo. false = los mandos son siempre de P1.
 * @type boolean
 * @default true
 *
 * @param AutoRejoin
 * @text Volver a unir al cargar
 * @desc true = al cargar una partida, los jugadores que estaban se unen solos. false = hay que volver a unirse.
 * @type boolean
 * @default true
 *
 * @param P2ActorMode
 * @text Modo de personaje de P2
 * @desc auto = clone en Look Outside y selector en cualquier otro juego. clone = P2 copia el aspecto de P1. select = P2 elige un personaje.
 * @type select
 * @option auto
 * @option clone
 * @option select
 * @default auto
 *
 * @param P2ActorChoices
 * @text Personajes elegibles
 * @desc IDs de actores separados por coma que P2 puede elegir (ej: 2,3,4,5). Vacio = todos los actores con nombre e imagen.
 * @type string
 * @default
 *
 * @param LightPictureNames
 * @text Imagenes de luz
 * @desc Nombres (separados por coma) de las imagenes que el juego usa como "luz del jugador" (circulo transparente sobre fondo oscuro).
 * @type string
 * @default Darkness
 *
 * @param DefaultCameraMode
 * @text Camara inicial
 * @desc auto = compartida mientras los jugadores estan cerca y pantalla dividida cuando se separan.
 * @type select
 * @option auto
 * @option shared
 * @option split
 * @option p1
 * @option p2
 * @option p3
 * @option p4
 * @default auto
 *
 * @param PlayerOnlyEvents
 * @text Eventos que siguen solo a P1
 * @desc Nombres de eventos de mapa (separados por coma) que deben ver siempre a P1 y no al jugador mas cercano: sistemas del protagonista (disparo, sangrado...).
 * @type string
 * @default arrow_check,arrow_player,backstab_check,backstab,bleeding,blood
 *
 * @param SplitDirection
 * @text Direccion de la pantalla dividida
 * @desc vertical = una pantalla a cada lado (con 3: P1 a la izquierda, P2/P3 a la derecha). horizontal = una arriba y otra abajo (con 3: P1 arriba, P2/P3 abajo).
 * @type select
 * @option vertical
 * @option horizontal
 * @default vertical
 *
 * @param Split3Layout
 * @text Pantalla dividida con 3 jugadores
 * @desc triangle = 3 vistas iguales (dos arriba, una abajo en el centro). grid = 2x2 con un panel del grupo (PV/PM) en el cuarto hueco. big = P1 media pantalla y P2/P3 un cuarto cada uno.
 * @type select
 * @option triangle
 * @option grid
 * @option big
 * @default triangle
 *
 * @param SplitZoom
 * @text Distancia de la camara en pantalla dividida
 * @desc far = cada vista ve tanto mapa como la pantalla entera (personajes mas pequenos). near = sin alejar (como antes). Se cambia en el juego con - y =.
 * @type select
 * @option far
 * @option medium
 * @option near
 * @default far
 *
 * @param P2MoveSpeed
 * @text Velocidad de P2/P3
 * @desc 0 = P2/P3 copian la velocidad actual de P1 (recomendado: heredan sprints/ralentizaciones del juego). 1-6 = velocidad fija.
 * @type number
 * @min 0
 * @max 6
 * @default 0
 *
 * @param P2DashBonus
 * @text Bonus al correr (P2/P3)
 * @desc Velocidad extra de P2/P3 mientras mantienen su tecla de correr.
 * @type number
 * @min 0
 * @max 3
 * @default 1
 *
 * @param JoinText
 * @text Cartel de union
 * @desc %1 = numero del jugador.
 * @type string
 * @default Player %1 has joined
 *
 * @help
 * =========================================================
 *  CONTROLES
 * =========================================================
 *  P1:
 *    WASD                = Movimiento
 *    Shift Izquierdo     = Correr
 *    Z / Espacio         = Aceptar / Interactuar
 *    X / Esc             = Cancelar / Menu
 *
 *  P2:
 *    Flechas             = Movimiento
 *    Shift Derecho       = Correr
 *    Enter               = Aceptar / Interactuar
 *    Backspace           = Cancelar
 *    X                   = Unirse a la partida (mientras P2 no se unio)
 *
 *  P3 (con P3Keys = all funcionan los tres a la vez):
 *    Teclado numerico:
 *      Numpad 8/4/5/6    = Movimiento (Numpad 2 tambien baja)
 *      Numpad +          = Correr
 *      Numpad 0 / Enter del numpad = Aceptar / Interactuar / Unirse
 *      Numpad .          = Cancelar
 *    Letras:
 *      I J K L = Movimiento, H = Correr, U = Aceptar / Unirse, O = Cancelar
 *  Con co-op en marcha, el Aceptar de un jugador que no esta (Enter para P2) lo une.
 *
 *  MANDOS (Gamepads = true):
 *    Start en un mando libre = se une el siguiente jugador (P2, P3 o P4) y
 *      el mando queda para el. Un mando libre sigue funcionando para P1.
 *    Cruceta / stick izquierdo = Movimiento
 *    A = Aceptar, B = Cancelar, X o RT = Correr / disparar
 *    Back / Select = Cambiar camara (como G)
 *  P4 solo se juega con mando.
 *
 *  MENUS: Cancelar en el mapa (P2: Backspace, P3: Numpad . / O, mando: B) abre el
 *  menu para ese jugador: solo responden sus teclas y Habilidades/Equipo/Estado
 *  van a su personaje. Opciones, Salir y Guardar quedan solo para P1.
 *
 *  REPARTO: en el menu de P1, "Co-op" permite elegir quien controla en combate a
 *  los personajes extra del grupo (P1..P4 o IA). En el principal de P2-P4, OK marca al
 *  jugador como ausente: la IA lucha por el y en el mapa sigue a P1. Tambien pasa solo si
 *  su mando se desconecta; vuelve en cuanto pulsa cualquier tecla o boton suyo.
 *
 *  DIALOGOS: si P2/P3/P4 habla con alguien, las opciones de respuesta las
 *  elige ese jugador (solo responden sus teclas). Ademas el evento "ve" a ese
 *  jugador como protagonista: su posicion, hacia donde mira, las rutas de
 *  movimiento y animaciones sobre el jugador (puzles, examinar, trampas...).
 *  Lo mismo con objetos usados desde su menu que lanzan eventos comunes.
 *
 *  CAMARA:
 *    G                   = Auto -> Compartida -> Pantalla dividida -> Solo P1 -> ... -> Solo P4
 *                          (Auto: compartida si estan cerca, dividida si se separan)
 *    - / =               = En pantalla dividida: alejar / acercar la camara de cada vista
 *    F10                 = Medidor de rendimiento (tiempo de cada parte por cuadro)
 *
 * =========================================================
 *  BATALLAS
 * =========================================================
 *  Los miembros del grupo se reparten por posicion:
 *    Con 2 jugadores: 1.o, 3.o y 5.o -> P1 ; 2.o y 4.o -> P2
 *    Con 3 jugadores: 1.o y 4.o -> P1 ; 2.o y 5.o -> P2 ; 3.o -> P3
 *    Con 4 jugadores: 1.o y 5.o -> P1 ; 2.o -> P2 ; 3.o -> P3 ; 4.o -> P4
 *  Cuando le toca elegir a un personaje, SOLO responden las teclas de su
 *  dueno, y un cartel arriba indica de quien es el turno.
 *
 * =========================================================
 *  OTROS JUEGOS (Fear & Hunger, etc.)
 * =========================================================
 *  Con P2ActorMode = select (o auto en cualquier juego que no sea Look
 *  Outside), al unirse P2 aparece un menu para elegir que personaje
 *  quiere controlar. Ese personaje se agrega al grupo en la 2.a posicion
 *  (P3: en la 3.a). Si el grupo ya tiene ese miembro, se usa sin menu.
 *
 *  La luz de P2 funciona con el sistema de "imagen de luz" de Look Outside
 *  (ver parametro LightPictureNames). Otros sistemas de iluminacion pueden
 *  requerir adaptacion.
 *
 * =========================================================
 *  LOOK OUTSIDE
 * =========================================================
 *  Menu de pausa: "Dios Conocimiento ($1000)" desbloquea el 5.o integrante.
 */

(() => {

    // Si alguien carga este archivo a mano antes de que arranque el juego, no hacer nada
    // (el plugin se carga solo desde plugins.js).
    if (typeof PluginManager === 'undefined' || typeof Input === 'undefined') return;

    const PLUGIN_NAME = 'LookOutsideOnline';
    const COOP_VERSION = '1.1.0';
    const params = PluginManager.parameters(PLUGIN_NAME) || {};
    const IS_MZ = (typeof Utils !== 'undefined') && Utils.RPGMAKER_NAME === 'MZ';

    const MAX_PLAYERS = Math.max(2, Math.min(4, Number(params.MaxPlayers || 4) || 4));
    // Estos ajustes empiezan con los parametros del plugin y se pueden cambiar en el juego
    // (Opciones > Co-op); se guardan con la configuracion (config.rpgsave). Ver applyCoopSettings.
    let P3_KEY_SET = ['numpad', 'ijkl'].indexOf(String(params.P3Keys)) >= 0 ? String(params.P3Keys) : 'all';
    let GAMEPADS = String(params.Gamepads) !== 'false';
    let AUTO_REJOIN = String(params.AutoRejoin) !== 'false';
    const P2_ACTOR_MODE = String(params.P2ActorMode || 'auto');
    const P2_ACTOR_CHOICES = String(params.P2ActorChoices || '')
        .split(',').map(s => Number(s.trim())).filter(n => n > 0);
    const LIGHT_NAMES = String(params.LightPictureNames || 'Darkness')
        .split(',').map(s => s.trim()).filter(s => s.length > 0);
    let SPLIT_VERTICAL = String(params.SplitDirection || 'vertical') !== 'horizontal';
    let SPLIT3_LAYOUT = ['grid', 'big'].indexOf(String(params.Split3Layout)) >= 0 ? String(params.Split3Layout) : 'triangle';
    const SPLIT_ZOOM_STEPS = 4;
    // Las ventanas por jugador (F9) se actualizan a 30 por segundo y a tamano completo: a 60 Chromium
    // (NW.js 0.29) se atasca con varias ventanas y la imagen a mitad de tamano se ve demasiado borrosa.
    const WINDOW_FPS = 30;
    const SPLIT_ZOOM_STEP = { far: 0, medium: 2, near: 4 };
    const SPLIT_ZOOM_START = SPLIT_ZOOM_STEP[String(params.SplitZoom || 'far')];
    const JOIN_TEXT = String(params.JoinText || 'Player %1 has joined');
    const PLAYER_ONLY_EVENTS = String(params.PlayerOnlyEvents === undefined
        ? 'arrow_check,arrow_player,backstab_check,backstab,bleeding,blood' : params.PlayerOnlyEvents)
        .split(',').map(t => t.trim()).filter(t => t.length > 0);

    const CAM_SHARED = 0;
    const CAM_SPLIT = 1;
    const CAM_P1 = 2;
    const CAM_P2 = 3;
    const CAM_P3 = 4;
    const CAM_P4 = 5;
    const CAM_AUTO = 6;
    const CAM_NAMES = ['Shared camera', 'Split screen', 'Player 1 camera', 'Player 2 camera', 'Player 3 camera', 'Player 4 camera',
        'Auto camera'];
    const CAM_BY_NAME = { shared: CAM_SHARED, split: CAM_SPLIT, p1: CAM_P1, p2: CAM_P2, p3: CAM_P3, p4: CAM_P4, auto: CAM_AUTO };
    // orden al pulsar G
    const CAM_ORDER = [CAM_AUTO, CAM_SHARED, CAM_SPLIT, CAM_P1, CAM_P2, CAM_P3, CAM_P4];

    const COLOR_P1 = '#4aa3ff';
    const COLOR_P2 = '#ff6a5c';
    const COLOR_P3 = '#5fd35f';
    const COLOR_P4 = '#f2c94c';
    const PLAYER_COLORS = [null, COLOR_P1, COLOR_P2, COLOR_P3, COLOR_P4];

    const P2_FIXED_SPEED = Number(params.P2MoveSpeed || 0);
    const P2_RUN_BONUS = (params.P2DashBonus === undefined || params.P2DashBonus === '') ? 1 : Number(params.P2DashBonus);

    const KEY_JOIN = 88;   // X
    const KEY_CAMERA = 71; // G

    window.$gamePlayer2 = null;
    window.$gamePlayer3 = null;
    window.$gamePlayer4 = null;

    let cameraMode = CAM_BY_NAME[String(params.DefaultCameraMode || 'auto')];
    if (cameraMode === undefined) cameraMode = CAM_AUTO;

    const CoopState = {
        selecting: 0,       // jugador (2-4) con el menu de seleccion de personaje abierto
        lastOwner: 0,
        restore: null,      // jugadores a volver a unir tras cargar partida (ver AUTO_REJOIN)
        starting: 0,        // jugador que esta activando un evento en este momento
        menuOwner: 0,       // jugador que abrio el menu (solo responden sus teclas)
        parked: {},         // jugador -> { actorId }: sin personaje por ahora, vuelve solo
        lastActor: {},      // jugador -> ultimo personaje que llevo (al volver lo prefiere)
        takes: [],          // jugadores a los que el anfitrion quito el personaje (se aplica en el mapa)
        away: {}            // jugador -> true: no esta (mando desconectado...): su personaje va con la IA
    };

    function newPlayerKeys() {
        return { left: false, right: false, up: false, down: false, shift: false, ok: false, join: false, menu: false };
    }

    // estado de las teclas de P2, P3 y P4 en el mapa
    const playerInput = { 2: newPlayerKeys(), 3: newPlayerKeys(), 4: newPlayerKeys() };

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    function gameTitle() {
        return (typeof $dataSystem !== 'undefined' && $dataSystem && $dataSystem.gameTitle) || '';
    }

    function isLookOutside() {
        return /look\s*outside/i.test(gameTitle());
    }

    function coopMode() {
        if (P2_ACTOR_MODE === 'clone' || P2_ACTOR_MODE === 'select') return P2_ACTOR_MODE;
        return isLookOutside() ? 'clone' : 'select';
    }

    function rectArgs(x, y, w, h) {
        return IS_MZ ? [new Rectangle(x, y, w, h)] : [x, y, w, h];
    }

    function mainFont() {
        return (typeof $gameSystem !== 'undefined' && $gameSystem && $gameSystem.mainFontFace)
            ? $gameSystem.mainFontFace() : 'sans-serif';
    }

    function getRenderer() {
        if (Graphics.app && Graphics.app.renderer) return Graphics.app.renderer;
        if (Graphics._renderer && Graphics._renderer.gl) return Graphics._renderer;
        return null;
    }

    function pixiIs5() {
        return typeof PIXI !== 'undefined' && String(PIXI.VERSION).charAt(0) >= '5';
    }

    function makeRenderTexture(w, h) {
        return pixiIs5()
            ? PIXI.RenderTexture.create({ width: w, height: h })
            : PIXI.RenderTexture.create(w, h);
    }

    // Modo de mezcla "DST_IN" (resultado = destino x alfa del origen) para unir huecos de luz.
    // Pixi 5 lo trae; en Pixi 4 (RPG Maker MV) se registra uno propio.
    const CUSTOM_DST_IN = 40;
    function dstInMode() {
        const r = getRenderer();
        if (!r || !r.gl) return null;
        if (pixiIs5()) {
            return (PIXI.BLEND_MODES && PIXI.BLEND_MODES.DST_IN !== undefined) ? PIXI.BLEND_MODES.DST_IN : null;
        }
        const table = PIXI.utils && PIXI.utils.premultiplyBlendMode;
        if (!r.state || !r.state.blendModes || !table) return null;
        if (!r.state.blendModes[CUSTOM_DST_IN]) {
            r.state.blendModes[CUSTOM_DST_IN] = [r.gl.ZERO, r.gl.SRC_ALPHA];
            table[0][CUSTOM_DST_IN] = CUSTOM_DST_IN;
            table[1][CUSTOM_DST_IN] = CUSTOM_DST_IN;
        }
        return CUSTOM_DST_IN;
    }

    function canUnionLights() {
        return dstInMode() !== null;
    }

    function canSplit() {
        return !!getRenderer() && typeof PIXI !== 'undefined' && !!PIXI.RenderTexture;
    }

    function inScene(klass) {
        return typeof klass !== 'undefined' && SceneManager._scene instanceof klass;
    }

    function messageBusy() {
        return typeof $gameMessage !== 'undefined' && $gameMessage && $gameMessage.isBusy();
    }

    // =========================================================================
    // JUGADORES
    // n = 1 -> $gamePlayer ; n = 2/3/4 -> $gamePlayer2 / $gamePlayer3 / $gamePlayer4
    // =========================================================================

    function coopPlayer(n) {
        if (n === 1) return $gamePlayer;
        if (n < 2 || n > MAX_PLAYERS) return null;
        return window['$gamePlayer' + n] || null;
    }

    function setCoopPlayer(n, player) {
        window['$gamePlayer' + n] = player;
    }

    // P2..P4 activos (cada uno solo existe si existe el anterior)
    function extraPlayers() {
        const list = [];
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            const p = coopPlayer(n);
            if (p) list.push(p);
        }
        return list;
    }

    function allPlayers() {
        return [$gamePlayer].concat(extraPlayers());
    }

    function playerCount() {
        return 1 + extraPlayers().length;
    }

    function colorOf(n) {
        return PLAYER_COLORS[n] || COLOR_P2;
    }

    // Hay co-op si hay al menos un jugador extra (no tiene por que ser P2: el anfitrion
    // puede quitarle el personaje a P2 y que P3 siga jugando)
    function coopOn() {
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            if (window['$gamePlayer' + n]) return true;
        }
        return false;
    }

    function coopActive() {
        return coopOn() || CoopState.selecting > 0;
    }

    // =========================================================================
    // DUENO DE CADA PERSONAJE EN BATALLA
    // 2 jugadores: posiciones 1,3,5 -> P1 ; 2,4 -> P2
    // 3 jugadores: posiciones 1,4 -> P1 ; 2,5 -> P2 ; 3 -> P3
    // 4 jugadores: posiciones 1,5 -> P1 ; 2 -> P2 ; 3 -> P3 ; 4 -> P4
    // =========================================================================

    // Personaje principal de un jugador (el que lleva por el mapa): 0 = no es de nadie
    function mainOwnerOf(actor) {
        const members = $gameParty.members();
        if (members[0] === actor) return 1;
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            const p = coopPlayer(n);
            if (p && actor && p._coopActorId === actor.actorId()) return n;
        }
        return 0;
    }

    // Reparto que eligio el anfitrion en el menu "Co-op": actorId -> jugador (0 = IA)
    function assignedOwnerOf(actor) {
        const table = $gameSystem && $gameSystem._coopOwners;
        if (!table || !actor) return undefined;
        const owner = table[actor.actorId()];
        if (owner === 0) return 0;
        return (owner >= 1 && coopPlayer(owner)) ? owner : undefined;
    }

    // Quien controla al personaje en combate: el suyo para cada jugador, los demas segun el
    // reparto del anfitrion y, si no lo hay, por turnos (2 jugadores: 1,3,5 -> P1 ; 2,4 -> P2)
    function battleOwnerOf(actor) {
        const idx = $gameParty.members().indexOf(actor);
        if (idx < 0) return 1;
        const main = mainOwnerOf(actor);
        if (main) return main;
        const assigned = assignedOwnerOf(actor);
        if (assigned !== undefined) return assigned || 1;
        const owners = [1].concat(extraPlayers().map(p => p.coopIndex()));
        return owners[idx % owners.length];
    }

    // Jugador ausente: su personaje lucha con la IA y en el mapa sigue a P1.
    // Se activa si su mando se desconecta o desde el menu "Co-op"; se quita con cualquier tecla suya.
    function setPlayerAway(n, on) {
        const p = coopPlayer(n);
        if (n < 2 || !p || !!CoopState.away[n] === on) return;
        if (on) {
            CoopState.away[n] = true;
            const actor = p.actor();
            CoopUI.banner('Player ' + n + ' is away', 'AI plays ' + (actor ? actor.name() : 'the character') + '  -  any button to come back', colorOf(n), 200);
        } else {
            delete CoopState.away[n];
            CoopUI.banner('Player ' + n + ' is back', '', colorOf(n), 110);
        }
    }

    function isAiControlled(actor) {
        const main = mainOwnerOf(actor);
        if (main >= 2) return coopOn() && !!CoopState.away[main];
        return coopOn() && !mainOwnerOf(actor) && assignedOwnerOf(actor) === 0;
    }

    // =========================================================================
    // DIALOGOS: las opciones las elige el jugador que activo el evento
    // =========================================================================

    // Cada evento recuerda que jugador lo activo (1 = P1, autoejecutables, etc.)
    const _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        _Game_Event_start.call(this);
        if (this._starting) this._coopStarter = CoopState.starting || 1;
    };

    function startEventAs(n, event) {
        const before = CoopState.starting;
        CoopState.starting = n;
        try {
            event.start();
        } finally {
            CoopState.starting = before;
        }
    }

    function messageInputActive() {
        const scene = SceneManager._scene;
        if (!scene) return false;
        const mw = scene._messageWindow;
        const windows = [
            mw && mw._choiceWindow, mw && mw._numberWindow, mw && mw._itemWindow,        // MV
            scene._choiceListWindow, scene._numberInputWindow, scene._eventItemWindow    // MZ
        ];
        return windows.some(w => w && w.active);
    }

    // Jugador (2-4) que elige la respuesta ahora mismo, o 0
    function choiceOwner() {
        if (!coopOn() || !inScene(Scene_Map) || !$gameMap.isEventRunning()) return 0;
        if (!messageInputActive()) return 0;
        const n = $gameMap._interpreter._coopStarter || 0;
        return (n >= 2 && coopPlayer(n)) ? n : 0;
    }

    // ---- EL EVENTO "VE" AL JUGADOR QUE LO ACTIVO ----------------------------------
    // En los eventos, "el jugador" (personaje -1) pasa por Game_Interpreter.character: leer su
    // posicion o direccion, condiciones de hacia donde mira, rutas de movimiento, animaciones
    // y globos. Si el evento lo activo P2-P4, ese personaje es el suyo. El interprete recuerda
    // quien lo activo al empezar (eventos paralelos y automaticos: P1).

    const _Game_Interpreter_clear = Game_Interpreter.prototype.clear;
    Game_Interpreter.prototype.clear = function() {
        _Game_Interpreter_clear.call(this);
        this._coopStarter = 0;
    };

    const _Game_Interpreter_setupChild = Game_Interpreter.prototype.setupChild;
    Game_Interpreter.prototype.setupChild = function(list, eventId) {
        _Game_Interpreter_setupChild.call(this, list, eventId);
        if (this._childInterpreter) this._childInterpreter._coopStarter = this._coopStarter;
    };

    const _Game_Map_setupStartingMapEvent = Game_Map.prototype.setupStartingMapEvent;
    Game_Map.prototype.setupStartingMapEvent = function() {
        const event = this.events().find(ev => ev.isStarting());
        const started = _Game_Map_setupStartingMapEvent.call(this);
        if (started && event) this._interpreter._coopStarter = event._coopStarter || 1;
        return started;
    };

    // Eventos comunes que lanza un objeto usado desde el menu de P2-P4
    const _Game_Temp_reserveCommonEvent = Game_Temp.prototype.reserveCommonEvent;
    Game_Temp.prototype.reserveCommonEvent = function(commonEventId) {
        _Game_Temp_reserveCommonEvent.call(this, commonEventId);
        this._coopReservedBy = CoopState.menuOwner >= 2 ? CoopState.menuOwner : 0;
    };

    const _Game_Interpreter_setupReservedCommonEvent = Game_Interpreter.prototype.setupReservedCommonEvent;
    Game_Interpreter.prototype.setupReservedCommonEvent = function() {
        const by = $gameTemp._coopReservedBy || 0;
        const started = _Game_Interpreter_setupReservedCommonEvent.call(this);
        if (started) {
            this._coopStarter = by;
            $gameTemp._coopReservedBy = 0;
        }
        return started;
    };

    const _Game_Interpreter_character = Game_Interpreter.prototype.character;
    Game_Interpreter.prototype.character = function(param) {
        if (param < 0 && this._coopStarter >= 2 && !$gameParty.inBattle()) {
            const p = coopPlayer(this._coopStarter);
            if (p) return p;
        }
        return _Game_Interpreter_character.call(this, param);
    };

    // Quien tiene el control del teclado en este momento: 0 = nadie en particular
    function coopInputOwner() {
        if (CoopState.selecting) return CoopState.selecting;
        if (!coopOn()) return 0;
        if (inScene(Scene_Battle) && BattleManager.isInputting()) {
            const actor = BattleManager.actor();
            return actor ? battleOwnerOf(actor) : 1;
        }
        if (CoopState.menuOwner && !inScene(Scene_Map) && !inScene(Scene_Battle)) return CoopState.menuOwner;
        return choiceOwner();
    }

    // =========================================================================
    // CONTROLES
    // =========================================================================

    Input.keyMapper[87] = 'up';       // W
    Input.keyMapper[83] = 'down';     // S
    Input.keyMapper[65] = 'left';     // A
    Input.keyMapper[68] = 'right';    // D

    // Teclas de P2 y P3 por KeyboardEvent.code (no por keyCode: con Bloq Num apagado
    // el teclado numerico manda los mismos keyCode que las flechas de P2)
    const P3_NUMPAD = {
        up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'],
        ok: ['Numpad0', 'NumpadEnter'], cancel: ['NumpadDecimal'], shift: ['NumpadAdd']
    };
    const P3_IJKL = {
        up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'],
        ok: ['KeyU'], cancel: ['KeyO'], shift: ['KeyH']
    };

    // Los mandos entran por el mismo camino que el teclado, con codigos inventados
    // propios de cada jugador: Pad2A, Pad3Up... (ver CONTROLES: MANDOS)
    const PAD_NAMES = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'A', cancel: 'B', shift: 'X' };

    function padCode(n, action) {
        return 'Pad' + n + PAD_NAMES[action];
    }

    function padKeys(n) {
        const out = {};
        for (const action of Object.keys(PAD_NAMES)) out[action] = [padCode(n, action)];
        return out;
    }

    function joinKeySets(sets) {
        const out = {};
        for (const set of sets) {
            for (const action of Object.keys(set)) out[action] = (out[action] || []).concat(set[action]);
        }
        return out;
    }

    // Mientras hay co-op, las teclas de P2..P4 llegan a RPG Maker con un keyCode "virtual"
    // propio de cada jugador, asi nunca se confunden con las de P1 ni entre ellas.
    const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'ok', 'cancel', 'shift'];
    const ACTION_BUTTON = { up: 'up', down: 'down', left: 'left', right: 'right', ok: 'ok', cancel: 'escape' };
    const PLAYER_KEYS = {};
    const CODE_TO_KEY = {};
    const PLAYER_KEY_MAP = { 2: {}, 3: {}, 4: {} };
    const VIRTUAL_OK = [];
    const KEY_HELP = {};
    const JOIN_KEY_NAME = {};

    // (re)hace las tablas segun P3_KEY_SET y GAMEPADS (los objetos se vacian y se rellenan,
    // asi quien los tenga guardados ve siempre los valores actuales)
    function rebuildKeyTables() {
        PLAYER_KEYS[2] = joinKeySets([{
            up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
            ok: ['Enter'], cancel: ['Backspace'], shift: ['ShiftRight']
        }, padKeys(2)]);
        PLAYER_KEYS[3] = joinKeySets([
            P3_KEY_SET !== 'ijkl' ? P3_NUMPAD : {},
            P3_KEY_SET !== 'numpad' ? P3_IJKL : {},
            padKeys(3)
        ]);
        PLAYER_KEYS[4] = padKeys(4); // P4 solo con mando

        Object.keys(CODE_TO_KEY).forEach(code => delete CODE_TO_KEY[code]);
        VIRTUAL_OK.length = 0;
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            PLAYER_KEY_MAP[n] = {};
            KEY_ACTIONS.forEach((action, i) => {
                const vk = 1000 + n * 10 + i;
                for (const code of (PLAYER_KEYS[n][action] || [])) {
                    CODE_TO_KEY[code] = { player: n, action: action, vk: vk };
                }
                if (ACTION_BUTTON[action]) PLAYER_KEY_MAP[n][vk] = ACTION_BUTTON[action];
                if (action === 'ok') VIRTUAL_OK.push(vk);
            });
        }

        const parts = [];
        if (P3_KEY_SET !== 'ijkl') parts.push(['Num 8/5', 'Num 0', 'Num .']);
        if (P3_KEY_SET !== 'numpad') parts.push(['I/K', 'U', 'O']);
        if (GAMEPADS) parts.push(['pad', 'A', 'B']);
        const p3Help = i => parts.map(p => p[i]).join(', ');
        KEY_HELP[2] = 'Arrows' + (GAMEPADS ? '/pad' : '') + ': move    Enter' + (GAMEPADS ? '/A' : '') +
            ': select    Backspace' + (GAMEPADS ? '/B' : '') + ': cancel';
        KEY_HELP[3] = 'Move: ' + p3Help(0) + '   OK: ' + p3Help(1) + '   Back: ' + p3Help(2);
        KEY_HELP[4] = 'Gamepad: move    A: select    B: cancel';
        const padJoin = GAMEPADS ? ' / Start on a gamepad' : '';
        JOIN_KEY_NAME[2] = 'X / Enter' + padJoin;
        JOIN_KEY_NAME[3] = P3_KEY_SET === 'ijkl' ? 'U' + padJoin : (P3_KEY_SET === 'numpad' ? 'Numpad 0' + padJoin : 'U / Numpad 0' + padJoin);
        JOIN_KEY_NAME[4] = 'Start on a gamepad';
    }
    rebuildKeyTables();

    function codeOf(e) {
        if (e.code) return e.code;
        if (e.keyCode === 16 && e.location === 2) return 'ShiftRight';
        return '';
    }

    function coopKeyOf(e) {
        return CODE_TO_KEY[codeOf(e)] || null;
    }

    function virtualEvent(e, k) {
        return {
            keyCode: k.vk, code: e.code, key: e.key, location: e.location, repeat: e.repeat,
            ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey,
            preventDefault: function() {}
        };
    }

    // Devuelve el mapa de teclas valido para cada contexto (sin tocar el original)
    function buildMapper(base, owner) {
        if (owner >= 2) return Object.assign({}, PLAYER_KEY_MAP[owner]);
        const m = Object.assign({}, base);
        delete m[37]; delete m[38]; delete m[39]; delete m[40];
        // P1 siempre tiene WASD (algunos juegos reescriben el mapa de teclas, p.ej. YEP_KeyboardConfig)
        m[87] = 'up'; m[65] = 'left'; m[83] = 'down'; m[68] = 'right';
        if (owner === 1 || (inScene(Scene_Map) && !messageBusy())) {
            delete m[13];
        } else {
            // dialogos y menus: el Aceptar de cualquier jugador avanza (como el Enter del mod original)
            for (const vk of VIRTUAL_OK) m[vk] = 'ok';
        }
        return m;
    }

    function withMapper(input, fn) {
        const base = input.keyMapper;
        if (!coopActive()) {
            fn();
            return;
        }
        input.keyMapper = buildMapper(base, coopInputOwner());
        try {
            fn();
        } finally {
            input.keyMapper = base;
        }
    }

    function isMapIdle() {
        return inScene(Scene_Map) && $gamePlayer && !$gameMap.isEventRunning() &&
            !messageBusy() && !CoopState.selecting && !!$gameParty.leader();
    }

    const _Input_onKeyDown = Input._onKeyDown;
    Input._onKeyDown = function(event) {
        // X en el mapa antes de que P2 se una = unirse (no abre el menu)
        if (!coopOn() && event.keyCode === KEY_JOIN && isMapIdle()) {
            return;
        }
        const k = coopKeyOf(event);
        if (k && coopActive()) {
            event.preventDefault();
            const ev = virtualEvent(event, k);
            withMapper(this, () => _Input_onKeyDown.call(this, ev));
            return;
        }
        // Aceptar de P3 antes de que haya co-op: no debe abrir el menu de P1 (Numpad 0 = cancelar)
        if (k && k.player === 3 && k.action === 'ok' && isMapIdle()) return;
        withMapper(this, () => _Input_onKeyDown.call(this, event));
    };

    const _Input_onKeyUp = Input._onKeyUp;
    Input._onKeyUp = function(event) {
        const k = coopKeyOf(event);
        const active = coopActive();
        // las teclas de P2/P3 no sueltan las de P1 (p.ej. Shift derecho vs. Shift izquierdo)
        if (!k || !active) _Input_onKeyUp.call(this, event);
        if (k || active) {
            // soltar la tecla en todos los contextos para que nunca quede "pegada"
            const ev = k ? virtualEvent(event, k) : event;
            const base = this.keyMapper;
            for (let owner = 0; owner <= MAX_PLAYERS; owner++) {
                this.keyMapper = buildMapper(base, owner);
                try {
                    _Input_onKeyUp.call(this, ev);
                } finally {
                    this.keyMapper = base;
                }
            }
        }
    };

    const _Input_update = Input.update;
    Input.update = function() {
        if (coopActive()) {
            const owner = coopInputOwner();
            if (owner !== CoopState.lastOwner) {
                CoopState.lastOwner = owner;
                this.clear();
            }
        } else {
            CoopState.lastOwner = 0;
        }
        _Input_update.call(this);
    };

    // =========================================================================
    // TECLAS DE P2/P3 Y CAMARA
    // =========================================================================

    function coopKeyDown(e) {
        const onMap = inScene(Scene_Map);

        if (e.keyCode === KEY_CAMERA && !e.repeat && coopOn()) {
            CoopView.cycleCamera();
        }
        if (e.keyCode === KEY_JOIN && onMap && !coopOn()) {
            playerInput[2].join = true;
        }

        const k = coopKeyOf(e);
        if (!k) return;
        if (CoopState.away[k.player]) {
            // la tecla con la que vuelve no cuenta para nada mas (no habla con quien tenga delante)
            setPlayerAway(k.player, false);
            return;
        }
        const keys = playerInput[k.player];
        if (k.action === 'ok') {
            if (onMap) {
                keys.ok = true;
                if ((k.player >= 3 || coopOn()) && !coopPlayer(k.player)) keys.join = true;
            }
        } else if (k.action === 'cancel') {
            // Cancelar en el mapa = abrir el menu propio (ver MENUS DE CADA JUGADOR)
            if (onMap && coopPlayer(k.player) && isMapIdle()) keys.menu = true;
        } else {
            keys[k.action] = true;
        }
    }

    function coopKeyUp(e) {
        if (e.keyCode === KEY_JOIN) playerInput[2].join = false;

        const k = coopKeyOf(e);
        if (!k) return;
        const keys = playerInput[k.player];
        if (k.action === 'ok') {
            keys.ok = false;
            if (k.player >= 3 || coopOn()) keys.join = false;
        } else if (k.action === 'cancel') {
            keys.menu = false;
        } else {
            keys[k.action] = false;
        }
    }

    window.addEventListener('keydown', coopKeyDown);
    window.addEventListener('keyup', coopKeyUp);

    // =========================================================================
    // CONTROLES: MANDOS
    // Un mando "libre" funciona como siempre (para P1). Al pulsar Start en un mando
    // libre se une el siguiente jugador (P2, P3 o P4) y el mando pasa a ser suyo:
    // cada boton se convierte en una "tecla" de ese jugador (Pad3A, Pad3Up...) y
    // pasa por el mismo camino que el teclado.
    // =========================================================================

    const PAD_BUTTONS = { 0: 'ok', 1: 'cancel', 2: 'shift', 7: 'shift', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
    const PAD_CAMERA_BUTTON = 8; // Back / Select
    const PAD_START_BUTTON = 9;
    const PAD_THRESHOLD = 0.5;
    const padOwner = {};       // indice del mando -> jugador (2-4)
    const padPressed = {};     // indice del mando -> { player, actions } ya enviadas como teclas
    const padButtonsLast = {}; // indice del mando -> { camera, start } del cuadro anterior
    const padWanted = {};      // jugador -> true: volvio al cargar partida pero su mando no estaba
    const padSeen = {};        // indice del mando -> true: se ha visto conectado

    function fakeKeyEvent(code) {
        return { code: code, keyCode: 0, key: '', location: 0, repeat: false, preventDefault: function() {} };
    }

    // el mando con ese indice (no la posicion en la lista)
    function findPad(pads, index) {
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].index === index) return pads[i];
        }
        return null;
    }

    function padList(nav) {
        return (nav && nav.getGamepads && nav.getGamepads()) || [];
    }

    // Si la ventana principal no tiene el foco (p.ej. se hizo clic en una ventana de jugador),
    // Chromium puede no dar los mandos: entonces se leen desde las ventanas de jugador.
    function connectedPads() {
        const pads = padList(navigator);
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) return pads;
        }
        for (const nav of coopWindowNavigators()) {
            const other = padList(nav);
            for (let i = 0; i < other.length; i++) {
                if (other[i] && other[i].connected) return other;
            }
        }
        return pads;
    }

    Input._pollGamepads = function() {
        const pads = connectedPads();
        for (let i = 0; i < pads.length; i++) {
            const gamepad = pads[i];
            if (gamepad && gamepad.connected) this._updateGamepadState(gamepad);
        }
    };

    function readPad(gamepad) {
        const now = {};
        const buttons = gamepad.buttons;
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            const down = typeof b === 'object' ? (b.pressed || b.value > PAD_THRESHOLD) : b > PAD_THRESHOLD;
            if (!down) continue;
            if (PAD_BUTTONS[i]) now[PAD_BUTTONS[i]] = true;
            if (i === PAD_CAMERA_BUTTON) now.camera = true;
            if (i === PAD_START_BUTTON) now.start = true;
        }
        const axes = gamepad.axes;
        if (axes[1] < -PAD_THRESHOLD) now.up = true;
        else if (axes[1] > PAD_THRESHOLD) now.down = true;
        if (axes[0] < -PAD_THRESHOLD) now.left = true;
        else if (axes[0] > PAD_THRESHOLD) now.right = true;
        return now;
    }

    // teclas de P1 con las que el modo en red repite sus acciones (ver injectAction)
    const P1_NET_KEYS = {
        up: ['KeyW', 87], down: ['KeyS', 83], left: ['KeyA', 65], right: ['KeyD', 68],
        ok: ['KeyZ', 90], cancel: ['KeyX', 88], shift: ['ShiftLeft', 16, 1]
    };

    function sendPadKey(input, n, action, down) {
        const ev = fakeKeyEvent(padCode(n, action));
        if (down) {
            input._onKeyDown(ev);
            coopKeyDown(ev);
        } else {
            input._onKeyUp(ev);
            coopKeyUp(ev);
        }
    }

    // suelta todo lo que el mando tenia pulsado como su jugador
    function releasePad(input, index) {
        const st = padPressed[index];
        if (!st) return;
        delete padPressed[index];
        for (const action of Object.keys(st.actions)) sendPadKey(input, st.player, action, false);
    }

    // suelta lo que el mando tenia pulsado como mando normal de RPG Maker (P1)
    function releaseBasePad(input, index) {
        const baseLast = input._gamepadStates[index];
        if (!baseLast) return;
        for (let j = 0; j < baseLast.length; j++) {
            const name = baseLast[j] && input.gamepadMapper[j];
            if (name) input._currentState[name] = false;
        }
        delete input._gamepadStates[index];
    }

    function padsOf(n) {
        return Object.keys(padOwner).filter(i => padOwner[i] === n).map(Number);
    }

    function bindPad(index, n) {
        releasePad(Input, index);
        padOwner[index] = n;
        saveCoopSession();
    }

    function unbindPad(index) {
        releasePad(Input, index);
        delete padOwner[index];
        saveCoopSession();
    }

    // Start en un mando libre (en el mapa)
    function padStart(index) {
        if (!inScene(Scene_Map) || padOwner[index]) return;
        // un jugador que volvio al cargar partida y espera su mando
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            if (padWanted[n] && coopPlayer(n)) {
                delete padWanted[n];
                bindPad(index, n);
                CoopUI.banner('Gamepad connected', 'Player ' + n, colorOf(n), 110);
                return;
            }
        }
        // si no, se une el siguiente jugador libre
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            if (coopPlayer(n) || playerInput[n].join || CoopState.selecting === n) continue;
            bindPad(index, n);
            playerInput[n].join = true;
            return;
        }
        CoopUI.banner('All players have joined', '', '#bbbbbb', 90);
    }

    // Mandos asignados a jugadores que no llegaron a unirse (menu cancelado, grupo lleno...)
    // o mandos desconectados con botones pulsados
    function updatePadBindings() {
        const pads = connectedPads();
        for (const key of Object.keys(padOwner)) {
            const index = Number(key);
            const n = padOwner[index];
            if (!coopPlayer(n) && !playerInput[n].join && CoopState.selecting !== n && !CoopState.parked[n]) {
                unbindPad(index);
                continue;
            }
            const pad = findPad(pads, index);
            if (!pad || !pad.connected) {
                releasePad(Input, index);
                if (padSeen[index]) {
                    padSeen[index] = false;
                    setPlayerAway(n, true);
                }
            }
        }
    }

    const _Input_updateGamepadState = Input._updateGamepadState;
    // el modo en red (LocalCoop_Net) se queda los mandos para mandarlos por la red
    let padCapture = null;

    Input._updateGamepadState = function(gamepad) {
        if (padCapture) {
            padCapture(gamepad);
            return;
        }
        if (!GAMEPADS) {
            _Input_updateGamepadState.call(this, gamepad);
            return;
        }

        const index = gamepad.index;
        padSeen[index] = true;
        const now = readPad(gamepad);
        const lastButtons = padButtonsLast[index] || {};
        padButtonsLast[index] = { camera: !!now.camera, start: !!now.start };
        if (now.start && !lastButtons.start) padStart(index);

        const n = padOwner[index];
        if (!n) {
            releasePad(this, index);
            // mando libre = mando de P1: no responde en el turno o la eleccion de otro jugador
            if (coopActive() && coopInputOwner() >= 2) {
                releaseBasePad(this, index);
                return;
            }
            _Input_updateGamepadState.call(this, gamepad);
            return;
        }

        // mando recien asignado: soltar lo que tuviera pulsado como P1
        releaseBasePad(this, index);

        if (now.camera && !lastButtons.camera && coopOn()) CoopView.cycleCamera();

        if (padPressed[index] && padPressed[index].player !== n) releasePad(this, index);
        const prev = padPressed[index] ? padPressed[index].actions : {};
        const actions = {};
        for (const action of KEY_ACTIONS) {
            if (now[action]) actions[action] = true;
        }
        padPressed[index] = { player: n, actions: actions };
        for (const action of Object.keys(actions)) {
            if (!prev[action]) sendPadKey(this, n, action, true);
        }
        for (const action of Object.keys(prev)) {
            if (!actions[action]) sendPadKey(this, n, action, false);
        }
    };

    // =========================================================================
    // SESION GUARDADA (AutoRejoin): quien jugaba y con que mando
    // =========================================================================

    function saveCoopSession() {
        if (typeof $gameSystem === 'undefined' || !$gameSystem) return;
        const pads = {};
        for (const key of Object.keys(padOwner)) pads[padOwner[key]] = Number(key);
        $gameSystem._coopSession = { players: extraPlayers().map(p => p.coopIndex()), pads: pads };
    }

    // =========================================================================
    // CARTELES (union de P2, camara, etc.)
    // =========================================================================

    function drawBox(bitmap, w, h, color, alpha) {
        bitmap.fillRect(0, 0, w, h, 'rgba(0,0,0,' + (alpha === undefined ? 0.80 : alpha) + ')');
        bitmap.fillRect(0, 0, 6, h, color);
        bitmap.fillRect(0, 0, w, 2, color);
        bitmap.fillRect(0, h - 2, w, 2, color);
    }

    function Sprite_CoopBanner() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CoopBanner.prototype = Object.create(Sprite.prototype);
    Sprite_CoopBanner.prototype.constructor = Sprite_CoopBanner;

    Sprite_CoopBanner.prototype.initialize = function(title, sub, color, duration) {
        Sprite.prototype.initialize.call(this);
        const w = Math.min(Graphics.width - 40, 560);
        const h = sub ? 92 : 62;
        const bitmap = new Bitmap(w, h);
        drawBox(bitmap, w, h, color);
        bitmap.fontFace = mainFont();
        bitmap.textColor = '#ffffff';
        bitmap.outlineColor = 'rgba(0,0,0,0.9)';
        bitmap.outlineWidth = 4;
        bitmap.fontSize = 30;
        bitmap.drawText(title, 18, sub ? 6 : 0, w - 30, sub ? 50 : h, 'center');
        if (sub) {
            bitmap.fontSize = 20;
            bitmap.textColor = '#d8d8d8';
            bitmap.drawText(sub, 18, 50, w - 30, 34, 'center');
        }
        this.bitmap = bitmap;
        this.anchor.x = 0.5;
        this.anchor.y = 0;
        this.x = Graphics.width / 2;
        this._bannerH = h;
        this._targetY = 20;
        this._life = 0;
        this._duration = duration || 160;
        this.y = -h;
    };

    Sprite_CoopBanner.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this._life++;
        const slide = 18;
        const fade = 30;
        if (this._life <= slide) {
            const t = this._life / slide;
            this.y = -this._bannerH + (this._targetY + this._bannerH) * (1 - Math.pow(1 - t, 3));
        } else {
            this.y = this._targetY;
        }
        if (this._life > this._duration - fade) {
            this.opacity = Math.max(0, 255 * (this._duration - this._life) / fade);
        }
        if (this._life >= this._duration) {
            if (this.parent) this.parent.removeChild(this);
            if (this.bitmap && this.bitmap.destroy) this.bitmap.destroy();
            this.bitmap = null;
        }
    };

    const CoopUI = {
        banner(title, sub, color, duration) {
            const scene = SceneManager._scene;
            if (!scene) return;
            // un solo cartel a la vez: reemplaza al anterior
            if (scene._coopBanner && scene._coopBanner.parent) {
                scene._coopBanner.parent.removeChild(scene._coopBanner);
                if (scene._coopBanner.destroy) scene._coopBanner.destroy();
            }
            scene._coopBanner = new Sprite_CoopBanner(title, sub, color || COLOR_P2, duration);
            scene.addChild(scene._coopBanner);
        }
    };

    // =========================================================================
    // CARTEL PERMANENTE DE TURNO EN BATALLA
    // =========================================================================

    function Sprite_CoopTurn() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CoopTurn.prototype = Object.create(Sprite.prototype);
    Sprite_CoopTurn.prototype.constructor = Sprite_CoopTurn;

    Sprite_CoopTurn.prototype.initialize = function(y) {
        Sprite.prototype.initialize.call(this);
        this._w = 250;
        this._h = 30;
        this.bitmap = new Bitmap(this._w, this._h);
        this.anchor.x = 0.5;
        this.x = Graphics.width / 2;
        this.y = y === undefined ? 4 : y;
        this._key = '';
        this._pulse = 0;
        this.opacity = 0;
    };

    Sprite_CoopTurn.prototype.currentInfo = function() {
        if (!coopOn()) return null;
        if (inScene(Scene_Battle) && BattleManager.isInputting()) {
            const actor = BattleManager.actor();
            const owner = actor ? battleOwnerOf(actor) : 1;
            return { owner: owner, text: 'P' + owner + ' TURN - ' + (actor ? actor.name() : 'Party') };
        }
        // menus: de quien es el menu abierto
        if (CoopState.menuOwner && inScene(Scene_MenuBase)) {
            const n = CoopState.menuOwner;
            const p = coopPlayer(n);
            const actor = n === 1 ? $gameParty.leader() : (p && p.actor());
            return { owner: n, text: 'P' + n + ' MENU' + (actor ? ' - ' + actor.name() : '') };
        }
        // en el mapa: quien elige la respuesta del dialogo
        const n = choiceOwner();
        if (!n) return null;
        const actor = coopPlayer(n).actor();
        return { owner: n, text: 'P' + n + ' CHOOSES' + (actor ? ' - ' + actor.name() : '') };
    };

    Sprite_CoopTurn.prototype.redraw = function(info) {
        const bmp = this.bitmap;
        bmp.clear();
        drawBox(bmp, this._w, this._h, colorOf(info.owner), 0.45);
        bmp.fontFace = mainFont();
        bmp.outlineColor = 'rgba(0,0,0,0.8)';
        bmp.outlineWidth = 3;
        bmp.textColor = '#ffffff';
        bmp.fontSize = 18;
        bmp.drawText(info.text, 10, 0, this._w - 16, this._h, 'center');
    };

    Sprite_CoopTurn.prototype.update = function() {
        Sprite.prototype.update.call(this);
        const info = this.currentInfo();
        if (!info) {
            this._key = '';
            this.opacity = Math.max(0, this.opacity - 40);
            return;
        }
        const key = info.owner + ':' + info.text;
        if (key !== this._key) {
            this._key = key;
            this._pulse = 0;
            this.redraw(info);
        }
        this._pulse++;
        this.opacity = Math.min(215, this.opacity + 40);
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this._coopTurnSprite = new Sprite_CoopTurn();
        this.addChild(this._coopTurnSprite);
    };

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this._coopTurnSprite = new Sprite_CoopTurn();
        this.addChild(this._coopTurnSprite);
    };

    // =========================================================================
    // CAPACIDAD DEL GRUPO Y 5.o INTEGRANTE (SOLO LOOK OUTSIDE)
    // =========================================================================

    const _Game_Party_maxBattleMembers = Game_Party.prototype.maxBattleMembers;
    Game_Party.prototype.maxBattleMembers = function() {
        if ($gameSystem && $gameSystem._unlockedFifthMember) {
            return 5;
        }
        return _Game_Party_maxBattleMembers ? _Game_Party_maxBattleMembers.call(this) : 4;
    };

    function partyCapacity() {
        return ($gameSystem && $gameSystem._unlockedFifthMember) ? 5 : $gameParty.maxBattleMembers();
    }

    Game_Party.prototype.isFull = function() {
        return this._actors.length >= partyCapacity();
    };

    const _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        if (!this._actors.includes(actorId)) {
            if (this._actors.length < partyCapacity()) {
                this._actors.push(actorId);
                $gamePlayer.refresh();
                $gameMap.requestRefresh();
            }
        }
    };

    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);

        if (!isLookOutside()) return;
        if (this._list.some(cmd => cmd.symbol === 'godOfKnowledge')) return;

        const isUnlocked = ($gameSystem && $gameSystem._unlockedFifthMember);
        const text = isUnlocked ? "5° Miembro Activado" : "Dios Conocimiento ($1000)";
        this.addCommand(text, 'godOfKnowledge', !isUnlocked);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('coopAssign', () => SceneManager.push(Scene_CoopAssign));
        this._commandWindow.setHandler('godOfKnowledge', this.commandGodOfKnowledge.bind(this));
    };

    Scene_Menu.prototype.commandGodOfKnowledge = function() {
        if ($gameSystem._unlockedFifthMember) {
            this._commandWindow.activate();
            return;
        }

        const COST = 1000;

        if ($gameParty.gold() >= COST) {
            $gameParty.loseGold(COST);
            $gameSystem._unlockedFifthMember = true;

            $gameMessage.add("\\clDios del Conocimiento:\\cl");
            $gameMessage.add("Has pagado $1000 de oro al Dios del Conocimiento.");
            $gameMessage.add("Ahora tu grupo puede llevar hasta 5 miembros en combate.");

            if (typeof SoundManager !== 'undefined') {
                SoundManager.playShop();
            }
        } else {
            $gameMessage.add("\\clDios del Conocimiento:\\cl");
            $gameMessage.add("No tienes suficiente dinero ($1000 de oro).");
            $gameMessage.add("Vuelve cuando tengas el tributo necesario.");

            if (typeof SoundManager !== 'undefined') {
                SoundManager.playBuzzer();
            }
        }

        this.popScene();
        if (SceneManager._scene instanceof Scene_Map) {
            SceneManager._scene._messageWindow.startMessage();
        }
    };

    // =========================================================================
    // OCULTAR FOLLOWERS
    // =========================================================================

    // Con co-op, los seguidores del juego muestran solo a los personajes que no lleva ningun
    // jugador (los de P2-P4 ya tienen su propio personaje en el mapa). Asi un personaje que el
    // anfitrion "se queda" vuelve a ir detras de P1 como cualquier acompanante.
    if (typeof Game_Follower !== 'undefined') {
        const _Game_Follower_actor = Game_Follower.prototype.actor;
        Game_Follower.prototype.actor = function() {
            if (!coopOn()) return _Game_Follower_actor.call(this);
            const list = $gameParty.battleMembers().filter((a, i) => i === 0 || !mainOwnerOf(a));
            return list[this._memberIndex];
        };
    } else if (typeof Game_Player !== 'undefined' && Game_Player.prototype.showFollowers) {
        const _Game_Player_showFollowers = Game_Player.prototype.showFollowers;
        Game_Player.prototype.showFollowers = function() {
            if (coopOn()) return false;
            return _Game_Player_showFollowers.call(this);
        };
    }

    // =========================================================================
    // PERSONAJE DE P2
    // =========================================================================

    // Look Outside: P2 usa el actor 1/2 (el que no sea P1) copiando el aspecto de P1
    // (no usa $gameParty.leader() a proposito: eso instancia actores y se llamaria a si mismo
    //  mientras se construye uno nuevo)
    function isP2Actor(actor) {
        if (!actor || typeof $gameParty === 'undefined' || !$gameParty || !$dataSystem) return false;
        if (coopMode() !== 'clone') return false;
        const leaderId = $gameParty._actors[0];
        if (!leaderId) return false;
        const p2Id = (leaderId === 2) ? 1 : 2;
        return actor._actorId === p2Id;
    }

    // P2 siempre ocupa el 2.o lugar del grupo y P3 el 3.o (ver battleOwnerOf)
    function moveToSlot(actorId, slot) {
        const arr = $gameParty._actors;
        const i = arr.indexOf(actorId);
        if (i < 0) return;
        arr.splice(i, 1);
        arr.splice(Math.min(slot, arr.length), 0, actorId);
        $gamePlayer.refresh();
        $gameMap.requestRefresh();
    }

    function setupPersistentP2Actor() {
        const p1 = $gameParty.leader();
        if (!p1) return null;

        const p2ActorId = (p1.actorId() === 2) ? 1 : 2;
        const p2 = $gameActors.actor(p2ActorId);

        if (!$gameParty._actors.includes(p2ActorId)) {
            p2.setCharacterImage(p1.characterName(), p1.characterIndex());
            p2.setFaceImage(p1.faceName(), p1.faceIndex());
            p2.setBattlerImage(p1.battlerName());
            p2.changeClass(p1._classId, false);
            p2._equipLocks = [];

            const p1Equips = p1.equips();
            for (let i = 0; i < p1Equips.length; i++) {
                if (p1Equips[i]) {
                    p2.changeEquip(i, p1Equips[i]);
                }
            }

            p2._skills = [];
            const p1Skills = p1.skills();
            for (let i = 0; i < p1Skills.length; i++) {
                p2.learnSkill(p1Skills[i].id);
            }

            p2.changeExp(p1.currentExp(), false);
            p2._hp = p1.hp;
            p2._mp = p1.mp;
            p2.setName(p1.name() + " (P2)");

            $gameParty.addActor(p2ActorId);
        }

        if (p2) {
            p2._equipLocks = [];
        }
        moveToSlot(p2ActorId, 1);
        return p2;
    }

    // Juegos con varios personajes (Fear & Hunger): P2/P3 eligen uno
    function setupSelectedActor(actorId, n) {
        const actor = $gameActors.actor(actorId);
        if (!actor) return null;
        if (!$gameParty._actors.includes(actorId)) {
            $gameParty.addActor(actorId);
            if (!$gameParty._actors.includes(actorId)) return null; // grupo lleno
        }
        moveToSlot(actorId, n - 1);
        return actor;
    }

    // Lista para el selector. Usa los datos de la base sin crear actores nuevos en la partida.
    // Fear & Hunger 2: Termina - los 7 personajes con "SELECT" propio en el juego
    const TERMINA_PLAYABLE = [1, 3, 4, 5, 13, 14, 15];
    // Fear & Hunger 1 - Mercenario, Caballero, Sacerdote oscuro, Forastero y los companeros que se
    // pueden reclutar (Le'garde, Moonless, Nas'hrah); sin monstruos ni actores de prueba
    const FEARHUNGER1_PLAYABLE = [1, 3, 4, 5, 6, 7, 14];

    function defaultActorChoices() {
        const title = gameTitle();
        if (/termina/i.test(title)) return TERMINA_PLAYABLE;
        if (/fear\s*(&|and)\s*hunger/i.test(title)) return FEARHUNGER1_PLAYABLE;
        return [];
    }

    // n = jugador que elige: no puede elegir a los personajes de los jugadores anteriores
    function selectableActors(n) {
        const taken = [$gameParty._actors[0]].concat(extraPlayers().map(p => p._coopActorId));
        const choices = P2_ACTOR_CHOICES.length > 0 ? P2_ACTOR_CHOICES : defaultActorChoices();
        const ids = choices.length > 0
            ? choices
            : $dataActors.map((a, i) => (a && a.name && a.characterName) ? i : 0).filter(i => i > 0);
        return ids
            .filter(id => !taken.includes(id) && $dataActors[id])
            .map(id => {
                const data = $dataActors[id];
                const live = $gameActors._data[id];
                const classId = live ? live._classId : data.classId;
                return {
                    id: id,
                    name: live ? live.name() : data.name,
                    characterName: live ? live.characterName() : data.characterName,
                    characterIndex: live ? live.characterIndex() : data.characterIndex,
                    className: $dataClasses[classId] ? $dataClasses[classId].name : '',
                    level: live ? live.level : data.initialLevel,
                    inParty: $gameParty._actors.includes(id)
                };
            });
    }

    // Equipamiento sin restricciones para el P2 clonado (Look Outside)
    const _Game_Actor_canEquip = Game_Actor.prototype.canEquip;
    Game_Actor.prototype.canEquip = function(item) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_canEquip ? _Game_Actor_canEquip.call(this, item) : true;
    };

    const _Game_Actor_isWeaponProficient = Game_Actor.prototype.isWeaponProficient;
    Game_Actor.prototype.isWeaponProficient = function(wtypeId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isWeaponProficient ? _Game_Actor_isWeaponProficient.call(this, wtypeId) : true;
    };

    const _Game_Actor_isArmorProficient = Game_Actor.prototype.isArmorProficient;
    Game_Actor.prototype.isArmorProficient = function(atypeId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isArmorProficient ? _Game_Actor_isArmorProficient.call(this, atypeId) : true;
    };

    const _Game_Actor_isEquipChangeOk = Game_Actor.prototype.isEquipChangeOk;
    Game_Actor.prototype.isEquipChangeOk = function(slotId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isEquipChangeOk ? _Game_Actor_isEquipChangeOk.call(this, slotId) : true;
    };

    const _Game_Actor_equipSlots = Game_Actor.prototype.equipSlots;
    Game_Actor.prototype.equipSlots = function() {
        if (isP2Actor(this)) {
            const p1 = $gameActors._data[$gameParty._actors[0]];
            if (p1 && p1 !== this) return p1.equipSlots();
        }
        return _Game_Actor_equipSlots.call(this);
    };

    const _Window_EquipItem_includes = Window_EquipItem.prototype.includes;
    Window_EquipItem.prototype.includes = function(item) {
        if (this._actor && isP2Actor(this._actor)) {
            if (item === null) return true;
            if (this._slotId < 0) return false;
            const equipSlots = this._actor.equipSlots();
            return item.etypeId === equipSlots[this._slotId];
        }
        return _Window_EquipItem_includes.call(this, item);
    };

    const _Window_EquipItem_isEnabled = Window_EquipItem.prototype.isEnabled;
    Window_EquipItem.prototype.isEnabled = function(item) {
        if (this._actor && isP2Actor(this._actor)) return true;
        return _Window_EquipItem_isEnabled ? _Window_EquipItem_isEnabled.call(this, item) : true;
    };

    // =========================================================================
    // MENU DE SELECCION DE PERSONAJE PARA P2
    // =========================================================================

    function Window_CoopTitle() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopTitle.prototype = Object.create(Window_Base.prototype);
    Window_CoopTitle.prototype.constructor = Window_CoopTitle;

    Window_CoopTitle.prototype.initialize = function(x, y, w, h, n) {
        this._coopPlayer = n || 2;
        Window_Base.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
    };

    Window_CoopTitle.prototype.refresh = function() {
        this.contents.clear();
        const w = this.contents.width;
        const n = this._coopPlayer;
        this.contents.fontSize = 26;
        this.contents.textColor = colorOf(n);
        this.contents.drawText('PLAYER ' + n + ' - Choose your character', 0, 0, w, 36, 'center');
        this.contents.fontSize = 18;
        this.contents.textColor = '#cfcfcf';
        this.contents.drawText(KEY_HELP[n] || '', 0, 38, w, 26, 'center');
    };

    function Window_CoopActorSelect() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopActorSelect.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopActorSelect.prototype.constructor = Window_CoopActorSelect;
    Window_CoopActorSelect.prototype._coopActors = [];

    Window_CoopActorSelect.prototype.initialize = function(x, y, w, h, actors) {
        this._coopActors = actors;
        this._coopBitmaps = actors.map(a => ImageManager.loadCharacter(a.characterName));
        this._coopPending = true;
        Window_Selectable.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
        this.select(0);
        this.activate();
    };

    // los sprites cargan en segundo plano: redibuja cuando esten listos
    Window_CoopActorSelect.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        if (this._coopPending && this._coopBitmaps.every(b => b.isReady())) {
            this._coopPending = false;
            this.refresh();
        }
    };

    Window_CoopActorSelect.prototype.maxItems = function() {
        return this._coopActors.length;
    };

    Window_CoopActorSelect.prototype.itemHeight = function() {
        return 64;
    };

    Window_CoopActorSelect.prototype.actor = function() {
        return this._coopActors[this.index()] || null;
    };

    Window_CoopActorSelect.prototype.drawItem = function(index) {
        const actor = this._coopActors[index];
        if (!actor) return;
        const rect = this.itemRect(index);
        const pad = this.itemPadding ? this.itemPadding() : this.textPadding();
        const x = rect.x + pad;
        this.drawCharacter(actor.characterName, actor.characterIndex, x + 24, rect.y + 56);
        this.drawText(actor.name, x + 64, rect.y + 14, rect.width - 64 - pad * 2 - 200, 'left');
        this.drawText((actor.className ? actor.className + '  ' : '') + 'Lv' + actor.level +
            (actor.inParty ? '  (in party)' : ''), rect.x + rect.width - pad - 260, rect.y + 14, 260, 'right');
    };

    // =========================================================================
    // GAME_COOPPLAYER (P2 y P3)
    // =========================================================================

    function Game_CoopPlayer() {
        this.initialize.apply(this, arguments);
    }

    Game_CoopPlayer.prototype = Object.create(Game_Character.prototype);
    Game_CoopPlayer.prototype.constructor = Game_CoopPlayer;

    Game_CoopPlayer.prototype.initialize = function(index, actorId) {
        Game_Character.prototype.initialize.call(this);
        this._coopIndex = index;
        this._coopActorId = actorId;
        this.setPriorityType(1);
        this._moveSpeed = 4;
    };

    Game_CoopPlayer.prototype.coopIndex = function() {
        return this._coopIndex;
    };

    Game_CoopPlayer.prototype.actor = function() {
        return this._coopActorId ? $gameActors.actor(this._coopActorId) : null;
    };

    Game_CoopPlayer.prototype.keys = function() {
        return playerInput[this._coopIndex];
    };

    // Velocidad base: la de P1 (si el juego acelera/frena a P1, P2/P3 acompanan) o la fija del parametro
    Game_CoopPlayer.prototype.moveSpeed = function() {
        if (P2_FIXED_SPEED > 0) return P2_FIXED_SPEED;
        return $gamePlayer ? $gamePlayer._moveSpeed : this._moveSpeed;
    };

    Game_CoopPlayer.prototype.isDashing = function() {
        if (!this.keys().shift) return false;
        return coopHooks.every(h => !h.canDash || h.canDash(this));
    };

    Game_CoopPlayer.prototype.realMoveSpeed = function() {
        if (this.isDashing()) {
            return this.moveSpeed() + P2_RUN_BONUS;
        }
        return this.moveSpeed();
    };

    Game_CoopPlayer.prototype.distancePerFrame = function() {
        return Math.pow(2, this.realMoveSpeed()) / 256;
    };

    // P2/P3 no se mueven durante dialogos, eventos ni menus de seleccion
    Game_CoopPlayer.prototype.canMoveCoop = function() {
        return !$gameMap.isEventRunning() && !messageBusy() && !CoopState.selecting;
    };

    Game_CoopPlayer.prototype.syncActorImage = function() {
        const actor = this.actor();
        if (!actor) return;
        if (this._characterName !== actor.characterName() || this._characterIndex !== actor.characterIndex()) {
            this.setImage(actor.characterName(), actor.characterIndex());
        }
    };

    Game_CoopPlayer.prototype.update = function() {
        this.syncActorImage();
        // si el juego oculta al protagonista (escenas), tambien a P2-P4
        if (this.isTransparent() !== $gamePlayer.isTransparent()) this.setTransparent($gamePlayer.isTransparent());
        Game_Character.prototype.update.call(this);

        if (!this.isMoving() && !this.isMoveRouteForcing()) {
            if (CoopState.away[this._coopIndex]) {
                this.followLeader();
            } else if (this.canMoveCoop()) {
                this._through = false;
                this.updateMoveCoop();
            } else {
                this.updateCutsceneFollow();
            }
        }

        if (!CoopState.away[this._coopIndex]) this.triggerInteractionCoop();
    };

    // Va detras de P1 (P2 a 1 casilla, P3 a 2...), atravesando todo para no quedarse atascado
    Game_CoopPlayer.prototype.followLeader = function() {
        const gap = this._coopIndex - 1;
        const dx = Math.abs($gameMap.deltaX(this.x, $gamePlayer.x));
        const dy = Math.abs($gameMap.deltaY(this.y, $gamePlayer.y));
        if (Math.max(dx, dy) <= gap) return;
        this._through = true;
        this.moveTowardCharacter($gamePlayer);
    };

    // Cuando una escena mueve al protagonista (ruta de movimiento), P2-P4 lo siguen como
    // acompanantes, atravesando todo para no estorbar ni quedarse atascados.
    Game_CoopPlayer.prototype.updateCutsceneFollow = function() {
        if (!$gameMap.isEventRunning() || !$gamePlayer.isMoveRouteForcing()) {
            this._through = false;
            return;
        }
        this.followLeader();
    };

    Game_CoopPlayer.prototype.updateMoveCoop = function() {
        const keys = this.keys();
        let horz = 0;
        let vert = 0;

        if (keys.left) horz = 4;
        if (keys.right) horz = 6;
        if (keys.up) vert = 8;
        if (keys.down) vert = 2;

        if (horz !== 0 && vert !== 0) {
            this.moveDiagonally(horz, vert);
        } else if (horz !== 0) {
            this.moveStraight(horz);
        } else if (vert !== 0) {
            this.moveStraight(vert);
        }
    };

    Game_CoopPlayer.prototype.moveStraight = function(d) {
        Game_Character.prototype.moveStraight.call(this, d);
        if (this.isMovementSucceeded()) {
            this.checkEventTriggerHere([1, 2]);
        }
    };

    Game_CoopPlayer.prototype.moveDiagonally = function(horz, vert) {
        Game_Character.prototype.moveDiagonally.call(this, horz, vert);
        if (this.isMovementSucceeded()) {
            this.checkEventTriggerHere([1, 2]);
        }
    };

    // Igual que Game_Player.startMapEvent: en su propia casilla solo cuentan los eventos por
    // debajo / por encima del personaje, y delante solo los que estan a su mismo nivel
    Game_CoopPlayer.prototype.startMapEventCoop = function(x, y, triggers, normal) {
        if ($gameMap.isEventRunning()) return;
        for (const event of $gameMap.eventsXy(x, y)) {
            if (event.isTriggerIn(triggers) && event.isNormalPriority() === normal) {
                startEventAs(this._coopIndex, event);
            }
        }
    };

    Game_CoopPlayer.prototype.checkEventTriggerHere = function(triggers) {
        this.startMapEventCoop(this.x, this.y, triggers, false);
    };

    // delante; a traves de un mostrador, la casilla siguiente (como Game_Player)
    Game_CoopPlayer.prototype.checkEventTriggerThere = function(triggers) {
        const d = this.direction();
        const x2 = $gameMap.roundXWithDirection(this.x, d);
        const y2 = $gameMap.roundYWithDirection(this.y, d);
        this.startMapEventCoop(x2, y2, triggers, true);
        if (!$gameMap.isAnyEventStarting() && $gameMap.isCounter(x2, y2)) {
            this.startMapEventCoop($gameMap.roundXWithDirection(x2, d), $gameMap.roundYWithDirection(y2, d), triggers, true);
        }
    };

    // chocar contra un evento "al tocar" lo activa (como Game_Player)
    Game_CoopPlayer.prototype.checkEventTriggerTouch = function(x, y) {
        this.startMapEventCoop(x, y, [1, 2], true);
    };

    Game_CoopPlayer.prototype.triggerInteractionCoop = function() {
        const keys = this.keys();
        if (!keys.ok) return;

        keys.ok = false;
        if (!this.canMoveCoop()) return;

        this.checkEventTriggerHere([0]);

        if (!$gameMap.isAnyEventStarting()) {
            this.checkEventTriggerThere([0, 1, 2]);
        }
    };

    window.Game_CoopPlayer = Game_CoopPlayer;

    // =========================================================================
    // ENEMIGOS: REACCIONAN AL JUGADOR MAS CERCANO
    // =========================================================================

    const _Game_Event_update = Game_Event.prototype.update;

    // Sistemas del protagonista (disparo, puñalada, rastro de sangre): siempre ven a P1
    // (o al tirador durante un disparo de P2-P4, ver LocalCoop_FearHunger)
    Game_Event.prototype.coopIsPlayerOnly = function() {
        if (this._coopPlayerOnly === undefined) {
            const data = this.event();
            this._coopPlayerOnly = !!data && PLAYER_ONLY_EVENTS.indexOf(data.name) >= 0;
        }
        return this._coopPlayerOnly;
    };

    Game_Event.prototype.update = function() {
        let realX = null;
        let realY = null;
        let nearest = null;

        if (coopOn() && !this.coopIsPlayerOnly()) {
            let best = $gameMap.distance(this.x, this.y, $gamePlayer.x, $gamePlayer.y);
            for (const p of extraPlayers()) {
                const d = $gameMap.distance(this.x, this.y, p.x, p.y);
                if (d < best) {
                    best = d;
                    nearest = p;
                }
            }

            if (nearest) {
                realX = $gamePlayer._x;
                realY = $gamePlayer._y;

                $gamePlayer._x = nearest.x;
                $gamePlayer._y = nearest.y;
            }
        }

        // si el evento "toca al jugador" ahora, en realidad toca al mas cercano
        const startingBefore = CoopState.starting;
        if (realX !== null) CoopState.starting = nearest.coopIndex();
        try {
            _Game_Event_update.call(this);
        } finally {
            CoopState.starting = startingBefore;
            if (realX !== null && realY !== null) {
                $gamePlayer._x = realX;
                $gamePlayer._y = realY;
            }
        }
    };

    const _Game_Event_checkEventTriggerTouch = Game_Event.prototype.checkEventTriggerTouch;

    Game_Event.prototype.checkEventTriggerTouch = function(x, y) {
        _Game_Event_checkEventTriggerTouch.call(this, x, y);

        for (const p of extraPlayers()) {
            if ($gameMap.isEventRunning()) break;
            if (this._trigger === 1 || this._trigger === 2) {
                if (p.x === x && p.y === y) {
                    if (!this.isJumping() && this.isNormalPriority()) {
                        startEventAs(p.coopIndex(), this);
                    }
                }
            }
        }
    };

    // Los eventos cerca de P2/P3 tambien se actualizan aunque esten lejos de la camara de P1
    const _Game_CharacterBase_isNearTheScreen = Game_CharacterBase.prototype.isNearTheScreen;
    Game_CharacterBase.prototype.isNearTheScreen = function() {
        if (_Game_CharacterBase_isNearTheScreen.call(this)) return true;
        if (!coopOn()) return false;
        if (this instanceof Game_CoopPlayer) return true;
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        return extraPlayers().some(p => {
            const dx = Math.abs(this._realX - p._realX) * tw;
            const dy = Math.abs(this._realY - p._realY) * th;
            return dx <= Graphics.width && dy <= Graphics.height;
        });
    };

    // =========================================================================
    // CAMARA
    // =========================================================================

    // Centra la vista (de vpW x vpH pixeles) en un personaje respetando los bordes del mapa
    function cameraFor(target, vpW, vpH) {
        const tilesX = vpW / $gameMap.tileWidth();
        const tilesY = vpH / $gameMap.tileHeight();
        let x = target._realX - (tilesX - 1) / 2;
        let y = target._realY - (tilesY - 1) / 2;

        if (!$gameMap.isLoopHorizontal()) {
            const endX = $gameMap.width() - tilesX;
            x = endX < 0 ? endX / 2 : Math.max(0, Math.min(x, endX));
        }
        if (!$gameMap.isLoopVertical()) {
            const endY = $gameMap.height() - tilesY;
            y = endY < 0 ? endY / 2 : Math.max(0, Math.min(y, endY));
        }
        return { x: x, y: y };
    }

    function applyCamera(cam) {
        $gameMap._displayX = $gameMap.isLoopHorizontal() ? cam.x.mod($gameMap.width()) : cam.x;
        $gameMap._displayY = $gameMap.isLoopVertical() ? cam.y.mod($gameMap.height()) : cam.y;
        $gameMap._parallaxX = cam.x;
        $gameMap._parallaxY = cam.y;
    }

    // Jugador al que sigue una camara individual (CAM_P1 -> 1, CAM_P2 -> 2, CAM_P3 -> 3)
    function cameraPlayerIndex(mode) {
        return mode - CAM_P1 + 1;
    }

    function isPlayerCamera(mode) {
        return mode >= CAM_P2 && mode <= CAM_P4;
    }

    // ---- CAMARA AUTOMATICA ------------------------------------------------------
    // Compartida mientras todos caben en pantalla; dividida cuando alguien se aleja.
    // Para que no parpadee: se divide antes de que nadie llegue al borde, se vuelve a
    // juntar solo cuando estan bastante mas cerca, y cada cambio espera unos cuadros.
    const AUTO_SPLIT_MARGIN = { x: 4, y: 3 };    // casillas libres al dividir
    const AUTO_MERGE_MARGIN = { x: 8, y: 6 };    // casillas libres para volver a juntar
    const AUTO_SPLIT_FRAMES = 10;
    const AUTO_MERGE_FRAMES = 40;
    const autoCamera = { split: false, timer: 0 };

    // Una escena que desplaza la camara ("Desplazar mapa") la controla hasta que termina:
    // el mod no la recentra y se ve con camara compartida.
    const eventCamera = { on: false };

    // lo que se ve ahora mismo: en auto, compartida o dividida
    function viewMode() {
        if (eventCamera.on && (cameraMode === CAM_AUTO || cameraMode === CAM_SPLIT)) return CAM_SHARED;
        if (cameraMode !== CAM_AUTO) return cameraMode;
        return autoCamera.split ? CAM_SPLIT : CAM_SHARED;
    }

    function playersSpread() {
        const players = allPlayers();
        const xs = players.map(p => p._realX);
        const ys = players.map(p => p._realY);
        return { w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
    }

    function resetAutoCamera() {
        autoCamera.split = false;
        autoCamera.timer = 0;
    }

    function updateAutoCamera() {
        if (cameraMode !== CAM_AUTO || !coopOn() || !canSplit()) {
            resetAutoCamera();
            return;
        }
        if ($gameMap.isEventRunning()) { // en escenas no se cambia de camara
            autoCamera.timer = 0;
            return;
        }
        const tilesX = Graphics.width / $gameMap.tileWidth();
        const tilesY = Graphics.height / $gameMap.tileHeight();
        const spread = playersSpread();
        const want = autoCamera.split
            ? !(spread.w < tilesX - AUTO_MERGE_MARGIN.x && spread.h < tilesY - AUTO_MERGE_MARGIN.y)
            : (spread.w > tilesX - AUTO_SPLIT_MARGIN.x || spread.h > tilesY - AUTO_SPLIT_MARGIN.y);
        if (want === autoCamera.split) {
            autoCamera.timer = 0;
            return;
        }
        autoCamera.timer++;
        if (autoCamera.timer >= (want ? AUTO_SPLIT_FRAMES : AUTO_MERGE_FRAMES)) {
            autoCamera.split = want;
            autoCamera.timer = 0;
        }
    }

    const _Game_Player_updateScroll = Game_Player.prototype.updateScroll;

    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        if (!coopOn()) {
            _Game_Player_updateScroll.call(this, lastScrolledX, lastScrolledY);
            return;
        }
        if ($gameMap.isEventRunning()) {
            if ($gameMap.isScrolling()) eventCamera.on = true;
            if (eventCamera.on) return;
        } else {
            eventCamera.on = false;
        }
        if ($gameMap.isScrolling()) return;

        const W = Graphics.width;
        const H = Graphics.height;
        let target = $gamePlayer; // P1 y pantalla dividida (la division se arma aparte)
        const mode = viewMode();

        if (mode === CAM_SHARED) {
            const players = allPlayers();
            target = {
                _realX: players.reduce((s, p) => s + p._realX, 0) / players.length,
                _realY: players.reduce((s, p) => s + p._realY, 0) / players.length
            };
        } else if (isPlayerCamera(mode)) {
            target = coopPlayer(cameraPlayerIndex(mode)) || $gamePlayer;
        }

        applyCamera(cameraFor(target, W, H));
    };

    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (CoopState.selecting) return false;
        return _Game_Player_canMove.call(this);
    };

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if (CoopState.selecting) return; // el mapa se congela mientras P2/P3 eligen personaje
        _Game_Map_update.call(this, sceneActive);
    };

    // =========================================================================
    // VISTA: LUZ DE P2 + PANTALLA DIVIDIDA
    // =========================================================================

    const coopHooks = [];

    const CoopView = {
        // Para plugins de juego concreto (ver LocalCoop_FearHunger.js). Un gancho puede definir:
        //   splitPass(spriteset, indice, jugador) / splitPassEnd(spriteset, indice)
        //   canDash(jugador) -> false para impedir el sprint de P2/P3 (p.ej. con un arma equipada)
        //   lightSources(spriteset) -> fuentes de luz extra (ver coopLightSources)
        registerHook(h) { coopHooks.push(h); },
        hooks: coopHooks,
        maxPlayers: MAX_PLAYERS,
        player(n) { return coopPlayer(n); },
        version: COOP_VERSION,
        isOn() { return coopOn(); },
        player2() { return $gamePlayer2; },
        players() { return extraPlayers(); },
        allPlayers() { return allPlayers(); },
        keys(n) { return playerInput[n] || null; },
        actorOf(player) { return player && player.actor ? player.actor() : null; },
        p2ActorId() { return $gamePlayer2 ? $gamePlayer2._coopActorId || 0 : 0; },
        p2Actor() { return this.actorOf($gamePlayer2); },
        cycleCamera() {
            // salta la pantalla dividida si no se puede y las camaras de jugadores que no estan
            let i = Math.max(0, CAM_ORDER.indexOf(cameraMode));
            do {
                i = (i + 1) % CAM_ORDER.length;
                cameraMode = CAM_ORDER[i];
            } while (((cameraMode === CAM_SPLIT || cameraMode === CAM_AUTO) && !canSplit()) ||
                (isPlayerCamera(cameraMode) && !coopPlayer(cameraPlayerIndex(cameraMode))));
            resetAutoCamera();
            if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
            CoopUI.banner(CAM_NAMES[cameraMode], cameraMode === CAM_AUTO
                ? 'Splits when you walk apart  -  G to change' : 'Press G to change camera', '#bbbbbb', 90);
        },
        banner(title, sub, color, duration) {
            CoopUI.banner(title, sub, color, duration);
        },
        // ---- para el modo en red (LocalCoop_Net) ----
        actions: KEY_ACTIONS,
        // pulsa / suelta una accion (up, down, left, right, ok, cancel, shift) del jugador n, igual
        // que si viniera de su teclado o mando: P1 con sus teclas, P2-P4 como su mando
        injectAction(n, action, down) {
            let ev;
            if (n === 1) {
                const k = P1_NET_KEYS[action];
                if (!k) return;
                ev = { code: k[0], keyCode: k[1], location: k[2] || 0, key: '', repeat: false, preventDefault: function() {}, __net: true };
            } else {
                ev = fakeKeyEvent(padCode(n, action));
                ev.__net = true;
            }
            if (down) {
                Input._onKeyDown(ev);
                coopKeyDown(ev);
            } else {
                Input._onKeyUp(ev);
                coopKeyUp(ev);
            }
        },
        setPadCapture(fn) {
            padCapture = fn || null;
        },
        // al empezar una partida en red: estos jugadores entran solos al cargar el mapa
        forceRestore(players) {
            CoopState.restore = { players: players.slice(), pads: {} };
        },
        setAway(n, on) {
            setPlayerAway(n, !!on);
        },
        awayPlayers() {
            return Object.keys(CoopState.away).map(Number).filter(n => CoopState.away[n]);
        },
        // suelta todas las teclas de todos los jugadores (al cargar el mundo de otro PC)
        clearInputs() {
            for (let n = 2; n <= MAX_PLAYERS; n++) Object.assign(playerInput[n], newPlayerKeys());
            Input.clear();
        },
        // texto extra para la linea de F10 (estado de la red)
        setNetStatus(fn) {
            perf.netStatus = fn || null;
        },
        setCamera(name) {
            if (CAM_BY_NAME[name] !== undefined) cameraMode = CAM_BY_NAME[name];
        },
        // lo que se ve (en auto: compartida o dividida)
        mode() {
            return viewMode();
        },
        // lo elegido con G (puede ser auto = 6)
        cameraSetting() {
            return cameraMode;
        }
    };
    window.CoopLocal = CoopView;

    // Fuentes de luz del jugador: { sprite, pos(jugador) -> [x, y] en pantalla }.
    //  - Imagenes por nombre (Look Outside: "Darkness"). No se filtra por posicion: el juego a veces
    //    las deja desfasadas unos cuadros, y entonces dejarian de reconocerse y taparian todo.
    //  - Las que aporten los ganchos (h.lightSources(spriteset)), p.ej. el circulo de vision de Termina.
    Spriteset_Map.prototype.coopLightSources = function() {
        const list = [];
        if (this._pictureContainer && LIGHT_NAMES.length > 0) {
            for (const s of this._pictureContainer.children) {
                if (!s.picture) continue;
                const pic = s.picture();
                if (pic && LIGHT_NAMES.indexOf(pic.name()) >= 0) {
                    list.push({ sprite: s, pos: p => [p.screenX(), p.screenY()] });
                }
            }
        }
        coopHooks.forEach(h => {
            if (h.lightSources) h.lightSources(this).forEach(d => list.push(d));
        });
        return list;
    };

    // En cada vista solo se dibujan los personajes que caen dentro (con margen para sprites
    // altos): Termina tiene mapas con cientos de eventos y sin esto se dibujaban todos en cada
    // vista. "original" = renderable que tenia cada sprite antes de las vistas.
    const CULL_MARGIN = 240;
    Spriteset_Map.prototype.coopCullCharacters = function(areaW, areaH, original) {
        const list = this._characterSprites;
        for (let k = 0; k < list.length; k++) {
            const sp = list[k];
            if (!original[k]) continue;
            sp.renderable = sp.x > -CULL_MARGIN && sp.x < areaW + CULL_MARGIN &&
                sp.y > -CULL_MARGIN && sp.y < areaH + CULL_MARGIN * 2;
        }
    };

    // Sincroniza posiciones de sprites con la camara actual
    Spriteset_Map.prototype.coopSyncToCamera = function() {
        this.updateParallax();
        this.updateTilemap();
        this.updateWeather();
        for (const s of this._characterSprites) {
            s.updatePosition();
        }
        if (this._balloonSprites) {
            for (const b of this._balloonSprites) {
                if (b.updatePosition) b.updatePosition();
            }
        }
        if (this._destinationSprite) this._destinationSprite.visible = false;

        // capas de imagen de GALV_LayerGraphics (arte de los mapas de Look Outside):
        // se reposicionan sin avanzar su animacion
        for (const c of this._tilemap.children) {
            if (typeof c.lValue === 'function' && typeof c.updatePosition === 'function') {
                const v = c.lValue();
                if (!v) continue;
                const cx = v.currentx;
                const cy = v.currenty;
                c.updatePosition(v);
                v.currentx = cx;
                v.currenty = cy;
            }
        }
    };

    // ---- LUZ COMPARTIDA: une el hueco de luz de todos los jugadores -----------

    Spriteset_Map.prototype.coopSharedLights = function() {
        const sources = this.coopLightSources();
        const r = getRenderer();
        const W = Graphics.width;
        const H = Graphics.height;
        const players = allPlayers();
        this._coopLit = this._coopLit || [];

        for (const d of sources) {
            const l = d.sprite;
            if (this._coopLit.indexOf(l) < 0) this._coopLit.push(l);
            if (!canUnionLights() || !l.visible || !l.texture || !l.texture.valid) {
                l.renderable = true;
                if (l._coopLight) l._coopLight.out.visible = false;
                continue;
            }
            let st = l._coopLight;
            if (!st) {
                st = l._coopLight = {
                    rt: makeRenderTexture(W, H),
                    sprites: [],
                    out: null
                };
                st.out = new PIXI.Sprite(st.rt);
                if (l.parent) l.parent.addChildAt(st.out, l.parent.children.indexOf(l));
            }
            if (st.rt.width !== W || st.rt.height !== H) st.rt.resize(W, H);
            if (!st.out.parent && l.parent) l.parent.addChildAt(st.out, l.parent.children.indexOf(l));

            // el 1.o se copia tal cual; cada uno de los demas multiplica el alfa (DST_IN) y abre su hueco
            while (st.sprites.length < players.length) {
                const s = new PIXI.Sprite(l.texture);
                if (st.sprites.length > 0) s.blendMode = dstInMode();
                st.sprites.push(s);
            }

            players.forEach((p, i) => {
                const s = st.sprites[i];
                s.texture = l.texture;
                s.anchor.set(l.anchor.x, l.anchor.y);
                s.scale.set(l.scale.x, l.scale.y);
                s.position.set.apply(s.position, d.pos(p));
                r.render(s, st.rt, i === 0);
            });

            st.out.visible = true;
            st.out.alpha = l.alpha;
            st.out.blendMode = l.blendMode;
            st.out.z = l.z; // dentro del tilemap se ordena por z
            l.renderable = false;
        }
    };

    Spriteset_Map.prototype.coopLightsOff = function() {
        for (const s of (this._coopLit || [])) {
            if (s._coopLight) {
                s.renderable = true;
                s._coopLight.out.visible = false;
            }
        }
    };

    // ---- PANTALLA DIVIDIDA ------------------------------------------------------

    const SPLIT_GAP = 4;

    function quarters(W, H) {
        const hw = Math.floor((W - SPLIT_GAP) / 2);
        const hh = Math.floor((H - SPLIT_GAP) / 2);
        const x2 = hw + SPLIT_GAP;
        const y2 = hh + SPLIT_GAP;
        return [
            { x: 0, y: 0, w: hw, h: hh }, { x: x2, y: 0, w: hw, h: hh },
            { x: 0, y: y2, w: hw, h: hh }, { x: x2, y: y2, w: hw, h: hh }
        ];
    }

    // Rectangulos de cada vista: 2 jugadores = mitades, 4 = cuadricula de 2x2. Con 3 depende de
    // Split3Layout: triangle (dos arriba, una abajo centrada), grid (2x2 con panel) o big.
    function splitViewports(count, W, H) {
        const hw = Math.floor((W - SPLIT_GAP) / 2);
        const hh = Math.floor((H - SPLIT_GAP) / 2);
        const x2 = hw + SPLIT_GAP;
        const y2 = hh + SPLIT_GAP;
        if (count >= 4) return quarters(W, H);
        if (count === 3 && SPLIT3_LAYOUT === 'grid') return quarters(W, H).slice(0, 3);
        if (count === 3 && SPLIT3_LAYOUT === 'triangle') {
            // dos arriba y una abajo en el centro, las tres del mismo tamano
            const q = quarters(W, H);
            return [q[0], q[1], { x: Math.floor((W - q[2].w) / 2), y: q[2].y, w: q[2].w, h: q[2].h }];
        }
        if (count <= 2) {
            return SPLIT_VERTICAL
                ? [{ x: 0, y: 0, w: hw, h: H }, { x: x2, y: 0, w: hw, h: H }]
                : [{ x: 0, y: 0, w: W, h: hh }, { x: 0, y: y2, w: W, h: hh }];
        }
        return SPLIT_VERTICAL
            ? [{ x: 0, y: 0, w: hw, h: H }, { x: x2, y: 0, w: hw, h: hh }, { x: x2, y: y2, w: hw, h: hh }]
            : [{ x: 0, y: 0, w: W, h: hh }, { x: 0, y: y2, w: hw, h: hh }, { x: x2, y: y2, w: hw, h: hh }];
    }

    // ---- ALEJAR LA CAMARA EN CADA VISTA ----------------------------------------
    // Cada vista dibuja el escenario reducido para ver mas mapa. Lo mas lejos posible es
    // ver tanto como la pantalla entera: el mapa de baldosas, las capas de imagen y las
    // luces solo se calculan para ese tamano.

    let splitZoomStep = SPLIT_ZOOM_START === undefined ? 0 : SPLIT_ZOOM_START;
    const SPLIT_ZOOM_NAMES = ['far (full view)', 'far', 'medium', 'close', 'close (no zoom)'];

    function splitZoomFor(vp, W, H) {
        const min = Math.min(1, Math.max(vp.w / W, vp.h / H));
        return min + (1 - min) * (splitZoomStep / SPLIT_ZOOM_STEPS);
    }

    const KEY_ZOOM_OUT = 189; // -
    const KEY_ZOOM_IN = 187;  // =
    window.addEventListener('keydown', function(e) {
        if (e.keyCode !== KEY_ZOOM_OUT && e.keyCode !== KEY_ZOOM_IN) return;
        if (!coopOn() || viewMode() !== CAM_SPLIT || !inScene(Scene_Map)) return;
        const step = Math.max(0, Math.min(SPLIT_ZOOM_STEPS, splitZoomStep + (e.keyCode === KEY_ZOOM_IN ? 1 : -1)));
        if (step === splitZoomStep) return;
        splitZoomStep = step;
        if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
        CoopUI.banner('Split view: ' + SPLIT_ZOOM_NAMES[step], '-  farther      =  closer', '#bbbbbb', 70);
    });

    // Hueco libre de la cuadricula con 3 jugadores: ahi va el panel del grupo
    function splitPanelRect(count, W, H) {
        return (count === 3 && SPLIT3_LAYOUT === 'grid') ? quarters(W, H)[3] : null;
    }

    function drawGauge(bmp, x, y, w, value, max, color, label) {
        const h = 14;
        bmp.fillRect(x, y, w, h, '#2a2a2a');
        const rate = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
        bmp.fillRect(x, y, Math.floor(w * rate), h, color);
        bmp.fontSize = 13;
        bmp.textColor = '#ffffff';
        bmp.drawText(label + ' ' + value + '/' + max, x + 4, y - 5, w - 8, 24, 'left');
    }

    // Panel con el grupo: de que jugador es cada personaje y sus PV/PM
    function drawCoopPanel(bmp) {
        const w = bmp.width;
        const h = bmp.height;
        bmp.clear();
        bmp.fillRect(0, 0, w, h, '#0c0c10');
        bmp.fontFace = mainFont();
        bmp.outlineColor = 'rgba(0,0,0,0.9)';
        bmp.outlineWidth = 3;
        bmp.fontSize = 20;
        bmp.textColor = '#d8d8d8';
        bmp.drawText('PARTY', 16, 6, w - 32, 28, 'left');
        bmp.fontSize = 15;
        bmp.textColor = '#8a8a8a';
        bmp.drawText('G: camera', 16, 6, w - 32, 28, 'right');

        const members = $gameParty.members().slice(0, 4);
        const rowH = Math.floor((h - 40) / 4);
        const hpLabel = (typeof TextManager !== 'undefined' && TextManager.hpA) || 'HP';
        const mpLabel = (typeof TextManager !== 'undefined' && TextManager.mpA) || 'MP';
        members.forEach((actor, i) => {
            const y = 40 + i * rowH;
            const owner = battleOwnerOf(actor);
            const color = colorOf(owner);
            bmp.fillRect(12, y + 2, 4, rowH - 8, color);
            bmp.fontSize = 18;
            bmp.textColor = color;
            bmp.drawText('P' + owner, 24, y - 2, 40, 24, 'left');
            bmp.textColor = actor.isDead() ? '#888888' : '#ffffff';
            bmp.drawText(actor.name() + (actor.isDead() ? '  (dead)' : ''), 64, y - 2, w - 80, 24, 'left');
            const gw = Math.floor((w - 88) / 2);
            drawGauge(bmp, 24, y + 26, gw, actor.hp, actor.mhp, '#b03a2e', hpLabel);
            drawGauge(bmp, 24 + gw + 16, y + 26, gw, actor.mp, actor.mmp, '#2471a3', mpLabel);
        });
    }

    Spriteset_Map.prototype.coopUpdatePanel = function(scene, rect) {
        const st = this._coopSplit;
        if (!rect) {
            if (st.panel && st.panel.parent) st.panel.parent.removeChild(st.panel);
            return;
        }
        if (!st.panel || st.panel.bitmap.width !== rect.w || st.panel.bitmap.height !== rect.h) {
            if (st.panel && st.panel.parent) st.panel.parent.removeChild(st.panel);
            st.panel = new Sprite(new Bitmap(rect.w, rect.h));
            st.panelTick = 0;
        }
        if (st.panel.parent !== scene) scene.addChildAt(st.panel, Math.max(0, scene.children.indexOf(this)));
        st.panel.x = rect.x;
        st.panel.y = rect.y;
        if (--st.panelTick <= 0) {
            st.panelTick = 15;
            drawCoopPanel(st.panel.bitmap);
        }
    };

    // ---- UN "LIENZO" DE BALDOSAS POR VISTA ------------------------------------------
    // ShaderTilemap rehace la geometria de las baldosas cada vez que la camara cambia de casilla.
    // En pantalla dividida la camara salta de un jugador a otro en cada vista, asi que se rehacia
    // todo varias veces por cuadro. Cada vista tiene ahora sus propias capas de baldosas y solo se
    // rehacen cuando su jugador cambia de casilla (o cuando el juego cambia el mapa).

    function tileCacheOf(tm) {
        if (!tm || !tm.lowerZLayer || !tm.lowerLayer || !tm.upperLayer || typeof PIXI === 'undefined' || !PIXI.tilemap) return null;
        if ($gameMap.useUltraMode7) return null; // Mode 7 dibuja las baldosas a su manera
        if (!tm._coopTileCache) {
            tm._coopTileCache = {
                current: 0,
                views: [{ lower: tm.lowerLayer, upper: tm.upperLayer, startX: tm._lastStartX, startY: tm._lastStartY, dirty: false }]
            };
        }
        return tm._coopTileCache;
    }

    function tileBitmaps(tm) {
        return tm.bitmaps.map(x => x._baseTexture ? new PIXI.Texture(x._baseTexture) : x);
    }

    function newTileView(tm) {
        const parameters = PluginManager.parameters('ShaderTilemap') || {};
        const useSquare = Number(parameters.hasOwnProperty('squareShader') ? parameters['squareShader'] : 0);
        const bitmaps = tileBitmaps(tm);
        const lower = new PIXI.tilemap.CompositeRectTileLayer(0, bitmaps, useSquare);
        lower.shadowColor = new Float32Array([0.0, 0.0, 0.0, 0.5]);
        const upper = new PIXI.tilemap.CompositeRectTileLayer(4, bitmaps, useSquare);
        return { lower: lower, upper: upper, startX: null, startY: null, dirty: true };
    }

    // Pone en el mapa las capas de la vista i (las crea la primera vez)
    function useTileView(tm, cache, i) {
        if (cache.current !== i) {
            const cur = cache.views[cache.current];
            cur.startX = tm._lastStartX;
            cur.startY = tm._lastStartY;
            const v = cache.views[i] || (cache.views[i] = newTileView(tm));
            tm.lowerZLayer.removeChild(tm.lowerLayer);
            tm.upperZLayer.removeChild(tm.upperLayer);
            tm.lowerLayer = v.lower;
            tm.upperLayer = v.upper;
            tm.lowerZLayer.addChildAt(v.lower, 0);
            tm.upperZLayer.addChildAt(v.upper, 0);
            tm._lastStartX = v.startX;
            tm._lastStartY = v.startY;
            cache.current = i;
        }
        const v = cache.views[i];
        if (v.dirty) tm._needsRepaint = true;
        v.dirty = false;
    }

    // Si el juego cambia el tileset, tambien las capas de las demas vistas
    const _ShaderTilemap_refreshTileset = ShaderTilemap.prototype.refreshTileset;
    ShaderTilemap.prototype.refreshTileset = function() {
        _ShaderTilemap_refreshTileset.call(this);
        const cache = this._coopTileCache;
        if (!cache) return;
        const bitmaps = tileBitmaps(this);
        cache.views.forEach((v, i) => {
            if (i === cache.current) return;
            v.lower.setBitmaps(bitmaps);
            v.upper.setBitmaps(bitmaps);
            v.dirty = true;
        });
    };

    const _ShaderTilemap_paintAllTiles = ShaderTilemap.prototype._paintAllTiles;
    ShaderTilemap.prototype._paintAllTiles = function(startX, startY) {
        const t0 = perfNow();
        _ShaderTilemap_paintAllTiles.call(this, startX, startY);
        perfAdd('tiles', t0);
    };

    Spriteset_Map.prototype.coopSplitRender = function() {
        const tViews = perfNow();
        try {
            this.coopSplitRenderViews();
        } finally {
            perfAdd('views', tViews);
        }
    };

    Spriteset_Map.prototype.coopSplitRenderViews = function() {
        const r = getRenderer();
        if (!r) return;
        const scene = this.parent;
        if (!scene) return;

        const W = Graphics.width;
        const H = Graphics.height;
        const players = allPlayers();
        const vps = splitViewports(players.length, W, H);

        let st = this._coopSplit;
        if (!st) {
            st = this._coopSplit = {
                rts: [],
                sprites: [],
                divider: new PIXI.Graphics()
            };
        }
        // Con ventanas por jugador (F9) cada vista se dibuja a pantalla completa (lo que se ve
        // jugando solo) y aqui se reduce a su recuadro; cada ventana la muestra entera.
        st.windowMode = coopWindowsOn();
        const sizes = vps.map(vp => st.windowMode ? { w: W, h: H } : { w: vp.w, h: vp.h });
        while (st.rts.length < vps.length) {
            const size = sizes[st.rts.length];
            const rt = makeRenderTexture(size.w, size.h);
            st.rts.push(rt);
            st.sprites.push(new PIXI.Sprite(rt));
        }
        vps.forEach((vp, i) => {
            if (st.rts[i].width !== sizes[i].w || st.rts[i].height !== sizes[i].h) st.rts[i].resize(sizes[i].w, sizes[i].h);
            st.sprites[i].position.set(vp.x, vp.y);
            st.sprites[i].scale.set(vp.w / sizes[i].w, vp.h / sizes[i].h);
        });

        // orden en la escena: separador (fondo), vistas, y despues el escenario (solo imagenes)
        const used = st.sprites.slice(0, vps.length);
        if (st.divider.parent !== scene || used.some(s => s.parent !== scene) ||
            st.sprites.some((s, i) => i >= vps.length && s.parent)) {
            for (const s of st.sprites) if (s.parent) s.parent.removeChild(s);
            if (st.divider.parent) st.divider.parent.removeChild(st.divider);
            scene.addChildAt(st.divider, 0);
            used.forEach((s, i) => scene.addChildAt(s, i + 1));
        }
        st.divider.clear();
        // fondo negro, marco gris alrededor de cada vista (los huecos sin vista quedan negros)
        st.divider.beginFill(0x000000, 1);
        st.divider.drawRect(0, 0, W, H);
        st.divider.endFill();
        st.divider.beginFill(0x9a9a9a, 1);
        for (const vp of vps) st.divider.drawRect(vp.x - SPLIT_GAP, vp.y - SPLIT_GAP, vp.w + SPLIT_GAP * 2, vp.h + SPLIT_GAP * 2);
        st.divider.endFill();
        st.divider.beginFill(0x000000, 1);
        for (const vp of vps) st.divider.drawRect(vp.x, vp.y, vp.w, vp.h);
        st.divider.endFill();
        this.coopUpdatePanel(scene, splitPanelRect(players.length, W, H));

        // detectar las luces con la camara principal (centrada en P1) antes de moverla
        const sources = this.coopLightSources();
        const lights = sources.map(d => d.sprite);

        const saved = [$gameMap._displayX, $gameMap._displayY, $gameMap._parallaxX, $gameMap._parallaxY];
        const savedTransform = [this.scale.x, this.scale.y, this.x, this.y];
        // personajes ocultos por estar fuera de cada vista (se restauran al final)
        const culled = this._characterSprites.map(sp => sp.renderable);
        // el juego pidio repintar el mapa (cambio de baldosas...): vale para todas las vistas
        const tiles = tileCacheOf(this._tilemap);
        if (tiles && this._tilemap._needsRepaint) tiles.views.forEach(v => { v.dirty = true; });

        this.renderable = true;
        this.children.forEach(c => { c.visible = true; });

        for (let i = 0; i < vps.length; i++) {
            // con ventanas por jugador: la vista de P2-P4 solo hace falta cuando su ventana se actualiza
            if (st.windowMode && i > 0 && !coopWindowDue(players[i].coopIndex())) continue;
            // cada vista con su propia escala (sin el zoom de pantalla del juego, que es para la pantalla entera)
            const zoom = splitZoomFor(sizes[i], W, H);
            this.scale.set(zoom, zoom);
            this.x = Math.round($gameScreen.shake()) * zoom;
            this.y = 0;
            applyCamera(cameraFor(players[i], sizes[i].w / zoom, sizes[i].h / zoom));
            this.coopSyncToCamera();
            this.coopCullCharacters(sizes[i].w / zoom, sizes[i].h / zoom, culled);
            const tLight = perfNow();
            coopHooks.forEach(h => h.splitPass && h.splitPass(this, i, players[i]));
            perfAdd('light', tLight);
            for (const pic of this._pictureContainer.children) {
                pic.renderable = lights.indexOf(pic) >= 0;
            }
            for (const d of sources) {
                const l = d.sprite;
                if (l._coopLight && l._coopLight.out) l._coopLight.out.visible = false;
                const pos = d.pos(players[i]);
                l.x = pos[0];
                l.y = pos[1];
            }
            if (tiles) useTileView(this._tilemap, tiles, i);
            const tDraw = perfNow();
            r.render(this, st.rts[i], true);
            perfAdd('viewDraw', tDraw);
            coopHooks.forEach(h => h.splitPassEnd && h.splitPassEnd(this, i));
        }

        this._characterSprites.forEach((sp, k) => { sp.renderable = culled[k]; });
        $gameMap._displayX = saved[0];
        $gameMap._displayY = saved[1];
        $gameMap._parallaxX = saved[2];
        $gameMap._parallaxY = saved[3];
        this.scale.set(savedTransform[0], savedTransform[1]);
        this.x = savedTransform[2];
        this.y = savedTransform[3];
        this.coopSyncToCamera();

        // el render final del escenario solo dibuja las imagenes (a pantalla completa);
        // el mapa, las luces, el clima, etc. ya estan dentro de cada vista
        this.children.forEach(c => {
            if (c !== this._pictureContainer && c !== this._timerSprite) c.visible = false;
        });
        for (const pic of this._pictureContainer.children) {
            pic.renderable = lights.indexOf(pic) < 0;
        }
    };

    Spriteset_Map.prototype.coopSplitOff = function() {
        const st = this._coopSplit;
        if (!st || !st.active) return;
        st.active = false;
        for (const s of st.sprites) if (s.parent) s.parent.removeChild(s);
        if (st.divider.parent) st.divider.parent.removeChild(st.divider);
        if (st.panel && st.panel.parent) st.panel.parent.removeChild(st.panel);
        this.children.forEach(c => { c.visible = true; });
        for (const pic of this._pictureContainer.children) pic.renderable = true;
        this.coopSyncToCamera();
    };

    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);

        if (!coopOn()) {
            this.coopSplitOff();
            this.coopLightsOff();
            return;
        }

        // con ventanas por jugador siempre hay pantalla dividida: cada ventana copia su vista
        if ((viewMode() === CAM_SPLIT || coopWindowsOn()) && canSplit()) {
            this.coopLightsOff();
            this.coopSplitRender();
            if (this._coopSplit) this._coopSplit.active = true;
        } else {
            this.coopSplitOff();
            this.coopSharedLights();
        }
    };

    const _Spriteset_Map_destroy = Spriteset_Map.prototype.destroy;
    Spriteset_Map.prototype.destroy = function(options) {
        // capas de baldosas de las otras vistas (las del mapa las destruye el propio mapa)
        const tiles = this._tilemap && this._tilemap._coopTileCache;
        if (tiles) {
            tiles.views.forEach((v, i) => {
                if (i === tiles.current) return;
                if (v.lower.destroy) v.lower.destroy({ children: true });
                if (v.upper.destroy) v.upper.destroy({ children: true });
            });
            this._tilemap._coopTileCache = null;
        }
        if (this._coopSplit) {
            this._coopSplit.rts.forEach(rt => rt.destroy(true));
            if (this._coopSplit.panel && this._coopSplit.panel.parent) {
                this._coopSplit.panel.parent.removeChild(this._coopSplit.panel);
            }
            this._coopSplit = null;
        }
        for (const s of (this._coopLit || [])) {
            if (s._coopLight && s._coopLight.rt) {
                s._coopLight.rt.destroy(true);
                s._coopLight = null;
            }
        }
        _Spriteset_Map_destroy.call(this, options);
    };

    // =========================================================================
    // VENTANAS POR JUGADOR (F9)
    // P2..P4 tienen cada uno su propia ventana con su vista (y los dialogos, menus, combate...);
    // la ventana principal muestra la de P1.
    // Sirve para mandar cada ventana a un monitor distinto, p.ej. para jugar en remoto con
    // un programa de streaming por monitor. La ventana principal debe quedar abierta (no
    // minimizada): es la que hace funcionar el juego.
    // =========================================================================

    // ---- MEDIDOR DE RENDIMIENTO (F10) ------------------------------------------
    // Cuanto tarda cada parte por cuadro (media de ~1 s), para saber que hay que aligerar.
    // Los tiempos son de CPU; la copia a las ventanas incluye la espera a la tarjeta grafica.
    const KEY_PERF = 121; // F10
    const perf = { on: false, sum: {}, renders: 0, start: 0, sprite: null, lines: '' };

    function perfNow() {
        return perf.on ? performance.now() : 0;
    }

    function perfAdd(key, t0) {
        if (perf.on) perf.sum[key] = (perf.sum[key] || 0) + (performance.now() - t0);
    }

    function perfReport() {
        const t = performance.now();
        const frames = Math.max(1, perf.renders);
        const ms = key => ((perf.sum[key] || 0) / frames).toFixed(1);
        const fps = perf.start ? Math.round(frames * 1000 / (t - perf.start)) : 0;
        perf.lines = 'FPS ' + fps + '   frame CPU ' + ms('update') + ' ms   views ' + ms('views') +
            ' (light ' + ms('light') + ', draw ' + ms('viewDraw') + ', tiles ' + ms('tiles') + ')   windows: draw ' + ms('winDraw') +
            ' copy ' + ms('winCopy') + '   main ' + ms('main') + '   [' + extraPlayers().length + ' extra, ' +
            Object.keys(coopWindows.list).length + ' win]' + (perf.netStatus ? '   ' + perf.netStatus() : '');
        perf.sum = {};
        perf.renders = 0;
        perf.start = t;
    }

    function perfDraw() {
        const scene = SceneManager._scene;
        if (!perf.on || !scene) return;
        if (!perf.sprite) {
            perf.sprite = new Sprite(new Bitmap(Graphics.width, 24));
            perf.sprite.y = Graphics.height - 24;
            perf.drawn = '';
        }
        if (perf.sprite.parent !== scene) scene.addChild(perf.sprite);
        if (perf.drawn !== perf.lines) {
            const bmp = perf.sprite.bitmap;
            bmp.clear();
            bmp.fillRect(0, 0, bmp.width, bmp.height, 'rgba(0,0,0,0.7)');
            bmp.fontSize = 14;
            bmp.textColor = '#ffffff';
            bmp.drawText(perf.lines || 'measuring...', 6, 0, bmp.width - 12, 24, 'left');
            perf.drawn = perf.lines;
        }
    }

    window.addEventListener('keydown', e => {
        if (e.keyCode !== KEY_PERF || e.repeat) return;
        perf.on = !perf.on;
        perf.sum = {};
        perf.renders = 0;
        perf.start = performance.now();
        perf.lines = '';
        if (!perf.on && perf.sprite && perf.sprite.parent) perf.sprite.parent.removeChild(perf.sprite);
    });

    const _SceneManager_updateMain = SceneManager.updateMain;
    SceneManager.updateMain = function() {
        const t0 = perfNow();
        _SceneManager_updateMain.call(this);
        perfAdd('update', t0);
    };

    const KEY_WINDOWS = 120; // F9
    const coopWindows = {
        on: false,
        list: {},          // jugador -> { win, canvas, ctx }
        closedByUser: {}   // jugador -> true: cerro su ventana a mano, no se vuelve a abrir sola
    };

    function nwAvailable() {
        return typeof nw !== 'undefined' && nw.Window && typeof nw.Window.open === 'function';
    }

    function coopWindowsOn() {
        return coopWindows.on;
    }

    function coopWindowNavigators() {
        const out = [];
        for (const n of Object.keys(coopWindows.list)) {
            const w = coopWindows.list[n];
            if (w.win && w.win.window && w.win.window.navigator) out.push(w.win.window.navigator);
        }
        return out;
    }

    // Las teclas pulsadas en una ventana de jugador se reenvian al juego
    function forwardKey(type, e) {
        const ev = new KeyboardEvent(type, {
            key: e.key, code: e.code, location: e.location, repeat: e.repeat, bubbles: true, cancelable: true,
            ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey
        });
        Object.defineProperty(ev, 'keyCode', { get: () => e.keyCode });
        Object.defineProperty(ev, 'which', { get: () => e.keyCode });
        document.dispatchEvent(ev);
        e.preventDefault();
    }

    function openCoopWindow(n) {
        if (coopWindows.list[n]) return;
        const entry = coopWindows.list[n] = { win: null, canvas: null, ctx: null };
        const url = new URL('coop_view.html', window.location.href).href;
        nw.Window.open(url, { title: 'Termina - Player ' + n, width: 816, height: 624, focus: false }, win => {
            entry.win = win;
            const setup = () => {
                const doc = win.window.document;
                win.window.document.title = 'Termina - Player ' + n;
                entry.canvas = doc.getElementById('view');
                entry.ctx = entry.canvas ? entry.canvas.getContext('2d') : null;
                doc.addEventListener('keydown', e => forwardKey('keydown', e));
                doc.addEventListener('keyup', e => forwardKey('keyup', e));
                doc.addEventListener('dblclick', () => win.toggleFullscreen());
            };
            if (win.window && win.window.document && win.window.document.readyState === 'complete') setup();
            else win.on('loaded', setup);
            win.on('closed', () => {
                if (coopWindows.list[n] === entry) {
                    delete coopWindows.list[n];
                    if (coopWindows.on) coopWindows.closedByUser[n] = true;
                }
            });
        });
    }

    function closeCoopWindow(n) {
        const entry = coopWindows.list[n];
        if (!entry) return;
        delete coopWindows.list[n];
        if (entry.win) entry.win.close(true);
    }

    function closeAllCoopWindows() {
        Object.keys(coopWindows.list).forEach(n => closeCoopWindow(Number(n)));
    }

    // Una ventana por cada jugador P2..P4; la ventana principal pasa a mostrar solo a P1
    function syncCoopWindows() {
        if (!coopWindows.on) return;
        const wanted = {};
        extraPlayers().forEach(p => { wanted[p.coopIndex()] = true; });
        for (const n of Object.keys(coopWindows.list)) {
            if (!wanted[n]) closeCoopWindow(Number(n));
        }
        for (const n of Object.keys(wanted)) {
            if (!coopWindows.list[n] && !coopWindows.closedByUser[n]) openCoopWindow(Number(n));
        }
    }

    function toggleCoopWindows() {
        if (!nwAvailable()) {
            CoopUI.banner('Player windows need the game app', '(not available in a browser)', '#ffaa44', 140);
            return;
        }
        coopWindows.on = !coopWindows.on;
        coopWindows.closedByUser = {};
        if (coopWindows.on) {
            syncCoopWindows();
            CoopUI.banner('Player windows: ON', 'This window = P1. Drag the others to their monitors, double click = fullscreen', '#bbbbbb', 240);
        } else {
            closeAllCoopWindows();
            CoopUI.banner('Player windows: OFF', 'F9 to open them again', '#bbbbbb', 120);
        }
    }

    window.addEventListener('keydown', e => {
        if (e.keyCode === KEY_WINDOWS && !e.repeat) toggleCoopWindows();
    });
    // al recargar (F5) o cerrar el juego no deben quedar ventanas sueltas
    window.addEventListener('beforeunload', closeAllCoopWindows);

    // Las ventanas se actualizan por turnos: el juego va a 60 y cada ventana un cuadro si y otro no;
    // cada jugador va desfasado para que no se dibujen todas las ventanas en el mismo cuadro
    function coopWindowDue(n) {
        const rate = WINDOW_FPS / 60;
        const f = Graphics.frameCount + n * 7;
        return Math.floor(f * rate) !== Math.floor((f - 1) * rate);
    }

    // Se copia al tamano del juego; la ventana lo escala con CSS (lo hace la tarjeta grafica)
    function drawToCoopWindow(n, source) {
        const entry = coopWindows.list[n];
        if (!entry || !entry.ctx) return;
        const t0 = perfNow();
        const canvas = entry.canvas;
        if (canvas.width !== source.width || canvas.height !== source.height) {
            canvas.width = source.width;
            canvas.height = source.height;
        }
        entry.ctx.drawImage(source, 0, 0);
        perfAdd('winCopy', t0);
    }

    function activeSplitForWindows() {
        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map) || !scene._spriteset) return null;
        const st = scene._spriteset._coopSplit;
        return (st && st.active && st.windowMode) ? st : null;
    }

    // Con ventanas: antes del dibujo normal, la escena se dibuja una vez por cada ventana a la que
    // le toca, con solo la vista de ese jugador a pantalla completa (encima van igual los dialogos,
    // carteles, etc.) y se copia. Despues el dibujo normal muestra la vista de P1, no la cuadricula.
    const _Graphics_render = Graphics.render;
    Graphics.render = function(stage) {
        if (perf.on && this._skipCount <= 0) {
            perf.renders++;
            if (performance.now() - perf.start > 1000) perfReport();
            perfDraw();
        }
        const ids = Object.keys(coopWindows.list).map(Number);
        if (ids.length === 0 || !stage || this._skipCount > 0) {
            const tMain = perfNow();
            _Graphics_render.call(this, stage);
            perfAdd('main', tMain);
            return;
        }
        const due = ids.filter(coopWindowDue);
        const st = activeSplitForWindows();
        if (!st) {
            // fuera del mapa (combate, menus...): todos ven la pantalla normal
            const tMain = perfNow();
            _Graphics_render.call(this, stage);
            perfAdd('main', tMain);
            if (this._rendered) due.forEach(n => drawToCoopWindow(n, this._canvas));
            return;
        }
        const saved = st.sprites.map(s => [s.visible, s.x, s.y, s.scale.x, s.scale.y]);
        const dividerVisible = st.divider.visible;
        const panelVisible = st.panel ? st.panel.visible : false;
        const showOnly = i => {
            st.sprites.forEach((s, j) => { s.visible = j === i; });
            st.sprites[i].position.set(0, 0);
            st.sprites[i].scale.set(1, 1);
        };
        st.divider.visible = false;
        if (st.panel) st.panel.visible = false;
        try {
            const order = allPlayers();
            for (const n of due) {
                const i = order.indexOf(coopPlayer(n));
                if (i < 1 || !st.sprites[i] || !st.sprites[i].parent) continue;
                showOnly(i);
                const tDraw = perfNow();
                this._renderer.render(stage);
                if (this._renderer.gl && this._renderer.gl.flush) this._renderer.gl.flush();
                perfAdd('winDraw', tDraw);
                drawToCoopWindow(n, this._canvas);
            }
            showOnly(0);
            const tMain = perfNow();
            _Graphics_render.call(this, stage);
            perfAdd('main', tMain);
        } finally {
            st.sprites.forEach((s, j) => {
                s.visible = saved[j][0];
                s.position.set(saved[j][1], saved[j][2]);
                s.scale.set(saved[j][3], saved[j][4]);
            });
            st.divider.visible = dividerVisible;
            if (st.panel) st.panel.visible = panelVisible;
        }
    };

    // =========================================================================
    // SPRITES DE P2/P3
    // =========================================================================

    Spriteset_Map.prototype.coopAddPlayerSprite = function(player) {
        if (!this._tilemap) return;
        const sprite = new Sprite_Character(player);
        this._characterSprites.push(sprite);
        this._tilemap.addChild(sprite);
    };

    const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;

    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);
        extraPlayers().forEach(p => this.coopAddPlayerSprite(p));
    };

    // =========================================================================
    // SCENE MAP: UNION DE P2/P3/P4
    // =========================================================================

    const _Scene_Map_update = Scene_Map.prototype.update;

    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        if (CoopState.restore && !CoopState.selecting && $gameParty.leader()) {
            this.coopRestoreSession();
        }
        if (CoopState.takes.length > 0) this.coopApplyTakes();

        for (let n = 2; n <= MAX_PLAYERS; n++) {
            const keys = playerInput[n];
            if (keys.join && !coopPlayer(n) && isMapIdle()) {
                keys.join = false;
                this.coopBeginJoin(n);
            }
        }
        if (GAMEPADS) updatePadBindings();
        syncCoopWindows();
        if (coopOn() && !CoopState.selecting) this.coopUpdatePlayerMenus();

        if (coopOn() && !CoopState.selecting) {
            this.coopFollowPartySlots();
            extraPlayers().forEach(p => p.update());
        }
        if (!CoopState.selecting) this.coopUpdateParked();
        updateAutoCamera();
    };

    // Cada jugador conserva su personaje aunque el juego reordene el grupo (Termina lo reordena
    // al reclutar, con "PartyREARRANGE"): al terminar cada evento, el personaje de P2 vuelve al
    // 2.o puesto, el de P3 al 3.o, etc. Si un personaje se va, su jugador toma a otro miembro
    // libre; si no queda ninguno, el jugador "espera" y vuelve solo cuando haya alguien
    // (p.ej. las partes en solitario de la historia con "temporary_party_remove/back").
    Scene_Map.prototype.coopFollowPartySlots = function() {
        if ($gameMap.isEventRunning()) return; // los eventos cambian el grupo en varios pasos
        const actors = $gameParty._actors;
        const leaderId = actors[0];
        const players = [];
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            if (coopPlayer(n)) players.push(n);
        }
        const taken = [leaderId];
        const assign = {};
        // 1) cada uno se queda con su personaje si sigue en el grupo (y no es el lider)
        for (const n of players) {
            const id = coopPlayer(n)._coopActorId;
            if (actors.indexOf(id) > 0 && taken.indexOf(id) < 0) {
                assign[n] = id;
                taken.push(id);
            }
        }
        // 2) quien lo perdio toma el primer miembro libre
        for (const n of players) {
            if (assign[n]) continue;
            const id = actors.find(a => taken.indexOf(a) < 0);
            if (id) {
                assign[n] = id;
                taken.push(id);
            }
        }
        for (let i = players.length - 1; i >= 0; i--) {
            const n = players[i];
            if (assign[n]) continue;
            CoopState.parked[n] = { actorId: coopPlayer(n)._coopActorId };
            this.coopRemovePlayer(n, true);
            CoopUI.banner('Player ' + n + ' is waiting', 'Comes back when someone joins the party', colorOf(n), 160);
        }
        // 4) orden del grupo: lider, personajes de P2..P4, y el resto como estaba
        const order = [leaderId];
        for (const n of players) {
            if (assign[n]) order.push(assign[n]);
        }
        const next = order.concat(actors.filter(a => order.indexOf(a) < 0));
        if (next.join(',') !== actors.join(',')) {
            $gameParty._actors = next;
            $gamePlayer.refresh();
            $gameMap.requestRefresh();
        }
        for (const n of players) {
            const p = coopPlayer(n);
            if (p && assign[n] && p._coopActorId !== assign[n]) {
                p._coopActorId = assign[n];
                CoopUI.banner('Player ' + n + ' is now ' + $gameActors.actor(assign[n]).name(), '', colorOf(n), 110);
            }
        }
    };

    // Jugadores en espera: vuelven en cuanto hay un miembro libre (preferiblemente su personaje)
    Scene_Map.prototype.coopUpdateParked = function() {
        if (!isMapIdle()) return;
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            const parked = CoopState.parked[n];
            if (!parked) continue;
            if (coopPlayer(n)) {
                delete CoopState.parked[n];
                continue;
            }
            const actors = $gameParty._actors;
            const used = [actors[0]].concat(extraPlayers().map(p => p._coopActorId));
            const free = actors.filter(a => used.indexOf(a) < 0);
            if (free.length === 0) return;
            const id = free.indexOf(parked.actorId) >= 0 ? parked.actorId : free[0];
            delete CoopState.parked[n];
            this.spawnPlayer(n, id, true);
            if (coopPlayer(n)) {
                CoopUI.banner('Player ' + n + ' is back', $gameActors.actor(id).name(), colorOf(n), 140);
            }
            return;
        }
    };

    // keepPads = el jugador queda en espera (ver coopFollowPartySlots) y conserva su mando
    Scene_Map.prototype.coopRemovePlayer = function(n, keepPads) {
        const p = coopPlayer(n);
        if (!p) return;
        CoopState.lastActor[n] = p._coopActorId;
        setCoopPlayer(n, null);
        $gamePlayer.refresh(); // su personaje pasa a los seguidores
        if (this._spriteset) {
            const list = this._spriteset._characterSprites;
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i]._character === p) {
                    if (list[i].parent) list[i].parent.removeChild(list[i]);
                    list.splice(i, 1);
                }
            }
        }
        if (isPlayerCamera(cameraMode) && cameraPlayerIndex(cameraMode) === n) cameraMode = CAM_AUTO;
        Object.assign(playerInput[n], newPlayerKeys());
        delete CoopState.away[n];
        if (keepPads) {
            padsOf(n).forEach(index => releasePad(Input, index));
        } else {
            padsOf(n).forEach(unbindPad);
            delete padWanted[n];
        }
        CoopState.lastOwner = 0;
        Input.clear();
        saveCoopSession();
    };

    // Compatibilidad con el nombre del mod original
    Scene_Map.prototype.coopRemovePlayer2 = function() {
        this.coopRemovePlayer(2);
    };

    Scene_Map.prototype.coopBeginJoin = function(n) {
        delete CoopState.parked[n];
        if (n === 2 && coopMode() === 'clone') {
            this.spawnPlayer(2, 0);
            return;
        }

        // Si el grupo tiene un personaje libre (preferiblemente el que llevaba), lo controla
        // directamente. Si no, se le pregunta a que personaje quiere sumar al grupo.
        const free = freeMembers();
        if (free.length > 0) {
            const last = CoopState.lastActor[n];
            this.spawnPlayer(n, free.indexOf(last) >= 0 ? last : free[0]);
            return;
        }
        this.coopOpenSelect(n);
    };

    // Miembros del grupo que no son el lider ni el personaje de ningun jugador
    function freeMembers() {
        const used = [$gameParty._actors[0]].concat(extraPlayers().map(p => p._coopActorId));
        return $gameParty.members().map(a => a.actorId()).filter(id => used.indexOf(id) < 0);
    }

    Scene_Map.prototype.coopOpenSelect = function(n) {
        const actors = selectableActors(n);
        if (actors.length === 0) {
            CoopUI.banner('No characters available', 'Check the P2ActorChoices parameter', '#ffaa44', 140);
            return;
        }
        const w = Math.min(Graphics.boxWidth - 40, 560);
        const rows = Math.min(actors.length, 6);
        const listH = rows * 64 + 36;
        const titleH = 92;
        const total = titleH + listH;
        const x = Math.floor((Graphics.boxWidth - w) / 2);
        const y = Math.max(10, Math.floor((Graphics.boxHeight - total) / 2));

        this._coopTitle = new Window_CoopTitle(x, y, w, titleH, n);
        this._coopSelect = new Window_CoopActorSelect(x, y + titleH, w, listH, actors);
        this._coopSelect.setHandler('ok', this.coopOnSelectOk.bind(this));
        this._coopSelect.setHandler('cancel', this.coopCloseSelect.bind(this));
        this.addWindow(this._coopTitle);
        this.addWindow(this._coopSelect);

        CoopState.selecting = n;
        Input.clear();
        playerInput[n].ok = false;
    };

    Scene_Map.prototype.coopCloseSelect = function() {
        const n = CoopState.selecting;
        if (this._coopSelect) {
            this._windowLayer.removeChild(this._coopSelect);
            this._windowLayer.removeChild(this._coopTitle);
            this._coopSelect = null;
            this._coopTitle = null;
        }
        CoopState.selecting = 0;
        Input.clear();
        if (playerInput[n]) {
            playerInput[n].join = false;
            playerInput[n].ok = false;
        }
    };

    Scene_Map.prototype.coopOnSelectOk = function() {
        const n = CoopState.selecting;
        const actor = this._coopSelect.actor();
        this.coopCloseSelect();
        if (actor) this.spawnPlayer(n, actor.id);
    };

    // quiet = sin sonido ni cartel (al volver a unir jugadores tras cargar partida)
    Scene_Map.prototype.spawnPlayer = function(n, actorId, quiet) {
        const actor = (n === 2 && coopMode() === 'clone') ? setupPersistentP2Actor() : setupSelectedActor(actorId, n);

        if (!actor) {
            if (quiet) return;
            CoopUI.banner('The party is full', 'Make room and press ' + JOIN_KEY_NAME[n] + ' again', '#ffaa44', 140);
            if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer();
            return;
        }

        const player = new Game_CoopPlayer(n, actor.actorId());
        setCoopPlayer(n, player);
        playerInput[n].ok = false; // la tecla con la que se unio no cuenta como "interactuar"
        player.locate($gamePlayer.x, $gamePlayer.y);
        player.setImage(actor.characterName(), actor.characterIndex());

        if (this._spriteset) this._spriteset.coopAddPlayerSprite(player);
        $gamePlayer.refresh(); // su personaje deja de ser un seguidor
        saveCoopSession();
        if (quiet) return;

        if (typeof SoundManager !== 'undefined') {
            SoundManager.playOk();
        }
        CoopUI.banner(JOIN_TEXT.replace('%1', n), actor.name() + '  -  Press G to change camera', colorOf(n), 200);
    };

    // Compatibilidad con el nombre del mod original
    Scene_Map.prototype.spawnPlayer2 = function(actorId) {
        this.spawnPlayer(2, actorId);
    };

    // Tras cargar partida: vuelven los jugadores que estaban (si su puesto en el grupo sigue ocupado)
    // y cada uno recupera su mando si esta conectado.
    Scene_Map.prototype.coopRestoreSession = function() {
        const saved = CoopState.restore;
        CoopState.restore = null;
        const ids = saved.players || [];
        const pads = connectedPads();
        const joined = [];
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            if (ids.indexOf(n) < 0) continue;
            const free = freeMembers();
            if (free.length === 0 && !(n === 2 && coopMode() === 'clone')) break;
            this.spawnPlayer(n, free[0] || 0, true);
            if (!coopPlayer(n)) continue;
            joined.push(n);
            const index = saved.pads ? saved.pads[n] : undefined;
            if (GAMEPADS && index !== undefined) {
                const pad = findPad(pads, index);
                if (pad && pad.connected && !padOwner[index]) bindPad(index, n);
                else padWanted[n] = true;
            }
        }
        if (joined.length === 0) return;
        const waiting = joined.some(n => padWanted[n]);
        CoopUI.banner('Co-op restored: ' + joined.map(n => 'P' + n).join(', '),
            waiting ? 'Press Start on your gamepad to take it back' : 'Press G to change camera', COLOR_P2, 200);
    };

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;

    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);
        resetAutoCamera(); // tras un traslado todos aparecen juntos

        for (const p of extraPlayers()) {
            p.locate($gamePlayer.x, $gamePlayer.y);
            p.straighten();
            p.setTransparent($gamePlayer.isTransparent());

            const actor = p.actor() || $gameParty.members()[p.coopIndex() - 1];
            if (actor) {
                p.setImage(actor.characterName(), actor.characterIndex());
            }
        }
    };

    // Al cargar o empezar partida, P2..P4 se reinician; al cargar, AutoRejoin los vuelve a unir
    function resetCoop() {
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            setCoopPlayer(n, null);
            Object.assign(playerInput[n], newPlayerKeys());
            delete padWanted[n];
        }
        for (const key of Object.keys(padOwner)) {
            releasePad(Input, Number(key));
            delete padOwner[key];
        }
        CoopState.selecting = 0;
        CoopState.lastOwner = 0;
        CoopState.restore = null;
        CoopState.menuOwner = 0;
        CoopState.parked = {};
        CoopState.away = {};
        CoopState.lastActor = {};
        CoopState.takes = [];
    }

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        resetCoop();
        _DataManager_setupNewGame.call(this);
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        resetCoop();
        _DataManager_extractSaveContents.call(this, contents);
        const saved = $gameSystem && $gameSystem._coopSession;
        if (AUTO_REJOIN && saved && saved.players && saved.players.length > 0) {
            CoopState.restore = { players: saved.players.slice(), pads: Object.assign({}, saved.pads) };
        }
    };

    // =========================================================================
    // MENUS DE CADA JUGADOR
    // Cancelar en el mapa abre el menu del juego para ese jugador: solo responden sus
    // teclas, Habilidades/Equipo/Estado van directo a su personaje y no puede cambiar
    // a otro, y Opciones/Salir/Guardar/Formacion quedan solo para P1.
    // =========================================================================

    const P1_ONLY_COMMANDS = ['formation', 'options', 'save', 'load', 'gameEnd', 'debug', 'coopAssign'];

    function menuActorOf(n) {
        const p = coopPlayer(n);
        return n >= 2 && p ? p.actor() : null;
    }

    Scene_Map.prototype.coopCallMenuFor = function(n) {
        const actor = menuActorOf(n);
        if (actor) $gameParty.setMenuActor(actor);
        CoopState.menuOwner = n;
        this.callMenu();
    };

    Scene_Map.prototype.coopUpdatePlayerMenus = function() {
        for (let n = 2; n <= MAX_PLAYERS; n++) {
            const keys = playerInput[n];
            if (!keys.menu) continue;
            if (!coopPlayer(n)) {
                keys.menu = false;
                continue;
            }
            if (!isMapIdle() || !$gameSystem.isMenuEnabled() || SceneManager.isSceneChanging() || $gamePlayer.isMoving()) continue;
            keys.menu = false;
            this.coopCallMenuFor(n);
            return;
        }
    };

    // El menu de P1 (X / Esc) tambien es solo suyo mientras hay co-op
    const _Scene_Map_callMenu = Scene_Map.prototype.callMenu;
    Scene_Map.prototype.callMenu = function() {
        if (!CoopState.menuOwner && coopOn()) CoopState.menuOwner = 1;
        _Scene_Map_callMenu.call(this);
    };

    // De vuelta en el mapa (o si un evento abre el menu) el menu no es de nadie en particular
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        CoopState.menuOwner = 0;
        _Scene_Map_start.call(this);
    };

    const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function() {
        _Window_MenuCommand_makeCommandList.call(this);
        if (CoopState.menuOwner >= 2) {
            this._list = this._list.filter(cmd => P1_ONLY_COMMANDS.indexOf(cmd.symbol) < 0);
        } else if (coopOn() && !this._list.some(cmd => cmd.symbol === 'coopAssign')) {
            // "Co-op" (reparto de personajes) antes de Opciones / Salir
            const command = { name: 'Co-op', symbol: 'coopAssign', enabled: true, ext: null };
            const at = this._list.findIndex(cmd => cmd.symbol === 'options' || cmd.symbol === 'gameEnd');
            if (at >= 0) this._list.splice(at, 0, command);
            else this._list.push(command);
        }
    };

    // Habilidades / Equipo / Estado: directo al personaje del jugador, sin elegir
    const _Scene_Menu_commandPersonal = Scene_Menu.prototype.commandPersonal;
    Scene_Menu.prototype.commandPersonal = function() {
        const actor = menuActorOf(CoopState.menuOwner);
        if (actor) {
            $gameParty.setMenuActor(actor);
            this.onPersonalOk();
            return;
        }
        _Scene_Menu_commandPersonal.call(this);
    };

    // En Habilidades/Equipo/Estado no se puede pasar al personaje de otro (Q/W, flechas del raton)
    const _Scene_MenuBase_nextActor = Scene_MenuBase.prototype.nextActor;
    Scene_MenuBase.prototype.nextActor = function() {
        if (menuActorOf(CoopState.menuOwner)) {
            this.onActorChange();
            return;
        }
        _Scene_MenuBase_nextActor.call(this);
    };

    const _Scene_MenuBase_previousActor = Scene_MenuBase.prototype.previousActor;
    Scene_MenuBase.prototype.previousActor = function() {
        if (menuActorOf(CoopState.menuOwner)) {
            this.onActorChange();
            return;
        }
        _Scene_MenuBase_previousActor.call(this);
    };

    // cartel abajo: "P3 MENU - Marina"
    const _Scene_MenuBase_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function() {
        _Scene_MenuBase_create.call(this);
        if (coopOn() && CoopState.menuOwner) {
            this._coopTurnSprite = new Sprite_CoopTurn(Graphics.height - 34);
            this.addChild(this._coopTurnSprite);
        }
    };

    // =========================================================================
    // REPARTO DE PERSONAJES (menu "Co-op" de P1)
    // El anfitrion elige quien controla en combate a los personajes que no son el principal
    // de ningun jugador: P1..P4 o la IA (combate automatico de RPG Maker).
    // =========================================================================

    // IA: RPG Maker elige la accion del personaje y no se le pide nada a nadie
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        const actor = coopOn() && BattleManager.isInputting() ? BattleManager.actor() : null;
        if (actor && isAiControlled(actor)) {
            actor.makeAutoBattleActions();
            BattleManager.selectNextCommand();
        }
        _Scene_Battle_update.call(this);
    };

    const _Game_Actor_isAutoBattle = Game_Actor.prototype.isAutoBattle;
    Game_Actor.prototype.isAutoBattle = function() {
        if (isAiControlled(this)) return true;
        return _Game_Actor_isAutoBattle.call(this);
    };

    function Window_CoopAssignHelp() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopAssignHelp.prototype = Object.create(Window_Base.prototype);
    Window_CoopAssignHelp.prototype.constructor = Window_CoopAssignHelp;

    Window_CoopAssignHelp.prototype.initialize = function(x, y, w, h) {
        Window_Base.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        const cw = this.contents.width;
        this.contents.fontSize = 24;
        this.drawText('Who controls each character in combat', 0, 0, cw, 'center');
        this.contents.fontSize = 18;
        this.changeTextColor('#cfcfcf');
        this.drawText('Left / Right or OK: change    Cancel: back    (P2-P4 main: away / take it)', 0, 36, cw, 'center');
        this.resetTextColor();
    };

    function Window_CoopAssign() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopAssign.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopAssign.prototype.constructor = Window_CoopAssign;

    Window_CoopAssign.prototype.initialize = function(x, y, w, h) {
        this._takes = {}; // jugador -> true: el anfitrion se queda su personaje al salir del menu
        Window_Selectable.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
        this.select(0);
        this.activate();
    };

    Window_CoopAssign.prototype.maxItems = function() {
        return $gameParty.members().length;
    };

    Window_CoopAssign.prototype.itemHeight = function() {
        return 48;
    };

    Window_CoopAssign.prototype.actorAt = function(index) {
        return $gameParty.members()[index] || null;
    };

    function ownerLabel(owner) {
        return owner === 0 ? 'AI' : 'P' + owner;
    }

    Window_CoopAssign.prototype.drawItem = function(index) {
        const actor = this.actorAt(index);
        if (!actor) return;
        const rect = this.itemRect(index);
        const pad = this.itemPadding ? this.itemPadding() : this.textPadding();
        const y = rect.y + Math.floor((rect.height - this.lineHeight()) / 2);
        const main = mainOwnerOf(actor);
        const away = main >= 2 && !!CoopState.away[main];
        const take = main >= 2 && !!this._takes[main];
        const owner = take ? 1 : (isAiControlled(actor) ? 0 : (main || battleOwnerOf(actor)));
        this.changeTextColor(owner === 0 ? '#bbbbbb' : colorOf(owner));
        this.drawText(main === 1 ? ownerLabel(owner) : '< ' + ownerLabel(owner) + ' >', rect.x + pad, y, 90, 'center');
        this.resetTextColor();
        this.drawText(actor.name(), rect.x + pad + 110, y, rect.width - pad * 2 - 330, 'left');
        this.changeTextColor('#9a9a9a');
        const note = main === 1 ? 'leader (P1)' : (main ? (take ? 'taken from P' + main + ' (P' + main + ' leaves)'
            : (away ? 'P' + main + ' away - AI plays' : 'main character of P' + main)) : 'extra character');
        this.drawText(note, rect.x + rect.width - pad - 220, y, 220, 'right');
        this.resetTextColor();
    };

    // P1, P2... de los jugadores que hay ahora, y despues la IA
    function ownerChoices() {
        const list = [];
        list.push(1);
        extraPlayers().forEach(p => list.push(p.coopIndex()));
        list.push(0);
        return list;
    }

    Window_CoopAssign.prototype.changeOwner = function(step) {
        const actor = this.actorAt(this.index());
        const main = actor ? mainOwnerOf(actor) : 0;
        if (!actor || main === 1) {
            SoundManager.playBuzzer();
            return;
        }
        if (main >= 2) {
            // P3 -> IA (P3 ausente) -> P1 se lo queda (P3 sale al cerrar el menu) -> P3
            if (this._takes[main]) {
                delete this._takes[main];
            } else if (CoopState.away[main]) {
                setPlayerAway(main, false);
                this._takes[main] = true;
            } else {
                setPlayerAway(main, true);
            }
            SoundManager.playCursor();
            this.redrawItem(this.index());
            return;
        }
        const choices = ownerChoices();
        const current = isAiControlled(actor) ? 0 : battleOwnerOf(actor);
        const i = Math.max(0, choices.indexOf(current));
        const next = choices[(i + step + choices.length) % choices.length];
        $gameSystem._coopOwners = $gameSystem._coopOwners || {};
        $gameSystem._coopOwners[actor.actorId()] = next;
        SoundManager.playCursor();
        this.redrawItem(this.index());
    };

    Window_CoopAssign.prototype.processOk = function() {
        this.changeOwner(1);
    };

    Window_CoopAssign.prototype.cursorRight = function() {
        this.changeOwner(1);
    };

    Window_CoopAssign.prototype.cursorLeft = function() {
        this.changeOwner(-1);
    };

    function Scene_CoopAssign() {
        this.initialize.apply(this, arguments);
    }

    Scene_CoopAssign.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_CoopAssign.prototype.constructor = Scene_CoopAssign;

    Scene_CoopAssign.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const w = Graphics.boxWidth;
        const helpH = 96;
        this._coopHelp = new Window_CoopAssignHelp(0, 0, w, helpH);
        this.addWindow(this._coopHelp);
        this._coopList = new Window_CoopAssign(0, helpH, w, Graphics.boxHeight - helpH);
        this._coopList.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._coopList);
    };

    Scene_CoopAssign.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        Object.keys(this._coopList._takes).forEach(n => CoopState.takes.push(Number(n)));
    };

    // De vuelta en el mapa: el jugador sale y su personaje queda para P1, como un acompanante mas
    Scene_Map.prototype.coopApplyTakes = function() {
        while (CoopState.takes.length > 0) {
            const n = CoopState.takes.shift();
            const p = coopPlayer(n);
            if (!p) continue;
            const actor = p.actor();
            this.coopRemovePlayer(n);
            if (actor) {
                $gameSystem._coopOwners = $gameSystem._coopOwners || {};
                $gameSystem._coopOwners[actor.actorId()] = 1;
            }
            $gamePlayer.followers().synchronize($gamePlayer.x, $gamePlayer.y, $gamePlayer.direction());
            CoopUI.banner('P1 took ' + (actor ? actor.name() : 'the character') + ' from Player ' + n,
                'Player ' + n + ' can join again with ' + JOIN_KEY_NAME[n], colorOf(n), 220);
        }
    };

    window.Scene_CoopAssign = Scene_CoopAssign;

    // =========================================================================
    // AJUSTES DEL CO-OP (Opciones > Co-op)
    // Cambian en el juego lo que antes solo se podia tocar en plugins.js. Se guardan con
    // la configuracion del juego (como el volumen) y valen para todas las partidas.
    // =========================================================================

    const SETTINGS_ROWS = [
        { key: 'camera', name: 'Camera', values: ['auto', 'shared', 'split'], labels: ['Auto', 'Shared', 'Split screen'],
            help: 'Auto: shared while everyone is close, split screen when someone walks away. G changes it while playing.' },
        { key: 'splitZoom', name: 'Split screen view', values: ['far', 'medium', 'near'], labels: ['Far (full view)', 'Medium', 'Close'],
            help: 'How far each split view is zoomed out. - and = change it while playing.' },
        { key: 'splitDirection', name: 'Split with 2 players', values: ['vertical', 'horizontal'], labels: ['Side by side', 'Stacked'],
            help: 'With 2 players: one view on each side, or one above the other.' },
        { key: 'split3Layout', name: 'Split with 3 players', values: ['triangle', 'grid', 'big'], labels: ['2 + 1', '2x2 + party panel', 'P1 half screen'],
            help: '2 + 1: three equal views. 2x2: the fourth corner shows the party HP/MP.' },
        { key: 'gamepads', name: 'Gamepads for P2-P4', values: [true, false], labels: ['On (Start joins)', 'Off (P1 only)'],
            help: 'On: Start on a free gamepad joins the next player. Off: gamepads always control P1.' },
        { key: 'p3Keys', name: 'P3 keyboard', values: ['all', 'numpad', 'ijkl'], labels: ['Numpad + IJKL', 'Numpad', 'IJKL'],
            help: 'Keys P3 can use on the keyboard.' },
        { key: 'autoRejoin', name: 'Rejoin after loading', values: [true, false], labels: ['On', 'Off'],
            help: 'On: players that were playing come back by themselves when a save is loaded.' }
    ];

    function cameraSettingName() {
        return ['shared', 'split'].indexOf(String(params.DefaultCameraMode)) >= 0 ? String(params.DefaultCameraMode) : 'auto';
    }

    const coopSettings = {
        camera: cameraSettingName(),
        splitZoom: ['medium', 'near'].indexOf(String(params.SplitZoom)) >= 0 ? String(params.SplitZoom) : 'far',
        splitDirection: SPLIT_VERTICAL ? 'vertical' : 'horizontal',
        split3Layout: SPLIT3_LAYOUT,
        gamepads: GAMEPADS,
        p3Keys: P3_KEY_SET,
        autoRejoin: AUTO_REJOIN
    };

    function applyCoopSettings(changedKey) {
        const st = coopSettings;
        SPLIT_VERTICAL = st.splitDirection !== 'horizontal';
        SPLIT3_LAYOUT = st.split3Layout;
        AUTO_REJOIN = !!st.autoRejoin;
        if (GAMEPADS !== !!st.gamepads || P3_KEY_SET !== st.p3Keys) {
            GAMEPADS = !!st.gamepads;
            P3_KEY_SET = st.p3Keys;
            if (!GAMEPADS) Object.keys(padOwner).forEach(index => unbindPad(Number(index)));
            rebuildKeyTables();
            Input.clear();
        }
        if (!changedKey || changedKey === 'splitZoom') splitZoomStep = SPLIT_ZOOM_STEP[st.splitZoom] || 0;
        if (!changedKey || changedKey === 'camera') {
            if (!changedKey && isPlayerCamera(cameraMode)) return;
            cameraMode = CAM_BY_NAME[st.camera];
            resetAutoCamera();
        }
    }

    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        const config = _ConfigManager_makeData.call(this);
        config.coopSettings = Object.assign({}, coopSettings);
        return config;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        _ConfigManager_applyData.call(this, config);
        const saved = config && config.coopSettings;
        if (!saved) return;
        for (const row of SETTINGS_ROWS) {
            if (row.values.indexOf(saved[row.key]) >= 0) coopSettings[row.key] = saved[row.key];
        }
        applyCoopSettings();
    };

    function Window_CoopText() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopText.prototype = Object.create(Window_Base.prototype);
    Window_CoopText.prototype.constructor = Window_CoopText;

    Window_CoopText.prototype.initialize = function(x, y, w, h) {
        Window_Base.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this._coopText = '';
    };

    Window_CoopText.prototype.setText = function(title, text) {
        const key = title + '|' + text;
        if (key === this._coopText) return;
        this._coopText = key;
        const cw = this.contents.width;
        this.contents.clear();
        this.contents.fontSize = 24;
        this.drawText(title, 0, 0, cw, 'left');
        this.contents.fontSize = 18;
        this.changeTextColor('#cfcfcf');
        this.drawText(text, 0, 36, cw, 'left');
        this.resetTextColor();
    };

    function Window_CoopSettings() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopSettings.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopSettings.prototype.constructor = Window_CoopSettings;

    Window_CoopSettings.prototype.initialize = function(x, y, w, h, helpWindow) {
        this._coopHelp = helpWindow;
        Window_Selectable.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
        this.select(0);
        this.activate();
    };

    Window_CoopSettings.prototype.maxItems = function() {
        return SETTINGS_ROWS.length;
    };

    Window_CoopSettings.prototype.drawItem = function(index) {
        const row = SETTINGS_ROWS[index];
        const rect = this.itemRect(index);
        const pad = this.itemPadding ? this.itemPadding() : this.textPadding();
        const value = coopSettings[row.key];
        const label = row.labels[Math.max(0, row.values.indexOf(value))];
        this.resetTextColor();
        this.drawText(row.name, rect.x + pad, rect.y, rect.width / 2, 'left');
        this.changeTextColor(COLOR_P1);
        this.drawText('< ' + label + ' >', rect.x + rect.width / 2, rect.y, rect.width / 2 - pad, 'right');
        this.resetTextColor();
    };

    Window_CoopSettings.prototype.changeValue = function(step) {
        const row = SETTINGS_ROWS[this.index()];
        if (!row) return;
        const i = Math.max(0, row.values.indexOf(coopSettings[row.key]));
        coopSettings[row.key] = row.values[(i + step + row.values.length) % row.values.length];
        applyCoopSettings(row.key);
        SoundManager.playCursor();
        this.redrawItem(this.index());
    };

    Window_CoopSettings.prototype.processOk = function() {
        this.changeValue(1);
    };

    Window_CoopSettings.prototype.cursorRight = function() {
        this.changeValue(1);
    };

    Window_CoopSettings.prototype.cursorLeft = function() {
        this.changeValue(-1);
    };

    Window_CoopSettings.prototype.updateHelp = function() {
        const row = SETTINGS_ROWS[this.index()];
        if (this._coopHelp && row) this._coopHelp.setText(row.name, row.help);
    };

    Window_CoopSettings.prototype.select = function(index) {
        Window_Selectable.prototype.select.call(this, index);
        this.updateHelp();
    };

    function Scene_CoopSettings() {
        this.initialize.apply(this, arguments);
    }

    Scene_CoopSettings.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_CoopSettings.prototype.constructor = Scene_CoopSettings;

    Scene_CoopSettings.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const w = Graphics.boxWidth;
        const helpH = 96;
        this._coopHelp = new Window_CoopText(0, 0, w, helpH);
        this.addWindow(this._coopHelp);
        this._coopList = new Window_CoopSettings(0, helpH, w, Graphics.boxHeight - helpH, this._coopHelp);
        this._coopList.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._coopList);
        this._coopList.updateHelp();
    };

    Scene_CoopSettings.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        ConfigManager.save();
    };

    window.Scene_CoopSettings = Scene_CoopSettings;

    // Entrada en Opciones: con YEP_OptionsCore, una categoria "Co-op"; sin el, una linea mas
    const COOP_OPTION_HELP = 'Camera, split screen, gamepads and keys of the local co-op.';
    if (typeof Yanfly !== 'undefined' && Yanfly.Param && Array.isArray(Yanfly.Param.OptionsCategories)) {
        const code = text => JSON.stringify(text);
        Yanfly.Param.OptionsCategories.push({
            Name: 'Co-op',
            HelpDesc: code(COOP_OPTION_HELP),
            OptionsList: [{
                Name: 'Co-op settings...',
                Symbol: 'coopSettings',
                HelpDesc: code('Open the local co-op settings.'),
                ShowHide: code('show = true;'),
                Enable: code('enabled = true;'),
                Ext: code('ext = 0;'),
                MakeCommandCode: code('this.addCommand(name, symbol, enabled, ext);'),
                DrawItemCode: code('this.drawOptionsName(index);'),
                ProcessOkCode: code('SoundManager.playOk(); SceneManager.push(Scene_CoopSettings);'),
                CursorRightCode: code(''),
                CursorLeftCode: code(''),
                DefaultConfigCode: code(''),
                SaveConfigCode: code(''),
                LoadConfigCode: code('')
            }]
        });
    } else {
        const _Window_Options_makeCommandList = Window_Options.prototype.makeCommandList;
        Window_Options.prototype.makeCommandList = function() {
            _Window_Options_makeCommandList.call(this);
            this.addCommand('Co-op settings...', 'coopSettings');
        };
        const _Window_Options_statusText = Window_Options.prototype.statusText;
        Window_Options.prototype.statusText = function(index) {
            if (this.commandSymbol(index) === 'coopSettings') return '';
            return _Window_Options_statusText.call(this, index);
        };
        const _Window_Options_processOk = Window_Options.prototype.processOk;
        Window_Options.prototype.processOk = function() {
            if (this.commandSymbol(this.index()) === 'coopSettings') {
                SoundManager.playOk();
                SceneManager.push(Scene_CoopSettings);
                return;
            }
            _Window_Options_processOk.call(this);
        };
        ['cursorRight', 'cursorLeft'].forEach(name => {
            const orig = Window_Options.prototype[name];
            Window_Options.prototype[name] = function(wrap) {
                if (this.commandSymbol(this.index()) === 'coopSettings') return;
                orig.call(this, wrap);
            };
        });
    }

    // =========================================================================
    // GAME OVER CONDICIONAL
    // =========================================================================

    // Igual que el mod original: si muere el personaje de cualquier jugador, se pierde
    const _Game_Party_isAllDead = Game_Party.prototype.isAllDead;

    Game_Party.prototype.isAllDead = function() {
        if (coopOn()) {
            const members = $gameParty.members();

            if (members.length > 1) {
                return members.slice(0, playerCount()).some(m => m.isDead());
            }
        }

        return _Game_Party_isAllDead.call(this);
    };

})();
