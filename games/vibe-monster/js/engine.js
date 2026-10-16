// Vibe Monster — core engine: loop, input, UI, overworld, menus, save/load.
'use strict';

const W = 480, H = 320, TS = 32, VIEW_W = 15, VIEW_H = 10;
const SAVE_KEY = 'vibemonster.save.v1';
const PARAMS = new URLSearchParams(location.search);

// ---------- RNG (seedable for testing: ?seed=123) ----------
let rngState = PARAMS.has('seed') ? Number(PARAMS.get('seed')) >>> 0 : (Date.now() >>> 0);
function rng() {
  rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Global game object ----------
const G = {
  mode: 'title', state: null, mapId: null, map: null, npcs: [],
  player: { x: 0, y: 0, dir: 'down', moving: false, fromX: 0, fromY: 0, t: 0, frame: 0 },
  busy: false, fade: 0, time: 0, keysDown: new Set(), ui: [], textSpeed: 1, stepCount: 0,
};

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const uiRoot = document.getElementById('ui');

// ---------- Creature helpers ----------
function xpForLevel(n) { return Math.floor(0.8 * n * n * n); }
function maxEnergy(m) { return 20 + Math.floor(m.lvl * 1.5); }
function trainBonus(m, stat) { return Math.min(COMBAT.trainingCap, Math.floor((m.train[stat] || 0) / COMBAT.trainingPerPoint)); }
function calcStats(m) {
  const sp = DEX_BY_ID[m.id];
  const [bh, ba, bd, bc, bs] = sp.base;
  const f = (b, iv) => Math.floor((2 * b + iv) * m.lvl / 100);
  return {
    hp: f(bh, m.iv.hp) + m.lvl + 10 + trainBonus(m, 'hp'),
    atk: f(ba, m.iv.atk) + 5 + trainBonus(m, 'atk'),
    def: f(bd, m.iv.def) + 5 + trainBonus(m, 'def'),
    cha: f(bc, m.iv.cha) + 5 + trainBonus(m, 'cha'),
    spd: f(bs, m.iv.spd) + 5 + trainBonus(m, 'spd'),
  };
}
function movesAtLevel(id, lvl) {
  const learned = DEX_BY_ID[id].learn.filter(([l]) => l <= lvl).map(([, mv]) => mv);
  const uniq = [...new Set(learned)];
  return uniq.slice(-4);
}
function makeMon(id, lvl, opts = {}) {
  const iv = opts.iv || { hp: rint(0, 15), atk: rint(0, 15), def: rint(0, 15), cha: rint(0, 15), spd: rint(0, 15) };
  const m = { id, lvl, xp: xpForLevel(lvl), iv, train: { hp: 0, atk: 0, def: 0, cha: 0, spd: 0 }, moves: movesAtLevel(id, lvl), hp: 0, en: 0, fluster: 0, uid: Math.floor(rng() * 1e9) };
  m.hp = calcStats(m).hp;
  m.en = maxEnergy(m);
  return m;
}
function monName(m) { return DEX_BY_ID[m.id].name; }
function isHeroine(m) { return !!DEX_BY_ID[m.id].heroine; }

// ---------- State helpers used by scripts ----------
function flag(k) { return !!(G.state && G.state.flags[k]); }
function setFlag(k, v = true) { G.state.flags[k] = v; }
function playerName() { return DEX_BY_ID[G.state.heroine].full.replace(/^(Princess|General) /, ''); }
function rivalId() { return RIVAL_OF[G.state.heroine]; }
function thirdId() { return HEROINES.find(h => h !== G.state.heroine && h !== rivalId()); }
function markSeen(id) { if (!G.state.seen.includes(id)) G.state.seen.push(id); }
function markCaught(id) { markSeen(id); if (!G.state.caught.includes(id)) G.state.caught.push(id); }
function giveItem(item, n = 1, silent = false) {
  G.state.bag[item] = (G.state.bag[item] || 0) + n;
  if (!silent) return say(`Received ${n > 1 ? n + '× ' : ''}${ITEMS[item].name}!`, { sfx: 'item' });
}
function healParty() {
  for (const m of G.state.party) { m.hp = calcStats(m).hp; m.en = maxEnergy(m); m.fluster = 0; }
}
function npcById(id) { return G.npcs.find(n => n.id === id); }

// ---------- Audio (tiny WebAudio blips; no music assets) ----------
const Sfx = (() => {
  let ac = null;
  const notes = {
    blip: [[880, 0.03]], select: [[660, 0.05], [990, 0.05]], hit: [[180, 0.08], [120, 0.08]], heal: [[523, 0.1], [659, 0.1], [784, 0.15]],
    item: [[784, 0.08], [988, 0.08], [1175, 0.15]], badge: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]], catch: [[1047, 0.1], [1319, 0.1], [1568, 0.2]],
    swoon: [[880, 0.08], [740, 0.08], [990, 0.16]], faint: [[300, 0.1], [200, 0.1], [120, 0.2]], bump: [[90, 0.05]],
  };
  function play(name) {
    if (G.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const [f, d] of notes[name] || []) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
        t += d;
      }
    } catch (e) { /* audio unavailable */ }
  }
  return { play };
})();

// ---------- Input ----------
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'a', Z: 'a', ' ': 'a', Enter: 'start', x: 'b', X: 'b', Escape: 'b', Backspace: 'b', m: 'start', M: 'start', Shift: 'run',
};
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (!k) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  e.preventDefault();
  if (G.keysDown.has(k) && ['a', 'b', 'start'].includes(k)) return;
  G.keysDown.add(k);
  pressKey(k);
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) G.keysDown.delete(k); });
window.addEventListener('blur', () => G.keysDown.clear());

function pressKey(k) {
  const top = G.ui[G.ui.length - 1];
  if (top) {
    // In UI, Enter acts as confirm.
    top.onKey(k === 'start' ? 'a' : k);
    return;
  }
  if (G.mode === 'overworld' && !G.busy && !G.player.moving) {
    if (k === 'a') interact();
    else if (k === 'start' || k === 'b') openStartMenu();
  }
}

