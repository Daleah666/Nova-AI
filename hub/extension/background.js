// The Hub — background worker.
// Every minute, if you're active and Chrome is focused, it adds one minute to the site in your current tab.
// Everything is stored in chrome.storage.local on this computer. It's only shared with your Hub page,
// and only after you pair the Hub with this extension's pairing code.

const HUB = "https://claude.ai/artifact/9aQgcMWmM7zPBkhuhRKbWu";
const KEEP_DAYS = 31;
const GROUP_TITLE = "Hub";

const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function domainOf(url) {
  try { const u = new URL(url); if (u.protocol !== "http:" && u.protocol !== "https:") return null; return u.hostname.replace(/^www\./, ""); }
  catch (e) { return null; }
}
function makeToken() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const a = new Uint32Array(10); crypto.getRandomValues(a);
  const s = Array.from(a, (n) => abc[n % abc.length]).join(""); return s.slice(0, 5) + "-" + s.slice(5);
}
async function getToken() {
  let { token } = await chrome.storage.local.get("token");
  if (!token) { token = makeToken(); await chrome.storage.local.set({ token }); }
  return token;
}
async function tokenOk(t) { return typeof t === "string" && t.length > 6 && t.trim().toUpperCase() === (await getToken()); }

// Self-update: UPDATE.bat copies new files into this folder after you confirm.
// When the version on disk is newer than the one running, reload so the update takes effect.
async function checkSelfUpdate() {
  try {
    const r = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    const m = await r.json();
    if (m && m.version && m.version !== chrome.runtime.getManifest().version) chrome.runtime.reload();
  } catch (e) { /* mid-copy; try again next minute */ }
}

function ensureAlarm() { chrome.alarms.create("tick", { periodInMinutes: 1 }); }
chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); getToken(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); checkSelfUpdate(); });

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "tick") return;
  await checkSelfUpdate();
  await tidyTabs().catch(() => {});
  const { paused } = await chrome.storage.local.get("paused");
  if (paused) return;
  if ((await chrome.idle.queryState(120)) !== "active") return;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused || win.incognito) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  const d = tab && domainOf(tab.url || "");
  if (!d) return;
  const k = "act:" + dayKey();
  const cur = (await chrome.storage.local.get(k))[k] || {};
  cur[d] = (cur[d] || 0) + 60;
  await chrome.storage.local.set({ [k]: cur });
  prune();
});

async function prune() {
  const all = await chrome.storage.local.get(null);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const old = Object.keys(all).filter((k) => k.startsWith("act:") && k.slice(4) < dayKey(cutoff));
  if (old.length) await chrome.storage.local.remove(old);
}

async function hubGroupIds() {
  try { return (await chrome.tabGroups.query({ title: GROUP_TITLE })).map((g) => g.id); } catch (e) { return []; }
}

