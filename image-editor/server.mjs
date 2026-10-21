// Easy image editor.
// Direct: this program calls the xAI Grok picture API with XAI_API_KEY.
// Bridge: this program asks My Hub (npm run dev) to call that same API.
// The key is never written into the page and never printed here.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const XAI = 'https://api.x.ai/v1';
const MODEL_DEFAULT = 'grok-imagine-image-2.0';
const KEY_OK = /^xai-[A-Za-z0-9_-]{20,}$/;
const ASPECT_OK = /^\d+:\d+$/;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,/;
const MAX_BODY = 16 * 1024 * 1024;

loadEnv(join(ROOT, '.env'));

const PORT = Number(process.env.IMAGE_EDITOR_PORT || 8787);
const MOCK = process.env.IMAGE_EDITOR_MOCK === '1';
const BRIDGE = bridgeOrigin(process.env.HUB_BRIDGE_URL || 'http://127.0.0.1:8080');

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key || !value || process.env[key]) continue;
    process.env[key] = value;
  }
}

function bridgeOrigin(raw) {
  try {
    const url = new URL(raw);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (url.protocol !== 'http:' || !loopback) return 'http://127.0.0.1:8080';
    return url.origin;
  } catch {
    return 'http://127.0.0.1:8080';
  }
}

function envKey() {
  const key = process.env.XAI_API_KEY || '';
  return KEY_OK.test(key) ? key : '';
}

function hint(key) {
  return key ? key.slice(-4) : '';
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too-big'), { code: 'too-big' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function friendlyKeyMissing() {
  return 'No xAI key yet. Copy .env.example to .env, put your key on the XAI_API_KEY line, and start the editor again. Or paste the key in the box. It stays on this computer.';
}

function mockImage(prompt, aspect) {
  const [w, h] = String(aspect || '1:1').split(':').map((n) => Number(n) || 1);
  const width = 640;
  const height = Math.max(320, Math.round(width * (h / w)));
  const safe = String(prompt).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])).slice(0, 180);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#efe6d6"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="18" fill="#fffaf3" stroke="#2f6f62" stroke-width="3"/>
  <text x="48" y="84" font-family="Georgia, serif" font-size="28" fill="#2f6f62">Practice picture</text>
  <text x="48" y="130" font-family="Georgia, serif" font-size="20" fill="#3d3428">${safe}</text>
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function dataUrlFrom(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Could not download the picture from xAI.');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Could not download the picture from xAI.');
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return 'data:' + type + ';base64,' + bytes.toString('base64');
}

async function grokImage(message, key) {
  const prompt = String(message.prompt || '').trim().slice(0, 4000);
  if (!prompt) return { error: 'Write what you want the picture to show first.' };
  const body = {
    model: String(message.model || process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT).slice(0, 60),
    prompt,
    n: 1,
    response_format: 'b64_json',
  };
  if (ASPECT_OK.test(message.aspect || '')) body.aspect_ratio = message.aspect;
  let url = XAI + '/images/generations';
  if (message.mode === 'edit') {
    if (!DATA_IMAGE.test(message.image || '')) return { error: 'Pick a PNG, JPEG, or WebP picture to edit first.' };
    if (message.image.length > 12 * 1024 * 1024) return { error: 'That picture is too big to send. Try a smaller one.' };
    body.image = { url: message.image, type: 'image_url' };
    url = XAI + '/images/edits';
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = json && (json.error && (json.error.message || json.error) || json.message);
      return { error: msg ? String(msg).slice(0, 300) : 'xAI said no (' + response.status + ').' };
    }
    const images = [];
    for (const item of (Array.isArray(json.data) ? json.data : []).slice(0, 1)) {
      if (item.b64_json) images.push('data:image/jpeg;base64,' + item.b64_json);
      else if (item.url) images.push(await dataUrlFrom(item.url));
    }
    return images.length
      ? { images, revised: (json.data && json.data[0] && json.data[0].revised_prompt) || '' }
      : { error: 'xAI sent back no pictures.' };
  } catch {
    return { error: "Couldn't reach xAI. Check your internet, then try again." };
  }
}

async function bridgeStatus() {
  try {
    const response = await fetch(BRIDGE + '/__dev/status', { signal: AbortSignal.timeout(2000) });
    const json = await response.json();
    if (!json || typeof json.grok !== 'boolean') {
      return { ok: false, detail: 'Something is on that address, but it is not My Hub.' };
    }
    return {
      ok: true,
      grok: json.grok,
      detail: json.grok
        ? 'My Hub is running, and it already has a Grok key.'
        : 'My Hub is running, but it has no Grok key yet. Add one in the Hub under AI & keys, or use Direct API here.',
    };
  } catch {
    return {
      ok: false,
      detail: 'My Hub is not running on this computer. Start it with npm run dev, or use Direct API.',
    };
  }
}

