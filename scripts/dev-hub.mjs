// Serves hub/ on this computer and connects the APIs the page already expects.
// Lives outside hub/ on purpose: npm run sync-hub replaces everything in hub/.
//
//   npm run dev      this file (page + relay)
//   npm run relay    the relay only
//   npm run sync-hub pull a new Hub from Claude
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HUB = path.join(ROOT, 'hub');
const BRIDGE = path.join(ROOT, 'scripts', 'hub-bridge.js');
const RELAY_JS = path.join(HUB, 'extension', 'relay', 'hub-mcp.mjs');
const APP = 'nova-hub-dev';
const BIND = '127.0.0.1';
const XAI = 'https://api.x.ai/v1';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MISSING_CLAUDE = 'Claude is not connected on this computer yet. Copy .env.example to .env and put your key in ANTHROPIC_API_KEY, or paste an sk-ant- key under AI & keys. Then ask again. The clock, to-dos, and the relay keep working without it.';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.bat': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function log(m) { console.log('[hub] ' + m); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function portOf(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] == null || process.env[m[1]] === '') process.env[m[1]] = v;
  }
}

function hubHome() {
  return process.env.HUB_HOME || path.join(os.homedir(), '.the-hub');
}
function readTrim(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { return ''; }
}

loadEnv(path.join(ROOT, '.env'));
const PORT = portOf('HUB_PORT', 8080);
const RELAY_PORT = portOf('HUB_RELAY_PORT', 47800);
process.env.HUB_RELAY_PORT = String(RELAY_PORT);

const MODEL_QUICK = process.env.HUB_CLAUDE_MODEL_QUICK || 'claude-haiku-5-5';
const MODEL_DEFAULT = process.env.HUB_CLAUDE_MODEL || 'claude-sonnet-5-5';

let forgetRelayCode = false;
let relayChild = null;
let stopping = false;
let awCache = { at: 0, data: { available: false } };

// Same providers and shapes as the extension's key vault (background.js).
// A pasted key is saved in ~/.the-hub/vault.json. An environment key is used only when nothing is pasted.
const VAULT = {
  xai: { ok: (k) => /^xai-[A-Za-z0-9_-]{20,}$/.test(k), name: 'xAI (Grok)', env: ['XAI_API_KEY'] },
  anthropic: { ok: (k) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k), name: 'Anthropic (Claude)', env: ['ANTHROPIC_API_KEY'] },
  openai: { ok: (k) => /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/.test(k), name: 'OpenAI', env: ['OPENAI_API_KEY'] },
  gemini: { ok: (k) => /^AIza[0-9A-Za-z_-]{30,}$/.test(k), name: 'Google Gemini', env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
  elevenlabs: { ok: (k) => /^(sk_[A-Za-z0-9]{20,}|[a-f0-9]{32})$/.test(k), name: 'ElevenLabs', env: ['ELEVENLABS_API_KEY'] },
};

function vaultFile() { return path.join(hubHome(), 'vault.json'); }
function readVault() {
  try {
    const j = JSON.parse(fs.readFileSync(vaultFile(), 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch { return {}; }
}
function writeVault(obj) {
  const clean = {};
  for (const p of Object.keys(VAULT)) {
    if (typeof obj[p] === 'string' && obj[p]) clean[p] = obj[p];
  }
  const file = vaultFile();
  if (!Object.keys(clean).length) { fs.rmSync(file, { force: true }); return; }
  const dir = hubHome();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(clean) + '\n', { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
}
function envKey(p) {
  for (const name of VAULT[p].env) {
    const v = (process.env[name] || '').trim();
    if (v) return v;
  }
  return '';
}
function savedKey(p) {
  const stored = readVault()[p];
  if (typeof stored === 'string' && stored.trim()) return stored.trim();
  if (p === 'xai') return readTrim(path.join(hubHome(), 'xai-key'));
  return '';
}
function effectiveKey(p) {
  const saved = savedKey(p);
  if (saved) return { key: saved, where: 'file' };
  const env = envKey(p);
  if (env) return { key: env, where: 'env' };
  return { key: '', where: '' };
}
function setVaultKey(p, key) {
  const next = readVault();
  next[p] = key;
  writeVault(next);
  if (p === 'xai') writeGrokKey(key);
}
function clearVaultKey(p) {
  const next = readVault();
  delete next[p];
  writeVault(next);
  if (p === 'xai') fs.rmSync(path.join(hubHome(), 'xai-key'), { force: true });
}
function keyView(p) {
  const k = effectiveKey(p).key;
  return { set: !!k, last4: k ? k.slice(-4) : '' };
}
function claudeKey() { return effectiveKey('anthropic').key; }
function grokKey() { return effectiveKey('xai'); }
function hubCode() { return readTrim(path.join(hubHome(), 'hub-code')); }
function extensionVersion() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(HUB, 'extension', 'manifest.json'), 'utf8'));
    return typeof m.version === 'string' ? m.version.slice(0, 12) : '';
  } catch { return ''; }
}

