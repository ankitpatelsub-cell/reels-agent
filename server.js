// server.js — Reels Agent: text/image -> marketing video (preview now, real on VIDEO_API_KEY).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildReel, reelFromCar, onCarAdded } = require('./agent-core');
const { limited } = require('./ratelimit');
const dash = require('./dashauth');
const PUBLIC = path.join(__dirname, 'public');
const REELS = path.join(__dirname, 'reels');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'video/mp4' };

// .env loader (VIDEO_API_KEY)
try { const ep = path.join(__dirname, '.env'); if (fs.existsSync(ep)) for (const line of fs.readFileSync(ep, 'utf8').split('\n')) { const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  if (Buffer.isBuffer(body)) return res.end(body);
  if (type === 'video/mp4') return res.end(body);
  if (typeof body === 'string') return res.end(body);
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  async function body() { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } }
  if (req.method === 'POST' && limited(req.socket.remoteAddress)) return send(res, 429, { error: 'rate limit' });

  const authed = () => dash.checkToken(req.headers['x-auth-token'] || (req.headers['cookie'] || '').match(/dash=([^;]+)/)?.[1] || '');
  if (req.method === 'POST' && url.pathname === '/api/dash-login') {
    const b = await body();
    if (dash.checkPass(b.password)) return send(res, 200, { token: dash.makeToken() });
    return send(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'POST' && url.pathname === '/api/reel') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    const b = await body();
    if (!b.brief && !b.subject && !b.image) return send(res, 400, { error: 'need brief / subject / image' });
    return send(res, 200, await buildReel({ brief: b.brief, subject: b.subject, lang: b.lang || 'en', imageB64: b.image }));
  }
  if (req.method === 'POST' && url.pathname === '/api/reel-from-car') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    const b = await body();
    const r = await reelFromCar(b.carId, b.lang || 'en');
    return send(res, r.error ? 404 : 200, r);
  }
  if (req.method === 'POST' && url.pathname === '/api/car-added') {
    // webhook from car agent when new stock is added
    const b = await body();
    const r = onCarAdded(b);
    console.log('[reels] auto-reel for new car:', b.brand, b.model);
    return send(res, 200, r);
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const provider = !!process.env.OPENROUTER_API_KEY;
    return send(res, 200, { ok: true, mode: provider ? 'provider' : 'preview', video: provider ? (process.env.OPENROUTER_LIMIT_OK ? 'ready' : 'credit-limit') : 'needs key', script: 'openrouter' });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const fs = require('fs'); const n = fs.existsSync(REELS) ? fs.readdirSync(REELS).filter(f => f.endsWith('.mp4')).length : 0;
    return send(res, 200, { reels: n, mode: process.env.OPENROUTER_API_KEY ? 'provider' : 'preview' });
  }
  if (req.method === 'GET' && url.pathname === '/api/overview') {
    const fs = require('fs'); const n = fs.existsSync(REELS) ? fs.readdirSync(REELS).filter(f => f.endsWith('.mp4')).length : 0;
    return send(res, 200, { reels: n, mode: process.env.OPENROUTER_API_KEY ? 'provider' : 'preview' });
  }

  // Static: reels files
  if (url.pathname.startsWith('/reels/')) {
    const fp = path.join(REELS, path.basename(url.pathname));
    if (fs.existsSync(fp)) return send(res, 200, fs.readFileSync(fp), MIME['.mp4']);
    return send(res, 404, { error: 'not found' });
  }
  // Pages
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/index.html' && !authed()) return send(res, 200, dash.LOGIN_HTML, 'text/html');
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, { error: 'not found' });
});
const PORT = 8098;
server.listen(PORT, '0.0.0.0', () => console.log('Reels Agent on ' + PORT + ' (mode: ' + (process.env.VIDEO_API_KEY ? 'provider' : 'preview') + ')'));
