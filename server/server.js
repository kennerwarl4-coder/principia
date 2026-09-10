require('dotenv').config();

const path = require('node:path');
const express = require('express');
const zlib = require('node:zlib');

const createHandler = require('../api/pix/create');
const statusHandler = require('../api/pix/status/[id]');
const webhookHandler = require('../api/pix/webhook');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_ROOT = path.join(__dirname, '..');

app.use(express.json());

// ─── Compression middleware (manual, no extra deps) ──────────────────────────
app.use((req, res, next) => {
  const ae = req.headers['accept-encoding'] || '';
  if (!ae.includes('gzip')) return next();

  const _end = res.end.bind(res);
  const _write = res.write.bind(res);
  const gz = zlib.createGzip({ level: 6 });
  let piped = false;

  const pipe = () => {
    if (piped) return;
    piped = true;
    res.setHeader('Content-Encoding', 'gzip');
    res.removeHeader('Content-Length');
    gz.pipe(res);
  };

  res.write = (chunk, ...args) => {
    pipe();
    return gz.write(chunk, ...args);
  };

  res.end = (chunk, ...args) => {
    pipe();
    if (chunk) gz.write(chunk, ...args);
    gz.end();
  };

  next();
});

// ─── Cache-Control headers per asset type ────────────────────────────────────
app.use((req, res, next) => {
  const url = req.url.split('?')[0];

  // HTML — no cache (always fresh)
  if (url === '/' || url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Immutable assets (fingerprinted CSS/JS)
  if (/\.(min\.css|min\.js)$/.test(url) && /[a-f0-9]{8,}/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return next();
  }

  // Fonts — long cache (they don't change)
  if (/\.(woff2?|ttf|eot|otf)$/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
  }

  // Images — 1 week
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return next();
  }

  // CSS and JS (non-fingerprinted) — 1 day
  if (/\.(css|js)$/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return next();
  }

  next();
});

// ─── API routes ──────────────────────────────────────────────────────────────
app.post('/api/pix/create', createHandler);
app.get('/api/pix/status/:id', (req, res) => {
  req.query = { ...req.query, id: req.params.id };
  return statusHandler(req, res);
});
app.post('/api/pix/webhook', webhookHandler);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(SITE_ROOT, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
