// Easy image editor.
// Direct: this program calls the xAI Grok picture API with XAI_API_KEY.
// Bridge: this program asks My Hub (npm run dev) to call that same API.
// Kept pictures and the cast are saved under data/, which git ignores.
// The key is never written into the page, the library, or the terminal.

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, 'data');
const LIBRARY = join(DATA, 'library');
const CAST_FILE = join(DATA, 'cast.json');
const CHAT_FILE = join(DATA, 'chat.json');
const MODEL_DEFAULT = 'grok-imagine-image-2.0';
const KEY_OK = /^xai-[A-Za-z0-9_-]{20,}$/;
const ASPECT_OK = /^\d+:\d+$/;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/;
const ID_OK = /^[a-z0-9]{8,40}$/;
const MAX_BODY = 16 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

loadEnv(join(ROOT, '.env'));

const PORT = Number(process.env.IMAGE_EDITOR_PORT || 8787);
const MOCK = process.env.IMAGE_EDITOR_MOCK === '1';
const BRIDGE = bridgeOrigin(process.env.BRIDGE_BASE_URL || process.env.HUB_BRIDGE_URL || 'http://127.0.0.1:8080');

mkdirSync(LIBRARY, { recursive: true });

let writeChain = Promise.resolve();

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

function apiBase() {
  const raw = process.env.IMAGE_API_BASE_URL || process.env.XAI_API_BASE || 'https://api.x.ai';
  try {
    const url = new URL(raw);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) {
      return url.origin + url.pathname.replace(/\/+$/, '');
    }
  } catch {
    /* fall through */
  }
  return 'https://api.x.ai';
}

function envKey() {
  const key = process.env.XAI_API_KEY || '';
  return KEY_OK.test(key) ? key : '';
}

function hint(key) {
  return key ? key.slice(-4) : '';
}

