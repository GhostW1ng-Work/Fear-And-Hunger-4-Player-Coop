/*:
 * @target MV MZ
 * @plugindesc v1.8.3 [PRUEBAS] F6 = guardar (eligiendo ranura), F7 = cargar; Shift+F6 / Shift+F7 = guardado / carga rapida en una ranura aparte. Para probar el co-op sin buscar donde guardar.
 * @author TheTiranix
 *
 * @param Slot
 * @text Ranura
 * @desc Ranura de guardado que usan F6/F7 (la ultima, para no pisar las partidas normales).
 * @type number
 * @min 1
 * @default 99
 *
 * @help
 * Solo en el mapa y cuando no hay dialogos ni eventos en curso:
 *   F6 = pantalla de Guardar (se elige la ranura; aunque el juego no deje guardar ahora)
 *   F7 = pantalla de Cargar (tambien en la pantalla de titulo)
 *   Shift+F6 = guardar al momento en la ranura del parametro Slot
 *   Shift+F7 = cargar esa ranura
 * En la partida en red no funciona (cada PC tiene sus propios archivos).
 *
 * Es una ayuda para pruebas: en Fear & Hunger guardar cuesta, y esto se lo
 * salta. Para jugar en serio, ponga "status": false en js/plugins.js.
 */

(() => {
    'use strict';

    const params = PluginManager.parameters('LocalCoop_QuickSave') || {};
    const SLOT = Math.max(1, Number(params.Slot || 99));
    const KEY_SAVE = 117; // F6
    const KEY_LOAD = 118; // F7

    function banner(title, sub, color) {
        if (window.CoopLocal && window.CoopLocal.banner) window.CoopLocal.banner(title, sub, color || '#bbbbbb', 120);
    }

    function canUse() {
        return SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive() &&
            !$gameMap.isEventRunning() && !$gameMessage.isBusy() && !SceneManager.isSceneChanging();
    }

    function quickSave() {
        $gameSystem.onBeforeSave();
        if (DataManager.saveGame(SLOT)) {
            SoundManager.playSave();
            if (StorageManager.cleanBackup) StorageManager.cleanBackup(SLOT);
            banner('Quick save', 'Slot ' + SLOT + '  -  Shift+F7 to load it');
        } else {
            SoundManager.playBuzzer();
            banner('Quick save failed', 'Slot ' + SLOT, '#ffaa44');
        }
    }

    // La carga se hace al crear la nueva escena del mapa: asi la escena actual no sigue
    // actualizando (y ejecutando eventos) con la partida ya cargada.
    let pendingLoad = false;

    function quickLoad() {
        if (!DataManager.isThisGameFile(SLOT)) {
            SoundManager.playBuzzer();
            banner('No quick save yet', 'Press Shift+F6 first', '#ffaa44');
            return;
        }
        pendingLoad = true;
        SceneManager.goto(Scene_Map);
    }

    const _Scene_Map_create = Scene_Map.prototype.create;
    Scene_Map.prototype.create = function() {
        if (pendingLoad) {
            pendingLoad = false;
            if (DataManager.loadGame(SLOT)) {
                // igual que Scene_Load.onLoadSuccess / terminate
                SoundManager.playLoad();
                if ($gameSystem.versionId() !== $dataSystem.versionId) {
                    $gamePlayer.reserveTransfer($gameMap.mapId(), $gamePlayer.x, $gamePlayer.y);
                    $gamePlayer.requestMapReload();
                }
                $gameSystem.onAfterLoad();
            } else {
                SoundManager.playBuzzer();
            }
        }
        _Scene_Map_create.call(this);
    };

    // F6 / F7 abren las pantallas de Guardar / Cargar desde la actualizacion de la escena (no
    // desde el evento de teclado, que llega a mitad de cuadro)
    let pendingScreen = null;

    const _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        openPendingScreen(this);
        _Scene_Base_update.call(this);
    };

    function openPendingScreen(scene) {
        if (!pendingScreen || SceneManager.isSceneChanging()) return;
        const screen = pendingScreen;
        pendingScreen = null;
        if (screen === Scene_Load && scene instanceof Scene_Title) {
            SoundManager.playOk();
            SceneManager.push(Scene_Load);
        } else if (scene instanceof Scene_Map && canUse()) {
            SoundManager.playOk();
            SceneManager.push(screen);
        }
    }

    window.addEventListener('keydown', e => {
        if (e.repeat || (e.keyCode !== KEY_SAVE && e.keyCode !== KEY_LOAD)) return;
        const onTitle = SceneManager._scene instanceof Scene_Title;
        if (e.shiftKey) {
            if (!canUse()) {
                SoundManager.playBuzzer();
                return;
            }
            if (e.keyCode === KEY_SAVE) quickSave();
            else quickLoad();
            return;
        }
        if (!canUse() && !(onTitle && e.keyCode === KEY_LOAD)) {
            SoundManager.playBuzzer();
            return;
        }
        pendingScreen = e.keyCode === KEY_SAVE ? Scene_Save : Scene_Load;
    });
})();
