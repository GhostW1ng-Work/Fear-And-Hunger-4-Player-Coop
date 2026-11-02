//=============================================================================
// main.js
//=============================================================================
// Fear & Hunger Co-op: the game's own main.js, plus
//  - the game in Russian when the mod's Language is Russian: the translation of THIS game from
//    www/lang/ru-* (Termina: by savannstm; Fear & Hunger 1: by khoohatt) is used instead of the game's
//    files - data, pictures, videos, its plugins.js and plugins, the engine files it changed. The game's
//    own files stay as they are, so English is one switch away;
//  - the co-op plugins added after the game's plugins - so unpacking the mod into the game folder
//    is enough (js/plugins.js is not touched). If plugins.js already lists them (the installer),
//    nothing is added twice; if their files are gone (mod removed), nothing is added.

(function() {
    var fs = null, path = null, base = '';
    try {
        fs = require('fs');
        path = require('path');
        base = path.dirname(process.mainModule.filename);
    } catch (e) {
        fs = null;
    }
    var json = function(p) { return JSON.parse(String(fs.readFileSync(p, 'utf8')).replace(/^﻿/, '')); };

    // ---- which translation: the one made for this game (the same title, switches and variables;
    // the mod's archive goes into both games)
    var ruRel = '';
    if (fs && fs.existsSync(path.join(base, 'lang'))) {
        try {
            var mine = json(path.join(base, 'data', 'System.json'));
            fs.readdirSync(path.join(base, 'lang')).forEach(function(dir) {
                if (ruRel || !/^ru/i.test(dir)) return;
                var sys = path.join(base, 'lang', dir, 'data', 'System.json');
                if (!fs.existsSync(sys)) return;
                var theirs = json(sys);
                if (theirs.gameTitle === mine.gameTitle && theirs.switches.length === mine.switches.length &&
                    theirs.variables.length === mine.variables.length) ruRel = 'lang/' + dir;
            });
        } catch (e) {
            ruRel = '';
        }
    }
    var hasRu = !!ruRel;

    // ---- the game's language: www/coop_lang.txt ("ru" / "en"), written by the mod's Language setting
    var lang = 'en';
    if (hasRu) {
        var chosen = '';
        try {
            chosen = String(fs.readFileSync(path.join(base, 'coop_lang.txt'), 'utf8')).trim();
        } catch (e) {
            chosen = '';
        }
        // (no choice yet: the language of the PC)
        if (chosen !== 'ru' && chosen !== 'en') chosen = /^ru/i.test(navigator.language || '') ? 'ru' : 'en';
        lang = chosen;
    }
    window.$coopGameLang = lang;
    window.$coopHasRu = hasRu;
    window.$coopRuDir = ruRel;

    // (NW.js can keep what is changed in XMLHttpRequest and the media elements across a restart of
    // the game: what to use is kept on them and looked at on every load)
    var files = null;
    if (lang === 'ru') {
        var ruDir = path.join(base, ruRel);
        files = {};
        (function walk(dir, rel) {
            fs.readdirSync(dir).forEach(function(n) {
                var p = path.join(dir, n), r = rel ? rel + '/' + n : n;
                if (fs.statSync(p).isDirectory()) walk(p, r);
                else files[r] = true;
            });
        })(ruDir, '');
        // the engine files it changed (already loaded: loaded again, before anything is made with them)
        Object.keys(files).filter(function(f) { return /^js\/rpg_\w+\.js$/.test(f); }).forEach(function(f) {
            try {
                (0, eval)(fs.readFileSync(path.join(ruDir, f), 'utf8'));
            } catch (e) {
                console.error('main.js: ' + ruRel + '/' + f, e);
            }
        });
        // its plugin list (its texts in the plugin parameters, its own plugins)
        if (files['js/plugins.js']) {
            try {
                window.$plugins = new Function(fs.readFileSync(path.join(ruDir, 'js', 'plugins.js'), 'utf8') + '\nreturn $plugins;')();
            } catch (e) {
                console.error('main.js: ' + ruRel + '/js/plugins.js', e);
            }
        }
        // its plugins (and its versions of game plugins)
        var loadScript = PluginManager.loadScript;
        PluginManager.loadScript = function(name) {
            var keep = this._path;
            if (files['js/plugins/' + name]) this._path = ruRel + '/js/plugins/';
            try {
                loadScript.call(this, name);
            } finally {
                this._path = keep;
            }
        };
    }
    // a file of the game that the translation has: its own
    var ruUrl = function(list, prefix, url) {
        if (!list || typeof url !== 'string' || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
        var rel = url.replace(/^\.\//, '').split('?')[0];
        var key = rel;
        try {
            key = decodeURIComponent(rel);
        } catch (e) {
            key = rel;
        }
        return list[key] ? prefix + '/' + rel : url;
    };
    // data and encrypted pictures come with XMLHttpRequest; videos: <video src>, <source src> (PIXI)
    var xhr = XMLHttpRequest.prototype;
    xhr.__coopRuFiles = files;
    xhr.__coopRuDir = ruRel;
    if (!xhr.__coopRuOpen) {
        xhr.__coopRuOpen = true;
        var open = xhr.open;
        xhr.open = function(method, url) {
            var args = Array.prototype.slice.call(arguments);
            args[1] = ruUrl(this.__coopRuFiles, this.__coopRuDir, url);
            return open.apply(this, args);
        };
    }
    [window.HTMLMediaElement, window.HTMLSourceElement].forEach(function(cls) {
        if (!cls) return;
        cls.prototype.__coopRuFiles = files;
        cls.prototype.__coopRuDir = ruRel;
        if (cls.prototype.__coopRuSrc) return;
        var d = Object.getOwnPropertyDescriptor(cls.prototype, 'src');
        if (!d || !d.set) return;
        cls.prototype.__coopRuSrc = true;
        Object.defineProperty(cls.prototype, 'src', {
            get: d.get,
            set: function(v) { d.set.call(this, ruUrl(this.__coopRuFiles, this.__coopRuDir, v)); },
            configurable: true
        });
    });

    // ---- the co-op plugins, after the game's ones
    var coop = ['LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_Net'];
    var pluginDir = fs ? path.join(base, 'js', 'plugins') : '';
    coop.forEach(function(name) {
        var listed = $plugins.some(function(p) { return p.name === name; });
        var present = !fs || fs.existsSync(path.join(pluginDir, name + '.js'));
        if (!listed && present) $plugins.push({ name: name, status: true, description: 'Local Co-op', parameters: {} });
    });
})();

PluginManager.setup($plugins);

window.onload = function() {
    SceneManager.run(Scene_Boot);
};
