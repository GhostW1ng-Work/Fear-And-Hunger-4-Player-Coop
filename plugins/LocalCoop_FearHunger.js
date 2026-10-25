/*:
 * @target MV MZ
 * @plugindesc v1.1.0 Fear & Hunger 1 y 2 (Termina) - luz para P2-P4 (TerraxLighting / vision), disparo de P2-P4 (armas de fuego en Termina, arco en Fear & Hunger 1) y sprint. NO instalar en Look Outside. Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @param ShootRetryFrames
 * @text Cuadros sin disparo antes de reintentar
 * @desc Si el evento de disparo del juego no llega a disparar (sin municion, etc.), espera estos cuadros antes de volver a intentarlo mientras se mantiene la tecla.
 * @type number
 * @min 1
 * @default 20
 *
 * @help
 * Este plugin es para Fear & Hunger 2: Termina y Fear & Hunger 1 (los dos usan el
 * mismo sistema de disparo por eventos de mapa y TerraxLighting). Reconoce el juego
 * por su titulo; en otros juegos solo da la luz y no toca el disparo.
 *
 * Que hace
 * --------
 * 1) LUZ / VISION DE P2/P3: el circulo de vision de los exteriores (GALV_VisibilityRange)
 *    y la luz de TerraxLighting siguen solo al Jugador 1. Este plugin da la misma
 *    luz a P2 y P3 (en camara compartida se unen; en pantalla dividida cada
 *    vista usa la suya).
 *
 * 2) DISPARO DE P2: el disparo en el mapa NO es un plugin: cada mapa
 *    tiene un evento paralelo "arrow_check" que, al mantener Shift con un arma
 *    de fuego equipada, lanza el evento "arrow_player" desde la posicion del
 *    jugador. Cuando P2, P3 o P4 mantienen su tecla de correr (P2: Shift derecho,
 *    P3: Numpad + o H, mando: X o RT) con una pistola, fusil o escopeta (Termina)
 *    o un arco (Fear & Hunger 1) equipado,
 *    el plugin hace que ese mismo evento "vea" a ese jugador (posicion, direccion,
 *    personaje y arma) durante el disparo. Si varios disparan a la vez, se
 *    turnan. Usa la municion compartida del grupo y los mismos efectos del juego.
 *
 * 3) SPRINT DE P2/P3: su tecla de correr copia la velocidad de P1. Igual que en
 *    el juego, con un arma de fuego equipada esa misma tecla dispara en lugar
 *    de correr.
 */

