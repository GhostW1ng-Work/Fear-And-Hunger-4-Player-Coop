/*:
 * @target MV MZ
 * @plugindesc v1.8.9 Fear & Hunger 1 y 2 (Termina) - luz para P2-P4 (TerraxLighting / vision), disparo de P2-P4 (armas de fuego en Termina, arco en Fear & Hunger 1) y sprint. NO instalar en Look Outside. Requiere LookOutsideOnline.js (cargado antes).
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
        { key: 'reviveAllowed', name: 'Revive with soul stones', values: [true, false], labels: ['On', 'Off (death is for good)'],
            help: 'Off: a dead character stays dead (no body to revive); their player waits until the host gives them a free character (Co-op menu) or a new companion joins.' },
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
            coop.setting('deathRule') !== 'gameover' && coop.setting('reviveAllowed') !== false && !!gameProfile() && !!soulStone();
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

    // ---- trucos para probar el final B de Termina (la torre) ----------------------------------
    // La puerta de la torre (Temple_site_2) solo se abre si en el grupo hay uno solo y quedan
    // vivos como mucho 1 concursante (CHARACTERS_LEFT; empieza en 14). Al morir un concursante el
    // juego enciende su interruptor de "muerto" (Abella1, levi1...: con el desaparece del mapa),
    // el de su alma (mechanic_SOUL...) y resta 1 a CHARACTERS_LEFT.
    const CONTESTANT_SOULS = {
        levi1: 'exsoldier_SOUL', marina1: 'Occultist_SOUL', Daan1: 'doctor_SOUL', Abella1: 'mechanic_SOUL',
        yellow_mage1: 'yellow_mage_SOUL', Marcoh1: 'fighter_SOUL', karin1: 'journalist_SOUL', Olivia1: 'botanist_SOUL',
        Henryk1: 'chef_SOUL', August1: 'hunter_SOUL', Tanaka1: 'salaryman_SOUL', samarie1: 'apprentice_SOUL',
        Pav1: 'lieutenant_SOUL', caligura1: 'mobster_SOUL'
    };
    const TOWER_DOOR = { mapId: 111, x: 21, y: 21 }; // delante de la puerta (21, 20), mirando arriba
    function switchNamed(name) {
        return ($dataSystem.switches || []).indexOf(name);
    }
    function variableNamed(name) {
        return ($dataSystem.variables || []).indexOf(name);
    }
    // los concursantes: el interruptor de "muerto" de cada uno (del suceso "Character_CHART")
    function contestants() {
        const ce = ($dataCommonEvents || []).find(e => e && /^Character_CHART$/i.test(e.name));
        const out = [];
        (ce ? ce.list : []).forEach((c, n) => {
            const next = ce.list[n + 1];
            if (c.code === 111 && c.parameters[0] === 1 && /_dead$/i.test($dataSystem.variables[c.parameters[1]] || '') &&
                next && next.code === 111 && next.parameters[0] === 0) {
                const sw = next.parameters[1];
                const name = $dataSystem.switches[sw];
                // el personaje (si se puede llevar en el grupo): el que enciende ese interruptor al morir
                let actorId = 0;
                for (let id = 1; id < $dataActors.length && !actorId; id++) {
                    if (deathEffectsOf(id).switches.indexOf(sw) >= 0) actorId = id;
                }
                out.push({ deadSwitch: sw, name: name, soul: switchNamed(CONTESTANT_SOULS[name] || ''), actorId: actorId });
            }
        });
        return out;
    }
    function contestantsLeft() {
        const v = variableNamed('CHARACTERS_LEFT');
        return v > 0 ? $gameVariables.value(v) : 0;
    }
    // los personajes de los jugadores (en el grupo o esperando a volver)
    function playersActorIds() {
        const ids = $gameParty._actors.slice();
        const waiting = coop.waiting();
        Object.keys(waiting).forEach(n => { if (waiting[n]) ids.push(Number(waiting[n])); });
        return ids;
    }

    coop.addAssignAction({
        cheat: true,
        visible() { return isTermina(); },
        name() {
            return 'Contestants left: ' + contestantsLeft() + ' (the tower opens at 1, alone in the party)';
        },
        run() {
            SoundManager.playCursor();
        }
    });
    const killContestantsAction = {
        cheat: true,
        visible() { return isTermina(); },
        name() {
            return 'Cheat: kill all contestants not in the party';
        },
        run() {
            const keep = playersActorIds();
            const v = variableNamed('CHARACTERS_LEFT');
            let killed = 0;
            contestants().forEach(c => {
                if ($gameSwitches.value(c.deadSwitch)) return;
                if (c.actorId && keep.indexOf(c.actorId) >= 0) return;
                $gameSwitches.setValue(c.deadSwitch, true);
                if (c.soul > 0) $gameSwitches.setValue(c.soul, true);
                if (v > 0) $gameVariables.setValue(v, Math.max(0, $gameVariables.value(v) - 1));
                killed++;
            });
            if (killed === 0) {
                SoundManager.playBuzzer();
                return;
            }
            $gameMap.requestRefresh();
            SoundManager.playShop();
            coop.banner(killed + ' contestants are dead', 'Contestants left: ' + contestantsLeft(), '#ff6655', 180);
        }
    };
    coop.addAssignAction(killContestantsAction);
    coop.addAssignAction({
        cheat: true,
        visible() { return isTermina(); },
        name() {
            return 'Cheat: teleport to the tower door';
        },
        run() {
            if (!$dataMapInfos[TOWER_DOOR.mapId]) {
                SoundManager.playBuzzer();
                return;
            }
            // (al cerrar el menu: todos van con P1)
            $gamePlayer.reserveTransfer(TOWER_DOOR.mapId, TOWER_DOOR.x, TOWER_DOOR.y, 8, 0);
            SoundManager.playShop();
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

    // ---- PvP (Termina): un jugador ataca a otro ------------------------------------------------
    // OK delante de otro jugador -> "Attack X?" -> combate de los dos. En el combate hay dos
    // "dobles", cada uno como lo pelea el propio juego (la tropa de ese concursante: torso, cabeza,
    // brazos, piernas): el del atacado (al que pega el atacante) y el del atacante (al que pega el
    // atacado). Cada uno elige a que parte del otro pega, con sus turnos, habilidades y arma. Lo que
    // le pasa a un doble le pasa a su personaje: el torso es su vida; brazo / pierna cortados ->
    // "Arm cut" / "Leg cut"; la cabeza -> muerto (o fin del combate sin muerte).
    // Lo que se ve: en cada PC solo el doble del otro y, en el grupo, solo el propio personaje (en
    // red); en un mismo PC, el doble del rival de quien elige. La logica es la misma en todos los PC.
    coop.addSettings([
        { key: 'pvp', name: 'PvP (Termina)', values: ['off', 'duel', 'death'], labels: ['Off', 'On - not to the death', 'On - to the death'],
            after: 'reviveCost',
            help: 'OK next to another player: attack them (no consent needed). Each of you fights the other one, with your own turns. Not to the death: whoever drops to 0 HP is left with 1 and the fight ends.' },
        { key: 'pvpDamage', name: '  PvP damage', values: [1, 0.5, 0.25, 2], labels: ['x1', 'x0.5', 'x0.25', 'x2'], after: 'pvp',
            help: 'Damage in PvP fights. A fight already lasts about as long as a fight against that contestant in the game.' }
    ], true);

    function isTermina() {
        return !!gameProfile() && gameProfile() === GAME_PROFILES.termina;
    }

    function pvpMode() {
        const m = coop.setting('pvp');
        return isTermina() && (m === 'duel' || m === 'death') ? m : null;
    }

    function playerNumberOf(ch) {
        if (ch === $gamePlayer) return 1;
        return ch && ch.coopIndex ? ch.coopIndex() : 0;
    }

    function playerActor(n) {
        if (n === 1) return $gameParty.leader();
        const p = coop.player(n);
        return p ? p.actor() : null;
    }

    function inAnyBattle(n) {
        const net = window.CoopNet;
        return !!(net && net.battles && net.battles().some(b => b.involved.indexOf(n) >= 0));
    }

    function stateIdNamed(re) {
        const s = ($dataStates || []).find(st => st && re.test(st.name));
        return s ? s.id : 0;
    }

    // las partes con las que el juego pelea a un personaje (su tropa de concursante; si no tiene,
    // las de un aldeano)
    function bodyPartsOf(actorId) {
        const actor = $gameActors.actor(actorId);
        const name = (actor ? actor.name() : '').toLowerCase();
        const isMine = m => {
            const en = $dataEnemies[m.enemyId];
            return en && !m.hidden && en.name.toLowerCase().indexOf(name + ' [') === 0;
        };
        let source = name && $dataTroops.find(t => t && t.members.some(m => isMine(m) && /\[torso\]/i.test($dataEnemies[m.enemyId].name)));
        if (source) return source.members.filter(isMine);
        source = $dataTroops.find(t => t && /^villager1$/i.test(t.name)) || $dataTroops.find(t => t && t.members.length > 0);
        return source.members.filter(m => !m.hidden);
    }

    // la tropa del combate: las partes de cada uno que lucha (sin paginas de sucesos del juego:
    // dialogos, historia). pvpTroopFor(atacante, atacado) o pvpTroopFor([personajes...])
    const pvpTroopIds = {}; // "personajes" -> id de la tropa creada
    function pvpTroopFor(attActorId, defActorId) {
        const fighters = Array.isArray(attActorId) ? attActorId.slice() : [defActorId, attActorId];
        const key = fighters.join('/');
        if (pvpTroopIds[key]) return pvpTroopIds[key];
        const members = [];
        fighters.forEach(owner => {
            bodyPartsOf(owner).forEach(m => members.push({ enemyId: m.enemyId, x: m.x, y: m.y, hidden: false, coopOwner: owner }));
        });
        const id = $dataTroops.length;
        const cond = (turnValid, turnEnding) => ({ actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false,
            switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: turnEnding, turnValid: turnValid });
        const gfx = battleGfxEventId();
        const call = gfx ? [{ code: 117, indent: 0, parameters: [gfx] }] : [];
        $dataTroops[id] = {
            id: id, name: fighters.map(a => ($gameActors.actor(a) ? $gameActors.actor(a).name() : '?')).join(' vs '), members: members,
            pages: [
                { conditions: cond(true, false), list: call.concat([{ code: 0, indent: 0, parameters: [] }]), span: 0 },
                { conditions: cond(false, true), list: call.concat([{ code: 0, indent: 0, parameters: [] }]), span: 1 }
            ]
        };
        pvpTroopIds[key] = id;
        return id;
    }

    // troopId -> el combate que va a empezar: { sides: [{ players: [n...] }], lethal, backstabbed: [actorId], before }
    // (o, de dos, { attacker, defender, attActorId, actorId, lethal, backstab, before })
    const pvpPending = {};

    // Bandos: cada uno con sus jugadores (el primero es el principal: el que empezo o al que ayudan)
    // y lo que lleva cada uno (su personaje, con su doble en la tropa, y los companeros que maneja).
    function normalizePvp(info) {
        const out = Object.assign({}, info);
        if (!out.sides) out.sides = [{ players: [info.attacker], actors: [info.attActorId] }, { players: [info.defender], actors: [info.actorId] }];
        out.sides = out.sides.map(sd => ({ players: sd.players.slice(), actors: (sd.actors || sd.players.map(n => playerActor(n) && playerActor(n).actorId())).slice() }));
        out.fighters = [];
        out.sides.forEach(sd => sd.actors.forEach(id => { if (id && out.fighters.indexOf(id) < 0) out.fighters.push(id); }));
        out.players = [];
        out.sides.forEach(sd => sd.players.forEach(n => { if (out.players.indexOf(n) < 0) out.players.push(n); }));
        out.backstabbed = out.backstabbed || (info.backstab ? [info.actorId] : []);
        out.out = out.out || {};      // personaje -> fuera del combate (muerto, o sin muerte a 1 de vida)
        out.killedBy = out.killedBy || {}; // personaje -> el que le dio el golpe final
        if (out.attacker === undefined) out.attacker = out.sides[0].players[0];
        if (out.defender === undefined) out.defender = out.sides[1] ? out.sides[1].players[0] : 0;
        return out;
    }
    // el bando de un personaje (su personaje o un companero que maneja uno de sus jugadores); -1: ninguno
    function sideIndexOf(actor, info) {
        info = info || pvpInfo();
        if (!info || !actor || !actor.isActor || !actor.isActor()) return -1;
        const id = actor.actorId();
        for (let i = 0; i < info.sides.length; i++) if (info.sides[i].actors.indexOf(id) >= 0) return i;
        const owner = coop.battleOwnerOf(actor);
        for (let i = 0; i < info.sides.length; i++) if (info.sides[i].players.indexOf(owner) >= 0) return i;
        return -1;
    }
    function sideInGame(sd, info) {
        return sd.actors.some(id => !info.out[id]);
    }
    // los dobles a los que puede pegar: los de los otros bandos que siguen
    function rivalOwners(actor) {
        const info = pvpInfo();
        if (!info || !actor) return [];
        const mine = sideIndexOf(actor, info);
        if (mine < 0) return [];
        const out = [];
        info.sides.forEach((sd, i) => { if (i !== mine) sd.actors.forEach(id => { if (!info.out[id]) out.push(id); }); });
        return out;
    }

    // En Termina un miembro perdido es un interruptor del personaje (mechanic_arm1...): "Arm cut" y
    // "Leg cut" solo avisan, y el suceso "Character_battleGFX" (y los que encadena) lo apunta.
    // De ahi sale que interruptores son los brazos y las piernas de cada personaje.
    let limbSwitchCache = null;
    function battleGfxEventId() {
        const ce = $dataCommonEvents.find(c => c && /^\/*Character_battleGFX$/i.test(c.name));
        return ce ? ce.id : 0;
    }
    function limbSwitches(actorId) {
        if (!limbSwitchCache) {
            limbSwitchCache = {};
            const armCut = stateIdNamed(/^arm cut$/i), legCut = stateIdNamed(/^leg cut$/i);
            $dataCommonEvents.forEach(ce => {
                if (!ce || !/Character_battleGFX/i.test(ce.name)) return;
                ce.list.forEach((c, n) => {
                    const pr = c.parameters;
                    if (c.code !== 111 || pr[0] !== 4 || pr[2] !== 6 || (pr[3] !== armCut && pr[3] !== legCut)) return;
                    const kind = pr[3] === armCut ? 'arm' : 'leg';
                    const entry = limbSwitchCache[pr[1]] = limbSwitchCache[pr[1]] || { arm: [], leg: [] };
                    for (let k = n + 1; k < ce.list.length && ce.list[k].indent > c.indent; k++) {
                        const d = ce.list[k];
                        if (d.code === 121 && entry[kind].indexOf(d.parameters[0]) < 0) entry[kind].push(d.parameters[0]);
                    }
                });
            });
        }
        return limbSwitchCache[actorId] || { arm: [], leg: [] };
    }
    function limbsLost(actorId, kind) {
        return limbSwitches(actorId)[kind].filter(sw => $gameSwitches.value(sw)).length;
    }
    // lo que el combate puede cambiar de un personaje por sus miembros (para devolverlo sin muerte)
    const LIMB_STATE_NAMES = /^(arm cut|leg cut|bleeding|infection arm|infection leg|can't do shit)$/i;
    function limbSnapshot(a) {
        const sw = limbSwitches(a.actorId());
        const switches = {};
        sw.arm.concat(sw.leg).forEach(id => { switches[id] = $gameSwitches.value(id); });
        return {
            switches: switches,
            states: a.states().filter(st => LIMB_STATE_NAMES.test(st.name)).map(st => st.id),
            equips: a.equips().map(it => it ? (DataManager.isWeapon(it) ? 'w' : 'a') + it.id : '')
        };
    }
    function limbRestore(a, snap) {
        if (!a || !snap) return;
        Object.keys(snap.switches).forEach(id => $gameSwitches.setValue(Number(id), snap.switches[id]));
        a.states().filter(st => LIMB_STATE_NAMES.test(st.name) && snap.states.indexOf(st.id) < 0).forEach(st => a.removeState(st.id));
        snap.states.forEach(id => { if (!a.isStateAffected(id)) a.addState(id); });
        // el arma que solto al quedarse sin brazos
        snap.equips.forEach((code, slot) => {
            const now = a.equips()[slot];
            if (!code || now) return;
            const item = (code[0] === 'w' ? $dataWeapons : $dataArmors)[Number(code.slice(1))];
            if (item && $gameParty.hasItem(item)) a.changeEquip(slot, item);
        });
    }

    // los jugadores que pueden entrar en una pelea ahora (con su personaje vivo, sin otro combate)
    function pvpCandidates() {
        const out = [];
        [1].concat(coop.players().map(pl => pl.coopIndex())).forEach(n => {
            const a = playerActor(n);
            if (a && a.isAlive() && !inAnyBattle(n) && out.indexOf(n) < 0) out.push(n);
        });
        return out;
    }

    function pvpEventList(attacker, defender) {
        const actor = playerActor(defender);
        const lethal = pvpMode() === 'death';
        // "Attack everyone": si hay alguien mas aparte de los dos
        const all = pvpCandidates().length >= 3;
        const choices = all ? ['Attack', 'Attack everyone', 'Leave'] : ['Attack', 'Leave'];
        const list = [
            { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
            { code: 401, indent: 0, parameters: ['Attack ' + actor.name() + ' (P' + defender + ')?' + (lethal ? ' To the death.' : '')] },
            { code: 102, indent: 0, parameters: [choices, choices.length - 1, 0, 2, 0] },
            { code: 402, indent: 0, parameters: [0, 'Attack'] },
            { code: 355, indent: 1, parameters: ['CoopPvp.prepare(this, ' + attacker + ', ' + defender + ')'] },
            { code: 301, indent: 1, parameters: [0, 0, true, false] },
            { code: 0, indent: 1, parameters: [] }
        ];
        if (all) {
            list.push(
                { code: 402, indent: 0, parameters: [1, 'Attack everyone'] },
                { code: 355, indent: 1, parameters: ['CoopPvp.prepareAll(this, ' + attacker + ')'] },
                { code: 301, indent: 1, parameters: [0, 0, true, false] },
                { code: 0, indent: 1, parameters: [] }
            );
        }
        list.push(
            { code: 402, indent: 0, parameters: [choices.length - 1, 'Leave'] },
            { code: 0, indent: 1, parameters: [] },
            { code: 404, indent: 0, parameters: [] },
            { code: 0, indent: 0, parameters: [] }
        );
        return list;
    }

    // OK delante de otro jugador
    function tryPvp(character, n) {
        if (!pvpMode() || !(SceneManager._scene instanceof Scene_Map) || $gameMap.isEventRunning() || $gameParty.inBattle()) return false;
        const x = $gameMap.roundXWithDirection(character.x, character.direction());
        const y = $gameMap.roundYWithDirection(character.y, character.direction());
        const others = coop.allPlayers().filter(p => p && p !== character);
        let target = others.find(p => p.x === x && p.y === y);
        if (!target) {
            // delante hay algo (alguien con quien hablar, un cofre...): eso primero
            if ($gameMap.eventsXy(x, y).some(ev => ev.page() && ev.list().length > 1 && !ev.isThrough())) return false;
            // un jugador en cualquiera de las 8 casillas de alrededor
            target = others.find(p => Math.abs($gameMap.deltaX(p.x, character.x)) <= 1 && Math.abs($gameMap.deltaY(p.y, character.y)) <= 1);
        }
        const m = playerNumberOf(target);
        if (!target || !m || m === n) return false;
        const me = playerActor(n);
        const them = playerActor(m);
        if (!me || !them || me.isDead() || them.isDead() || me === them) return false;
        if (inAnyBattle(n) || inAnyBattle(m)) return false;
        const it = $gameMap._interpreter;
        it.setup(pvpEventList(n, m), 0);
        it._coopStarter = n; // (elige la respuesta quien ataca)
        // por la espalda: el atacante esta del lado contrario a donde mira el otro
        const d = target.direction();
        const fx = d === 6 ? 1 : d === 4 ? -1 : 0;
        const fy = d === 2 ? 1 : d === 8 ? -1 : 0;
        it._coopPvpBackstab = $gameMap.deltaX(character.x, target.x) * fx + $gameMap.deltaY(character.y, target.y) * fy < 0;
        return true;
    }

    // (desde el evento, justo antes de "Procesar combate": pone la tropa y lo que es)
    function prepare(it, attacker, defender) {
        const battleCmd = it._list[it._index + 1];
        const them = playerActor(defender);
        const me = playerActor(attacker);
        if (!pvpMode() || !them || !me || them.isDead() || me.isDead() || inAnyBattle(defender) || inAnyBattle(attacker)) {
            if (battleCmd && battleCmd.code === 301) battleCmd.code = 108; // (ya no: sin combate)
            return;
        }
        const troopId = pvpTroopFor(me.actorId(), them.actorId());
        const backstab = !!it._coopPvpBackstab;
        pvpPending[troopId] = { attacker: attacker, defender: defender, attActorId: me.actorId(), actorId: them.actorId(), lethal: pvpMode() === 'death',
            sides: [{ players: [attacker], actors: [me.actorId()] }, { players: [defender], actors: [them.actorId()] }],
            backstabbed: backstab ? [them.actorId()] : [], before: {} };
        [me, them].forEach(a => { pvpPending[troopId].before[a.actorId()] = limbSnapshot(a); });
        if (battleCmd && battleCmd.code === 301) battleCmd.parameters[1] = troopId;
        coop.banner('P' + attacker + ' attacks P' + defender + '!', me.name() + ' vs ' + them.name() + (backstab ? ' - from behind: ' + them.name() + ' loses the first turn' : ''), '#ff6655', 200);
    }

    // "Attack everyone": todos los que pueden, cada uno por su cuenta (el que ataca, el primero).
    // story: la pelea de la puerta de la torre (a muerte, aunque el PvP este apagado)
    function prepareAll(it, attacker, story) {
        const battleCmd = it._list[it._index + 1];
        const players = pvpCandidates();
        const me = playerActor(attacker);
        if ((!pvpMode() && !story) || !me || players.indexOf(attacker) < 0 || players.length < 2) {
            if (battleCmd && battleCmd.code === 301) battleCmd.code = 108; // (ya no: sin combate)
            return;
        }
        const order = [attacker].concat(players.filter(n => n !== attacker));
        const actors = order.map(n => playerActor(n).actorId());
        const troopId = pvpTroopFor(actors);
        const info = { lethal: !!story || pvpMode() === 'death', sides: order.map((n, i) => ({ players: [n], actors: [actors[i]] })), backstabbed: [], before: {} };
        actors.forEach(id => { info.before[id] = limbSnapshot($gameActors.actor(id)); });
        pvpPending[troopId] = info;
        if (battleCmd && battleCmd.code === 301) battleCmd.parameters[1] = troopId;
        coop.banner('P' + attacker + ' attacks everyone!', order.map(n => 'P' + n).join(' vs ') + (info.lethal ? ' - to the death' : ''), '#ff6655', 220);
    }

    function pvpInfo() {
        return $gameParty && $gameParty.inBattle() && $gameTroop && $gameTroop._coopPvp || null;
    }

    // ---- la puerta de la torre (final B) con mas jugadores en el grupo ------------------------
    // En el juego, tocarla con companeros los vuelve locos (su forma "moonscorched") y hay que
    // matarlos. Con jugadores: solo puede salir uno - pelea de todos contra todos, a muerte, cada
    // uno con su personaje. El que queda vuelve a tocar la puerta (y si lleva companeros del juego,
    // a esos les pasa lo del juego).
    function towerDoorFight(it) {
        if (!isTermina()) return false;
        const others = pvpCandidates().filter(n => n !== 1);
        if (others.length === 0) return false;
        const starter = it._coopStarter || 1;
        const players = [1].concat(others);
        $gameSystem._coopDoorChoices = {};
        const list = [
            { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
            { code: 401, indent: 0, parameters: ['The stone slab does not move. Something ancient is watching you all...'] },
            { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
            { code: 401, indent: 0, parameters: ['Only one may leave Termina. Only the last one standing.'] }
        ];
        // cada uno elige (contesta su jugador): luchar o acabar con su vida
        players.forEach(n => {
            const a = playerActor(n);
            list.push(
                { code: 355, indent: 0, parameters: ['CoopPvp.doorOwner(this, ' + n + ')'] },
                { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
                { code: 401, indent: 0, parameters: ['P' + n + ' - ' + (a ? a.name() : '?') + '. What will you do?'] },
                { code: 102, indent: 0, parameters: [['Fight', 'Commit suicide'], -1, 0, 2, 0] },
                { code: 402, indent: 0, parameters: [0, 'Fight'] },
                { code: 355, indent: 1, parameters: ['CoopPvp.doorChoice(' + n + ', "fight")'] },
                { code: 0, indent: 1, parameters: [] },
                { code: 402, indent: 0, parameters: [1, 'Commit suicide'] },
                { code: 355, indent: 1, parameters: ['CoopPvp.doorChoice(' + n + ', "end")'] },
                { code: 0, indent: 1, parameters: [] },
                { code: 404, indent: 0, parameters: [] }
            );
        });
        list.push(
            { code: 355, indent: 0, parameters: ['CoopPvp.doorOwner(this, ' + starter + ')'] },
            { code: 355, indent: 0, parameters: ['CoopPvp.doorResolve(this)'] },
            { code: 0, indent: 0, parameters: [] }
        );
        it.setupChild(list, it._eventId);
        return true;
    }

    // quien contesta ahora (el interprete del mapa lo dice; tambien el de esta escena)
    function doorOwner(it, n) {
        for (let x = $gameMap._interpreter; x; x = x._childInterpreter) x._coopStarter = n;
        if (it) it._coopStarter = n;
    }
    function doorChoice(n, what) {
        $gameSystem._coopDoorChoices = $gameSystem._coopDoorChoices || {};
        $gameSystem._coopDoorChoices[n] = what;
    }

    // lo que dice cada uno al final (por su personaje)
    // (las del autor del co-op, en ruso; ver docs/DOOR_LINES.md)
    const DOOR_LINES = {
        1: ['Простите меня, но я просто хочу выжить.', '...Я больше не буду сражаться. Прощайте, ребята...'],
        3: ['Я вернулась в этот проклятый город не для того, чтобы умереть здесь.', 'Я просто хочу покончить с этим... Со всем этим кошмаром...'],
        4: ['Я хочу жить дальше. Без сожалений о прошлом.', 'Элиза, я иду к тебе.'],
        5: ['Что ж, видимо, другого выбора у меня нет. Я очень, очень сожалею.', 'Я никого из вас убивать не буду. С меня хватит.'],
        6: ['Башня зовёт сильнейшего. Что ж, подходите.', 'Да будет так. Мой путь кончается здесь, моей же рукой.'],
        13: ['Ладно. Давайте покончим с этим.', '...Я больше не хочу никого убивать.'],
        14: ['Кто-то должен выбраться и рассказать эту историю.', 'Лучше я покончу с собой, чем стану убийцей.'],
        15: ['Прости... Я должна попытаться.', 'Я не хочу никому причинять боль.']
    };
    const DOOR_LINES_ANY = ['Уйдёт только один. Это буду я.', 'Я не стану с вами драться. Пусть всё кончится здесь.'];

    // El tipo de letra de Termina (Cardo) no tiene cirilico: esas letras salen con Crimson Text, que
    // viene con el juego y si lo tiene (el resto del texto sigue igual)
    const CYRILLIC_FONT = 'CoopCyrillic';
    (function() {
        let file = '';
        try {
            const fs = require('fs'), path = require('path');
            const base = path.join(path.dirname(process.mainModule.filename), 'fonts');
            if (fs.existsSync(path.join(base, 'CrimsonText-Regular.ttf'))) file = 'CrimsonText-Regular.ttf';
        } catch (e) {
            file = 'CrimsonText-Regular.ttf';
        }
        if (!file || typeof Graphics === 'undefined' || !Graphics.loadFont) return;
        try { Graphics.loadFont(CYRILLIC_FONT, 'fonts/' + file); } catch (e) { return; }
        const withCyrillic = face => (face && face.indexOf(CYRILLIC_FONT) < 0 ? face + ', ' + CYRILLIC_FONT : face);
        const wrap = proto => {
            if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'standardFontFace') || proto._coopCyr) return;
            const orig = proto.standardFontFace;
            proto.standardFontFace = function() { return withCyrillic(orig.call(this)); };
            proto._coopCyr = true;
        };
        // (despues de todos los plugins: algunos cambian la letra de los mensajes)
        const _Scene_Boot_start = Scene_Boot.prototype.start;
        Scene_Boot.prototype.start = function() {
            Object.keys(window).forEach(k => { if (/^Window_/.test(k) && window[k] && window[k].prototype) wrap(window[k].prototype); });
            _Scene_Boot_start.apply(this, arguments);
        };
    })();

    // todos han elegido: dicen lo suyo; quien acaba con su vida muere; los que luchan, a muerte
    // (P1, si acaba con su vida y hay otros que luchan, muere al final: el que quede es el protagonista)
    function doorResolve(it) {
        const ch = $gameSystem._coopDoorChoices || {};
        const players = Object.keys(ch).map(Number).sort((x, y) => x - y);
        const fighters = players.filter(n => ch[n] === 'fight' && playerActor(n) && playerActor(n).isAlive());
        const enders = players.filter(n => ch[n] === 'end');
        const list = [];
        players.forEach(n => {
            const a = playerActor(n);
            if (!a) return;
            const lines = DOOR_LINES[a.actorId()] || DOOR_LINES_ANY;
            list.push({ code: 101, indent: 0, parameters: ['', 0, 0, 2] });
            wrapText(a.name() + ': "' + lines[ch[n] === 'fight' ? 0 : 1] + '"', 48).forEach(t => list.push({ code: 401, indent: 0, parameters: [t] }));
        });
        // los que acaban con su vida (P1 al final si alguien lucha)
        enders.filter(n => n !== 1 || fighters.length === 0).forEach(n => {
            list.push(
                { code: 224, indent: 0, parameters: [[255, 0, 0, 170], 40, true] },
                { code: 355, indent: 0, parameters: ['CoopPvp.doorEnd(' + n + ')'] },
                { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
                { code: 401, indent: 0, parameters: [(playerActor(n) ? playerActor(n).name() : 'P' + n) + ' ends their own life.'] }
            );
        });
        if (fighters.length === 0) {
            list.push({ code: 353, indent: 0, parameters: [] });
        } else if (fighters.length >= 2) {
            list.push(
                { code: 355, indent: 0, parameters: ['CoopPvp.prepareDoorFight(this, [' + fighters.join(',') + '])'] },
                { code: 301, indent: 0, parameters: [0, 0, false, false] }
            );
        }
        // P1 eligio acabar con su vida y otros lucharon: ahora (el que queda en pie es el protagonista)
        if (fighters.length > 0 && enders.indexOf(1) >= 0) {
            list.push(
                { code: 224, indent: 0, parameters: [[255, 0, 0, 170], 40, true] },
                { code: 355, indent: 0, parameters: ['CoopPvp.doorEndProtagonist()'] }
            );
        }
        list.push({ code: 0, indent: 0, parameters: [] });
        it.setupChild(list, it._eventId);
    }

    // (las ventanas de mensajes no parten las lineas: en trozos por palabras, hasta 4 lineas)
    function wrapText(text, width) {
        const out = [];
        let line = '';
        text.split(' ').forEach(w => {
            if (line && (line + ' ' + w).length > width) {
                out.push(line);
                line = w;
            } else {
                line = line ? line + ' ' + w : w;
            }
        });
        if (line) out.push(line);
        return out.slice(0, 4);
    }

    function doorEnd(n) {
        const a = playerActor(n);
        if (!a || a.isDead()) return;
        Game_BattlerBase.prototype.setHp.call(a, 0);
        a.addState(a.deathStateId());
        $gamePlayer.refresh();
    }

    // la pelea de la puerta solo entre los que quieren luchar (a muerte)
    function prepareDoorFight(it, fighters) {
        const battleCmd = it._list[it._index + 1];
        const alive = fighters.filter(n => playerActor(n) && playerActor(n).isAlive() && !inAnyBattle(n));
        if (alive.length < 2) {
            if (battleCmd && battleCmd.code === 301) battleCmd.code = 108;
            return;
        }
        const actors = alive.map(n => playerActor(n).actorId());
        const troopId = pvpTroopFor(actors);
        const info = { lethal: true, story: true, sides: alive.map((n, i) => ({ players: [n], actors: [actors[i]] })), backstabbed: [], before: {} };
        actors.forEach(id => { info.before[id] = limbSnapshot($gameActors.actor(id)); });
        pvpPending[troopId] = info;
        if (battleCmd && battleCmd.code === 301) battleCmd.parameters[1] = troopId;
        coop.banner('Only one may leave', alive.map(n => playerActor(n).name()).join(' vs '), '#ff6655', 220);
    }

    // P1 acaba con su vida despues de la pelea: el que sigue vivo de los que lucharon es el protagonista
    function doorEndProtagonist() {
        const hero = $gameActors.actor($gameParty._actors[0]);
        const ch = $gameSystem._coopDoorChoices || {};
        if (!hero || hero.isDead()) return;
        const heir = Object.keys(ch).map(Number).filter(n => n !== 1 && ch[n] === 'fight').map(n => playerActor(n)).find(a => a && a.isAlive());
        Game_BattlerBase.prototype.setHp.call(hero, 0);
        hero.addState(hero.deathStateId());
        coop.banner(hero.name() + ' ends their own life', heir ? heir.name() + ' walks on alone' : '', '#ff6655', 220);
        if (!heir || !takeOverProtagonist(hero, heir)) SceneManager.goto(Scene_Gameover);
    }
    // (el juego pone TEMPLE_SQ_CRAZED_SCENE = 1 para empezar la escena de los companeros)
    const _Game_Interpreter_command122_tower = Game_Interpreter.prototype.command122;
    Game_Interpreter.prototype.command122 = function() {
        const p = this._params;
        if (p[0] === p[1] && p[2] === 0 && p[3] === 0 && p[4] === 1 && $dataSystem.variables[p[0]] === 'TEMPLE_SQ_CRAZED_SCENE' &&
            towerDoorFight(this)) {
            return true;
        }
        return _Game_Interpreter_command122_tower.call(this);
    };

    const _Game_Troop_setup = Game_Troop.prototype.setup;
    Game_Troop.prototype.setup = function(troopId) {
        _Game_Troop_setup.call(this, troopId);
        const raw = pvpPending[troopId];
        const info = raw ? normalizePvp(raw) : null;
        this._coopPvp = info;
        delete pvpPending[troopId];
        if (!info) return;
        BattleManager._coopPvpEnded = false;
        BattleManager._coopPvpGameOver = false;
        const data = $dataTroops[troopId];
        this.members().forEach((e, i) => {
            const nm = e.enemy().name.toLowerCase();
            e._coopOwner = (data.members[i] && data.members[i].coopOwner) || info.fighters[0];
            e._coopPart = /\[torso\]/.test(nm) ? 'torso' : /\[head\]/.test(nm) ? 'head' : /arm/.test(nm) ? 'arm' : /leg/.test(nm) ? 'leg' : 'other';
        });
        info.fighters.forEach(owner => setupDouble(this, owner));
    };

    function partKind(enemy) {
        const nm = enemy.enemy().name.toLowerCase();
        return /\[torso\]/.test(nm) ? 'torso' : /\[head\]/.test(nm) ? 'head' : /arm/.test(nm) ? 'arm' : /leg/.test(nm) ? 'leg' : 'other';
    }

    // el doble de un personaje: su torso es su vida; lo que ya le falta (de antes) no esta
    function setupDouble(troop, owner) {
        const mine = troop.members().filter(e => e._coopOwner === owner);
        const torso = mine.find(e => e._coopPart === 'torso') || mine[0];
        if (!torso) return;
        torso._coopPart = 'torso';
        torso._coopMirror = owner;
        const a = $gameActors.actor(owner);
        torso.recoverAll();
        torso._hp = Math.max(1, Math.round(torso.mhp * a.hp / Math.max(1, a.mhp)));
        torso._coopActorHp = a.hp;
        ['arm', 'leg'].forEach(kind => {
            const lost = limbsLost(owner, kind);
            mine.filter(e => e._coopPart === kind).slice(0, lost).forEach(part => {
                part._hp = 0;
                part._coopCut = true;
                part.addNewState(part.deathStateId());
            });
        });
    }

    // alguien entra en un PvP en marcha (al empezar un turno): en el bando side (-1: uno nuevo, por su
    // cuenta); su doble aparece en la tropa (y en la pantalla)
    function addFighter(n, side) {
        const info = pvpInfo();
        const a = playerActor(n);
        if (!info || !a || a.isDead() || info.fighters.indexOf(a.actorId()) >= 0) return false;
        const id = a.actorId();
        if (side >= 0 && info.sides[side] && sideInGame(info.sides[side], info)) {
            info.sides[side].players.push(n);
            info.sides[side].actors.push(id);
        } else {
            info.sides.push({ players: [n], actors: [id] });
        }
        info.fighters.push(id);
        if (info.players.indexOf(n) < 0) info.players.push(n);
        info.before = info.before || {};
        info.before[id] = limbSnapshot(a);
        const troop = $gameTroop;
        const added = [];
        bodyPartsOf(id).forEach(m => {
            const e = new Game_Enemy(m.enemyId, m.x, m.y);
            e._coopOwner = id;
            e._coopPart = partKind(e);
            e.onBattleStart();
            troop._enemies.push(e);
            added.push(e);
        });
        setupDouble(troop, id);
        troop.makeUniqueNames();
        // (en la pantalla del combate: sus sprites)
        const ss = SceneManager._scene && SceneManager._scene._spriteset;
        if (ss && ss._battleField && ss._enemySprites) {
            added.forEach(e => {
                const sp = new Sprite_Enemy(e);
                ss._enemySprites.push(sp);
                ss._battleField.addChild(sp);
            });
        }
        const sd = side >= 0 && info.sides[side] ? info.sides[side] : null;
        coop.banner(a.name() + ' joins the fight', sd && sd.players[0] !== n ? 'helping P' + sd.players[0] : 'against everyone', '#ff6655', 170);
        return true;
    }

    // la pregunta de quien llega a un PvP en marcha: ayudar a uno de los bandos, o contra todos
    function joinEventList(n, battleSeq, info) {
        const opts = [];
        const cmds = [];
        info.sides.forEach((sd, i) => {
            if (!sideInGame(sd, info)) return;
            const lead = sd.players[0];
            const a = $gameActors.actor(sd.actors[0]);
            opts.push('Help P' + lead + (a ? ' (' + a.name() + ')' : ''));
            cmds.push(i);
        });
        opts.push('Attack everyone');
        cmds.push(-1);
        opts.push('Leave');
        const list = [
            { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
            { code: 401, indent: 0, parameters: ['A fight between players' + (info.lethal ? ', to the death' : '') + '. Join it?'] },
            { code: 102, indent: 0, parameters: [opts, opts.length - 1, 0, 2, 0] }
        ];
        cmds.forEach((side, i) => {
            list.push({ code: 402, indent: 0, parameters: [i, opts[i]] });
            list.push({ code: 355, indent: 1, parameters: ['CoopNet.pvpJoin(' + n + ', ' + battleSeq + ', ' + side + ')'] });
            list.push({ code: 0, indent: 1, parameters: [] });
        });
        list.push({ code: 402, indent: 0, parameters: [opts.length - 1, 'Leave'] });
        list.push({ code: 0, indent: 1, parameters: [] });
        list.push({ code: 404, indent: 0, parameters: [] });
        list.push({ code: 0, indent: 0, parameters: [] });
        return list;
    }

    // la vida del personaje que corresponde a la del doble (la misma parte)
    function actorHpFor(mirror, a) {
        if (mirror.hp <= 0) return 0;
        return Math.max(1, Math.ceil(a.mhp * mirror.hp / Math.max(1, mirror.mhp)));
    }

    // se acaba el combate: como una huida, sin premio
    function pvpEnd(loserName) {
        if (BattleManager._phase === 'aborting' || BattleManager._coopPvpEnded) return;
        BattleManager._coopPvpEnded = true;
        if (loserName) coop.banner(loserName + ' is down', '', '#ff6655', 150);
        BattleManager.abort();
    }

    // quien da el golpe ahora (para saber quien mato a quien)
    function currentHitter() {
        const sub = BattleManager._subject;
        return sub && sub.isActor && sub.isActor() ? sub : null;
    }

    // un personaje cae (muerto, o sin muerte a 1 de vida): sale del combate, su doble desaparece;
    // si ya solo queda un bando, se acaba
    function pvpEliminate(actorId, hitter) {
        const info = pvpInfo();
        if (!info || info.out[actorId] || info.fighters.indexOf(actorId) < 0) return;
        info.out[actorId] = true;
        if (hitter && hitter.actorId() !== actorId) info.killedBy[actorId] = hitter.actorId();
        $gameTroop.members().forEach(e => { if (e._coopOwner === actorId && e.isAlive()) { e._coopCut = true; _Game_Battler_addState_pvp.call(e, e.deathStateId()); } });
        const a = $gameActors.actor(actorId);
        const left = info.sides.filter(sd => sideInGame(sd, info));
        if (left.length <= 1) {
            pvpEnd(a ? a.name() : '');
        } else if (a) {
            coop.banner(a.name() + ' is down', left.length + ' sides still fighting', '#ff6655', 150);
        }
    }

    Game_Enemy.prototype.setHp = function(hp) {
        const info = this._coopMirror && pvpInfo();
        if (!info) return Game_BattlerBase.prototype.setHp.call(this, hp);
        const a = $gameActors.actor(this._coopMirror);
        if (!info.lethal && hp <= 0) hp = 1;
        Game_BattlerBase.prototype.setHp.call(this, hp);
        a.setHp(actorHpFor(this, a));
        this._coopActorHp = a.hp;
        if (!info.lethal && hp <= 1) pvpEliminate(a.actorId(), currentHitter());
    };

    function isPvpFighter(battler) {
        const info = pvpInfo();
        return !!info && battler && battler.isActor && battler.isActor() && info.fighters.indexOf(battler.actorId()) >= 0;
    }

    Game_Actor.prototype.setHp = function(hp) {
        const info = pvpInfo();
        if (info && !info.lethal && hp <= 0 && isPvpFighter(this)) {
            hp = 1;
            pvpEliminate(this.actorId(), currentHitter());
        }
        return Game_BattlerBase.prototype.setHp.call(this, hp);
    };

    // las partes de un doble muertas: lo mismo a su personaje
    const _Game_Battler_addState_pvp = Game_Battler.prototype.addState;
    Game_Battler.prototype.addState = function(stateId) {
        const info = pvpInfo();
        if (info && !info.lethal && stateId === this.deathStateId() && isPvpFighter(this) && !this.isStateAffected(stateId)) {
            // (muerte de golpe sin muerte: 1 de vida y fuera)
            Game_BattlerBase.prototype.setHp.call(this, Math.max(1, this.hp));
            pvpEliminate(this.actorId(), currentHitter());
            return;
        }
        const enemyPart = this.isEnemy && this.isEnemy() && this._coopPart;
        const wasDead = enemyPart && this.isDead();
        _Game_Battler_addState_pvp.call(this, stateId);
        if (!info || !enemyPart || wasDead || stateId !== this.deathStateId()) return;
        // (el juego vuelve a "matar" la parte ya cortada al refrescarla: cuenta una sola vez)
        if (this._coopCut) return;
        this._coopCut = true;
        const a = $gameActors.actor(this._coopOwner);
        if (!a) return;
        if (this._coopPart === 'torso' || this._coopPart === 'head') {
            // sin torso o sin cabeza no queda nada de ese doble: cae su personaje
            const hitter = currentHitter();
            if (hitter && hitter.actorId() !== a.actorId() && !info.killedBy[a.actorId()]) info.killedBy[a.actorId()] = hitter.actorId();
            if (info.lethal) {
                if (a.isAlive()) {
                    Game_BattlerBase.prototype.setHp.call(a, 0);
                    a.addState(a.deathStateId());
                }
            } else {
                Game_BattlerBase.prototype.setHp.call(a, 1);
            }
            pvpEliminate(a.actorId(), hitter);
        } else if (this._coopPart === 'arm' || this._coopPart === 'leg') {
            const st = this._coopPart === 'arm' ? stateIdNamed(/^arm cut$/i) : stateIdNamed(/^leg cut$/i);
            if (st && !coop.cheat('cheatLimbs')) {
                a.addState(st);
                // el juego lo apunta ya (miembro perdido, sangrado, imagen de combate, el arma)
                const gfx = battleGfxEventId();
                if (gfx) $gameTemp.reserveCommonEvent(gfx);
            }
            const part = (/\[(.*)\]/.exec(this.enemy().name) || [])[1] || this._coopPart;
            coop.banner(a.name() + ': ' + part + ' cut off!', this._coopPart === 'leg' ? 'The head is easy to hit now' : 'Hits much weaker', '#ff6655', 170);
        }
    };

    // sin piernas la cabeza ya no esquiva; sin brazos se pega mucho mas flojo
    function partsOf(ownerId, kind) {
        return $gameTroop.members().filter(e => e._coopOwner === ownerId && e._coopPart === kind);
    }
    const _Game_Enemy_xparam = Game_Enemy.prototype.xparam;
    Game_Enemy.prototype.xparam = function(xparamId) {
        const v = _Game_Enemy_xparam.call(this, xparamId);
        if (xparamId === 1 && this._coopPart === 'head' && pvpInfo() && partsOf(this._coopOwner, 'leg').some(e => e.isDead())) return Math.min(v, 0.05);
        return v;
    };
    function armFactor(actor) {
        const arms = partsOf(actor.actorId(), 'arm');
        if (arms.length === 0) return 1;
        const lost = arms.filter(e => e.isDead()).length;
        return lost === 0 ? 1 : lost < arms.length ? 0.5 : 0.1;
    }
    const _Game_Action_makeDamageValue_pvp = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        const value = _Game_Action_makeDamageValue_pvp.call(this, target, critical);
        const subject = this.subject();
        if (!pvpInfo() || !target || !target._coopOwner || !subject || !subject.isActor()) return value;
        const mult = Number(coop.setting('pvpDamage')) || 1;
        return Math.round(value * mult * armFactor(subject));
    };

    // por la espalda: el atacado pierde su primer turno
    const _Game_BattlerBase_canInput_pvp = Game_BattlerBase.prototype.canInput;
    Game_BattlerBase.prototype.canInput = function() {
        const info = pvpInfo();
        if (info && this.isActor() && info.backstabbed.indexOf(this.actorId()) >= 0 && $gameTroop.turnCount() === 0) return false;
        // (sin muerte, quien cayo ya no juega)
        if (info && this.isActor() && info.out[this.actorId()]) return false;
        return _Game_BattlerBase_canInput_pvp.call(this);
    };

    // "Run" (en Termina se huye con esa habilidad, que hace su efecto en las paginas de la tropa):
    // en PvP, huir acaba el combate para los dos (cada uno vuelve como esta)
    const _Game_Temp_reserveCommonEvent_pvp = Game_Temp.prototype.reserveCommonEvent;
    Game_Temp.prototype.reserveCommonEvent = function(commonEventId) {
        const ce = $dataCommonEvents[commonEventId];
        if (pvpInfo() && ce && /skills_run/i.test(ce.name)) {
            const who = BattleManager._subject && BattleManager._subject.name ? BattleManager._subject.name() : '';
            if (!BattleManager._coopPvpEnded) {
                BattleManager._coopPvpEnded = true;
                coop.banner((who || 'Somebody') + ' runs away', 'The fight is over', '#ffaa44', 150);
                BattleManager.abort();
            }
            return;
        }
        _Game_Temp_reserveCommonEvent_pvp.call(this, commonEventId);
    };
    const _BattleManager_processEscape_pvp = BattleManager.processEscape;
    BattleManager.processEscape = function() {
        if (!pvpInfo()) return _BattleManager_processEscape_pvp.call(this);
        $gameParty.performEscape();
        SoundManager.playEscape();
        this._escaped = true;
        this.processAbort();
        return true;
    };

    // al acabar: sin muerte, lo cortado en el combate vuelve; si murio el protagonista, fin de partida
    const _BattleManager_endBattle_pvp = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        const info = pvpInfo();
        if (info) {
            if (!info.lethal) {
                info.fighters.forEach(id => limbRestore($gameActors.actor(id), info.before && info.before[id]));
            }
            const hero = $gameActors.actor($gameParty._actors[0]);
            if (info.lethal && hero && hero.isDead() && info.fighters.indexOf(hero.actorId()) >= 0) {
                const killer = protagonistHeir(info, hero);
                if (!takeOverProtagonist(hero, killer)) this._coopPvpGameOver = true;
            }
        }
        _BattleManager_endBattle_pvp.call(this, result);
    };

    // quien hereda: el jugador principal del bando del que dio el golpe final (aunque lo diera un
    // companero o quien le ayudaba); si ese ya no vive, el siguiente jugador vivo de ese bando
    function protagonistHeir(info, hero) {
        let byId = info.killedBy[hero.actorId()];
        let side = byId ? sideIndexOf($gameActors.actor(byId), info) : -1;
        if (side < 0 || side === sideIndexOf(hero, info)) {
            // (sin golpe de otro: el bando que queda)
            side = info.sides.findIndex((sd, i) => i !== sideIndexOf(hero, info) && sideInGame(sd, info));
        }
        if (side < 0) return null;
        const sd = info.sides[side];
        for (const n of sd.players) {
            const a = n === 1 ? $gameActors.actor($gameParty._actors[0]) : (coop.player(n) && coop.player(n).actor());
            if (a && a.isAlive() && a !== hero) return a;
        }
        return null;
    }

    // ---- quien mata al protagonista ocupa su lugar ----------------------------------------
    // El que mata a P1 en un combate a muerte pasa a ser el protagonista: su personaje va el primero
    // del grupo, con el interruptor "SELECT" de protagonista (el que mira la historia), y lo lleva P1.
    // El muerto queda como companero muerto del numero que tenia el que le mato: su cuerpo, esperar,
    // volver con una piedra de alma (ya como companero). En el co-op local se cambian de sitio los
    // jugadores (mandos / lado del teclado): lo dice la pantalla.
    const PROTAGONIST_SELECT_EXTRA = { 6: 2401 }; // (O'saa: YELLOW_MAGE_SELECT)
    function selectSwitchOf(actorId) {
        const prof = gameProfile();
        return (prof && prof.select[actorId]) || (isTermina() && PROTAGONIST_SELECT_EXTRA[actorId]) || 0;
    }
    function takeOverProtagonist(victim, killer) {
        if (!victim || !killer || killer.isDead() || !isTermina()) return false;
        const net = window.CoopNet;
        if (net && net.active && !net.swapSeats) return false; // (en red: hasta que se puedan cambiar los PC)
        const oldSw = selectSwitchOf(victim.actorId());
        const newSw = selectSwitchOf(killer.actorId());
        if (!oldSw || !newSw) return false;
        const killerPlayer = coop.players().find(pl => pl._coopActorId === killer.actorId());
        const m = killerPlayer ? killerPlayer.coopIndex() : 0;
        if (!m) return false;
        // la historia: quien es el protagonista
        $gameSwitches.setValue(oldSw, false);
        $gameSwitches.setValue(newSw, true);
        // el grupo: el que mato va el primero, el muerto ocupa su puesto
        const actors = $gameParty._actors;
        const iv = actors.indexOf(victim.actorId());
        const ik = actors.indexOf(killer.actorId());
        if (iv < 0 || ik < 0) return false;
        actors[iv] = killer.actorId();
        actors[ik] = victim.actorId();
        killerPlayer._coopActorId = victim.actorId();
        const owners = $gameSystem._coopOwners;
        if (owners) {
            delete owners[killer.actorId()];
            delete owners[victim.actorId()];
        }
        // en el mapa: el nuevo protagonista donde estaba el que mato (y el cuerpo, donde cayo P1)
        const a = { x: $gamePlayer.x, y: $gamePlayer.y, d: $gamePlayer.direction() };
        const b = { x: killerPlayer.x, y: killerPlayer.y, d: killerPlayer.direction() };
        $gamePlayer.locate(b.x, b.y);
        $gamePlayer.setDirection(b.d);
        killerPlayer.locate(a.x, a.y);
        killerPlayer.setDirection(a.d);
        $gamePlayer.refresh();
        if (killerPlayer.refresh) killerPlayer.refresh();
        $gameMap.requestRefresh();
        $gameSystem._coopProtagonistChanges = ($gameSystem._coopProtagonistChanges || 0) + 1;
        if (net && net.active) {
            const me = net.swapSeats(1, m);
            if (me === 1) coop.banner('You are the protagonist now', 'You killed ' + victim.name() + ' - you play P1: ' + killer.name(), '#ffcc55', 360);
            else if (me === m) coop.banner(victim.name() + ' is dead', killer.name() + ' is the protagonist now. You are P' + m + ': wait for a character, or a soul stone', '#ff6655', 360);
            else coop.banner(killer.name() + ' is the protagonist now', killer.name() + ' killed ' + victim.name(), '#ffcc55', 300);
        } else coop.banner(killer.name() + ' is the protagonist now', 'P' + m + ', take P1\'s controls - ' + victim.name() + "'s player takes P" + m + "'s", '#ffcc55', 420);
        return true;
    }
    const _BattleManager_updateBattleEnd_pvp = BattleManager.updateBattleEnd;
    BattleManager.updateBattleEnd = function() {
        _BattleManager_updateBattleEnd_pvp.call(this);
        if (this._coopPvpGameOver) {
            this._coopPvpGameOver = false;
            SceneManager.goto(Scene_Gameover);
        }
    };

    // los dobles no hacen nada por si mismos (los maneja su jugador con su personaje)
    const _Game_Enemy_makeActions = Game_Enemy.prototype.makeActions;
    Game_Enemy.prototype.makeActions = function() {
        if (pvpInfo()) {
            this.clearActions();
            return;
        }
        _Game_Enemy_makeActions.call(this);
    };
    ['exp', 'gold'].forEach(name => {
        const orig = Game_Enemy.prototype[name];
        Game_Enemy.prototype[name] = function() { return pvpInfo() ? 0 : orig.call(this); };
    });
    const _Game_Enemy_makeDropItems = Game_Enemy.prototype.makeDropItems;
    Game_Enemy.prototype.makeDropItems = function() { return pvpInfo() ? [] : _Game_Enemy_makeDropItems.call(this); };

    // un bando como "grupo" (curar / ayudar: solo a los suyos)
    function Game_CoopSide() {
        this.initialize.apply(this, arguments);
    }
    Game_CoopSide.prototype = Object.create(Game_Unit.prototype);
    Game_CoopSide.prototype.constructor = Game_CoopSide;
    Game_CoopSide.prototype.initialize = function(side) {
        Game_Unit.prototype.initialize.call(this);
        this._coopSide = side;
        this._inBattle = true;
    };
    Game_CoopSide.prototype.members = function() {
        return pvpInfo() ? $gameParty.battleMembers().filter(a => sideIndexOf(a) === this._coopSide) : [];
    };

    const _Game_Actor_friendsUnit = Game_Actor.prototype.friendsUnit;
    Game_Actor.prototype.friendsUnit = function() {
        if (pvpInfo()) return new Game_CoopSide(sideIndexOf(this));
        return _Game_Actor_friendsUnit.call(this);
    };

    // a quien se puede elegir: las partes de los dobles de los otros bandos
    if (Window_BattleEnemy.prototype.allowedTargets) {
        const _allowedTargets = Window_BattleEnemy.prototype.allowedTargets;
        Window_BattleEnemy.prototype.allowedTargets = function() {
            const list = _allowedTargets.call(this);
            if (!pvpInfo()) return list;
            const rivals = rivalOwners(BattleManager.actor());
            return list.filter(e => rivals.indexOf(e._coopOwner) >= 0);
        };
    }
    const _Window_BattleEnemy_refresh = Window_BattleEnemy.prototype.refresh;
    Window_BattleEnemy.prototype.refresh = function() {
        _Window_BattleEnemy_refresh.call(this);
        if (pvpInfo() && this._enemies) {
            const rivals = rivalOwners(BattleManager.actor());
            this._enemies = this._enemies.filter(e => rivals.indexOf(e._coopOwner) >= 0);
            Window_Selectable.prototype.refresh.call(this);
        }
    };

    // si el juego elige solo (confusion, objetivo al azar): tambien a un doble de otro bando
    const _Game_Action_targetsForOpponents = Game_Action.prototype.targetsForOpponents;
    Game_Action.prototype.targetsForOpponents = function() {
        const targets = _Game_Action_targetsForOpponents.call(this);
        if (!pvpInfo() || !this.subject() || !this.subject().isActor()) return targets;
        const rivals = rivalOwners(this.subject());
        if (!rivals.length) return [];
        const ok = targets.filter(e => rivals.indexOf(e._coopOwner) >= 0);
        if (ok.length) return ok;
        const alive = $gameTroop.aliveMembers().filter(e => rivals.indexOf(e._coopOwner) >= 0);
        const torso = alive.find(e => e._coopMirror) || alive[0];
        return torso ? [torso] : [];
    };

    // en el combate estan los de los bandos (sus personajes y los companeros que manejan); sin
    // muerte, quien cayo ya no esta (ni su bando entero, si cayeron todos)
    const _Game_Party_battleMembers_pvp = Game_Party.prototype.battleMembers;
    Game_Party.prototype.battleMembers = function() {
        const list = _Game_Party_battleMembers_pvp.call(this);
        const info = this._inBattle && $gameTroop && $gameTroop._coopPvp;
        if (!info) return list;
        return list.filter(a => {
            const i = sideIndexOf(a, info);
            if (i < 0) return false;
            if (info.lethal) return true;
            return !info.out[a.actorId()] && sideInGame(info.sides[i], info);
        });
    };

    // nadie pierde "por grupo": se acaba cuando cae uno de los dos (ver arriba)
    const _Game_Party_isAllDead_pvp = Game_Party.prototype.isAllDead;
    Game_Party.prototype.isAllDead = function() {
        if (pvpInfo()) return false;
        return _Game_Party_isAllDead_pvp.call(this);
    };

    // cada doble va con su personaje (vida que pierde por veneno, sangrado...); si cae, se acaba
    const _Game_Troop_isAllDead_pvp = Game_Troop.prototype.isAllDead;
    Game_Troop.prototype.isAllDead = function() {
        const info = this._coopPvp && pvpInfo();
        if (!info) return _Game_Troop_isAllDead_pvp.call(this);
        this.members().forEach(e => {
            if (!e._coopMirror || !e.isAlive()) return;
            const a = $gameActors.actor(e._coopMirror);
            if (!a) return;
            // (su personaje cambio por otra cosa: curarse, sangrar...)
            if (a.hp !== e._coopActorHp) {
                e._hp = a.hp <= 0 ? 0 : Math.max(1, Math.round(e.mhp * a.hp / Math.max(1, a.mhp)));
                e._coopActorHp = a.hp;
            }
            if (a.isDead()) pvpEliminate(a.actorId(), null);
        });
        return false;
    };

    // ---- lo que ve cada uno (solo dibujo) ----
    // quien mira: en red, el personaje de este PC (si no lucha, ve todo); en un mismo PC, quien elige
    // o quien actua
    function pvpViewer() {
        const info = pvpInfo();
        if (!info) return null;
        const net = window.CoopNet;
        if (net && net.active) {
            const mine = playerActor(net.player);
            return mine && sideIndexOf(mine, info) >= 0 ? mine : null;
        }
        const subject = BattleManager._subject;
        return BattleManager.actor() || (subject && subject.isActor && subject.isActor() ? subject : null) || $gameActors.actor(info.fighters[info.fighters.length - 1]);
    }

    // los dobles que ve este PC, en orden (los de los otros bandos que siguen en el combate)
    function shownOwners(info, viewer) {
        const vs = viewer ? sideIndexOf(viewer, info) : -1;
        return info.fighters.filter(id => !info.out[id] && (vs < 0 || sideIndexOf($gameActors.actor(id), info) !== vs));
    }
    const SLOT_SCALE = [1, 1, 0.75, 0.6, 0.5];
    // donde esta cada doble en el juego: su centro y sus pies (de sus partes)
    function doubleFrame(owner) {
        let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
        $gameTroop.members().forEach(e => {
            if (e._coopOwner !== owner) return;
            minX = Math.min(minX, e.screenX());
            maxX = Math.max(maxX, e.screenX());
            maxY = Math.max(maxY, e.screenY());
        });
        return { cx: (minX + maxX) / 2, bottom: maxY };
    }
    const _Sprite_Enemy_update = Sprite_Enemy.prototype.update;
    Sprite_Enemy.prototype.update = function() {
        // (deshacer lo de antes: el juego pone su escala y su sitio)
        if (this._coopScale) {
            this.scale.x /= this._coopScale;
            this.scale.y /= this._coopScale;
            this._coopScale = 0;
        }
        _Sprite_Enemy_update.call(this);
        const e = this._enemy;
        const info = e && e._coopOwner && pvpInfo();
        if (!info) return;
        const viewer = pvpViewer();
        const shown = shownOwners(info, viewer);
        const slot = shown.indexOf(e._coopOwner);
        // (los dobles de su bando no se ven: solo los de los otros; "renderable" es solo el dibujo)
        this.renderable = slot >= 0;
        if (slot < 0) return;
        if (shown.length < 2) return;
        // varios: cada uno en su sitio de la fila, mas pequeno, con los pies en la misma linea
        const k = shown.length;
        const sc = SLOT_SCALE[Math.min(k, SLOT_SCALE.length - 1)];
        const f = doubleFrame(e._coopOwner);
        const slotX = Graphics.width * (slot + 1) / (k + 1);
        this.x = slotX + (this.x - f.cx) * sc;
        this.y = f.bottom + (this.y - f.bottom) * sc;
        this.scale.x *= sc;
        this.scale.y *= sc;
        this._coopScale = sc;
        // (los numeros de dano salen donde estaba antes de ponerlo en su sitio: alli no)
        (this._damages || []).forEach(sp => {
            if (sp._coopPlaced) return;
            sp._coopPlaced = true;
            sp.x = this.x + (this.damageOffsetX ? this.damageOffsetX() : 0);
            sp.y = this.y + (this.damageOffsetY ? this.damageOffsetY() : 0);
        });
    };

    // en red, el rival tampoco esta en el grupo de este PC (ni su dibujo ni su fila)
    function hiddenRival(actor) {
        const net = window.CoopNet;
        if (!actor || !net || !net.active) return false;
        const viewer = pvpViewer();
        return !!viewer && actor !== viewer && sideIndexOf(actor) !== sideIndexOf(viewer);
    }

    if (typeof Sprite_Actor !== 'undefined') {
        const _Sprite_Actor_update = Sprite_Actor.prototype.update;
        Sprite_Actor.prototype.update = function() {
            _Sprite_Actor_update.call(this);
            this.renderable = !(this._actor && pvpInfo() && hiddenRival(this._actor));
        };
    }
    // cuando elige el rival, sus ventanas (comandos, habilidades, objetivo...) no se ven en este PC
    ['Window_ActorCommand', 'Window_BattleSkill', 'Window_BattleItem', 'Window_BattleEnemy', 'Window_BattleActor', 'Window_Help'].forEach(cls => {
        const klass = window[cls];
        if (!klass || !klass.prototype.update) return;
        const _update = klass.prototype.update;
        klass.prototype.update = function() {
            _update.apply(this, arguments);
            this.renderable = !(pvpInfo() && hiddenRival(BattleManager.actor()));
        };
    });

    // la fila del rival en el estado del grupo (abajo): no se dibuja en este PC
    const _Window_BattleStatus_drawItem = Window_BattleStatus.prototype.drawItem;
    Window_BattleStatus.prototype.drawItem = function(index) {
        if (pvpInfo() && hiddenRival($gameParty.battleMembers()[index])) return;
        _Window_BattleStatus_drawItem.call(this, index);
    };
    // (y la marca de "elige este" sobre su fila vacia)
    const _Window_BattleStatus_update = Window_BattleStatus.prototype.update;
    Window_BattleStatus.prototype.update = function() {
        _Window_BattleStatus_update.apply(this, arguments);
        if (this._windowCursorSprite) {
            this._windowCursorSprite.renderable = !(pvpInfo() && this.index() >= 0 && hiddenRival($gameParty.battleMembers()[this.index()]));
        }
    };
    if (typeof Window_BattleSideBase !== 'undefined') {
        const _Window_BattleSideBase_update = Window_BattleSideBase.prototype.update;
        Window_BattleSideBase.prototype.update = function() {
            _Window_BattleSideBase_update.call(this);
            this.renderable = !(pvpInfo() && hiddenRival(this._actor));
        };
    }

    // y la fila de OK: atacar (solo si la casilla de delante es de un jugador)
    ['checkEventTriggerThere'].forEach(name => {
        [Game_Player.prototype, window.Game_CoopPlayer && Game_CoopPlayer.prototype].forEach(proto => {
            if (!proto || !proto[name]) return;
            const orig = proto[name];
            proto[name] = function(triggers) {
                if (triggers && triggers.includes(0) && tryPvp(this, playerNumberOf(this))) return;
                orig.call(this, triggers);
            };
        });
    });

    window.CoopTower = { contestants: contestants, left: contestantsLeft, door: TOWER_DOOR, kill: () => killContestantsAction.run() };
    window.CoopPvp = { prepare: prepare, prepareAll: prepareAll, doorOwner: doorOwner, doorChoice: doorChoice, doorResolve: doorResolve,
        doorEnd: doorEnd, prepareDoorFight: prepareDoorFight, doorEndProtagonist: doorEndProtagonist, addFighter: addFighter, joinEventList: joinEventList, shownOwners: shownOwners, eventList: pvpEventList, candidates: pvpCandidates, troopFor: pvpTroopFor, pending: pvpPending, tryPvp: tryPvp, info: pvpInfo, armFactor: armFactor, sideOf: a => sideIndexOf(a), rivals: rivalOwners, heir: protagonistHeir, takeOver: takeOverProtagonist, selectSwitchOf: selectSwitchOf, limbSwitches: limbSwitches, snapshot: limbSnapshot };

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