// ---------- UI primitives ----------
function pushUI(layer) { G.ui.push(layer); uiRoot.appendChild(layer.el); }
function popUI(layer) {
  const i = G.ui.indexOf(layer);
  if (i >= 0) G.ui.splice(i, 1);
  layer.el.remove();
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function paginate(text, max = 150) {
  if (text.length <= max) return [text];
  const parts = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [text];
  const pages = []; let cur = '';
  for (const p of parts) {
    if ((cur + p).length > max && cur) { pages.push(cur.trim()); cur = ''; }
    cur += p;
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages;
}

// say(text | [texts], {sfx, auto}) — typewriter dialog, resolves when dismissed
function say(texts, opts = {}) {
  if (!Array.isArray(texts)) texts = [texts];
  const pages = texts.flatMap(t => paginate(t));
  if (opts.sfx) Sfx.play(opts.sfx);
  return new Promise(resolve => {
    const box = el('div', 'dialog' + (G.mode === 'battle' ? ' battle-dialog' : ''));
    const txt = el('div', 'dialog-text');
    const arrow = el('div', 'dialog-arrow', '▼');
    box.append(txt, arrow);
    let pi = 0, ci = 0, timer = null, done = false;
    const layer = { el: box, onKey };
    function render() { txt.innerHTML = esc(pages[pi].slice(0, ci)).replace(/\n/g, '<br>'); arrow.style.visibility = ci >= pages[pi].length ? 'visible' : 'hidden'; }
    function type() {
      clearInterval(timer);
      const speed = G.textSpeed === 2 ? 4 : G.textSpeed === 0 ? 1 : 2;
      timer = setInterval(() => {
        ci = Math.min(pages[pi].length, ci + speed);
        render();
        if (ci >= pages[pi].length) { clearInterval(timer); if (opts.auto) setTimeout(() => onKey('a'), opts.auto); }
      }, 16);
    }
    function onKey(k) {
      if (done) return;
      if (k !== 'a' && k !== 'b') return;
      if (ci < pages[pi].length) { ci = pages[pi].length; render(); clearInterval(timer); if (opts.auto) setTimeout(() => onKey('a'), opts.auto); return; }
      pi++;
      if (pi >= pages.length) { done = true; clearInterval(timer); popUI(layer); resolve(); return; }
      ci = 0; Sfx.play('blip'); type();
    }
    box.addEventListener('click', () => onKey('a'));
    pushUI(layer);
    render(); type();
  });
}

// choose(options, {title, cancel, info(i)->html, cls, disabled(i)}) → index or -1
function choose(options, opts = {}) {
  return new Promise(resolve => {
    const box = el('div', 'menu ' + (opts.cls || ''));
    if (opts.title) box.append(el('div', 'menu-title', esc(opts.title)));
    const list = el('div', 'menu-list');
    box.append(list);
    let info = null;
    if (opts.info) { info = el('div', 'menu-info'); box.append(info); }
    let idx = opts.start || 0;
    const items = options.map((o, i) => {
      const it = el('div', 'menu-item', typeof o === 'string' ? esc(o) : o.html);
      it.addEventListener('mouseenter', () => { idx = i; render(); });
      it.addEventListener('click', () => { idx = i; onKey('a'); });
      list.append(it);
      return it;
    });
    const layer = { el: box, onKey };
    function render() {
      items.forEach((it, i) => { it.classList.toggle('sel', i === idx); it.classList.toggle('disabled', !!(opts.disabled && opts.disabled(i))); });
      if (info) info.innerHTML = opts.info(idx) || '';
      const s = items[idx]; if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    }
    function onKey(k) {
      const cols = opts.cols || 1;
      if (k === 'up') idx = (idx - cols + options.length) % options.length;
      else if (k === 'down') idx = (idx + cols) % options.length;
      else if (k === 'left' && cols > 1) idx = (idx - 1 + options.length) % options.length;
      else if (k === 'right' && cols > 1) idx = (idx + 1) % options.length;
      else if (k === 'a') {
        if (opts.disabled && opts.disabled(idx)) { Sfx.play('bump'); return; }
        Sfx.play('select'); popUI(layer); resolve(idx); return;
      } else if (k === 'b' && opts.cancel !== false) { popUI(layer); resolve(-1); return; }
      else return;
      Sfx.play('blip'); render();
    }
    if (opts.cols) list.style.gridTemplateColumns = `repeat(${opts.cols}, 1fr)`;
    pushUI(layer);
    render();
  });
}

// A static panel that closes on A/B
function showPanel(html, cls = '') {
  return new Promise(resolve => {
    const box = el('div', 'panel ' + cls, html);
    const layer = { el: box, onKey: (k) => { if (k === 'a' || k === 'b') { popUI(layer); resolve(); } } };
    box.addEventListener('click', () => layer.onKey('a'));
    pushUI(layer);
  });
}

function spriteImg(id, scale = 2, sil = false) {
  const key = id + ':' + scale + ':' + sil;
  if (!spriteImg.cache) spriteImg.cache = {};
  if (!spriteImg.cache[key]) {
    const src = sil ? Art.silhouette(id) : Art.drawCreature(id);
    const c = document.createElement('canvas');
    c.width = 64 * scale; c.height = 64 * scale;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(src, 0, 0, 64 * scale, 64 * scale);
    spriteImg.cache[key] = c.toDataURL();
  }
  return `<img class="sprite" src="${spriteImg.cache[key]}" width="${64 * scale}" height="${64 * scale}">`;
}
function typeBadges(types) { return types.map(t => `<span class="type" style="background:${TYPES[t].color}">${t}</span>`).join(''); }
function bar(v, max, cls) { const p = clamp(v / max, 0, 1) * 100; return `<div class="bar ${cls}"><div style="width:${p}%"></div></div>`; }

// ---------- Maps ----------
function loadMap(id) {
  G.mapId = id;
  G.map = MAPS[id];
  G.npcs = (G.map.npcs || []).map(n => Object.assign({}, n, { px: n.x, py: n.y, home: { x: n.x, y: n.y }, moveT: 0 }));
  // Hide defeated-or-collected things / dynamic looks
  for (const n of G.npcs) {
    if (n.look === 'rival') n.lookObj = Art.heroineLook(rivalId());
    else if (n.look === 'third') n.lookObj = Art.heroineLook(thirdId());
    else n.lookObj = Art.NPC_LOOKS[n.look];
  }
  G.state.map = id;
}
function tileAt(x, y) {
  const r = G.map.rows[y];
  if (!r || x < 0 || x >= r.length) return 'T';
  return r[x];
}
function itemAt(x, y) { return (G.map.items || []).find(it => it.x === x && it.y === y && !G.state.flags['item_' + it.id]); }
function npcAt(x, y) { return G.npcs.find(n => n.x === x && n.y === y && !n.hidden); }
function walkable(x, y) {
  const t = tileAt(x, y);
  if (t === 'G') return flag(G.map.gate && G.map.gate.flag);
  if (!WALKABLE.has(t)) return false;
  if (npcAt(x, y) || itemAt(x, y)) return false;
  if (G.player.x === x && G.player.y === y) return false;
  return true;
}
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

async function fadeTo(target, ms = 200) {
  const start = G.fade, t0 = performance.now();
  while (true) {
    const t = Math.min(1, (performance.now() - t0) / ms);
    G.fade = start + (target - start) * t;
    if (t >= 1) break;
    await sleep(16);
  }
}

async function warpTo(map, x, y, dir) {
  G.busy = true;
  await fadeTo(1, 180);
  loadMap(map);
  Object.assign(G.player, { x, y, dir: dir || G.player.dir, moving: false });
  await sleep(60);
  await fadeTo(0, 180);
  G.busy = false;
  if (G.map.onEnter) { G.busy = true; try { await G.map.onEnter(); } finally { G.busy = false; } }
}

// ---------- Overworld movement ----------
function tryMove(dir) {
  const p = G.player;
  p.dir = dir;
  const [dx, dy] = DIRS[dir];
  const nx = p.x + dx, ny = p.y + dy;
  if (!walkable(nx, ny)) { if (!G.bumpT || G.time - G.bumpT > 300) { Sfx.play('bump'); G.bumpT = G.time; } return; }
  p.fromX = p.x; p.fromY = p.y; p.x = nx; p.y = ny; p.moving = true; p.t = 0; p.frame++;
}

async function stepPlayer(dir) {
  G.busy = true;
  const p = G.player;
  p.dir = dir;
  const [dx, dy] = DIRS[dir];
  if (walkable(p.x + dx, p.y + dy)) { p.fromX = p.x; p.fromY = p.y; p.x += dx; p.y += dy; p.moving = true; p.t = 0; p.frame++; }
  while (p.moving) await sleep(16);
  G.busy = false;
}

async function onStepComplete() {
  const p = G.player;
  G.stepCount++;
  const w = (G.map.warps || []).find(w => w.x === p.x && w.y === p.y);
  if (w) { await warpTo(w.to, w.tx, w.ty, w.dir); return; }
  const tr = (G.map.triggers || []).find(t => t.x === p.x && t.y === p.y);
  if (tr) { G.busy = true; try { await tr.run(); } finally { G.busy = false; } if (G.busy) return; }
  if (await checkTrainerSight()) return;
  if (tileAt(p.x, p.y) === ',' && G.map.enc && flag('gotDex') && rng() < 0.11) {
    await wildEncounter(G.map.enc);
  }
}

function pickEncounter(table) {
  const total = ENCOUNTERS[table].reduce((s, e) => s + e[1], 0);
  let r = rng() * total;
  for (const [id, w, lo, hi] of ENCOUNTERS[table]) { if ((r -= w) < 0) return makeMon(id, rint(lo, hi)); }
  const e = ENCOUNTERS[table][0];
  return makeMon(e[0], e[2]);
}

async function wildEncounter(table, forced) {
  G.busy = true;
  try {
    const mon = forced || pickEncounter(table);
    markSeen(mon.id);
    const res = await runBattleTransition({ kind: 'wild', enemies: [mon] });
    if (res === 'lose') await whiteout();
  } finally { G.busy = false; }
}

async function runBattleTransition(cfg) {
  for (let i = 0; i < 3; i++) { G.flash = 1; await sleep(70); G.flash = 0; await sleep(70); }
  await fadeTo(1, 150);
  G.mode = 'battle';
  const p = Battle.start(Object.assign({ bg: G.map.bg }, cfg));
  await fadeTo(0, 150);
  const res = await p;
  await fadeTo(1, 150);
  G.mode = 'overworld';
  await fadeTo(0, 150);
  await checkEvolutions();
  return res;
}

async function checkTrainerSight() {
  const p = G.player;
  for (const n of G.npcs) {
    if (!n.trainer || G.state.flags['tr_' + n.trainer] || n.hidden) continue;
    const [dx, dy] = DIRS[n.dir];
    for (let i = 1; i <= (n.sight || 3); i++) {
      const tx = n.x + dx * i, ty = n.y + dy * i;
      if (tx === p.x && ty === p.y) {
        G.busy = true;
        try {
          n.alert = true; Sfx.play('select');
          await sleep(600);
          n.alert = false;
          // walk up to the player
          while (Math.abs(n.x - p.x) + Math.abs(n.y - p.y) > 1) await npcStep(n, n.dir);
          p.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[n.dir];
          const res = await trainerBattle(n.trainer, n);
          if (res === 'lose') await whiteout();
        } finally { G.busy = false; }
        return true;
      }
      if (!WALKABLE.has(tileAt(tx, ty)) || npcAt(tx, ty)) break;
    }
  }
  return false;
}

async function npcStep(n, dir) {
  const [dx, dy] = DIRS[dir];
  n.dir = dir;
  n.fromX = n.x; n.fromY = n.y; n.x += dx; n.y += dy; n.moveT = 0; n.moving = true; n.frame = (n.frame || 0) + 1;
  while (n.moving) await sleep(16);
}

async function trainerBattle(trId, npc) {
  const tr = TRAINERS[trId];
  let party, name = tr.name, intro = tr.intro, win = tr.win, lose = tr.lose;
  if (tr.party === 'RIVAL') {
    const r = rivalId();
    party = [makeMon(r, 5, { iv: { hp: 8, atk: 8, def: 8, cha: 8, spd: 8 } })];
    name = DEX_BY_ID[r].name;
    intro = null; win = RIVAL_LINES[r].win; lose = RIVAL_LINES[r].lose;
  } else party = tr.party.map(([id, l]) => makeMon(id, l, { iv: { hp: 10, atk: 10, def: 10, cha: 10, spd: 10 } }));
  if (intro) await say(intro);
  party.forEach(m => markSeen(m.id));
  const res = await runBattleTransition({ kind: 'trainer', enemies: party, trainer: Object.assign({}, tr, { name, win, lose }), trId });
  if (res === 'win' || tr.party === 'RIVAL') G.state.flags['tr_' + trId] = true;
  if (res === 'win' && trId !== 'warden' && G.map.gate && ['karen_coupon', 'karen_hoa', 'karen_mlm'].every(k => G.state.flags['tr_' + k]) && !flag(G.map.gate.flag)) {
    setFlag(G.map.gate.flag);
    Sfx.play('item');
    await say("*CLANK* Somewhere in the prison, the gate to the Warden's office swings open!");
  }
  return res;
}

async function whiteout() {
  await say(`${playerName()} has no one left standing... ${playerName()} panicked and ran back to safety!`);
  const lost = Math.floor(G.state.money / 2);
  G.state.money -= lost;
  if (lost) await say(`${playerName()} dropped ₵${lost} in the confusion. Ouch.`);
  healParty();
  const h = G.state.lastHeal;
  await warpTo(h.map, h.x, h.y, h.dir);
}

// ---------- Evolution ----------
async function checkEvolutions() {
  for (const m of G.state.party) {
    const sp = DEX_BY_ID[m.id];
    if (!sp.evo || m.lvl < sp.evo.lvl || m.hp <= 0) continue;
    const to = sp.evo.to;
    const hero = !!sp.heroine;
    G.busy = true;
    await showEvolution(m, to, hero);
    const before = calcStats(m).hp;
    m.id = to;
    m.hp += calcStats(m).hp - before;
    markCaught(to);
    if (hero) G.state.heroine = G.state.heroine; // same person, new look
    await say(hero ? `${sp.name} had a glow-up into ${DEX_BY_ID[to].name}!` : `Congratulations! ${sp.name} evolved into ${DEX_BY_ID[to].name}!`, { sfx: 'badge' });
    G.busy = false;
  }
}
function showEvolution(m, to, hero) {
  return new Promise(async resolve => {
    const box = el('div', 'panel evo');
    box.innerHTML = `<div class="evo-title">${hero ? 'Glow-up time!' : 'What? ' + esc(monName(m)) + ' is evolving!'}</div><div class="evo-stage">${spriteImg(m.id, 3)}</div>`;
    const layer = { el: box, onKey: () => {} };
    pushUI(layer);
    const stage = box.querySelector('.evo-stage');
    for (let i = 0; i < 10; i++) {
      stage.innerHTML = spriteImg(i % 2 ? to : m.id, 3, true);
      await sleep(Math.max(80, 260 - i * 20));
    }
    stage.innerHTML = spriteImg(to, 3);
    Sfx.play('catch');
    await sleep(900);
    popUI(layer);
    resolve();
  });
}

// ---------- Interaction ----------
async function interact() {
  const p = G.player;
  const [dx, dy] = DIRS[p.dir];
  let tx = p.x + dx, ty = p.y + dy;
  if (tileAt(tx, ty) === 'C') { tx += dx; ty += dy; }
  const n = npcAt(tx, ty);
  G.busy = true;
  try {
    if (n) {
      n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[p.dir];
      if (n.trainer && !G.state.flags['tr_' + n.trainer]) {
        const res = await trainerBattle(n.trainer, n);
        if (res === 'lose') await whiteout();
      } else if (n.trainer) {
        const tr = TRAINERS[n.trainer];
        await say(tr.win || '...');
      } else if (typeof n.talk === 'function') await n.talk(n);
      else if (n.talk) await say(n.talk);
      return;
    }
    const it = itemAt(tx, ty);
    if (it) {
      G.state.flags['item_' + it.id] = true;
      await giveItem(it.item, it.n);
      return;
    }
    const s = (G.map.signs || []).find(s => s.x === tx && s.y === ty);
    if (s) {
      if (s.text === '__PC__') await pcMenu();
      else await say(s.text);
    }
  } finally { G.busy = false; }
}

// ---------- Start menu & sub-menus ----------
async function openStartMenu() {
  G.busy = true;
  try {
    let start = 0;
    while (true) {
      const opts = ['VIBE-DEX', 'PARTY', 'BAG', playerName().toUpperCase(), 'SAVE', 'OPTIONS', 'CLOSE'];
      const c = await choose(opts, { cls: 'start-menu', start });
      start = Math.max(0, c);
      if (c === 0) await dexMenu();
      else if (c === 1) await partyMenu();
      else if (c === 2) await bagMenu();
      else if (c === 3) await trainerCard();
      else if (c === 4) { saveGame(); await say(`${playerName()} saved the game! (Stored in this browser.)`, { sfx: 'item' }); }
      else if (c === 5) await optionsMenu();
      else break;
    }
  } finally { G.busy = false; }
}

function monRowHtml(m) {
  const st = calcStats(m);
  return `<div class="mon-row"><img class="mini" src="${miniSprite(m.id)}"><div class="mon-row-main"><div><b>${esc(monName(m))}</b>${isHeroine(m) ? ' <span class="you">YOU</span>' : ''} <span class="lv">Lv${m.lvl}</span></div>${bar(m.hp, st.hp, 'hp')}<div class="small">${m.hp}/${st.hp} STA · ${m.en}/${maxEnergy(m)} EN</div></div></div>`;
}
const miniCache = {};
function miniSprite(id) {
  if (miniCache[id]) return miniCache[id];
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(Art.drawCreature(id), 0, 0);
  return (miniCache[id] = c.toDataURL());
}

async function partyMenu(opts = {}) {
  while (true) {
    const party = G.state.party;
    const c = await choose(party.map(m => ({ html: monRowHtml(m) })), { title: opts.title || 'Party', cls: 'party-menu' });
    if (c < 0) return -1;
    if (opts.pick) return c;
    const sub = await choose(['Summary', 'Move to front', 'Cancel'], { cls: 'sub-menu' });
    if (sub === 0) await summary(party[c]);
    else if (sub === 1 && c > 0) { const [m] = party.splice(c, 1); party.unshift(m); }
  }
}

function summaryHtml(m) {
  const sp = DEX_BY_ID[m.id], st = calcStats(m);
  const next = xpForLevel(m.lvl + 1);
  const trainStr = ['hp', 'atk', 'def', 'cha', 'spd'].map(s => `${s.toUpperCase()}+${trainBonus(m, s)}`).join(' ');
  const moves = m.moves.map(id => { const mv = MOVES[id]; return `<div class="mv"><span class="type" style="background:${TYPES[mv.type].color}">${mv.type}</span> <b>${esc(mv.name)}</b> <span class="small">${mv.cat === 'status' ? 'Status · ' + COMBAT.statusMoveEnergy + ' EN' : `${mv.cat === 'phys' ? 'Phys' : 'Charm'} ${mv.pow} · ${mv.tier}`}</span></div>`; }).join('');
  return `<div class="summary"><div class="sum-left">${spriteImg(m.id, 2)}<div>${typeBadges(sp.types)}</div><div class="small">#${String(sp.num).padStart(3, '0')} · Age ${sp.age} · ${esc(sp.height)}</div></div>
  <div class="sum-right"><div class="sum-name">${esc(sp.name)} <span class="lv">Lv${m.lvl}</span></div>
  <div class="small">XP ${m.xp} / ${next} · ${esc(sp.title)}</div>
  <table class="stats"><tr><td>STA</td><td>${m.hp}/${st.hp}</td><td>ATK</td><td>${st.atk}</td><td>DEF</td><td>${st.def}</td></tr><tr><td>EN</td><td>${m.en}/${maxEnergy(m)}</td><td>CHA</td><td>${st.cha}</td><td>SPD</td><td>${st.spd}</td></tr></table>
  <div class="small">Training bonus: ${trainStr}</div>${moves}<div class="entry">${esc(sp.entry)}</div></div></div>`;
}
function summary(m) { return showPanel(summaryHtml(m), 'wide'); }

async function bagMenu(inBattle = false) {
  while (true) {
    const keys = Object.keys(G.state.bag).filter(k => G.state.bag[k] > 0);
    if (!keys.length) { await say('Your bag is empty. Tragic.'); return null; }
    const c = await choose(keys.map(k => `${ITEMS[k].name} ×${G.state.bag[k]}`), { title: `Bag · ₵${G.state.money}`, cls: 'bag-menu', info: i => esc(ITEMS[keys[i]].desc) });
    if (c < 0) return null;
    const item = keys[c], def = ITEMS[item];
    if (def.kind === 'ball') {
      if (inBattle) return { item };
      await say("Save the Crush Balls for wild Vibemon in battle."); continue;
    }
    const target = await partyMenu({ pick: true, title: `Use ${def.name} on...` });
    if (target < 0) continue;
    const m = G.state.party[target];
    const msg = applyItem(item, m);
    if (!msg) { await say("It won't have any effect. Rude."); continue; }
    if (inBattle) return { item, target, msg };
    await say(msg, { sfx: 'heal' });
  }
}
function applyItem(item, m) {
  const def = ITEMS[item], st = calcStats(m);
  if (def.kind === 'heal') {
    if (m.hp <= 0 || m.hp >= st.hp) return null;
    const amt = Math.min(def.heal, st.hp - m.hp); m.hp += amt; G.state.bag[item]--;
    return `${monName(m)} recovered ${amt} Stamina!`;
  }
  if (def.kind === 'energy') {
    if (m.hp <= 0 || m.en >= maxEnergy(m)) return null;
    const amt = Math.min(def.en, maxEnergy(m) - m.en); m.en += amt; G.state.bag[item]--;
    return `${monName(m)} recovered ${amt} Energy!`;
  }
  if (def.kind === 'revive') {
    if (m.hp > 0) return null;
    m.hp = Math.floor(st.hp / 2); G.state.bag[item]--;
    return `${monName(m)} is having a comeback arc! Back on their feet!`;
  }
  return null;
}

async function dexMenu() {
  let start = 0;
  while (true) {
    const seen = G.state.seen, caught = G.state.caught;
    const rows = DEX.map(d => {
      const n = '#' + String(d.num).padStart(3, '0');
      if (caught.includes(d.id)) return { html: `<span class="dex-c">★</span> ${n} ${esc(d.name)}` };
      if (seen.includes(d.id)) return { html: `<span class="dex-s">○</span> ${n} ${esc(d.name)}` };
      return { html: `<span class="dex-u">·</span> ${n} ??????` };
    });
    const c = await choose(rows, { title: `Vibe-Dex  Seen ${seen.length} · Caught ${caught.length}`, cls: 'dex-menu', start,
      info: i => { const d = DEX[i]; if (!seen.includes(d.id)) return spriteImg(d.id, 2, true); return spriteImg(d.id, 2, !caught.includes(d.id)) + typeBadges(d.types); } });
    if (c < 0) return;
    start = c;
    const d = DEX[c];
    if (!seen.includes(d.id)) { await say('No data yet. Go find them!'); continue; }
    const known = caught.includes(d.id);
    await showPanel(`<div class="summary"><div class="sum-left">${spriteImg(d.id, 2, !known)}<div>${typeBadges(d.types)}</div></div><div class="sum-right">
      <div class="sum-name">#${String(d.num).padStart(3, '0')} ${esc(d.name)}</div><div class="small">${esc(d.title)}${d.heroine ? ' · Heroine' : ''}</div>
      <div class="small">Age: ${d.age} · Height: ${esc(d.height)}</div>
      <div class="entry">${known ? esc(d.entry) : 'Catch this Vibemon to read its full entry.'}</div>
      ${known && d.bio ? `<div class="entry"><b>Bio:</b> ${esc(d.bio)}</div>` : ''}</div></div>`, 'wide');
  }
}

async function trainerCard() {
  const h = DEX_BY_ID[G.state.heroine];
  const t = Math.floor(G.state.time / 60);
  await showPanel(`<div class="summary"><div class="sum-left">${spriteImg(G.state.party.find(isHeroine)?.id || h.id, 2)}</div><div class="sum-right">
    <div class="sum-name">${esc(h.full)}</div><div class="small">${esc(h.title)} · Age ${h.age}</div>
    <div class="entry">${esc(h.bio)}</div>
    <div>Clout: ₵${G.state.money} · Dex: ${G.state.caught.length} caught · Time: ${Math.floor(t / 60)}h ${t % 60}m</div>
    <div class="badges">Badges: ${G.state.badges >= 1 ? '<span class="badge-icon" title="Manager Badge">★ MANAGER BADGE</span>' : '<span class="small">none yet</span>'}</div></div></div>`, 'wide');
}

async function optionsMenu() {
  const c = await choose([`Text speed: ${['Slow', 'Normal', 'Fast'][G.textSpeed]}`, `Sound: ${G.muted ? 'Off' : 'On'}`, 'Back'], { title: 'Options' });
  if (c === 0) G.textSpeed = (G.textSpeed + 1) % 3;
  if (c === 1) G.muted = !G.muted;
}

async function openShop(stock) {
  while (true) {
    const c = await choose(stock.map(k => `${ITEMS[k].name} — ₵${ITEMS[k].price}`).concat(['Done']), { title: `You have ₵${G.state.money}`, cls: 'bag-menu', info: i => i < stock.length ? esc(ITEMS[stock[i]].desc) + ` (Own: ${G.state.bag[stock[i]] || 0})` : '' });
    if (c < 0 || c === stock.length) { await say("Clerk Marco: Come back soon, gorgeous!"); return; }
    const k = stock[c];
    const q = await choose(['×1', '×5', '×10', 'Cancel'], { title: `How many ${ITEMS[k].name}?` });
    if (q < 0 || q === 3) continue;
    const n = [1, 5, 10][q], cost = n * ITEMS[k].price;
    if (G.state.money < cost) { await say("Clerk Marco: Sweetie, your card got declined. Maybe battle a few more trainers?"); continue; }
    G.state.money -= cost; G.state.bag[k] = (G.state.bag[k] || 0) + n;
    await say(`You bought ${n}× ${ITEMS[k].name}. Retail therapy!`, { sfx: 'item' });
  }
}

async function pcMenu() {
  await say(`${playerName()} booted up the PC. Logging into the Vibe Cloud...`);
  while (true) {
    const c = await choose(['Deposit Vibemon', 'Withdraw Vibemon', 'Log off'], { title: 'Vibe Cloud Storage' });
    if (c === 0) {
      const p = await partyMenu({ pick: true, title: 'Deposit which?' });
      if (p < 0) continue;
      const m = G.state.party[p];
      if (isHeroine(m)) { await say("You can't deposit yourself into the cloud. That's a different, scarier technology."); continue; }
      if (G.state.party.length <= 1) continue;
      G.state.box.push(G.state.party.splice(p, 1)[0]);
      await say(`${monName(m)} was uploaded to the cloud.`);
    } else if (c === 1) {
      if (!G.state.box.length) { await say('The cloud is empty.'); continue; }
      if (G.state.party.length >= 6) { await say('Your party is full (6 max).'); continue; }
      const b = await choose(G.state.box.map(m => ({ html: monRowHtml(m) })), { title: 'Withdraw which?', cls: 'party-menu' });
      if (b < 0) continue;
      const m = G.state.box.splice(b, 1)[0];
      G.state.party.push(m);
      await say(`${monName(m)} rejoined the party!`);
    } else return;
  }
}

async function badgeCelebration() {
  const box = el('div', 'panel badge-panel', `<div class="badge-big">★</div><div class="evo-title">MANAGER BADGE</div><div class="small">"Let Me Speak To Your Manager" — Proof you out-entitled the Entitled.</div>`);
  const layer = { el: box, onKey: () => {} };
  pushUI(layer);
  Sfx.play('badge');
  await sleep(1800);
  popUI(layer);
}

// ---------- Save / load ----------
function saveGame() {
  G.state.x = G.player.x; G.state.y = G.player.y; G.state.dir = G.player.dir; G.state.map = G.mapId;
  localStorage.setItem(SAVE_KEY, JSON.stringify(G.state));
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function startFromState(state) {
  G.state = state;
  loadMap(state.map);
  Object.assign(G.player, { x: state.x, y: state.y, dir: state.dir || 'down', moving: false });
  G.mode = 'overworld';
}

// ---------- Title & intro ----------
async function titleScreen() {
  G.mode = 'title';
  while (true) {
    const save = loadSave();
    const opts = save ? ['Continue', 'New Game', 'Delete Save', 'How to Play'] : ['New Game', 'How to Play'];
    const c = await choose(opts, { cls: 'title-menu', cancel: false });
    const pick = opts[c];
    if (pick === 'Continue') { await fadeTo(1, 200); startFromState(save); await fadeTo(0, 200); return; }
    if (pick === 'New Game') { await newGame(); return; }
    if (pick === 'Delete Save') { const y = await choose(['Delete it', 'Keep it'], { title: 'Really delete your save?' }); if (y === 0) localStorage.removeItem(SAVE_KEY); }
    if (pick === 'How to Play') await showPanel(`<div class="howto"><h3>How to Play</h3>
      <p><b>Move:</b> Arrow keys / WASD (hold Shift to run) · <b>Talk / Confirm:</b> Z, Space or Enter · <b>Back / Menu:</b> X or Esc · <b>Menu:</b> Enter or M</p>
      <p><b>Composure combat:</b> Attacks cost <b>Stamina</b> (your HP!). Chaining attacks raises the cost (combo ×N). Energy <b>Techniques</b> — Defensive / Cautious / Counter Stance, Revitalize, Compose, Flaunt — reset the combo.</p>
      <p><b>Light</b> attacks are cheap and debuff or <b>stagger</b>; <b>heavy</b> attacks hit hard but need a cooldown. <b>Charm</b> attacks build <b>Fluster</b> — at 100 the target swoons and loses a turn. Flustered wild Vibemon are easier to catch.</p>
      <p>Stats grow from how you fight (Training bonus). Your heroine is your first party member — she fights too!</p>
      <p class="small">Adults-only parody. All characters are 21+. Suggestive, never explicit.</p></div>`, 'wide');
  }
}

async function newGame() {
  G.mode = 'intro';
  await fadeTo(1, 200);
  G.introScene = 'prof';
  await fadeTo(0, 200);
  await say([
    "???: Well, hello there, gorgeous! Welcome to the world of VIBE MONSTER!",
    "Prof. Rizzwell: My name is Rizzwell. People call me the Vibemon Professor. My ex calls me 'a lot.'",
    "Prof. Rizzwell: This world is inhabited by Vibemon: flirty, sassy creatures with more confidence than any of us deserve. All of them consenting adults, 21 and up.",
    "Prof. Rizzwell: Some people catch them. Some battle them. Some just slide into their DMs.",
    "Prof. Rizzwell: Now... tell me about yourself. Who ARE you?",
  ]);
  let chosen = null;
  while (!chosen) {
    const c = await choose(HEROINES.map(h => { const d = DEX_BY_ID[h]; return { html: `<div class="hero-card">${spriteImg(h, 2)}<div class="hero-name">${esc(d.name)}</div>${typeBadges(d.types)}<div class="small">${esc(d.title)} · ${d.age}</div></div>` }; }),
      { title: 'Choose your heroine — she is you AND your starter', cls: 'hero-select', cols: 3, cancel: false,
        info: i => { const d = DEX_BY_ID[HEROINES[i]]; return `<b>${esc(d.full)}</b> — ${esc(d.bio)}`; } });
    const d = DEX_BY_ID[HEROINES[c]];
    await say(`${d.full}: ${d.bio}`);
    const y = await choose([`Yes, I'm ${d.name}!`, 'Let me reconsider'], { title: 'Is this you?' });
    if (y === 0) chosen = HEROINES[c];
  }
  const hero = makeMon(chosen, 5, { iv: { hp: 12, atk: 12, def: 12, cha: 12, spd: 12 } });
  G.state = {
    v: 1, heroine: chosen, map: 'loft', x: 7, y: 2, dir: 'down', party: [hero], box: [],
    bag: { latte: 2 }, money: 1000, flags: {}, seen: [chosen], caught: [chosen], badges: 0, time: 0,
    lastHeal: { map: 'loft', x: 7, y: 2, dir: 'down' },
  };
  const d = DEX_BY_ID[chosen];
  await say([`Prof. Rizzwell: ${d.full}! Of course. I'd know that energy anywhere.`, "Prof. Rizzwell: Your very own Vibemon adventure is about to begin. Come see me at my lab in Thirstwater Town!", "Prof. Rizzwell: Let's get this vibe started!"]);
  await fadeTo(1, 300);
  G.introScene = null;
  startFromState(G.state);
  await fadeTo(0, 300);
  await say(`${playerName()} woke up in a sunny loft in Thirstwater Town. Today feels... flirty.`);
}

// ---------- Rendering ----------
function drawOverworld(t) {
  const p = G.player;
  let ppx = p.x, ppy = p.y;
  if (p.moving) { ppx = p.fromX + (p.x - p.fromX) * p.t; ppy = p.fromY + (p.y - p.fromY) * p.t; }
  const mw = G.map.rows[0].length, mh = G.map.rows.length;
  let camX = ppx - (VIEW_W - 1) / 2, camY = ppy - (VIEW_H - 1) / 2;
  if (mw <= VIEW_W) camX = (mw - VIEW_W) / 2; else camX = clamp(camX, 0, mw - VIEW_W);
  if (mh <= VIEW_H) camY = (mh - VIEW_H) / 2; else camY = clamp(camY, 0, mh - VIEW_H);
  ctx.fillStyle = G.map.bg === 'indoor' || G.map.bg === 'lab' ? '#1a1020' : G.map.bg === 'prison' ? '#1a1a22' : '#2f8a3a';
  ctx.fillRect(0, 0, W, H);
  const x0 = Math.floor(camX), y0 = Math.floor(camY);
  for (let y = y0; y <= y0 + VIEW_H + 1; y++) for (let x = x0; x <= x0 + VIEW_W + 1; x++) {
    if (y < 0 || x < 0 || y >= mh || x >= mw) continue;
    let ch = G.map.rows[y][x];
    if (ch === 'G' && flag(G.map.gate && G.map.gate.flag)) ch = 'g';
    ctx.drawImage(Art.tile(ch, G.map.pal, x, y, t), Math.round((x - camX) * TS), Math.round((y - camY) * TS), TS, TS);
  }
  // items
  for (const it of G.map.items || []) {
    if (G.state.flags['item_' + it.id]) continue;
    ctx.drawImage(Art.ball(it.item === 'thirsttrap' ? 'thirsttrap' : 'crushball'), Math.round((it.x - camX) * TS + 6), Math.round((it.y - camY) * TS + 6), 20, 20);
  }
  // actors sorted by y
  const actors = G.npcs.filter(n => !n.hidden).map(n => {
    let nx = n.x, ny = n.y;
    if (n.moving) { nx = n.fromX + (n.x - n.fromX) * n.moveT; ny = n.fromY + (n.y - n.fromY) * n.moveT; }
    return { y: ny, draw: () => {
      const sx = Math.round((nx - camX) * TS), sy = Math.round((ny - camY) * TS);
      ctx.drawImage(Art.charSprite(n.lookObj || Art.NPC_LOOKS.old, n.dir, n.moving ? n.frame : 0), sx, sy - 4, TS, TS);
      if (n.alert) { ctx.fillStyle = '#fff'; ctx.fillRect(sx + 10, sy - 26, 12, 18); ctx.fillStyle = '#e0321e'; ctx.font = 'bold 16px monospace'; ctx.fillText('!', sx + 12, sy - 11); }
    } };
  });
  const heroId = (G.state.party.find(isHeroine) || {}).id || G.state.heroine;
  const look = Art.heroineLook(heroId);
  actors.push({ y: ppy, draw: () => ctx.drawImage(Art.charSprite(look, p.dir, p.moving ? p.frame : 0), Math.round((ppx - camX) * TS), Math.round((ppy - camY) * TS) - 4, TS, TS) });
  actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
  if (G.map.dark) { ctx.fillStyle = `rgba(10,0,30,${G.map.dark})`; ctx.fillRect(0, 0, W, H); }
  // location banner
  if (G.bannerMap !== G.mapId) { G.bannerMap = G.mapId; G.bannerT = t; }
  if (t - G.bannerT < 2200) {
    ctx.fillStyle = 'rgba(26,16,32,0.85)'; ctx.fillRect(8, 8, Math.min(300, 16 + G.map.name.length * 9), 26);
    ctx.fillStyle = '#ffd1f0'; ctx.font = 'bold 14px monospace'; ctx.fillText(G.map.name, 16, 26);
  }
}

function drawTitle(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a0f3a'); g.addColorStop(1, '#ff4f8a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = (i * 97 + t / 30) % W, y = (i * 53 + Math.sin(t / 900 + i) * 20 + H) % H; ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.5)' : 'rgba(255,210,63,0.7)'; ctx.fillRect(x, y, 2, 2); }
  // heroines lineup
  HEROINES.forEach((h, i) => { const s = Art.drawCreature(h); ctx.drawImage(s, 40 + i * 140, 120 + Math.sin(t / 500 + i) * 4, 128, 128); });
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px monospace'; ctx.fillStyle = '#1a1020'; ctx.fillText('VIBE MONSTER', W / 2 + 3, 63);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('VIBE MONSTER', W / 2, 60);
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fff';
  ctx.fillText('Gotta Charm \'Em All · An 18+ Parody (suggestive, not explicit)', W / 2, 84);
  ctx.font = '11px monospace'; ctx.fillStyle = '#ffd1f0'; ctx.fillText('First Batch Prototype — up to Badge 1', W / 2, 102);
  ctx.textAlign = 'left';
}

function drawIntro(t) {
  ctx.fillStyle = '#1a1020'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 120, 10, W / 2, 120, 200);
  g.addColorStop(0, '#5a2a6a'); g.addColorStop(1, '#1a1020');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const look = Art.NPC_LOOKS.prof;
  ctx.drawImage(Art.charSprite(look, 'down', 0), W / 2 - 48, 50 + Math.sin(t / 400) * 3, 96, 96);
}

let lastT = performance.now();
function loop(t) {
  const dt = Math.min(50, t - lastT); lastT = t;
  G.time = t;
  if (G.state && G.mode !== 'title') G.state.time = (G.state.time || 0) + dt / 1000;
  update(dt);
  if (G.mode === 'overworld') drawOverworld(t);
  else if (G.mode === 'battle') Battle.render(ctx, t);
  else if (G.mode === 'intro') drawIntro(t);
  else drawTitle(t);
  if (G.flash) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(loop);
}

function update(dt) {
  if (G.mode !== 'overworld') return;
  const p = G.player;
  const speed = G.keysDown.has('run') ? 0.012 : 0.0072;
  if (p.moving) {
    p.t += dt * speed;
    if (p.t >= 1) { p.t = 1; p.moving = false; if (!G.busy) onStepComplete(); }
  }
  for (const n of G.npcs) {
    if (n.moving) { n.moveT += dt * 0.0065; if (n.moveT >= 1) { n.moveT = 1; n.moving = false; } }
    else if (n.wander && !G.busy && !G.ui.length && rng() < 0.004) {
      const dirs = Object.keys(DIRS); const d = dirs[Math.floor(rng() * 4)];
      const [dx, dy] = DIRS[d];
      n.dir = d;
      const nx = n.x + dx, ny = n.y + dy;
      if (Math.abs(nx - n.home.x) + Math.abs(ny - n.home.y) <= 2 && walkable(nx, ny)) { n.fromX = n.x; n.fromY = n.y; n.x = nx; n.y = ny; n.moveT = 0; n.moving = true; n.frame = (n.frame || 0) + 1; }
    }
  }
  if (!p.moving && !G.busy && !G.ui.length) {
    for (const d of ['up', 'down', 'left', 'right']) if (G.keysDown.has(d)) { tryMove(d); break; }
  }
}

// ---------- Boot ----------
function fitScreen() {
  const wrap = document.getElementById('wrap');
  const s = Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H));
  wrap.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fitScreen);
fitScreen();
requestAnimationFrame(loop);
titleScreen();

// Debug/testing hooks (only with ?debug=1)
if (PARAMS.get('debug') === '1') {
  window.VM = { G, warpTo, makeMon, healParty, giveItem, setFlag, saveGame, loadSave, Battle: () => Battle, wildEncounter, trainerBattle, checkEvolutions, rng, calcStats,
    setLevel(i, l) { const m = G.state.party[i]; m.lvl = l; m.xp = xpForLevel(l); m.moves = movesAtLevel(m.id, l); m.hp = calcStats(m).hp; m.en = maxEnergy(m); },
    addMon(id, l) { const m = makeMon(id, l); G.state.party.push(m); markCaught(id); return m; } };
}