function send(res, code, obj, type) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const buf = Buffer.from(body);
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}
function hostOk(req) {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(String(req.headers.host || ''));
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const parts = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > max) { reject(new Error('too big')); req.destroy(); }
      else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req, max) {
  const raw = await readBody(req, max);
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Send JSON.'), { status: 400 }); }
}

async function relayHealth() {
  try {
    const r = await fetch('http://127.0.0.1:' + RELAY_PORT + '/health', { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return j && j.app === 'the-hub-relay' ? j : null;
  } catch { return null; }
}

function startRelay(detach) {
  if (!fs.existsSync(RELAY_JS)) {
    log('Relay file is missing (' + RELAY_JS + '). Serve the page anyway. Run npm run sync-hub if the extension folder was not unpacked.');
    return;
  }
  const child = spawn(process.execPath, [RELAY_JS, '--serve'], {
    stdio: detach ? 'ignore' : 'inherit',
    detached: !!detach,
    env: process.env,
  });
  if (detach) { child.unref(); return; }
  relayChild = child;
  child.on('exit', (code) => {
    relayChild = null;
    if (stopping || code === 0) return;
    log('Relay stopped (' + code + '). The page is still up.');
  });
}

async function ensureRelay(opts) {
  if (await relayHealth()) return 'up';
  startRelay(!!(opts && opts.detach));
  for (let i = 0; i < 25; i++) {
    if (await relayHealth()) return 'started';
    await sleep(200);
  }
  return 'down';
}

async function ourServerIsUp() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/__dev/health', { signal: AbortSignal.timeout(500) });
      const j = await r.json().catch(() => null);
      if (j && j.app === APP) return true;
      return false;
    } catch { await sleep(150); }
  }
  return false;
}

function statusBody() {
  const g = grokKey();
  const c = effectiveKey('anthropic');
  return {
    ok: true,
    app: APP,
    claude: !!c.key,
    claudeWhere: c.where || null,
    grok: !!g.key,
    grokWhere: g.where || null,
    extensionVersion: extensionVersion(),
    relayPort: RELAY_PORT,
    page: 'http://127.0.0.1:' + PORT + '/',
    hints: {
      claude: c.key
        ? (c.where === 'file' ? 'Using the Claude key saved on this computer in ~/.the-hub/vault.json.' : 'Using ANTHROPIC_API_KEY from the environment. It is not sent to the browser.')
        : MISSING_CLAUDE,
      grok: g.key
        ? (g.where === 'file' ? 'Using the Grok key saved on this computer in ~/.the-hub/vault.json.' : 'Using XAI_API_KEY from the environment.')
        : 'No Grok key. Add XAI_API_KEY to .env, or paste a key in the Hub under AI & keys. A pasted key is saved in ~/.the-hub/vault.json.',
      keys: 'AI & keys can also store OpenAI, Gemini, and ElevenLabs. Pasted keys stay in ~/.the-hub/vault.json. A .env key is used only when nothing is pasted. Remove in the Hub deletes the pasted copy. Edit .env and run npm run dev again to drop an environment key.',
      google: 'Calendar, Drive, and Gmail connect through Claude when you open the Hub on claude.ai. This page has no separate Google client.',
      activitywatch: 'Optional. If ActivityWatch is running on port 5600, the Activity tab shows it. If it is not installed, the page says so.',
      relay: 'The relay listens on 127.0.0.1:' + RELAY_PORT + '. npm run dev starts it. Its code stays in ~/.the-hub/hub-code.',
    },
  };
}

