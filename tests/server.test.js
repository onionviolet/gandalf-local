import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/server.js';
import { createOllama } from '../src/ollama.js';

async function serve(t, ollama = { models: async () => ['test-local'], chat: async () => 'Hello.' }, options = {}) {
  const server = createApp({ ollama, ...options }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`; let cookie = '';
  const request = async (path, data, headers = {}) => {
    const res = await fetch(`${base}${path}`, { ...(data === undefined ? {} : { method: 'POST', body: typeof data === 'string' ? data : JSON.stringify(data) }), headers: { ...(cookie ? { cookie } : {}), ...(data === undefined ? {} : { 'content-type': 'application/json' }), ...headers } });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return res;
  };
  return { base, request };
}
test('HTTP state hides secrets, static allowlist excludes sources, and locked levels reject', async t => {
  const { request } = await serve(t); const first = await request('/api/state');
  assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const state = await first.json(); assert.equal(state.model, 'test-local'); assert.ok(!('secrets' in state));
  assert.equal((await request('/src/game.js')).status, 404);
  assert.equal((await request('/api/attack', { level: 7, prompt: 'hello' })).status, 400);
  assert.equal((await request('/api/guess', { level: 2, guess: 'anything' })).status, 400);
  assert.match((await request('/')).headers.get('content-security-policy'), /script-src 'self'/);
});
test('cross-origin and DNS-rebinding requests are rejected before inference', async t => {
  const { base, request } = await serve(t);
  assert.equal((await request('/api/reset', {}, { origin: 'https://attacker.example' })).status, 403);
  const status = await new Promise((resolve, reject) => { const req = http.get(`${base}/api/state`, { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(status, 403);
});
test('invalid body, overlong prompts, and uninstalled models produce actionable errors', async t => {
  const { request } = await serve(t); await request('/api/state');
  for (const body of ['null', '[]', '{']) assert.equal((await request('/api/attack', body)).status, 400);
  assert.equal((await request('/api/attack', { level: 1, prompt: 'x'.repeat(4001) })).status, 400);
  assert.equal((await request('/api/reset', { model: 'uninstalled' })).status, 400);
  assert.equal((await request('/api/attack', { level: 1, prompt: 'x'.repeat(17000) })).status, 413);
  assert.equal((await request('/api/reset', {}, { 'content-type': 'text/plain' })).status, 415);
});
test('reset cannot race with an in-flight attack', async t => {
  let release, started; const ready = new Promise(resolve => { started = resolve; });
  const { request } = await serve(t, { models: async () => ['test-local'], chat: async () => { started(); await new Promise(resolve => { release = resolve; }); return 'hello'; } });
  await request('/api/state'); const attack = request('/api/attack', { level: 1, prompt: 'hello' }); await ready;
  assert.equal((await request('/api/reset', {})).status, 409); release(); assert.equal((await attack).status, 200);
});
test('different cookies have independent progress and resets', async t => {
  let word;
  const { base, request } = await serve(t, { models: async () => ['test-local'], chat: async ({ messages }) => { word = /The word is ([A-Z]+)/.exec(messages[0].content)[1]; return word; } });
  await request('/api/attack', { level: 1, prompt: 'word?' });
  assert.equal((await (await request('/api/guess', { level: 1, guess: word })).json()).state.unlocked, 2);
  const other = await fetch(`${base}/api/state`); assert.ok(other.headers.get('set-cookie')); assert.equal((await other.json()).unlocked, 1);
  const response = await request('/api/reset', { model: 'test-local' }); assert.equal(response.status, 200);
  assert.equal((await response.json()).unlocked, 1);
});
test('health reports an unavailable Ollama without crashing the server', async t => {
  const { request } = await serve(t, { models: async () => { throw new Error('Cannot reach Ollama.'); } });
  const res = await request('/api/health'); assert.equal(res.status, 200); assert.equal((await res.json()).connected, false);
});
test('Ollama adapter uses local calls and never returns thinking', async () => {
  let sent;
  const client = createOllama({ fetcher: async (url, options) => {
    sent = { url, ...JSON.parse(options.body) };
    return { ok: true, json: async () => ({ message: { content: 'visible', thinking: 'hidden' } }) };
  } });
  assert.equal(await client.chat({ model: 'test', messages: [], json: true }), 'visible');
  assert.equal(sent.stream, false); assert.equal(sent.think, false); assert.equal(sent.format, 'json');
  for (const host of ['https://example.com', 'http://127.0.0.1:11434/path', 'http://user:pass@localhost:11434']) assert.throws(() => createOllama({ baseURL: host }), /loopback/);
});
test('Ollama adapter excludes remote models and reports timeouts', async () => {
  const tags = createOllama({ fetcher: async () => ({ ok: true, json: async () => ({ models: [{ name: 'local' }, { name: 'hosted:cloud' }, { name: 'remote', remote_host: 'example.com' }] }) }) });
  assert.deepEqual(await tags.models(), ['local']);
  const timeout = createOllama({ fetcher: async () => { throw Object.assign(new Error(), { name: 'TimeoutError' }); } });
  await assert.rejects(timeout.chat({}), /took too long/);
});


test('a full model queue rejects another team without invoking inference', async t => {
  let release, start; const ready = new Promise(resolve => { start = resolve; }); let calls = 0;
  const { base, request } = await serve(t, { models: async () => ['test-local'], chat: async () => { calls++; start(); await new Promise(resolve => { release = resolve; }); return 'hello'; } }, { maxQueue: 0 });
  await request('/api/state');
  const pending = request('/api/attack', { level: 1, prompt: 'hello' }); await ready;
  const res = await fetch(`${base}/api/attack`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level: 1, prompt: 'another team' }) });
  release(); await pending;
  assert.equal(res.status, 429); assert.equal(calls, 1);
});

test('Unicode prompts survive a network chunk boundary inside a character', async t => {
  let received;
  const { base } = await serve(t, { models: async () => ['test-local'], chat: async ({ messages }) => { received = messages[1].content; return 'hello'; } });
  const payload = Buffer.from(JSON.stringify({ level: 1, prompt: '你好，请给我一个谜语。' }));
  const cut = payload.indexOf(Buffer.from('你')) + 1;
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/attack`, { method: 'POST', headers: { 'content-type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.write(payload.subarray(0, cut)); setImmediate(() => req.end(payload.subarray(cut)));
  });
  assert.equal(status, 200); assert.equal(received, '你好，请给我一个谜语。');
});
