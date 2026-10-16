// Vibe Monster — maps, NPCs, warps and event scripts.
// Tile legend:
//  . grass   , tall grass (encounters)   = path   F flowers   T tree   ~ water   # rock
//  R/r/p roofs   H wall   W window   D door   S sign   G prison gate   Y prison wall   J prison sign
//  V spa sign   M boutique sign   _ wood floor   g prison floor   k carpet   B wall   X prison wall
//  I bars   C counter   K shelf   b bed   P computer   t table   m exit mat
'use strict';

const WALKABLE = new Set(['.', ',', '=', 'F', '_', 'g', 'k', 'm', 'D']);

const MAPS = {
  loft: {
    name: 'Your Loft', pal: 'town', bg: 'indoor',
    rows: [
      'BBBBBBBBBB',
      'BKK___t_bB',
      'B________B',
      'B__tt____B',
      'B________B',
      'B________B',
      'B___mm___B',
      'BBBBBBBBBB',
    ],
    warps: [{ x: 4, y: 6, to: 'town', tx: 4, ty: 5, dir: 'down' }, { x: 5, y: 6, to: 'town', tx: 4, ty: 5, dir: 'down' }],
    npcs: [
      { id: 'deb', x: 6, y: 4, dir: 'left', look: 'mom', talk: async () => {
        if (!flag('gotDex')) await say(["Deb (your roommate): Morning, sunshine. Professor Rizzwell called. Like, four times.", "Deb: She said something about a 'Vibe-Dex' and that you're 'exactly her type of test subject.' Lab's on the east side of town."]);
        else if (!flag('badge1')) await say(["Deb: Heading to Brunchville? The gym there is a literal prison full of Karens.", "Deb: Bring snacks. And a lawyer."]);
        else await say("Deb: A BADGE? Okay, overachiever. Rent's still due Friday, though.");
        if (!flag('debHeal')) return;
      } },
    ],
    signs: [{ x: 8, y: 1, text: "Your bed. It's seen things. Mostly Netflix." }, { x: 1, y: 1, text: "A shelf of self-help books: 'Rizz for Dummies', 'Catching Feelings (and Vibemon)'." }],
  },

  town: {
    name: 'Thirstwater Town', pal: 'town', bg: 'route', music: 'town',
    rows: [
      'TTTTTTTTT==TTTTTTTTT',
      'T........==.......FT',
      'T.RRRRR..==..rrrrr.T',
      'T.RRRRR..==..rrrrr.T',
      'T.HWDWH..==..HWDWH.T',
      'T...=============..T',
      'T........==.......FT',
      'TF.S.....==....S...T',
      'T........==........T',
      'T..RRRR..==.......FT',
      'T..HDWH..==..~~~~..T',
      'T........==..~~~~..T',
      'T.FF.....==.....FF.T',
      'T........==........T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 4, y: 4, to: 'loft', tx: 4, ty: 5, dir: 'up' },
      { x: 15, y: 4, to: 'lab', tx: 5, ty: 7, dir: 'up' },
      { x: 4, y: 10, to: 'house1', tx: 4, ty: 4, dir: 'up' },
      { x: 9, y: 0, to: 'route69', tx: 7, ty: 26, dir: 'up' },
      { x: 10, y: 0, to: 'route69', tx: 8, ty: 26, dir: 'up' },
    ],
    triggers: [
      { x: 9, y: 1, run: blockedNorth }, { x: 10, y: 1, run: blockedNorth },
    ],
    npcs: [
      { id: 'townie', x: 13, y: 8, dir: 'left', look: 'old', wander: true, talk: "Old Man Gerald: Back in my day we caught Vibemon with a net and a compliment. Now it's all apps and 'Crush Balls.'" },
      { id: 'townie2', x: 6, y: 12, dir: 'up', look: 'influencer', talk: "Brittany: The tall grass up north is where wild Vibemon flirt with strangers. Wear something cute." },
    ],
    signs: [
      { x: 3, y: 7, text: "THIRSTWATER TOWN — 'A Town Full of Thirst.' Population: horny for adventure." },
      { x: 15, y: 7, text: "RIZZWELL VIBEMON LAB — Research into the science of charm. No solicitors. Some flirting." },
    ],
  },

  house1: {
    name: "Neighbor's House", pal: 'town', bg: 'indoor',
    rows: ['BBBBBBBBBB', 'BKK____KKB', 'B________B', 'B__tt____B', 'B________B', 'B___mm___B', 'BBBBBBBBBB'],
    warps: [{ x: 4, y: 5, to: 'town', tx: 4, ty: 11, dir: 'down' }, { x: 5, y: 5, to: 'town', tx: 4, ty: 11, dir: 'down' }],
    npcs: [
      { id: 'neighbor', x: 6, y: 3, dir: 'left', look: 'bro', talk: async () => {
        if (!flag('neighborGift') && flag('gotDex')) {
          await say("Kevin: Yo, you're the one Rizzwell's bragging about. Here. My ex left these. Don't ask.");
          giveItem('latte', 2);
          setFlag('neighborGift');
        } else await say("Kevin: Flustered Vibemon are way easier to catch. Flirt first, throw later. That's how I met my wife.");
      } },
    ],
  },

  lab: {
    name: 'Rizzwell Lab', pal: 'town', bg: 'lab',
    rows: [
      'BBBBBBBBBBBB',
      'BKKK_PP_KKKB',
      'B__________B',
      'B___ttt____B',
      'B__________B',
      'B__________B',
      'BKK______KKB',
      'B__________B',
      'B____mm____B',
      'BBBBBBBBBBBB',
    ],
    warps: [{ x: 5, y: 8, to: 'town', tx: 15, ty: 5, dir: 'down' }, { x: 6, y: 8, to: 'town', tx: 15, ty: 5, dir: 'down' }],
    onEnter: labIntro,
    npcs: [
      { id: 'prof', x: 5, y: 2, dir: 'down', look: 'prof', talk: async () => {
        if (!flag('badge1')) await say(["Prof. Rizzwell: Remember the Composure system: attacks cost Stamina, and chaining them gets pricier.", "Prof. Rizzwell: Use an Energy technique — a Stance, Revitalize, Compose or Flaunt — to reset your combo. Flustered foes are easier to catch!", "Prof. Rizzwell: The first gym is in Brunchville, past Route 69 and the Velvet Woods."]);
        else await say("Prof. Rizzwell: A Manager Badge! My hypothesis was correct: you are dangerously charming. Batch 2 awaits!");
      } },
      { id: 'rival', x: 3, y: 4, dir: 'right', look: 'rival', talk: async () => {
        const r = rivalId();
        const lines = { margaux: "Margaux: I've drafted a 12-point improvement plan for you. You're welcome.", tansy: "Tansy: Rematch later, okay? I need to, like, re-do my lashes first.", hilde: "Hilde: Train well, comrade. I will be waiting. Possibly in a garden." };
        await say(lines[r]);
      } },
      { id: 'third', x: 8, y: 4, dir: 'left', look: 'third', talk: async () => {
        const t = thirdId();
        const lines = { margaux: "Margaux: I'm only here to audit the Professor's lab safety compliance. ...Fine, and to see you. Don't make it weird.", tansy: "Tansy: OMG hi! I'm, like, totally not here for the free lab snacks. Okay, I am.", hilde: "Hilde: I am here to observe. And to ask the Professor whether tomatoes can be Vibemon." };
        await say(lines[t]);
      } },
    ],
    signs: [{ x: 5, y: 1, text: "The lab computer. Its search history is 100% 'charm research.' Allegedly." }, { x: 6, y: 1, text: "A spreadsheet titled 'Rizz Coefficients by Species.'" }],
  },

  route69: {
    name: 'Route 69 — Flirt Path', pal: 'town', bg: 'route', enc: 'route69',
    rows: [
      'TTTTTTT==TTTTTTT',
      'T,,,,,.==......T',
      'T,,,,,.==..,,,,T',
      'T,,,,,.==..,,,,T',
      'T.....===..,,,,T',
      'T..S..=....,,,,T',
      'T.....=........T',
      'TTTT..=...TTTTTT',
      'T.....=........T',
      'T.,,,,=,,,,,,..T',
      'T.,,,,=,,,,,,..T',
      'T.,,,,=,,,,,,..T',
      'T.....=........T',
      'TTTTT.=..TTTTTTT',
      'T.....=........T',
      'T~~~..=..,,,,,.T',
      'T~~~..=..,,,,,.T',
      'T~~~..=..,,,,,.T',
      'T.....=........T',
      'T..FF.=..FF....T',
      'T.....=........T',
      'T.,,,,=,,,,....T',
      'T.,,,,=,,,,....T',
      'T.....=........T',
      'T.....===......T',
      'T......==......T',
      'T......==......T',
      'TTTTTTT==TTTTTTT',
    ],
    warps: [
      { x: 7, y: 27, to: 'town', tx: 9, ty: 1, dir: 'down' }, { x: 8, y: 27, to: 'town', tx: 10, ty: 1, dir: 'down' },
      { x: 7, y: 0, to: 'velvet', tx: 9, ty: 22, dir: 'up' }, { x: 8, y: 0, to: 'velvet', tx: 10, ty: 22, dir: 'up' },
    ],
    npcs: [
      { id: 'brad', x: 10, y: 18, dir: 'left', look: 'bro', trainer: 'bro_brad', sight: 4 },
      { id: 'kayleigh', x: 2, y: 8, dir: 'right', look: 'influencer', trainer: 'influ_kayleigh', sight: 4 },
      { id: 'r69tip', x: 13, y: 23, dir: 'left', look: 'old', talk: "Hiker Doug: Tall grass hides wild Vibemon. Lower their Stamina, Flaunt to Fluster them, THEN throw a Crush Ball. Works on people too. (It does not.)" },
    ],
    items: [{ id: 'r69a', x: 13, y: 12, item: 'crushball', n: 3 }, { id: 'r69b', x: 14, y: 20, item: 'latte', n: 1 }, { id: 'r69c', x: 1, y: 3, item: 'espresso', n: 1 }],
    signs: [{ x: 3, y: 5, text: "ROUTE 69 — 'The Flirt Path.' North: Velvet Woods. South: Thirstwater Town. Nice." }],
  },

  velvet: {
    name: 'Velvet Woods', pal: 'forest', bg: 'forest', enc: 'velvet', dark: 0.18,
    rows: [
      'TTTTTTTTT==TTTTTTTTT',
      'TT,,,,,..==..,,,,,TT',
      'TT,,,,,..==..,,,,,TT',
      'TT..TTTTT==TTTTT..TT',
      'TT..T,,,,..,,,,T..TT',
      'TT..T,,,,..,,,,T..TT',
      'TT..T..........T..TT',
      'TT..TTTT....TTTT..TT',
      'TT,,,,,,....,,,,,,TT',
      'TT,,,,,,....,,,,,,TT',
      'TT..........~~~~..TT',
      'TTTTTTT.....~~~~..TT',
      'TT,,,,......~~~~..TT',
      'TT,,,,....,,,,,,..TT',
      'TT,,,,....,,,,,,..TT',
      'TT....TTTTTTTT....TT',
      'TT................TT',
      'TTTTTTTT....TTTTTTTT',
      'TT,,,,,,....,,,,,,TT',
      'TT,,,,,,....,,,,,,TT',
      'TT......====......TT',
      'TT.......==.......TT',
      'TT.......==.......TT',
      'TTTTTTTTT==TTTTTTTTT',
    ],
    warps: [
      { x: 9, y: 23, to: 'route69', tx: 7, ty: 1, dir: 'down' }, { x: 10, y: 23, to: 'route69', tx: 8, ty: 1, dir: 'down' },
      { x: 9, y: 0, to: 'brunch', tx: 10, ty: 16, dir: 'up' }, { x: 10, y: 0, to: 'brunch', tx: 11, ty: 16, dir: 'up' },
    ],
    npcs: [
      { id: 'raven', x: 13, y: 16, dir: 'left', look: 'goth', trainer: 'goth_raven', sight: 4 },
      { id: 'skye', x: 3, y: 10, dir: 'right', look: 'yoga', trainer: 'yoga_skye', sight: 5 },
      { id: 'tyler', x: 13, y: 6, dir: 'left', look: 'bro', trainer: 'bro_tyler', sight: 4 },
      { id: 'vwtip', x: 16, y: 20, dir: 'left', look: 'goth', talk: "Emo Kid (age 23): The Sassquatch in these woods is weak to nothing but Goth energy and its own reflection. Karens HATE Sass moves." },
    ],
    items: [{ id: 'vwa', x: 2, y: 6, item: 'crushball', n: 3 }, { id: 'vwb', x: 17, y: 12, item: 'comeback', n: 1 }, { id: 'vwc', x: 17, y: 1, item: 'thirsttrap', n: 2 }, { id: 'vwd', x: 6, y: 4, item: 'espresso', n: 1 }],
    signs: [],
  },

  brunch: {
    name: 'Brunchville', pal: 'city', bg: 'route',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTT',
      'T.....pppppppppp.....T',
      'T.....pppppppppp.....T',
      'T.....YYYYJDYYYY.....T',
      'T.........==.........T',
      'T.FF......==......FF.T',
      'T.RRRRR...==...rrrrr.T',
      'T.RRRRR...==...rrrrr.T',
      'T.HVDHH...==...HMDHH.T',
      'T...=.....==.....=...T',
      'T...==============...T',
      'T.........==.........T',
      'T.S.......==.....FF..T',
      'T..RRRR...==.........T',
      'T..HDWH...==....~~~~.T',
      'T.........==....~~~~.T',
      'T.........==.........T',
      'TTTTTTTTTT==TTTTTTTTTT',
    ],
    warps: [
      { x: 10, y: 17, to: 'velvet', tx: 9, ty: 1, dir: 'down' }, { x: 11, y: 17, to: 'velvet', tx: 10, ty: 1, dir: 'down' },
      { x: 4, y: 8, to: 'spa', tx: 4, ty: 4, dir: 'up' },
      { x: 17, y: 8, to: 'boutique', tx: 4, ty: 4, dir: 'up' },
      { x: 4, y: 14, to: 'house2', tx: 4, ty: 3, dir: 'up' },
      { x: 11, y: 3, to: 'prison', tx: 6, ty: 17, dir: 'up' },
    ],
    npcs: [
      { id: 'b1', x: 14, y: 11, dir: 'left', look: 'influencer', wander: true, talk: "Mimosa Mandy: Welcome to Brunchville! Bottomless mimosas, endless gossip, and a GYM that's also a PRISON. For Karens." },
      { id: 'b2', x: 7, y: 5, dir: 'down', look: 'old', talk: "Grandma Pearl: The Karens took over the prison and made it a gym. Now they demand to battle every trainer's manager. You ARE the manager now, sweetie." },
      { id: 'b3', x: 13, y: 4, dir: 'down', look: 'guard', talk: async () => {
        if (flag('badge1')) await say("Officer Ruiz: You beat the Warden?! Finally. Now maybe they'll stop filing complaints about the color of the bars.");
        else await say(["Officer Ruiz: Karen Prison — Brunchville's official Gym. Entitled-type specialists.", "Officer Ruiz: Tip: Entitled types are weak to Sass and Swole. Basic and Entitled moves barely tickle them."]);
      } },
      { id: 'cameo', x: 18, y: 12, dir: 'left', look: 'third', talk: async () => {
        const t = thirdId();
        const lines = { margaux: "Margaux: I filed a formal complaint against the Karens. They filed one against my complaint. It's complaints all the way down.", tansy: "Tansy: The Boutique here doesn't take royal IOUs. Like, how is that LEGAL?", hilde: "Hilde: I attempted to storm the prison alone. The Karens asked for my supervisor. I... do not have one anymore. I fled." };
        await say(lines[t]);
      } },
    ],
    signs: [{ x: 2, y: 12, text: "BRUNCHVILLE — 'Where Every Day Is Sunday Brunch.' Gym: Karen Prison (north)." }],
  },

  house2: {
    name: 'Brunch Loft', pal: 'city', bg: 'indoor',
    rows: ['BBBBBBBBBB', 'BKK____bbB', 'B__tt____B', 'B________B', 'B___mm___B', 'BBBBBBBBBB'],
    warps: [{ x: 4, y: 4, to: 'brunch', tx: 4, ty: 15, dir: 'down' }, { x: 5, y: 4, to: 'brunch', tx: 4, ty: 15, dir: 'down' }],
    npcs: [
      { id: 'h2', x: 6, y: 2, dir: 'down', look: 'yoga', talk: async () => {
        if (!flag('h2gift')) { await say("Jessa: You look like someone who's about to fight a Karen. Take this — you'll need emotional support."); giveItem('mimosa', 1); setFlag('h2gift'); }
        else await say("Jessa: Pro tip: Defensive Stance blocks staggers and stat drops. Karens LOVE a Bob Cut Barrage.");
      } },
    ],
  },

  spa: {
    name: 'Self-Care Spa', pal: 'city', bg: 'indoor',
    rows: ['BBBBBBBBBB', 'BK______PB', 'B__CCCC__B', 'B________B', 'B_t____t_B', 'B___mm___B', 'BBBBBBBBBB'],
    warps: [{ x: 4, y: 5, to: 'brunch', tx: 4, ty: 9, dir: 'down' }, { x: 5, y: 5, to: 'brunch', tx: 4, ty: 9, dir: 'down' }],
    npcs: [
      { id: 'nurse', x: 4, y: 1, dir: 'down', look: 'nurse', talk: spaNurse },
    ],
    signs: [{ x: 8, y: 1, text: '__PC__' }],
  },

  boutique: {
    name: 'Thirst Trap Boutique', pal: 'city', bg: 'indoor',
    rows: ['BBBBBBBBBB', 'BKKK__KKKB', 'B__CCCC__B', 'B________B', 'BK______KB', 'B___mm___B', 'BBBBBBBBBB'],
    warps: [{ x: 4, y: 5, to: 'brunch', tx: 17, ty: 9, dir: 'down' }, { x: 5, y: 5, to: 'brunch', tx: 17, ty: 9, dir: 'down' }],
    npcs: [
      { id: 'clerk', x: 5, y: 1, dir: 'down', look: 'clerk', talk: async () => { await say("Clerk Marco: Welcome to Thirst Trap Boutique! Everything's overpriced, but you look like you can afford it."); await openShop(['crushball', 'thirsttrap', 'latte', 'mimosa', 'espresso', 'comeback']); } },
      { id: 'shopper', x: 7, y: 3, dir: 'left', look: 'influencer', talk: "Shopper: I came for a Thirst Trap and left with three. Story of my life." },
    ],
  },

  prison: {
    name: 'Karen Prison (Brunchville Gym)', pal: 'city', bg: 'prison',
    rows: [
      'XXXXXXXXXXXXX',
      'XKKgkkkkkgKKX',
      'XgggkkkkkgggX',
      'XgggkkkkkgggX',
      'XXXXXGGGXXXXX',
      'XgggIgggIgggX',
      'XIIIIgggIIIIX',
      'XgggggggggggX',
      'XgggggggggggX',
      'XIIIIgggIIIIX',
      'XgggIgggIgggX',
      'XIIIIgggIIIIX',
      'XgggggggggggX',
      'XgggggggggggX',
      'XIIIIgggIIIIX',
      'XgggIgggIgggX',
      'XIIIIgggIIIIX',
      'XgggggggggggX',
      'XgggggmgggggX',
      'XXXXXXXXXXXXX',
    ],
    warps: [{ x: 6, y: 18, to: 'brunch', tx: 11, ty: 4, dir: 'down' }],
    gate: { flag: 'gateOpen' },
    npcs: [
      { id: 'guide', x: 4, y: 17, dir: 'right', look: 'guard', talk: async () => {
        await say(["Officer Deshawn: Welcome to Karen Prison, champ-in-training. The inmates took over and made it a gym.", "Officer Deshawn: Beat the three Karens on the floor and the gate to the Warden's office opens.", "Officer Deshawn: Karens are ENTITLED type: weak to Sass and Swole, resistant to Basic, Swole-proof egos notwithstanding.", "Officer Deshawn: And watch out for Bob Cut Barrage. It staggers. Defensive Stance blocks it."]);
        if (!flag('guideGift')) { await say("Officer Deshawn: Here — confiscated contraband. Don't tell the Warden."); giveItem('latte', 2); setFlag('guideGift'); }
      } },
      { id: 'kcoupon', x: 9, y: 13, dir: 'left', look: 'karen', trainer: 'karen_coupon', sight: 4 },
      { id: 'khoa', x: 2, y: 8, dir: 'right', look: 'karen', trainer: 'karen_hoa', sight: 4 },
      { id: 'kmlm', x: 10, y: 7, dir: 'left', look: 'karen', trainer: 'karen_mlm', sight: 5 },
      { id: 'warden', x: 6, y: 2, dir: 'down', look: 'warden', talk: wardenTalk },
      { id: 'inm1', x: 2, y: 15, dir: 'right', look: 'inmate', talk: "Inmate Karen: I asked for the manager. They gave me a life sentence. I'd like to speak to the JUDGE'S manager." },
      { id: 'inm2', x: 10, y: 15, dir: 'left', look: 'inmate', talk: "Inmate Karen: These orange jumpsuits are NOT my season. I'm a Winter. Everyone KNOWS I'm a Winter." },
      { id: 'inm3', x: 2, y: 10, dir: 'right', look: 'inmate', talk: "Inmate Karen: I'm in for returning a used mattress. TWICE. With the receipt from a different store." },
      { id: 'inm4', x: 10, y: 10, dir: 'left', look: 'inmate', talk: "Inmate Karen: I called the cops on a lemonade stand. Then I called the cops on the cops. Now I live here." },
      { id: 'inm5', x: 2, y: 5, dir: 'right', look: 'inmate', talk: "Inmate Karen: My essential oils cure everything except this incarceration." },
      { id: 'inm6', x: 10, y: 5, dir: 'left', look: 'inmate', talk: "Inmate Karen: Is this cell gluten-free? I need to speak to whoever designed these bars." },
    ],
    signs: [],
  },
};

