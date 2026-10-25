// Minimal browser / PIXI stubs so RPG Maker MV core files can load in bare V8.
var window = this;
var self = this;
var console = { log: function() { __log.push(Array.prototype.join.call(arguments, ' ')); }, warn: function() { __log.push('WARN ' + Array.prototype.join.call(arguments, ' ')); }, error: function() { __log.push('ERR ' + Array.prototype.join.call(arguments, ' ')); } };
var __log = [];
var __listeners = {};
function __el() {
    return {
        style: {}, getContext: function() { return __ctx2d(); }, addEventListener: function() {}, appendChild: function() {},
        removeChild: function() {}, setAttribute: function() {}, getBoundingClientRect: function() { return { left: 0, top: 0 }; },
        width: 0, height: 0, canPlayType: function() { return ''; }
    };
}
function __ctx2d() {
    return new Proxy({}, { get: function(t, k) { if (k === 'measureText') return function() { return { width: 10 }; }; if (k === 'getImageData') return function() { return { data: [0, 0, 0, 0] }; }; if (k in t) return t[k]; return function() {}; }, set: function(t, k, v) { t[k] = v; return true; } });
}
var document = {
    body: __el(), createElement: function() { return __el(); }, getElementById: function() { return null; },
    addEventListener: function(type, fn) { (__listeners['doc:' + type] = __listeners['doc:' + type] || []).push(fn); },
    querySelector: function() { return null; }, head: __el()
};
window.addEventListener = function(type, fn) { (__listeners[type] = __listeners[type] || []).push(fn); };
window.removeEventListener = function() {};
var __pads = [];
var navigator = { userAgent: 'Chrome', platform: 'Win32', getGamepads: function() { return __pads; } };
var location = { search: '' };
var Image = function() {};
var XMLHttpRequest = function() {};
var AudioContext = undefined;
var requestAnimationFrame = function() {};
var setTimeout = function() {};
var __store = {};
var localStorage = { getItem: function(k) { return k in __store ? __store[k] : null; }, setItem: function(k, v) { __store[k] = String(v); }, removeItem: function(k) { delete __store[k]; } };
var performance = { now: function() { return 0; } };
var process = undefined;
var require = undefined;

function __cls() {
    var C = function() { this.children = []; this.position = { x: 0, y: 0, set: function(x, y) { this.x = x; this.y = y; } }; this.scale = { x: 1, y: 1, set: function(x, y) { this.x = x; this.y = y; } }; this.anchor = { x: 0, y: 0, set: function(x, y) { this.x = x; this.y = y; } }; this.visible = true; this.renderable = true; };
    C.prototype.addChild = function(c) { this.children.push(c); c.parent = this; return c; };
    C.prototype.addChildAt = function(c, i) { this.children.splice(i, 0, c); c.parent = this; return c; };
    C.prototype.removeChild = function(c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; };
    C.prototype.destroy = function() {};
    C.prototype.updateTransform = function() {};
    return C;
}
var PIXI = {
    VERSION: '4.5.4',
    Container: __cls(), Sprite: __cls(), Graphics: __cls(), DisplayObject: __cls(), Rectangle: function(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
    Point: function(x, y) { this.x = x || 0; this.y = y || 0; }, ObservablePoint: function() {},
    Texture: { fromCanvas: function() { return {}; }, EMPTY: {} }, BaseTexture: function() {}, RenderTexture: { create: function() { return {}; } },
    Filter: __cls(), filters: { ColorMatrixFilter: __cls(), VoidFilter: __cls(), BlurFilter: __cls(), AlphaFilter: __cls() },
    tilemap: { CompositeRectTileLayer: __cls(), RectTileLayer: __cls(), TileRenderer: __cls() },
    mesh: { Mesh: __cls(), Plane: __cls(), NineSlicePlane: __cls() }, extras: { TilingSprite: __cls(), PictureSprite: __cls(), PictureTilingSprite: __cls() },
    BLEND_MODES: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 }, SCALE_MODES: { NEAREST: 0, LINEAR: 1 }, WRAP_MODES: {},
    WebGLRenderer: __cls(), CanvasRenderer: __cls(), ObjectRenderer: __cls(), Shader: __cls(), glCore: { GLBuffer: {} },
    settings: {}, utils: { premultiplyBlendMode: [[], []] }, Ticker: __cls(), ticker: { shared: {} }, autoDetectRenderer: function() { return null; },
    CanvasTinter: {}, SpriteRenderer: __cls(), particles: {}, prepare: {}, loaders: {}, Matrix: function() {}
};
PIXI.tilemap.TileRenderer.extend = function() {};
PIXI.WebGLRenderer.registerPlugin = function() {};
PIXI.CanvasRenderer.registerPlugin = function() {};
function __auto(obj) {
    return new Proxy(obj, { get: function(t, k) {
        if (typeof k === 'symbol') return t[k];
        if (!(k in t)) t[k] = __auto(__cls());
        return t[k];
    } });
}
delete PIXI.glCore; ["tilemap","mesh","extras","filters","ticker","particles","prepare","loaders"].forEach(function(k){ PIXI[k] = __auto(PIXI[k]); });
PIXI = __auto(PIXI);
PIXI.Texture = Object.assign(__cls(), { fromCanvas: function() { return new PIXI.Texture(); }, EMPTY: {} });
PIXI.BaseTexture = Object.assign(__cls(), { fromCanvas: function() { return new PIXI.BaseTexture(); } });
PIXI.Texture.prototype.frame = {};
PIXI.Texture.prototype._updateID = 0;
PIXI.BaseTexture.prototype.update = function() {};
PIXI.Texture.prototype.update = function() {};
var LZString = { compressToBase64: function(s) { return s; }, decompressFromBase64: function(s) { return s; } };