// ActivityWatch (free app from activitywatch.net) runs a small server on this computer at port 5600.
// If it's installed, read today's per-app time from it (only while you're active at the computer).
const AW = "http://localhost:5600/api/0";
let awCache = { at: 0, data: { available: false } };
async function awSummary() {
  if (Date.now() - awCache.at < 60000) return awCache.data;
  let data = { available: false };
  try {
    const sig = AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined;
    const buckets = await (await fetch(AW + "/buckets/", { signal: sig })).json();
    const ids = Object.keys(buckets || {});
    const win = ids.find((i) => i.startsWith("aw-watcher-window_"));
    const afk = ids.find((i) => i.startsWith("aw-watcher-afk_"));
    if (!win) data = { available: true, total: 0, apps: [] };
    else {
      const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1);
      const q = ['events = query_bucket("' + win + '");'];
      if (afk) q.push('afk = query_bucket("' + afk + '");', 'notafk = filter_keyvals(afk, "status", ["not-afk"]);', "events = filter_period_intersect(events, notafk);");
      q.push('merged = merge_events_by_keys(events, ["app"]);', "RETURN = sort_by_duration(merged);");
      const res = await (await fetch(AW + "/query/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeperiods: [start.toISOString() + "/" + end.toISOString()], query: q }), signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined })).json();
      const evs = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : [];
      data = { available: true, total: Math.round(evs.reduce((a, e) => a + (e.duration || 0), 0)), apps: evs.slice(0, 15).map((e) => ({ app: String((e.data && e.data.app) || "Unknown"), secs: Math.round(e.duration || 0) })) };
    }
  } catch (e) { data = { available: false }; }
  awCache = { at: Date.now(), data };
  return data;
}

// Tidy tabs: tabs you haven't looked at for a while get grouped into "Idle", put to sleep, or closed
// (closed ones are kept in a list so you can reopen them). Pinned tabs, tabs playing sound, the tab you're on,
// your Hub tabs and Chrome's own pages are never touched. Off until you turn it on.
const TIDY_MINS = [15, 30, 60, 120, 240, 480, 1440];
function cleanTidy(t) {
  t = t || {};
  return { on: !!t.on, mins: TIDY_MINS.includes(+t.mins) ? +t.mins : 60, action: ["group", "sleep", "close"].includes(t.action) ? t.action : "group" };
}
async function getTidy() { const { tidy } = await chrome.storage.local.get("tidy"); return cleanTidy(tidy); }
async function setSeen(fn) { const { seen } = await chrome.storage.session.get("seen"); const s = seen || {}; fn(s); await chrome.storage.session.set({ seen: s }); }
chrome.tabs.onActivated.addListener(({ tabId }) => setSeen((s) => { s[tabId] = Date.now(); }));
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.url) setSeen((s) => { s[tabId] = Date.now(); }); });
chrome.tabs.onRemoved.addListener((tabId) => setSeen((s) => { delete s[tabId]; }));
async function idleGroup(tab) {
  const gs = await chrome.tabGroups.query({ title: "Idle", windowId: tab.windowId }).catch(() => []);
  if (gs.length) { await chrome.tabs.group({ groupId: gs[0].id, tabIds: [tab.id] }); return; }
  const gid = await chrome.tabs.group({ tabIds: [tab.id], createProperties: { windowId: tab.windowId } });
  await chrome.tabGroups.update(gid, { title: "Idle", color: "grey", collapsed: true });
}
async function tidyTabs() {
  const t = await getTidy(); if (!t.on) return;
  const { seen } = await chrome.storage.session.get("seen"); const s = seen || {};
  const now = Date.now(), limit = t.mins * 60000, hubGroups = await hubGroupIds();
  const idle = (await chrome.tabGroups.query({ title: "Idle" }).catch(() => [])).map((g) => g.id);
  const closed = []; let touched = false;
  for (const tab of await chrome.tabs.query({ windowType: "normal" })) {
    if (tab.active || tab.pinned || tab.audible || tab.incognito) continue;
    const url = tab.url || "";
    if (!/^https?:\/\//.test(url) || url.startsWith(HUB) || hubGroups.includes(tab.groupId)) continue;
    const last = Math.max(s[tab.id] || 0, tab.lastAccessed || 0);
    if (!last) { s[tab.id] = now; touched = true; continue; }
    if (now - last < limit) continue;
    try {
      if (t.action === "group") { if (!idle.includes(tab.groupId)) await idleGroup(tab); }
      else if (t.action === "sleep") { if (!tab.discarded) await chrome.tabs.discard(tab.id); }
      else { closed.push({ title: (tab.title || url).slice(0, 140), url, at: now }); await chrome.tabs.remove(tab.id); }
    } catch (e) { /* tab changed underneath us */ }
  }
  if (touched) await chrome.storage.session.set({ seen: s });
  if (closed.length) { const { tidied } = await chrome.storage.local.get("tidied"); await chrome.storage.local.set({ tidied: closed.concat(tidied || []).slice(0, 40) }); }
}

// Mini windows: a small separate browser window for one site, docked on the right of your screen.
async function openPeek(url) {
  if (!/^https?:\/\//i.test(url || "")) return false;
  const base = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  const pops = (await chrome.windows.getAll({ windowTypes: ["popup"] })).length;
  const w = 460, opts = { url, type: "popup", width: w, focused: true };
  if (base && base.width) {
    opts.left = Math.max(0, (base.left || 0) + base.width - w - 16 - (pops % 4) * 28);
    opts.top = (base.top || 0) + 70 + (pops % 4) * 28;
    opts.height = Math.max(420, (base.height || 900) - 100);
  }
  await chrome.windows.create(opts);
  return true;
}

// Connect: the Hub asks; you confirm in a small window from this extension; only then does the Hub get the code.
async function openPairWindow(tabId, frameId) {
  const { pairWin } = await chrome.storage.session.get("pairWin");
  if (pairWin) { try { await chrome.windows.update(pairWin, { focused: true }); return; } catch (e) { /* closed */ } }
  const base = await chrome.windows.getLastFocused().catch(() => null);
  const opts = { url: "pair.html?tab=" + tabId + "&frame=" + frameId, type: "popup", width: 400, height: 330, focused: true };
  if (base && base.width) { opts.left = Math.round((base.left || 0) + base.width / 2 - 200); opts.top = Math.round((base.top || 0) + 110); }
  const w = await chrome.windows.create(opts);
  await chrome.storage.session.set({ pairWin: w.id });
}
const onClaudeTab = (tab) => !!tab && /^https:\/\/claude\.ai\//.test(tab.url || "");

// Grok images: your xAI key lives only here, in this extension's storage on your computer.
// The Hub page asks; this worker calls xAI and hands back the pictures. The key never goes to the Hub.
const XAI = "https://api.x.ai/v1";
async function grokKey() { const { xaiKey } = await chrome.storage.local.get("xaiKey"); return typeof xaiKey === "string" ? xaiKey : ""; }
async function toDataUrl(url) {
  const r = await fetch(url); if (!r.ok) throw new Error("Couldn't download the picture from xAI.");
  const b = await r.blob(); const buf = new Uint8Array(await b.arrayBuffer()); let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return "data:" + (b.type || "image/jpeg") + ";base64," + btoa(bin);
}
async function grokImage(m) {
  const key = await grokKey(); if (!key) return { error: "nokey" };
  const prompt = String(m.prompt || "").trim().slice(0, 4000); if (!prompt) return { error: "Write what you want first." };
  const body = { model: String(m.model || "grok-imagine-image-2.0").slice(0, 60), prompt, n: Math.max(1, Math.min(4, +m.n || 1)), response_format: "b64_json" };
  if (/^\d+:\d+$/.test(m.aspect || "")) body.aspect_ratio = m.aspect;
  let url = XAI + "/images/generations";
  if (m.mode === "edit") {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(m.image || "")) return { error: "Pick a picture to edit first." };
    if (m.image.length > 20 * 1024 * 1024) return { error: "That picture is too big to send. Try a smaller one." };
    body.image = { url: m.image, type: "image_url" }; url = XAI + "/images/edits";
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (j && (j.error && (j.error.message || j.error) || j.message)) ? String(j.error && (j.error.message || j.error) || j.message).slice(0, 300) : "xAI said no (" + res.status + ")." };
  const out = [];
  for (const d of (Array.isArray(j.data) ? j.data : []).slice(0, 4)) {
    if (d.b64_json) out.push("data:image/jpeg;base64," + d.b64_json);
    else if (d.url) out.push(await toDataUrl(d.url));
  }
  return out.length ? { images: out, revised: (j.data && j.data[0] && j.data[0].revised_prompt) || "" } : { error: "xAI sent back no pictures." };
}

// The Hub relay: a small server on this computer (started by your agents, or START-RELAY.bat in the relay folder).
// The Hub page asks through here; the code you pasted lives only in this extension.
const RELAY = "http://127.0.0.1:47800";
async function relayCode() { const { relayCode } = await chrome.storage.local.get("relayCode"); return typeof relayCode === "string" ? relayCode : ""; }
async function relayHealth() {
  try { const r = await fetch(RELAY + "/health", { signal: AbortSignal.timeout(2500) }); const j = await r.json(); return j && j.app === "the-hub-relay" ? { online: true, version: String(j.version || "").slice(0, 12) } : { online: false }; }
  catch (e) { return { online: false }; }
}
async function relayCall(m) {
  const code = await relayCode(); if (!code) return { error: "nocode" };
  const op = String(m.op || ""); if (!/^[a-z.]{2,40}$/.test(op)) return { error: "bad op" };
  const ms = Math.min(130000, Math.max(3000, Number(m.ms) || 15000));
  try {
    const r = await fetch(RELAY + "/api", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + code }, body: JSON.stringify({ op, args: m.args && typeof m.args === "object" ? m.args : {} }), signal: AbortSignal.timeout(ms) });
    if (r.status === 401) return { error: "badcode" };
    const j = await r.json().catch(() => ({}));
    return j.ok ? { ok: true, result: j.result } : { error: String(j.error || "relay error").slice(0, 400) };
  } catch (e) { return { error: "offline" }; }
}

