// Vibe Monster — procedural pixel art. No external image assets.
'use strict';

const Art = (() => {
  const cache = new Map();

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return [c, ctx];
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt)));
    g = Math.max(0, Math.min(255, Math.round(g + amt)));
    b = Math.max(0, Math.min(255, Math.round(b + amt)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Fill a vertically-defined symmetric shape: keys = [[y, halfWidth], ...]
  function rows(ctx, color, cx, keys) {
    ctx.fillStyle = color;
    for (let k = 0; k < keys.length - 1; k++) {
      const [y0, w0] = keys[k], [y1, w1] = keys[k + 1];
      for (let y = y0; y < y1 || (k === keys.length - 2 && y === y1); y++) {
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        const hw = Math.round(w0 + (w1 - w0) * t);
        if (hw > 0) ctx.fillRect(cx - hw, y, hw * 2, 1);
      }
    }
  }
  function px(ctx, color, x, y, w = 1, h = 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function line(ctx, color, x0, y0, x1, y1, w = 1) {
    ctx.fillStyle = color;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      ctx.fillRect(x - Math.floor(w / 2), y, w, 1);
    }
  }

  // ---------- Creature / heroine portraits (64x64 logical px) ----------
  function drawCreature(id) {
    if (cache.has('c:' + id)) return cache.get('c:' + id);
    const sp = DEX_BY_ID[id];
    const L = sp.look;
    const [c, ctx] = mk(64, 64);
    const rnd = seeded(hashStr(id));
    const cx = 32;
    const f = L.sex === 'f';
    const skin = L.skin, skinD = shade(skin, -40);
    const hair = L.hair, hairD = shade(hair, -45), hairL = shade(hair, 40);
    const big = !!sp.heroine && sp.id.endsWith('2');

    // Wings (behind everything)
    if (L.wings) {
      const wc = L.wingColor || '#ccc';
      if (L.wings === 'bat') {
        for (const s of [-1, 1]) {
          ctx.fillStyle = wc;
          for (let i = 0; i < 16; i++) {
            const y0 = 14 + Math.floor(i * 0.3), y1 = 30 + Math.floor(Math.sin(i / 2.5) * 3);
            ctx.fillRect(cx + s * (8 + i) - (s < 0 ? 1 : 0), y0, 1, y1 - y0);
          }
          line(ctx, shade(wc, -40), cx + s * 8, 15, cx + s * 23, 18);
        }
      } else if (L.wings === 'moth') {
        for (const s of [-1, 1]) {
          for (let r = 13; r > 0; r--) {
            ctx.fillStyle = r > 11 ? shade(wc, -50) : (r > 4 ? wc : '#f0e8ff');
            ctx.beginPath();
            ctx.fillRect(cx + s * 14 - r, 22 - r, r * 2, Math.floor(r * 1.6));
          }
          px(ctx, '#1a1222', cx + s * 14 - 1, 20, 3, 3);
        }
      } else if (L.wings === 'fairy') {
        ctx.globalAlpha = 0.75;
        for (const s of [-1, 1]) {
          rows(ctx, wc, cx + s * 14, [[8, 2], [14, 7], [22, 6], [26, 2]]);
          rows(ctx, wc, cx + s * 12, [[26, 2], [32, 5], [38, 2]]);
        }
        ctx.globalAlpha = 1;
      }
    }
    // Tail
    if (L.tail === 'devil') {
      const tc = L.tailColor || '#c00';
      line(ctx, tc, cx + 6, 32, cx + 14, 40, 2);
      line(ctx, tc, cx + 14, 40, cx + 18, 34, 2);
      px(ctx, tc, cx + 17, 31, 4, 3);
    }
    // Back hair
    const hs = L.hairStyle;
    if (hs === 'long') rows(ctx, hair, cx, [[4, 6], [12, 7], [30, 7], [38, 5]]);
    if (hs === 'wild') rows(ctx, hair, cx, [[2, 7], [10, 10], [30, 11], [42, 7], [46, 3]]);
    if (hs === 'braid') { rows(ctx, hair, cx, [[4, 6], [14, 6]]); for (let y = 14; y < 40; y += 3) px(ctx, y % 2 ? hair : hairD, cx + 4, y, 3, 3); px(ctx, L.accent || '#fff', cx + 4, 40, 3, 2); }
    if (hs === 'ponytail') { rows(ctx, hair, cx, [[4, 5], [12, 5]]); rows(ctx, hair, cx + 6, [[6, 2], [14, 3], [26, 2], [30, 1]]); }
    if (hs === 'pigtails') { for (const s of [-1, 1]) rows(ctx, hair, cx + s * 7, [[5, 2], [12, 3], [24, 2], [27, 1]]); }
    if (hs === 'buns') { for (const s of [-1, 1]) { rows(ctx, hair, cx + s * 5, [[0, 2], [2, 3], [5, 2]]); } rows(ctx, hair, cx, [[4, 5], [14, 6], [20, 4]]); }
    if (hs === 'bob') rows(ctx, hair, cx, [[3, 6], [10, 6], [15, 6]]);
    if (hs === 'karen') { rows(ctx, hair, cx, [[2, 6], [8, 7], [13, 6]]); px(ctx, hair, cx - 7, 8, 3, 9); px(ctx, hairD, cx + 4, 0, 4, 3); if (L.bigHair) { px(ctx, hair, cx - 9, 6, 3, 12); px(ctx, hairD, cx + 3, -1, 7, 4); } }
    if (hs === 'mane') rows(ctx, hair, cx, [[1, 8], [8, 11], [20, 10], [24, 6]]);

    // Legs
    const legTop = 33, legBot = 59;
    const legColor = L.furry ? hair : skin;
    for (const s of [-1, 1]) {
      const lx = cx + s * (f ? 3 : 4);
      rows(ctx, legColor, lx, [[legTop, f ? 3 : 3], [44, f ? 3 : 3], [52, 2], [legBot, 2]]);
      // shoes / heels
      px(ctx, f ? (L.bottom || '#222') : '#2a2a2a', lx - 2, legBot, 4, 2);
      if (f) px(ctx, shade(L.bottom || '#222', -30), lx + (s < 0 ? -2 : 1), legBot + 2, 1, 2);
    }
    // Torso
    const torsoF = [[15, 2], [16, 6], [18, L.busty ? 7 : 6], [22, L.busty ? 7 : 6], [26, 4], [31, 7], [34, 6]];
    const torsoM = [[15, 3], [16, 9], [21, 8], [27, 5], [31, 6], [34, 6]];
    rows(ctx, L.furry ? hair : skin, cx, f ? torsoF : torsoM);
    // Neck
    px(ctx, L.furry ? hair : skin, cx - 1, 13, 3, 3);
    // Arms
    const shoulder = f ? 6 : 9;
    const armC = L.furry ? hair : skin;
    line(ctx, armC, cx - shoulder, 17, cx - shoulder - 3, 25, 2);
    line(ctx, armC, cx - shoulder - 3, 25, cx - shoulder - 2, 32, 2);
    line(ctx, armC, cx + shoulder, 17, cx + shoulder + 4, 24, 2);
    line(ctx, armC, cx + shoulder + 4, 24, cx + (f ? 6 : 6), 29, 2);
    // Abs / bust shading
    if (!f && !L.top && !L.furry) { px(ctx, skinD, cx - 1, 21, 1, 8); px(ctx, skinD, cx - 4, 18, 3, 1); px(ctx, skinD, cx + 2, 18, 3, 1); px(ctx, skinD, cx - 3, 24, 7, 1); }

    // Outfits
    const top = L.top, bot = L.bottom, acc = L.accent || shade(top || '#888', 50);
    const bustShade = () => { if (f && L.busty && top) { px(ctx, shade(top, -35), cx, 18, 1, 4); px(ctx, shade(top, 30), cx - 4, 19, 2, 1); px(ctx, shade(top, 30), cx + 2, 19, 2, 1); } };
    switch (L.outfit) {
      case 'crop':
        rows(ctx, top, cx, [[17, 6], [18, L.busty ? 7 : 6], [22, L.busty ? 7 : 6], [23, 5]]);
        bustShade();
        rows(ctx, bot, cx, [[29, 6], [31, 7], [36, 7]]);
        px(ctx, shade(bot, -30), cx, 33, 1, 4);
        break;
      case 'leaf':
        rows(ctx, top, cx, [[18, 6], [22, 6]]); px(ctx, shade(top, -40), cx, 18, 1, 4);
        for (let x = -7; x <= 6; x += 2) px(ctx, x % 4 ? top : bot, cx + x, 29, 2, 7 + (x % 3));
        break;
      case 'gown':
        rows(ctx, top, cx, [[16, 6], [18, L.busty ? 7 : 6], [22, L.busty ? 7 : 6], [26, 4], [31, 7], [44, 10], [58, 13], [60, 13]]);
        bustShade();
        px(ctx, shade(top, 40), cx - 1, 26, 2, 30);
        if (acc) px(ctx, acc, cx - 4, 26, 8, 1);
        break;
      case 'suit':
        rows(ctx, top, cx, [[16, 6], [18, 7], [22, 7], [26, 5], [31, 7], [32, 7]]);
        rows(ctx, '#f4f4f8', cx, [[16, 2], [20, 2], [23, 1]]);
        px(ctx, acc, cx, 17, 1, 6);
        bustShade();
        rows(ctx, bot, cx, [[30, 7], [44, 6]]);
        px(ctx, shade(bot, -25), cx, 38, 1, 6);
        for (const s of [-1, 1]) rows(ctx, '#2a2a33', cx + s * 3, [[45, 2], [58, 2]]); // stockings
        break;
      case 'coat':
        rows(ctx, top, cx, [[15, 7], [18, 8], [24, 7], [30, 8], [52, 11]]);
        rows(ctx, '#e8eef8', cx, [[17, 2], [24, 3]]);
        rows(ctx, '#1a2238', cx, [[24, 3], [34, 4], [52, 5]]);
        for (const s of [-1, 1]) px(ctx, acc, cx + s * 6 - 1, 16, 3, 2);
        px(ctx, acc, cx - 8, 30, 16, 1);
        bustShade();
        for (const s of [-1, 1]) px(ctx, '#151515', cx + s * 3 - 2, 50, 4, 10);
        break;
      case 'armor':
        rows(ctx, top, cx, [[16, 6], [18, 8], [23, 7], [27, 5]]);
        px(ctx, acc, cx - 7, 23, 14, 1);
        for (const s of [-1, 1]) rows(ctx, shade(top, 25), cx + s * 8, [[15, 2], [17, 4], [20, 3]]);
        bustShade();
        rows(ctx, bot, cx, [[28, 6], [31, 8], [38, 9]]);
        for (let x = -8; x < 8; x += 3) px(ctx, shade(bot, 30), cx + x, 31, 1, 7);
        for (const s of [-1, 1]) rows(ctx, shade(top, 20), cx + s * 3, [[47, 3], [58, 3]]);
        break;
      case 'trunks':
        rows(ctx, bot, cx, [[29, 6], [35, 7]]);
        if (L.belt) px(ctx, L.belt, cx - 6, 29, 12, 2);
        break;
      case 'tank':
        rows(ctx, top, cx, [[16, 5], [17, 8], [21, 7], [28, 5]]);
        rows(ctx, skin, cx, [[16, 2], [18, 1]]);
        rows(ctx, bot, cx, [[29, 6], [39, 7]]);
        break;
      case 'cardigan':
        rows(ctx, '#f4efe4', cx, [[16, 5], [22, 6], [30, 6]]);
        rows(ctx, top, cx, [[16, 7], [18, 8], [30, 8], [32, 8]]);
        rows(ctx, '#f4efe4', cx, [[16, 2], [31, 3]]);
        bustShade();
        rows(ctx, bot, cx, [[31, 7], [50, 6]]);
        px(ctx, shade(bot, -25), cx, 36, 1, 14);
        break;
      case 'boa':
        rows(ctx, bot, cx, [[29, 6], [35, 7]]);
        for (let i = -9; i <= 9; i++) px(ctx, i % 2 ? top : shade(top, 40), cx + i, 15 + Math.abs(i) / 3, 2, 3);
        line(ctx, top, cx + 9, 18, cx + 11, 30, 2);
        break;
    }
    // Sleeves for suit/coat/cardigan/armor
    if (['suit', 'coat', 'cardigan'].includes(L.outfit)) {
      line(ctx, top, cx - shoulder, 17, cx - shoulder - 3, 25, 3);
      line(ctx, top, cx - shoulder - 3, 25, cx - shoulder - 2, 30, 3);
      line(ctx, top, cx + shoulder, 17, cx + shoulder + 4, 24, 3);
      line(ctx, top, cx + shoulder + 4, 24, cx + 7, 28, 3);
    }
    if (L.outfit === 'armor') {
      line(ctx, shade(top, 20), cx - shoulder - 3, 23, cx - shoulder - 2, 30, 3);
    }

    // Fins (merfolk)
    if (L.fins) {
      for (const s of [-1, 1]) { px(ctx, L.fins, cx + s * 5 - (s < 0 ? 2 : 0), 7, 3, 4); px(ctx, L.fins, cx + s * (shoulder + 5) - 1, 20, 2, 4); }
      if (L.bigFins) for (const s of [-1, 1]) px(ctx, shade(L.fins, 30), cx + s * 6 - (s < 0 ? 3 : 0), 5, 4, 3);
    }

    // Head
    rows(ctx, L.furry ? shade(hair, 20) : skin, cx, [[4, 3], [5, 4], [11, 4], [12, 3], [13, 2]]);
    // Face
    const eye = L.furry ? '#ffe' : '#1a1020';
    if (L.shades) {
      px(ctx, '#111', cx - 4, 7, 8, 2); px(ctx, '#ff4fa3', cx - 3, 7, 2, 1); px(ctx, '#ff4fa3', cx + 1, 7, 2, 1);
    } else {
      px(ctx, eye, cx - 3, 8, 2, 1); px(ctx, eye, cx + 1, 8, 2, 1);
      if (f) { px(ctx, eye, cx - 4, 7, 1, 1); px(ctx, eye, cx + 3, 7, 1, 1); }
      if (L.glasses) { px(ctx, '#222', cx - 4, 7, 3, 1); px(ctx, '#222', cx + 1, 7, 3, 1); px(ctx, '#222', cx - 1, 8, 2, 1); }
    }
    if (f) { px(ctx, '#d0305a', cx - 1, 11, 2, 1); px(ctx, 'rgba(255,90,120,0.5)', cx - 4, 10, 1, 1); px(ctx, 'rgba(255,90,120,0.5)', cx + 3, 10, 1, 1); }
    else px(ctx, skinD, cx - 1, 11, 3, 1);
    if (!f && !L.furry) px(ctx, skinD, cx - 3, 12, 6, 1); // jawline
    // Front hair / bangs
    if (hs === 'short') rows(ctx, hair, cx, [[2, 4], [4, 5], [6, 4]]);
    else if (hs === 'swept') { rows(ctx, hair, cx, [[1, 4], [3, 5], [5, 5]]); px(ctx, hairL, cx - 3, 2, 4, 1); }
    else if (hs === 'mane') rows(ctx, hair, cx, [[2, 6], [5, 5]]);
    else if (hs === 'karen') { rows(ctx, hair, cx, [[2, 5], [5, 5]]); px(ctx, hair, cx - 5, 5, 2, 7); px(ctx, hairL, cx - 2, 3, 5, 1); }
    else { rows(ctx, hair, cx, [[3, 4], [5, 5], [6, 5]]); px(ctx, hair, cx - 5, 6, 1, 6); px(ctx, hair, cx + 4, 6, 1, 6); px(ctx, hairL, cx - 2, 4, 3, 1); }
    if (hs === 'ponytail' || hs === 'pigtails') { px(ctx, L.accent || '#ff6fa0', cx + 5, 6, 2, 2); }

    // Horns
    if (L.horns) {
      const h = L.bigHorns ? 7 : 4;
      for (const s of [-1, 1]) for (let i = 0; i < h; i++) px(ctx, i > h - 3 ? shade(L.horns, 50) : L.horns, cx + s * (3 + Math.floor(i / 2)) - (s < 0 ? 1 : 0), 4 - i, 2, 1);
    }
    if (L.antennae) for (const s of [-1, 1]) { line(ctx, L.antennae, cx + s * 2, 3, cx + s * 6, -1); px(ctx, L.antennae, cx + s * 6 - 1, 0, 2, 2); }
    if (L.flower) { px(ctx, L.flower, cx + 3, 3, 3, 3); px(ctx, '#ffe', cx + 4, 4, 1, 1); if (L.bigFlower) { px(ctx, L.flower, cx - 6, 4, 3, 3); } }
    if (L.crown) { const cc = L.crown; px(ctx, cc, cx - 3, 1, 7, 2); px(ctx, cc, cx - 3, 0, 1, 1); px(ctx, cc, cx, -1 + 1, 1, 1); px(ctx, cc, cx + 3, 0, 1, 1); if (L.bigCrown) { px(ctx, cc, cx - 4, -1 + 1, 9, 1); px(ctx, '#ff4fa3', cx, 1, 1, 1); } }

    // Props (held in left hand around x = cx - shoulder - 2, y ~ 31)
    const hx = cx - shoulder - 2, hy = 31;
    switch (L.prop) {
      case 'halberd': line(ctx, '#8a8f99', hx, 6, hx, 60, 1); rows(ctx, '#d8e4f0', hx - 2, [[4, 1], [6, 3], [10, 2], [12, 0]]); px(ctx, acc, hx - 1, 14, 3, 2); break;
      case 'sword': rows(ctx, '#c8d0dc', hx, [[8, 1], [10, 2], [30, 2]]); px(ctx, '#5a3a1a', hx - 3, 30, 7, 2); px(ctx, '#3a2a1a', hx - 1, 32, 2, 4); px(ctx, '#4cc96b', hx - 1, 15, 2, 8); break;
      case 'scepter': line(ctx, '#ffd23f', hx, 18, hx, 38, 1); px(ctx, '#ff4fa3', hx - 2, 15, 5, 4); px(ctx, '#fff', hx - 1, 16, 1, 1); break;
      case 'latte': px(ctx, '#f4f0e8', hx - 2, hy - 4, 4, 6); px(ctx, '#c86a2a', hx - 2, hy - 2, 4, 2); px(ctx, '#2a8a3a', hx - 2, hy - 5, 4, 1); break;
      case 'dumbbell': px(ctx, '#444', hx - 4, hy - 1, 9, 2); px(ctx, '#222', hx - 5, hy - 3, 2, 6); px(ctx, '#222', hx + 4, hy - 3, 2, 6); break;
      case 'phone': px(ctx, '#222', hx - 1, hy - 5, 3, 5); px(ctx, '#7fd0ff', hx, hy - 4, 1, 3); break;
      case 'whistle': px(ctx, '#ffd23f', cx - 1, 19, 2, 2); line(ctx, '#ffd23f', cx - 3, 15, cx - 1, 19); break;
      case 'trident': line(ctx, '#ffd23f', hx, 4, hx, 56, 1); px(ctx, '#ffd23f', hx - 3, 4, 7, 1); px(ctx, '#ffd23f', hx - 3, 1, 1, 3); px(ctx, '#ffd23f', hx + 3, 1, 1, 3); px(ctx, '#ffd23f', hx, 0, 1, 4); break;
    }

    // Aura particles
    const auraCols = { flame: ['#ff5a36', '#ffb02a', '#ffe23f'], drops: ['#3fa7ff', '#bfe6ff'], leaves: ['#4cc96b', '#2f8a3a', '#ff7fb0'],
      spark: ['#ffd23f', '#ffffff'], glitter: ['#ffffff', '#ff9bd9', '#ffd23f'], rage: ['#ff2a2a', '#ff7a7a'] }[L.aura];
    if (auraCols) {
      for (let i = 0; i < 14; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const x = cx + side * (13 + Math.floor(rnd() * 15)), y = 4 + Math.floor(rnd() * 54);
        const col = auraCols[Math.floor(rnd() * auraCols.length)];
        if (L.aura === 'rage') { px(ctx, col, x, y, 3, 1); px(ctx, col, x + 1, y - 1, 1, 3); }
        else if (L.aura === 'spark' || L.aura === 'glitter') { px(ctx, col, x, y, 1, 1); px(ctx, col, x - 1, y + 1, 3, 1); px(ctx, col, x, y + 2, 1, 1); }
        else px(ctx, col, x, y, 2, L.aura === 'drops' ? 3 : 2);
      }
    }
    // Hearts for flirty vibes
    px(ctx, '#ff4f8a', 52, 6, 2, 1); px(ctx, '#ff4f8a', 55, 6, 2, 1); px(ctx, '#ff4f8a', 52, 7, 5, 1); px(ctx, '#ff4f8a', 53, 8, 3, 1); px(ctx, '#ff4f8a', 54, 9, 1, 1);

    // Outline pass
    const out = outline(c, '#1a1020');
    if (big) { /* evolved heroine forms get a subtle glow */ }
    cache.set('c:' + id, out);
    return out;
  }

  function outline(src, color) {
    const w = src.width, h = src.height;
    const [c, ctx] = mk(w, h);
    const sctx = src.getContext('2d');
    const d = sctx.getImageData(0, 0, w, h).data;
    ctx.fillStyle = color;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && d[(yy * w + xx) * 4 + 3] > 40;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) ctx.fillRect(x, y, 1, 1);
    }
    ctx.drawImage(src, 0, 0);
    return c;
  }

  function silhouette(id) {
    const key = 's:' + id;
    if (cache.has(key)) return cache.get(key);
    const src = drawCreature(id);
    const [c, ctx] = mk(64, 64);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#2a2440';
    ctx.fillRect(0, 0, 64, 64);
    cache.set(key, c);
    return c;
  }

  // ---------- Overworld character sprites (16x16 logical, drawn at 2x) ----------
  const NPC_LOOKS = {
    rival: null, // filled at runtime from rival heroine
    prof: { skin: '#e8b898', hair: '#8a8a8a', top: '#f4f4f4', bottom: '#4a3a6a', glasses: true },
    mom: { skin: '#f0c8a8', hair: '#a85a3a', top: '#ff8ab0', bottom: '#4a4a8a' },
    bro: { skin: '#e0a882', hair: '#3a2a1a', top: '#ff8a1a', bottom: '#333' },
    influencer: { skin: '#f5d0b5', hair: '#f3d36b', top: '#ff9bd9', bottom: '#fff' },
    goth: { skin: '#e8e0f0', hair: '#1a1222', top: '#1a1222', bottom: '#3a1a4a' },
    yoga: { skin: '#c88a6a', hair: '#6a3a2a', top: '#7affc8', bottom: '#2a6a5a' },
    karen: { skin: '#f2c8a8', hair: '#e8c070', top: '#7aa0c8', bottom: '#e8e0d0', karen: true },
    warden: { skin: '#e8b898', hair: '#f0d080', top: '#c84a6a', bottom: '#2a2a3a', karen: true, hat: '#2a2a3a' },
    inmate: { skin: '#f0c8a8', hair: '#d8b060', top: '#ff8a1a', bottom: '#ff8a1a', karen: true },
    nurse: { skin: '#f0c8a8', hair: '#ff8ab0', top: '#fff', bottom: '#ff8ab0' },
    clerk: { skin: '#c88a6a', hair: '#2a2a2a', top: '#4cc96b', bottom: '#333' },
    old: { skin: '#e8c0a0', hair: '#eeeeee', top: '#8a6a4a', bottom: '#5a4a3a' },
    guard: { skin: '#c88a6a', hair: '#222', top: '#3a4a6a', bottom: '#2a3a5a', hat: '#2a3a5a' },
  };

  function heroineLook(id) {
    const L = DEX_BY_ID[id].look;
    return { skin: L.skin, hair: L.hair, top: L.top || L.bottom, bottom: L.bottom, glasses: L.glasses, shades: L.shades, horns: L.horns, crown: L.crown, buns: L.hairStyle === 'buns', long: true };
  }

  function charSprite(look, dir, frame) {
    const key = 'p:' + JSON.stringify(look) + dir + frame;
    if (cache.has(key)) return cache.get(key);
    const [c, ctx] = mk(16, 16);
    const P = (col, x, y, w = 1, h = 1) => px(ctx, col, x, y, w, h);
    // shadow
    P('rgba(0,0,0,0.25)', 4, 14, 8, 2);
    // legs
    const step = frame % 2 === 1;
    P(look.bottom, 5, 11, 2, step ? 2 : 3); P(look.bottom, 9, 11, 2, step ? 3 : 2);
    P('#222', 5, step ? 13 : 14, 2, 1); P('#222', 9, step ? 14 : 13, 2, 1);
    // body
    P(look.top, 4, 7, 8, 4);
    P(look.skin, 3, 7, 1, 3); P(look.skin, 12, 7, 1, 3);
    // head
    P(look.skin, 5, 2, 6, 5);
    P(look.hair, 5, 1, 6, 2);
    if (look.long) { P(look.hair, 4, 2, 1, 6); P(look.hair, 11, 2, 1, 6); }
    if (look.buns) { P(look.hair, 4, 0, 2, 2); P(look.hair, 10, 0, 2, 2); }
    if (look.karen) { P(look.hair, 4, 1, 2, 5); P(look.hair, 9, 0, 3, 1); }
    if (look.hat) P(look.hat, 4, 0, 8, 2);
    if (look.horns) { P(look.horns, 4, 0, 1, 2); P(look.horns, 11, 0, 1, 2); }
    if (look.crown) P(look.crown, 6, 0, 4, 1);
    if (dir === 'up') { P(look.hair, 5, 2, 6, 4); }
    else {
      const ex = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      if (look.shades) P('#111', 6 + ex, 4, 4, 1);
      else { P('#1a1020', 6 + ex, 4, 1, 1); P('#1a1020', 9 + ex, 4, 1, 1); }
      if (look.glasses) { P('#444', 5 + ex, 4, 1, 1); P('#444', 10 + ex, 4, 1, 1); }
      if (dir === 'left') P(look.hair, 10, 2, 1, 4);
      if (dir === 'right') P(look.hair, 5, 2, 1, 4);
    }
    const out = outline(c, '#1a1020');
    cache.set(key, out);
    return out;
  }

  // ---------- Tiles (16x16 logical, drawn 2x) ----------
  const PAL = {
    town: { grass: '#7cd36b', grass2: '#5fbf5a', path: '#e8d6a0', path2: '#d8c088', tree: '#2f8a3a', tree2: '#1f6a2a', trunk: '#6a4a2a' },
    forest: { grass: '#3f8a4a', grass2: '#2f7a3a', path: '#b89a6a', path2: '#a88a5a', tree: '#1a5a3a', tree2: '#0f3f2a', trunk: '#4a2a1a' },
    city: { grass: '#8adb7a', grass2: '#6fca6a', path: '#d8d0e0', path2: '#c0b8d0', tree: '#2f9a4a', tree2: '#1f7a3a', trunk: '#6a4a2a' },
  };

  function tile(ch, palName, x, y, t) {
    const key = 't:' + ch + palName + ((x * 7 + y * 13) % 4) + (ch === '~' || ch === ',' ? Math.floor(t / 500) % 2 : 0);
    if (cache.has(key)) return cache.get(key);
    const pal = PAL[palName] || PAL.town;
    const [c, ctx] = mk(16, 16);
    const P = (col, x0, y0, w = 1, h = 1) => px(ctx, col, x0, y0, w, h);
    const v = (x * 7 + y * 13) % 4;
    const anim = Math.floor(t / 500) % 2;
    const grass = () => { P(pal.grass, 0, 0, 16, 16); P(pal.grass2, (v * 5) % 13, (v * 3) % 12 + 1, 1, 2); P(pal.grass2, (v * 9 + 6) % 14, (v * 7 + 5) % 13, 1, 2); };
    switch (ch) {
      case '.': grass(); break;
      case 'F': grass(); for (const [fx, fy, fc] of [[3, 4, '#ff7fb0'], [10, 9, '#ffd23f'], [6, 12, '#ffffff']]) { P(fc, fx, fy, 2, 2); P('#c8306a', fx, fy + 2, 1, 1); } break;
      case ',': P(pal.grass, 0, 0, 16, 16); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const bx = i * 4 + (j ? 2 : 0), by = j * 8 + 2; P(pal.tree, bx, by + 2, 3, 5); P(pal.grass2, bx + (anim && j ? 1 : 0), by, 1, 3); P(pal.grass2, bx + 2, by + 1, 1, 3); } break;
      case '=': P(pal.path, 0, 0, 16, 16); P(pal.path2, (v * 5) % 14, (v * 3) % 14, 2, 1); P(pal.path2, (v * 11 + 3) % 14, (v * 7 + 8) % 14, 1, 1); break;
      case 'T': grass(); P(pal.trunk, 6, 11, 4, 4); rows(ctx, pal.tree2, 8, [[1, 3], [4, 6], [10, 7], [12, 5]]); rows(ctx, pal.tree, 8, [[1, 2], [4, 5], [9, 6], [11, 3]]); P(shade(pal.tree, 40), 5, 4, 2, 2); break;
      case '~': P('#3a8ae0', 0, 0, 16, 16); P('#7fc0ff', anim ? 2 : 5, 4, 4, 1); P('#7fc0ff', anim ? 9 : 7, 10, 5, 1); break;
      case '#': P('#8a8a9a', 0, 0, 16, 16); P('#6a6a7a', 0, 7, 16, 1); P('#6a6a7a', 7, 0, 1, 7); P('#6a6a7a', 3, 8, 1, 8); P('#6a6a7a', 12, 8, 1, 8); break;
      case 'R': P('#d04a5a', 0, 0, 16, 16); for (let r = 0; r < 16; r += 4) P('#a8384a', 0, r + 3, 16, 1); break;
      case 'r': P('#4a6ad0', 0, 0, 16, 16); for (let r = 0; r < 16; r += 4) P('#3a50a8', 0, r + 3, 16, 1); break;
      case 'p': P('#5a5a6a', 0, 0, 16, 16); for (let r = 0; r < 16; r += 4) P('#4a4a5a', 0, r + 3, 16, 1); break;
      case 'H': P('#f4e8d0', 0, 0, 16, 16); P('#d8c8a8', 0, 15, 16, 1); break;
      case 'W': P('#f4e8d0', 0, 0, 16, 16); P('#5a8ad0', 4, 4, 8, 7); P('#bfe6ff', 5, 5, 3, 2); P('#6a4a2a', 3, 11, 10, 1); break;
      case 'D': P('#f4e8d0', 0, 0, 16, 16); P('#8a5a3a', 3, 3, 10, 13); P('#6a3a2a', 3, 3, 10, 1); P('#ffd23f', 10, 9, 2, 2); break;
      case 'G': P('#7a7a8a', 0, 0, 16, 16); P('#5a5a6a', 2, 3, 12, 13); for (let i = 3; i < 14; i += 3) P('#2a2a3a', i, 3, 1, 13); break;
      case 'Y': P('#7a7a8a', 0, 0, 16, 16); P('#ff8a1a', 0, 6, 16, 3); P('#2a2a3a', 0, 0, 16, 1); break;
      case 'S': grass(); P('#6a4a2a', 7, 9, 2, 6); P('#8a6a4a', 2, 3, 12, 7); P('#5a3a2a', 2, 3, 12, 1); P('#f4e8d0', 4, 5, 8, 1); P('#f4e8d0', 4, 7, 6, 1); break;
      case 'o': grass(); P('#ff4f8a', 5, 5, 6, 6); P('#ffffff', 5, 8, 6, 1); P('#ffd1e0', 6, 6, 2, 1); break;
      // interiors
      case '_': P('#e8d0a8', 0, 0, 16, 16); P('#d8c098', 0, 7, 16, 1); P('#d8c098', 0, 15, 16, 1); P('#d8c098', v * 4, 0, 1, 7); break;
      case 'g': P('#9a9aa8', 0, 0, 16, 16); P('#8a8a98', 0, 15, 16, 1); P('#8a8a98', 15, 0, 1, 16); break;
      case 'k': P('#c8c0d8', 0, 0, 16, 16); P('#b8b0c8', 0, 0, 8, 8); P('#b8b0c8', 8, 8, 8, 8); break;
      case 'B': P('#c8a8d8', 0, 0, 16, 16); P('#a888b8', 0, 12, 16, 4); P('#e8d8f0', 0, 0, 16, 1); break;
      case 'X': P('#5a5a6a', 0, 0, 16, 16); P('#4a4a5a', 0, 12, 16, 4); P('#6a6a7a', 0, 0, 16, 1); P('#ff8a1a', 0, 8, 16, 1); break;
      case 'I': P('#9a9aa8', 0, 0, 16, 16); for (let i = 1; i < 16; i += 3) P('#2a2a3a', i, 0, 1, 16); P('#2a2a3a', 0, 2, 16, 1); P('#2a2a3a', 0, 13, 16, 1); break;
      case 'C': P('#e8d0a8', 0, 0, 16, 16); P('#a85a3a', 0, 4, 16, 12); P('#c87a5a', 0, 4, 16, 2); break;
      case 'K': P('#6a4a2a', 0, 0, 16, 16); for (let r = 2; r < 16; r += 5) { P('#4a2a1a', 0, r + 3, 16, 1); for (let b = 1; b < 15; b += 3) P(['#d04a5a', '#4a6ad0', '#4cc96b', '#ffd23f'][(b + r) % 4], b, r, 2, 3); } break;
      case 'b': P('#e8d0a8', 0, 0, 16, 16); P('#ff8ab0', 2, 2, 12, 13); P('#ffffff', 3, 3, 10, 4); break;
      case 'P': P('#e8d0a8', 0, 0, 16, 16); P('#4a4a5a', 3, 2, 10, 10); P('#7fd0ff', 4, 3, 8, 6); P('#2a2a3a', 5, 12, 6, 3); break;
      case 't': P('#e8d0a8', 0, 0, 16, 16); P('#8a5a3a', 1, 3, 14, 10); P('#a87a5a', 1, 3, 14, 2); break;
      case 'm': P('#e8d0a8', 0, 0, 16, 16); P('#d04a5a', 2, 4, 12, 8); P('#ffd23f', 3, 5, 10, 1); break;
      case 'H2': break;
      case 'V': P('#ff8ab0', 0, 0, 16, 16); P('#ffffff', 2, 4, 12, 8); P('#ff4f8a', 6, 5, 4, 1); P('#ff4f8a', 7, 4, 2, 3); break; // spa sign
      case 'M': P('#7a5ad0', 0, 0, 16, 16); P('#ffffff', 2, 4, 12, 8); P('#7a5ad0', 4, 6, 8, 1); P('#7a5ad0', 4, 8, 6, 1); break; // boutique sign
      case 'J': P('#3a3a4a', 0, 0, 16, 16); P('#ff8a1a', 1, 4, 14, 8); P('#2a2a3a', 3, 6, 10, 1); P('#2a2a3a', 3, 9, 8, 1); break; // prison sign
      default: P('#ff00ff', 0, 0, 16, 16);
    }
    cache.set(key, c);
    return c;
  }

  function ball(kind) {
    const key = 'b:' + kind;
    if (cache.has(key)) return cache.get(key);
    const [c, ctx] = mk(10, 10);
    const col = kind === 'thirsttrap' ? '#7a5ad0' : '#ff4f8a';
    rows(ctx, col, 5, [[1, 2], [2, 4], [5, 4]]);
    rows(ctx, '#ffffff', 5, [[5, 4], [7, 4], [9, 2]]);
    px(ctx, '#1a1020', 1, 5, 8, 1); px(ctx, '#ffd23f', 4, 4, 2, 2);
    const out = outline(c, '#1a1020');
    cache.set(key, out);
    return out;
  }

  return { drawCreature, silhouette, charSprite, tile, ball, NPC_LOOKS, heroineLook, shade, seeded, hashStr };
})();
