// Pulls the newest published version of My Hub from Claude into hub/.
// Claude only answers the "which version is newest" lookup to a real browser,
// so that one step runs in headless Chromium. The files themselves are plain downloads.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACT_URL = 'https://claude.ai/artifact/9aQgcMWmM7zPBkhuhRKbWu';
const EXT_PKG = 'ext/hub-extension.json';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = join(ROOT, 'hub');
const VERSION_FILE = join(HUB, 'version.json');
const RUNTIME_START = '<!-- frame-runtime -->';
const RUNTIME_END = '<!-- /frame-runtime -->';
const SAFE_PATH = /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/;
const RESERVED = new Set(['version.json', 'README.md']);

const sha256 = buf => createHash('sha256').update(buf).digest('hex');

async function lookup() {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
    const page = await context.newPage();
    let meta = null;
    page.on('response', async res => {
      if (meta || res.status() !== 200 || !res.url().includes('/api/frame/')) return;
      try {
        const body = await res.json();
        if (body && body.ver && Array.isArray(body.files)) meta = body;
      } catch {}
    });
    await page.goto(ARTIFACT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const host = await page.evaluate(() => document.documentElement.dataset.frameUchost || '');
    for (let i = 0; i < 60 && !meta; i++) await page.waitForTimeout(1000);
    if (!meta) throw new Error('Claude did not return the artifact details (it may be showing a bot check).');
    if (!/^[0-9a-f-]+\.frame\.claudeusercontent\.com$/.test(host)) throw new Error(`Unexpected artifact host: ${host || '(none)'}`);
    return { meta, host };
  } finally {
    await browser.close();
  }
}

async function lookupWithRetry(tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await lookup();
    } catch (err) {
      if (i >= tries) throw err;
      console.warn(`Lookup attempt ${i} failed: ${err.message} Retrying...`);
      await new Promise(r => setTimeout(r, 5000 * i));
    }
  }
}

function stripRuntime(buf) {
  const text = buf.toString('latin1');
  const a = text.indexOf(RUNTIME_START);
  if (a < 0) return buf;
  const b = text.indexOf(RUNTIME_END, a);
  if (b < 0) throw new Error('Found the start of Claude\'s injected runtime but not its end.');
  return Buffer.concat([buf.subarray(0, a), buf.subarray(b + RUNTIME_END.length)]);
}

async function download(host, ver, file) {
  const url = `https://${host}/_f/${ver}/${file.path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${file.path}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (/\.html?$/i.test(file.path)) buf = stripRuntime(buf);
  const got = sha256(buf);
  if (got !== file.sha256) throw new Error(`Checksum mismatch for ${file.path}: expected ${file.sha256}, got ${got}`);
  return buf;
}

function unpackExtension(pkgBuf) {
  const pkg = JSON.parse(pkgBuf.toString('utf8'));
  const dest = join(HUB, 'extension');
  const tmp = mkdtempSync(join(tmpdir(), 'hub-ext-'));
  try {
    const zip = join(tmp, 'ext.zip');
    writeFileSync(zip, Buffer.from(pkg.base64, 'base64'));
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    execFileSync('unzip', ['-q', '-o', zip, '-d', dest], { stdio: 'inherit' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const manifest = JSON.parse(readFileSync(join(dest, 'manifest.json'), 'utf8'));
  if (manifest.name !== 'The Hub') throw new Error(`Extension package is not The Hub (name: ${manifest.name}).`);
  return { version: manifest.version, filename: pkg.filename };
}

const { meta, host } = await lookupWithRetry();
const previous = existsSync(VERSION_FILE) ? JSON.parse(readFileSync(VERSION_FILE, 'utf8')) : null;

for (const f of meta.files) {
  if (!SAFE_PATH.test(f.path) || f.path.split('/').includes('..') || RESERVED.has(f.path) || f.path.startsWith('extension/')) {
    throw new Error(`Refusing unexpected file path from Claude: ${f.path}`);
  }
}

const files = [];
for (const f of meta.files) {
  const buf = await download(host, meta.ver, f);
  const out = join(HUB, f.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  files.push({ path: f.path, size: buf.length, sha256: f.sha256 });
}

const current = new Set(files.map(f => f.path));
for (const old of previous?.files || []) {
  if (!current.has(old.path) && SAFE_PATH.test(old.path) && !old.path.split('/').includes('..')) {
    rmSync(join(HUB, old.path), { force: true });
  }
}

let extension = null;
const pkgPath = join(HUB, EXT_PKG);
if (current.has(EXT_PKG)) extension = unpackExtension(readFileSync(pkgPath));
else rmSync(join(HUB, 'extension'), { recursive: true, force: true });

const version = {
  artifact: ARTIFACT_URL,
  title: meta.title,
  version: meta.ver,
  seq: meta.seq,
  extension,
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
};
writeFileSync(VERSION_FILE, JSON.stringify(version, null, 2) + '\n');

const changed = !previous || previous.version !== version.version;
console.log(`My Hub ${changed ? 'updated to' : 'already at'} version ${version.version} (publish #${version.seq}).`);
if (extension) console.log(`Extension: ${extension.version}`);