async function awSummary() {
  if (Date.now() - awCache.at < 30000) return awCache.data;
  let data = { available: false };
  for (const base of ['http://127.0.0.1:5600/api/0', 'http://localhost:5600/api/0']) {
    try {
      const buckets = await (await fetch(base + '/buckets/', { signal: AbortSignal.timeout(2000) })).json();
      const ids = Object.keys(buckets || {});
      const win = ids.find((i) => i.startsWith('aw-watcher-window_'));
      const afk = ids.find((i) => i.startsWith('aw-watcher-afk_'));
      if (!win) { data = { available: true, total: 0, apps: [] }; break; }
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const q = ['events = query_bucket("' + win + '");'];
      if (afk) q.push('afk = query_bucket("' + afk + '");', 'notafk = filter_keyvals(afk, "status", ["not-afk"]);', 'events = filter_period_intersect(events, notafk);');
      q.push('merged = merge_events_by_keys(events, ["app"]);', 'RETURN = sort_by_duration(merged);');
      const res = await (await fetch(base + '/query/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeperiods: [start.toISOString() + '/' + end.toISOString()], query: q }),
        signal: AbortSignal.timeout(4000),
      })).json();
      const evs = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : [];
      data = {
        available: true,
        total: Math.round(evs.reduce((a, e) => a + (e.duration || 0), 0)),
        apps: evs.slice(0, 15).map((e) => ({ app: String((e.data && e.data.app) || 'Unknown').slice(0, 80), secs: Math.round(e.duration || 0) })),
      };
      break;
    } catch { data = { available: false }; }
  }
  awCache = { at: Date.now(), data };
  return data;
}

function activityBody(aw) {
  return { today: [], week: [], tabs: [], hubTabs: [], aw, paused: false, tidy: null, tidied: [] };
}

async function relayApi(code, op, args, ms) {
  const body = JSON.stringify({ op, args: args || {} });
  const r = await fetch('http://127.0.0.1:' + RELAY_PORT + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + code },
    body,
    signal: AbortSignal.timeout(Math.min(130000, Math.max(3000, Number(ms) || 15000))),
  });
  if (r.status === 401) return { error: 'badcode' };
  const j = await r.json().catch(() => ({}));
  return j.ok ? { ok: true, result: j.result } : { error: String(j.error || 'relay error').slice(0, 400) };
}

async function handleRelay(body) {
  const op = String(body.op || '');
  if (op === '__status') {
    const health = await relayHealth();
    const code = !forgetRelayCode && !!hubCode();
    return { code, online: !!health, version: health ? String(health.version || '').slice(0, 12) : '' };
  }
  if (op === '__codeClear') { forgetRelayCode = true; return { ok: true }; }
  if (op === '__codeSet') {
    const code = String(body.code || '').trim();
    if (!/^hub-[a-f0-9]{40}$/.test(code)) return { error: 'That does not look like a relay code. It starts with hub- and is shown in the relay window.' };
    const file = hubCode();
    if (file && code !== file) return { error: 'The relay says that code is wrong. Copy it again from the relay window, or just use npm run dev, which connects on its own.' };
    forgetRelayCode = false;
    const health = await relayHealth();
    if (!health) return { ok: true, online: false };
    const t = await relayApi(code, 'status', {}, 8000);
    if (t.error === 'badcode') return { error: 'The relay says that code is wrong. Copy it again from the relay window.' };
    return { ok: true, online: true };
  }
  if (!/^[a-z.]{2,40}$/.test(op)) return { error: 'bad op' };
  if (forgetRelayCode) return { error: 'nocode' };
  const code = hubCode();
  if (!code) return { error: 'nocode' };
  try { return await relayApi(code, op, body.args, body.ms); }
  catch { return { error: 'offline' }; }
}

