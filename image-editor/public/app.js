const $ = (sel) => document.querySelector(sel);
const state = {
  view: 'stage',
  info: null,
  connection: 'direct',
  cast: [],
  library: [],
  filterTag: '',
  filterGroup: '',
  selectedId: '',
  castIndex: 0,
  castFilter: 'everyone',
  castList: false,
  castInfo: false,
  aspect: '1:1',
  busy: false,
  tour: 0,
  museOpen: true,
  lastPrompt: '',
  shownId: '',
  draft: null,
  deleteArm: '',
  pairings: [],
  loopIndex: 0,
  loopSig: '',
  loopNote: '',
  openPairingId: '',
  loopPause: false,
  castWrapped: false,
  activePairingId: '',
};

const TOUR = [
  'Type what you want to see, then press Go. I file the picture with the character and the lists you used.',
  'The idol loop repeats those pairings. Click one to open the pictures made with the same lists.',
  'Cast is the carousel. New means a new character. Create opens the card.',
  'The card keeps the case: character, role, outfit, world, and free tags. Those tags filter Memory.',
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok && data && !data.error) data.error = 'The editor could not do that.';
  return data;
}

function selected() {
  return state.cast.find((person) => person.id === state.selectedId) || null;
}

function pictureCount(person) {
  const name = person.name.toLowerCase();
  const items = state.libraryAll || state.library;
  return items.filter((item) => (item.character || '').toLowerCase() === name || item.characterId === person.id).length;
}

function norm(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tagsOf(item) {
  const raw = Array.isArray(item.tags) ? item.tags : String(item.tags || '').split(',');
  const out = [];
  for (const itemTag of raw) {
    const tag = norm(itemTag);
    if (!tag || out.includes(tag)) continue;
    out.push(tag);
  }
  out.sort();
  return out;
}

function whoKey(item) {
  const id = item.characterId || '';
  if (id && state.cast.some((person) => person.id === id)) return 'id:' + id;
  const name = norm(item.character);
  const person = name && state.cast.find((entry) => norm(entry.name) === name);
  if (person) return 'id:' + person.id;
  if (id) return 'id:' + id;
  return 'name:' + name;
}

function sameLists(a, b) {
  return norm(a.role) === norm(b.role)
    && norm(a.outfit) === norm(b.outfit)
    && norm(a.world) === norm(b.world)
    && tagsOf(a).join('\n') === tagsOf(b).join('\n');
}

function samePair(item, pairing) {
  return whoKey(item) === whoKey(pairing) && sameLists(item, pairing);
}

function listLabel(pairing) {
  const tags = (pairing.tags || []).filter(Boolean).join(', ');
  return [pairing.role, pairing.outfit, pairing.world, tags].filter(Boolean).join(' · ') || 'No lists yet';
}

function personForPairing(pairing) {
  return state.cast.find((person) => person.id && person.id === pairing.characterId)
    || state.cast.find((person) => norm(person.name) && norm(person.name) === norm(pairing.character))
    || null;
}

function pairingsFor(person) {
  const key = whoKey({ character: person.name, characterId: person.id });
  return state.pairings.filter((pairing) => whoKey(pairing) === key);
}

function pairingsFromLibrary(items) {
  const groups = new Map();
  for (const item of items) {
    const id = item.pairingId || [whoKey(item), norm(item.role), norm(item.outfit), norm(item.world), tagsOf(item).join(',')].join('|');
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        character: item.character || '',
        characterId: item.characterId || '',
        role: item.role || '',
        outfit: item.outfit || '',
        world: item.world || '',
        tags: item.tags || [],
        count: 0,
        latestAt: item.createdAt,
        items: [],
      };
      groups.set(id, group);
    }
    if (!group.characterId && item.characterId) group.characterId = item.characterId;
    group.count += 1;
    group.items.push(item);
  }
  return [...groups.values()];
}

function itemsForPairing(pairing) {
  const pool = [];
  const seen = new Set();
  for (const item of [...(pairing.items || []), ...(state.libraryAll || [])]) {
    if (!item || seen.has(item.id) || !samePair(item, pairing)) continue;
    seen.add(item.id);
    pool.push(item);
  }
  pool.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return pool;
}

