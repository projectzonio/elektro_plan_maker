const path = require('path');
const fs = require('fs');
const express = require('express');
const symbolLoader = require('./symbol-loader');

const app = express();
const port = Number(process.env.PLAN_MAKER_PORT || process.env.PLAN_EDITOR_PORT || 5177);
const publicDir = path.join(__dirname, 'public');
const rootDir = path.resolve(__dirname, '..', '..', 'v1.11');

// Default-home plan source: virtual-house generated plan
const DEFAULT_HOME_PLAN_DIR = path.join(
  rootDir,
  'v1.11_workplan', 'agent_pool', 'projects', 'virtual_house', 'plan_editor'
);
const DEFAULT_HOME_PLAN_FILE = path.join(
  DEFAULT_HOME_PLAN_DIR,
  'zonio-modern-house-4plus1.plan-editor.json'
);
const DEFAULT_HOME_MANIFEST_FILE = path.join(
  DEFAULT_HOME_PLAN_DIR,
  'zonio-modern-house-4plus1.manifest.json'
);

app.use(express.static(publicDir));
app.use('/pdfjs', express.static(path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build')));
app.use('/jspdf', express.static(path.join(rootDir, 'node_modules', 'jspdf', 'dist')));

// Symbol bundle endpoints
app.get('/api/plan-maker/symbols/bundle', symbolLoader.serveBundle);
app.get('/api/plan-maker/symbols/bundle/info', symbolLoader.serveBundleInfo);

// Default home plan endpoint
app.get('/api/plan-maker/plans/default-home', (req, res) => {
  try {
    const raw = fs.readFileSync(DEFAULT_HOME_PLAN_FILE, 'utf8');
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(raw);
  } catch (err) {
    res.status(404).json({ error: 'Default home plan not found', detail: err.message, path: DEFAULT_HOME_PLAN_FILE });
  }
});

// Export default-home in plan-editor-v2 format (same source, explicit endpoint)
app.get('/api/plan-maker/export/default-home/plan-editor-v2', (req, res) => {
  try {
    const raw = fs.readFileSync(DEFAULT_HOME_PLAN_FILE, 'utf8');
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="default-home.plan-editor-v2.json"');
    res.send(raw);
  } catch (err) {
    res.status(404).json({ error: 'Default home plan not found', detail: err.message });
  }
});

// Export default-home in home-3d format (rooms + devices projection from manifest)
app.get('/api/plan-maker/export/default-home/home-3d', (req, res) => {
  try {
    const manifest = JSON.parse(fs.readFileSync(DEFAULT_HOME_MANIFEST_FILE, 'utf8'));
    const plan = JSON.parse(fs.readFileSync(DEFAULT_HOME_PLAN_FILE, 'utf8'));

    const home3d = {
      version: 1,
      format: 'home-3d',
      name: manifest.name || 'default-home',
      location: manifest.location || null,
      rooms: (manifest.rooms || []).map((room) => ({
        id: room.id,
        label: room.label,
        kind: room.kind,
        areaM2: room.areaM2,
        bounds: { x: room.x, y: room.y, w: room.w, h: room.h },
        windows: room.windows || 0,
        hasBlind: room.hasBlind || false,
        orientation: room.orientation || null
      })),
      devices: (manifest.devices || []).map((dev) => {
        const symbol = (plan.symbols || []).find((s) => s.id === dev.id) || null;
        return {
          id: dev.id,
          room: dev.room,
          class: dev.class,
          fw: dev.fw || null,
          planX: symbol ? symbol.x : null,
          planY: symbol ? symbol.y : null,
          planRot: symbol ? symbol.rot : null,
          meta: symbol ? (symbol.meta || {}) : {}
        };
      }),
      sourceFiles: {
        plan: path.basename(DEFAULT_HOME_PLAN_FILE),
        manifest: path.basename(DEFAULT_HOME_MANIFEST_FILE)
      }
    };

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json(home3d);
  } catch (err) {
    res.status(500).json({ error: 'home-3d export failed', detail: err.message });
  }
});

// PDF proxy (kept for plan editor compatibility)
app.get('/source.pdf', (req, res) => {
  if (!req.query.file) {
    res.status(400).send('PDF cesta neni zadana. Pouzij Import PDF v editoru.');
    return;
  }
  const pdfPath = path.resolve(String(req.query.file));
  res.sendFile(pdfPath, (err) => {
    if (err && !res.headersSent) {
      res.status(err.statusCode || 404).send(`PDF nelze otevrit: ${pdfPath}`);
    }
  });
});

app.listen(port, () => {
  symbolLoader.init();
  console.log(`Plan Maker: http://localhost:${port}`);
  console.log(`  /api/plan-maker/symbols/bundle`);
  console.log(`  /api/plan-maker/symbols/bundle/info`);
  console.log(`  /api/plan-maker/plans/default-home`);
  console.log(`  /api/plan-maker/export/default-home/plan-editor-v2`);
  console.log(`  /api/plan-maker/export/default-home/home-3d`);
});
