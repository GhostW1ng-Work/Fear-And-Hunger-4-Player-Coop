// graficos falsos (despues de cargar rpg_core): Bitmap y Sprite sin canvas ni texturas
Bitmap = function(w, h) { this.width = w || 0; this.height = h || 0; };
Bitmap.prototype = new Proxy({}, { get: function(t, k) {
    if (k in t) return t[k];
    if (k === 'isReady') return function() { return true; };
    return function() {};
} });
Object.defineProperty(Bitmap.prototype, 'constructor', { value: Bitmap });
Sprite.prototype.initialize = function(bitmap) {
    PIXI.Sprite.call(this);
    this._bitmap = bitmap || null;
    this._opacity = 255;
};
Object.defineProperty(Sprite.prototype, 'bitmap', { get: function() { return this._bitmap; }, set: function(v) { this._bitmap = v; }, configurable: true });
Object.defineProperty(Sprite.prototype, 'opacity', { get: function() { return this._opacity; }, set: function(v) { this._opacity = v; }, configurable: true });
Sprite.prototype.update = function() {};
ImageManager.loadCharacter = function() { return new Bitmap(1, 1); };
Bitmap.load = Bitmap.request = Bitmap.snap = function() { return new Bitmap(1, 1); };
ImageManager.loadBitmap = ImageManager.reserveBitmap = ImageManager.requestBitmap = function() { return new Bitmap(1, 1); };
