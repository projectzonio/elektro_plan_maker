const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const SYMBOL_MANIFEST = [
  { path: 'public/symbols/00-registry.js', name: 'SymbolRegistry' },
  { path: 'public/symbols/socket-1f.js', name: 'Socket1F' },
  { path: 'public/symbols/socket-3f.js', name: 'Socket3F' },
  { path: 'public/symbols/switch-1.js', name: 'Switch1' },
  { path: 'public/symbols/switch-5.js', name: 'Switch5' },
  { path: 'public/symbols/switch-6.js', name: 'Switch6' },
  { path: 'public/symbols/switch-7.js', name: 'Switch7' },
  { path: 'public/symbols/light.js', name: 'Light' },
  { path: 'public/symbols/switchboard.js', name: 'Switchboard' }
];

let cache = null;
let watchers = [];

function resolvePath(entry) {
  return path.join(ROOT, entry.path);
}

function buildBundle() {
  const parts = [];
  let loaded = 0;
  let skipped = 0;

  for (const entry of SYMBOL_MANIFEST) {
    const filePath = resolvePath(entry);
    const label = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const src = fs.readFileSync(filePath, 'utf8');
      parts.push(`\n// -- ${label} --\n${src}`);
      loaded += 1;
    } catch (err) {
      console.warn(`[plan-maker:symbol-loader] Skipping ${label}: ${err.code || err.message}`);
      skipped += 1;
    }
  }

  console.log(`[plan-maker:symbol-loader] Bundle built: ${loaded} loaded, ${skipped} skipped`);
  return parts.join('\n');
}

function rebuildCache() {
  const bundle = buildBundle();
  cache = {
    bundle,
    builtAt: new Date(),
    sizeKB: Math.round(Buffer.byteLength(bundle, 'utf8') / 1024)
  };
}

function getBundle() {
  if (!cache) rebuildCache();
  return cache.bundle;
}

function getCacheInfo() {
  if (!cache) return { cached: false, fileCount: SYMBOL_MANIFEST.length };
  return {
    cached: true,
    builtAt: cache.builtAt,
    sizeKB: cache.sizeKB,
    fileCount: SYMBOL_MANIFEST.length,
    files: SYMBOL_MANIFEST.map((entry) => entry.path)
  };
}

function invalidateCache() {
  cache = null;
}

function serveBundle(req, res) {
  try {
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(getBundle());
  } catch (err) {
    res.status(500).json({ error: 'Plan maker symbol bundle failed', detail: err.message });
  }
}

function serveBundleInfo(req, res) {
  res.json(getCacheInfo());
}

function watchForChanges() {
  const dir = path.join(ROOT, 'public', 'symbols');
  if (!fs.existsSync(dir)) return;
  watchers.push(fs.watch(dir, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      console.log(`[plan-maker:symbol-loader] ${filename} changed, invalidating cache`);
      invalidateCache();
    }
  }));
}

function stopWatchers() {
  watchers.forEach((watcher) => watcher.close());
  watchers = [];
}

function init({ watch = true, preBuild = true } = {}) {
  if (preBuild) rebuildCache();
  if (watch) watchForChanges();
}

module.exports = {
  SYMBOL_MANIFEST,
  getBundle,
  getCacheInfo,
  invalidateCache,
  serveBundle,
  serveBundleInfo,
  init,
  stopWatchers
};
