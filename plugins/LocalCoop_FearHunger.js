/*:
 * @target MV MZ
 * @plugindesc v1.8.5 Fear & Hunger 1 y 2 (Termina) - luz para P2-P4 (TerraxLighting / vision), disparo de P2-P4 (armas de fuego en Termina, arco en Fear & Hunger 1) y sprint. NO instalar en Look Outside. Requiere LookOutsideOnline.js (cargado antes).
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

        // Termina elige la animacion del fogonazo con FACE_UP / FACE_DOWN / FACE_LEFT / FACE_RIGHT,
        // que un evento comun pone cada pocos cuadros segun hacia donde mira P1: con el tirador
        // mirando a otro lado salia el de P1 (o ninguno). Se ponen ya segun el tirador (despues el
        // mismo evento comun los vuelve a calcular).
        faceSwitches().forEach(f => $gameSwitches.setValue(f.id, f.dir === player.direction()));

        session = { player: player, frames: 0, sawArrow: false, saved: saved };
        lastShooter = player.coopIndex();
    }

    let faceCache = null;
    function faceSwitches() {
        if (!faceCache) {
            const names = { FACE_UP: 8, FACE_DOWN: 2, FACE_LEFT: 4, FACE_RIGHT: 6 };
            faceCache = ($dataSystem.switches || []).map((n, id) => ({ id: id, dir: names[String(n || '').trim().toUpperCase()] }))
                .filter(f => f.dir);
        }
        return faceCache;
    }

    function endSession() {
        if (!session) return;
        shotInterpreters().forEach(it => markStarter(it, 0)); // los disparos de P1 siguen siendo de P1
        for (const id of Object.keys(session.saved)) {
            $gameSwitches.setValue(Number(id), session.saved[id]);
        }
        session = null;
        cooldown = RETRY_FRAMES;
    }

    // Los eventos del disparo ("arrow_check", "arrow_player" y los eventos comunes que llaman)
    // durante el disparo de P2-P4: "el jugador" es el tirador (mostrar animacion, ruta de
    // movimiento...). El intercambio de abajo solo le da al protagonista la posicion y direccion
    // del tirador, asi que la animacion del fogonazo salia en P1.
    const SHOT_EVENTS = ['arrow_check', 'arrow_player'];
    const _Game_Interpreter_character = Game_Interpreter.prototype.character;
    Game_Interpreter.prototype.character = function(param) {
        if (session && param < 0 && !$gameParty.inBattle() && this._eventId > 0) {
            const ev = $gameMap.event(this._eventId);
            const data = ev && ev.event();
            if (data && SHOT_EVENTS.indexOf(data.name) >= 0) return session.player;
        }
        return _Game_Interpreter_character.call(this, param);
    };

    // Lo que pone en marcha el disparo de P2-P4 (los eventos del disparo, un enemigo que empieza
    // por el impacto, los eventos comunes que reservan) es "de" el tirador: asi un combate por un
    // disparo es del tirador (combates aparte en red) y no de P1.
    function shotInterpreters() {
        return $gameMap.events().filter(ev => ev && ev.event() && SHOT_EVENTS.indexOf(ev.event().name) >= 0 && ev._interpreter)
            .map(ev => ev._interpreter);
    }

    function markStarter(interp, n) {
        for (let it = interp; it; it = it._childInterpreter) it._coopStarter = n;
    }

    // (los eventos paralelos vuelven a empezar su lista sin parar: al empezarla, otra vez del tirador)
    const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function(list, eventId) {
        _Game_Interpreter_setup.call(this, list, eventId);
        if (session && eventId > 0) {
            const ev = $gameMap.event(eventId);
            const data = ev && ev.event();
            if (data && SHOT_EVENTS.indexOf(data.name) >= 0) this._coopStarter = session.player.coopIndex();
        }
    };

    const _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        _Game_Event_start.call(this);
        if (session && this._starting) this._coopStarter = session.player.coopIndex();
    };

    const _Game_Temp_reserveCommonEvent = Game_Temp.prototype.reserveCommonEvent;
    Game_Temp.prototype.reserveCommonEvent = function(commonEventId) {
        _Game_Temp_reserveCommonEvent.call(this, commonEventId);
        if (session) this._coopReservedBy = session.player.coopIndex();
    };

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

        shotInterpreters().forEach(it => markStarter(it, session.player.coopIndex()));
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
        // termina cuando la bala / flecha ya no vuela (si no, el resto del vuelo y el impacto
        // salian desde P1)
        if (sw(SW_ARROW_FLYING)) session.sawArrow = true;
        const finished = session.sawArrow && !arrow && !sw(SW_BOW_USED) && !sw(SW_ARROW_FLYING);
        const noShot = !session.sawArrow && session.frames > 12;
        if (finished || noShot || session.frames > 600) endSession();
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


    // =========================================================================
    // RESURRECCION CON UN CAMARADA DE ALMA (Soul stone / Lesser soul)
    // =========================================================================
    // Quien muere (de un jugador o un companero) deja su cuerpo donde estaba. Con una piedra de
    // alma llena (Termina: "Soul stone"; Fear & Hunger 1: "Lesser soul") cualquier jugador que
    // se ponga junto al cuerpo y pulse OK puede devolverlo: la piedra se gasta, vuelve con parte
    // de la vida y la mente (Opciones > Co-op) y quien lo hace pierde mente. El juego, al morir
    // alguien, lo saca del grupo y enciende sus interruptores de "muerto" (evento comun
    // "deathCheck"); al volver se apagan y, en Termina, desaparece el cadaver que el juego deja.

    coop.addSettings([
        { key: 'reviveHp', name: 'Revived with', values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], default: 2,
            labels: ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
            help: 'HP and mind of a character brought back from the dead with a soul stone.' },
        { key: 'reviveCost', name: 'Mind cost of reviving', values: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], default: 3,
            labels: ['None', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
            help: 'Whoever uses the soul stone on a body loses this much of their max mind.' }
    ], true);

    const SOUL_STONE_ID = 116; // los dos juegos: la piedra con un alma dentro

    function soulStone() {
        if (typeof $dataItems === 'undefined' || !$dataItems) return null;
        const it = $dataItems[SOUL_STONE_ID];
        if (it && /soul/i.test(it.name) && !/not_use/i.test(it.name)) return it;
        return $dataItems.find(i => i && /^(lesser soul|soul stone)$/i.test(i.name)) || null;
    }

    // (si el unico otro jugador murio ya no hay co-op en marcha, pero su cuerpo sigue ahi)
    function reviveOn() {
        return (coop.isOn() || Object.keys(coop.waiting()).length > 0 || ($gameSystem && ($gameSystem._coopCorpses || []).length > 0)) &&
            coop.setting('deathRule') !== 'gameover' && !!gameProfile() && !!soulStone();
    }

    // lo que el juego hace al morir cada personaje (para deshacerlo al volver)
    let deathEffects = null;
    function deathEffectsOf(actorId) {
        if (!deathEffects) {
            deathEffects = {};
            const ce = ($dataCommonEvents || []).find(e => e && /^deathCheck$/i.test(e.name));
            let cur = null;
            let indent = 0;
            (ce ? ce.list : []).forEach(c => {
                const p = c.parameters;
                if (cur && c.indent <= indent && c.code !== 0) cur = null;
                if (c.code === 111 && p[0] === 4 && p[2] === 6 && p[3] === 1) {
                    cur = deathEffects[p[1]] = { switches: [], vars: [], spawn: 0 };
                    indent = c.indent;
                    return;
                }
                if (!cur) return;
                if (c.code === 121 && p[2] === 0) {
                    for (let id = p[0]; id <= p[1]; id++) cur.switches.push(id);
                } else if (c.code === 122 && p[2] === 2 && p[3] === 0) {
                    for (let id = p[0]; id <= p[1]; id++) cur.vars.push({ id: id, value: Number(p[4]) || 0 });
                } else if (c.code === 355 || c.code === 655) {
                    const m = /SPAWN\.event\((\d+)/.exec(p[0]);
                    if (m) cur.spawn = Number(m[1]);
                }
            });
        }
        return deathEffects[actorId] || { switches: [], vars: [], spawn: 0 };
    }

    function corpses() {
        if (!$gameSystem._coopCorpses) $gameSystem._coopCorpses = [];
        return $gameSystem._coopCorpses;
    }

    // El cuerpo que pone el propio juego (Fear & Hunger 1, y el mismo sistema en Termina): en cada
    // mapa hay un evento ("DeadDarkpriest"...) que, con el interruptor de "muerto" encendido, se
    // pone donde esta P1, enciende el de "cuerpo" ("DarkpriestBODY") y apaga el de "muerto"; con el
    // de "cuerpo" se ve el cadaver. Se mira en los datos del mapa actual que interruptores son.
    let bodySwitchCache = { mapId: -1, byActor: {} };
    function bodySwitchesOf(actorId) {
        if (bodySwitchCache.mapId !== $gameMap.mapId()) bodySwitchCache = { mapId: $gameMap.mapId(), byActor: {} };
        if (bodySwitchCache.byActor[actorId]) return bodySwitchCache.byActor[actorId];
        const killed = deathEffectsOf(actorId).switches;
        const out = [];
        (($dataMap && $dataMap.events) || []).forEach(ev => {
            if (!ev) return;
            ev.pages.forEach(pg => {
                const c = pg.conditions;
                if (!c.switch1Valid || killed.indexOf(c.switch1Id) < 0) return;
                pg.list.forEach(cmd => {
                    if (cmd.code !== 121 || cmd.parameters[2] !== 0) return;
                    for (let id = cmd.parameters[0]; id <= cmd.parameters[1]; id++) {
                        if (killed.indexOf(id) < 0 && out.indexOf(id) < 0) out.push(id);
                    }
                });
            });
        });
        bodySwitchCache.byActor[actorId] = out;
        return out;
    }

    // el evento del cadaver del juego de este personaje, si se ve en este mapa
    function gameBodyEvent(actorId) {
        const bodySw = bodySwitchesOf(actorId).filter(id => $gameSwitches.value(id));
        if (bodySw.length === 0) return null;
        return $gameMap.events().find(e => {
            const pg = e && e.page();
            return pg && pg.conditions.switch1Valid && bodySw.indexOf(pg.conditions.switch1Id) >= 0;
        }) || null;
    }

    // el cuerpo esta donde se murio (game: lo dibuja el propio juego)
    function bodyPos(c) {
        const ev = c.mapId === $gameMap.mapId() ? gameBodyEvent(c.actorId) : null;
        return { x: c.x, y: c.y, game: !!ev };
    }

    function corpseAt(x, y) {
        const mapId = $gameMap.mapId();
        return corpses().find(c => c.mapId === mapId && c.x === x && c.y === y && !$gameParty._actors.includes(c.actorId)) || null;
    }

    // El evento del cadaver del juego vuelve a su sitio inicial al salir del mapa y entrar otra
    // vez (y con el interruptor de "cuerpo" se ve en cualquier mapa): se queda donde se murio, y
    // en los demas mapas no se ve.
    function keepGameBodies() {
        const mapId = $gameMap.mapId();
        corpses().forEach(c => {
            if ($gameParty._actors.includes(c.actorId)) return;
            const ev = gameBodyEvent(c.actorId);
            if (!ev) return;
            if (c.mapId !== mapId) ev.erase();
            else if (ev.x !== c.x || ev.y !== c.y) ev.locate(c.x, c.y);
        });
    }

    const _Game_Map_update_bodies = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if ($gameSystem._coopCorpses && $gameSystem._coopCorpses.length > 0 && this.mapId() > 0) keepGameBodies();
        _Game_Map_update_bodies.call(this, sceneActive);
    };

    // casilla para el cuerpo: la suya, o una de al lado sin otro evento (el cadaver de un enemigo
    // lo taparia)
    function freeTileNear(ch) {
        const tiles = [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
        for (const t of tiles) {
            const x = ch.x + t[0];
            const y = ch.y + t[1];
            if ($gameMap.isValid(x, y) && $gameMap.isPassable(x, y, 2) && $gameMap.eventsXy(x, y).length === 0 &&
                !corpses().some(c => c.mapId === $gameMap.mapId() && c.x === x && c.y === y)) return { x: x, y: y };
        }
        return { x: ch.x, y: ch.y };
    }

    // el cadaver que el juego crea justo despues ("Galv.SPAWN.event(n, x de P1, y de P1)") va al cuerpo
    let pendingSpawn = null;
    if (typeof Galv !== 'undefined' && Galv.SPAWN && Galv.SPAWN.event) {
        const _spawnEvent = Galv.SPAWN.event;
        Galv.SPAWN.event = function(id, x, y, save) {
            if (pendingSpawn && Number(id) === pendingSpawn.id && typeof x === 'number') {
                x = pendingSpawn.x;
                y = pendingSpawn.y;
                pendingSpawn = null;
            }
            return _spawnEvent.call(this, id, x, y, save);
        };
    }

    // al morir, el juego lo saca del grupo: ahi queda su cuerpo
    const _Game_Party_removeActor = Game_Party.prototype.removeActor;
    Game_Party.prototype.removeActor = function(actorId) {
        const actor = $gameActors.actor(actorId);
        if (this._actors.includes(actorId) && actor && actor.isDead() && reviveOn() && $gameMap && $gameMap.mapId() > 0) {
            // en Termina el cadaver del juego sale donde esta P1; en Fear & Hunger 1 (sin cadaver)
            // donde estaba el jugador que lo llevaba
            const who = coop.players().find(pl => pl._coopActorId === actorId);
            const pos = freeTileNear(who || $gamePlayer);
            const list = corpses().filter(c => c.actorId !== actorId);
            list.push({ actorId: actorId, mapId: $gameMap.mapId(), x: pos.x, y: pos.y });
            $gameSystem._coopCorpses = list;
            const spawn = deathEffectsOf(actorId).spawn;
            if (spawn) pendingSpawn = { id: spawn, x: pos.x, y: pos.y };
        }
        _Game_Party_removeActor.call(this, actorId);
    };

    function reviveEventList(c, n) {
        const actor = $gameActors.actor(c.actorId);
        const stone = soulStone();
        return [
            { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
            { code: 401, indent: 0, parameters: [actor.name() + "'s body."] },
            { code: 401, indent: 0, parameters: ['Use the ' + stone.name + ' to bring ' + actor.name() + ' back?'] },
            { code: 102, indent: 0, parameters: [['Yes', 'No'], 1, 0, 2, 0] },
            { code: 402, indent: 0, parameters: [0, 'Yes'] },
            { code: 355, indent: 1, parameters: ['CoopRevive.revive(' + c.actorId + ', ' + n + ')'] },
            { code: 0, indent: 1, parameters: [] },
            { code: 402, indent: 0, parameters: [1, 'No'] },
            { code: 0, indent: 1, parameters: [] },
            { code: 404, indent: 0, parameters: [] },
            { code: 0, indent: 0, parameters: [] }
        ];
    }

    // OK junto a un cuerpo (encima o delante): true = la pulsacion fue para el cuerpo
    function tryCorpse(character, n, there) {
        if (!reviveOn() || !(SceneManager._scene instanceof Scene_Map) || $gameMap.isEventRunning()) return false;
        const x = there ? $gameMap.roundXWithDirection(character.x, character.direction()) : character.x;
        const y = there ? $gameMap.roundYWithDirection(character.y, character.direction()) : character.y;
        const c = corpseAt(x, y);
        if (!c) return false;
        const actor = $gameActors.actor(c.actorId);
        const stone = soulStone();
        if (!$gameParty.hasItem(stone)) {
            coop.banner(actor.name() + "'s body", 'A ' + stone.name + ' could bring them back', '#9fb6ff', 150);
            // (el cadaver del juego sigue con lo suyo: en Fear & Hunger 1 se puede atrapar su alma)
            return !deathEffectsOf(c.actorId).spawn && !bodyPos(c).game;
        }
        const it = $gameMap._interpreter;
        const list = reviveEventList(c, n);
        it.setup(list, 0);
        it._coopStarter = n; // elige la respuesta quien lo pidio
        it._coopRevive = list;
        return true;
    }

    function reviveRunning() {
        const it = $gameMap._interpreter;
        return it.isRunning() && it._coopRevive === it._list;
    }

    function hookTriggers(proto, playerOf) {
        ['checkEventTriggerHere', 'checkEventTriggerThere'].forEach(name => {
            const orig = proto[name];
            if (!orig) return;
            proto[name] = function(triggers) {
                if (reviveRunning()) return;
                if (triggers && triggers.includes(0) && tryCorpse(this, playerOf(this), name === 'checkEventTriggerThere')) return;
                orig.call(this, triggers);
            };
        });
    }
    hookTriggers(Game_Player.prototype, () => 1);
    if (window.Game_CoopPlayer) hookTriggers(Game_CoopPlayer.prototype, pl => pl.coopIndex());

    function revive(actorId, n) {
        const c = corpses().find(k => k.actorId === actorId);
        const actor = $gameActors.actor(actorId);
        const stone = soulStone();
        if (!c || !actor || !stone || $gameParty._actors.includes(actorId)) return;
        if (!$gameParty.hasItem(stone)) {
            coop.banner('No ' + stone.name, '', '#ff7766', 120);
            return;
        }
        $gameParty.loseItem(stone, 1);
        $gameSystem._coopCorpses = corpses().filter(k => k !== c);
        // lo que el juego hizo al morir
        const fx = deathEffectsOf(actorId);
        fx.switches.forEach(id => $gameSwitches.setValue(id, false));
        bodySwitchesOf(actorId).forEach(id => $gameSwitches.setValue(id, false));
        fx.vars.forEach(v => $gameVariables.setValue(v.id, $gameVariables.value(v.id) + v.value));
        if (fx.spawn && typeof Galv !== 'undefined' && Galv.SPAWN && Galv.SPAWN.unspawn) {
            $gameMap.events().filter(e => e && e.isSpawnEvent && e._spawnEventId === fx.spawn &&
                Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1).forEach(e => Galv.SPAWN.unspawn(e));
        }
        // vuelve con parte de la vida y la mente
        const part = (Number(coop.setting('reviveHp')) || 30) / 100;
        actor.removeState(actor.deathStateId());
        actor.setHp(Math.max(1, Math.round(actor.mhp * part)));
        actor.setMp(Math.round(actor.mmp * part));
        $gameParty.addActor(actorId);
        // y quien lo trajo lo paga con la mente
        const helper = n === 1 ? $gameParty.leader() : coop.actorOf(coop.player(n));
        const cost = (Number(coop.setting('reviveCost')) || 0) / 100;
        if (helper && helper !== actor && cost > 0) helper.setMp(helper.mp - Math.round(helper.mmp * cost));
        removeBodyPictures(actorId);
        $gameScreen.startFlash([170, 200, 255, 170], 45);
        SoundManager.playRecovery();
        coop.banner(actor.name() + ' is back from the dead', (helper && cost > 0 ? helper.name() + ' paid with their mind' : ''), '#9fb6ff', 200);
        $gamePlayer.refresh();
        $gameMap.requestRefresh();
    }

    // truco en el menu "Co-op": una piedra con alma
    coop.addAssignAction({
        cheat: true,
        name() {
            const stone = soulStone();
            return 'Cheat: get 1 ' + (stone ? stone.name : 'soul stone');
        },
        run() {
            const stone = soulStone();
            if (!stone) {
                SoundManager.playBuzzer();
                return;
            }
            $gameParty.gainItem(stone, 1);
            SoundManager.playShop();
        }
    });

    // ---- trucos de Fear & Hunger (con "Cheats" en Opciones > Co-op > Co-op settings) ----------
    coop.addSettings([
        { key: 'cheatUnlock', name: '  Cheat: open locks', values: [false, true], labels: ['Off', 'On'], after: 'cheatOneShot',
            help: 'Needs Cheats On. Doors, chests and cells that ask for a key or a lockpick open as if you had it.' }
    ], true);

    // llaves y ganzuas: "Small key", "Cell keys F3", "Master key", "Lockpick"... (no "Bottle of whiskey")
    const KEY_ITEM = /\bkeys?\b|lockpick/i;

    // "Si: tiene el objeto X" con una llave: si
    const _Game_Interpreter_command111 = Game_Interpreter.prototype.command111;
    Game_Interpreter.prototype.command111 = function() {
        const p = this._params;
        if (p[0] === 8 && coop.cheat('cheatUnlock') && $dataItems[p[1]] && KEY_ITEM.test($dataItems[p[1]].name) &&
            !$gameParty.hasItem($dataItems[p[1]])) {
            this._branch[this._indent] = true;
            return true;
        }
        return _Game_Interpreter_command111.call(this);
    };

    // el hambre es la EXP del personaje (la comida la sube hasta el tope de "FOOD_small")
    let hungerCap = null;
    function fullHunger() {
        if (hungerCap === null) {
            hungerCap = 0;
            const food = ($dataCommonEvents || []).find(e => e && /^FOOD_small$/i.test(e.name));
            const cmd = food && food.list.find(c => c.code === 111 && c.parameters[0] === 1 && c.parameters[1] === 27);
            if (cmd) hungerCap = Number(cmd.parameters[3]) || 0;
        }
        return hungerCap;
    }

    coop.addAssignAction({
        cheat: true,
        name() {
            return 'Cheat: restore HP, mind and hunger';
        },
        run() {
            const cap = gameProfile() ? fullHunger() : 0;
            $gameParty.members().forEach(a => {
                if (a.isDead()) return;
                // (primero el hambre: cambiar la EXP puede cambiar la vida maxima)
                if (cap > 0 && a.currentExp() < cap) a.changeExp(cap, false);
                a.setHp(a.mhp);
                a.setMp(a.mmp);
            });
            SoundManager.playRecovery();
        }
    });

    // fuego: antorchas y con que encenderlas (Fear & Hunger 1: Tinderbox; Termina: Matches, Lighter)
    const FIRE_ITEMS = [['Torch', 3], ['Tinderbox', 1], ['Matches', 1], ['Lighter', 1]];
    coop.addAssignAction({
        cheat: true,
        name() {
            return 'Cheat: get torches and fire';
        },
        run() {
            let any = false;
            FIRE_ITEMS.forEach(f => {
                const it = ($dataItems || []).find(i => i && i.name === f[0]);
                if (it) {
                    $gameParty.gainItem(it, f[1]);
                    any = true;
                }
            });
            if (any) SoundManager.playShop();
            else SoundManager.playBuzzer();
        }
    });

    // ---- la antorcha de cada jugador (TerraxLighting: "Fire radius 300"...) -------------------
    // Fear & Hunger 1: el evento comun del objeto ("Light torch") enciende la luz del protagonista,
    // pone el tiempo que dura (variable TORCH_TIMER) y su interruptor; el evento en paralelo
    // TORCH_TIMER la va gastando y pone al protagonista el dibujo con la antorcha. El juego solo
    // tiene una (la de P1). La que enciende P2-P4 desde su menu es suya: el mod lleva su luz
    // (alrededor de su personaje), su tiempo (como el del juego) y su dibujo con la antorcha. La
    // de P1 sigue siendo la del juego; cada una se apaga por su cuenta.
    const _Game_Interpreter_setupReservedCommonEvent = Game_Interpreter.prototype.setupReservedCommonEvent;
    Game_Interpreter.prototype.setupReservedCommonEvent = function() {
        const started = _Game_Interpreter_setupReservedCommonEvent.call(this);
        if (started) this._coopUsedItem = true; // (un objeto usado desde el menu)
        return started;
    };

    const _Game_Interpreter_clear = Game_Interpreter.prototype.clear;
    Game_Interpreter.prototype.clear = function() {
        _Game_Interpreter_clear.call(this);
        this._coopUsedItem = false;
    };

    const _Game_Interpreter_setupChild = Game_Interpreter.prototype.setupChild;
    Game_Interpreter.prototype.setupChild = function(list, eventId) {
        _Game_Interpreter_setupChild.call(this, list, eventId);
        if (this._childInterpreter) this._childInterpreter._coopUsedItem = this._coopUsedItem;
    };

    const TORCH_UNITS = 40; // (si el evento no dice cuanto dura: lo de Fear & Hunger 1)

    // "Fire radius 300 #FFFFFF" / "Light radius 100": la luz que se enciende (o null)
    function lightOn(command, args) {
        const cmd = String(command).toLowerCase();
        if ((cmd !== 'fire' && cmd !== 'light') || String((args && args[0]) || '').toLowerCase() !== 'radius') return null;
        const radius = Number(args[1]);
        if (!(radius > 0)) return null;
        return { radius: radius, color: /^#[0-9a-f]{6}$/i.test(args[2] || '') ? args[2] : '#FFFFFF', flicker: cmd === 'fire' };
    }

    function isLightCommand(command) {
        return /^(fire|light|flashlight)$/i.test(String(command));
    }

    const torchLists = new WeakMap();
    function listLightsTorch(list) {
        if (!list) return false;
        if (!torchLists.has(list)) {
            torchLists.set(list, list.some(c => c && c.code === 356 && (() => {
                const parts = String(c.parameters[0]).split(' ');
                return !!lightOn(parts[0], parts.slice(1));
            })()));
        }
        return torchLists.get(list);
    }

    // este interprete es el de "encender la antorcha" de P2-P4
    function playerTorchStarter(it) {
        return it._coopUsedItem && it._coopStarter >= 2 && listLightsTorch(it._list) ? it._coopStarter : 0;
    }

    function torches() {
        if (!$gameSystem._coopTorches) $gameSystem._coopTorches = {};
        return $gameSystem._coopTorches;
    }

    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        const n = playerTorchStarter(this);
        if (n && isLightCommand(command)) {
            const light = lightOn(command, args);
            const p = coop.player(n);
            if (light && p && p.actor()) {
                const old = torches()[n];
                torches()[n] = { actorId: p.actor().actorId(), units: old ? old.units : TORCH_UNITS, wait: TORCH_WAIT[0][1],
                    radius: light.radius, color: light.color, flicker: light.flicker };
            }
            return; // (la luz del juego es la de P1: no se toca)
        }
        _Game_Interpreter_pluginCommand.call(this, command, args);
    };

    // el tiempo y el interruptor del temporizador del juego son los de P1: en el de P2-P4, suyos
    const _Game_Interpreter_command122 = Game_Interpreter.prototype.command122;
    Game_Interpreter.prototype.command122 = function() {
        const n = playerTorchStarter(this);
        if (!n) return _Game_Interpreter_command122.call(this);
        const p = this._params;
        const tc = torches()[n];
        if (tc && p[3] === 0 && (p[2] === 0 || p[2] === 1) && Number(p[4]) > 0) {
            tc.units = p[2] === 0 ? Number(p[4]) : tc.units + Number(p[4]);
            tc.wait = torchWait(tc.units);
        }
        return true;
    };

    const _Game_Interpreter_command121 = Game_Interpreter.prototype.command121;
    Game_Interpreter.prototype.command121 = function() {
        if (playerTorchStarter(this)) return true;
        return _Game_Interpreter_command121.call(this);
    };

    // como el evento TORCH_TIMER: cada cuantos cuadros se gasta una unidad, y la luz al final
    const TORCH_WAIT = [[5, 300], [2, 100], [1, 70], [0, 40]];
    function torchWait(units) {
        return (TORCH_WAIT.find(w => units > w[0]) || TORCH_WAIT[TORCH_WAIT.length - 1])[1];
    }

    function torchRadius(tc) {
        const k = tc.units > 10 ? 1 : tc.units > 5 ? 280 / 300 : tc.units > 2 ? 250 / 300 : 245 / 300;
        return Math.round(tc.radius * k);
    }

    // El dibujo con la antorcha en la mano: el temporizador del juego enciende el interruptor
    // "<Clase>_torch" del protagonista y el evento comun del traje de ese personaje le pone el
    // dibujo con antorcha. Que interruptor es de que personaje se mira en esos eventos comunes:
    // "Si el interruptor Knight_torch..." y luego "$gameActors.actor(3).setCharacterImage(...)".
    let torchSwitches = null; // { switchId: actorId }
    function torchSwitchMap() {
        if (torchSwitches) return torchSwitches;
        torchSwitches = {};
        const names = ($dataSystem && $dataSystem.switches) || [];
        ($dataCommonEvents || []).forEach(ce => {
            if (!ce) return;
            ce.list.forEach((c, i) => {
                if (c.code !== 111 || c.parameters[0] !== 0 || !/_torch$/i.test(names[c.parameters[1]] || '')) return;
                const id = c.parameters[1];
                if (torchSwitches[id]) return;
                for (let k = i + 1; k < Math.min(ce.list.length, i + 8); k++) {
                    const m = ce.list[k].code === 355 && /\$gameActors\.actor\((\d+)\)\.setCharacterImage/.exec(ce.list[k].parameters[0]);
                    if (m) {
                        torchSwitches[id] = Number(m[1]);
                        break;
                    }
                }
            });
        });
        return torchSwitches;
    }

    function torchSwitchOf(actorId) {
        const map = torchSwitchMap();
        return Object.keys(map).map(Number).find(id => map[id] === actorId) || 0;
    }

    function updateTorches() {
        const list = torches();
        Object.keys(list).forEach(k => {
            const n = Number(k);
            const tc = list[k];
            const p = coop.player(n);
            const sw = torchSwitchOf(tc.actorId);
            // (si ya no lleva ese personaje, la antorcha se va con el)
            const gone = !p || !p.actor() || p.actor().actorId() !== tc.actorId;
            if (!gone && --tc.wait <= 0) {
                tc.units--;
                tc.wait = torchWait(tc.units);
            }
            if (gone || tc.units <= 0) {
                delete list[k];
                if (sw && $gameSwitches.value(sw) && !isP1Torch(sw)) $gameSwitches.setValue(sw, false);
                if (!gone) coop.banner(p.actor().name() + "'s torch died down", '', '#ffcc66', 150);
                return;
            }
            if (sw && !$gameSwitches.value(sw)) $gameSwitches.setValue(sw, true);
        });
    }

    // el interruptor es del protagonista con su antorcha del juego encendida
    function isP1Torch(sw) {
        const lead = $gameParty.leader();
        return !!lead && torchSwitchMap()[sw] === lead.actorId();
    }

    const _Game_Map_update_torches = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if ($gameSystem._coopTorches && this.mapId() > 0) updateTorches();
        _Game_Map_update_torches.call(this, sceneActive);
    };

    // La luz que el juego pone alrededor del protagonista (en Termina siempre hay un poco) era solo
    // de P1: en los demas PC, lejos de P1, todo negro. Cada jugador lleva la misma luz que P1 (en
    // Fear & Hunger 1 sin la antorcha de P1: esa es solo suya; con la suya, la de su antorcha).
    let p1Light = null;      // la luz de P1 dibujada en este cuadro (como la pide TerraxLighting)
    let baseLight = null;    // la ultima sin la antorcha del juego encendida
    let torchTimerSwitch = -1;
    function gameTorchOn() {
        if (torchTimerSwitch < 0) {
            const names = ($dataSystem && $dataSystem.switches) || [];
            torchTimerSwitch = names.findIndex(nm => /^TORCH_TIMER$/i.test(nm || ''));
        }
        return torchTimerSwitch > 0 && $gameSwitches.value(torchTimerSwitch);
    }

    function screenPos(ch) {
        const pw = $gameMap.tileWidth();
        const ph = $gameMap.tileHeight();
        return { x: pw / 2 + $gameMap.adjustX(ch._realX) * pw, y: ph / 2 + $gameMap.adjustY(ch._realY) * ph };
    }

    // TerraxLighting pone la luz de P1 "al otro lado del mapa" si la camara esta a la derecha o
    // debajo de P1 (lo hace para los mapas que dan la vuelta): en la partida en red la camara de
    // cada PC mira a su personaje y en los demas PC la luz de P1 se iba fuera de la pantalla.
    // Donde dibujaria TerraxLighting la luz de P1 ({x, y} con ese salto, o null si no salta):
    function terraxJump() {
        const pw = $gameMap.tileWidth();
        const ph = $gameMap.tileHeight();
        const dx = $gameMap.displayX();
        const dy = $gameMap.displayY();
        const p = $gamePlayer;
        return {
            x: dx > p.x ? pw / 2 + ($gameMap.width() - Math.floor(dx - p._realX)) * pw : null,
            y: dy > p.y ? ph / 2 + ($gameMap.height() - Math.floor(dy - p._realY)) * ph : null
        };
    }

    // la luz de P1 que pide TerraxLighting: {x, y} donde debe ir y su dy (o null si no es la de P1)
    function matchP1Light(x1, y1) {
        if (!$gamePlayer) return null;
        const pos = screenPos($gamePlayer);
        const jump = terraxJump();
        let x = null;
        let dy = null;
        if (Math.abs(x1 - pos.x) < 2) x = pos.x;
        else if (jump.x !== null && Math.abs(x1 - jump.x) < 2 && !$gameMap.isLoopHorizontal()) x = pos.x;
        if (Math.abs(y1 - pos.y) < 48) dy = y1 - pos.y;
        else if (jump.y !== null && Math.abs(y1 - jump.y) < 48 && !$gameMap.isLoopVertical()) dy = y1 - jump.y;
        return x === null || dy === null ? null : { x: x, y: pos.y + dy, dy: dy };
    }

    function watchPlayerLight(target) {
        const _radial = target.radialgradientFillRect;
        target.radialgradientFillRect = function(x1, y1, r1, r2, color1, color2, flicker, brightness) {
            // (la primera luz de la mascara en el sitio de P1 es la suya)
            if (this._coopMaskWatch && !p1Light) {
                const m = matchP1Light(x1, y1);
                if (m) {
                    p1Light = { dy: m.dy, r1: r1, r2: r2, color: color1, color2: color2, flicker: flicker, brightness: brightness };
                    const args = Array.prototype.slice.call(arguments);
                    args[0] = m.x;
                    args[1] = m.y;
                    return _radial.apply(this, args);
                }
            }
            return _radial.apply(this, arguments);
        };
        // la linterna de P1 (el cono): tambien en su sitio
        const _radial2 = target.radialgradientFillRect2;
        if (_radial2) {
            target.radialgradientFillRect2 = function(x1, y1) {
                const m = this._coopMaskWatch && !p1Light ? matchP1Light(x1, y1) : null;
                if (!m) return _radial2.apply(this, arguments);
                const args = Array.prototype.slice.call(arguments);
                args[0] = m.x;
                args[1] = m.y;
                return _radial2.apply(this, args);
            };
        }
    }
    if (Bitmap.prototype.radialgradientFillRect) watchPlayerLight(Bitmap.prototype);

    // la luz de cada jugador (y de las antorchas de P2-P4): se suma a la mascara de luz del mapa
    function drawPlayerTorches(mask) {
        const list = ($gameSystem && $gameSystem._coopTorches) || {};
        if (!mask._maskBitmap || !mask._maskBitmap.radialgradientFillRect || !mask._maskBitmap._coopFilled) return;
        const torchOn = gameTorchOn();
        if (!torchOn) baseLight = p1Light;
        const light = torchOn ? baseLight : p1Light;
        const bmp = mask._maskBitmap;
        const ctx = bmp._context;
        const before = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        try {
            coop.players().forEach(p => {
                if (!p || p.isTransparent() || p === $gamePlayer) return;
                const pos = screenPos(p);
                const tc = list[p.coopIndex()];
                if (tc) bmp.radialgradientFillRect(pos.x, pos.y, 20, torchRadius(tc), tc.color, 'black', tc.flicker, 0);
                else if (light) bmp.radialgradientFillRect(pos.x, pos.y + light.dy, light.r1, light.r2, light.color, light.color2, light.flicker, light.brightness);
            });
        } finally {
            ctx.globalCompositeOperation = before;
        }
    }

    // (para saber si este cuadro se dibujo la mascara: empieza rellenandola de negro)
    const _Bitmap_fillRect = Bitmap.prototype.fillRect;
    Bitmap.prototype.fillRect = function(x, y, w, h, color) {
        if (this._coopMaskWatch) this._coopFilled = true;
        return _Bitmap_fillRect.apply(this, arguments);
    };

    function beginMask(mask) {
        const bmp = mask._maskBitmap;
        if (bmp) {
            bmp._coopMaskWatch = true;
            bmp._coopFilled = false;
        }
        p1Light = null;
    }

    function endMask(mask) {
        if (mask._maskBitmap) mask._maskBitmap._coopMaskWatch = false;
        try {
            drawPlayerTorches(mask);
        } catch (e) {
            console.error('LocalCoop_FearHunger: player lights', e);
        }
    }

    // (la clase de la luz no es global: se toma de la primera que se crea)
    if (Spriteset_Map.prototype.createLightmask) {
        const _Spriteset_Map_createLightmask = Spriteset_Map.prototype.createLightmask;
        Spriteset_Map.prototype.createLightmask = function() {
            _Spriteset_Map_createLightmask.apply(this, arguments);
            const proto = this._lightmask && Object.getPrototypeOf(this._lightmask);
            if (!proto || !proto._updateMask || proto._coopTorches) return;
            proto._coopTorches = true;
            const _updateMask = proto._updateMask;
            proto._updateMask = function() {
                beginMask(this);
                const out = _updateMask.apply(this, arguments);
                endMask(this);
                return out;
            };
        };
    }

    // ---- el personaje de P2-P4 no esta ademas como NPC en el mapa --------------------------
    // Las dos partes esconden al companero que ya esta en el grupo (o al protagonista) con una
    // pagina vacia del evento: sin dibujo ni comandos, con la condicion "Cahara_InTheParty!",
    // "INITIAL_MERCENARY" (el protagonista es el), "OCCULTIST_SELECT" (Termina)... El personaje que
    // un jugador elige en el mod no lo contrato la historia: esas paginas no salian y el NPC seguia
    // ahi. Otras veces el NPC esta en una pagina "esperando" ("marina_waiting_at_train",
    // "LEGARDE_WAITING") y al contratarle el juego apaga ese interruptor. Mientras un jugador lo
    // lleva (o yace su cuerpo), para sus eventos esos interruptores cuentan como si ya le hubieran
    // contratado, pero SOLO si asi el evento queda vacio o desaparece: el NPC no esta y nada mas
    // cambia (si saldria otra pagina con algo - una escena -, queda la del juego; los interruptores
    // no se tocan; si lo deja, vuelve). Que interruptores son se mira en el mapa:
    //  - los que la historia enciende / apaga al contratarle (junto a "Anadir miembro");
    //  - los de "protagonista" (INITIAL_... / ..._SELECT) de sus eventos (estos en cualquier evento).
    const ROLE_SWITCH = /INITIAL_|SELECT$/i;
    const NOT_JOIN_SWITCH = /suicide|^start$|cannotuse|trigger|starvation|hard_mode|INITIAL_|SELECT$/i;

    coop.addSettings([
        { key: 'hideNpcs', name: "Played characters' NPCs", values: [true, false], labels: ['Hidden', 'Shown'],
            help: 'Hidden: a character a player plays is not also standing around as an NPC (waiting, in a cell...). Shown: they are, as in the game.' }
    ], true);

    function isHidePage(page) {
        return !!page && !page.image.characterName && !page.image.tileId && page.list.length <= 1;
    }

    function pageSwitches(page) {
        const c = page.conditions;
        const out = [];
        if (c.switch1Valid) out.push(c.switch1Id);
        if (c.switch2Valid) out.push(c.switch2Id);
        return out;
    }

    let npcMap = { mapId: -1, byActor: {} };
    function npcSwitchesByActor() {
        if (npcMap.mapId === $gameMap.mapId() && npcMap.data === $dataMap) return npcMap.byActor;
        const names = ($dataSystem && $dataSystem.switches) || [];
        const near = {};     // actor -> { interruptor: true (se enciende) / false (se apaga) } al contratarle
        const roles = {};    // interruptor de protagonista -> { actor: cuantas veces }
        (($dataMap && $dataMap.events) || []).forEach(ev => {
            if (!ev) return;
            const added = [];
            ev.pages.forEach(pg => pg.list.forEach((c, i) => {
                if (c.code !== 129 || c.parameters[1] !== 0) return;
                const a = c.parameters[0];
                if (added.indexOf(a) < 0) added.push(a);
                pg.list.slice(Math.max(0, i - 8), i + 9).forEach(d => {
                    if (d.code !== 121) return;
                    for (let s = d.parameters[0]; s <= d.parameters[1]; s++) {
                        if (NOT_JOIN_SWITCH.test(names[s] || '')) continue;
                        (near[a] = near[a] || {})[s] = d.parameters[2] === 0;
                    }
                });
            }));
            if (added.length !== 1) return; // (el de elegir personaje anade a todos)
            ev.pages.forEach(pg => {
                if (!isHidePage(pg)) return;
                pageSwitches(pg).forEach(s => {
                    if (!ROLE_SWITCH.test(names[s] || '')) return;
                    const r = roles[s] = roles[s] || {};
                    r[added[0]] = (r[added[0]] || 0) + 1;
                });
            });
        });
        // near: solo en sus eventos (los que le contratan o le dibujan); roles: en cualquiera
        const byActor = {};
        const entry = a => (byActor[a] = byActor[a] || { near: {}, roles: [] });
        Object.keys(near).forEach(a => { entry(a).near = near[a]; });
        Object.keys(roles).forEach(s => {
            const best = Object.keys(roles[s]).sort((x, y) => roles[s][y] - roles[s][x])[0];
            entry(best).roles.push(Number(s));
        });
        npcMap = { mapId: $gameMap.mapId(), data: $dataMap, byActor: byActor };
        return byActor;
    }

    // los personajes que llevan P2-P4 (o cuyo cuerpo yace) y que el juego no esconde por si solo
    function playedActors() {
        const lead = $gameParty.leader();
        const out = coop.players().map(p => p.actor() && p.actor().actorId()).filter(id => id && (!lead || id !== lead.actorId()));
        corpses().forEach(c => { if (out.indexOf(c.actorId) < 0) out.push(c.actorId); });
        return out;
    }

    // de quien es un evento: a quien contrata, o a quien dibuja ("mercenary2" es Cahara)
    function spriteBase(name) {
        return String(name || '').replace(/^[!$%]+/, '').replace(/\d+$/, '').toLowerCase();
    }
    const npcOwners = new WeakMap();
    function npcActorsOf(data) {
        if (npcOwners.has(data)) return npcOwners.get(data);
        const out = {};
        data.pages.forEach(pg => {
            pg.list.forEach(c => { if (c.code === 129 && c.parameters[1] === 0) out[c.parameters[0]] = true; });
            const base = spriteBase(pg.image.characterName);
            if (base) ($dataActors || []).forEach(a => {
                if (a && spriteBase(a.characterName) === base) out[a.id] = true;
            });
        });
        npcOwners.set(data, out);
        return out;
    }

    let npcHidden = null; // { roles: {interruptor: true}, near: {actor: {interruptor: valor}} }
    let npcHiddenKey = '';
    function updateNpcHiding() {
        const by = npcSwitchesByActor();
        const roles = {};
        const near = {};
        (coop.setting('hideNpcs') === false ? [] : playedActors()).forEach(a => {
            const e = by[a];
            if (!e) return;
            e.roles.forEach(s => { roles[s] = true; });
            if (Object.keys(e.near).length) near[a] = e.near;
        });
        const key = Object.keys(roles).join(',') + '|' + Object.keys(near).join(',');
        npcHidden = key !== '|' ? { roles: roles, near: near } : null;
        if (key !== npcHiddenKey) {
            npcHiddenKey = key;
            $gameMap.requestRefresh();
        }
    }

    const _Game_Map_update_npcs = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if (this.mapId() > 0 && $dataMap) updateNpcHiding();
        _Game_Map_update_npcs.call(this, sceneActive);
    };

    // los interruptores que cuentan para este evento ({interruptor: valor}, o null)
    function hiddenFor(ev) {
        const h = npcHidden;
        const data = h && ev.event();
        if (!data) return null;
        const set = Object.assign({}, h.roles);
        const owners = npcActorsOf(data);
        Object.keys(h.near).forEach(a => { if (owners[a]) Object.assign(set, h.near[a]); });
        return Object.keys(set).length ? set : null;
    }

    const _Game_Event_findProperPageIndex = Game_Event.prototype.findProperPageIndex;
    Game_Event.prototype.findProperPageIndex = function() {
        const normal = _Game_Event_findProperPageIndex.call(this);
        const hidden = npcHidden ? hiddenFor(this) : null;
        if (!hidden) return normal;
        const real = Game_Switches.prototype.value;
        const sw = $gameSwitches;
        sw.value = function(id) {
            return hidden[id] !== undefined ? hidden[id] : real.call(this, id);
        };
        let alt = normal;
        try {
            alt = _Game_Event_findProperPageIndex.call(this);
        } finally {
            delete sw.value;
        }
        // solo si asi el NPC no esta (pagina vacia o ninguna); si saldria otra cosa, la del juego
        return alt !== normal && (alt < 0 || isHidePage(this.event().pages[alt])) ? alt : normal;
    };

    window.CoopRevive = { revive: revive, corpses: corpses, soulStone: soulStone, deathEffectsOf: deathEffectsOf, bodySwitchesOf: bodySwitchesOf, gameBodyEvent: gameBodyEvent, torches: torches,
        npcSwitchesByActor: npcSwitchesByActor,
        lightTest: { watchPlayerLight: watchPlayerLight, beginMask: beginMask, endMask: endMask } };

    // ---- el cuerpo en el mapa (Fear & Hunger 1 y quien no tiene cadaver propio en Termina) ----
    function Game_CoopCorpse(c) {
        Game_Character.prototype.initialize.call(this);
        const actor = $gameActors.actor(c.actorId);
        this._coopCorpse = c;
        this.setPosition(c.x, c.y);
        if (actor) this.setImage(actor.characterName(), actor.characterIndex());
        this.setDirection(2);
        this.setThrough(true);
        this._priorityType = 0;
    }
    Game_CoopCorpse.prototype = Object.create(Game_Character.prototype);
    Game_CoopCorpse.prototype.constructor = Game_CoopCorpse;

    function bodiesHere(all) {
        const mapId = $gameMap.mapId();
        return corpses().filter(c => c.mapId === mapId &&
            (all || (!deathEffectsOf(c.actorId).spawn && !bodyPos(c).game)) && !$gameParty._actors.includes(c.actorId));
    }

    function Sprite_CoopCorpseName(c) {
        Sprite.prototype.initialize.call(this, new Bitmap(160, 24));
        this._corpse = c;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this.z = 9;
        const actor = $gameActors.actor(c.actorId);
        this.bitmap.fontSize = 15;
        this.bitmap.outlineWidth = 3;
        this.bitmap.textColor = '#c8d4ff';
        this.bitmap.drawText('+ ' + (actor ? actor.name() : '?'), 0, 0, 160, 24, 'center');
        this._probe = new Game_Character();
        const pos = bodyPos(c);
        this._probe.setPosition(pos.x, pos.y);
    }
    Sprite_CoopCorpseName.prototype = Object.create(Sprite.prototype);
    Sprite_CoopCorpseName.prototype.constructor = Sprite_CoopCorpseName;
    Sprite_CoopCorpseName.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this.x = this._probe.screenX();
        this.y = this._probe.screenY() - $gameMap.tileHeight() + 8;
        this.opacity = 150 + Math.round(60 * Math.sin(Graphics.frameCount / 20));
    };

    // fuera ya el dibujo de su cuerpo (y su nombre), sin esperar a la siguiente comprobacion
    function removeBodyPictures(actorId) {
        const ss = SceneManager._scene && SceneManager._scene._spriteset;
        if (!ss || !ss._tilemap) return;
        ss._tilemap.children.slice().forEach(sp => {
            const c = (sp._character && sp._character._coopCorpse) || sp._corpse;
            if (c && c.actorId === actorId) {
                ss._tilemap.removeChild(sp);
                const i = ss._characterSprites.indexOf(sp);
                if (i >= 0) ss._characterSprites.splice(i, 1);
            }
        });
        ss._coopCorpseKey = null; // y que se rehaga la lista
    }

    Spriteset_Map.prototype.coopSyncCorpses = function() {
        if (!this._tilemap) return;
        const list = reviveOn() ? bodiesHere(true) : [];
        const key = list.map(c => {
            const pos = bodyPos(c);
            return c.actorId + '@' + pos.x + ',' + pos.y + (pos.game ? 'g' : '');
        }).join(';');
        if (key === this._coopCorpseKey) return;
        this._coopCorpseKey = key;
        (this._coopCorpseNames || []).forEach(sp => { if (sp.parent) sp.parent.removeChild(sp); });
        this._coopCorpseNames = list.map(c => {
            const sp = new Sprite_CoopCorpseName(c);
            this._tilemap.addChild(sp);
            return sp;
        });
        (this._coopCorpseSprites || []).forEach(sp => {
            if (sp.parent) sp.parent.removeChild(sp);
            const i = this._characterSprites.indexOf(sp);
            if (i >= 0) this._characterSprites.splice(i, 1);
        });
        this._coopCorpseSprites = list.filter(c => !deathEffectsOf(c.actorId).spawn && !bodyPos(c).game).map(c => {
            const sp = new Sprite_Character(new Game_CoopCorpse(c));
            this._characterSprites.push(sp);
            this._tilemap.addChild(sp);
            return sp;
        });
    };

    const _Spriteset_Map_update_corpses = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update_corpses.call(this);
        if (Graphics.frameCount % 20 === 0 || !this._coopCorpseKey && this._coopCorpseKey !== '') this.coopSyncCorpses();
    };

    // tumbado de lado y sin color
    const _Sprite_Character_updatePosition = Sprite_Character.prototype.updatePosition;
    Sprite_Character.prototype.updatePosition = function() {
        _Sprite_Character_updatePosition.call(this);
        if (!this._character || !this._character._coopCorpse) return;
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.rotation = Math.PI / 2;
        this.y -= Math.round($gameMap.tileHeight() / 2) - 6;
        this.z = 1;
        if (!this._coopTinted) {
            this._coopTinted = true;
            this.setColorTone([-40, -60, -60, 160]);
        }
    };

    if (!hasTerrax) {
        console.warn('LocalCoop_FearHunger: TerraxLighting no encontrado; P2/P3 no tendran luz propia.');
    }
})();