// Voice: the Talk window sends what you said here; pass it to an open Hub, or open the Hub and hand it over.
async function hubTabsOpen() { return (await chrome.tabs.query({})).filter((t) => (t.url || "").startsWith(HUB)); }
async function deliverVoice(text) {
  text = String(text || "").trim().slice(0, 1000); if (!text) return false;
  const tabs = await hubTabsOpen();
  if (tabs.length) {
    const t = tabs[0];
    await chrome.tabs.update(t.id, { active: true }).catch(() => {}); await chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
    try { await chrome.tabs.sendMessage(t.id, { type: "hub-voice", text }); return true; } catch (e) { /* bridge not ready; fall through */ }
  }
  await chrome.storage.session.set({ pendingVoice: { text, at: Date.now() } });
  if (!tabs.length) await openHubWindow();
  return true;
}
async function openVoice(target) {
  const base = await chrome.windows.getLastFocused().catch(() => null);
  const url = target ? "voice.html?mode=dictate&tab=" + target.tabId + "&frame=" + target.frameId : "voice.html";
  const opts = { url, type: "popup", width: 400, height: 300, focused: true };
  if (base && base.width) { opts.left = Math.round((base.left || 0) + base.width / 2 - 200); opts.top = Math.round((base.top || 0) + 90); }
  await chrome.windows.create(opts);
}

