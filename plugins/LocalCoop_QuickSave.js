/*:
 * @target MV MZ
 * @plugindesc [PRUEBAS] F6 = guardado rapido, F7 = carga rapida, en una ranura aparte. Para probar el co-op sin buscar donde guardar. Desactivar para jugar normal.
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
 *   F6 = guardar en la ranura del parametro Slot
 *   F7 = cargar esa ranura (igual que cargarla desde el menu)
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
            banner('Quick save', 'Slot ' + SLOT + '  -  F7 to load it');
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
            banner('No quick save yet', 'Press F6 first', '#ffaa44');
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

    window.addEventListener('keydown', e => {
        if (e.repeat || (e.keyCode !== KEY_SAVE && e.keyCode !== KEY_LOAD)) return;
        if (!canUse()) {
            SoundManager.playBuzzer();
            return;
        }
        if (e.keyCode === KEY_SAVE) quickSave();
        else quickLoad();
    });
})();
