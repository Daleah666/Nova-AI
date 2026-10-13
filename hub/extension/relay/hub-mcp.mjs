#!/usr/bin/env node
// The Hub relay — one small server on THIS computer (127.0.0.1 only) that lets your AI agents
// (Claude Code, Codex, Cursor, anything that speaks MCP) leave messages for each other, share data,
// read your Drive map, and ask your Hub to do things (to-dos, notes, calendar, Drive).
// No installs: it only needs Node 18 or newer, which Claude Code and Codex already use.
//
//   node hub-mcp.mjs            MCP server over stdio. Claude Code / Codex start this for you.
//   node hub-mcp.mjs --serve    Keep the relay running in a window (START-RELAY.bat).
//   node hub-mcp.mjs --code     Show the code you paste into the Hub once.
//   node hub-mcp.mjs --setup    Add the Hub to Claude Code and Codex (asks before each change).
//   node hub-mcp.mjs --remove   Take it back out of Claude Code and Codex.
//
// Safety: it listens on 127.0.0.1 only, refuses web pages, and needs a secret code for every call.
// Board, shared data and the Drive map are stored in ~/.the-hub/relay.json on this computer.
// Calendar, Drive and email changes wait for your OK in the Hub (you can change that in the Hub).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const PORT = Number(process.env.HUB_RELAY_PORT) || 47800;
const HOST = "127.0.0.1";
const HOME = os.homedir();
const DIR = process.env.HUB_HOME || path.join(HOME, ".the-hub");
const SELF = fileURLToPath(import.meta.url);
fs.mkdirSync(DIR, { recursive: true });