async function summary() {
  const all = await chrome.storage.local.get(null);
  const todayMap = all["act:" + dayKey()] || {};
  const today = Object.entries(todayMap).map(([domain, secs]) => ({ domain, secs })).sort((a, b) => b.secs - a.secs).slice(0, 25);
  const week = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const m = all["act:" + dayKey(d)] || {};
    week.push({ day: dayKey(d), secs: Object.values(m).reduce((a, b) => a + b, 0) });
  }
  const tabsAll = (await chrome.tabs.query({})).filter((t) => !t.incognito);
  const groups = await hubGroupIds();
  const tabs = tabsAll.filter((t) => /^https?:\/\//.test(t.url || "") && !(t.url || "").startsWith(HUB)).slice(0, 60).map((t) => ({ title: t.title || "", url: t.url }));
  const hubTabs = tabsAll.filter((t) => groups.includes(t.groupId)).map((t) => ({ id: t.id, title: t.title || "", url: t.url || "" }));
  const aw = await awSummary();
  return { today, week, tabs, hubTabs, aw, paused: !!all.paused, tidy: cleanTidy(all.tidy), tidied: (all.tidied || []).slice(0, 15) };
}

async function normalWindowFor(sender) {
  if (sender && sender.tab) {
    const w = await chrome.windows.get(sender.tab.windowId).catch(() => null);
    if (w && w.type === "normal") return { windowId: w.id, index: sender.tab.index + 1 };
  }
  const wins = await chrome.windows.getAll({ windowTypes: ["normal"] });
  const w = wins.find((x) => x.focused) || wins[0];
  if (w) return { windowId: w.id, index: undefined };
  const nw = await chrome.windows.create({ type: "normal" });
  return { windowId: nw.id, index: undefined };
}

