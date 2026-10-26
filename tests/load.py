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
    return ctx
