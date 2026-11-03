"""Loads the real RPG Maker MV engine of an installed Fear & Hunger 2: Termina into V8
(py_mini_racer), with graphics stubbed, plus the co-op plugins from this repository.

The game itself is not part of this repository: set TERMINA_GAME to its `www` folder
(default: C:/Games/Fear2/www).
"""
import os
from py_mini_racer import MiniRacer

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.environ.get('TERMINA_GAME', 'C:/Games/Fear2/www').replace('\\', '/')
PLUGINS = os.path.join(HERE, '..', 'plugins')


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


# Los plugins del propio juego (los de su js/plugins.js, en su orden y con sus parametros), como en
# el juego: cambian eventos, mensajes, combate... (HIME_LargeChoices copia la lista del evento en cada
# eleccion: sin el, los tests no vieron un fallo). GAME_PLUGINS=0: sin ellos. Los que no pueden
# funcionar sin el juego de verdad (Steam, el ratón, el sonido...) se saltan y se dicen.
SKIP_GAME_PLUGINS = {
    'Archeia_Steamworks', 'OrangeGreenworks', 'Community_Basic',   # Steam / la ventana de NW.js
}
GAME_PLUGIN_REPORT = []
# (falla tambien en el juego: lee sus parametros con otro nombre y hace eval("[object Object]"))
BROKEN_IN_GAME = {'physical_attack_animation'}
GAME_PLUGIN_PRELUDE = r"""
document.getElementsByTagName = document.getElementsByTagName || function(tag) {
    var list = String(tag).toLowerCase() === 'head' ? [document.head] : [document.currentScript || { src: '' }];
    list.item = function(i) { return this[i]; };
    if (list[0] && list[0].appendChild && !list[0].__coopSheet) {
        list[0].__coopSheet = true;
        var add = list[0].appendChild;
        list[0].appendChild = function(c) { if (c && !c.sheet) c.sheet = { insertRule: function() {} }; return add ? add.apply(this, arguments) : c; };
    }
    return list;
};
if (!window.location || !window.location.pathname) { window.location = { pathname: '/game/www/index.html', search: '', href: 'file:///game/www/index.html' }; }
if (typeof location !== 'undefined' && !location.pathname) { location.pathname = '/game/www/index.html'; location.href = 'file:///game/www/index.html'; }
document.createTextNode = document.createTextNode || function(t) { return { textContent: t }; };
XMLHttpRequest.prototype.open = XMLHttpRequest.prototype.open || function() {};
XMLHttpRequest.prototype.send = XMLHttpRequest.prototype.send || function() {};
XMLHttpRequest.prototype.overrideMimeType = XMLHttpRequest.prototype.overrideMimeType || function() {};
var __extends = this.__extends || function(d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; } d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __()); };
"""


def game_plugin_list():
    import json, re
    src = read(GAME + '/js/plugins.js')
    body = src[src.index('['):src.rindex(']') + 1]
    # (sin el propio co-op si esta instalado en esa copia: va despues, de este repositorio)
    return [p for p in json.loads(body) if p.get('status') and not re.match(r'^(LookOutsideOnline|LocalCoop_)', p['name'])]


def load_game_plugins(ctx):
    if os.environ.get('GAME_PLUGINS', '1') == '0':
        return
    import json
    plugins = game_plugin_list()
    ctx.eval('var __params = %s;' % json.dumps({p['name'].lower(): p.get('parameters', {}) for p in plugins}))
    ctx.eval('var $plugins = %s;' % json.dumps(plugins))
    GAME_PLUGIN_REPORT.clear()
    # lo que estos plugins miran de la pagina del juego al cargar
    ctx.eval(GAME_PLUGIN_PRELUDE)
    for p in plugins:
        name = p['name']
        if name in SKIP_GAME_PLUGINS:
            GAME_PLUGIN_REPORT.append('skip ' + name)
            continue
        path = GAME + '/js/plugins/' + name + '.js'
        if not os.path.exists(path):
            GAME_PLUGIN_REPORT.append('missing ' + name)
            continue
        try:
            ctx.eval('document.currentScript = { src: "js/plugins/" + %s + ".js" };' % json.dumps(name))
            ctx.eval(read(path))
            GAME_PLUGIN_REPORT.append('ok ' + name)
            # (GALV_EventSpawner carga al empezar el mapa de donde salen los eventos: aqui, igual)
            if name == 'GALV_EventSpawner':
                spawn = int(str(p.get('parameters', {}).get('Spawn Map Id', '0')) or 0)
                spawn_file = GAME + '/data/Map%03d.json' % spawn
                if spawn and os.path.exists(spawn_file):
                    ctx.eval('$dataSpawnMap = %s; if (DataManager.onLoad) DataManager.onLoad($dataSpawnMap);' % read(spawn_file))
        except Exception as e:
            msg = str(e).split('\n')[0][:160]
            GAME_PLUGIN_REPORT.append(('broken in the game too ' if name in BROKEN_IN_GAME else 'FAIL ') + name + ': ' + msg)