function writeGrokKey(key) {
  const dir = hubHome();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'xai-key');
  fs.writeFileSync(file, key + '\n', { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
}

async function handleGrok(body) {
  const op = String(body.op || '');
  if (op === 'grokKeyStatus') {
    const k = grokKey().key;
    return { set: !!k, last4: k ? k.slice(-4) : '' };
  }
  if (op === 'grokKeyClear') {
    clearVaultKey('xai');
    return { ok: true };
  }
  if (op === 'grokKeySet') {
    const k = String(body.key || '').trim();
    if (!VAULT.xai.ok(k)) return { error: "That doesn't look like an xAI key (they start with xai-)." };
    setVaultKey('xai', k);
    return { ok: true, last4: k.slice(-4) };
  }
  if (op === 'grokKeyTest') {
    const k = grokKey().key;
    if (!k) return { ok: false, error: 'nokey' };
    try {
      const r = await fetch(XAI + '/api-key', { headers: { Authorization: 'Bearer ' + k }, signal: AbortSignal.timeout(12000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: "xAI says this key doesn't work (" + r.status + ")." };
      return { ok: true, name: typeof j.name === 'string' ? j.name.slice(0, 60) : '', blocked: !!(j.api_key_blocked || j.api_key_disabled || j.team_blocked) };
    } catch { return { ok: false, error: "Couldn't reach xAI. Check your internet." }; }
  }
  if (op === 'grokImage') return grokImage(body);
  return { error: 'Unknown Grok request.' };
}

const KEY_TEST = {
  xai: (k) => [XAI + '/api-key', { headers: { Authorization: 'Bearer ' + k } }],
  anthropic: (k) => ['https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } }],
  openai: (k) => ['https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + k } }],
  gemini: (k) => ['https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': k } }],
  elevenlabs: (k) => ['https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': k } }],
};

async function handleKeys(body) {
  const op = String(body.op || '');
  const provider = String(body.provider || '');
  if (op === 'status') {
    const out = {};
    for (const p of Object.keys(VAULT)) out[p] = keyView(p);
    return out;
  }
  const spec = VAULT[provider];
  if (!spec) return { error: 'Unknown service.' };
  if (op === 'clear') { clearVaultKey(provider); return { ok: true }; }
  if (op === 'set') {
    const k = String(body.key || '').trim();
    if (!spec.ok(k)) return { error: "That doesn't look like " + (/^[AEIOU]/.test(spec.name) ? 'an ' : 'a ') + spec.name + ' key.' };
    setVaultKey(provider, k);
    return { ok: true, last4: k.slice(-4) };
  }
  if (op === 'test') {
    const k = effectiveKey(provider).key;
    if (!k) return { ok: false, error: 'nokey' };
    if (provider === 'xai') return handleGrok({ op: 'grokKeyTest' });
    try {
      const req = KEY_TEST[provider](k);
      const r = await fetch(req[0], { ...req[1], signal: AbortSignal.timeout(12000) });
      if (r.ok) return { ok: true };
      return { ok: false, error: (r.status === 401 || r.status === 403 ? "This key doesn't work (" : 'The service said no (') + r.status + ').' };
    } catch { return { ok: false, error: "Couldn't reach " + spec.name + '. Check your internet.' }; }
  }
  return { error: 'Unknown key request.' };
}

async function grokImage(m) {
  const key = grokKey().key;
  if (!key) return { error: 'nokey' };
  const prompt = String(m.prompt || '').trim().slice(0, 4000);
  if (!prompt) return { error: 'Write what you want first.' };
  const body = {
    model: String(m.model || 'grok-imagine-image-2.0').slice(0, 60),
    prompt,
    n: Math.max(1, Math.min(4, +m.n || 1)),
    response_format: 'b64_json',
  };
  if (/^\d+:\d+$/.test(m.aspect || '')) body.aspect_ratio = m.aspect;
  let url = XAI + '/images/generations';
  if (m.mode === 'edit') {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(m.image || '')) return { error: 'Pick a picture to edit first.' };
    if (m.image.length > 20 * 1024 * 1024) return { error: 'That picture is too big to send. Try a smaller one.' };
    body.image = { url: m.image, type: 'image_url' };
    url = XAI + '/images/edits';
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j && (j.error && (j.error.message || j.error) || j.message);
      return { error: msg ? String(msg).slice(0, 300) : 'xAI said no (' + res.status + ').' };
    }
    const out = [];
    for (const d of (Array.isArray(j.data) ? j.data : []).slice(0, 4)) {
      if (d.b64_json) out.push('data:image/jpeg;base64,' + d.b64_json);
      else if (d.url) out.push(await dataUrlFrom(d.url));
    }
    return out.length ? { images: out, revised: (j.data && j.data[0] && j.data[0].revised_prompt) || '' } : { error: 'xAI sent back no pictures.' };
  } catch { return { error: "Couldn't reach xAI. Check your internet." }; }
}