function secret(file, prefix) {
  const p = path.join(DIR, file);
  try { const t = fs.readFileSync(p, "utf8").trim(); if (/^[a-z]*-?[a-f0-9]{32,}$/.test(t)) return t; } catch {}
  const t = prefix + crypto.randomBytes(20).toString("hex");
  fs.writeFileSync(p, t, { mode: 0o600 });
  return t;
}
const AGENT_TOKEN = secret("agent-token", "agent-");
const HUB_CODE = secret("hub-code", "hub-");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// ---------------------------------------------------------------- state (only the host process changes it)
const STATE_FILE = path.join(DIR, "relay.json");
function norm(j) {
  j = j && typeof j === "object" ? j : {};
  return {
    board: Array.isArray(j.board) ? j.board : [],
    data: j.data && typeof j.data === "object" && !Array.isArray(j.data) ? j.data : {},
    drivemap: Array.isArray(j.drivemap) ? j.drivemap : [],
    agents: j.agents && typeof j.agents === "object" && !Array.isArray(j.agents) ? j.agents : {},
    policy: ["safe", "ask", "full"].includes(j.policy) ? j.policy : "safe",
    seq: Number(j.seq) || 0,
  };
}
let S = null;
function loadState() { try { S = norm(JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch { S = norm({}); } }
let saveT = null;
function persistNow() { if (!S) return; clearTimeout(saveT); saveT = null; const tmp = STATE_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(S)); fs.renameSync(tmp, STATE_FILE); }
function persist() { clearTimeout(saveT); saveT = setTimeout(() => { try { persistNow(); } catch (e) { log("couldn't save: " + e.message); } }, 250); }
process.on("exit", () => { if (saveT) try { persistNow(); } catch {} });

const log = (m) => process.stderr.write("[the-hub relay] " + m + "\n");
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const cleanName = (n) => clip(String(n || "agent").replace(/[^\w .()-]/g, "").trim() || "agent", 40);
const cleanChannel = (c) => { c = String(c || "general").toLowerCase().replace(/^#/, ""); if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(c)) throw new Error("Channel names use lowercase letters, numbers and dashes, like dev or redz-avatar."); return c; };
const cleanKey = (k) => { k = String(k || "").trim(); if (!k || k.length > 120 || /[\u0000-\u001f]/.test(k)) throw new Error("Keys are 1 to 120 characters, like redz/upload-status."); return k; };
const jsonSize = (v) => Buffer.byteLength(JSON.stringify(v === undefined ? null : v));
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- board
const waiters = new Set();
function touchAgent(name, kind) {
  if (name === "Ditz") return;
  const a = S.agents[name] || (S.agents[name] = { name, kind: kind || "", firstSeen: nowIso(), settings: {} });
  a.lastSeen = nowIso(); if (kind && !a.kind) a.kind = kind;
}
function post(from, channel, text, to) {
  text = String(text || "").trim(); if (!text) throw new Error("Write something to post.");
  const m = { id: ++S.seq, ts: nowIso(), channel: cleanChannel(channel), from, text: clip(text, 8000) };
  if (to) m.to = cleanName(to);
  S.board.push(m); if (S.board.length > 3000) S.board.splice(0, S.board.length - 3000);
  persist();
  for (const w of [...waiters]) if (!w.channel || w.channel === m.channel) { waiters.delete(w); clearTimeout(w.t); w.resolve(); }
  return m;
}
function read(channel, since, limit) {
  let list = S.board;
  if (channel) { const c = cleanChannel(channel); list = list.filter((m) => m.channel === c); }
  if (since) list = list.filter((m) => m.id > Number(since));
  return list.slice(-Math.max(1, Math.min(200, Number(limit) || 30)));
}
function waitFor(channel, since, seconds) {
  const c = channel ? cleanChannel(channel) : null;
  const have = () => read(c, since, 50).filter((m) => m.id > (Number(since) || 0));
  const now = have(); if (now.length) return Promise.resolve(now);
  const ms = Math.max(1, Math.min(50, Number(seconds) || 25)) * 1000;
  return new Promise((resolve) => {
    const w = { channel: c, resolve: () => resolve(have()) };
    w.t = setTimeout(() => { waiters.delete(w); resolve([]); }, ms);
    waiters.add(w);
  });
}

// ---------------------------------------------------------------- requests that need the Hub (or Ditz's OK)
const reqs = new Map();
let lastPull = 0;
const hubOpen = () => Date.now() - lastPull < 9000;
const HUB_ACTIONS = {
  todo_add: "Add a to-do", note_add: "Save a note", todos_list: "Read your to-dos", notify: "Show you a message",
  calendar_list: "Read your calendar", calendar_create: "Add a calendar event",
  drive_search: "Search your Google Drive", drive_save: "Save a file to your Google Drive", gmail_search: "Search your email",
};
const ALWAYS_ASK_SAFE = new Set(["calendar_create", "drive_save", "gmail_search", "local:skills_install", "local:setup_apply"]);
function needsOk(action) {
  if (S.policy === "full") return false;
  if (S.policy === "ask") return true;
  return ALWAYS_ASK_SAFE.has(action);
}
function newReq(action, args, agent, extra) {
  const r = { id: "r" + crypto.randomBytes(5).toString("hex"), action, label: HUB_ACTIONS[action] || extra?.label || action, args, agent, ts: Date.now(),
    needsOk: needsOk(action), status: "queued", deliveredAt: 0, waiters: new Set(), ...extra };
  reqs.set(r.id, r);
  for (const [id, x] of reqs) if (Date.now() - x.ts > 3600000) reqs.delete(id);
  return r;
}
function finish(r, status, result, error) {
  r.status = status; r.result = result; r.error = error; r.doneAt = Date.now();
  for (const w of r.waiters) w(); r.waiters.clear();
}
function waitReq(r, ms) {
  if (r.status !== "queued") return Promise.resolve();
  return new Promise((resolve) => { const done = () => { clearTimeout(t); resolve(); }; const t = setTimeout(() => { r.waiters.delete(done); resolve(); }, ms); r.waiters.add(done); });
}
function reqView(r) { const v = { request_id: r.id, action: r.action, what: r.label, status: r.status }; if (r.status === "done") v.result = r.result; if (r.error) v.error = r.error; return v; }
const NOT_OPEN = "The Hub isn't open in Chrome right now, or the Hub extension isn't connected to this relay. Ask Ditz to open the Hub (Agents tab shows the relay as online), then try again.";
async function hubCall(action, args, agent) {
  if (!hubOpen()) throw new Error(NOT_OPEN);
  const r = newReq(action, args, agent);
  await waitReq(r, r.needsOk ? 45000 : 30000);
  if (r.status === "done") return r.result;
  if (r.status === "denied") throw new Error("Ditz said no to: " + r.label + (r.error ? " (" + r.error + ")" : "") + ".");
  if (r.status === "error") throw new Error(r.error || "The Hub couldn't do that.");
  return { pending: true, request_id: r.id, message: r.needsOk ? "Waiting for Ditz to approve this in the Hub. Keep working on something else and check request_status later." : "The Hub hasn't answered yet. Check request_status in a bit." };
}
async function localApproval(action, label, details, agent, run) {
  if (!needsOk("local:" + action)) return run();
  if (!hubOpen()) throw new Error("This needs Ditz's OK in the Hub, and the Hub isn't open right now. " + NOT_OPEN);
  const r = newReq("local:" + action, details, agent, { label, run });
  await waitReq(r, 60000);
  if (r.status === "done") return r.result;
  if (r.status === "denied") throw new Error("Ditz said no to: " + label + ".");
  if (r.status === "error") throw new Error(r.error);
  return { pending: true, request_id: r.id, message: "Waiting for Ditz to approve this in the Hub. Check request_status later." };
}

// ---------------------------------------------------------------- skills (Claude Code + Codex use the same SKILL.md format)
const SKILL_DIRS = {
  claude: (p) => p ? path.join(p, ".claude", "skills") : path.join(HOME, ".claude", "skills"),
  codex: (p) => p ? path.join(p, ".agents", "skills") : path.join(HOME, ".agents", "skills"),
};
const okSkillName = (n) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(String(n || ""));
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || ""); const out = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const k = /^([A-Za-z_-]+):\s*(.*)$/.exec(line); if (k) out[k[1]] = k[2].replace(/^["']|["']$/g, "").trim(); }
  return out;
}
function installedSkills(projectDir) {
  const out = [];
  const scan = (where, dir) => {
    let names = []; try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return; }
    for (const n of names) { const f = path.join(dir, n, "SKILL.md"); if (!fs.existsSync(f)) continue; const fm = frontmatter(fs.readFileSync(f, "utf8").slice(0, 4000)); out.push({ name: fm.name || n, folder: n, description: clip(fm.description, 300), where, path: path.join(dir, n) }); }
  };
  scan("Claude Code (you)", SKILL_DIRS.claude()); scan("Codex (you)", SKILL_DIRS.codex());
  if (projectDir) { scan("Claude Code (project)", SKILL_DIRS.claude(projectDir)); scan("Codex (project)", SKILL_DIRS.codex(projectDir)); }
  return out;
}
const LIB_REPO = "anthropics/skills", LIB_RAW = "https://raw.githubusercontent.com/" + LIB_REPO + "/main/";
const CACHE = path.join(DIR, "cache"); fs.mkdirSync(CACHE, { recursive: true });
async function getText(url, max) {
  const r = await fetch(url, { headers: { "User-Agent": "the-hub-relay" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("GitHub said " + r.status + " for " + url);
  const b = Buffer.from(await r.arrayBuffer()); if (b.length > (max || 5e6)) throw new Error("File too big: " + url); return b;
}
async function libraryIndex(refresh) {
  const local = process.env.HUB_SKILLS_LOCAL; // a local copy of github.com/anthropics/skills (for offline use)
  const cf = path.join(CACHE, "anthropic-skills.json");
  if (!refresh && !local) { try { const c = JSON.parse(fs.readFileSync(cf, "utf8")); if (Date.now() - c.at < 86400000) return c.skills; } catch {} }
  let files = [];
  if (local) {
    const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else files.push(r); } };
    walk(path.join(local, "skills"), "skills");
  } else {
    const t = JSON.parse((await getText("https://api.github.com/repos/" + LIB_REPO + "/git/trees/main?recursive=1", 2e7)).toString("utf8"));
    files = (t.tree || []).filter((x) => x.type === "blob" && /^skills\/[^/]+\//.test(x.path)).map((x) => x.path);
  }
  const by = {};
  for (const f of files) { const n = f.split("/")[1]; (by[n] = by[n] || []).push(f); }
  const skills = [];
  for (const [name, list] of Object.entries(by)) {
    if (!list.includes("skills/" + name + "/SKILL.md")) continue;
    let description = "";
    try { const md = local ? fs.readFileSync(path.join(local, "skills", name, "SKILL.md"), "utf8") : (await getText(LIB_RAW + "skills/" + name + "/SKILL.md")).toString("utf8"); description = clip(frontmatter(md).description, 300); } catch {}
    skills.push({ name, description, files: list.length, source: "anthropic", link: "https://github.com/" + LIB_REPO + "/tree/main/skills/" + name, _files: list });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  if (!local) fs.writeFileSync(cf, JSON.stringify({ at: Date.now(), skills }));
  return skills;
}
async function libraryFile(rel) {
  const local = process.env.HUB_SKILLS_LOCAL;
  if (local) return fs.readFileSync(path.join(local, ...rel.split("/")));
  return getText(LIB_RAW + rel.split("/").map(encodeURIComponent).join("/"));
}
function safeJoin(base, rel) { const p = path.resolve(base, rel); if (!p.startsWith(path.resolve(base) + path.sep)) throw new Error("Bad path in skill: " + rel); return p; }
async function skillsInstall(args, agent) {
  const name = String(args.name || ""); if (!okSkillName(name)) throw new Error("That's not a skill name. Use skills_list to see them.");
  const to = ["claude", "codex", "both"].includes(args.to) ? args.to : "both";
  const project = args.project_dir ? path.resolve(String(args.project_dir)) : null;
  const source = args.source === "installed" ? "installed" : "anthropic";
  let files = []; // [{rel, get()}]
  if (source === "anthropic") {
    const s = (await libraryIndex()).find((x) => x.name === name); if (!s) throw new Error("No skill called " + name + " in Anthropic's library.");
    files = s._files.map((f) => ({ rel: f.slice(("skills/" + name + "/").length), get: () => libraryFile(f) }));
  } else {
    const s = installedSkills(project).find((x) => x.name === name || x.folder === name); if (!s) throw new Error("No installed skill called " + name + ".");
    const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else files.push({ rel: r, get: () => fs.readFileSync(path.join(d, e.name)) }); } };
    walk(s.path, "");
  }
  if (!files.length || files.length > 400) throw new Error("That skill looks empty or too big.");
  const targets = (to === "both" ? ["claude", "codex"] : [to]).map((k) => path.join(SKILL_DIRS[k](project), name));
  const plan = targets.map((t) => ({ path: t, exists: fs.existsSync(t) }));
  if (plan.some((p) => p.exists) && !args.overwrite) throw new Error("Already installed at " + plan.filter((p) => p.exists).map((p) => p.path).join(", ") + ". Pass overwrite: true to replace it.");
  const details = { skill: name, from: source === "anthropic" ? "Anthropic's skills library (github.com/anthropics/skills)" : "your installed skills", files: files.length, into: targets };
  return localApproval("skills_install", "Install the " + name + " skill", details, agent, async () => {
    let total = 0; const bufs = [];
    for (const f of files) { const b = await f.get(); total += b.length; if (total > 3e7) throw new Error("Skill is over 30 MB, stopped."); bufs.push([f.rel, b]); }
    for (const t of targets) { for (const [rel, b] of bufs) { const p = safeJoin(t, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); } }
    return { installed: name, into: targets, files: bufs.length, note: "Restart Claude Code / Codex (or start a new session) so they pick it up." };
  });
}

// ---------------------------------------------------------------- Claude Code <-> Codex setup translation
function tomlStr(s) { return JSON.stringify(String(s)); }
function tomlKey(k) { return /^[A-Za-z0-9_-]+$/.test(k) ? k : tomlStr(k); }
function tomlValue(v) {
  if (Array.isArray(v)) return "[" + v.map((x) => tomlStr(x)).join(", ") + "]";
  if (v && typeof v === "object") return "{ " + Object.entries(v).map(([k, x]) => tomlKey(k) + " = " + tomlStr(x)).join(", ") + " }";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return tomlStr(v);
}
function parseTomlValue(s) {
  s = s.trim();
  if (s.startsWith('"')) { let out = "", i = 1; for (; i < s.length; i++) { const c = s[i]; if (c === "\\") { const n = s[++i]; out += n === "n" ? "\n" : n === "t" ? "\t" : n === "u" ? String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)) + ((i += 4), "") : n; } else if (c === '"') break; else out += c; } return out; }
  if (s.startsWith("'")) return s.slice(1, s.indexOf("'", 1));
  if (s.startsWith("[")) { const out = []; const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g; let m; while ((m = re.exec(s))) out.push(m[1] != null ? parseTomlValue('"' + m[1] + '"') : m[2]); return out; }
  if (s.startsWith("{")) { const out = {}; const re = /("?[\w.-]+"?)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/g; let m; while ((m = re.exec(s))) out[m[1].replace(/"/g, "")] = parseTomlValue(m[2]); return out; }
  if (s === "true" || s === "false") return s === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
function readCodexServers(text) {
  const servers = {}; let cur = null, sub = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/^\s+/, ""); if (!line || line.startsWith("#")) continue;
    const t = /^\[\s*mcp_servers\.("?[^\]."]+"?)(?:\.(env|http_headers))?\s*\]/.exec(line);
    if (t) { cur = t[1].replace(/"/g, ""); sub = t[2] || null; servers[cur] = servers[cur] || {}; continue; }
    if (line.startsWith("[")) { cur = null; continue; }
    if (!cur) continue;
    const kv = /^("?[\w.-]+"?)\s*=\s*(.+)$/.exec(line); if (!kv) continue;
    const k = kv[1].replace(/"/g, ""), v = parseTomlValue(kv[2].replace(/\s+#.*$/, ""));
    if (sub) (servers[cur][sub] = servers[cur][sub] || {})[k] = v; else servers[cur][k] = v;
  }
  return servers;
}
function codexBlock(name, s) {
  let out = "\n[mcp_servers." + tomlKey(name) + "]\n";
  if (s.url) { out += "url = " + tomlStr(s.url) + "\n"; if (s.headers && Object.keys(s.headers).length) out += "http_headers = " + tomlValue(s.headers) + "\n"; }
  else { out += "command = " + tomlStr(s.command) + "\n"; if (s.args && s.args.length) out += "args = " + tomlValue(s.args) + "\n"; if (s.cwd) out += "cwd = " + tomlStr(s.cwd) + "\n"; if (s.env && Object.keys(s.env).length) out += "env = " + tomlValue(s.env) + "\n"; }
  return out;
}
function readIf(p, max) { try { const st = fs.statSync(p); if (!st.isFile() || st.size > (max || 2e6)) return null; return fs.readFileSync(p, "utf8"); } catch { return null; } }
function listDirs(d) { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } }
function copyTreePlan(src, dst, plan, note) {
  const walk = (s, d) => { for (const e of fs.readdirSync(s, { withFileTypes: true })) { const a = path.join(s, e.name), b = path.join(d, e.name); if (e.isDirectory()) walk(a, b); else plan.push({ action: "create", path: b, from: a, note }); } };
  walk(src, dst);
}
function convertPlan(projectDir, from, to) {
  const p = path.resolve(String(projectDir || "")); if (!projectDir || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error("Give project_dir: the full path of a project folder that exists.");
  if (!((from === "claude" && to === "codex") || (from === "codex" && to === "claude"))) throw new Error("from/to must be claude→codex or codex→claude.");
  const plan = [];
  if (from === "claude") {
    const cm = readIf(path.join(p, "CLAUDE.md"));
    if (cm != null) {
      if (fs.existsSync(path.join(p, "AGENTS.md"))) plan.push({ action: "skip", path: path.join(p, "AGENTS.md"), note: "AGENTS.md already exists, left alone." });
      else {
        // Codex doesn't follow @imports, so pull imported files inline.
        const body = cm.replace(/^@(\S+)\s*$/gm, (m, f) => { const t = readIf(path.resolve(p, f.replace(/^~(?=\/|\\)/, HOME)), 200000); return t == null ? m : "<!-- from " + f + " -->\n" + t; });
        plan.push({ action: "create", path: path.join(p, "AGENTS.md"), content: "<!-- Made from CLAUDE.md by The Hub relay. Codex reads AGENTS.md. -->\n" + body, note: "Codex's version of CLAUDE.md" });
      }
    }
    let mcp = null; try { mcp = JSON.parse(readIf(path.join(p, ".mcp.json")) || "null"); } catch { plan.push({ action: "skip", path: path.join(p, ".mcp.json"), note: "Couldn't read .mcp.json (not valid JSON)." }); }
    if (mcp && mcp.mcpServers) {
      const tf = path.join(p, ".codex", "config.toml"), have = readCodexServers(readIf(tf) || ""); let add = "";
      for (const [n, s] of Object.entries(mcp.mcpServers)) {
        if (have[n]) { plan.push({ action: "skip", path: tf, note: "MCP server " + n + " is already in Codex's config." }); continue; }
        if (s.type === "sse") { plan.push({ action: "skip", path: tf, note: "MCP server " + n + " uses SSE, which Codex doesn't support. Ask its maker for a streamable HTTP URL." }); continue; }
        add += codexBlock(n, s);
      }
      if (add) plan.push({ action: fs.existsSync(tf) ? "append" : "create", path: tf, content: (fs.existsSync(tf) ? "" : "# Codex project settings (made by The Hub relay from .mcp.json)\n") + add, note: "MCP servers for Codex. Codex only reads project config in trusted projects." });
    }
    const sk = SKILL_DIRS.claude(p), sk2 = SKILL_DIRS.codex(p);
    for (const n of listDirs(sk)) { if (fs.existsSync(path.join(sk2, n))) plan.push({ action: "skip", path: path.join(sk2, n), note: "Skill " + n + " already there." }); else copyTreePlan(path.join(sk, n), path.join(sk2, n), plan, "skill " + n); }
    const cmdDir = path.join(p, ".claude", "commands");
    let cmds = []; try { cmds = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md")); } catch {}
    for (const f of cmds) {
      const name = f.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-"); const dst = path.join(sk2, name, "SKILL.md");
      if (fs.existsSync(path.dirname(dst))) { plan.push({ action: "skip", path: dst, note: "A skill called " + name + " already exists." }); continue; }
      const t = readIf(path.join(cmdDir, f)) || ""; const fm = frontmatter(t); const body = t.replace(/^---[\s\S]*?---\r?\n?/, "");
      const desc = fm.description || ("Run the /" + name + " routine (converted from a Claude Code command). " + clip(body.split(/\r?\n/).find((l) => l.trim()) || "", 120));
      plan.push({ action: "create", path: dst, content: "---\nname: " + name + "\ndescription: " + desc.replace(/\n/g, " ") + "\n---\n\n" + body.replace(/\$ARGUMENTS/g, "(whatever the user asked for)"), note: "Claude Code command /" + name + " as a Codex skill" });
    }
  } else {
    const am = readIf(path.join(p, "AGENTS.md"));
    if (am != null) {
      if (fs.existsSync(path.join(p, "CLAUDE.md"))) plan.push({ action: "skip", path: path.join(p, "CLAUDE.md"), note: "CLAUDE.md already exists, left alone. Add a line @AGENTS.md to it to share the same rules." });
      else plan.push({ action: "create", path: path.join(p, "CLAUDE.md"), content: "<!-- Made by The Hub relay: Claude Code reads this file, and the line below pulls in Codex's AGENTS.md so both share one set of rules. -->\n@AGENTS.md\n", note: "Claude Code reads AGENTS.md through an import, so you keep one file" });
    }
    const tf = path.join(p, ".codex", "config.toml"), servers = readCodexServers(readIf(tf) || "");
    if (Object.keys(servers).length) {
      const mf = path.join(p, ".mcp.json"); let mcp = { mcpServers: {} }; try { const j = JSON.parse(readIf(mf) || "null"); if (j && j.mcpServers) mcp = j; } catch {}
      let added = 0;
      for (const [n, s] of Object.entries(servers)) {
        if (mcp.mcpServers[n]) { plan.push({ action: "skip", path: mf, note: "MCP server " + n + " is already in .mcp.json." }); continue; }
        mcp.mcpServers[n] = s.url ? { type: "http", url: s.url, ...(s.http_headers ? { headers: s.http_headers } : {}) } : { command: s.command, args: s.args || [], ...(s.env ? { env: s.env } : {}), ...(s.cwd ? { cwd: s.cwd } : {}) };
        if (s.bearer_token_env_var) mcp.mcpServers[n].headers = { ...(mcp.mcpServers[n].headers || {}), Authorization: "Bearer ${" + s.bearer_token_env_var + "}" };
        added++;
      }
      if (added) plan.push({ action: fs.existsSync(mf) ? "replace" : "create", path: mf, content: JSON.stringify(mcp, null, 2) + "\n", note: added + " MCP server(s) for Claude Code" });
    }
    const sk = SKILL_DIRS.codex(p), sk2 = SKILL_DIRS.claude(p);
    for (const n of listDirs(sk)) { if (fs.existsSync(path.join(sk2, n))) plan.push({ action: "skip", path: path.join(sk2, n), note: "Skill " + n + " already there." }); else copyTreePlan(path.join(sk, n), path.join(sk2, n), plan, "skill " + n); }
  }
  if (!plan.length) plan.push({ action: "skip", path: p, note: "Nothing to convert: no " + (from === "claude" ? "CLAUDE.md, .mcp.json, .claude/skills or .claude/commands" : "AGENTS.md, .codex/config.toml or .agents/skills") + " here." });
  return plan;
}
function applyPlan(plan) {
  const done = [];
  for (const s of plan) {
    if (s.action === "skip") continue;
    fs.mkdirSync(path.dirname(s.path), { recursive: true });
    if (s.from) fs.copyFileSync(s.from, s.path);
    else if (s.action === "append") fs.appendFileSync(s.path, s.content);
    else fs.writeFileSync(s.path, s.content);
    done.push(s.action + " " + s.path);
  }
  return done;
}
const planView = (plan) => plan.map((s) => ({ action: s.action, path: s.path, note: s.note || "", ...(s.content != null ? { bytes: Buffer.byteLength(s.content), preview: clip(s.content, 400) } : {}) }));

// ---------------------------------------------------------------- one entry point for every operation
async function handle(op, a, who) {
  a = a && typeof a === "object" ? a : {};
  const agent = who.name;
  if (who.role === "agent") touchAgent(agent, a._kind);
  const hubOnly = () => { if (who.role !== "hub") throw new Error("Only the Hub can do that."); };
  switch (op) {
    case "status": return { relay: "online", version: VERSION, hub_open: hubOpen(), policy: S.policy, you: agent,
      agents: Object.values(S.agents).map((x) => ({ name: x.name, kind: x.kind, last_seen: x.lastSeen })), channels: [...new Set(S.board.map((m) => m.channel))], last_message_id: S.seq,
      data_keys: Object.keys(S.data).length, drive_map_entries: S.drivemap.length, waiting_for_ok: [...reqs.values()].filter((r) => r.needsOk && r.status === "queued").length };
    case "board.post": return post(who.role === "hub" ? "Ditz" : agent, a.channel, a.text, a.to);
    case "board.read": return read(a.channel, a.since_id, a.limit);
    case "board.wait": return waitFor(a.channel, a.since_id, a.timeout_s);
    case "agent.settings": {
      const me = S.agents[agent] || (touchAgent(agent), S.agents[agent]);
      if (a.settings !== undefined) { if (!a.settings || typeof a.settings !== "object" || Array.isArray(a.settings)) throw new Error("settings must be an object."); if (jsonSize(a.settings) > 50000) throw new Error("Settings are limited to 50 KB."); me.settings = a.settings; persist(); }
      return { name: me.name, settings: me.settings || {} };
    }
    case "data.set": {
      const k = cleanKey(a.key); if (a.value === undefined) throw new Error("Give a value.");
      if (jsonSize(a.value) > 200000) throw new Error("Values are limited to 200 KB. Put big things in a file and store its path.");
      const total = Object.values(S.data).reduce((t, x) => t + jsonSize(x.value), 0); if (total > 1e7) throw new Error("The shared data store is full (10 MB). Delete old keys first.");
      S.data[k] = { value: a.value, note: clip(a.note, 300), by: who.role === "hub" ? "Ditz" : agent, ts: nowIso() }; persist(); return { saved: k };
    }
    case "data.get": { const k = cleanKey(a.key); const x = S.data[k]; if (!x) throw new Error("Nothing saved under " + k + ". data_list shows what's there."); return { key: k, ...x }; }
    case "data.list": { const pre = String(a.prefix || ""); return Object.entries(S.data).filter(([k]) => k.startsWith(pre)).map(([k, x]) => ({ key: k, note: x.note, by: x.by, ts: x.ts, size: jsonSize(x.value) })); }
    case "data.delete": { const k = cleanKey(a.key); const had = k in S.data; delete S.data[k]; persist(); return { deleted: had ? k : null }; }
    case "drivemap.get": return S.drivemap;
    case "drivemap.set": {
      const e = a.entry || a; const name = clip(e.name, 200).trim(); if (!name) throw new Error("Give the folder or file a name.");
      const entry = { id: e.id ? clip(e.id, 40) : "m" + crypto.randomBytes(4).toString("hex"), name, kind: e.kind === "file" ? "file" : "folder", drive_id: clip(e.drive_id, 120), link: /^https:\/\//.test(e.link || "") ? clip(e.link, 500) : "", account: clip(e.account, 120), purpose: clip(e.purpose, 600), rules: clip(e.rules, 1200), by: who.role === "hub" ? "Ditz" : agent, ts: nowIso() };
      const i = S.drivemap.findIndex((x) => x.id === entry.id); if (i >= 0) S.drivemap[i] = entry; else { if (S.drivemap.length >= 500) throw new Error("The Drive map is full (500 entries)."); S.drivemap.push(entry); }
      persist(); return entry;
    }
    case "drivemap.remove": { const i = S.drivemap.findIndex((x) => x.id === a.id); if (i < 0) throw new Error("No map entry with that id."); const [x] = S.drivemap.splice(i, 1); persist(); return { removed: x.name }; }
    case "hub": { const act = String(a.action || ""); if (!HUB_ACTIONS[act]) throw new Error("Unknown Hub action."); return hubCall(act, a.args || {}, agent); }
    case "request.status": { const r = reqs.get(String(a.request_id || "")); if (!r) throw new Error("No request with that id (they're kept for an hour)."); return reqView(r); }
    case "skills.list": {
      const src = a.source || "all", out = {};
      if (src === "installed" || src === "all") out.installed = installedSkills(a.project_dir ? path.resolve(String(a.project_dir)) : null).map(({ path: p, ...x }) => ({ ...x, path: p }));
      if (src === "anthropic" || src === "all") { try { out.anthropic_library = (await libraryIndex(!!a.refresh)).map(({ _files, ...x }) => x); } catch (e) { out.anthropic_library_error = "Couldn't reach GitHub: " + e.message; } }
      return out;
    }
    case "skills.get": {
      const name = String(a.name || ""); if (!okSkillName(name)) throw new Error("Bad skill name.");
      if (a.source !== "anthropic") { const s = installedSkills(a.project_dir ? path.resolve(String(a.project_dir)) : null).find((x) => x.name === name || x.folder === name); if (s) return { name, where: s.where, path: s.path, skill_md: readIf(path.join(s.path, "SKILL.md"), 500000) }; if (a.source === "installed") throw new Error("Not installed."); }
      const s = (await libraryIndex()).find((x) => x.name === name); if (!s) throw new Error("No skill called " + name + ".");
      return { name, source: "anthropic", link: s.link, files: s._files.map((f) => f.slice(("skills/" + name + "/").length)), skill_md: (await libraryFile("skills/" + name + "/SKILL.md")).toString("utf8") };
    }
    case "skills.install": return skillsInstall(a, agent);
    case "setup.convert": {
      const plan = convertPlan(a.project_dir, a.from, a.to);
      if (!a.apply) return { preview: planView(plan), next: "Looks right? Call convert_setup again with apply: true. Ditz approves it in the Hub." };
      if (!plan.some((s) => s.action !== "skip")) return { preview: planView(plan), done: [] };
      return localApproval("setup_apply", "Convert " + (a.from === "claude" ? "Claude Code → Codex" : "Codex → Claude Code") + " setup in " + path.basename(path.resolve(String(a.project_dir))), { project: path.resolve(String(a.project_dir)), changes: planView(plan).filter((s) => s.action !== "skip").map((s) => s.action + " " + s.path) }, agent, async () => ({ done: applyPlan(plan) }));
    }
    // ---- only the Hub page (through the extension) uses these
    case "hub.pull": {
      hubOnly(); lastPull = Date.now();
      const out = [];
      for (const r of reqs.values()) if (r.status === "queued" && !r.needsOk && !r.action.startsWith("local:") && Date.now() - r.deliveredAt > 20000) { r.deliveredAt = Date.now(); out.push({ id: r.id, action: r.action, args: r.args, agent: r.agent }); }
      return { requests: out, waiting_for_ok: [...reqs.values()].filter((r) => r.needsOk && r.status === "queued").length };
    }
    case "hub.reply": {
      hubOnly(); const r = reqs.get(String(a.id || "")); if (!r || r.status !== "queued") return { ignored: true };
      if (a.denied) { finish(r, "denied", null, clip(a.reason, 200)); return { ok: true }; }
      if (r.action.startsWith("local:")) { if (!a.approved) { finish(r, "denied"); return { ok: true }; } try { finish(r, "done", await r.run()); } catch (e) { finish(r, "error", null, e.message); } return { ok: true, status: r.status, error: r.error }; }
      if (a.error) finish(r, "error", null, clip(a.error, 500)); else finish(r, "done", a.result === undefined ? "done" : a.result);
      return { ok: true };
    }
    case "state": {
      hubOnly(); lastPull = Date.now();
      return { version: VERSION, policy: S.policy, board: S.board.slice(-300), agents: Object.values(S.agents), data: Object.entries(S.data).map(([k, x]) => ({ key: k, value: jsonSize(x.value) > 4000 ? "(" + jsonSize(x.value) + " bytes)" : x.value, note: x.note, by: x.by, ts: x.ts })),
        drivemap: S.drivemap, approvals: [...reqs.values()].filter((r) => r.needsOk && r.status === "queued").map((r) => ({ id: r.id, action: r.action, what: r.label, agent: r.agent, args: r.args, ts: r.ts })) };
    }
    case "policy.set": hubOnly(); if (!["safe", "ask", "full"].includes(a.policy)) throw new Error("policy is safe, ask or full."); S.policy = a.policy; persist(); return { policy: S.policy };
    case "agent.settings_set": hubOnly(); { const x = S.agents[cleanName(a.name)]; if (!x) throw new Error("No such agent."); if (!a.settings || typeof a.settings !== "object") throw new Error("settings must be an object."); x.settings = a.settings; persist(); return x; }
    case "agent.forget": hubOnly(); delete S.agents[cleanName(a.name)]; persist(); return { ok: true };
    case "board.clear": hubOnly(); { const c = a.channel ? cleanChannel(a.channel) : null; S.board = c ? S.board.filter((m) => m.channel !== c) : []; persist(); return { ok: true }; }
    default: throw new Error("Unknown operation " + op);
  }
}

// ---------------------------------------------------------------- MCP tools
const T = (name, description, props, required, run) => ({ name, description, inputSchema: { type: "object", properties: props, required: required || [], additionalProperties: false }, run });
const str = (d) => ({ type: "string", description: d }), num = (d) => ({ type: "number", description: d }), bool = (d) => ({ type: "boolean", description: d });
const TOOLS = [
  T("hub_status", "Start here. Shows whether Ditz's Hub is open, the approval policy, which agents are around, the board channels and the newest message id.", {}, [], (a, c) => c("status", {})),
  T("board_post", "Post a message on the shared agent board so other agents (and Ditz, in her Hub) can see it. Use it to say what you're starting, hand work to another agent, or report results.", { text: str("The message. Plain text or Markdown."), channel: str("Channel, like general, dev, redz-avatar. Default general."), to: str("Optional: the agent this is for, like Codex or Claude Code.") }, ["text"], (a, c) => c("board.post", a)),
  T("board_read", "Read recent messages from the agent board.", { channel: str("Only this channel. Leave out for all."), since_id: num("Only messages newer than this id."), limit: num("How many, up to 200. Default 30.") }, [], (a, c) => c("board.read", a)),
  T("board_wait", "Wait (up to 50 seconds) for new board messages, then return them. Use to touch base with another agent that's working at the same time.", { channel: str("Only this channel."), since_id: num("Return messages newer than this id. Use the newest id you've seen."), timeout_s: num("Seconds to wait, 1 to 50. Default 25.") }, [], (a, c) => c("board.wait", a)),
  T("agent_settings", "Get, or replace, your own saved settings (an object up to 50 KB) so you remember preferences between sessions. Leave settings out to read them.", { settings: { type: "object", description: "Your new settings object." } }, [], (a, c) => c("agent.settings", a)),
  T("data_set", "Save a value in the shared data store every agent can read (up to 200 KB per value). Good for status, decisions, paths, small lists.", { key: str("Like redz/upload-status. Use slashes to group."), value: { description: "Any JSON value." }, note: str("Optional: what this is for.") }, ["key", "value"], (a, c) => c("data.set", a)),
  T("data_get", "Read a value from the shared data store.", { key: str("The key.") }, ["key"], (a, c) => c("data.get", a)),
  T("data_list", "List keys in the shared data store (with notes, who saved them, and when).", { prefix: str("Only keys starting with this.") }, [], (a, c) => c("data.list", a)),
  T("data_delete", "Delete a key from the shared data store.", { key: str("The key.") }, ["key"], (a, c) => c("data.delete", a)),
  T("drive_map", "Ditz's map of her Google Drive: which folders and files exist, what each is for, and rules for where new things go. Read it before saving or organizing files. action get reads it; set adds or updates one entry; remove deletes one.", { action: { type: "string", enum: ["get", "set", "remove"] }, entry: { type: "object", description: "For set: { id? (to update), name, kind: folder|file, drive_id?, link?, account? (which Google account), purpose, rules? }", properties: { id: str(""), name: str(""), kind: str(""), drive_id: str(""), link: str(""), account: str(""), purpose: str(""), rules: str("") } }, id: str("For remove: the entry id.") }, ["action"], (a, c) => a.action === "set" ? c("drivemap.set", { entry: a.entry || {} }) : a.action === "remove" ? c("drivemap.remove", { id: a.id }) : c("drivemap.get", {})),
  T("hub_add_todo", "Add a to-do to Ditz's Hub.", { text: str("The task, short.") }, ["text"], (a, c) => c("hub", { action: "todo_add", args: a })),
  T("hub_add_note", "Save a note in Ditz's Hub notes (first line is the title).", { text: str("The note.") }, ["text"], (a, c) => c("hub", { action: "note_add", args: a })),
  T("hub_list_todos", "Read Ditz's open to-dos from her Hub.", {}, [], (a, c) => c("hub", { action: "todos_list", args: {} })),
  T("hub_notify", "Pop a short message up in Ditz's Hub, like 'Render finished' or 'I need your answer on the board'.", { text: str("Up to 300 characters.") }, ["text"], (a, c) => c("hub", { action: "notify", args: a })),
  T("calendar_list", "Read Ditz's Google Calendar events for the next days (through her Hub).", { days: num("How many days ahead, 1 to 31. Default 7.") }, [], (a, c) => c("hub", { action: "calendar_list", args: a })),
  T("calendar_create", "Add an event to Ditz's Google Calendar. Usually waits for her OK in the Hub.", { summary: str("Title."), start: str("Local time, like 2026-10-12T15:00"), end: str("Local time, like 2026-10-12T16:00"), location: str("Optional."), description: str("Optional.") }, ["summary", "start", "end"], (a, c) => c("hub", { action: "calendar_create", args: a })),
  T("drive_search", "Search Ditz's Google Drive (through her Hub). Plain words search file names; Drive query syntax also works (title contains 'x', mimeType = 'application/vnd.google-apps.folder', parentId = 'ID').", { query: str("What to look for.") }, ["query"], (a, c) => c("hub", { action: "drive_search", args: a })),
  T("drive_save_file", "Save a text file into Ditz's Google Drive. Waits for her OK in the Hub. Check drive_map first for the right folder.", { name: str("File name."), content: str("Text content, up to 1 MB."), folder_id: str("Drive folder id (from drive_map or drive_search)."), mime: str("Default text/plain. text/markdown and text/csv also work.") }, ["name", "content"], (a, c) => c("hub", { action: "drive_save", args: a })),
  T("gmail_search", "Search Ditz's Gmail (Gmail search syntax). Waits for her OK in the Hub.", { query: str("Like from:someone newer_than:7d") }, ["query"], (a, c) => c("hub", { action: "gmail_search", args: a })),
  T("request_status", "Check on something that was waiting for Ditz's OK or for the Hub.", { request_id: str("The id you got back.") }, ["request_id"], (a, c) => c("request.status", a)),
  T("skills_list", "List agent skills: the ones installed for Claude Code (~/.claude/skills) and Codex (~/.agents/skills), plus Anthropic's public skills library (github.com/anthropics/skills). Both tools use the same SKILL.md format.", { source: { type: "string", enum: ["all", "installed", "anthropic"] }, project_dir: str("Also look in this project's .claude/skills and .agents/skills."), refresh: bool("Re-download the library list.") }, [], (a, c) => c("skills.list", a)),
  T("skills_get", "Read a skill's SKILL.md (installed, or from Anthropic's library) so you can follow it right now.", { name: str("Skill name."), source: { type: "string", enum: ["any", "installed", "anthropic"] }, project_dir: str("Optional project folder.") }, ["name"], (a, c) => c("skills.get", a)),
  T("skills_install", "Install a skill for Claude Code, Codex, or both. From Anthropic's library, or copy one you already have from one tool to the other. Waits for Ditz's OK in the Hub.", { name: str("Skill name."), to: { type: "string", enum: ["claude", "codex", "both"] }, source: { type: "string", enum: ["anthropic", "installed"] }, project_dir: str("Install into this project instead of for Ditz's whole account."), overwrite: bool("Replace if it's already there.") }, ["name", "to"], (a, c) => c("skills.install", a)),
  T("convert_setup", "Translate a project's agent setup between Claude Code and Codex: CLAUDE.md ⇄ AGENTS.md, .mcp.json ⇄ .codex/config.toml MCP servers, .claude/skills ⇄ .agents/skills, and Claude Code commands → Codex skills. Without apply it only shows what it would do. With apply it waits for Ditz's OK.", { project_dir: str("Full path to the project folder."), from: { type: "string", enum: ["claude", "codex"] }, to: { type: "string", enum: ["claude", "codex"] }, apply: bool("Actually write the files.") }, ["project_dir", "from", "to"], (a, c) => c("setup.convert", a)),
];
const INSTRUCTIONS = "This is The Hub relay: Ditz's shared space for her AI agents on this computer. It has a message board (talk to other agents and to Ditz), a shared data store, settings you can keep for yourself, a map of her Google Drive, her skills, and actions in her Hub (to-dos, notes, calendar, Drive, email). Start with hub_status and board_read. Post a short note on the board when you start something and a summary when you finish. Some actions wait for Ditz's OK in her Hub; if you get pending back, carry on with other work and check request_status later. Never put passwords or API keys on the board or in shared data.";

// ---------------------------------------------------------------- talking to the host relay (or being it)
let isHost = false, server = null, clientName = cleanName(process.env.HUB_AGENT_NAME || "agent"), clientKind = "";
function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((q, s) => onHttp(q, s).catch((e) => { try { send(s, 500, { ok: false, error: e.message }); } catch {} }));
    srv.once("error", reject);
    srv.listen(PORT, HOST, () => { srv.removeListener("error", reject); srv.on("error", (e) => log("server error: " + e.message)); resolve(srv); });
  });
}
async function becomeHost() {
  try { server = await startServer(); } catch (e) { if (e.code === "EADDRINUSE") return false; throw e; }
  isHost = true; loadState(); log("relay running on http://" + HOST + ":" + PORT); return true;
}
function apiRequest(op, args, ms) {
  const body = JSON.stringify({ op, args, agent: clientName });
  return new Promise((resolve, reject) => {
    const q = http.request({ host: HOST, port: PORT, path: "/api", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Authorization: "Bearer " + AGENT_TOKEN } }, (s) => {
      let d = ""; s.setEncoding("utf8"); s.on("data", (c) => (d += c)); s.on("end", () => { try { const j = JSON.parse(d); j.ok ? resolve(j.result) : reject(new Error(j.error || "relay error")); } catch { reject(new Error("The relay sent back something odd (is another program using port " + PORT + "?).")); } });
    });
    q.on("error", reject); q.setTimeout(ms || 75000, () => q.destroy(Object.assign(new Error("The relay took too long."), { code: "ETIMEDOUT" })));
    q.end(body);
  });
}
async function call(op, args) {
  args = { ...(args || {}), _kind: clientKind };
  if (isHost) return handle(op, args, { role: "agent", name: clientName });
  try { return await apiRequest(op, args); }
  catch (e) {
    if (e.code === "ECONNREFUSED" || e.code === "ECONNRESET") { if (await becomeHost()) return handle(op, args, { role: "agent", name: clientName }); return apiRequest(op, args); }
    throw e;
  }
}

// ---------------------------------------------------------------- HTTP (the extension, and agents that prefer an HTTP MCP url)
function send(res, code, obj, extra) { const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b), "Cache-Control": "no-store", ...(extra || {}) }); res.end(b); }
function readBody(req, max) { return new Promise((resolve, reject) => { let n = 0; const parts = []; req.on("data", (c) => { n += c.length; if (n > max) { reject(new Error("too big")); req.destroy(); } else parts.push(c); }); req.on("end", () => resolve(Buffer.concat(parts).toString("utf8"))); req.on("error", reject); }); }
async function onHttp(req, res) {
  const host = String(req.headers.host || "");
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(res, 403, { ok: false, error: "Wrong host." }); // blocks DNS-rebinding tricks
  const origin = req.headers.origin;
  if (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return send(res, 403, { ok: false, error: "Web pages can't use the relay." });
  const url = (req.url || "").split("?")[0];
  if (req.method === "GET" && url === "/health") return send(res, 200, { ok: true, app: "the-hub-relay", version: VERSION });
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const role = tok && safeEq(tok, HUB_CODE) ? "hub" : tok && safeEq(tok, AGENT_TOKEN) ? "agent" : null;
  if (!role) return send(res, 401, { ok: false, error: "Wrong or missing relay code." });
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Use POST." }, { Allow: "POST" });
  let body; try { body = JSON.parse((await readBody(req, 4e6)) || "null"); } catch { return send(res, 400, { ok: false, error: "Send JSON." }); }
  if (url === "/api") {
    const name = role === "hub" ? "Ditz" : cleanName(body && body.agent || req.headers["x-hub-agent"]);
    try { return send(res, 200, { ok: true, result: await handle(String(body && body.op || ""), body && body.args, { role, name }) }); }
    catch (e) { return send(res, 200, { ok: false, error: e.message }); }
  }
  if (url === "/mcp") {
    if (role !== "agent") return send(res, 403, { ok: false, error: "Agents only." });
    const name = cleanName(req.headers["x-hub-agent"] || "HTTP agent");
    const one = async (m) => rpc(m, (op, args) => handle(op, args, { role: "agent", name }), () => {});
    if (Array.isArray(body)) { const out = (await Promise.all(body.map(one))).filter(Boolean); return out.length ? send(res, 200, out) : (res.writeHead(202), res.end()); }
    const out = await one(body); if (!out) { res.writeHead(202); return res.end(); }
    return send(res, 200, out);
  }
  return send(res, 404, { ok: false, error: "Not here." });
}

// ---------------------------------------------------------------- MCP JSON-RPC
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
async function rpc(m, doCall, onClient) {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return m && m.id != null ? { jsonrpc: "2.0", id: m.id, error: { code: -32600, message: "Invalid request" } } : null;
  const isNote = m.id === undefined || m.id === null;
  const ok = (result) => (isNote ? null : { jsonrpc: "2.0", id: m.id, result });
  const err = (code, message) => (isNote ? null : { jsonrpc: "2.0", id: m.id, error: { code, message } });
  switch (m.method) {
    case "initialize": {
      const p = m.params || {}; const ci = p.clientInfo || {};
      onClient(ci.name || "");
      const v = PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOLS[1];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "the-hub", title: "The Hub relay", version: VERSION }, instructions: INSTRUCTIONS });
    }
    case "notifications/initialized": case "notifications/cancelled": return null;
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
    case "tools/call": {
      const p = m.params || {}; const t = TOOLS.find((x) => x.name === p.name);
      if (!t) return err(-32602, "Unknown tool: " + p.name);
      try {
        // stdio: through the host relay (or become it); HTTP: straight to this host with the caller's name
        const r = await t.run(p.arguments || {}, doCall || call);
        return ok({ content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r, null, 2) }] });
      } catch (e) { return ok({ content: [{ type: "text", text: "Error: " + e.message }], isError: true }); }
    }
    default: return isNote ? null : err(-32601, "Method not found: " + m.method);
  }
}

