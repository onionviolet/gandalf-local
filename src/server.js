import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGame, publicState, checkLevel, attack, guess } from './game.js';
import { createOllama } from './ollama.js';

const PUBLIC = new URL('../public/', import.meta.url);
const FILES = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/wizard.svg', ['wizard.svg', 'image/svg+xml']]]);
const SESSION_TTL = 12 * 60 * 60 * 1000;

export function createApp({ ollama = createOllama({ baseURL: process.env.OLLAMA_HOST }), defaultModel = process.env.OLLAMA_MODEL || '', maxQueue = 8 } = {}) {
  const sessions = new Map();
  const localAddresses = Object.values(networkInterfaces()).flat().filter(Boolean).map(item => item.address.includes(':') ? `[${item.address}]` : item.address);
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...localAddresses]);
  let running = 0;
  const waiters = [];
  async function withModel(fn) {
    if (running && waiters.length >= maxQueue) throw Object.assign(new Error('The wizard is busy with other teams. Try again shortly.'), { status: 429 });
    if (running) await new Promise(resolve => waiters.push(resolve));
    running = 1;
    try { return await fn(); }
    finally { const next = waiters.shift(); if (next) next(); else running = 0; }
  }
  function send(res, status, data, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('Expected JSON.'), { status: 415 });
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16_384) throw Object.assign(new Error('Request is too large.'), { status: 413 }); chunks.push(chunk); }
    const text = Buffer.concat(chunks).toString('utf8');
    try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
  }
  function textField(value, max) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw Object.assign(new Error(`Enter between 1 and ${max} characters.`), { status: 400 }); return value.trim(); }
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host || '';
      if (!host || /[\s/@\\]/.test(host)) return send(res, 400, { error: 'Invalid host.' });
      const hostname = new URL(`http://${host}`).hostname;
      // Accept local IPs for LAN play, never arbitrary DNS names (DNS rebinding).
      if (!allowedHosts.has(hostname)) return send(res, 403, { error: 'Host is not allowed.' });
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(res, 403, { error: 'Cross-origin requests are not allowed.' });
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && FILES.has(path)) {
        const [file, type] = FILES.get(path);
        const content = await readFile(new URL(file, PUBLIC));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' }); return res.end(content);
      }
      if (!path.startsWith('/api/')) return send(res, 404, { error: 'Not found.' });
      if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' });
      if (req.method === 'GET' && path === '/api/health') {
        try { const models = await ollama.models(); return send(res, 200, { connected: true, models, preferredModel: models.includes(defaultModel) ? defaultModel : models[0] || null }); }
        catch (e) { return send(res, 200, { connected: false, models: [], error: e.message }); }
      }
      const now = Date.now();
      for (const [key, game] of sessions) if (!game.busy && now - game.touched > SESSION_TTL) sessions.delete(key);
      const cookie = /(?:^|;\s*)wizard_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      let game = cookie && sessions.get(cookie);
      if (!game) {
        if (sessions.size >= 500) return send(res, 503, { error: 'This server has reached its session limit. Ask the facilitator to restart it.' });
        const models = await ollama.models();
        const model = models.includes(defaultModel) ? defaultModel : models[0] || '';
        game = createGame(model);
        const id = randomBytes(24).toString('hex'); sessions.set(id, game);
        res.setHeader('Set-Cookie', `wizard_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
      }
      game.touched = now;
      if (req.method === 'GET' && path === '/api/state') return send(res, 200, publicState(game));
      if (req.method !== 'POST') return send(res, 404, { error: 'Not found.' });
      const data = await body(req);
      if (game.busy) return send(res, 409, { error: 'Wait for this team’s current request to finish.' });
      if (path === '/api/reset') {
        game.busy = true;
        try {
          const models = await ollama.models();
          const model = data.model || game.model;
          if (!models.includes(model)) return send(res, 400, { error: 'Select an installed local model.' });
          Object.assign(game, createGame(model));
          return send(res, 200, publicState(game));
        } finally { game.busy = false; }
      }
      if (path === '/api/guess') { const value = textField(data.guess, 100); checkLevel(game, data.level); return send(res, 200, guess(game, data.level, value)); }
      if (path === '/api/attack') {
        const prompt = textField(data.prompt, 4000); checkLevel(game, data.level);
        if (!game.model) return send(res, 400, { error: 'Install a local model in Ollama, then restart your run.' });
        game.busy = true;
        try {
          const result = await withModel(() => attack(game, data.level, prompt, ollama.chat));
          game.attempts[data.level - 1]++;
          return send(res, 200, { ...result, state: publicState(game) });
        } finally { game.busy = false; }
      }
      return send(res, 404, { error: 'Not found.' });
    } catch (error) { send(res, error.status || (error.message === 'Choose an unlocked level.' ? 400 : 502), { error: error.message || 'Something went wrong.' }); }
  });
}
function serverHost() { return process.env.HOST || '127.0.0.1'; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3007);
  const server = createApp();
  server.on('error', e => { console.error(`Could not start: ${e.message}`); process.exitCode = 1; });
  server.listen(port, serverHost(), () => console.log(`Gandalf Local: http://127.0.0.1:${port}\nListener: ${serverHost()} | Student prompts are not logged. Press Ctrl+C to stop.`));
}
