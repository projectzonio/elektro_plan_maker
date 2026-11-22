const path = require('path');
const fs = require('fs');
const express = require('express');
const symbolLoader = require('./symbol-loader');

const app = express();
const port = Number(process.env.PLAN_MAKER_PORT || process.env.PLAN_EDITOR_PORT || 5177);
// Listens on localhost only by default. Set PLAN_MAKER_HOST=0.0.0.0 to expose it deliberately.
const host = process.env.PLAN_MAKER_HOST || '127.0.0.1';
const publicDir = path.join(__dirname, 'public');
const nodeModulesDir = path.join(__dirname, 'node_modules');

// Example plan shipped with the repo (loadable via "Nacist JSON" in the editor)
const EXAMPLE_PLAN_FILE = path.join(__dirname, 'examples', 'house-4plus1.plan-editor.json');

app.use(express.static(publicDir));
app.use('/pdfjs', express.static(path.join(nodeModulesDir, 'pdfjs-dist', 'build')));
app.use('/jspdf', express.static(path.join(nodeModulesDir, 'jspdf', 'dist')));

// Symbol bundle endpoints
app.get('/api/plan-maker/symbols/bundle', symbolLoader.serveBundle);
app.get('/api/plan-maker/symbols/bundle/info', symbolLoader.serveBundleInfo);

// Example plan endpoint
app.get('/api/plan-maker/plans/default-home', (req, res) => {
  try {
    const raw = fs.readFileSync(EXAMPLE_PLAN_FILE, 'utf8');
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(raw);
  } catch (err) {
    res.status(404).json({ error: 'Example plan not found', detail: err.message });
  }
});

// Same example as a download (plan-editor-v2 format)
app.get('/api/plan-maker/export/default-home/plan-editor-v2', (req, res) => {
  try {
    const raw = fs.readFileSync(EXAMPLE_PLAN_FILE, 'utf8');
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="default-home.plan-editor-v2.json"');
    res.send(raw);
  } catch (err) {
    res.status(404).json({ error: 'Example plan not found', detail: err.message });
  }
});

// PDF proxy (kept for plan editor compatibility). Serves .pdf files only.
app.get('/source.pdf', (req, res) => {
  if (!req.query.file) {
    res.status(400).send('PDF cesta neni zadana. Pouzij Import PDF v editoru.');
    return;
  }
  const pdfPath = path.resolve(String(req.query.file));
  if (path.extname(pdfPath).toLowerCase() !== '.pdf') {
    res.status(400).send('Povoleny jsou jen soubory .pdf.');
    return;
  }
  res.sendFile(pdfPath, (err) => {
    if (err && !res.headersSent) {
      res.status(err.statusCode || 404).send('PDF nelze otevrit.');
    }
  });
});

app.listen(port, host, () => {
  symbolLoader.init();
  console.log(`Plan Maker: http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`);
  console.log(`  /api/plan-maker/symbols/bundle`);
  console.log(`  /api/plan-maker/symbols/bundle/info`);
  console.log(`  /api/plan-maker/plans/default-home`);
  console.log(`  /api/plan-maker/export/default-home/plan-editor-v2`);
});