// ---------------------------------------------------------------- stdio MCP server (what Claude Code / Codex run)
const FRIENDLY = [[/claude[- ]?code|^claude/i, "Claude Code"], [/codex/i, "Codex"], [/cursor/i, "Cursor"], [/windsurf|codeium/i, "Windsurf"], [/gemini/i, "Gemini CLI"], [/vscode|copilot/i, "VS Code"], [/inspector/i, "MCP Inspector"]];
async function runStdio() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const write = (o) => { if (o) process.stdout.write(JSON.stringify(o) + "\n"); };
  rl.on("line", async (line) => {
    line = line.trim(); if (!line) return;
    let m; try { m = JSON.parse(line); } catch { return write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
    const handleOne = (x) => rpc(x, null, (n) => { if (!process.env.HUB_AGENT_NAME) { const f = FRIENDLY.find(([re]) => re.test(n)); clientName = cleanName(f ? f[1] : n || "agent"); } clientKind = clip(n, 60); });
    if (Array.isArray(m)) { const out = (await Promise.all(m.map(handleOne))).filter(Boolean); if (out.length) write(out); } else write(await handleOne(m));
  });
  rl.on("close", () => { if (saveT) try { persistNow(); } catch {} process.exit(0); });
}

// ---------------------------------------------------------------- setup: add/remove the Hub in Claude Code and Codex
let askRl = null, askLines = [], askWait = null, askClosed = false;
function ask(q) {
  if (!askRl) { askRl = readline.createInterface({ input: process.stdin }); askRl.on("line", (l) => { if (askWait) { const w = askWait; askWait = null; w(l); } else askLines.push(l); }); askRl.on("close", () => { askClosed = true; if (askWait) { const w = askWait; askWait = null; w(""); } }); }
  process.stdout.write(q);
  return new Promise((resolve) => { const done = (a) => { process.stdout.write("\n"); resolve(/^y/i.test(String(a).trim())); }; if (askLines.length) done(askLines.shift()); else if (askClosed) done(""); else askWait = done; });
}
function has(cmd) { const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" }); return r.status === 0; }
function run(cmd, args) {
  const win = process.platform === "win32"; // .cmd shims need a shell on Windows, so quote paths with spaces ourselves
  const a = win ? args.map((x) => (/[\s"&|<>^]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x)) : args;
  const r = spawnSync(cmd, a, { stdio: "inherit", shell: win }); return r.status === 0;
}
const CODEX_TOML = path.join(HOME, ".codex", "config.toml");
const codexEntry = () => "\n# The Hub relay (added by The Hub setup; remove with REMOVE-AGENTS.bat)\n[mcp_servers.the-hub]\ncommand = " + tomlStr(process.execPath) + "\nargs = [" + tomlStr(SELF) + "]\n";
async function setup() {
  console.log("\n  The Hub relay setup\n  -------------------\n  This adds The Hub as a tool your agents can use. Each step asks first.\n");
  if (has("claude")) {
    if (await ask("  Add The Hub to Claude Code (for all your projects)? Type Y and press Enter: ")) {
      run("claude", ["mcp", "remove", "the-hub", "--scope", "user"]);
      console.log(run("claude", ["mcp", "add", "--scope", "user", "the-hub", "--", process.execPath, SELF]) ? "  ✓ Added to Claude Code." : "  Couldn't add it. You can run this yourself:\n    claude mcp add --scope user the-hub -- \"" + process.execPath + "\" \"" + SELF + "\"");
    }
  } else console.log("  Claude Code isn't installed (or isn't on PATH). Skipped. Later, run:\n    claude mcp add --scope user the-hub -- \"" + process.execPath + "\" \"" + SELF + "\"\n");
  const codexThere = has("codex") || fs.existsSync(path.dirname(CODEX_TOML));
  if (codexThere) {
    const cur = readIf(CODEX_TOML) || "";
    if (readCodexServers(cur)["the-hub"]) console.log("  Codex already has The Hub.");
    else if (await ask("  Add The Hub to Codex (~/.codex/config.toml)? Type Y and press Enter: ")) { fs.mkdirSync(path.dirname(CODEX_TOML), { recursive: true }); if (cur) fs.copyFileSync(CODEX_TOML, CODEX_TOML + ".before-the-hub"); fs.appendFileSync(CODEX_TOML, codexEntry()); console.log("  ✓ Added to Codex. (Backup: config.toml.before-the-hub)"); }
  } else console.log("  Codex isn't installed. Skipped. Later, add this to ~/.codex/config.toml:" + codexEntry());
  console.log("\n  Other MCP apps (Cursor, Windsurf, ...): use command\n    " + process.execPath + "\n  with argument\n    " + SELF + "\n");
  console.log("  Last step: paste this code into the Hub (Agents tab → Connect the relay):\n\n    " + HUB_CODE + "\n");
}
async function removeSetup() {
  console.log("\n  Remove The Hub from your agents\n");
  if (has("claude") && await ask("  Remove The Hub from Claude Code? Type Y and press Enter: ")) run("claude", ["mcp", "remove", "the-hub", "--scope", "user"]);
  const cur = readIf(CODEX_TOML);
  if (cur && readCodexServers(cur)["the-hub"] && await ask("  Remove The Hub from Codex? Type Y and press Enter: ")) {
    const out = cur.replace(/\n?# The Hub relay \(added by The Hub setup[^\n]*\n\[mcp_servers\.the-hub\][\s\S]*?(?=\n\[|$)/, "").replace(/\n\[mcp_servers\.the-hub\][\s\S]*?(?=\n\[|$)/, "");
    fs.copyFileSync(CODEX_TOML, CODEX_TOML + ".before-remove"); fs.writeFileSync(CODEX_TOML, out); console.log("  ✓ Removed from Codex.");
  }
  console.log("\n  Your board, shared data and Drive map are still in " + DIR + ". Delete that folder to erase them.\n");
}

// ---------------------------------------------------------------- main
const argv = process.argv.slice(2);
if (argv.includes("--code")) { console.log(HUB_CODE); }
else if (argv.includes("--setup")) { await setup(); if (askRl) askRl.close(); }
else if (argv.includes("--remove")) { await removeSetup(); if (askRl) askRl.close(); }
else if (argv.includes("--serve")) {
  if (await becomeHost()) {
    console.log("\n  The Hub relay is running. Leave this window open while your agents work.\n  Close it (or press Ctrl+C) to stop.\n\n  Code for the Hub (Agents tab → Connect the relay):\n    " + HUB_CODE + "\n\n  HTTP MCP url for apps that want one: http://127.0.0.1:" + PORT + "/mcp  (Authorization: Bearer <agent token in " + path.join(DIR, "agent-token") + ">)\n");
    process.on("SIGINT", () => { try { persistNow(); } catch {} process.exit(0); });
  } else console.log("\n  The relay is already running (an agent or another window started it). You're all set.\n  Code for the Hub: " + HUB_CODE + "\n");
}
else { await runStdio(); }
