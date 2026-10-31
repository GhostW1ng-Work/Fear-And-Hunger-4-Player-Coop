//=============================================================================
// main.js
//=============================================================================
// Fear & Hunger Co-op: the game's own main.js, plus the co-op plugins added after the
// game's plugins - so unpacking the mod into the game folder is enough (js/plugins.js is
// not touched). If plugins.js already lists them (the installer), nothing is added twice;
// if their files are gone (mod removed), nothing is added and the game starts as usual.

(function() {
    var coop = ['LookOutsideOnline', 'LocalCoop_FearHunger', 'LocalCoop_Net'];
    var fs = null, base = '';
    try {
        fs = require('fs');
        base = require('path').join(require('path').dirname(process.mainModule.filename), 'js', 'plugins');
    } catch (e) {
        fs = null;
    }
    coop.forEach(function(name) {
        var listed = $plugins.some(function(p) { return p.name === name; });
        var present = !fs || fs.existsSync(require('path').join(base, name + '.js'));
        if (!listed && present) $plugins.push({ name: name, status: true, description: 'Local Co-op', parameters: {} });
    });
})();

PluginManager.setup($plugins);

window.onload = function() {
    SceneManager.run(Scene_Boot);
};