function visibleCast() {
  const q = $('#sQ').value.trim().toLowerCase();
  return state.cast.filter((person) => {
    if (state.castFilter === 'personas' && person.kind !== 'persona') return false;
    if (state.castFilter === 'pictures' && pictureCount(person) < 1) return false;
    if (!q) return true;
    const hay = [person.name, person.one, person.role, person.outfit, person.world, ...(person.tags || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function reel() {
  return [null, ...visibleCast()];
}

function setStatus(text, isError) {
  const status = $('#status');
  status.textContent = text || '';
  status.classList.toggle('error', Boolean(isError));
}

function showView(view) {
  state.view = view;
  for (const name of ['stage', 'cast', 'card', 'memory', 'more']) {
    $('#view-' + name).classList.toggle('hidden', name !== view);
    const nav = document.querySelector('[data-view="' + name + '"]');
    if (nav) nav.setAttribute('aria-current', name === view ? 'true' : 'false');
  }
  $('#composer').classList.toggle('hidden', view === 'cast' || view === 'card');
  $('#loopDock').classList.toggle('hidden', view !== 'stage');
  if (view === 'cast') renderCast();
  if (view === 'card') renderCard();
  if (view === 'memory') renderMemory();
  if (view === 'more') renderMore();
}

function initial(name) {
  return (String(name || '?').trim()[0] || '?').toUpperCase();
}

function colorFor(person) {
  if (!person) return '#c9f07a';
  return person.kind === 'persona' ? '#c9f07a' : '#ff7cbf';
}

function fillFrom(person) {
  $('#fCharacter').value = person ? person.name : '';
  $('#fRole').value = person ? person.role : '';
  $('#fOutfit').value = person ? person.outfit : '';
  $('#fWorld').value = person ? person.world : '';
  $('#fTags').value = person && person.tags ? person.tags.join(', ') : '';
}

function renderMe() {
  const person = selected();
  const button = $('#meBtn');
  if (!person) {
    button.innerHTML = '<span class="av" style="--c:#c9f07a">Y</span><span><b>You</b><small>Pick someone to talk to</small></span>';
  } else {
    button.innerHTML = '<span class="av" style="--c:' + colorFor(person) + '">' + esc(initial(person.name)) + '</span><span><b>' + esc(person.name) + '</b><small>' + esc(person.role || 'On stage') + '</small></span>';
  }
  const mark = person ? initial(person.name) : '?';
  $('#whoAv').textContent = mark;
  $('#whoAv').style.setProperty('--c', colorFor(person));
  $('#themMark').textContent = mark;
  const note = $('#castNote');
  note.textContent = state.cast.length
    ? 'Your cast is saved on this computer.'
    : 'Make a character in Cast, then ask for a picture.';
}

function renderLatest() {
  const q = $('#sQ').value.trim().toLowerCase();
  const items = (state.libraryAll || state.library).filter((item) => {
    if (!q) return true;
    return [item.prompt, item.character, item.role, item.outfit, item.world, ...(item.tags || [])].join(' ').toLowerCase().includes(q);
  }).slice(0, 8);
  const host = $('#latest');
  if (!items.length) {
    host.innerHTML = '<p class="sempty">No pictures yet.</p>';
    return;
  }
  host.innerHTML = items.map((item) => (
    '<div class="sitem' + (item.id === state.shownId ? ' on' : '') + '"><button type="button" class="sopen" data-show="' + esc(item.id) + '"><img class="thumb" alt="" src="' + esc(item.url) + '"><span><b>' + esc(item.character || 'Picture') + '</b><small>' + esc(item.prompt) + '</small></span></button></div>'
  )).join('');
}

function renderHero() {
  const item = state.library.find((entry) => entry.id === state.shownId);
  const intro = $('#intro');
  const hero = $('#hero');
  if (!item) {
    intro.classList.remove('hidden');
    hero.classList.add('hidden');
    $('#reroll').disabled = !state.lastPrompt;
    return;
  }
  intro.classList.add('hidden');
  hero.classList.remove('hidden');
  $('#heroImg').src = item.url;
  $('#heroImg').alt = item.prompt;
  const bits = [item.character, item.role, item.outfit, item.world, ...(item.tags || [])].filter(Boolean);
  const revised = item.settings && item.settings.revised ? ' Grok adjusted the wording to: ' + item.settings.revised : '';
  $('#heroNote').textContent = bits.join(' · ') + (revised ? '.' + revised : '');
  $('#reroll').disabled = !state.lastPrompt && !item.prompt;
}

function renderCast() {
  const list = reel();
  if (state.castIndex >= list.length) state.castIndex = 0;
  const current = list[state.castIndex];
  const counts = {
    pictures: state.cast.filter((person) => pictureCount(person) > 0).length,
    everyone: state.cast.length,
    personas: state.cast.filter((person) => person.kind === 'persona').length,
  };
  const pairs = current ? pairingsFor(current) : [];
  const name = current ? current.name : 'New';
  const line = current
    ? (pairs.length ? listLabel(pairs[0]) + ' · ' + pairs[0].count + (pairs[0].count === 1 ? ' picture' : ' pictures') : (current.one || current.role || 'On the cast'))
    : 'Make a new character in the full creator';
  const cc = current ? colorFor(current) : '#c9f07a';
  const go = current ? 'Choose ' + name.slice(0, 16) : 'Create';
  const filters = [
    ['pictures', 'Has pictures · ' + counts.pictures],
    ['everyone', 'Everyone · ' + counts.everyone],
    ['personas', 'Personas · ' + counts.personas],
  ].map(([key, label]) => (
    '<button type="button" data-cfilter="' + key + '" aria-pressed="' + (state.castFilter === key) + '">' + label + '</button>'
  )).join('');
  let body;
  if (state.castList) {
    const rows = visibleCast().map((person) => {
      const saved = pairingsFor(person);
      const chips = saved.map((pairing) => (
        '<button type="button" class="pair-chip" data-pairing="' + esc(pairing.id) + '">' + esc(listLabel(pairing)) + ' · ' + pairing.count + '</button>'
      )).join('');
      const small = saved.length ? listLabel(saved[0]) : (person.one || person.role || '');
      return '<div class="sitem"><button type="button" class="sopen" data-pick="' + esc(person.id) + '"><span class="av" style="--c:' + colorFor(person) + '">' + esc(initial(person.name)) + '</span><span><b>' + esc(person.name) + '</b><small>' + esc(small) + '</small></span></button>' + chips + '</div>';
    }).join('') || '<p class="sempty">Nobody matches.</p>';
    body = '<div class="clist">' + rows + '</div>';
  } else {
    const pairRow = !current
      ? ''
      : pairs.length
        ? '<div class="pair-row" aria-label="Saved pairings">' + pairs.map((pairing) => (
          '<button type="button" class="pair-chip" data-pairing="' + esc(pairing.id) + '">' + esc(listLabel(pairing)) + ' · ' + pairing.count + '</button>'
        )).join('') + '</div>'
        : '<p class="hint pair-missing">No saved pairing yet. Choose them and press Go. The loop will show this character with those lists.</p>';
    body = '<div class="cbanner" style="--cc:' + cc + '"><p class="k">Choose who you\'re talking to</p><h2 class="cn">' + esc(name) + '</h2><small>' + esc(line) + '</small>' + pairRow + '</div>'
      + '<div class="portrait" aria-hidden="true">' + (current ? esc(initial(current.name)) : '+') + '</div>';
  }
  const info = state.castInfo && current
    ? '<aside class="info-card"><p class="lbl">Info</p><p><b>' + esc(current.name) + '</b></p><p>' + esc(current.role) + (current.outfit ? ' · ' + esc(current.outfit) : '') + (current.world ? ' · ' + esc(current.world) : '') + '</p><p>' + esc((current.tags || []).join(', ')) + '</p></aside>'
    : '';
  const loopKicker = state.pairings.length
    ? state.pairings.length + ' saved pairing' + (state.pairings.length === 1 ? '' : 's') + ' in the loop'
    : 'Pairings show up here after you keep a picture';
  $('#view-cast').innerHTML = '<div class="cast-head"><span class="k">Cast</span><span class="hint">' + esc(loopKicker) + '</span></div>'
    + '<button type="button" class="spin prev" data-spin="-1" aria-label="Previous">‹</button>'
    + '<button type="button" class="spin next" data-spin="1" aria-label="Next">›</button>'
    + body
    + '<div class="cast-filters" role="group" aria-label="Show">' + filters
    + '<input id="castFind" type="search" placeholder="Find a character" aria-label="Find a character" value="' + esc($('#sQ').value) + '"></div>'
    + info
    + '<div class="cast-foot"><button type="button" class="quiet" id="listToggle">' + (state.castList ? 'Cards' : 'List view') + '</button>'
    + '<button type="button" class="quiet" id="infoToggle" aria-pressed="' + state.castInfo + '">ⓘ Info</button>'
    + '<span class="hint">' + (state.castWrapped ? 'Looped back to the start. ' : '') + '← → or scroll to spin · Enter to choose</span>'
    + '<button type="button" class="quiet" id="castCancel">Cancel</button>'
    + '<button type="button" id="castNew">+ New character</button>'
    + '<button type="button" class="primary" id="castGo">' + esc(go) + '</button></div>';
}

function cardPerson() {
  if (state.draft) return state.draft;
  return selected();
}

function renderCard() {
  const person = cardPerson();
  const host = $('#view-card');
  if (!person) {
    host.innerHTML = '<div class="sheet"><h2>No card on this side</h2><p>Open Cast and press Create. The card is the character case: name, role, outfit, world, and free tags.</p><button type="button" class="primary" id="cardNew">+ New character</button></div>';
    return;
  }
  const kind = person.kind === 'persona' ? 'persona' : 'companion';
  host.innerHTML = '<div class="sheet"><p class="k">Character card</p><h2>' + esc(person.name || 'New character') + '</h2><p>Fill it in, then Accept. The next picture keeps this character, role, outfit, world, and any extra tags.</p>'
    + '<div class="fields"><label>Name <input id="cName" value="' + esc(person.name) + '"></label>'
    + '<div class="seg" role="group" aria-label="Role or cast"><button type="button" data-kind="companion" aria-pressed="' + (kind === 'companion') + '">Companion</button><button type="button" data-kind="persona" aria-pressed="' + (kind === 'persona') + '">Persona</button></div>'
    + '<label>Role / cast <input id="cRole" value="' + esc(person.role || '') + '"></label>'
    + '<label>Outfit <input id="cOutfit" value="' + esc(person.outfit || '') + '"></label>'
    + '<label>World <input id="cWorld" value="' + esc(person.world || '') + '"></label>'
    + '<label>One line <input id="cOne" value="' + esc(person.one || '') + '"></label>'
    + '<label>Free tags <input id="cTags" value="' + esc((person.tags || []).join(', ')) + '" placeholder="night, rain"></label></div>'
    + '<div class="card-actions"><button type="button" class="primary" id="accept">Accept</button>'
    + (person.id ? '<button type="button" class="quiet danger" id="dropCard">' + (state.deleteArm === person.id ? 'Tap again to delete' : 'Delete card') + '</button>' : '')
    + '<button type="button" class="quiet" id="cardCancel">Cancel</button></div></div>';
}

function tagButtons(items) {
  const groups = [
    ['character', 'Character'],
    ['role', 'Role / cast'],
    ['outfit', 'Outfit'],
    ['world', 'World'],
    ['tag', 'Tags'],
  ];
  const buttons = ['<button type="button" data-clear-filter aria-pressed="' + (!state.filterTag) + '">Everyone</button>'];
  for (const [group, label] of groups) {
    const values = new Set();
    for (const item of items) {
      const raw = group === 'tag' ? (item.tags || []) : [item[group]];
      for (const value of raw) if (value) values.add(value);
    }
    for (const value of values) {
      const on = state.filterTag.toLowerCase() === String(value).toLowerCase() && state.filterGroup === group;
      buttons.push('<button type="button" data-group="' + group + '" data-tag="' + esc(value) + '" aria-pressed="' + on + '">' + esc(label) + ' · ' + esc(value) + '</button>');
    }
  }
  return buttons.join('');
}

function renderMemory() {
  const items = state.library;
  const waiting = state.filterTag || $('#sQ').value.trim();
  const tiles = items.map((item) => (
    '<div class="ltile"><button type="button" class="pv" data-show="' + esc(item.id) + '" aria-pressed="' + (item.id === state.shownId) + '"><img alt="' + esc(item.prompt) + '" src="' + esc(item.url) + '"></button><small>' + esc(item.character || item.prompt) + '</small></div>'
  )).join('') || (waiting
    ? '<p class="sempty">Nothing with that tag.</p>'
    : '<p class="sempty">Nothing kept yet. Go back to the stage and press Go.</p>');
  $('#view-memory').innerHTML = '<div class="mem-head"><span class="lbl">Latest pictures</span><span class="hint">' + items.length + ' kept</span></div>'
    + '<div class="filters" id="filters">' + tagButtons(state.libraryAll || items) + '</div>'
    + '<div class="lib">' + tiles + '</div>';
}

function renderMore() {
  const info = state.info;
  const direct = state.connection === 'direct';
  const help = !info
    ? 'Checking the connection…'
    : direct
      ? (info.direct ? 'A key is already set on this computer (ends in ' + info.keyHint + '). You can leave the box blank.' : 'No key in .env yet. Paste your xAI key below, or add XAI_API_KEY to .env and start the editor again.')
      : (info.bridge ? info.bridge.detail : 'Checking the Hub bridge…');
  const banner = info && info.mock
    ? '<p class="banner">Practice mode is on. Direct API draws a stand-in picture on this computer and does not call xAI. Set IMAGE_EDITOR_MOCK=0 in .env when you want a real picture.</p>'
    : '';
  $('#view-more').innerHTML = '<div class="sheet"><p class="k">Settings</p><h2>How to connect</h2>' + banner
    + '<div class="seg" role="group" aria-label="How to connect"><button type="button" data-connection="direct" aria-pressed="' + direct + '">Direct API</button><button type="button" data-connection="bridge" aria-pressed="' + (!direct) + '">Hub bridge</button></div>'
    + '<p id="connHelp">' + esc(help) + '</p>'
    + '<label class="' + (direct ? '' : 'hidden') + '" id="keyLabel">xAI key <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="Leave blank if the key is already in .env"></label>'
    + '<p class="hint">Model ' + esc(info ? info.model : '') + (info && info.apiBase ? ' · ' + esc(info.apiBase) : '') + '</p>'
    + '<p>Only Direct API needs the key, and only if <code>.env</code> does not already have it. The key stays on this computer. It is not saved in the library.</p></div>';
  const keyBox = $('#key');
  if (keyBox && state.key) keyBox.value = state.key;
}

function pairButton(pairing, hidden) {
  const person = personForPairing(pairing);
  const name = pairing.character || 'Picture';
  const label = name + ', ' + listLabel(pairing) + ', ' + pairing.count + (pairing.count === 1 ? ' picture' : ' pictures') + '. Open these pictures.';
  return '<button type="button" class="pair" data-pairing="' + esc(pairing.id) + '" aria-label="' + esc(label) + '"'
    + (hidden ? ' tabindex="-1" aria-hidden="true"' : '')
    + '><span class="av" style="--c:' + colorFor(person || { kind: 'companion' }) + '">' + esc(initial(name)) + '</span><span><b>'
    + esc(name) + '</b><small>' + esc(listLabel(pairing)) + '</small></span><em>' + esc(String(pairing.count)) + '</em></button>';
}

function emptyLoopHtml() {
  return '<div class="loop-empty"><h2>The loop starts after the first picture</h2><p>Choose a character and fill the lists under the prompt: role, outfit, world, and tags. Press Go. Next time, that pairing comes back here instead of a blank line. Click it and you get only the pictures made with those same lists.</p><div class="pair ghost" aria-hidden="true"><span class="av" style="--c:#ff7cbf">Y</span><span><b>Example · Your idol</b><small>Companion · red cloak · harbor · night</small></span><em>click</em></div></div>';
}

function renderLoop() {
  const list = state.pairings;
  const note = $('#loopNote');
  const count = $('#loopCount');
  const run = $('#loopRun');
  const prev = $('#loopPrev');
  const next = $('#loopNext');
  if (!list.length) {
    state.loopIndex = 0;
    state.loopSig = '';
    count.textContent = '';
    note.textContent = 'Nothing paired yet. The example is not a saved picture.';
    note.classList.remove('flash');
    prev.disabled = true;
    next.disabled = true;
    run.classList.add('is-empty');
    run.innerHTML = emptyLoopHtml();
    $('#loopDock').classList.add('paused');
    return;
  }
  prev.disabled = false;
  next.disabled = false;
  run.classList.remove('is-empty');
  if (state.loopIndex >= list.length) state.loopIndex = 0;
  const current = list[state.loopIndex];
  count.textContent = (state.loopIndex + 1) + ' of ' + list.length;
  note.textContent = state.loopNote || ((current.character || 'This pairing') + ' · ' + listLabel(current));
  note.classList.toggle('flash', /^Looped|^Same pairing/.test(state.loopNote || ''));
  const sig = list.map((item) => item.id + ':' + item.count + ':' + listLabel(item)).join('|');
  if (sig !== state.loopSig) {
    state.loopSig = sig;
    run.innerHTML = list.map((pairing) => pairButton(pairing, false)).join('');
  }
  run.querySelectorAll('.pair').forEach((button) => {
    button.classList.toggle('on', button.dataset.pairing === current.id);
  });
  $('#loopDock').classList.toggle('paused', Boolean(state.loopPause || state.openPairingId));
  restartLoopMeter();
}

function restartLoopMeter() {
  const bar = document.querySelector('#loopProgress i');
  if (!bar || !state.pairings.length) return;
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = '';
}

function stepLoop(step) {
  const count = state.pairings.length;
  if (!count) return;
  const next = (state.loopIndex + step + count) % count;
  if (count === 1) state.loopNote = 'Same pairing again. Click it for those pictures.';
  else if (step > 0 && next === 0) state.loopNote = 'Looped back to the first pairing.';
  else if (step < 0 && next === count - 1) state.loopNote = 'Looped back to the last pairing.';
  else state.loopNote = '';
  state.loopIndex = next;
  renderLoop();
}

function fieldsBlank() {
  return ['#fCharacter', '#fRole', '#fOutfit', '#fWorld', '#fTags'].every((sel) => !$(sel).value.trim());
}

function applyPairing(pairing) {
  const person = personForPairing(pairing);
  $('#fCharacter').value = person ? person.name : (pairing.character || '');
  $('#fRole').value = pairing.role || '';
  $('#fOutfit').value = pairing.outfit || '';
  $('#fWorld').value = pairing.world || '';
  $('#fTags').value = (pairing.tags || []).join(', ');
  if (person) state.selectedId = person.id;
  else if (pairing.characterId) state.selectedId = pairing.characterId;
  state.activePairingId = pairing.id;
  renderMe();
}

function maybeFillBlank() {
  if (!fieldsBlank() || !state.pairings.length) return;
  applyPairing(state.pairings[0]);
  state.loopIndex = 0;
  renderLoop();
}

function closePairingLibrary() {
  state.openPairingId = '';
  $('#pairLib').classList.add('hidden');
  state.loopPause = $('#loopDock').matches(':hover');
  $('#loopDock').classList.toggle('paused', state.loopPause);
}

function openPairingLibrary(id) {
  const pairing = state.pairings.find((item) => item.id === id);
  if (!pairing) return;
  const index = state.pairings.findIndex((item) => item.id === id);
  if (index >= 0) state.loopIndex = index;
  state.loopNote = '';
  applyPairing(pairing);
  const pictures = itemsForPairing(pairing);
  state.openPairingId = id;
  $('#pairLibTitle').textContent = pairing.character || 'Pictures';
  $('#pairLibLists').textContent = listLabel(pairing);
  $('#pairLibCount').textContent = pictures.length + (pictures.length === 1 ? ' picture' : ' pictures');
  $('#pairLibGrid').innerHTML = pictures.length
    ? pictures.map((item) => (
      '<div class="ltile"><button type="button" class="pv" data-show="' + esc(item.id) + '" aria-pressed="' + (item.id === state.shownId) + '"><img alt="' + esc(item.prompt) + '" src="' + esc(item.url) + '"></button><small>' + esc(item.prompt) + '</small></div>'
    )).join('')
    : '<p class="sempty">No pictures with these lists.</p>';
  $('#pairLib').classList.remove('hidden');
  $('#loopRun').classList.add('paused');
  state.loopPause = true;
  renderLoop();
  $('#pairLibClose').focus();
}

function choosePerson(person) {
  state.selectedId = person.id;
  const pairs = pairingsFor(person);
  const cardBlank = ![person.role, person.outfit, person.world, ...(person.tags || [])].some(Boolean);
  if (pairs.length && (cardBlank || sameLists(person, pairs[0]))) applyPairing(pairs[0]);
  else fillFrom(person);
  if (pairs.length) {
    const index = state.pairings.findIndex((item) => item.id === pairs[0].id);
    if (index >= 0) state.loopIndex = index;
    state.loopNote = '';
    renderLoop();
  }
  renderMe();
  showView('stage');
  setStatus(pairs.length
    ? person.name + ' is on stage. Click a pairing in the loop to open the pictures made with those lists.'
    : person.name + ' is on stage. After you press Go, this pairing comes back in the loop.', false);
}

async function loadAll() {
  const [info, cast, library, pairings] = await Promise.all([
    api('/api/status'),
    api('/api/cast'),
    api('/api/library'),
    api('/api/pairings'),
  ]);
  state.info = info;
  state.cast = cast.cast || [];
  state.libraryAll = library.items || [];
  state.library = state.libraryAll;
  state.pairings = pairings && pairings.ok ? (pairings.pairings || []) : pairingsFromLibrary(state.libraryAll);
  if (state.loopIndex >= state.pairings.length) state.loopIndex = 0;
  renderMe();
  renderLatest();
  renderHero();
  renderLoop();
  maybeFillBlank();
  if (state.view === 'memory') renderMemory();
  if (state.view === 'more') renderMore();
  if (state.view === 'cast') renderCast();
}

async function refreshLibrary() {
  const params = new URLSearchParams();
  if (state.filterTag) params.set('tag', state.filterTag);
  if (state.filterGroup) params.set('group', state.filterGroup);
  const q = $('#sQ').value.trim();
  if (q) params.set('q', q);
  const data = await api('/api/library' + (params.toString() ? '?' + params : ''));
  state.library = data.items || [];
  if (!state.filterTag && !q) state.libraryAll = state.library;
  renderLatest();
  if (state.view === 'memory') renderMemory();
}

function beginDraft(kind) {
  state.draft = {
    id: '',
    name: kind === 'persona' ? 'New persona' : 'New character',
    kind: kind === 'persona' ? 'persona' : 'companion',
    role: kind === 'persona' ? 'Persona' : 'Companion',
    outfit: '',
    world: '',
    one: '',
    tags: [],
  };
  state.deleteArm = '';
  showView('card');
}

async function acceptCard() {
  const person = cardPerson();
  if (!person) return;
  const body = {
    name: $('#cName').value,
    kind: person.kind,
    role: $('#cRole').value,
    outfit: $('#cOutfit').value,
    world: $('#cWorld').value,
    one: $('#cOne').value,
    tags: $('#cTags').value,
  };
  const saved = person.id
    ? await api('/api/cast/' + person.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    : await api('/api/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!saved.ok) {
    setStatus(saved.error || 'Could not save the card.', true);
    showView('stage');
    return;
  }
  state.draft = null;
  state.selectedId = saved.person.id;
  await loadAll();
  fillFrom(saved.person);
  showView('cast');
  const list = reel();
  state.castIndex = Math.max(0, list.findIndex((item) => item && item.id === saved.person.id));
  renderCast();
}

function showItem(id) {
  const item = (state.libraryAll || state.library).find((entry) => entry.id === id) || state.library.find((entry) => entry.id === id);
  if (!item) return;
  state.shownId = id;
  state.lastPrompt = item.prompt;
  $('#prompt').value = item.prompt;
  $('#fCharacter').value = item.character || '';
  $('#fRole').value = item.role || '';
  $('#fOutfit').value = item.outfit || '';
  $('#fWorld').value = item.world || '';
  $('#fTags').value = (item.tags || []).join(', ');
  if (item.characterId) state.selectedId = item.characterId;
  closePairingLibrary();
  if (item.pairingId) {
    const index = state.pairings.findIndex((pairing) => pairing.id === item.pairingId);
    if (index >= 0) state.loopIndex = index;
    state.activePairingId = item.pairingId;
    state.loopNote = '';
    renderLoop();
  }
  showView('stage');
  renderHero();
  renderLatest();
  renderMe();
}

async function generate(prompt) {
  const text = prompt.trim();
  if (!text) {
    setStatus('Write what you want the picture to show first.', true);
    $('#prompt').focus();
    return;
  }
  const file = $('#file').files && $('#file').files[0];
  if (file && file.size > 6 * 1024 * 1024) {
    setStatus('That picture is too big to send. Try a smaller one.', true);
    return;
  }
  state.busy = true;
  $('#go').disabled = true;
  $('#go').textContent = 'Thinking…';
  $('#prompt').placeholder = 'Thinking…';
  setStatus('Thinking…', false);
  $('#museText').textContent = 'Asking Grok for the picture…';
  try {
    const body = {
      connection: state.connection,
      prompt: text,
      aspect: state.aspect,
      mode: file ? 'edit' : 'generate',
      character: $('#fCharacter').value,
      characterId: state.selectedId,
      role: $('#fRole').value,
      outfit: $('#fOutfit').value,
      world: $('#fWorld').value,
      tags: $('#fTags').value,
    };
    if (state.connection === 'direct' && state.key) body.key = state.key.trim();
    if (file) body.image = await fileToDataUrl(file);
    const result = await api('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      setStatus(result.error || 'The picture could not be made.', true);
      return;
    }
    state.lastPrompt = text;
    state.shownId = result.item ? result.item.id : '';
    state.filterTag = '';
    state.filterGroup = '';
    await loadAll();
    if (result.item && result.item.pairingId) {
      const index = state.pairings.findIndex((item) => item.id === result.item.pairingId);
      if (index >= 0) state.loopIndex = index;
      state.activePairingId = result.item.pairingId;
      state.loopNote = '';
      renderLoop();
    }
    showView('stage');
    const where = result.source === 'bridge' ? 'the Hub bridge' : result.source === 'mock' ? 'practice mode' : 'the direct API';
    const who = body.character || 'this picture';
    setStatus('Filed in the loop for ' + who + '. Click that pairing to see the pictures with the same lists. This one came through ' + where + '.', false);
    $('#museText').textContent = 'Filed in the idol loop. Click that pairing to see the pictures made with the same lists.';
    $('#file').value = '';
    $('#fileChip').classList.add('hidden');
  } catch (error) {
    setStatus(error.message || 'Something went wrong. Check the terminal, then try again.', true);
  } finally {
    state.busy = false;
    $('#go').disabled = false;
    $('#go').textContent = 'Go';
    $('#prompt').placeholder = 'Ask for a picture…';
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that picture.'));
    reader.readAsDataURL(file);
  });
}

function spin(step) {
  const list = reel();
  const next = (state.castIndex + step + list.length) % list.length;
  state.castWrapped = list.length > 1 && ((step > 0 && next < state.castIndex) || (step < 0 && next > state.castIndex));
  state.castIndex = next;
  renderCast();
}

document.addEventListener('click', async (event) => {
  const view = event.target.closest('[data-view]');
  if (view && event.target.closest('.snav, .smore, #home')) {
    if (view.dataset.view === 'stage') {
      $('#prompt').value = '';
      state.shownId = '';
      renderHero();
    }
    showView(view.dataset.view);
    return;
  }
  if (event.target.closest('#navMore')) {
    const menu = $('#moreMenu');
    const open = menu.classList.toggle('hidden') === false;
    $('#navMore').setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }
  if (event.target.closest('#home')) {
    showView('stage');
    return;
  }
  if (event.target.closest('#openCast') || event.target.closest('#meBtn')) {
    showView('cast');
    return;
  }
  if (event.target.closest('#openMemory')) {
    showView('memory');
    return;
  }
  if (event.target.closest('#newChat')) {
    $('#prompt').value = '';
    state.shownId = '';
    renderHero();
    showView('stage');
    $('#prompt').focus();
    return;
  }
  if (event.target.closest('#collapse')) {
    $('#side').classList.toggle('collapsed');
    return;
  }
  if (event.target.closest('#focusSearch')) {
    $('#sQ').focus();
    return;
  }
  if (event.target.closest('#loopPrev')) {
    stepLoop(-1);
    return;
  }
  if (event.target.closest('#loopNext')) {
    stepLoop(1);
    return;
  }
  if (event.target.id === 'pairLib' || event.target.closest('#pairLibClose')) {
    closePairingLibrary();
    return;
  }
  const pairingBtn = event.target.closest('[data-pairing]');
  if (pairingBtn) {
    openPairingLibrary(pairingBtn.dataset.pairing);
    return;
  }
  const show = event.target.closest('[data-show]');
  if (show) {
    showItem(show.dataset.show);
    return;
  }
  const aspect = event.target.closest('[data-aspect]');
  if (aspect) {
    state.aspect = aspect.dataset.aspect;
    document.querySelectorAll('[data-aspect]').forEach((button) => {
      button.setAttribute('aria-pressed', button === aspect ? 'true' : 'false');
    });
    return;
  }
  if (event.target.closest('#pickFile')) {
    $('#file').click();
    return;
  }
  if (event.target.closest('#reroll')) {
    generate(state.lastPrompt || $('#prompt').value);
    return;
  }
  const spinButton = event.target.closest('[data-spin]');
  if (spinButton) {
    spin(Number(spinButton.dataset.spin));
    return;
  }
  const filter = event.target.closest('[data-cfilter]');
  if (filter) {
    state.castFilter = filter.dataset.cfilter;
    state.castIndex = 0;
    state.castWrapped = false;
    renderCast();
    return;
  }
  if (event.target.closest('#listToggle')) {
    state.castList = !state.castList;
    renderCast();
    return;
  }
  if (event.target.closest('#infoToggle')) {
    state.castInfo = !state.castInfo;
    renderCast();
    return;
  }
  if (event.target.closest('#castCancel') || event.target.closest('#cardCancel')) {
    state.draft = null;
    state.deleteArm = '';
    loadAll().then(() => showView('stage'));
    return;
  }
  if (event.target.closest('#castNew') || event.target.closest('#cardNew')) {
    beginDraft('companion');
    return;
  }
  const pick = event.target.closest('[data-pick]');
  if (pick) {
    const person = state.cast.find((item) => item.id === pick.dataset.pick);
    if (person) choosePerson(person);
    return;
  }
  if (event.target.closest('#castGo')) {
    const current = reel()[state.castIndex];
    if (!current) beginDraft('companion');
    else choosePerson(current);
    return;
  }
  const kind = event.target.closest('[data-kind]');
  if (kind && state.view === 'card') {
    const person = cardPerson();
    if (person) {
      person.kind = kind.dataset.kind;
      if (!person.role || person.role === 'Companion' || person.role === 'Persona') {
        person.role = person.kind === 'persona' ? 'Persona' : 'Companion';
      }
      renderCard();
    }
    return;
  }
  if (event.target.closest('#accept')) {
    acceptCard();
    return;
  }
  if (event.target.closest('#dropCard')) {
    const person = cardPerson();
    if (!person || !person.id) return;
    if (state.deleteArm !== person.id) {
      state.deleteArm = person.id;
      renderCard();
      return;
    }
    await api('/api/cast/' + person.id, { method: 'DELETE' });
    if (state.selectedId === person.id) state.selectedId = '';
    state.draft = null;
    state.deleteArm = '';
    await loadAll();
    showView('cast');
    renderCast();
    return;
  }
  const connection = event.target.closest('[data-connection]');
  if (connection) {
    state.connection = connection.dataset.connection;
    renderMore();
    return;
  }
  if (event.target.closest('[data-clear-filter]')) {
    state.filterTag = '';
    state.filterGroup = '';
    refreshLibrary();
    return;
  }
  const tag = event.target.closest('[data-tag]');
  if (tag && event.target.closest('#filters')) {
    state.filterTag = tag.dataset.tag;
    state.filterGroup = tag.dataset.group;
    refreshLibrary();
    return;
  }
  if (event.target.closest('#muse')) {
    state.museOpen = !state.museOpen;
    $('#musePop').classList.toggle('hidden', !state.museOpen);
    return;
  }
  if (event.target.closest('#museLater')) {
    state.museOpen = false;
    $('#musePop').classList.add('hidden');
    return;
  }
  if (event.target.closest('#museShow')) {
    state.tour = (state.tour + 1) % (TOUR.length + 1);
    if (state.tour === 0) {
      $('#museText').innerHTML = '<em>puff</em> Hi! I\'m Muse, your familiar. Want the tour?';
      return;
    }
    $('#museText').textContent = TOUR[state.tour - 1];
    if (state.tour === 1 || state.tour === 2) showView('stage');
    if (state.tour === 3) showView('cast');
    if (state.tour === 4) showView('card');
  }
});

$('#composer').addEventListener('submit', (event) => {
  event.preventDefault();
  generate($('#prompt').value);
});

$('#prompt').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    generate($('#prompt').value);
  }
});

$('#file').addEventListener('change', () => {
  const file = $('#file').files && $('#file').files[0];
  const chip = $('#fileChip');
  if (!file) {
    chip.classList.add('hidden');
    return;
  }
  chip.textContent = file.name;
  chip.classList.remove('hidden');
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'key') state.key = event.target.value;
});

$('#sQ').addEventListener('input', () => {
  renderLatest();
  if (state.view === 'cast') renderCast();
  if (state.view === 'memory') refreshLibrary();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.openPairingId) {
    closePairingLibrary();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#sQ').focus();
    return;
  }
  if (state.view !== 'cast') return;
  if (!event.target.matches('input, textarea')) {
    if (event.key === 'ArrowLeft') spin(-1);
    if (event.key === 'ArrowRight') spin(1);
    if (event.key === 'Enter') {
      event.preventDefault();
      const go = $('#castGo');
      if (go) go.click();
    }
  }
  if (event.key === 'Escape') showView('stage');
});

$('#view-cast').addEventListener('input', (event) => {
  if (event.target.id === 'castFind') {
    $('#sQ').value = event.target.value;
    state.castIndex = 0;
    renderLatest();
    renderCast();
    const find = $('#castFind');
    if (find) {
      find.focus();
      const end = find.value.length;
      find.setSelectionRange(end, end);
    }
  }
});

$('#loopDock').addEventListener('mouseenter', () => { state.loopPause = true; });
$('#loopDock').addEventListener('mouseleave', () => { state.loopPause = Boolean(state.openPairingId); });
$('#loopDock').addEventListener('focusin', () => { state.loopPause = true; });
$('#loopDock').addEventListener('focusout', () => { state.loopPause = Boolean(state.openPairingId); });

setInterval(() => {
  if (state.loopPause || state.openPairingId || document.hidden || state.view !== 'stage') return;
  if (!state.pairings.length) return;
  stepLoop(1);
}, 4500);

loadAll().then(() => {
  showView('stage');
});
