// The big edit menu from the beta Character Creator.
// Field list, tag categories, and quick/full layout are ported from
// hub/apps/familiar.html on origin/cursor/hub-apis-easy-update-79e7
// (CR_SECTIONS, CR_QUICK, TAG_CATEGORIES, TRAITS).
// This page saves that same sheet. Muse and the picture desk read it from one card.

(function () {
  const SECTIONS = [
    { key: 'identity', icon: '🪪', label: 'Identity', fields: [['name', 'Name', 'c'], ['tagline', 'Tagline: one line that sells her'], ['nickname', 'Nickname'], ['age', 'Age (18+)', 'p', 'num'], ['pronouns', 'Pronouns'], ['species', 'Species / kind'], ['occupation', 'Occupation'], ['userName', 'What she calls you', 'c'], ['role', 'Role / cast', 'c'], ['world', 'World', 'c']] },
    { key: 'look', icon: '👗', label: 'Look & body', fields: [['appearance', 'Appearance (used for every picture)', 'c', 'area'], ['height', 'Height'], ['bodyType', 'Build'], ['bust', 'Bust'], ['marks', 'Marks, tattoos, piercings'], ['outfit', 'Signature outfit'], ['palette', 'Colors'], ['artStyle', 'Art style']] },
    { key: 'personality', icon: '🎭', label: 'Personality', fields: [['persona', 'Personality summary', 'c', 'area'], ['quirks', 'Quirks: little habits and tells', 'p', 'area']], extra: 'traits' },
    { key: 'voice', icon: '🗣️', label: 'Voice', fields: [['speech', 'How she talks', 'p', 'area'], ['catchphrases', 'Catchphrases'], ['examples', 'Example lines', 'p', 'area']] },
    { key: 'story', icon: '📜', label: 'Backstory', fields: [['origin', 'Origin', 'p', 'area'], ['upbringing', 'Upbringing', 'p', 'area'], ['secret', 'A secret'], ['fears', 'Fears']] },
    { key: 'heart', icon: '💗', label: 'Heart & goals', fields: [['want', 'Want: what she is after', 'c'], ['cost', 'Cost: what it costs her', 'c'], ['goals', 'Goals, short and long term', 'p', 'area'], ['likes', 'Likes'], ['dislikes', 'Dislikes'], ['hobbies', 'Hobbies']] },
    { key: 'bond', icon: '🤝', label: 'You & her', fields: [['relationship', 'Relationship: how she knows you', 'p', 'area'], ['dynamic', 'Your dynamic'], ['boundaries', 'Boundaries: things she never does'], ['scenario', 'Scenario', 'c', 'area'], ['firstMessage', 'First message', 'c', 'area']] },
    { key: 'ai', icon: '📝', label: 'AI notes', fields: [['systemNotes', 'System notes: rules the AI always follows', 'c', 'area'], ['authorNote', 'Author’s note: a nudge placed right before every reply', 'c', 'area']] },
    { key: 'rpg', icon: '🎲', label: 'RPG', toggle: 'rpgOn', fields: [['rpgClass', 'Class'], ['race', 'Race'], ['level', 'Level'], ['alignment', 'Alignment'], ['abilities', 'Abilities & skills', 'p', 'area'], ['equipment', 'Equipment', 'p', 'area'], ['weakness', 'Weakness']] },
    { key: 'extras', icon: '⚙️', label: 'Extras', fields: [['quickLines', 'Quick lines (one per line)', 'c', 'lines'], ['checkinLines', 'Check-in lines (one per line)', 'c', 'lines']] },
  ];
  const QUICK = [
    ['name', 'Name', 'c'],
    ['role', 'Role / cast', 'c'],
    ['outfit', 'Outfit', 'p'],
    ['world', 'World', 'c'],
    ['tagline', 'Tagline: one line that sells her'],
    ['persona', 'Description: who she is, how she acts, what she cares about', 'c', 'area', 7],
    ['firstMessage', 'First message', 'c', 'area', 4],
    ['scenario', 'Scenario', 'c', 'area', 2],
    ['authorNote', 'Author’s note', 'c', 'area', 2],
  ];
  const ALWAYS = new Set(['name', 'userName', 'quickLines', 'checkinLines', 'role', 'world', 'outfit']);
  const TAGS = [
    { key: 'genre', label: 'Genre', icon: '🎬', suggest: ['Romance', 'Slice of life', 'Fantasy', 'Sci-fi', 'Horror', 'Comedy', 'Drama', 'Mystery', 'Cyberpunk', 'Gothic'] },
    { key: 'personality', label: 'Personality', icon: '💗', suggest: ['Tsundere', 'Yandere', 'Kuudere', 'Dandere', 'Bratty', 'Sweet', 'Dominant', 'Submissive', 'Flirty', 'Shy', 'Chaotic', 'Wholesome'] },
    { key: 'role', label: 'Role', icon: '🎭', suggest: ['Companion', 'Girlfriend', 'Best friend', 'Mentor', 'Rival', 'Assistant', 'Villain', 'Adventurer', 'Roommate'] },
    { key: 'setting', label: 'Setting', icon: '🌍', suggest: ['Modern', 'Nightclub', 'University', 'Office', 'Medieval', 'Space', 'Post-apocalyptic', 'Small town', 'Big city'] },
    { key: 'species', label: 'Species', icon: '🐾', suggest: ['Human', 'Furry', 'Elf', 'Demon', 'Angel', 'Vampire', 'Catgirl', 'Android', 'Monster girl'] },
    { key: 'rating', label: 'Rating', icon: '🔞', suggest: ['SFW', 'Suggestive', 'NSFW'] },
    { key: 'custom', label: 'My tags', icon: '🏷️', suggest: [] },
  ];
  const TAG_COLORS = { genre: '#9b7bff', personality: '#ff6fae', role: '#4fb3ff', setting: '#3fd0b0', species: '#f0b44c', rating: '#ff6b6b', custom: '#b9a8d6' };
  const TRAITS = [
    { key: 'bold', left: 'Shy', right: 'Bold' },
    { key: 'sassy', left: 'Sweet', right: 'Sassy' },
    { key: 'chaos', left: 'Calm', right: 'Chaotic' },
    { key: 'playful', left: 'Serious', right: 'Playful' },
    { key: 'affection', left: 'Reserved', right: 'Affectionate' },
  ];
  const ARCHETYPES = ['Brat', 'Sweetheart', 'Mentor', 'Rival', 'Chaotic gremlin', 'Ice queen', 'Golden retriever', 'Gothic romantic', 'Scholar', 'Trickster', 'Protector', 'Diva', 'Slacker', 'Hype friend'];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function blank() {
    return {
      name: '',
      kind: 'companion',
      role: 'Companion',
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

  function fromPerson(person) {
    const sheet = blank();
    const src = person && person.sheet && typeof person.sheet === 'object' ? person.sheet : null;
    if (src) {
      Object.assign(sheet, {
        name: src.name || '',
        kind: src.kind === 'persona' ? 'persona' : 'companion',
        role: src.role || '',
        world: src.world || '',
        persona: src.persona || '',
        want: src.want || '',
        cost: src.cost || '',
        appearance: src.appearance || '',
        scenario: src.scenario || '',
        firstMessage: src.firstMessage || '',
        userName: src.userName || '',
        systemNotes: src.systemNotes || '',
        authorNote: src.authorNote || '',
      });
      sheet.quickLines = Array.isArray(src.quickLines) ? src.quickLines.slice() : [];
      sheet.checkinLines = Array.isArray(src.checkinLines) ? src.checkinLines.slice() : [];
      sheet.profile = { ...sheet.profile, ...(src.profile || {}) };
      sheet.profile.traits = { ...blank().profile.traits, ...(src.profile && src.profile.traits) };
      sheet.profile.archetypes = Array.isArray(src.profile && src.profile.archetypes) ? src.profile.archetypes.slice() : [];
      sheet.tags = { ...sheet.tags };
      for (const cat of TAGS) sheet.tags[cat.key] = Array.isArray(src.tags && src.tags[cat.key]) ? src.tags[cat.key].slice() : [];
      sheet.exclude = { ...(src.exclude || {}) };
      sheet.lorebook = Array.isArray(src.lorebook) ? src.lorebook.map((entry) => ({ ...entry })) : [];
    }
    if (person) {
      if (!sheet.name) sheet.name = person.name || '';
      if (!sheet.kind) sheet.kind = person.kind === 'persona' ? 'persona' : 'companion';
      if (!sheet.role) sheet.role = person.role || '';
      if (!sheet.world) sheet.world = person.world || '';
      if (!sheet.profile.outfit) sheet.profile.outfit = person.outfit || '';
      if (!sheet.profile.tagline) sheet.profile.tagline = person.one || '';
      if (!(sheet.tags.custom || []).length && Array.isArray(person.tags)) sheet.tags.custom = person.tags.slice();
    }
    if (!sheet.role) sheet.role = sheet.kind === 'persona' ? 'Persona' : 'Companion';
    return sheet;
  }

  function getField(sheet, field) {
    const [key, , where, kind] = field;
    const raw = where === 'c' ? sheet[key] : sheet.profile[key];
    if (kind === 'lines') return Array.isArray(raw) ? raw.join('\n') : String(raw || '');
    return raw == null ? '' : String(raw);
  }

  function setField(sheet, field, value) {
    const [key, , where, kind] = field;
    let next = value;
    if (kind === 'lines') next = String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 12);
    else if (kind === 'num') {
      const n = Number(String(value || '').trim());
      next = Number.isFinite(n) ? String(Math.max(18, Math.min(120, Math.round(n)))) : '';
    } else next = String(value || '');
    if (where === 'c') sheet[key] = next;
    else sheet.profile[key] = next;
  }

  function allFields() {
    return SECTIONS.flatMap((section) => section.fields).concat(QUICK);
  }

  function toCard(sheet) {
    const tags = TAGS.flatMap((cat) => sheet.tags[cat.key] || []);
    const description = [sheet.persona, sheet.appearance ? 'Appearance: ' + sheet.appearance : ''].filter(Boolean).join('\n\n');
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: sheet.name,
        description,
        personality: [sheet.profile.tagline, sheet.want && 'Want: ' + sheet.want, sheet.cost && 'Cost: ' + sheet.cost].filter(Boolean).join('\n'),
        scenario: sheet.scenario,
        first_mes: sheet.firstMessage,
        mes_example: sheet.profile.examples || '',
        creator_notes: sheet.profile.tagline || '',
        system_prompt: sheet.systemNotes,
        post_history_instructions: sheet.authorNote,
        tags: tags.length ? tags : ['familiar'],
        creator: sheet.userName || '',
        character_version: '1',
        extensions: {
          familiar: {
            kind: sheet.kind,
            role: sheet.role,
            world: sheet.world,
            persona: sheet.persona,
            appearance: sheet.appearance,
            outfit: sheet.profile.outfit,
            profile: sheet.profile,
            tags: sheet.tags,
            exclude: sheet.exclude,
          },
        },
      },
    };
  }

  function applyCard(sheet, card) {
    const data = card && (card.data || card);
    if (!data || !data.name) throw new Error('That file is not a character card (no name).');
    const familiar = (data.extensions && data.extensions.familiar) || {};
    sheet.name = data.name;
    if (familiar.kind === 'persona' || familiar.kind === 'companion') sheet.kind = familiar.kind;
    if (familiar.role) sheet.role = familiar.role;
    if (familiar.world) sheet.world = familiar.world;
    if (familiar.persona || data.description) sheet.persona = familiar.persona || data.description;
    if (familiar.appearance) sheet.appearance = familiar.appearance;
    if (data.scenario) sheet.scenario = data.scenario;
    if (data.first_mes) sheet.firstMessage = data.first_mes;
    if (data.system_prompt) sheet.systemNotes = data.system_prompt;
    if (data.post_history_instructions) sheet.authorNote = data.post_history_instructions;
    if (familiar.profile) sheet.profile = { ...sheet.profile, ...familiar.profile };
    if (familiar.outfit) sheet.profile.outfit = familiar.outfit;
    if (familiar.tags) {
      for (const cat of TAGS) if (Array.isArray(familiar.tags[cat.key])) sheet.tags[cat.key] = familiar.tags[cat.key].slice();
    }
    if (data.creator_notes && !sheet.profile.tagline) sheet.profile.tagline = String(data.creator_notes).split('\n')[0];
  }

  const ui = {
    host: null,
    sheet: null,
    hooks: {},
    mode: 'full',
    picks: false,
    open: { identity: true, tags: true, look: true },
    personId: '',
  };

  function fieldHtml(field) {
    const [key, label, , kind] = field;
    const off = ui.picks && !!ui.sheet.exclude[key];
    const wide = kind === 'area' || kind === 'lines';
    const value = esc(getField(ui.sheet, field));
    const control = wide
      ? '<textarea data-crkey="' + esc(key) + '" rows="' + (kind === 'lines' ? 4 : (field[4] || 3)) + '">' + value + '</textarea>'
      : '<input data-crkey="' + esc(key) + '" ' + (kind === 'num' ? 'type="number" min="18" ' : '') + 'value="' + value + '">';
    const tick = ui.picks && !ALWAYS.has(key)
      ? '<input type="checkbox" data-crinc="' + esc(key) + '"' + (off ? '' : ' checked') + ' title="Include this in the prompt and the card">'
      : '';
    return '<div class="cr-field' + (wide ? ' wide' : '') + (off ? ' excluded' : '') + '"><div class="cr-lbl">' + tick + '<label>' + esc(label) + '</label>' + (off ? '<small class="out">left out</small>' : '') + '</div>' + control + '</div>';
  }

  function kindHtml() {
    const kind = ui.sheet.kind === 'persona' ? 'persona' : 'companion';
    return '<div class="seg" role="group" aria-label="Companion or Persona"><button type="button" data-kind="companion" aria-pressed="' + (kind === 'companion') + '">Companion</button><button type="button" data-kind="persona" aria-pressed="' + (kind === 'persona') + '">Persona</button></div>';
  }

  function summaryHtml() {
    const sheet = ui.sheet;
    const profile = sheet.profile;
    const info = [profile.species, profile.occupation, sheet.role, sheet.world, profile.outfit].filter(Boolean);
    const tags = TAGS.flatMap((cat) => (sheet.tags[cat.key] || []).map((tag) => '<span class="tagchip" style="--tc:' + TAG_COLORS[cat.key] + '">' + esc(tag) + '</span>')).join('');
    return '<section class="cr-card" id="cr-card"><div class="cc-body"><p class="k">Character card</p><div class="cc-name">' + esc(sheet.name || 'New character') + (profile.nickname ? ' <em>“' + esc(profile.nickname) + '”</em>' : '') + '</div><div class="cc-tagline">' + esc(profile.tagline || 'Give her a tagline.') + '</div>' + (info.length ? '<div class="cc-info">' + info.map((bit) => '<span>' + esc(bit) + '</span>').join('') + '</div>' : '') + (tags ? '<div class="cc-tags">' + tags + '</div>' : '') + kindHtml() + '</div></section>';
  }

  function tagsHtml() {
    const blocks = TAGS.map((cat) => {
      const on = ui.sheet.tags[cat.key] || [];
      const sugg = cat.suggest.filter((tag) => !on.some((have) => have.toLowerCase() === tag.toLowerCase()));
      return '<div class="tag-cat" style="--tc:' + TAG_COLORS[cat.key] + '"><div class="tag-cat-h">' + cat.icon + ' ' + esc(cat.label) + '</div><div class="tag-row">'
        + on.map((tag) => '<span class="tagchip on">' + esc(tag) + '<button type="button" data-tagdel="' + cat.key + '" data-tag="' + esc(tag) + '" title="Remove">×</button></span>').join('')
        + sugg.map((tag) => '<button type="button" class="tagchip sugg" data-tagadd="' + cat.key + '" data-tag="' + esc(tag) + '">+ ' + esc(tag) + '</button>').join('')
        + '<input class="tag-in" data-tagin="' + cat.key + '" placeholder="add…" aria-label="Add a ' + esc(cat.label) + ' tag"></div></div>';
    }).join('');
    return '<details class="cr-sec" id="cr-tags" open><summary><h3>🏷️ Tags</h3></summary><p class="muted small-note">Sort her so you can find her again. Tap a suggestion or type your own and press Enter. My tags are the free tags on the picture.</p><div class="tag-cats">' + blocks + '</div></details>';
  }

  function traitsHtml() {
    const traits = TRAITS.map((trait) => '<label class="trait"><span>' + trait.left + '</span><input type="range" min="0" max="100" value="' + Number(ui.sheet.profile.traits[trait.key] ?? 50) + '" data-trait="' + trait.key + '"><span>' + trait.right + '</span></label>').join('');
    const picked = new Set(ui.sheet.profile.archetypes || []);
    const arches = ARCHETYPES.map((name) => '<button type="button" data-arch="' + esc(name) + '" aria-pressed="' + picked.has(name) + '">' + esc(name) + '</button>').join('');
    return '<div class="cr-sub">Temperament sliders</div><div class="cr-traits">' + traits + '</div><div class="cr-sub">Archetype blend</div><div class="archs">' + arches + '</div>';
  }

  function sectionHtml(section) {
    const open = ui.open[section.key] ? ' open' : '';
    const rpg = section.toggle
      ? '<label class="check"><input type="checkbox" data-crtoggle="' + section.toggle + '"' + (ui.sheet.profile[section.toggle] ? ' checked' : '') + '> Include this section on the card</label>'
      : '';
    return '<details class="cr-sec" id="cr-' + section.key + '"' + open + '><summary><h3>' + section.icon + ' ' + esc(section.label) + '</h3></summary>' + rpg + '<div class="cr-grid">' + section.fields.map(fieldHtml).join('') + '</div>' + (section.extra === 'traits' ? traitsHtml() : '') + '</details>';
  }

  function quickHtml() {
    return '<section class="cr-sec" id="cr-quick"><div class="cr-sechead"><h3>⚡ Quick character</h3><span class="muted small-note">The boxes a picture needs, plus the first message. Switch to Full for every section.</span></div><div class="cr-grid">' + QUICK.map(fieldHtml).join('') + '</div></section>';
  }

  function loreHtml() {
    const rows = (ui.sheet.lorebook || []).map((entry, index) => (
      '<div class="lore"><input data-lore="' + index + '" data-lf="title" value="' + esc(entry.title || '') + '" placeholder="Title" aria-label="Lore title"><input data-lore="' + index + '" data-lf="keys" value="' + esc((entry.keys || []).join(', ')) + '" placeholder="keywords, comma separated" aria-label="Lore keywords"><textarea data-lore="' + index + '" data-lf="content" rows="3" placeholder="What she should know when this comes up">' + esc(entry.content || '') + '</textarea><button type="button" class="quiet" data-loredel="' + index + '">Remove</button></div>'
    )).join('');
    return '<details class="cr-sec" id="cr-lore"><summary><h3>📚 Lorebook</h3></summary><p class="muted small-note">Places, people, and history she should know when the words come up.</p>' + (rows || '<p class="muted small-note">Empty for now.</p>') + '<button type="button" class="quiet" id="loreAdd">Add entry</button></details>';
  }

  function jsonHtml() {
    return '<details class="cr-sec" id="cr-json"><summary><h3>📦 Card JSON</h3></summary><p class="muted small-note">SillyTavern-style card (chara_card_v2). The familiar block is the sheet Muse uses. Paste a card and press Load.</p><textarea id="crJson" rows="8">' + esc(JSON.stringify(toCard(ui.sheet), null, 2)) + '</textarea><div class="card-actions"><button type="button" class="quiet" id="crJsonLoad">Load</button></div><p id="crJsonNote" class="hint"></p></details>';
  }

  function togetherHtml() {
    const turns = (ui.hooks.turns || []).filter((turn) => !ui.personId || turn.characterId === ui.personId).slice(-6);
    const pics = ui.hooks.pictures || [];
    const lines = turns.map((turn) => '<li><b>' + (turn.role === 'muse' ? 'Muse' : 'You') + '</b> ' + esc(turn.text) + '</li>').join('');
    return '<details class="cr-sec" id="cr-together"><summary><h3>💞 You two so far</h3></summary><p class="muted small-note">' + pics.length + ' pictures kept with this card.</p>' + (lines ? '<ul class="tg-msgs">' + lines + '</ul>' : '<p class="muted small-note">No messages yet. Chat on the stage and they collect here.</p>') + '</details>';
  }

  function navHtml() {
    const links = [['card', '📇 Card']];
    if (ui.personId) links.push(['together', '💞 You two']);
    if (ui.mode === 'quick') links.push(['quick', '⚡ Quick']);
    links.push(['tags', '🏷️ Tags']);
    if (ui.mode === 'full') for (const section of SECTIONS) links.push([section.key, section.icon + ' ' + section.label]);
    links.push(['lore', '📚 Lorebook'], ['json', '📦 Card JSON']);
    return links.map(([key, label]) => '<a href="#cr-' + key + '" data-crjump="' + key + '">' + label + '</a>').join('');
  }

  function readDom() {
    const sheet = ui.sheet;
    const fields = allFields();
    ui.host.querySelectorAll('[data-crkey]').forEach((input) => {
      const field = fields.find((item) => item[0] === input.dataset.crkey);
      if (field) setField(sheet, field, input.value);
    });
    ui.host.querySelectorAll('[data-crinc]').forEach((box) => {
      sheet.exclude[box.dataset.crinc] = !box.checked;
    });
    const rpg = ui.host.querySelector('[data-crtoggle="rpgOn"]');
    if (rpg) sheet.profile.rpgOn = rpg.checked;
    ui.host.querySelectorAll('[data-trait]').forEach((slider) => {
      sheet.profile.traits[slider.dataset.trait] = Number(slider.value);
    });
    ui.host.querySelectorAll('[data-lore]').forEach((input) => {
      const entry = sheet.lorebook[Number(input.dataset.lore)];
      if (!entry) return;
      if (input.dataset.lf === 'keys') entry.keys = input.value.split(',').map((part) => part.trim()).filter(Boolean);
      else entry[input.dataset.lf] = input.value;
    });
  }

  function render() {
    const host = ui.host;
    const keep = host.querySelector('.cr-form');
    const scroll = keep ? keep.scrollTop : 0;
    const body = (ui.mode === 'quick' ? quickHtml() : SECTIONS.map(sectionHtml).join('')) + tagsHtml() + loreHtml() + jsonHtml();
    host.innerHTML = '<div class="creator"><div class="cr-head"><div class="cr-title"><b>Character Creator</b><span class="muted">' + esc(ui.sheet.name || '') + '</span></div><div class="cr-tools"><div class="seg" id="crModeSeg"><button type="button" data-crmode="quick" aria-pressed="' + (ui.mode === 'quick') + '">Quick</button><button type="button" data-crmode="full" aria-pressed="' + (ui.mode === 'full') + '">Full</button></div><button type="button" class="quiet" id="crPicks" aria-pressed="' + ui.picks + '">Choose what goes in</button></div><p class="muted small-note">Same card Muse uses. Accept writes the name, role, outfit, world, and tags the next picture keeps.</p></div><div class="cr-body"><nav class="cr-nav" id="crNav">' + navHtml() + '</nav><div class="cr-form" id="crForm">' + summaryHtml() + (ui.personId ? togetherHtml() : '') + body + '<div class="card-actions"><button type="button" class="primary" id="accept">Accept</button>' + (ui.personId ? '<button type="button" class="quiet danger" id="dropCard">Delete card</button>' : '') + '<button type="button" class="quiet" id="cardCancel">Cancel</button></div><p id="crStatus" class="hint"></p></div></div></div>';
    const form = host.querySelector('.cr-form');
    if (form) form.scrollTop = scroll;
  }

  function addTag(cat, raw) {
    const tag = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!tag) return;
    const list = ui.sheet.tags[cat] || [];
    if (list.some((have) => have.toLowerCase() === tag.toLowerCase())) return;
    if (list.length >= 12) return;
    list.push(tag);
    ui.sheet.tags[cat] = list;
  }

  function mount(host, person, hooks) {
    ui.host = host;
    ui.hooks = hooks || {};
    ui.sheet = fromPerson(person);
    ui.personId = person && person.id || '';
    ui.mode = 'full';
    ui.picks = false;
    ui.open = { identity: true, tags: true, look: true };
    render();
  }

  document.addEventListener('click', (event) => {
    if (!ui.host || !event.target.closest('#view-card')) return;
    const mode = event.target.closest('[data-crmode]');
    if (mode) {
      readDom();
      ui.mode = mode.dataset.crmode === 'quick' ? 'quick' : 'full';
      render();
      return;
    }
    if (event.target.closest('#crPicks')) {
      readDom();
      ui.picks = !ui.picks;
      render();
      return;
    }
    const kind = event.target.closest('[data-kind]');
    if (kind) {
      readDom();
      ui.sheet.kind = kind.dataset.kind === 'persona' ? 'persona' : 'companion';
      if (!ui.sheet.role || ui.sheet.role === 'Companion' || ui.sheet.role === 'Persona') {
        ui.sheet.role = ui.sheet.kind === 'persona' ? 'Persona' : 'Companion';
      }
      render();
      return;
    }
    const jump = event.target.closest('[data-crjump]');
    if (jump) {
      event.preventDefault();
      const section = document.getElementById('cr-' + jump.dataset.crjump);
      if (section) {
        if (section.tagName === 'DETAILS') section.open = true;
        section.scrollIntoView({ block: 'start' });
      }
      return;
    }
    const add = event.target.closest('[data-tagadd]');
    if (add) {
      readDom();
      addTag(add.dataset.tagadd, add.dataset.tag);
      render();
      return;
    }
    const del = event.target.closest('[data-tagdel]');
    if (del) {
      readDom();
      ui.sheet.tags[del.dataset.tagdel] = (ui.sheet.tags[del.dataset.tagdel] || []).filter((tag) => tag !== del.dataset.tag);
      render();
      return;
    }
    const arch = event.target.closest('[data-arch]');
    if (arch) {
      readDom();
      const name = arch.dataset.arch;
      const list = ui.sheet.profile.archetypes || [];
      ui.sheet.profile.archetypes = list.includes(name) ? list.filter((item) => item !== name) : list.concat(name).slice(0, 3);
      render();
      return;
    }
    if (event.target.closest('#loreAdd')) {
      readDom();
      ui.sheet.lorebook.push({ title: '', keys: [], content: '' });
      ui.open.lore = true;
      render();
      const added = ui.host.querySelector('#cr-lore');
      if (added) added.open = true;
      return;
    }
    const loreDel = event.target.closest('[data-loredel]');
    if (loreDel) {
      readDom();
      ui.sheet.lorebook.splice(Number(loreDel.dataset.loredel), 1);
      render();
      return;
    }
    if (event.target.closest('#crJsonLoad')) {
      const note = ui.host.querySelector('#crJsonNote');
      try {
        readDom();
        applyCard(ui.sheet, JSON.parse(ui.host.querySelector('#crJson').value));
        render();
      } catch (error) {
        if (note) note.textContent = error.message || 'That box is not a card.';
      }
      return;
    }
    if (event.target.closest('#accept')) {
      readDom();
      if (ui.hooks.onSave) ui.hooks.onSave(ui.sheet);
      return;
    }
    if (event.target.closest('#cardCancel')) {
      if (ui.hooks.onCancel) ui.hooks.onCancel();
      return;
    }
    if (event.target.closest('#dropCard')) {
      if (ui.hooks.onDelete) ui.hooks.onDelete();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!ui.host || event.key !== 'Enter' || !event.target.matches('[data-tagin]')) return;
    event.preventDefault();
    readDom();
    addTag(event.target.dataset.tagin, event.target.value);
    render();
  });

  document.addEventListener('toggle', (event) => {
    if (!ui.host || !event.target.id || !event.target.id.startsWith('cr-')) return;
    ui.open[event.target.id.slice(3)] = event.target.open;
  }, true);

  window.Creator = { mount, fromPerson, toCard };
})();
