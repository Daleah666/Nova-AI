// Vibe Monster — "Composure" battle system.
// Stamina doubles as HP and is spent by attacks; chained attacks cost more. Energy powers
// stances/techniques and resets the chain. Light attacks debuff/stagger, heavy attacks have
// cooldowns, charm builds Fluster (swoon at 100), and stats grow with use.
'use strict';

const Battle = (() => {
  let B = null;
  const FAIL_CATCH = ["Oh no! They swiped left and broke free!", "Aww! They left you on 'read.'", "Argh! They were SO into it!", "Shoot! So close! They just want to be friends."];

  function newSide(mon) {
    return { mon, stages: { atk: 0, def: 0, cha: 0, spd: 0 }, stance: null, stanceTurns: 0, chain: 0, cd: {}, stagger: 0, swoon: false, countered: false, offX: 0, offY: 0, alpha: 1, flashUntil: 0, scale: 1 };
  }
  const party = () => G.state.party;
  const nameOf = (side) => side === B.e ? (B.kind === 'wild' ? 'Wild ' + monName(side.mon) : 'Foe ' + monName(side.mon)) : monName(side.mon);
  const stageMul = (s) => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

  function effStats(side) {
    const st = calcStats(side.mon);
    return { hp: st.hp, atk: st.atk * stageMul(side.stages.atk), def: st.def * stageMul(side.stages.def), cha: st.cha * stageMul(side.stages.cha), spd: st.spd * stageMul(side.stages.spd) * (side.stagger ? 0.5 : 1) };
  }

  function staminaCost(side, mv) {
    if (mv.cat === 'status') return 0;
    const max = calcStats(side.mon).hp;
    return Math.max(1, Math.round(max * COMBAT.staminaCost[mv.tier || 'normal'] * Math.pow(COMBAT.chainGrowth, Math.min(side.chain, COMBAT.chainCap))));
  }

  function float(side, text, color) {
    const isE = side === B.e;
    B.floats.push({ x: isE ? 370 : 130, y: isE ? 70 : 150, text, color, t0: performance.now() });
  }

  async function tween(ms, fn) {
    const t0 = performance.now();
    while (true) { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); if (t >= 1) break; await sleep(16); }
  }

  function firstAliveIdx() { return party().findIndex(m => m.hp > 0); }

  // ---------- Entry ----------
  function start(cfg) {
    const pi = Math.max(0, firstAliveIdx());
    B = { cfg, kind: cfg.kind, enemies: cfg.enemies, ei: 0, trainer: cfg.trainer, bg: cfg.bg || 'route', participants: new Set(), runs: 0, floats: [], ball: null, over: false };
    B.p = newSide(party()[pi]);
    B.e = newSide(B.enemies[0]);
    B.p.offX = -260; B.e.offX = 260;
    B.participants.add(B.p.mon);
    return run();
  }

  async function run() {
    await tween(450, t => { B.p.offX = -260 * (1 - t); B.e.offX = 260 * (1 - t); });
    if (B.kind === 'wild') await say(`A wild ${monName(B.e.mon)} appeared! ${wildFlavor(B.e.mon)}`);
    else {
      await say(`${B.trainer.cls} ${B.trainer.name} wants to battle!`);
      await say(`${B.trainer.name} sent out ${monName(B.e.mon)}!`);
    }
    await say(isHeroine(B.p.mon) ? `${monName(B.p.mon)} steps up, ready to fight!` : `Go, ${monName(B.p.mon)}! Werk it!`);
    let result = null;
    while (!result) result = await turn();
    B.over = true;
    // Post-battle: energy partially restores, fluster resets
    for (const m of party()) { m.fluster = 0; if (m.hp > 0) m.en = Math.min(maxEnergy(m), m.en + Math.ceil(maxEnergy(m) * 0.4)); }
    if (result === 'win' && B.kind === 'trainer') {
      await say(B.trainer.win || `${B.trainer.name}: ...`);
      const prize = B.trainer.prize * B.enemies[B.enemies.length - 1].lvl;
      G.state.money += prize;
      await say(`${playerName()} got ₵${prize} in Clout for winning!`, { sfx: 'item' });
    }
    if (result === 'lose' && B.kind === 'trainer' && B.trainer.lose) await say(B.trainer.lose);
    await sleep(100);
    return result;
  }

  function wildFlavor(m) {
    const lines = { basicbecca: 'She\'s filming a TikTok about you.', chaddeus: 'He\'s flexing aggressively.', voltina: 'She\'s vibrating. Literally.', emberella: 'She says you look like a hot take.',
      kareniac: 'She wants to speak to your manager.', mothrina: 'She\'s staring at your phone light.', sassquatch: 'He\'s posing for a blurry photo.', glamazonia: 'She struts in. Everyone gasps.',
      fernanda: 'She asks if you\'ve watered yourself today.', splashton: 'He shakes his wet hair in slow motion.' };
    return lines[m.id] || 'It winks at you.';
  }

  // ---------- Turn ----------
  async function turn() {
    const pAct = B.p.swoon ? { type: 'skip' } : await playerChoose();
    if (pAct.type === 'run') {
      if (B.kind !== 'wild') { await say("No running from a trainer battle! That's called ghosting."); return null; }
      B.runs++;
      const ps = effStats(B.p).spd, es = effStats(B.e).spd;
      if (rng() < clamp(0.5 + (ps - es) / (2 * es) + 0.15 * (B.runs - 1), 0.25, 1)) { await say('Got away safely! Playing hard to get.'); return 'run'; }
      await say("Couldn't get away! They're clingy.");
      const r = await act(B.e, B.p, enemyChoose());
      if (r) return r;
      return endTurn();
    }
    const eAct = enemyChoose();
    const pri = (a) => (a.type === 'move' ? 0 : a.type === 'skip' ? 0 : 1);
    let order;
    if (pri(pAct) !== pri(eAct)) order = pri(pAct) > pri(eAct) ? ['p', 'e'] : ['e', 'p'];
    else {
      const ps = effStats(B.p).spd, es = effStats(B.e).spd;
      order = ps > es || (ps === es && rng() < 0.5) ? ['p', 'e'] : ['e', 'p'];
    }
    for (const who of order) {
      const side = who === 'p' ? B.p : B.e;
      if (side.mon.hp <= 0) continue;
      const r = await act(side, who === 'p' ? B.e : B.p, who === 'p' ? pAct : eAct);
      if (r) return r;
    }
    return endTurn();
  }

  async function endTurn() {
    for (const s of [B.p, B.e]) {
      if (s.stance && --s.stanceTurns <= 0) { await say(`${nameOf(s)}'s ${TECHNIQUES[s.stance].name} wore off.`); s.stance = null; }
      if (s.stagger > 0) s.stagger--;
      for (const k of Object.keys(s.cd)) if (s.cd[k] > 0) s.cd[k]--;
      s.countered = false;
    }
    return null;
  }

  // Run one action; returns 'win' | 'lose' | 'caught' | null
  async function act(side, foe, a) {
    if (a.type === 'switch') { await doSwitch(a.idx); return null; }
    if (a.type === 'item') {
      await say(`${playerName()} used ${ITEMS[a.item].name}!`);
      if (a.msg) await say(a.msg, { sfx: 'heal' });
      return null;
    }
    if (a.type === 'ball') return await throwBall(a.item);
    if (side.swoon) {
      side.swoon = false;
      float(side, '♡ ♡ ♡', '#ff4f8a');
      await say(`${nameOf(side)} is too flustered to do anything but blush!`);
      return null;
    }
    if (a.type === 'skip') return null;
    if (a.type === 'tech') await useTechnique(side, foe, a.id);
    else await useMove(side, foe, a.id);
    return await checkFaints();
  }

  // ---------- Player choices ----------
  function infoBoxHtml(side) {
    const m = side.mon;
    return `<b>${esc(monName(m))}</b> · STA ${m.hp}/${calcStats(m).hp} · EN ${m.en}/${maxEnergy(m)} · Fluster ${m.fluster}/100${side.chain ? ` · Combo ×${side.chain}` : ''}`;
  }

  async function playerChoose() {
    while (true) {
      const c = await choose(['FIGHT', 'TECHNIQUE', 'BAG', 'PARTY', 'RUN'], { cls: 'battle-menu', cols: 2, cancel: false, title: `What will ${monName(B.p.mon)} do?`,
        info: () => infoBoxHtml(B.p) });
      if (c === 0) {
        const m = B.p.mon;
        const mvs = m.moves.map(id => MOVES[id]);
        const disabled = (i) => (B.p.cd[m.moves[i]] > 0) || (mvs[i].cat === 'status' && m.en < COMBAT.statusMoveEnergy);
        const mi = await choose(mvs.map((mv, i) => ({ html: `<span class="type-dot" style="background:${TYPES[mv.type].color}"></span>${esc(mv.name)}${B.p.cd[m.moves[i]] > 0 ? ` <span class="cd">CD${B.p.cd[m.moves[i]]}</span>` : ''}` })),
          { cls: 'battle-menu moves', cols: 2, disabled, title: 'Moves',
            info: i => { const mv = mvs[i]; const eff = mv.cat === 'status' ? '' : effText(typeMult(mv.type, DEX_BY_ID[B.e.mon.id].types));
              const cost = mv.cat === 'status' ? `${COMBAT.statusMoveEnergy} EN (resets combo)` : `${staminaCost(B.p, mv)} STA${B.p.chain ? ` (combo ×${B.p.chain})` : ''}`;
              return `<span class="type" style="background:${TYPES[mv.type].color}">${mv.type}</span> ${mv.cat === 'status' ? 'Status' : (mv.cat === 'phys' ? 'Phys' : 'Charm') + ' ' + mv.pow + ' · ' + mv.tier} · Acc ${mv.acc} · Cost: ${cost} ${eff ? '· <b>' + eff + '</b>' : ''}<br><span class="small">${esc(mv.desc)}</span>`; } });
        if (mi < 0) continue;
        return { type: 'move', id: m.moves[mi] };
      }
      if (c === 1) {
        const keys = Object.keys(TECHNIQUES);
        const ti = await choose(keys.map(k => `${TECHNIQUES[k].name} (${TECHNIQUES[k].en} EN)`), { cls: 'battle-menu techs', cols: 2, title: `Techniques · EN ${B.p.mon.en}/${maxEnergy(B.p.mon)}`,
          disabled: i => B.p.mon.en < TECHNIQUES[keys[i]].en, info: i => esc(TECHNIQUES[keys[i]].desc) + '<br><span class="small">All techniques reset your attack combo.</span>' });
        if (ti < 0) continue;
        return { type: 'tech', id: keys[ti] };
      }
      if (c === 2) {
        const r = await bagMenu(true);
        if (!r) continue;
        if (ITEMS[r.item].kind === 'ball') {
          if (B.kind !== 'wild') { await say("You can't catch another trainer's Vibemon! That's called stealing. And it's weird."); continue; }
          return { type: 'ball', item: r.item };
        }
        return { type: 'item', item: r.item, msg: r.msg };
      }
      if (c === 3) {
        const idx = await partyMenu({ pick: true, title: 'Switch to...' });
        if (idx < 0) continue;
        const m = party()[idx];
        if (m === B.p.mon) { await say(`${monName(m)} is already out there serving looks!`); continue; }
        if (m.hp <= 0) { await say(`${monName(m)} is knocked out and needs a nap.`); continue; }
        return { type: 'switch', idx };
      }
      if (c === 4) return { type: 'run' };
    }
  }

  function effText(m) { return m >= 2 ? 'Super effective' : m === 0 ? 'No effect' : m < 1 ? 'Not very effective' : ''; }

  // ---------- Enemy AI ----------
  function enemyChoose() {
    const e = B.e, m = e.mon, st = calcStats(m);
    if (e.swoon) return { type: 'skip' };
    const smart = B.kind === 'trainer';
    const can = (k) => m.en >= TECHNIQUES[k].en;
    if (smart) {
      if (m.hp < st.hp * 0.35 && can('revitalize') && rng() < 0.4) return { type: 'tech', id: 'revitalize' };
      if (m.fluster >= 70 && can('compose') && rng() < 0.5) return { type: 'tech', id: 'compose' };
      if (e.chain >= 3 && rng() < 0.6) {
        const opts = ['defensive', 'counter', 'flaunt', 'cautious'].filter(can);
        if (opts.length) return { type: 'tech', id: opts[Math.floor(rng() * opts.length)] };
      }
      if (!e.stance && rng() < 0.12) { const opts = ['defensive', 'counter', 'flaunt'].filter(can); if (opts.length) return { type: 'tech', id: opts[Math.floor(rng() * opts.length)] }; }
    } else if (rng() < 0.12) {
      const opts = ['flaunt', 'cautious', 'defensive'].filter(can);
      if (opts.length) return { type: 'tech', id: opts[Math.floor(rng() * opts.length)] };
    }
    const usable = m.moves.filter(id => !(e.cd[id] > 0) && (MOVES[id].cat !== 'status' || m.en >= COMBAT.statusMoveEnergy));
    if (!usable.length) return can('compose') ? { type: 'tech', id: 'compose' } : { type: 'move', id: 'smack' };
    if (!smart) return { type: 'move', id: usable[Math.floor(rng() * usable.length)] };
    const ps = effStats(B.p), es = effStats(e);
    const scored = usable.map(id => {
      const mv = MOVES[id];
      if (mv.cat === 'status') {
        let s = 18;
        if (mv.self) s = Object.keys(mv.self).some(k => e.stages[k] < 2) ? 26 : 2;
        if (mv.foe) s = B.p.stance === 'defensive' ? 2 : 22;
        if (mv.fluster) s = 20 + B.p.mon.fluster / 3;
        return { id, s: s * (0.7 + rng() * 0.6) };
      }
      const stab = DEX_BY_ID[m.id].types.includes(mv.type) ? 1.5 : 1;
      const ratio = mv.cat === 'phys' ? es.atk / ps.def : es.cha / ps.cha;
      return { id, s: mv.pow * stab * typeMult(mv.type, DEX_BY_ID[B.p.mon.id].types) * ratio * mv.acc / 100 * (0.75 + rng() * 0.5) };
    });
    scored.sort((a, b) => b.s - a.s);
    return { type: 'move', id: rng() < 0.8 ? scored[0].id : scored[Math.floor(rng() * scored.length)].id };
  }

  // ---------- Actions ----------
  async function useMove(att, def, id) {
    const mv = MOVES[id], a = att.mon, d = def.mon;
    await say(`${nameOf(att)} used ${mv.name}!`, { auto: 450 });
    if (mv.cat === 'status') {
      a.en = Math.max(0, a.en - COMBAT.statusMoveEnergy);
      att.chain = 0;
      float(att, `-${COMBAT.statusMoveEnergy} EN`, '#7fd0ff');
      const targetsFoe = mv.foe || mv.fluster;
      if (targetsFoe && rng() * 100 >= mv.acc * (att.stagger ? 0.8 : 1)) { await say('But it missed! Awkward.'); return; }
      if (mv.self) await applyStages(att, mv.self, true);
      if (mv.foe) {
        if (def.stance === 'defensive') await say(`${nameOf(def)}'s Defensive Stance shrugged it off!`);
        else await applyStages(def, mv.foe, false);
      }
      if (mv.fluster) await addFluster(def, mv.fluster);
      return;
    }
    // Pay stamina; chaining attacks gets pricier.
    let cost = staminaCost(att, mv);
    if (a.hp - cost < 1) cost = Math.max(0, a.hp - 1);
    a.hp -= cost; att.chain++;
    if (cost) float(att, `-${cost} STA`, '#ffd23f');
    if (mv.tier === 'heavy') att.cd[id] = COMBAT.heavyCooldown + 1;
    a.train[mv.cat === 'phys' ? 'atk' : 'cha']++;
    await lunge(att);

    let hitChance = mv.acc / 100 * (att.stagger ? 0.8 : 1);
    if (def.stance === 'cautious') hitChance *= 0.55;
    let graze = false;
    if (rng() >= hitChance) {
      if (def.stance === 'cautious') {
        d.train.spd++;
        if (rng() < 0.5) graze = true;
        else { await say(`${nameOf(def)} gracefully dodged!`); return; }
      } else { await say(`${nameOf(att)}'s attack missed! Embarrassing.`); return; }
    }
    const tm = typeMult(mv.type, DEX_BY_ID[d.id].types);
    const crit = !graze && rng() < 1 / 16;
    let dmg = calcDamage(att, def, mv, crit);
    if (graze) dmg = Math.max(1, Math.floor(dmg * 0.3));
    d.hp = Math.max(0, d.hp - dmg);
    if (def.stance === 'defensive') d.train.def++;
    await hitAnim(def, dmg, tm);
    if (graze) await say(`${nameOf(def)} was only grazed!`);
    if (crit) await say('A critical hit! Devastating.');
    if (tm >= 2) await say("It's super effective! Absolutely rocked.");
    else if (tm > 0 && tm < 1) await say("It's not very effective... they're unbothered.");
    if (d.hp <= 0) return;
    if (mv.cat === 'charm') await addFluster(def, COMBAT.charmFluster(mv.pow));
    if (mv.fx && !graze) {
      if (def.stance === 'defensive') await say(`${nameOf(def)}'s guard holds firm!`);
      else {
        if (mv.fx.stagger) { def.stagger = 2; await say(`${nameOf(def)} is staggered! (slower, less accurate)`); }
        if (mv.fx.foe) await applyStages(def, mv.fx.foe, false);
      }
    }
    if (def.stance === 'counter' && !def.countered && d.hp > 0 && rng() < 0.6) await counterAttack(def, att);
  }

  function calcDamage(att, def, mv, crit) {
    const as = effStats(att), ds = effStats(def);
    const A = mv.cat === 'phys' ? as.atk : as.cha;
    const D = mv.cat === 'phys' ? ds.def : ds.cha;
    const L = att.mon.lvl;
    let dmg = ((2 * L / 5 + 2) * mv.pow * A / D) / 50 + 2;
    const stab = DEX_BY_ID[att.mon.id].types.includes(mv.type) ? 1.5 : 1;
    dmg *= stab * typeMult(mv.type, DEX_BY_ID[def.mon.id].types) * (crit ? 1.5 : 1) * (0.85 + rng() * 0.15);
    if (def.stance === 'defensive') dmg *= 0.6;
    return Math.max(1, Math.floor(dmg));
  }

  async function counterAttack(def, att) {
    def.countered = true;
    const base = def.mon.moves.map(id => MOVES[id]).find(m => m.cat !== 'status') || MOVES.smack;
    const mv = { name: 'Counter', type: base.type, cat: 'phys', pow: 50, tier: 'light' };
    let cost = staminaCost(def, mv);
    if (def.mon.hp - cost < 1) cost = Math.max(0, def.mon.hp - 1);
    def.mon.hp -= cost;
    def.mon.train.atk++;
    await say(`${nameOf(def)} counters!`, { auto: 400 });
    await lunge(def);
    const dmg = calcDamage(def, att, mv, false);
    att.mon.hp = Math.max(0, att.mon.hp - dmg);
    await hitAnim(att, dmg, typeMult(mv.type, DEX_BY_ID[att.mon.id].types));
  }

  async function applyStages(side, ch, self) {
    const names = { atk: 'ATK', def: 'DEF', cha: 'CHA', spd: 'SPD' };
    for (const [k, v] of Object.entries(ch)) {
      const before = side.stages[k];
      side.stages[k] = clamp(before + v, -6, 6);
      if (side.stages[k] === before) await say(`${nameOf(side)}'s ${names[k]} won't go any ${v > 0 ? 'higher' : 'lower'}!`);
      else await say(`${nameOf(side)}'s ${names[k]} ${v > 0 ? (v > 1 ? 'rose sharply' : 'rose') : (v < -1 ? 'harshly fell' : 'fell')}!`, { auto: 500 });
    }
  }

  async function addFluster(side, amt) {
    const m = side.mon;
    if (m.hp <= 0) return;
    if (side.stance === 'defensive') amt = Math.floor(amt / 2);
    m.fluster = Math.min(COMBAT.swoonAt, m.fluster + amt);
    float(side, `+${amt} ♡`, '#ff7fb0');
    if (m.fluster >= COMBAT.swoonAt) {
      m.fluster = 0;
      side.swoon = true;
      m.en = Math.max(0, m.en - Math.floor(maxEnergy(m) * 0.25));
      Sfx.play('swoon');
      for (let i = 0; i < 3; i++) setTimeout(() => B && float(side, '♡', '#ff4f8a'), i * 150);
      await say(`${nameOf(side)} is completely flustered and SWOONS! ♡ They'll lose their next action.`);
    }
  }

  async function useTechnique(side, foe, id) {
    const t = TECHNIQUES[id], m = side.mon;
    m.en = Math.max(0, m.en - t.en);
    side.chain = 0;
    float(side, `-${t.en} EN`, '#7fd0ff');
    if (t.stance) {
      side.stance = t.stance;
      side.stanceTurns = COMBAT.stanceTurns;
      if (t.stance === 'defensive') {
        side.stagger = 0;
        for (const k of Object.keys(side.stages)) side.stages[k] = Math.max(0, side.stages[k]);
      }
      const flav = { defensive: 'braces, chin up, unbothered', cautious: 'gets light on their feet', counter: 'smirks and waits for an opening' }[t.stance];
      await say(`${nameOf(side)} takes a ${t.name} — ${flav}!`);
      return;
    }
    if (id === 'revitalize') {
      const st = calcStats(m);
      const amt = Math.min(st.hp - m.hp, Math.ceil(st.hp * 0.3));
      m.hp += amt; m.train.hp++;
      float(side, `+${amt} STA`, '#7fff9a');
      await say(`${nameOf(side)} catches their breath and Revitalizes! (+${amt} Stamina)`, { sfx: 'heal' });
    } else if (id === 'compose') {
      m.fluster = Math.max(0, m.fluster - 50);
      await say(`${nameOf(side)} fixes their hair and Composes themself.`);
    } else if (id === 'flaunt') {
      const lines = ['strikes a pose', 'does a slow hair flip', 'blows a kiss', 'winks over a shoulder'];
      await say(`${nameOf(side)} ${lines[Math.floor(rng() * lines.length)]}!`);
      await addFluster(foe, 25);
    }
  }

  async function doSwitch(idx) {
    const out = B.p;
    if (out.mon.hp > 0) await say(`${monName(out.mon)}, come back! You did great, babe.`);
    await tween(250, t => { out.offX = -260 * t; });
    B.p = newSide(party()[idx]);
    B.p.offX = -260;
    B.participants.add(B.p.mon);
    await tween(250, t => { B.p.offX = -260 * (1 - t); });
    await say(isHeroine(B.p.mon) ? `${monName(B.p.mon)} steps back into the fight!` : `Go, ${monName(B.p.mon)}! Serve!`);
  }

  // ---------- Faint / XP ----------
  async function checkFaints() {
    if (B.e.mon.hp <= 0) {
      Sfx.play('faint');
      await tween(350, t => { B.e.offY = 60 * t; B.e.alpha = 1 - t; });
      await say(B.kind === 'wild' ? `The wild ${monName(B.e.mon)} swooned right out of the fight!` : `Foe ${monName(B.e.mon)} is knocked out!`);
      await awardXP(B.e.mon);
      const next = B.enemies.findIndex(m => m.hp > 0);
      if (next >= 0) {
        B.ei = next;
        B.e = newSide(B.enemies[next]);
        B.e.offX = 260;
        await say(`${B.trainer.name} sent out ${monName(B.e.mon)}!`);
        await tween(300, t => { B.e.offX = 260 * (1 - t); });
        B.participants = new Set([B.p.mon]);
      } else return 'win';
    }
    if (B.p.mon.hp <= 0) {
      Sfx.play('faint');
      await tween(350, t => { B.p.offY = 60 * t; B.p.alpha = 1 - t; });
      await say(`${monName(B.p.mon)} is knocked down!`);
      if (firstAliveIdx() < 0) return 'lose';
      while (true) {
        const idx = await partyMenu({ pick: true, title: 'Who steps up next?' });
        if (idx >= 0 && party()[idx].hp > 0) { B.p.mon.fluster = 0; await doSwitch(idx); break; }
      }
    }
    return null;
  }

  async function awardXP(foe) {
    const sp = DEX_BY_ID[foe.id];
    const base = Math.max(1, Math.floor(sp.exp * foe.lvl / 7 * (B.kind === 'trainer' ? 1.5 : 1) * 1.25));
    let shared = false;
    for (const m of party()) {
      if (m.hp <= 0) continue;
      const got = B.participants.has(m) ? base : Math.floor(base / 2);
      if (B.participants.has(m)) await say(`${monName(m)} gained ${got} XP!`, { auto: 600 });
      else shared = true;
      m.xp += got;
      while (m.lvl < 100 && m.xp >= xpForLevel(m.lvl + 1)) await levelUp(m);
    }
    if (shared) await say(`The rest of the party gained ${Math.floor(base / 2)} XP from the group chat.`, { auto: 600 });
  }

  async function levelUp(m) {
    const before = calcStats(m);
    m.lvl++;
    const after = calcStats(m);
    m.hp = Math.min(after.hp, m.hp + (after.hp - before.hp));
    m.en = Math.min(maxEnergy(m), m.en + 2);
    Sfx.play('item');
    await say(`${monName(m)} grew to Lv ${m.lvl}! ATK ${after.atk} · DEF ${after.def} · CHA ${after.cha} · SPD ${after.spd}`);
    for (const [l, id] of DEX_BY_ID[m.id].learn) if (l === m.lvl) await learnMove(m, id);
  }

  async function learnMove(m, id) {
    if (m.moves.includes(id)) return;
    const mv = MOVES[id];
    if (m.moves.length < 4) { m.moves.push(id); await say(`${monName(m)} learned ${mv.name}!`, { sfx: 'item' }); return; }
    await say(`${monName(m)} wants to learn ${mv.name}, but already knows 4 moves.`);
    const opts = m.moves.map(x => MOVES[x].name).concat([`Skip ${mv.name}`]);
    const c = await choose(opts, { title: `Forget a move for ${mv.name}?`, info: i => i < 4 ? esc(MOVES[m.moves[i]].desc) : esc(mv.desc) });
    if (c < 0 || c === 4) { await say(`${monName(m)} did not learn ${mv.name}.`); return; }
    const old = MOVES[m.moves[c]].name;
    m.moves[c] = id;
    await say(`1, 2, and... poof! ${monName(m)} forgot ${old} and learned ${mv.name}!`, { sfx: 'item' });
  }

  // ---------- Catching ----------
  async function throwBall(item) {
    const def = ITEMS[item], e = B.e, m = e.mon;
    G.state.bag[item]--;
    await say(`${playerName()} threw a ${def.name}!`, { auto: 300 });
    B.ball = { x: 120, y: 200, kind: item };
    await tween(500, t => { B.ball.x = 120 + (370 - 120) * t; B.ball.y = 200 - Math.sin(t * Math.PI) * 140 + (90 - 200) * t; });
    await tween(250, t => { e.scale = 1 - t; e.alpha = 1 - t; });
    B.ball.y = 120;
    const st = calcStats(m);
    const sp = DEX_BY_ID[m.id];
    let a = ((3 * st.hp - 2 * m.hp) * sp.catch * def.rate) / (3 * st.hp);
    a *= 1 + m.fluster / 100;
    if (e.swoon) a *= 1.5;
    if (e.stagger) a *= 1.2;
    const p4 = Math.pow(Math.min(1, a / 255), 0.25);
    let shakes = 0;
    while (shakes < 4 && rng() < p4) shakes++;
    for (let i = 0; i < Math.min(shakes, 3); i++) {
      await sleep(250);
      await tween(300, t => { B.ball.rot = Math.sin(t * Math.PI * 2) * 0.5; });
      Sfx.play('blip');
    }
    await sleep(250);
    if (shakes >= 4) {
      Sfx.play('catch');
      await say(`Gotcha! ${monName(m)} was caught! They're totally into you. ♡`);
      markCaught(m.id);
      m.fluster = 0;
      if (party().length < 6) { party().push(m); await say(`${monName(m)} joined your party!`); }
      else { G.state.box.push(m); await say(`Your party is full, so ${monName(m)} was sent to the Vibe Cloud (use the PC at the Spa).`); }
      B.ball = null;
      return 'caught';
    }
    B.ball = null;
    await tween(200, t => { e.scale = t; e.alpha = t; });
    await say(FAIL_CATCH[shakes]);
    return null;
  }

  // ---------- Animations ----------
  async function lunge(side) {
    const dir = side === B.p ? 1 : -1;
    await tween(120, t => { side.offX = dir * 18 * Math.sin(t * Math.PI); });
  }
  async function hitAnim(side, dmg, tm) {
    Sfx.play('hit');
    side.flashUntil = performance.now() + 300;
    float(side, `-${dmg}`, tm >= 2 ? '#ff5a36' : tm < 1 ? '#aaa' : '#fff');
    await tween(260, t => { side.offX = Math.sin(t * Math.PI * 6) * 6 * (1 - t); });
    side.offX = 0;
  }

  // ---------- Rendering ----------
  function drawBg(c) {
    const bgs = { route: ['#8fd3ff', '#e8f8ff', '#7cd36b'], forest: ['#0f3a2a', '#2f6a4a', '#2f7a3a'], prison: ['#3a3a4a', '#6a6a7a', '#8a8a98'], lab: ['#c8a8e8', '#f0e0ff', '#d8c8e8'], indoor: ['#e8c8a8', '#fff0e0', '#d8b898'] };
    const [a, b, gr] = bgs[B.bg] || bgs.route;
    const g = c.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = gr; c.fillRect(0, 150, W, H - 150);
    if (B.bg === 'prison') { c.fillStyle = 'rgba(20,20,30,0.6)'; for (let x = 8; x < W; x += 24) c.fillRect(x, 0, 4, 150); c.fillStyle = '#ff8a1a'; c.fillRect(0, 140, W, 6); }
    if (B.bg === 'forest') { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < W; x += 60) c.fillRect(x, 0, 18, 150); }
    // platforms
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.ellipse(370, 150, 85, 18, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(130, 240, 100, 20, 0, 0, Math.PI * 2); c.fill();
  }

  function drawSprite(c, side, x, y, size, mirror, t) {
    if (side.alpha <= 0) return;
    const img = Art.drawCreature(side.mon.id);
    c.save();
    c.globalAlpha = Math.max(0, side.alpha);
    const s = size * (side.scale ?? 1);
    const bob = side.swoon ? Math.sin(t / 120) * 3 : Math.sin(t / 600 + (mirror ? 1 : 0)) * 2;
    const dx = x + side.offX + (size - s) / 2, dy = y + side.offY + bob + (size - s);
    if (mirror) { c.translate(dx + s, dy); c.scale(-1, 1); c.drawImage(img, 0, 0, s, s); }
    else c.drawImage(img, dx, dy, s, s);
    c.restore();
    if (performance.now() < side.flashUntil && Math.floor(t / 60) % 2 === 0) {
      c.save(); c.globalAlpha = 0.55; c.globalCompositeOperation = 'lighter';
      if (mirror) { c.translate(x + side.offX + size, y + side.offY); c.scale(-1, 1); c.drawImage(img, 0, 0, size, size); } else c.drawImage(img, x + side.offX, y + side.offY, size, size);
      c.restore();
    }
    // stance aura
    if (side.stance) {
      c.save();
      c.strokeStyle = { defensive: '#7fd0ff', cautious: '#7fff9a', counter: '#ff5a36' }[side.stance];
      c.globalAlpha = 0.5 + Math.sin(t / 200) * 0.2; c.lineWidth = 2;
      c.beginPath(); c.ellipse(x + side.offX + size / 2, y + size - 6, size / 2.2, 12, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
  }

  function drawInfo(c, side, x, y, isPlayer) {
    const m = side.mon, st = calcStats(m);
    const w = 206, h = isPlayer ? 74 : 64;
    c.fillStyle = 'rgba(26,16,32,0.88)'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#ff7fb0'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = '#fff'; c.font = 'bold 13px monospace';
    c.fillText(monName(m).slice(0, 18), x + 8, y + 17);
    c.textAlign = 'right'; c.fillText('Lv' + m.lvl, x + w - 8, y + 17); c.textAlign = 'left';
    // type chips
    let tx = x + 8;
    c.font = 'bold 8px monospace';
    for (const tp of DEX_BY_ID[m.id].types) { c.fillStyle = TYPES[tp].color; c.fillRect(tx, y + 21, 44, 9); c.fillStyle = '#1a1020'; c.fillText(tp.toUpperCase(), tx + 2, y + 28); tx += 48; }
    // status tags
    const tags = [];
    if (side.stance) tags.push([{ defensive: 'DEF', cautious: 'CAU', counter: 'CTR' }[side.stance] + side.stanceTurns, '#7fd0ff']);
    if (side.stagger) tags.push(['STG', '#ffb02a']);
    if (side.swoon) tags.push(['SWOON', '#ff4f8a']);
    if (side.chain) tags.push(['x' + side.chain, '#ffd23f']);
    for (const [tg, col] of tags) { c.fillStyle = col; c.fillRect(tx, y + 21, tg.length * 6 + 4, 9); c.fillStyle = '#1a1020'; c.fillText(tg, tx + 2, y + 28); tx += tg.length * 6 + 8; }
    // bars
    const barY = y + 34;
    const hpP = clamp(m.hp / st.hp, 0, 1);
    c.fillStyle = '#ccc'; c.font = 'bold 9px monospace'; c.fillText('STA', x + 8, barY + 7);
    c.fillStyle = '#333'; c.fillRect(x + 34, barY, w - 44, 8);
    c.fillStyle = hpP > 0.5 ? '#4cd96b' : hpP > 0.2 ? '#ffd23f' : '#ff4a3a'; c.fillRect(x + 34, barY, (w - 44) * hpP, 8);
    c.fillStyle = '#ccc'; c.fillText('EN', x + 8, barY + 18);
    c.fillStyle = '#333'; c.fillRect(x + 34, barY + 12, w - 44, 5);
    c.fillStyle = '#3fa7ff'; c.fillRect(x + 34, barY + 12, (w - 44) * clamp(m.en / maxEnergy(m), 0, 1), 5);
    c.fillStyle = '#ccc'; c.fillText('♡', x + 8, barY + 27);
    c.fillStyle = '#333'; c.fillRect(x + 34, barY + 21, w - 44, 5);
    c.fillStyle = '#ff7fb0'; c.fillRect(x + 34, barY + 21, (w - 44) * clamp(m.fluster / 100, 0, 1), 5);
    if (isPlayer) {
      c.fillStyle = '#fff'; c.font = '9px monospace';
      c.fillText(`${m.hp}/${st.hp}  EN ${m.en}/${maxEnergy(m)}`, x + 90, y + h - 6);
      const next = xpForLevel(m.lvl + 1), cur = xpForLevel(m.lvl);
      c.fillStyle = '#7fd0ff'; c.fillRect(x + 8, y + h - 4, (w - 16) * clamp((m.xp - cur) / (next - cur), 0, 1), 2);
    }
  }

  function render(c, t) {
    if (!B) return;
    drawBg(c);
    drawSprite(c, B.e, 306, 18, 128, false, t);
    drawSprite(c, B.p, 50, 92, 160, true, t);
    if (B.ball) {
      c.save(); c.translate(B.ball.x, B.ball.y); c.rotate(B.ball.rot || 0);
      c.drawImage(Art.ball(B.ball.kind), -10, -10, 20, 20); c.restore();
    }
    drawInfo(c, B.e, 12, 12, false);
    drawInfo(c, B.p, 262, 160, true);
    const now = performance.now();
    B.floats = B.floats.filter(f => now - f.t0 < 900);
    for (const f of B.floats) {
      const k = (now - f.t0) / 900;
      c.globalAlpha = 1 - k; c.font = 'bold 15px monospace'; c.textAlign = 'center';
      c.fillStyle = '#1a1020'; c.fillText(f.text, f.x + 1, f.y - k * 30 + 1);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - k * 30);
      c.globalAlpha = 1; c.textAlign = 'left';
    }
  }

  return { start, render, get state() { return B; } };
})();