(() => {
    'use strict';

    const coop = window.CoopLocal;
    if (!coop || !coop.registerHook) {
        console.error('LocalCoop_FearHunger: falta LookOutsideOnline.js (debe cargarse ANTES que este plugin).');
        return;
    }

    const params = PluginManager.parameters('LocalCoop_FearHunger') || {};
    const RETRY_FRAMES = Math.max(1, Number(params.ShootRetryFrames || 20));

    // Interruptores comunes a los dos juegos (Termina se hizo sobre el proyecto del primero)
    const SW_GUN_OK = 2251;      // Termina: arma lista / Fear & Hunger 1: BOW_OK
    const SW_CANNOT_USE_BOW = 410;
    const SW_ARROW = 297;        // player_arrow: el disparo esta en curso
    const SW_ARROW_FLYING = 300; // player_arrow2: la flecha/bala esta volando
    const SW_BOW_USED = 299;     // Player_whileBow_used

    // Lo que cambia de un juego a otro:
    //  select: actor -> interruptor "SELECT" con el que arrow_check sabe quien dispara
    //  weapons: tipo -> armas; typeSwitch: tipo -> interruptor del tipo (solo Termina)
    // OJO: en Fear & Hunger 1 los interruptores 2252-2254 son de la historia (Cavemother_visible,
    // Bloodyman1_coming, statue1) y las armas 10/12/13 son lanza, nada y espada: no tocarlos.
    const GAME_PROFILES = {
        termina: {
            select: { 1: 246, 3: 242, 4: 243, 5: 244, 15: 2402, 13: 2403, 14: 2404 },
            weapons: { rifle: [10, 11], shotgun: [12], pistol: [13] },
            typeSwitch: { rifle: 2252, shotgun: 2253, pistol: 2254 }
        },
        fearhunger1: {
            // Mercenario, Caballero, Sacerdote oscuro, Forastero, Le'garde, Marriage (2 actores)
            select: { 1: 246, 3: 242, 4: 243, 5: 244, 6: 245, 9: 375, 11: 375 },
            weapons: { bow: [11, 23] }, // Short bow, Cursed short bow
            typeSwitch: {}
        }
    };

    let profileCache;
    function gameProfile() {
        if (profileCache !== undefined) return profileCache;
        if (typeof $dataSystem === 'undefined' || !$dataSystem) return null;
        const title = String($dataSystem.gameTitle || '');
        if (/termina/i.test(title)) profileCache = GAME_PROFILES.termina;
        else if (/fear\s*(&|and)\s*hunger/i.test(title)) profileCache = GAME_PROFILES.fearhunger1;
        else profileCache = null; // otro juego: solo luz, sin disparo
        return profileCache;
    }

    // =========================================================================
    // ARMA A DISTANCIA DE P2-P4
    // =========================================================================

    function gunTypeOf(actor) {
        const profile = gameProfile();
        if (!actor || !profile) return null;
        const ids = actor.weapons().map(w => w.id);
        for (const type of Object.keys(profile.weapons)) {
            if (profile.weapons[type].some(id => ids.includes(id))) return type;
        }
        return null;
    }

    // Con un arma de fuego equipada, la tecla de correr dispara (igual que el Shift de P1)
    coop.registerHook({
        canDash(player) {
            return !gunTypeOf(coop.actorOf(player));
        }
    });

    // =========================================================================
    // SESION DE DISPARO: durante unos cuadros, los eventos "ven" al tirador como jugador
    // =========================================================================

    let session = null;
    let cooldown = 0;
    let lastShooter = 0;

    function sw(id) {
        return $gameSwitches.value(id);
    }

    function canShoot(player) {
        const keys = coop.keys(player.coopIndex());
        if (!keys || !keys.shift) return false;
        const actor = coop.actorOf(player);
        const profile = gameProfile();
        return !!(actor && profile && profile.select[actor.actorId()] && gunTypeOf(actor));
    }

    // Jugador (P2/P3) que dispara ahora, o null
    function nextShooter() {
        if (!coop.isOn() || session) return null;
        if (!(SceneManager._scene instanceof Scene_Map)) return null;
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return null;
        if (sw(SW_CANNOT_USE_BOW) || sw(SW_ARROW) || sw(SW_ARROW_FLYING)) return null;
        // por turnos: primero los que no dispararon la ultima vez
        const list = coop.players();
        const ordered = list.filter(p => p.coopIndex() > lastShooter)
            .concat(list.filter(p => p.coopIndex() <= lastShooter));
        return ordered.find(canShoot) || null;
    }

    function startSession(player) {
        const actor = coop.actorOf(player);
        const type = gunTypeOf(actor);
        const profile = gameProfile();
        const saved = {};

        // el juego decide con que personaje y que arma se dispara mediante estos interruptores
        // (varios actores pueden compartir el suyo: se guarda una sola vez)
        const shooterSwitch = profile.select[actor.actorId()];
        for (const a of Object.keys(profile.select)) {
            const id = profile.select[a];
            if (!(id in saved)) saved[id] = sw(id);
        }
        for (const id of Object.keys(saved)) $gameSwitches.setValue(Number(id), Number(id) === shooterSwitch);
        for (const t of Object.keys(profile.typeSwitch)) {
            const id = profile.typeSwitch[t];
            saved[id] = sw(id);
            $gameSwitches.setValue(id, t === type);
        }
        saved[SW_GUN_OK] = sw(SW_GUN_OK);

        session = { player: player, frames: 0, sawArrow: false, saved: saved };
        lastShooter = player.coopIndex();
    }

    function endSession() {
        if (!session) return;
        for (const id of Object.keys(session.saved)) {
            $gameSwitches.setValue(Number(id), session.saved[id]);
        }
        session = null;
        cooldown = RETRY_FRAMES;
    }

    // Intercambia temporalmente a P1 con otro jugador (solo mientras corren los eventos del mapa)
    function swapPlayers(other) {
        const p1 = $gamePlayer;
        const p2 = other;
        const keys = ['_x', '_y', '_realX', '_realY', '_direction'];
        const saved = {};
        keys.forEach(k => { saved[k] = p1[k]; p1[k] = p2[k]; });
        return saved;
    }

    function restorePlayers(saved) {
        Object.keys(saved).forEach(k => { $gamePlayer[k] = saved[k]; });
    }

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if (session && coop.player(session.player.coopIndex()) !== session.player) {
            endSession(); // el tirador salio de la partida
        }
        if (!session) {
            _Game_Map_update.call(this, sceneActive);
            return;
        }

        const savedPlayer = swapPlayers(session.player);
        const shiftBefore = Input._currentState.shift;
        Input._currentState.shift = true; // el evento comprueba "boton Shift pulsado"
        try {
            _Game_Map_update.call(this, sceneActive);
        } finally {
            if (shiftBefore === undefined) delete Input._currentState.shift;
            else Input._currentState.shift = shiftBefore;
            restorePlayers(savedPlayer);
        }

        session.frames++;
        const arrow = sw(SW_ARROW);
        if (arrow) session.sawArrow = true;
        const finished = session.sawArrow && !arrow && !sw(SW_BOW_USED);
        const noShot = !session.sawArrow && session.frames > 12;
        if (finished || noShot || session.frames > 240) endSession();
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (cooldown > 0) {
            cooldown--;
        } else {
            const shooter = nextShooter();
            if (shooter) startSession(shooter);
        }
    };

    // =========================================================================
    // LUZ / VISION DE P2
    // =========================================================================

    // GALV_VisibilityRange: el circulo de vision de Termina (una imagen oscura con un hueco)
    // que sigue al jugador. El plugin base une los huecos de todos los jugadores (camara compartida)
    // o lo recoloca para cada vista (pantalla dividida).
    coop.registerHook({
        lightSources(spriteset) {
            const v = spriteset._galvVisRange;
            if (!v) return [];
            return [{ sprite: v, pos: p => [p.screenX(), p.screenY() - 24] }];
        }
    });

    // TerraxLighting: luces de linterna/antorcha alrededor del jugador

    const terraxParams = PluginManager.parameters('TerraxLighting') || {};
    const FLASHLIGHT_OFFSET = Number(terraxParams['Flashlight offset'] || 0);
    let duplicating = false;

    function playerLightMatches(x1, y1) {
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const ex = tw / 2 + ($gamePlayer._realX - $gameMap.displayX()) * tw;
        const ey = th / 2 + ($gamePlayer._realY - $gameMap.displayY()) * th;
        return Math.abs(x1 - ex) <= 2 &&
            (Math.abs(y1 - ey) <= 2 || Math.abs(y1 - (ey - FLASHLIGHT_OFFSET)) <= 2);
    }

    function wrapGradient(name, dirIndex) {
        const orig = Bitmap.prototype[name];
        if (typeof orig !== 'function') return false;
        Bitmap.prototype[name] = function(x1, y1) {
            orig.apply(this, arguments);
            if (duplicating || !coop.isOn() || !$gameMap) return;
            if (coop.mode() === 1) return; // en pantalla dividida cada vista dibuja su propia luz
            if (SceneManager._scene && !(SceneManager._scene instanceof Scene_Map)) return;
            if (!playerLightMatches(x1, y1)) return;

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const base = Array.prototype.slice.call(arguments);
            duplicating = true;
            try {
                for (const p of coop.players()) {
                    const args = base.slice();
                    args[0] = x1 + (p._realX - $gamePlayer._realX) * tw;
                    args[1] = y1 + (p._realY - $gamePlayer._realY) * th;
                    if (dirIndex !== undefined) args[dirIndex] = p._direction;
                    orig.apply(this, args);
                }
            } finally {
                duplicating = false;
            }
        };
        return true;
    }

    const hasTerrax = wrapGradient('radialgradientFillRect') && wrapGradient('radialgradientFillRect2', 6);

    // Pantalla dividida: el mapa de luz se recalcula para cada vista, con el jugador de esa vista
    let splitSwap = null;

    function patchLightmask(lm) {
        const proto = Object.getPrototypeOf(lm);
        if (proto._coopPatched) return;
        proto._coopPatched = true;
        const orig = proto.update;
        proto.update = function() {
            // en pantalla dividida solo se actualiza durante cada vista (ver splitPass)
            if (coop.mode() === 1 && coop.isOn() && !this._coopForce) return;
            orig.call(this);
        };
    }

    coop.registerHook({
        splitPass(spriteset, index, player) {
            const lm = spriteset._lightmask;
            if (!hasTerrax || !lm || typeof lm.update !== 'function') return;
            patchLightmask(lm);
            if (index >= 1) splitSwap = swapPlayers(player);
            lm._coopForce = true;
            try {
                lm.update();
            } finally {
                lm._coopForce = false;
            }
        },
        splitPassEnd() {
            if (splitSwap) {
                restorePlayers(splitSwap);
                splitSwap = null;
            }
        }
    });

    if (!hasTerrax) {
        console.warn('LocalCoop_FearHunger: TerraxLighting no encontrado; P2/P3 no tendran luz propia.');
    }
})();