async function dataUrlFrom(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not download the picture from xAI.');
  const buf = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get('content-type') || 'image/jpeg';
  return 'data:' + type.split(';')[0] + ';base64,' + buf.toString('base64');
}

function claudeModel(tier) { return tier === 'quick' ? MODEL_QUICK : MODEL_DEFAULT; }

async function handleClaude(body) {
  const key = claudeKey();
  if (!key) return { ok: true, missing: true, text: MISSING_CLAUDE };
  const messages = body && body.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) {
    return { ok: false, error: 'Claude needs a short list of messages.' };
  }
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 40).map((t) => ({
    name: String(t.name || '').slice(0, 64),
    description: String(t.description || '').slice(0, 2000),
    input_schema: t.input_schema && typeof t.input_schema === 'object' ? t.input_schema : { type: 'object', properties: {} },
  })).filter((t) => t.name) : [];
  const payload = {
    model: claudeModel(body.modelTier),
    max_tokens: body.modelTier === 'quick' ? 1200 : 2048,
    messages,
  };
  if (tools.length) payload.tools = tools;
  let res;
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    return { ok: false, error: 'Could not reach Claude. Check your internet, then try again.' };
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j && j.error && (j.error.message || j.error) || ('Claude returned ' + res.status + '.');
    return { ok: false, error: String(msg).slice(0, 400) };
  }
  const content = Array.isArray(j.content) ? j.content : [];
  const text = content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim();
  const toolUses = content.filter((b) => b && b.type === 'tool_use' && b.id && b.name).map((b) => ({
    id: b.id, name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {},
  }));
  return { ok: true, text, content, toolUses, truncated: j.stop_reason === 'max_tokens' };
}

function safeHubFile(urlPath) {
  let rel = urlPath.split('?')[0];
  try { rel = decodeURIComponent(rel); } catch { return null; }
  if (rel.includes('\0')) return null;
  if (rel === '/' || rel === '') return path.join(HUB, 'index.html');
  const full = path.resolve(HUB, '.' + rel);
  const root = path.resolve(HUB);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function serveHubFile(res, file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    send(res, 404, { ok: false, error: 'Not found.' });
    return;
  }
  const ext = path.extname(file).toLowerCase();
  if (file === path.join(HUB, 'index.html')) {
    const html = fs.readFileSync(file, 'utf8');
    const tag = '<script src="/__dev/bridge.js"></script>';
    const out = html.includes(tag) ? html : html.replace('<head>', '<head>' + tag);
    send(res, 200, out, 'text/html; charset=utf-8');
    return;
  }
  const buf = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}

