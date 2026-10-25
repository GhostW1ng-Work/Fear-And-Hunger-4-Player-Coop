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
    return ctx
