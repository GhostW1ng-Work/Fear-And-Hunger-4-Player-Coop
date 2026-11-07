// Memory test for the real game (not part of the mod). run.ps1 loads it from index.html, before
// main.js, and it reads www/coop_memprobe.json:
//   { mode: 'nomod' | 'mod' | 'online', role: 'host' | 'join', seconds, dwell, battleEvery, noAudio, clean }
// It walks over all the maps and fights battles without anybody playing, writes www/coop_memprobe.log
// and closes the game by itself.
(function() {
    var fs = require('fs'), path = require('path');
    var base = path.dirname(process.mainModule.filename);
    var cfg = JSON.parse(fs.readFileSync(path.join(base, 'coop_memprobe.json'), 'utf8'));
    var out = path.join(base, 'coop_memprobe.log');
    // (the online game has its own Date, the same in all the windows)
    var realNow = Date.now.bind(Date);
    var t0 = realNow();
    function log(s) { fs.appendFileSync(out, ((realNow() - t0) / 1000).toFixed(1) + ' ' + s + '\n'); }
    function shortStack() {
        return new Error().stack.split('\n').slice(2, 6).join(' < ').replace(/chrome-extension:\/\/[a-z]+\/www\/js\//g, '');
    }
    fs.writeFileSync(out, '');
    log('START pid ' + process.pid + ' ' + JSON.stringify(cfg));
    window.addEventListener('error', function(e) { log('ERROR ' + (e.error && e.error.stack || e.message)); });

    if (cfg.mode === 'nomod') {
        var setup = PluginManager.setup;
        PluginManager.setup = function(list) {
            setup.call(this, list.filter(function(p) { return !/^(LookOutsideOnline|LocalCoop_)/.test(p.name); }));
        };
    }
    if (cfg.noAudio) WebAudio.prototype._load = function() {};
    var loadConfig = ConfigManager.load;
    ConfigManager.load = function() {
        loadConfig.call(this);
        this.bgmVolume = this.bgsVolume = this.meVolume = this.seVolume = 0;
    };

    var counts = { audio: 0, audioMB: 0, bitmaps: 0, bitmapMpx: 0, cleans: 0, exc: 0, frameMs: 0, frames: 0, reads: 0 };
    var initAudio = WebAudio.prototype.initialize;
    WebAudio.prototype.initialize = function() { counts.audio++; return initAudio.apply(this, arguments); };
    var initBitmap = Bitmap.prototype.initialize;
    Bitmap.prototype.initialize = function(w, h) {
        counts.bitmaps++;
        counts.bitmapMpx += (w || 0) * (h || 0) / 1e6;
        return initBitmap.apply(this, arguments);
    };
    var decode = window.AudioContext && AudioContext.prototype.decodeAudioData;
    if (decode) AudioContext.prototype.decodeAudioData = function(a, ok, bad) {
        return decode.call(this, a, function(buf) {
            counts.audioMB += buf.length * buf.numberOfChannels * 4 / 1048576;
            if (ok) ok(buf);
        }, bad);
    };
    // a picture the data asks for that does not exist must not stop the test
    Bitmap.prototype.isError = function() { return false; };
    var isReady = Bitmap.prototype.isReady;
    Bitmap.prototype.isReady = function() { return this._loadingState === 'error' || isReady.call(this); };

    var maps = [], transfers = 0, battleTick = 0, battles = 0, lastAsked = 0, stuck = 0;
    var started = false, opened = false, lastMove = realNow(), done = false, lastStep = -1, battleSince = -1;
    function listMaps() {
        var infos = JSON.parse(fs.readFileSync(path.join(base, 'data', 'MapInfos.json'), 'utf8').replace(/^﻿/, ''));
        infos.forEach(function(m) {
            if (m && fs.existsSync(path.join(base, 'data', 'Map' + ('00' + m.id).slice(-3) + '.json'))) maps.push(m.id);
        });
        // a fixed shuffle: the same order in every run and in both windows
        var s = 12345;
        for (var i = maps.length - 1; i > 0; i--) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            var j = s % (i + 1), k = maps[i];
            maps[i] = maps[j];
            maps[j] = k;
        }
    }
    function sample(tag) {
        var m = process.memoryUsage();
        var items = ImageManager._imageCache && ImageManager._imageCache._items || {}, n = 0, px = 0;
        Object.keys(items).forEach(function(k) {
            var b = items[k].bitmap;
            n++;
            if (b && b._loadingState === 'loaded') px += b.width * b.height;
        });
        var tm = Graphics._renderer && Graphics._renderer.textureManager;
        var utils = window.PIXI && PIXI.utils;
        var sc = SceneManager._scene ? SceneManager._scene.constructor.name : '-';
        var N = window.CoopNet;
        log('MEM ' + (tag || '') + ' rss ' + (m.rss / 1048576).toFixed(0) +
            ' heap ' + (m.heapUsed / 1048576).toFixed(0) + '/' + (m.heapTotal / 1048576).toFixed(0) +
            ' cache ' + n + ' items ' + (px / 1e6).toFixed(0) + 'Mpx tex ' + (tm && tm._managedTextures ? tm._managedTextures.length : -1) +
            ' reuse ' + (Bitmap._reuseImages ? Bitmap._reuseImages.length : -1) +
            ' pixiCache ' + (utils && utils.BaseTextureCache ? Object.keys(utils.BaseTextureCache).length : -1) +
            ' bitmaps ' + counts.bitmaps + ' ' + counts.bitmapMpx.toFixed(0) + 'Mpx audio ' + counts.audio + ' ' + counts.audioMB.toFixed(0) + 'MB' +
            ' mapMs ' + (counts.frames ? (counts.frameMs / counts.frames).toFixed(2) : '-') + ' reads ' + counts.reads +
            ' transfers ' + transfers + ' battles ' + battles + ' cleans ' + counts.cleans + ' exc ' + counts.exc +
            ' map ' + (window.$gameMap ? $gameMap.mapId() : '-') + ' ' + sc +
            (N && N.active ? ' frame ' + N.frame : ''));
    }
    function nextMap() {
        if (lastAsked && $gameMap.mapId() !== lastAsked) {
            stuck++;
            if (stuck <= 8) log('STUCK asked ' + lastAsked + ' on ' + $gameMap.mapId());
            var items = ImageManager._imageCache._items;
            Object.keys(items).forEach(function(k) {
                var b = items[k].bitmap;
                if (b && !b.isReady() && !b.isRequestOnly()) delete items[k];
            });
            if (SceneManager._scene) SceneManager._scene.isBusy = function() { return false; };
            SceneManager._stopped = false;
        }
        var id = maps[transfers % maps.length];
        lastAsked = id;
        transfers++;
        if (window.$gameMessage) $gameMessage.clear();
        if ($gameMap._interpreter) $gameMap._interpreter.clear();
        $gamePlayer.reserveTransfer(id, 5, 5, 2, 0);
    }
    function pickTroop() {
        var troops = $dataTroops.filter(function(t) { return t && t.members.length; });
        return troops[(battleTick * 7) % troops.length];
    }
    function quit() {
        if (done) return;
        done = true;
        sample('END');
        if (window.gc) window.gc();
        setTimeout(function() { sample('AFTER-GC-1'); if (window.gc) window.gc(); }, 3000);
        setTimeout(function() { sample('AFTER-GC-2'); log('DONE'); nw.App.quit(); }, 8000);
    }

    // what can be reached from window (this build has no devtools, and what only a closure keeps is
    // not seen here): instances by class, canvases and typed arrays, and how to get to the old scenes
    function walk(tag) {
        var seen = new Set(), queue = [[window, 'window']], cnt = Object.create(null), paths = Object.create(null), canvasMB = 0, canvases = 0, typedMB = 0, audioMB = 0, audioN = 0;
        var trace = Object.create(null);
        ['Scene_Map', 'Scene_Battle', 'Spriteset_Map', 'Spriteset_Battle', 'ShaderTilemap', 'Game_Map'].forEach(function(k) { trace[k] = 1; });
        var t = realNow(), head = 0;
        var byOwner = {};
        while (head < queue.length && seen.size < 4000000) {
            var it = queue[head++], o = it[0], p = it[1];
            queue[head - 1] = null;
            var name = '?';
            try { name = o.constructor && o.constructor.name || 'Object'; } catch (e) {}
            cnt[name] = (cnt[name] || 0) + 1;
            if (trace[name]) (paths[name] = paths[name] || []).push(p);
            if (o instanceof HTMLCanvasElement) {
                canvases++;
                var mb = o.width * o.height * 4 / 1048576;
                canvasMB += mb;
            }
            if (ArrayBuffer.isView(o)) { typedMB += o.byteLength / 1048576; continue; }
            if (o instanceof ArrayBuffer) continue;
            if (window.AudioBuffer && o instanceof AudioBuffer) { audioN++; audioMB += o.length * o.numberOfChannels * 4 / 1048576; continue; }
            var keys = [];
            try { keys = Object.getOwnPropertyNames(o); } catch (e) {}
            for (var i = 0; i < keys.length; i++) {
                var d = null;
                try { d = Object.getOwnPropertyDescriptor(o, keys[i]); } catch (e) {}
                if (!d || !('value' in d)) continue;
                var v = d.value;
                if (!v || (typeof v !== 'object' && typeof v !== 'function') || seen.has(v)) continue;
                if (v === process || v === require || (typeof Node !== 'undefined' && v instanceof Node && !(v instanceof HTMLCanvasElement) && !(v instanceof HTMLImageElement))) continue;
                seen.add(v);
                queue.push([v, p.length < 170 ? p + '.' + keys[i] : p]);
            }
            if (o instanceof Map || o instanceof Set) {
                o.forEach(function(v2) {
                    if (v2 && typeof v2 === 'object' && !seen.has(v2)) { seen.add(v2); queue.push([v2, p + '.<entry>']); }
                });
            }
        }
        var top = Object.keys(cnt).sort(function(a, b) { return cnt[b] - cnt[a]; }).slice(0, 40).map(function(k) { return k + ' ' + cnt[k]; });
        log('WALK ' + tag + ' ' + (realNow() - t) + ' ms, objects ' + seen.size + ' canvases ' + canvases + ' ' + canvasMB.toFixed(0) + 'MB typed ' + typedMB.toFixed(0) + 'MB audioBuffers ' + audioN + ' ' + audioMB.toFixed(0) + 'MB');
        log('WALK top ' + top.join(', '));
        Object.keys(paths).forEach(function(k) {
            log('WALK ' + k + ' x' + paths[k].length + ': ' + paths[k].slice(0, 5).join('  |  '));
        });
        var list = [];
        Object.keys(cnt).forEach(function(k) { if (/Texture|Bitmap|Sprite|Window|Layer|Filter|Scene|Spriteset|Tilemap/.test(k)) list.push(k + ' ' + cnt[k]); });
        log('WALK gfx ' + list.join(', '));
    }
    if (cfg.walkAt && cfg.role === 'host') {
        String(cfg.walkAt).split(',').forEach(function(sec) {
            setTimeout(function() { walk(sec + 's'); }, Number(sec) * 1000);
        });
    }

    // once everything is loaded
    var patched = setInterval(function() {
        if (!window.Scene_Map || !SceneManager._scene) return;
        clearInterval(patched);
        // a message that an event keeps opening must not hold the next transfer
        Scene_Map.prototype.isSceneChangeOk = function() { return this.isActive(); };
        // an error of an event reached out of order: the test goes on (the game's loop dies without
        // the new request)
        SceneManager.catchException = function(e) {
            counts.exc++;
            if (counts.exc <= 6) log('EXC ' + String(e && e.stack || e).slice(0, 300));
            if (SceneManager._scene) SceneManager._scene.isBusy = function() { return false; };
            SceneManager.goto(Scene_Map);
            SceneManager.requestUpdate();
        };
        SceneManager.onError = function(e) { log('ONERR ' + (e && e.message)); };
        SceneManager.stop = function() { log('STOP asked ' + shortStack()); };
        if (cfg.clean) {
            var terminate = Scene_Map.prototype.terminate;
            Scene_Map.prototype.terminate = function() {
                var toMap = SceneManager.isNextScene(Scene_Map);
                terminate.apply(this, arguments);
                if (!toMap) return;
                counts.cleans++;
                if (Bitmap._reuseImages) Bitmap._reuseImages.length = 0;
                if (window.gc) window.gc();
                Graphics.callGC();
            };
        }
        if (cfg.noLights) {
            Spriteset_Map.prototype.coopSharedLights = function() {};
            log('no shared lights');
        }
        if (cfg.mode === 'online') {
            var update = Scene_Map.prototype.update;
            Scene_Map.prototype.update = function() {
                var t = performance.now();
                update.call(this);
                counts.frameMs += performance.now() - t;
                counts.frames++;
                onlineStep();
            };
            // a battle of everybody is the scene itself (no map under it)
            var updateBattle = Scene_Battle.prototype.update;
            Scene_Battle.prototype.update = function() {
                updateBattle.call(this);
                var N = window.CoopNet;
                if (!N || !N.active || done || (N.battle && N.battle())) return;
                if (battleSince < 0) battleSince = N.frame;
                if (N.frame - battleSince > cfg.dwell * 60 && BattleManager._phase !== 'aborting' && BattleManager._phase !== 'battleEnd') {
                    BattleManager._phase = 'aborting';
                }
                // an event of the troop or a message nobody answers holds the end: closed by force
                if (N.frame - battleSince > cfg.dwell * 60 + 180 && !SceneManager._nextScene) {
                    log('battle closed by force, phase ' + BattleManager._phase + ' frame ' + N.frame);
                    $gameMessage.clear();
                    $gameTroop._interpreter.clear();
                    $gameParty.onBattleEnd();
                    $gameTroop.onBattleEnd();
                    this.isBusy = function() { return false; };
                    SceneManager.goto(Scene_Map);
                }
            };
            log('hooked');
        }
    }, 50);

    // online: decided inside the frame and by the frame number, so both windows do the same
    function onlineStep() {
        var N = window.CoopNet;
        if (!N || !N.active || done) return;
        if (!maps.length) listMaps();
        var b = N.battle();
        if (b) {
            // the battle is closed after a while
            if (battleSince < 0) battleSince = N.frame;
            if (b.started && N.frame - battleSince > cfg.dwell * 60 && b.bm && b.bm._phase !== 'aborting' && b.bm._phase !== 'battleEnd') {
                b.bm._phase = 'aborting';
            }
            return;
        }
        battleSince = -1;
        var step = cfg.dwell * 60;
        // both players keep reading a real book (its picture, sounds and windows), on the same frames
        if (cfg.reads) {
            var S = N.eventSessions();
            Object.keys(S).forEach(function(k) { if (S[k].message.isBusy() && N.frame % 20 === 0) S[k].message.clear(); });
            if (N.frame % 90 === 0 && !$gameTemp.isCommonEventReserved()) {
                var who = (N.frame / 90) % 2 ? 1 : 2;
                if (!S[who]) {
                    var book = $dataCommonEvents.filter(function(c) { return c && /handbook|note/i.test(c.name) && c.list.length > 5; })[0];
                    if (book) {
                        $gameTemp.reserveCommonEvent(book.id);
                        $gameTemp._coopReservedBy = who;
                        counts.reads++;
                    }
                }
            }
        }
        var f = N.frame - (N.frame % step);
        if (f <= 0 || f === lastStep || $gamePlayer.isTransferring() || !SceneManager._sceneStarted) return;
        lastStep = f;
        battleTick++;
        if (cfg.battleEvery && battleTick % cfg.battleEvery === 0) {
            var troop = pickTroop();
            battles++;
            log('battle ' + battles + ' troop ' + troop.id + ' frame ' + N.frame);
            $gameMessage.clear();
            $gameMap._interpreter.setup([
                { code: 301, indent: 0, parameters: [0, troop.id, true, false] },
                { code: 0, indent: 0, parameters: [] }
            ], 0);
            return;
        }
        nextMap();
    }

    setInterval(sample, 5000);
    setInterval(function() {
        if (done) return;
        if (realNow() - t0 > cfg.seconds * 1000) { quit(); return; }
        if (!SceneManager._scene) return;
        var sc = SceneManager._scene.constructor.name;
        if (!started) {
            if (sc === 'Scene_Title') {
                started = true;
                listMaps();
                log('NEWGAME maps ' + maps.length);
                if (cfg.mode === 'online' && cfg.role === 'join') {
                    window.CoopNet.config.host = '127.0.0.1';
                    window.CoopNet.open('join');
                    opened = true;
                    return;
                }
                DataManager.setupNewGame();
                SceneManager.goto(Scene_Map);
                lastMove = realNow();
            }
            return;
        }
        if (cfg.mode === 'online') {
            var N = window.CoopNet;
            if (N && cfg.role === 'host') {
                if (!opened && sc === 'Scene_Map') { opened = true; N.config.battles = 'separate'; N.open('host'); return; }
                if (opened && !N.active && !N.startRequested && N.peers.length > 0 && sc === 'Scene_Map') {
                    N.startRequested = true;
                    log('startRequested');
                }
            }
            return;
        }
        if (realNow() - lastMove <= cfg.dwell * 1000) return;
        lastMove = realNow();
        if (sc !== 'Scene_Map') {
            SceneManager._scene.isBusy = function() { return false; };
            SceneManager.goto(Scene_Map);
            return;
        }
        battleTick++;
        if (cfg.battleEvery && battleTick % cfg.battleEvery === 0 && SceneManager._sceneStarted) {
            var troop = pickTroop();
            battles++;
            log('battle ' + battles + ' troop ' + troop.id);
            $gameMessage.clear();
            $gameMap._interpreter.clear();
            BattleManager.setup(troop.id, true, true);
            SceneManager.push(Scene_Battle);
            return;
        }
        nextMap();
    }, 100);
})();