function nid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function tagList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const out = [];
  for (const item of raw) {
    const tag = clean(item, 40);
    if (!tag) continue;
    if (out.some((have) => have.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}

function locked(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(() => {}, () => {});
  return run;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': payload.length,
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
  <rect width="100%" height="100%" fill="#0b0d12"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="22" fill="#12151c" stroke="#ff7cbf" stroke-width="2"/>
  <rect x="40" y="40" width="8" height="${height - 80}" rx="4" fill="#86e3ef"/>
  <text x="68" y="92" font-family="Georgia, serif" font-size="28" fill="#ff7cbf">Practice picture</text>
  <text x="68" y="138" font-family="Georgia, serif" font-size="18" fill="#f6f8fb">${safe}</text>
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
    model: String(message.model || process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT).slice(0, 80),
    prompt,
    n: 1,
    response_format: 'b64_json',
  };
  if (ASPECT_OK.test(message.aspect || '')) body.aspect_ratio = message.aspect;
  let url = apiBase() + '/v1/images/generations';
  if (message.mode === 'edit') {
    if (!DATA_IMAGE.test(message.image || '')) return { error: 'Pick a PNG, JPEG, or WebP picture to edit first.' };
    if (message.image.length > 12 * 1024 * 1024) return { error: 'That picture is too big to send. Try a smaller one.' };
    body.image = { url: message.image, type: 'image_url' };
    url = apiBase() + '/v1/images/edits';
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
      if (response.status === 401 || response.status === 403) return { error: 'xAI refused the key.' };
      return { error: msg ? String(msg).slice(0, 300) : 'xAI said no (' + response.status + ').' };
    }
    const images = [];
    for (const item of (Array.isArray(json.data) ? json.data : []).slice(0, 1)) {
      if (item.b64_json) images.push('data:' + (item.mime || 'image/jpeg') + ';base64,' + item.b64_json);
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
    model: String(message.model || process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT).slice(0, 80),
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

function readCast() {
  if (!existsSync(CAST_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(CAST_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCast(list) {
  const tmp = CAST_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(list, null, 2));
  renameSync(tmp, CAST_FILE);
}

const SHEET_ROOT = ['name', 'kind', 'role', 'world', 'persona', 'want', 'cost', 'appearance', 'scenario', 'firstMessage', 'userName', 'systemNotes', 'authorNote'];
const SHEET_PROFILE = ['tagline', 'nickname', 'age', 'pronouns', 'species', 'occupation', 'height', 'bodyType', 'bust', 'marks', 'outfit', 'palette', 'artStyle', 'quirks', 'speech', 'catchphrases', 'examples', 'origin', 'upbringing', 'secret', 'fears', 'goals', 'likes', 'dislikes', 'hobbies', 'relationship', 'dynamic', 'boundaries', 'rpgClass', 'race', 'level', 'alignment', 'abilities', 'equipment', 'weakness'];
const SHEET_TAGS = ['genre', 'personality', 'role', 'setting', 'species', 'rating', 'custom'];
const TRAIT_KEYS = ['bold', 'sassy', 'chaos', 'playful', 'affection'];

function blankSheet(kind) {
  const persona = kind === 'persona';
  return {
    name: persona ? 'New persona' : 'New character',
    kind: persona ? 'persona' : 'companion',
    role: persona ? 'Persona' : 'Companion',
    world: '',
    persona: '',
    want: '',
    cost: '',
    appearance: '',
    scenario: '',
    firstMessage: '',
    userName: '',
    systemNotes: '',
    authorNote: '',
    quickLines: [],
    checkinLines: [],
    profile: {
      tagline: '', nickname: '', age: '', pronouns: '', species: '', occupation: '',
      height: '', bodyType: '', bust: '', marks: '', outfit: '', palette: '', artStyle: '',
      quirks: '', speech: '', catchphrases: '', examples: '', origin: '', upbringing: '',
      secret: '', fears: '', goals: '', likes: '', dislikes: '', hobbies: '',
      relationship: '', dynamic: '', boundaries: '',
      rpgOn: false, rpgClass: '', race: '', level: '', alignment: '', abilities: '', equipment: '', weakness: '',
      traits: { bold: 50, sassy: 50, chaos: 50, playful: 50, affection: 50 },
      archetypes: [],
    },
    tags: { genre: [], personality: [], role: [], setting: [], species: [], rating: [], custom: [] },
    exclude: {},
    lorebook: [],
  };
}

function sheetFromFlat(person) {
  const sheet = blankSheet(person && person.kind);
  if (!person) return sheet;
  sheet.name = person.name || sheet.name;
  sheet.kind = person.kind === 'persona' ? 'persona' : 'companion';
  sheet.role = person.role || sheet.role;
  sheet.world = person.world || '';
  sheet.profile.outfit = person.outfit || '';
  sheet.profile.tagline = person.one || '';
  sheet.tags.custom = tagList(person.tags);
  return sheet;
}

function lineList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split('\n');
  return raw.map((line) => clean(line, 160)).filter(Boolean).slice(0, 12);
}

function cleanAge(value) {
  const text = clean(value, 8);
  if (!text) return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(18, Math.min(120, Math.round(n))));
}

function normalizeSheet(input, fallbackKind) {
  const sheet = blankSheet(fallbackKind);
  const src = input && typeof input === 'object' ? input : {};
  for (const key of SHEET_ROOT) {
    if (key === 'kind') sheet.kind = src.kind === 'persona' ? 'persona' : 'companion';
    else if (key === 'name') sheet.name = clean(src.name, 80) || sheet.name;
    else if (key === 'role') sheet.role = clean(src.role, 80);
    else if (key === 'world') sheet.world = clean(src.world, 160);
    else sheet[key] = clean(src[key], key === 'appearance' || key === 'persona' || key === 'scenario' || key === 'firstMessage' || key === 'systemNotes' || key === 'authorNote' ? 2000 : 240);
  }
  if (!sheet.role) sheet.role = sheet.kind === 'persona' ? 'Persona' : 'Companion';
  const profile = src.profile && typeof src.profile === 'object' ? src.profile : {};
  for (const key of SHEET_PROFILE) {
    sheet.profile[key] = key === 'age' ? cleanAge(profile[key]) : clean(profile[key], key === 'examples' || key === 'abilities' || key === 'equipment' || key === 'quirks' || key === 'speech' ? 2000 : 240);
  }
  sheet.profile.rpgOn = Boolean(profile.rpgOn);
  const traits = profile.traits && typeof profile.traits === 'object' ? profile.traits : {};
  for (const key of TRAIT_KEYS) {
    const n = Number(traits[key]);
    sheet.profile.traits[key] = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
  }
  sheet.profile.archetypes = tagList(profile.archetypes).slice(0, 3);
  const tags = src.tags && typeof src.tags === 'object' ? src.tags : {};
  for (const key of SHEET_TAGS) sheet.tags[key] = tagList(tags[key]);
  const exclude = src.exclude && typeof src.exclude === 'object' ? src.exclude : {};
  for (const key of Object.keys(exclude)) {
    if (exclude[key]) sheet.exclude[clean(key, 40)] = true;
  }
  sheet.quickLines = lineList(src.quickLines);
  sheet.checkinLines = lineList(src.checkinLines);
  const lore = Array.isArray(src.lorebook) ? src.lorebook : [];
  sheet.lorebook = lore.slice(0, 20).map((entry) => ({
    title: clean(entry && entry.title, 80),
    keys: tagList(entry && entry.keys),
    content: clean(entry && entry.content, 2000),
    always: Boolean(entry && entry.always),
  })).filter((entry) => entry.title || entry.content);
  return sheet;
}

function listsFromSheet(sheet) {
  const custom = sheet.tags.custom || [];
  const extra = ['genre', 'personality', 'species', 'rating'].flatMap((key) => sheet.tags[key] || []);
  const roleTag = (sheet.tags.role || [])[0] || '';
  const setting = (sheet.tags.setting || [])[0] || '';
  return {
    name: sheet.name,
    kind: sheet.kind,
    role: sheet.role || roleTag || (sheet.kind === 'persona' ? 'Persona' : 'Companion'),
    outfit: sheet.profile.outfit || '',
    world: sheet.world || setting,
    one: sheet.profile.tagline || '',
    tags: tagList(custom.concat(extra)),
  };
}

function applyFlat(sheet, body) {
  if (body.name != null && clean(body.name, 80)) sheet.name = clean(body.name, 80);
  if (body.kind === 'persona' || body.kind === 'companion') sheet.kind = body.kind;
  if (body.role != null && clean(body.role, 80)) sheet.role = clean(body.role, 80);
  if (body.outfit != null) sheet.profile.outfit = clean(body.outfit, 120);
  if (body.world != null) sheet.world = clean(body.world, 160);
  if (body.one != null) sheet.profile.tagline = clean(body.one, 160);
  if (body.tags != null) sheet.tags.custom = tagList(body.tags);
  if (!sheet.role) sheet.role = sheet.kind === 'persona' ? 'Persona' : 'Companion';
  return sheet;
}

function castFields(body, previous) {
  const fallback = previous && previous.sheet ? previous.sheet : sheetFromFlat(previous);
  let sheet = normalizeSheet(fallback, body && body.kind);
  if (body && body.sheet && typeof body.sheet === 'object') sheet = normalizeSheet({ ...sheet, ...body.sheet, profile: { ...sheet.profile, ...(body.sheet.profile || {}) }, tags: { ...sheet.tags, ...(body.sheet.tags || {}) } }, sheet.kind);
  else if (body) sheet = applyFlat(sheet, body);
  const lists = listsFromSheet(sheet);
  return {
    id: previous ? previous.id : nid('c'),
    name: lists.name,
    kind: lists.kind,
    role: lists.role,
    outfit: lists.outfit,
    world: lists.world,
    one: lists.one,
    tags: lists.tags,
    sheet,
    createdAt: previous ? previous.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function familiarCard(person) {
  const sheet = person.sheet || sheetFromFlat(person);
  const tags = SHEET_TAGS.flatMap((key) => (sheet.tags && sheet.tags[key]) || []);
  const description = [sheet.persona, sheet.appearance ? 'Appearance: ' + sheet.appearance : ''].filter(Boolean).join('\n\n');
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: sheet.name,
      description,
      personality: [sheet.profile && sheet.profile.tagline, sheet.want && 'Want: ' + sheet.want, sheet.cost && 'Cost: ' + sheet.cost].filter(Boolean).join('\n'),
      scenario: sheet.scenario || '',
      first_mes: sheet.firstMessage || '',
      mes_example: (sheet.profile && sheet.profile.examples) || '',
      creator_notes: (sheet.profile && sheet.profile.tagline) || '',
      system_prompt: sheet.systemNotes || '',
      post_history_instructions: sheet.authorNote || '',
      tags: tags.length ? tags : ['familiar'],
      creator: sheet.userName || '',
      character_version: '1',
      extensions: {
        familiar: {
          kind: sheet.kind,
          role: person.role,
          world: person.world,
          persona: sheet.persona,
          appearance: sheet.appearance,
          outfit: person.outfit,
          profile: sheet.profile,
          tags: sheet.tags,
          exclude: sheet.exclude || {},
        },
      },
    },
  };
}

function publicCast(person) {
  const sheet = person.sheet || sheetFromFlat(person);
  return {
    id: person.id,
    name: person.name,
    kind: person.kind,
    role: person.role,
    outfit: person.outfit,
    world: person.world,
    one: person.one,
    tags: person.tags || [],
    sheet,
    card: familiarCard({ ...person, sheet }),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

function readChat() {
  if (!existsSync(CHAT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(CHAT_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeChat(turns) {
  const tmp = CHAT_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(turns.slice(-200), null, 2));
  renameSync(tmp, CHAT_FILE);
}

function publicTurn(turn) {
  return {
    id: turn.id,
    role: turn.role,
    text: turn.text,
    at: turn.at,
    characterId: turn.characterId || '',
    character: turn.character || '',
    itemId: turn.itemId || '',
  };
}

function resolvePerson(body) {
  const list = readCast().map((person) => person.sheet ? person : { ...person, sheet: sheetFromFlat(person) });
  const requested = clean(body.characterId, 40);
  if (requested) {
    if (!ID_OK.test(requested)) return { error: 'That character id is not one this desk saved.' };
    const found = list.find((person) => person.id === requested);
    return found ? { person: found } : { error: 'That character is not in the cast.' };
  }
  const name = clean(body.character || body.name, 80).toLowerCase();
  if (name) {
    const found = list.find((person) => person.name.toLowerCase() === name);
    if (found) return { person: found };
  }
  if (!list.length) return { person: null };
  const newest = list.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return { person: newest };
}

function kept(sheet, key) {
  return !(sheet.exclude && sheet.exclude[key]);
}

function musePrompt(person, message) {
  const line = clean(message, 4000);
  if (!person) return line;
  const sheet = person.sheet || sheetFromFlat(person);
  const parts = [];
  if (kept(sheet, 'name') && person.name) parts.push(person.name);
  if (kept(sheet, 'appearance') && sheet.appearance) parts.push(sheet.appearance);
  if (kept(sheet, 'outfit') && person.outfit) parts.push('Outfit: ' + person.outfit);
  if (kept(sheet, 'world') && person.world) parts.push('Setting: ' + person.world);
  if (kept(sheet, 'artStyle') && sheet.profile && sheet.profile.artStyle) parts.push(sheet.profile.artStyle);
  parts.push(line);
  return parts.map((part) => String(part).trim().replace(/[.\s]+$/, '')).filter(Boolean).join('. ') + '.';
}

function localMuse(person, filed) {
  const name = person && person.name ? person.name : 'the stage';
  if (!filed) return 'Heard. I did not file a picture on this turn.';
  return 'Filed a picture for ' + name + '. Memory can filter it with this card’s lists.';
}

async function grokChat(system, user, key) {
  const model = String(process.env.XAI_CHAT_MODEL || 'grok-4.7').slice(0, 80);
  try {
    const response = await fetch(apiBase() + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    const json = await response.json().catch(() => ({}));
    const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!response.ok || !text) return '';
    return clean(text, 500);
  } catch {
    return '';
  }
}

async function chatTurn(message) {
  const text = clean(message.message || message.text || message.prompt, 4000);
  if (!text) return { ok: false, error: 'Write a line to Muse first.' };
  const resolved = resolvePerson(message);
  if (resolved.error) return { ok: false, error: resolved.error };
  const person = resolved.person;
  const wantPicture = message.picture !== false && message.picture !== 'false';
  const connection = message.connection === 'bridge' ? 'bridge' : 'direct';
  const listed = {
    character: clean(message.character, 80) || (person ? person.name : ''),
    characterId: person ? person.id : '',
    role: clean(message.role, 80) || (person ? person.role : ''),
    outfit: clean(message.outfit, 120) || (person ? person.outfit : ''),
    world: clean(message.world, 160) || (person ? person.world : ''),
    tags: tagList(message.tags).length ? tagList(message.tags) : (person ? person.tags : []),
  };
  let item = null;
  let source = '';
  if (wantPicture) {
    const made = await generate({
      prompt: musePrompt(person ? { ...person, name: listed.character, outfit: listed.outfit, world: listed.world, role: listed.role } : null, text),
      line: text,
      connection,
      aspect: message.aspect,
      mode: 'generate',
      key: message.key,
      character: listed.character,
      characterId: listed.characterId,
      role: listed.role,
      outfit: listed.outfit,
      world: listed.world,
      tags: listed.tags,
    });
    if (!made.ok) return made;
    item = made.item;
    source = made.source;
  }
  let reply = '';
  const key = connection === 'direct' && !MOCK ? envKey() || (KEY_OK.test(message.key || '') ? message.key.trim() : '') : '';
  if (key && wantPicture) {
    const who = person ? person.name : 'the stage';
    reply = await grokChat(
      'You are Muse on the Duet Stage picture desk. Answer in one or two short sentences about the picture you just filed. Name the character. Do not roleplay.',
      'Character: ' + who + (person && person.outfit ? '. Outfit: ' + person.outfit : '') + (person && person.world ? '. World: ' + person.world : '') + '. The user asked: ' + text,
      key,
    );
  }
  if (!reply) reply = localMuse(person, wantPicture);
  const at = new Date().toISOString();
  const userTurn = { id: nid('t').slice(0, 24), role: 'user', text, at, characterId: person ? person.id : '', character: person ? person.name : '', itemId: '' };
  const museTurn = { id: nid('t').slice(0, 24), role: 'muse', text: reply, at: new Date().toISOString(), characterId: person ? person.id : '', character: person ? person.name : '', itemId: item ? item.id : '' };
  await locked(() => {
    const turns = readChat();
    turns.push(userTurn, museTurn);
    writeChat(turns);
  });
  return {
    ok: true,
    reply,
    source,
    item,
    person: person ? publicCast(person) : null,
    turns: [publicTurn(userTurn), publicTurn(museTurn)],
  };
}

function extFor(dataUrl) {
  const match = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.exec(dataUrl || '');
  if (!match) return '';
  if (match[1] === 'jpeg') return '.jpg';
  if (match[1] === 'svg+xml') return '.svg';
  return '.' + match[1];
}

function pairingParts(source) {
  return {
    character: clean(source.character, 80),
    characterId: ID_OK.test(source.characterId || '') ? source.characterId : '',
    role: clean(source.role, 80),
    outfit: clean(source.outfit, 120),
    world: clean(source.world, 160),
    tags: tagList(source.tags),
  };
}

function whoKey(parts, cast) {
  if (parts.characterId && cast.some((person) => person.id === parts.characterId)) return 'id:' + parts.characterId;
  const name = parts.character.toLowerCase();
  const person = name && cast.find((item) => String(item.name || '').toLowerCase() === name);
  if (person) return 'id:' + person.id;
  if (parts.characterId) return 'id:' + parts.characterId;
  return 'name:' + name;
}

function pairingKey(parts, cast) {
  return JSON.stringify([
    whoKey(parts, cast),
    parts.role.toLowerCase(),
    parts.outfit.toLowerCase(),
    parts.world.toLowerCase(),
    parts.tags.map((tag) => tag.toLowerCase()).sort(),
  ]);
}

function pairingIdFor(parts, cast) {
  return createHash('sha256').update(pairingKey(parts, cast)).digest('hex').slice(0, 16);
}

function listLibrary() {
  if (!existsSync(LIBRARY)) return [];
  const cast = readCast();
  const items = [];
  for (const name of readdirSync(LIBRARY)) {
    if (!name.endsWith('.json')) continue;
    try {
      const item = JSON.parse(readFileSync(join(LIBRARY, name), 'utf8'));
      if (item && ID_OK.test(item.id)) items.push(publicItem(item, cast));
    } catch {
      /* skip a broken card */
    }
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return items;
}

function publicItem(item, cast = readCast()) {
  const parts = pairingParts(item);
  return {
    id: item.id,
    prompt: item.prompt,
    createdAt: item.createdAt,
    character: parts.character,
    characterId: parts.characterId,
    role: parts.role,
    outfit: parts.outfit,
    world: parts.world,
    tags: parts.tags,
    pairingId: pairingIdFor(parts, cast),
    settings: item.settings || {},
    file: item.file,
    url: '/media/' + item.id,
  };
}

function listPairings() {
  const groups = new Map();
  for (const item of listLibrary()) {
    let group = groups.get(item.pairingId);
    if (!group) {
      group = {
        id: item.pairingId,
        character: item.character,
        characterId: item.characterId,
        role: item.role,
        outfit: item.outfit,
        world: item.world,
        tags: item.tags,
        count: 0,
        latestAt: item.createdAt,
        items: [],
      };
      groups.set(item.pairingId, group);
    }
    if (!group.characterId && item.characterId) group.characterId = item.characterId;
    group.count += 1;
    group.items.push(item);
  }
  return [...groups.values()];
}

function sameTag(value, tag) {
  return String(value || '').toLowerCase() === tag;
}

function itemMatches(item, query) {
  const pairing = clean(query.get('pairing'), 40).toLowerCase();
  if (pairing && item.pairingId !== pairing) return false;
  const tag = clean(query.get('tag'), 40).toLowerCase();
  const group = clean(query.get('group'), 20).toLowerCase();
  const q = clean(query.get('q'), 80).toLowerCase();
  if (tag) {
    const groups = {
      character: [item.character],
      role: [item.role],
      outfit: [item.outfit],
      world: [item.world],
      tag: item.tags || [],
    };
    const pool = groups[group] || [item.character, item.role, item.outfit, item.world, ...(item.tags || [])];
    if (!pool.some((value) => sameTag(value, tag))) return false;
  }
  if (q) {
    const hay = [item.prompt, item.character, item.role, item.outfit, item.world, ...(item.tags || [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function saveGeneration(message, result) {
  return locked(() => {
    const id = nid('p').slice(0, 24);
    const dataUrl = result.images && result.images[0];
    const ext = extFor(dataUrl);
    if (!ext) throw new Error('The picture came back in a form this editor cannot keep.');
    const comma = dataUrl.indexOf(',');
    const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
    const file = id + ext;
    const imagePath = join(LIBRARY, file);
    const jsonPath = join(LIBRARY, id + '.json');
    const item = {
      id,
      prompt: clean(message.prompt, 4000),
      createdAt: new Date().toISOString(),
      character: clean(message.character, 80),
      characterId: ID_OK.test(message.characterId || '') ? message.characterId : '',
      role: clean(message.role, 80),
      outfit: clean(message.outfit, 120),
      world: clean(message.world, 160),
      tags: tagList(message.tags),
      settings: {
        model: String(message.model || process.env.XAI_IMAGE_MODEL || MODEL_DEFAULT).slice(0, 80),
        aspect: ASPECT_OK.test(message.aspect || '') ? message.aspect : '',
        connection: message.connection === 'bridge' ? 'bridge' : 'direct',
        source: result.source || '',
        mode: message.mode === 'edit' ? 'edit' : 'generate',
        revised: clean(result.revised, 500),
        line: clean(message.line, 500),
      },
      file,
    };
    writeFileSync(imagePath + '.tmp', bytes);
    renameSync(imagePath + '.tmp', imagePath);
    writeFileSync(jsonPath + '.tmp', JSON.stringify(item, null, 2));
    renameSync(jsonPath + '.tmp', jsonPath);
    return publicItem(item);
  });
}

function deleteItem(id) {
  return locked(() => {
    const jsonPath = join(LIBRARY, id + '.json');
    if (!existsSync(jsonPath)) return false;
    let file = '';
    try {
      file = JSON.parse(readFileSync(jsonPath, 'utf8')).file;
    } catch {
      file = '';
    }
    unlinkSync(jsonPath);
    if (file && /^[a-z0-9]+\.(png|jpe?g|webp|svg)$/i.test(file)) {
      const imagePath = join(LIBRARY, file);
      if (existsSync(imagePath)) unlinkSync(imagePath);
    }
    return true;
  });
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
    apiBase: apiBase(),
    bridgeUrl: BRIDGE,
    bridge,
  };
}

async function generate(message) {
  const prompt = String(message.prompt || '').trim();
  if (!prompt) return { ok: false, error: 'Write what you want the picture to show first.' };
  const mode = message.mode === 'edit' ? 'edit' : 'generate';
  const connection = message.connection === 'bridge' ? 'bridge' : 'direct';
  const request = {
    prompt,
    aspect: message.aspect,
    mode,
    image: message.image,
    model: message.model,
  };
  let result;
  if (connection === 'bridge') {
    const made = await bridgeImage(request);
    result = made.error ? { ok: false, error: made.error } : { ok: true, source: 'bridge', ...made };
  } else if (MOCK) {
    result = { ok: true, source: 'mock', images: [mockImage(prompt, request.aspect)], revised: '' };
  } else {
    let key = envKey();
    const pasted = typeof message.key === 'string' ? message.key.trim() : '';
    if (pasted) {
      if (!KEY_OK.test(pasted)) return { ok: false, error: "That doesn't look like an xAI key. Those keys start with xai-." };
      key = pasted;
    }
    if (!key) return { ok: false, error: friendlyKeyMissing() };
    const made = await grokImage(request, key);
    result = made.error ? { ok: false, error: made.error } : { ok: true, source: 'direct', ...made };
  }
  if (!result.ok) return result;
  try {
    const item = await saveGeneration({ ...message, ...request, connection }, result);
    return { ...result, item };
  } catch {
    return { ok: false, error: 'The picture came back, but this computer could not file it in the library.' };
  }
}

function readJson(req) {
  return readBody(req).then((raw) => {
    const message = JSON.parse(raw);
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw Object.assign(new Error('bad'), { code: 'bad' });
    }
    return message;
  });
}

function publicFile(pathname) {
  if (pathname.includes('\0') || pathname.includes('..')) return null;
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!/^[\w./-]+$/.test(rel)) return null;
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(res, 200, await status());
    }
    if (req.method === 'GET' && url.pathname === '/api/library') {
      const items = listLibrary().filter((item) => itemMatches(item, url.searchParams));
      return send(res, 200, { ok: true, items });
    }
    if (req.method === 'GET' && url.pathname === '/api/pairings') {
      return send(res, 200, { ok: true, pairings: listPairings() });
    }
    const media = /^\/media\/([a-z0-9]{8,40})$/i.exec(url.pathname);
    if (req.method === 'GET' && media) {
      const id = media[1].toLowerCase();
      const jsonPath = join(LIBRARY, id + '.json');
      if (!existsSync(jsonPath)) return send(res, 404, { ok: false, error: 'That picture is not in the library.' });
      const item = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const file = join(LIBRARY, item.file || '');
      if (!file.startsWith(LIBRARY) || !existsSync(file)) {
        return send(res, 404, { ok: false, error: 'That picture file is missing.' });
      }
      const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
      return send(res, 200, readFileSync(file), type);
    }
    const libraryId = /^\/api\/library\/([a-z0-9]{8,40})$/i.exec(url.pathname);
    if (libraryId && req.method === 'DELETE') {
      const gone = await deleteItem(libraryId[1].toLowerCase());
      return send(res, gone ? 200 : 404, gone ? { ok: true } : { ok: false, error: 'That picture is not in the library.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/cast') {
      return send(res, 200, { ok: true, cast: readCast().map(publicCast) });
    }
    if (req.method === 'POST' && url.pathname === '/api/cast') {
      const body = await readJson(req);
      const person = castFields(body);
      await locked(() => {
        const list = readCast();
        list.push(person);
        writeCast(list);
      });
      return send(res, 200, { ok: true, person: publicCast(person) });
    }
    const castId = /^\/api\/cast\/([a-z0-9]{8,40})$/i.exec(url.pathname);
    if (castId && req.method === 'PATCH') {
      const id = castId[1];
      const body = await readJson(req);
      const person = await locked(() => {
        const list = readCast();
        const index = list.findIndex((item) => item.id === id);
        if (index < 0) return null;
        list[index] = castFields(body, list[index]);
        writeCast(list);
        return list[index];
      });
      if (!person) return send(res, 404, { ok: false, error: 'That character is not in the cast.' });
      return send(res, 200, { ok: true, person: publicCast(person) });
    }
    if (castId && req.method === 'DELETE') {
      const id = castId[1];
      const gone = await locked(() => {
        const list = readCast();
        const next = list.filter((item) => item.id !== id);
        if (next.length === list.length) return false;
        writeCast(next);
        return true;
      });
      return send(res, gone ? 200 : 404, gone ? { ok: true } : { ok: false, error: 'That character is not in the cast.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/chat') {
      const characterId = clean(url.searchParams.get('characterId'), 40);
      const turns = readChat().filter((turn) => !characterId || turn.characterId === characterId).map(publicTurn);
      return send(res, 200, { ok: true, turns });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      let message;
      try {
        message = await readJson(req);
      } catch (error) {
        const tooBig = error && error.code === 'too-big';
        return send(res, 400, { ok: false, error: tooBig ? 'That line is too big to send.' : 'The page sent something this editor could not read. Refresh and try again.' });
      }
      return send(res, 200, await chatTurn(message));
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      let message;
      try {
        message = await readJson(req);
      } catch (error) {
        const tooBig = error && error.code === 'too-big';
        return send(res, 400, { ok: false, error: tooBig ? 'That picture is too big to send. Try a smaller one.' : 'The page sent something this editor could not read. Refresh and try again.' });
      }
      return send(res, 200, await generate(message));
    }
    if (req.method === 'GET') {
      const file = publicFile(url.pathname);
      if (file) return send(res, 200, readFileSync(file), TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
    }
    send(res, 404, { ok: false, error: 'That page is not part of the editor.' });
  } catch (error) {
    const tooBig = error && error.code === 'too-big';
    if (tooBig) return send(res, 400, { ok: false, error: 'That picture is too big to send. Try a smaller one.' });
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
  console.log('Duet Stage picture desk');
  console.log('Open http://127.0.0.1:' + PORT + '/');
  console.log('Direct API: ' + (key ? 'key is set (ends in ' + hint(key) + ')' : 'no key yet'));
  console.log('API base: ' + apiBase());
  console.log('Hub bridge: ' + BRIDGE);
  console.log('Practice pictures: ' + (MOCK ? 'on' : 'off'));
});