async function openApp(url, sender) {
  if (!/^https?:\/\//i.test(url || "")) return false;
  const base = url.split("#")[0];
  const existing = (await chrome.tabs.query({})).find((t) => (t.url || "").split("#")[0].startsWith(base));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return true;
  }
  const where = await normalWindowFor(sender);
  const tab = await chrome.tabs.create({ url, windowId: where.windowId, index: where.index, active: true });
  try {
    const groups = await chrome.tabGroups.query({ title: GROUP_TITLE, windowId: where.windowId });
    if (groups.length) await chrome.tabs.group({ groupId: groups[0].id, tabIds: [tab.id] });
    else { const gid = await chrome.tabs.group({ tabIds: [tab.id], createProperties: { windowId: where.windowId } }); await chrome.tabGroups.update(gid, { title: GROUP_TITLE, color: "pink" }); }
  } catch (e) { /* grouping is a nice-to-have */ }
  await chrome.windows.update(where.windowId, { focused: true });
  return true;
}

async function openHubWindow() {
  const { hubWin } = await chrome.storage.session.get("hubWin");
  if (hubWin) { try { await chrome.windows.update(hubWin, { focused: true }); return; } catch (e) { /* closed */ } }
  const base = await chrome.windows.getLastFocused().catch(() => null);
  const width = 480;
  const opts = { url: HUB, type: "popup", width, focused: true };
  if (base && base.width) { opts.left = Math.max(0, (base.left || 0) + base.width - width); opts.top = base.top || 0; opts.height = base.height || 900; }
  const w = await chrome.windows.create(opts);
  await chrome.storage.session.set({ hubWin: w.id });
}