// ---- Map-specific scripts ----
async function blockedNorth() {
  if (flag('gotDex')) return;
  await say(["A voice calls out: Whoa whoa whoa! You can't go into the tall grass with no Vibe-Dex!", "Professor Rizzwell is waiting at her lab — the purple-roof building on the east side."]);
  await stepPlayer('down');
}

async function labIntro() {
  if (flag('gotDex')) return;
  const r = rivalId();
  const rName = DEX_BY_ID[r].name;
  await say([
    `Prof. Rizzwell: Ah, ${playerName()}! There's my favorite walking hypothesis.`,
    "Prof. Rizzwell: I study Vibemon — sassy, flirty creatures that live alongside us. All verified adults, before HR asks.",
    "Prof. Rizzwell: Most trainers send Vibemon to fight for them. But you? You've got the charisma to fight right ALONGSIDE them.",
    "Prof. Rizzwell: So I'm registering you as a Vibe-Fighter. Here's your Vibe-Dex!",
  ]);
  setFlag('gotDex');
  markSeen(G.state.party[0].id);
  await say(`${playerName()} received the VIBE-DEX!`, { sfx: 'item' });
  giveItem('crushball', 5, true);
  await say(`${playerName()} received 5 Crush Balls!`, { sfx: 'item' });
  await say([
    "Prof. Rizzwell: Battles use the Composure system. Attacks cost Stamina, and chained attacks cost more and more.",
    "Prof. Rizzwell: Energy techniques — Stances, Revitalize, Compose, Flaunt — reset your combo. Get someone Flustered enough and they'll swoon and lose a turn.",
  ]);
  const rival = npcById('rival');
  rival.dir = 'right';
  await say(RIVAL_LINES[r].intro);
  await say(`${rName} wants to battle!`);
  const res = await trainerBattle('rival_lab', rival);
  if (res === 'lose') await say(["Prof. Rizzwell: Oof. Don't worry, losing builds character. And you already have plenty.", "Prof. Rizzwell: Let me patch you up."]);
  healParty();
  await say(["Prof. Rizzwell: Splendid data! Now go: Route 69 is north of town. Catch Vibemon, fill that Dex, and earn your first Gym Badge in Brunchville!", "Prof. Rizzwell: Oh — and wild Vibemon join your team when caught. You can carry 6 in your party, yourself included."]);
}