def game_plugins_ready(ctx):
    """after all plugins (the game's and the co-op ones): as when the game starts"""
    # como al arrancar el juego: las notas de toda la base y "base cargada" (ahi los plugins de
    # Yanfly y otros preparan sus datos)
    if os.environ.get('GAME_PLUGINS', '1') == '0':
        return
    ctx.eval('[$dataClasses, $dataSkills, $dataItems, $dataWeapons, $dataArmors, $dataEnemies, $dataStates]'
             '.forEach(function(list){ (list || []).forEach(function(o){ if (o && !o.meta) DataManager.extractMetadata(o); }); });'
             'DataManager.isDatabaseLoaded();'
             # (las partidas: como en NW.js, con archivos locales - "es de este juego" = existe;
             # en el navegador se mira el titulo, y HIME_SaveTitle lo cambia)
             'DataManager.isThisGameFile = function(id) { var g = this.loadGlobalInfo(); return !!(g && g[id]); };'
             # (sin graficos la escena de prueba no tiene _spriteset: GALV_EventSpawner no dibuja
             # sus eventos; en el juego el mapa siempre lo tiene)
             'if (typeof Galv !== "undefined" && Galv.SPAWN && Galv.SPAWN.onScene) { var __onScene = Galv.SPAWN.onScene;'
             ' Galv.SPAWN.onScene = function() { return __onScene.apply(this, arguments) && !!SceneManager._scene._spriteset; }; }'
             # (y sin ventanas: la de YEP_GabWindow, que el juego crea con el mapa)
             'if (typeof Window_Gab !== "undefined") {'
             ' var __gab = function(sc) { if (sc instanceof Scene_Map && !sc._gabWindow) { try { sc._gabWindow = new Window_Gab(false); }'
             '  catch (e) { sc._gabWindow = { storeGabs: function() {}, addGabData: function() {}, forceGabData: function() {}, clearGabData: function() {} }; } } };'
             ' var __push = SceneManager.push; SceneManager.push = function() { __gab(this._scene); return __push.apply(this, arguments); };'
             ' var __mapUpdate = Scene_Map.prototype.update; Scene_Map.prototype.update = function() { __gab(this); return __mapUpdate.apply(this, arguments); }; }')


def load_ctx(plugins=True):
    ctx = MiniRacer()
    ctx.eval(read(os.path.join(HERE, 'stubs.js')))
    for f in ['rpg_core', 'rpg_managers', 'rpg_objects', 'rpg_scenes', 'rpg_sprites', 'rpg_windows']:
        try:
            ctx.eval(read(GAME + '/js/' + f + '.js'))
        except Exception as e:
            print('LOAD FAIL', f, str(e)[:400])
            raise
    ctx.eval(read(os.path.join(HERE, 'gfx_stubs.js')))
    # datos del juego
    for name in ['Actors', 'Classes', 'Skills', 'Items', 'Weapons', 'Armors', 'Enemies', 'Troops', 'States',
                 'Animations', 'Tilesets', 'CommonEvents', 'System', 'MapInfos']:
        ctx.eval('var $data%s = %s;' % (name, read(GAME + '/data/%s.json' % name)))
    ctx.eval('DataManager.extractMetadata && $dataActors.forEach(function(a){ if (a) DataManager.extractMetadata(a); });')
    if plugins:
        ctx.eval('PluginManager._parameters = {}; PluginManager.parameters = function(n){ return (__params[n.toLowerCase()]||{}); }; var __params = {};')
        ctx.eval('Input.initialize();')
        load_game_plugins(ctx)
        for f in ['LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_QuickSave']:
            ctx.eval(read(os.path.join(PLUGINS, f + '.js')))
        if os.environ.get('WITH_NET'):
            # el plugin de red instalado pero sin usar no debe cambiar nada del co-op local
            ctx.eval('var setInterval = function() { return 0; }; var process = { mainModule: { filename: "/game/www/index.html" } };'
                     'var require = function(n) {'
                     ' if (n === "fs") return { existsSync: function() { return false; }, readFileSync: function() { return ""; },'
                     '   writeFileSync: function() {}, appendFileSync: function() {} };'
                     ' if (n === "path") return { dirname: function(p) { return p.replace(/\/[^\/]*$/, ""); }, join: function() { return Array.prototype.slice.call(arguments).join("/"); } };'
                     ' if (n === "os") return { networkInterfaces: function() { return {}; } };'
                     ' if (n === "net") return { createServer: function() { return { listen: function() {}, on: function() {}, close: function() {} }; }, connect: function() { return null; } };'
                     '};')
            ctx.eval(read(os.path.join(PLUGINS, 'LocalCoop_Net.js')))
            ctx.eval('require = undefined; process = undefined;')  # el resto de pruebas, como en un navegador
        game_plugins_ready(ctx)
    return ctx