chrome.commands.onCommand.addListener((cmd) => { if (cmd === "open-hub") openHubWindow(); if (cmd === "talk") openVoice(); });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== "object") return;
  const fromPanel = sender.id === chrome.runtime.id && (sender.url || "").startsWith(chrome.runtime.getURL(""));
  (async () => {
    if (msg.type === "voice" && fromPanel) return { ok: await deliverVoice(msg.text) };
    if (msg.type === "openVoice" && fromPanel) { await openVoice(); return true; }
    if (msg.type === "token" && fromPanel) return getToken();
    if (msg.type === "newToken" && fromPanel) { const t = makeToken(); await chrome.storage.local.set({ token: t }); return t; }
    if (msg.type === "panelSummary" && fromPanel) return summary();
    if (msg.type === "openHubWindow" && fromPanel) { await openHubWindow(); return true; }
    if (msg.type === "openHubTab" && fromPanel) { await chrome.tabs.create({ url: HUB }); return true; }
    if (msg.type === "getTidy" && fromPanel) { const { tidied } = await chrome.storage.local.get("tidied"); return { tidy: await getTidy(), tidied: (tidied || []).slice(0, 15) }; }
    if (msg.type === "setTidy" && fromPanel) { const tidy = cleanTidy(msg.tidy); await chrome.storage.local.set({ tidy }); return { ok: true, tidy }; }
    if (msg.type === "pairAllow" && fromPanel) {
      const tab = await chrome.tabs.get(msg.tabId).catch(() => null);
      if (!onClaudeTab(tab)) return { ok: false };
      await chrome.tabs.sendMessage(tab.id, { type: "hub-token", token: await getToken() }, { frameId: Number.isInteger(msg.frameId) ? msg.frameId : 0 }).catch(() => {});
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {}); await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      return { ok: true };
    }
    if (msg.type === "dictation" && fromPanel) {
      const tab = await chrome.tabs.get(msg.tabId).catch(() => null);
      if (!onClaudeTab(tab)) return { ok: false };
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {}); await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      try { await chrome.tabs.sendMessage(tab.id, { type: "hub-dictation", text: String(msg.text || "").slice(0, 2000) }, { frameId: Number.isInteger(msg.frameId) ? msg.frameId : 0 }); return { ok: true }; } catch (e) { return { ok: false }; }
    }
    // The Hub page asks to connect. Nothing is shared until you press Connect in the window this opens.
    if (msg.type === "pairRequest" && !fromPanel && sender.tab && onClaudeTab(sender.tab)) { await openPairWindow(sender.tab.id, sender.frameId || 0); return { ok: true }; }
    // Everything below comes from the Hub page through the bridge and needs the pairing code.
    if (!(await tokenOk(msg.token))) return { error: "pair" };
    if (msg.type === "verify") return { ok: true };
    if (msg.type === "pendingVoice") {
      const { pendingVoice } = await chrome.storage.session.get("pendingVoice");
      await chrome.storage.session.remove("pendingVoice");
      return pendingVoice && Date.now() - pendingVoice.at < 120000 ? { text: pendingVoice.text } : {};
    }
    if (msg.type === "summary") return summary();
    if (msg.type === "peek") return { ok: await openPeek(msg.url) };
    if (msg.type === "grokKeySet") {
      const k = String(msg.key || "").trim();
      if (!/^xai-[A-Za-z0-9_-]{20,}$/.test(k)) return { error: "That doesn't look like an xAI key (they start with xai-)." };
      await chrome.storage.local.set({ xaiKey: k }); return { ok: true, last4: k.slice(-4) };
    }
    if (msg.type === "grokKeyClear") { await chrome.storage.local.remove("xaiKey"); return { ok: true }; }
    if (msg.type === "grokKeyStatus") { const k = await grokKey(); return { set: !!k, last4: k ? k.slice(-4) : "" }; }
    if (msg.type === "grokImage") return grokImage(msg);
    // Free check: asks xAI about the key itself (no picture made, no cost).
    if (msg.type === "grokKeyTest") {
      const k = await grokKey(); if (!k) return { ok: false, error: "nokey" };
      try {
        const r = await fetch(XAI + "/api-key", { headers: { Authorization: "Bearer " + k } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: "xAI says this key doesn't work (" + r.status + ")." };
        return { ok: true, name: typeof j.name === "string" ? j.name.slice(0, 60) : "", blocked: !!(j.api_key_blocked || j.api_key_disabled || j.team_blocked) };
      } catch (e) { return { ok: false, error: "Couldn't reach xAI. Check your internet." }; }
    }
    if (msg.type === "relayCodeSet") {
      const code = String(msg.code || "").trim(); if (!/^hub-[a-f0-9]{40}$/.test(code)) return { error: "That doesn't look like a relay code. It starts with hub- and is shown in the relay window." };
      await chrome.storage.local.set({ relayCode: code });
      const h = await relayHealth(); if (!h.online) return { ok: true, online: false };
      const t = await relayCall({ op: "status" }); if (t.error === "badcode") { await chrome.storage.local.remove("relayCode"); return { error: "The relay says that code is wrong. Copy it again from the relay window." }; }
      return { ok: true, online: true };
    }
    if (msg.type === "relayCodeClear") { await chrome.storage.local.remove("relayCode"); return { ok: true }; }
    if (msg.type === "relayStatus") { const code = await relayCode(); return { code: !!code, ...(await relayHealth()) }; }
    if (msg.type === "relayCall") return relayCall(msg);
    // Opens this extension's own card in chrome://extensions (pages can't open chrome:// links, extensions can).
    if (msg.type === "openExtDetails") { await chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id }); return { ok: true }; }
    if (msg.type === "dictate" && sender.tab) { await openVoice({ tabId: sender.tab.id, frameId: sender.frameId || 0 }); return { ok: true }; }
    if (msg.type === "setTidy") { const tidy = cleanTidy(msg.tidy); await chrome.storage.local.set({ tidy }); return { ok: true, tidy }; }
    if (msg.type === "reopen" && /^https?:\/\//i.test(msg.url || "")) {
      const where = await normalWindowFor(null); await chrome.tabs.create({ url: msg.url, windowId: where.windowId, active: true });
      const { tidied } = await chrome.storage.local.get("tidied"); await chrome.storage.local.set({ tidied: (tidied || []).filter((x) => x.url !== msg.url) });
      return { ok: true };
    }
    if (msg.type === "open") return { ok: await openApp(msg.url, sender) };
    if (msg.type === "focus" && Number.isInteger(msg.tabId)) { const t = await chrome.tabs.update(msg.tabId, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); return { ok: true }; }
    if (msg.type === "close" && Number.isInteger(msg.tabId)) {
      const groups = await hubGroupIds(); const t = await chrome.tabs.get(msg.tabId).catch(() => null);
      if (t && groups.includes(t.groupId)) await chrome.tabs.remove(msg.tabId);
      return { ok: true };
    }
    return { error: "unknown" };
  })().then(reply, (e) => reply({ error: String(e && e.message || e) }));
  return true;
});