async function onRequest(req, res) {
  if (!hostOk(req)) return send(res, 403, { ok: false, error: 'This dev server only answers on localhost.' });
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && (url === '/__dev/health' || url === '/__dev/health/')) {
    return send(res, 200, { ok: true, app: APP });
  }
  if (req.method === 'GET' && url === '/__dev/status') {
    const health = await relayHealth();
    const aw = await awSummary();
    return send(res, 200, { ...statusBody(), relay: !!health, relayVersion: health ? health.version : null, activitywatch: !!aw.available });
  }
  if (req.method === 'GET' && url === '/__dev/activity') return send(res, 200, activityBody(await awSummary()));
  if (req.method === 'GET' && url === '/__dev/bridge.js') {
    return send(res, 200, fs.readFileSync(BRIDGE, 'utf8'), 'text/javascript; charset=utf-8');
  }
  if (req.method === 'POST' && (url === '/__dev/relay' || url === '/__dev/grok' || url === '/__dev/claude' || url === '/__dev/keys')) {
    const max = url === '/__dev/grok' ? 22e6 : url === '/__dev/keys' ? 65536 : 8e6;
    let body;
    try { body = await readJson(req, max); }
    catch (e) { return send(res, e.status || 400, { ok: false, error: e.message || 'Bad request.' }); }
    try {
      if (url === '/__dev/relay') return send(res, 200, await handleRelay(body));
      if (url === '/__dev/grok') return send(res, 200, await handleGrok(body));
      if (url === '/__dev/keys') return send(res, 200, await handleKeys(body));
      return send(res, 200, await handleClaude(body));
    } catch (e) {
      log(url + ' failed: ' + (e && e.message ? e.message : 'error'));
      return send(res, 200, { ok: false, error: 'That request failed on the local server.' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'Use GET.' });
  if (url.startsWith('/__dev/')) return send(res, 404, { ok: false, error: 'Not found.' });
  const file = safeHubFile(url);
  if (req.method === 'HEAD') {
    if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    return res.end();
  }
  serveHubFile(res, file);
}

function banner(relayState) {
  const g = grokKey();
  console.log('');
  console.log('  My Hub is running at http://127.0.0.1:' + PORT + '/');
  console.log('  Relay: ' + (relayState === 'down' ? 'not running' : 'http://127.0.0.1:' + RELAY_PORT + '/health'));
  const c = effectiveKey('anthropic');
  console.log('  Claude: ' + (c.key ? 'key set (' + c.where + ')' : 'no key (chat will explain how to add one)'));
  console.log('  Grok: ' + (g.key ? 'key set (' + g.where + ')' : 'no key (optional)'));
  console.log('  Extension the page sees: ' + (extensionVersion() || 'unknown') + ' (keys, Grok, relay)');
  console.log('  Status: http://127.0.0.1:' + PORT + '/__dev/status');
  console.log('  Leave this window open. Ctrl+C stops the page and the relay this command started.');
  console.log('');
}

async function main() {
  if (!fs.existsSync(path.join(HUB, 'index.html'))) {
    log('hub/index.html is missing. Run npm run sync-hub, or check that you are in the Nova-AI folder.');
    process.exit(1);
  }
  if (!fs.existsSync(BRIDGE)) {
    log('scripts/hub-bridge.js is missing.');
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    onRequest(req, res).catch((e) => {
      if (!res.headersSent) send(res, 500, { ok: false, error: 'The dev server hit an error.' });
      log('request error: ' + (e && e.message ? e.message : 'error'));
    });
  });
  let listening = false;
  server.on('error', async (err) => {
    if (listening) { log('server error: ' + err.message); return; }
    if (err.code !== 'EADDRINUSE') { log(err.message); process.exit(1); }
    const ours = await ourServerIsUp();
    if (!ours) {
      log('Port ' + PORT + ' is already used by something else. Stop that program, then run npm run dev again.');
      process.exit(1);
    }
    const relayState = await ensureRelay({ detach: true });
    console.log('');
    console.log('  My Hub is already running at http://127.0.0.1:' + PORT + '/');
    console.log('  Relay: ' + (relayState === 'down' ? 'could not start' : 'http://127.0.0.1:' + RELAY_PORT + '/health'));
    console.log('');
    process.exit(0);
  });
  await new Promise((resolve) => {
    server.listen(PORT, BIND, () => { listening = true; resolve(); });
  });
  const relayState = await ensureRelay();
  banner(relayState);
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (relayChild) relayChild.kill('SIGTERM');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => { log(e && e.message ? e.message : String(e)); process.exit(1); });