async function spaNurse() {
  await say("Nurse Joyce: Welcome to the Self-Care Spa! We restore Stamina, Energy and dignity. Shall I pamper your team?");
  const c = await choose(['Pamper me', 'No thanks']);
  if (c !== 0) { await say("Nurse Joyce: Come back whenever you need a face mask and a good cry."); return; }
  await say("Nurse Joyce: Cucumber slices... aromatherapy... a little light gossip...");
  healParty();
  G.state.lastHeal = { map: 'spa', x: 4, y: 3, dir: 'up' };
  await say("Nurse Joyce: All done! Your team is glowing. ✨ We hope to see you again!", { sfx: 'heal' });
}

async function wardenTalk() {
  if (flag('badge1')) {
    await say("Warden Karen-Lynn: You again? I've already written a strongly-worded letter about you. It's twelve pages. Double-sided.");
    return;
  }
  if (!flag('gateOpen')) { await say("..."); return; }
  const warden = npcById('warden');
  await say(TRAINERS.warden.intro);
  const res = await trainerBattle('warden', warden);
  if (res !== 'win') return;
  setFlag('badge1');
  G.state.badges = Math.max(G.state.badges || 0, 1);
  await say([
    "Warden Karen-Lynn: ...As per prison policy, I am REQUIRED to award you this. Under protest.",
  ]);
  await say(`${playerName()} received the MANAGER BADGE!`, { sfx: 'badge' });
  await badgeCelebration();
  giveItem('comeback', 1, true);
  await say(["Warden Karen-Lynn: And take this Comeback Arc. Everyone deserves a second chance. Except the cashier at aisle 4.", "Warden Karen-Lynn: The Manager Badge proves you can stand up to entitlement. Wear it with... ugh... pride."]);
  await say(["★ FIRST BATCH COMPLETE! ★", "You beat the first Gym of Vibe Monster. Batch 2 — new routes, new Vibemon, and Gym #2 — is coming soon.", "Your game was not saved automatically. Open the menu (Enter) and choose SAVE to keep your progress!"]);
}
