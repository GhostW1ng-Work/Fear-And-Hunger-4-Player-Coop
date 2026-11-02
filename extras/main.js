//=============================================================================
// main.js
//=============================================================================
// Fear & Hunger Co-op: the game's own main.js, plus
//  - the game in Russian (the translation by savannstm, in www/lang/ru) when the mod's Language is
//    Russian: the translated files are used instead of the game's ones (data, pictures, videos, its
//    plugins.js and plugins) - the game's own files stay as they are, so English is one switch away;
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

    // ---- the game's language: www/coop_lang.txt ("ru" / "en"), written by the mod's Language setting
    var lang = 'en';
    var ruDir = fs ? path.join(base, 'lang', 'ru') : '';
    var hasRu = !!fs && fs.existsSync(path.join(ruDir, 'data', 'System.json'));
    // (only the translation of THIS game: the same title and version - the mod's archive also goes
    // into Fear & Hunger 1, the translation is Termina's)
    if (hasRu) {
        try {
            var sys = function(p) { return JSON.parse(String(fs.readFileSync(p, 'utf8')).replace(/^﻿/, '')); };
            var mine = sys(path.join(base, 'data', 'System.json')), theirs = sys(path.join(ruDir, 'data', 'System.json'));
            hasRu = mine.versionId === theirs.versionId && mine.gameTitle === theirs.gameTitle;
        } catch (e) {
            hasRu = false;
        }
    }
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

    // (NW.js can keep what is changed in XMLHttpRequest and the media elements across a restart of
    // the game: what to use is kept on them and looked at on every load - the same page each start)
    var files = null;
    if (lang === 'ru') {
        files = {};
        (function walk(dir, rel) {
            fs.readdirSync(dir).forEach(function(n) {
                var p = path.join(dir, n), r = rel ? rel + '/' + n : n;
                if (fs.statSync(p).isDirectory()) walk(p, r);
                else files[r] = true;
            });
        })(ruDir, '');
        // its plugin list (its texts in the plugin parameters, its own plugins)
        if (files['js/plugins.js']) {
            try {
                window.$plugins = new Function(fs.readFileSync(path.join(ruDir, 'js', 'plugins.js'), 'utf8') + '\nreturn $plugins;')();
            } catch (e) {
                console.error('main.js: lang/ru/js/plugins.js', e);
            }
        }
        // its plugins (and its version of a game plugin) from lang/ru/js/plugins
        var loadScript = PluginManager.loadScript;
        PluginManager.loadScript = function(name) {
            var keep = this._path;
            if (files['js/plugins/' + name]) this._path = 'lang/ru/js/plugins/';
            try {
                loadScript.call(this, name);
            } finally {
                this._path = keep;
            }
        };
    }
    // a file of the game that the translation has: its own
    var ruUrl = function(list, url) {
        if (!list || typeof url !== 'string' || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
        var rel = url.replace(/^\.\//, '').split('?')[0];
        var key = rel;
        try {
            key = decodeURIComponent(rel);
        } catch (e) {
            key = rel;
        }
        return list[key] ? 'lang/ru/' + rel : url;
    };
    // data and encrypted pictures come with XMLHttpRequest; videos: <video src>, <source src> (PIXI)
    var xhr = XMLHttpRequest.prototype;
    xhr.__coopRuFiles = files;
    if (!xhr.__coopRuOpen) {
        xhr.__coopRuOpen = true;
        var open = xhr.open;
        xhr.open = function(method, url) {
            var args = Array.prototype.slice.call(arguments);
            args[1] = ruUrl(this.__coopRuFiles, url);
            return open.apply(this, args);
        };
    }
    [window.HTMLMediaElement, window.HTMLSourceElement].forEach(function(cls) {
        if (!cls) return;
        cls.prototype.__coopRuFiles = files;
        if (cls.prototype.__coopRuSrc) return;
        var d = Object.getOwnPropertyDescriptor(cls.prototype, 'src');
        if (!d || !d.set) return;
        cls.prototype.__coopRuSrc = true;
        Object.defineProperty(cls.prototype, 'src', {
            get: d.get,
            set: function(v) { d.set.call(this, ruUrl(this.__coopRuFiles, v)); },
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