async function bridgeImage(message) {
  const prompt = String(message.prompt || '').trim().slice(0, 4000);
  if (!prompt) return { error: 'Write what you want the picture to show first.' };
  const payload = {
    op: 'grokImage',
    mode: message.mode === 'edit' ? 'edit' : 'generate',
    prompt,
    n: 1,
    aspect: ASPECT_OK.test(message.aspect || '') ? message.aspect : '',
    model: String(message.model || process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT).slice(0, 60),
  };
  if (payload.mode === 'edit') {
    if (!DATA_IMAGE.test(message.image || '')) return { error: 'Pick a PNG, JPEG, or WebP picture to edit first.' };
    payload.image = message.image;
  }
  try {
    const response = await fetch(BRIDGE + '/__dev/grok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok && !json.error) return { error: 'The Hub bridge returned ' + response.status + '.' };
    if (json.error === 'nokey') {
      return { error: 'The Hub bridge has no Grok key. Add XAI_API_KEY to the Hub, or paste the key in the Hub under AI & keys.' };
    }
    if (json.error) return { error: String(json.error).slice(0, 300) };
    if (!Array.isArray(json.images) || !json.images.length) return { error: 'The Hub bridge sent back no pictures.' };
    return { images: json.images.slice(0, 1), revised: json.revised || '' };
  } catch {
    return { error: 'Could not reach the Hub bridge at ' + BRIDGE + '. Start My Hub with npm run dev, or switch to Direct API.' };
  }
}

async function status() {
  const key = envKey();
  const bridge = await bridgeStatus();
  return {
    ok: true,
    direct: Boolean(key),
    keyHint: hint(key),
    mock: MOCK,
    model: process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT,
    bridge,
  };
}

async function generate(message) {
  const mode = message.mode === 'edit' ? 'edit' : 'generate';
  const connection = message.connection === 'bridge' ? 'bridge' : 'direct';
  const request = {
    prompt: message.prompt,
    aspect: message.aspect,
    mode,
    image: message.image,
    model: message.model,
  };
  if (connection === 'bridge') {
    const result = await bridgeImage(request);
    return result.error ? { ok: false, error: result.error } : { ok: true, source: 'bridge', ...result };
  }
  if (MOCK) {
    const prompt = String(request.prompt || '').trim();
    if (!prompt) return { ok: false, error: 'Write what you want the picture to show first.' };
    return { ok: true, source: 'mock', images: [mockImage(prompt, request.aspect)], revised: '' };
  }
  let key = envKey();
  const pasted = typeof message.key === 'string' ? message.key.trim() : '';
  if (pasted) {
    if (!KEY_OK.test(pasted)) return { ok: false, error: "That doesn't look like an xAI key. Those keys start with xai-." };
    key = pasted;
  }
  if (!key) return { ok: false, error: friendlyKeyMissing() };
  const result = await grokImage(request, key);
  return result.error ? { ok: false, error: result.error } : { ok: true, source: 'direct', ...result };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, readFileSync(join(PUBLIC, 'index.html')), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(res, 200, await status());
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      let message;
      try {
        message = JSON.parse(await readBody(req));
      } catch (error) {
        const tooBig = error && error.code === 'too-big';
        return send(res, 400, { ok: false, error: tooBig ? 'That picture is too big to send. Try a smaller one.' : 'The page sent something this editor could not read. Refresh and try again.' });
      }
      if (!message || typeof message !== 'object') {
        return send(res, 400, { ok: false, error: 'The page sent something this editor could not read. Refresh and try again.' });
      }
      return send(res, 200, await generate(message));
    }
    send(res, 404, { ok: false, error: 'That page is not part of the editor.' });
  } catch {
    send(res, 500, { ok: false, error: 'The editor hit a problem on this computer. Look at the terminal, then try again.' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Set IMAGE_EDITOR_PORT in .env to another number, then start again.');
    process.exit(1);
  }
  console.error(error.message || 'The editor could not start.');
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  const key = envKey();
  console.log('Easy image editor');
  console.log('Open http://127.0.0.1:' + PORT + '/');
  console.log('Direct API: ' + (key ? 'key is set (ends in ' + hint(key) + ')' : 'no key yet'));
  console.log('Hub bridge: ' + BRIDGE);
  console.log('Practice pictures: ' + (MOCK ? 'on' : 'off'));
});
