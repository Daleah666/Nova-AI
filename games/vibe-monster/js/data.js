// Vibe Monster — game data: types, moves, Vibemon, heroines, items, trainers.
// All content is original parody. Every character is an adult (21+).
'use strict';

const TYPES = {
  Basic:    { color: '#c9b8a6' },
  Spicy:    { color: '#ff5a36' },
  Drip:     { color: '#3fa7ff' },
  Bloom:    { color: '#4cc96b' },
  Spark:    { color: '#ffd23f' },
  Swole:    { color: '#c46a3a' },
  Sass:     { color: '#ff5fc8' },
  Goth:     { color: '#8a6bc0' },
  Glam:     { color: '#ff9bd9' },
  Entitled: { color: '#d9b26f' },
};

// CHART[attacker][defender] = multiplier (missing = 1)
const CHART = {
  Basic:    { Goth: 0.5, Entitled: 0.5 },
  Spicy:    { Bloom: 2, Glam: 2, Spicy: 0.5, Drip: 0.5 },
  Drip:     { Spicy: 2, Swole: 2, Drip: 0.5, Bloom: 0.5 },
  Bloom:    { Drip: 2, Spark: 2, Spicy: 0.5, Bloom: 0.5 },
  Spark:    { Drip: 2, Glam: 2, Bloom: 0.5, Spark: 0.5 },
  Swole:    { Basic: 2, Entitled: 2, Sass: 0.5, Glam: 0.5 },
  Sass:     { Swole: 2, Entitled: 2, Sass: 0.5, Goth: 0.5 },
  Goth:     { Sass: 2, Glam: 2, Goth: 0.5, Basic: 0.5 },
  Glam:     { Goth: 2, Swole: 2, Spicy: 0.5, Entitled: 0.5 },
  Entitled: { Basic: 2, Glam: 2, Sass: 0.5, Swole: 0.5, Entitled: 0.5 },
};

function typeMult(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    const v = CHART[atkType] && CHART[atkType][d];
    if (v !== undefined) m *= v;
  }
  return m;
}

// ---- Combat tuning ("Composure Combat", a stamina/energy/stance system) ----
const COMBAT = {
  staminaCost: { light: 0.03, normal: 0.045, heavy: 0.07 }, // fraction of max HP per attack
  chainGrowth: 1.5,          // each consecutive attack multiplies stamina cost
  chainCap: 5,
  statusMoveEnergy: 5,       // learned status moves cost Energy and reset the chain
  heavyCooldown: 2,
  stanceTurns: 3,
  swoonAt: 100,
  charmFluster: (pow) => 8 + Math.floor(pow / 6),
  statusFluster: 40,
  trainingPerPoint: 6,       // usage needed for +1 training bonus
  trainingCap: 15,
};

// Energy skills every Vibemon knows (they don't take move slots).
const TECHNIQUES = {
  defensive: { name: 'Defensive Stance', en: 8, stance: 'defensive', desc: 'Take 40% less damage, block stat drops and stagger, halve Fluster gain. Clears debuffs. 3 turns.' },
  cautious:  { name: 'Cautious Stance',  en: 8, stance: 'cautious',  desc: 'Much harder to hit; dodged hits may still graze. 3 turns.' },
  counter:   { name: 'Counter Stance',   en: 12, stance: 'counter',  desc: 'High chance to counterattack when struck. 3 turns.' },
  revitalize:{ name: 'Revitalize',       en: 15, desc: 'Catch your breath: restore 30% Stamina.' },
  compose:   { name: 'Compose',          en: 6,  desc: 'Fix your hair, breathe. Lowers your Fluster by 50.' },
  flaunt:    { name: 'Flaunt',           en: 4,  desc: 'Strike a pose. Raises the foe\'s Fluster by 25.' },
};

// cat: 'phys' (ATK vs DEF), 'charm' (CHA vs CHA; also builds Fluster), 'status' (costs Energy)
// tier: light (cheap, has a side effect), normal, heavy (strong, cooldown)
// fx: light-tier side effects — foe stat drops or stagger
const MOVES = {
  smack:      { name: 'Smack That',          type: 'Basic', cat: 'phys',  tier: 'normal', pow: 40, acc: 100, desc: 'A cheeky slap. Classic.' },
  wink:       { name: 'Wink',                type: 'Basic', cat: 'status', acc: 100, foe: { def: -1 }, desc: "A devastating wink. Lowers the foe's DEF." },
  hairflip:   { name: 'Hair Flip',           type: 'Basic', cat: 'status', acc: 100, self: { atk: 1 }, desc: 'Flips hair in slow motion. Raises ATK.' },
  literally:  { name: 'Literally Slap',      type: 'Basic', cat: 'phys',  tier: 'normal', pow: 60, acc: 95, desc: 'Literally. A slap. Literally.' },
  pslatte:    { name: 'Pumpkin Spice Blast', type: 'Basic', cat: 'charm', tier: 'heavy', pow: 75, acc: 95, desc: 'Hurls a scalding seasonal beverage.' },
  bedroom:    { name: 'Bedroom Eyes',        type: 'Basic', cat: 'status', acc: 85, fluster: 45, desc: 'A smoldering stare. Big Fluster.' },
  likeew:     { name: 'Like, Ew',            type: 'Basic', cat: 'charm', tier: 'light', pow: 30, acc: 100, fx: { stagger: true }, desc: 'Withering disgust. Staggers the foe.' },
  pommel:     { name: 'Pommel Bonk',         type: 'Basic', cat: 'phys',  tier: 'light', pow: 35, acc: 100, fx: { stagger: true }, desc: 'A polite bonk to the head. Staggers.' },
  hottake:    { name: 'Hot Take',            type: 'Spicy', cat: 'charm', tier: 'normal', pow: 45, acc: 100, desc: 'Posts an unhinged opinion. It burns.' },
  tanflick:   { name: 'Spray-Tan Flick',     type: 'Spicy', cat: 'phys',  tier: 'light', pow: 30, acc: 100, fx: { foe: { spd: -1 } }, desc: 'Bronzer in the eyes. Lowers SPD.' },
  smooch:     { name: 'Sunkissed Smooch',    type: 'Spicy', cat: 'charm', tier: 'normal', pow: 60, acc: 100, desc: 'Leaves a lipstick-shaped scorch mark.' },
  solardiva:  { name: 'Solar Diva Blast',    type: 'Spicy', cat: 'charm', tier: 'heavy', pow: 90, acc: 90, desc: 'Main-character energy, focused into a beam.' },
  firethirst: { name: 'Fire Thirst',         type: 'Spicy', cat: 'phys',  tier: 'heavy', pow: 80, acc: 90, desc: 'Pure, weaponized thirst. Very hot.' },
  splash:     { name: 'Splash Zone',         type: 'Drip',  cat: 'charm', tier: 'normal', pow: 40, acc: 100, desc: 'Front row gets soaked.' },
  lanyard:    { name: 'Lanyard Lash',        type: 'Drip',  cat: 'phys',  tier: 'light', pow: 30, acc: 100, fx: { foe: { atk: -1 } }, desc: 'Whips the arm with an ID lanyard. Lowers ATK.' },
  dripcheck:  { name: 'Drip Check',          type: 'Drip',  cat: 'phys',  tier: 'normal', pow: 55, acc: 100, desc: 'Rates your outfit. Brutally.' },
  replyall:   { name: 'Reply-All',           type: 'Drip',  cat: 'charm', tier: 'normal', pow: 60, acc: 100, desc: 'A passive-aggressive memo, CCing everyone.' },
  hrcleave:   { name: 'HR Cleave',           type: 'Drip',  cat: 'phys',  tier: 'heavy', pow: 90, acc: 90, desc: 'A sweeping, policy-compliant halberd swing.' },
  vine:       { name: 'Vine Tease',          type: 'Bloom', cat: 'phys',  tier: 'normal', pow: 40, acc: 100, desc: 'Playful vine whips. Ouch?' },
  petal:      { name: 'Petal Flirt',         type: 'Bloom', cat: 'charm', tier: 'normal', pow: 55, acc: 100, desc: 'Showers the foe in petals and compliments.' },
  pheromone:  { name: 'Pheromone Pollen',    type: 'Bloom', cat: 'status', acc: 100, foe: { atk: -1 }, fluster: 20, desc: 'Intoxicating pollen. Lowers ATK, adds Fluster.' },
  thornjab:   { name: 'Thorn Jab',           type: 'Bloom', cat: 'phys',  tier: 'light', pow: 30, acc: 100, fx: { foe: { spd: -1 } }, desc: 'A jab to the shin. Lowers SPD.' },
  thorny:     { name: 'Thorny Kiss',         type: 'Bloom', cat: 'phys',  tier: 'normal', pow: 65, acc: 95, desc: 'Every rose has its thorn. So does this kiss.' },
  greatsword: { name: 'Garden Greatsword',   type: 'Bloom', cat: 'phys',  tier: 'heavy', pow: 95, acc: 90, desc: 'A demon-forged blade, now used mostly for hedges.' },
  static:     { name: 'Static Cling',        type: 'Spark', cat: 'phys',  tier: 'light', pow: 30, acc: 100, fx: { foe: { spd: -1 } }, desc: 'Clings uncomfortably close. Lowers SPD.' },
  shockvalue: { name: 'Shock Value',         type: 'Spark', cat: 'charm', tier: 'normal', pow: 55, acc: 100, desc: 'Says something wildly inappropriate.' },
  chem:       { name: 'Electric Chemistry',  type: 'Spark', cat: 'charm', tier: 'heavy', pow: 80, acc: 95, desc: 'Sparks fly. Actually fly.' },
  glowstick:  { name: 'Glowstick Twirl',     type: 'Spark', cat: 'status', acc: 100, self: { spd: 2 }, desc: 'Rave mode. Sharply raises SPD.' },
  flex:       { name: 'Flex',                type: 'Swole', cat: 'status', acc: 100, self: { atk: 1, def: 1 }, desc: 'Hits a pose. Raises ATK and DEF.' },
  bicep:      { name: 'Bicep Kiss',          type: 'Swole', cat: 'phys',  tier: 'normal', pow: 45, acc: 100, desc: 'Kisses own bicep, then hits you with it.' },
  shakedown:  { name: 'Protein Shake-Down',  type: 'Swole', cat: 'phys',  tier: 'normal', pow: 60, acc: 100, desc: 'Shakes you down for gains.' },
  evenlift:   { name: 'Do You Even Lift',    type: 'Swole', cat: 'phys',  tier: 'heavy', pow: 85, acc: 90, desc: 'Rhetorical question. Physical answer.' },
  sideeye:    { name: 'Side Eye',            type: 'Sass',  cat: 'charm', tier: 'normal', pow: 50, acc: 100, desc: 'A look that says everything.' },
  shade:      { name: 'Throw Shade',         type: 'Sass',  cat: 'charm', tier: 'normal', pow: 65, acc: 100, desc: "Shade so dark it's an eclipse." },
  readfilth:  { name: 'Read to Filth',       type: 'Sass',  cat: 'charm', tier: 'heavy', pow: 85, acc: 90, desc: 'The library is OPEN.' },
  snap:       { name: 'Z-Snap',              type: 'Sass',  cat: 'phys',  tier: 'light', pow: 35, acc: 100, fx: { stagger: true }, desc: 'Snaps in a Z formation. Staggers.' },
  smoky:      { name: 'Smoky Eye',           type: 'Goth',  cat: 'charm', tier: 'normal', pow: 45, acc: 100, desc: 'Perfectly blended. Lethally.' },
  eyeliner:   { name: 'Eyeliner Slash',      type: 'Goth',  cat: 'phys',  tier: 'light', pow: 35, acc: 100, fx: { foe: { atk: -1 } }, desc: 'Wings sharp enough to cut. Lowers ATK.' },
  brood:      { name: 'Midnight Brood',      type: 'Goth',  cat: 'charm', tier: 'heavy', pow: 75, acc: 95, desc: 'Broods so hard the lights dim.' },
  lamplust:   { name: 'Lamp Lust',           type: 'Goth',  cat: 'status', acc: 100, self: { cha: 2 }, desc: 'Stares at a lamp. Sharply raises CHA.' },
  glitter:    { name: 'Glitter Bomb',        type: 'Glam',  cat: 'charm', tier: 'normal', pow: 55, acc: 100, desc: "You'll be finding glitter for years." },
  strut:      { name: 'Runway Strut',        type: 'Glam',  cat: 'phys',  tier: 'normal', pow: 50, acc: 100, desc: 'Walks all over the foe. Fiercely.' },
  blowkiss:   { name: 'Blow a Kiss',         type: 'Glam',  cat: 'status', acc: 90, fluster: 40, desc: 'Mwah! Big Fluster.' },
  slay:       { name: 'Slay',                type: 'Glam',  cat: 'charm', tier: 'heavy', pow: 85, acc: 90, desc: 'Ate. Left no crumbs.' },
  coupon:     { name: 'Expired Coupon',      type: 'Entitled', cat: 'phys',  tier: 'normal', pow: 45, acc: 100, desc: 'Demands it be honored anyway.' },
  manager:    { name: 'Speak to Manager',    type: 'Entitled', cat: 'charm', tier: 'normal', pow: 60, acc: 100, desc: 'Summons managerial pressure.' },
  onestar:    { name: 'One-Star Review',     type: 'Entitled', cat: 'charm', tier: 'heavy', pow: 75, acc: 95, desc: 'Writes a 2,000-word Yelp review.' },
  bobcut:     { name: 'Bob Cut Barrage',     type: 'Entitled', cat: 'phys',  tier: 'light', pow: 35, acc: 95, fx: { stagger: true }, desc: 'Headbutt with an asymmetric bob. Staggers.' },
  entitle:    { name: 'Entitlement',         type: 'Entitled', cat: 'status', acc: 100, self: { atk: 1, cha: 1 }, desc: 'Feels owed. Raises ATK and CHA.' },
  karenscream:{ name: 'Karen Scream',        type: 'Entitled', cat: 'charm', tier: 'heavy', pow: 90, acc: 85, desc: 'A shriek heard three zip codes away.' },
};

// base: [hp, atk, def, cha, spd]. look: procedural art parameters (art.js)
// heroine: true = playable protagonist; she fights as your lead and can't be boxed.
const DEX = [
  // ---- Heroines (pick one in the intro; she is you AND your starter) ----
  { id: 'margaux', name: 'Margaux', full: 'Margaux Steelwell', heroine: true, types: ['Drip'], base: [52, 58, 60, 50, 45], exp: 64, catch: 0,
    evo: { to: 'margaux2', lvl: 14 }, age: 29, height: "5'10\"", title: 'Ex-HR Enforcer',
    bio: "Former HR Director of a megacorp that imploded during a single Reply-All. Now a freelance enforcer with a telescoping lanyard-halberd, a pencil skirt with *opinions*, and a soft spot for rule-breakers she's legally required to write up. Cold, composed, devastatingly well-dressed.",
    entry: "Composure is her superpower; her drip is regulation-issue. Keeps a laminated copy of the Code of Conduct in her blazer, right over her heart. Fluent in passive-aggressive email.",
    learn: [[1, 'lanyard'], [1, 'splash'], [4, 'wink'], [7, 'dripcheck'], [10, 'replyall'], [14, 'hrcleave']],
    look: { sex: 'f', busty: true, skin: '#f0cdb4', hair: '#1c2f5e', hairStyle: 'braid', top: '#2a3550', bottom: '#2a3550', outfit: 'suit', accent: '#3fa7ff', glasses: true, prop: 'halberd', aura: 'drops' } },
  { id: 'margaux2', name: 'Margaux, Warden Supreme', full: 'Margaux Steelwell', heroine: true, types: ['Drip'], base: [78, 88, 92, 72, 62], exp: 175, catch: 0,
    age: 29, height: "5'10\" (6'2\" in boots)", title: 'Iron Composure',
    entry: "After a training montage set to synthwave, Margaux unlocked her final form: tailored greatcoat, executive-grade halberd, and a glare that files your complaint in triplicate.",
    learn: [[1, 'lanyard'], [1, 'splash'], [4, 'wink'], [7, 'dripcheck'], [10, 'replyall'], [14, 'hrcleave'], [18, 'flex']],
    look: { sex: 'f', busty: true, skin: '#f0cdb4', hair: '#1c2f5e', hairStyle: 'braid', top: '#121a30', bottom: '#121a30', outfit: 'coat', accent: '#7fd0ff', glasses: true, prop: 'halberd', crown: '#7fd0ff', aura: 'drops' } },
  { id: 'tansy', name: 'Princess Tansy', full: 'Princess Tansy Bronzé', heroine: true, types: ['Spicy'], base: [46, 50, 42, 64, 66], exp: 62, catch: 0,
    evo: { to: 'tansy2', lvl: 14 }, age: 24, height: "5'6\" (5'11\" in platforms)", title: 'Repossessed Royalty',
    bio: "Crown princess of the Kingdom of Malibu Mall — until a hostile takeover by the Brunch Empire repossessed her castle, her credit cards, and her three emotional-support handbags. Spoiled, sun-kissed, and like, totally going to fix everything. Somehow.",
    entry: "Has never paid for her own drink. Her bedazzled scepter doubles as a selfie stick. Believes 'budget' is a type of airline she'll never fly.",
    learn: [[1, 'tanflick'], [1, 'hottake'], [4, 'hairflip'], [7, 'likeew'], [10, 'smooch'], [14, 'solardiva']],
    look: { sex: 'f', busty: true, skin: '#a8673e', hair: '#ff4fa3', hairStyle: 'buns', top: '#ffd23f', bottom: '#ff4fa3', outfit: 'crop', accent: '#ffffff', shades: true, crown: '#ffd23f', prop: 'scepter', aura: 'flame' } },
  { id: 'tansy2', name: 'Empress Tansy', full: 'Princess Tansy Bronzé', heroine: true, types: ['Spicy'], base: [70, 76, 64, 100, 96], exp: 175, catch: 0,
    age: 24, height: "5'6\" (6'1\" in platforms)", title: 'Solar Diva',
    entry: "Self-crowned Empress of the Sun after realizing she IS the main character. Her gown has its own weather system. Still hasn't paid for a drink.",
    learn: [[1, 'tanflick'], [1, 'hottake'], [4, 'hairflip'], [7, 'likeew'], [10, 'smooch'], [14, 'solardiva'], [18, 'bedroom']],
    look: { sex: 'f', busty: true, skin: '#a8673e', hair: '#ff4fa3', hairStyle: 'wild', top: '#ff7a1a', bottom: '#ffd23f', outfit: 'gown', accent: '#fff3a0', shades: true, crown: '#ffd23f', bigCrown: true, prop: 'scepter', wings: 'fairy', wingColor: '#ffcf6a', aura: 'flame' } },
  { id: 'hilde', name: 'General Hilde', full: 'General Brunhilde Thornvale', heroine: true, types: ['Bloom'], base: [54, 62, 56, 46, 44], exp: 64, catch: 0,
    evo: { to: 'hilde2', lvl: 14 }, age: 31, height: "6'1\"", title: 'Retired Demon General',
    bio: "The undefeated top general of the Infernal Imperial Army — who quit mid-war because she wanted to grow tomatoes and figure out who she is outside the armor. Stoic, horned, painfully earnest, and secretly a hopeless romantic. Her greatsword is now a garden tool.",
    entry: "Can cleave a siege tower in half but cries at rom-coms. Speaks in formal battle commands even when ordering coffee. Her horns are 100% natural, thank you.",
    learn: [[1, 'pommel'], [1, 'vine'], [4, 'pheromone'], [7, 'thornjab'], [10, 'thorny'], [14, 'greatsword']],
    look: { sex: 'f', busty: true, skin: '#c98f8f', hair: '#e8e8f0', hairStyle: 'long', top: '#3a4a3a', bottom: '#2a2a2a', outfit: 'armor', accent: '#4cc96b', horns: '#2a1a1a', bigHorns: true, prop: 'sword', aura: 'leaves' } },
  { id: 'hilde2', name: 'Hilde, Thorn Warlord', full: 'General Brunhilde Thornvale', heroine: true, types: ['Bloom'], base: [82, 96, 84, 66, 60], exp: 175, catch: 0,
    age: 31, height: "6'1\"", title: 'Blooming Warlord',
    entry: "Made peace with her past by forging her old armor into a greenhouse. Now wears rose-vine plate and a cape that smells like fresh basil. Still terrifying. Still cries at rom-coms.",
    learn: [[1, 'pommel'], [1, 'vine'], [4, 'pheromone'], [7, 'thornjab'], [10, 'thorny'], [14, 'greatsword'], [18, 'flex']],
    look: { sex: 'f', busty: true, skin: '#c98f8f', hair: '#e8e8f0', hairStyle: 'wild', top: '#1f5a2e', bottom: '#1f5a2e', outfit: 'armor', accent: '#ff7fb0', horns: '#2a1a1a', bigHorns: true, flower: '#ff7fb0', prop: 'sword', wings: 'bat', wingColor: '#2f4a2f', aura: 'leaves' } },

  // ---- Wild Vibemon ----
  { id: 'emberella', name: 'Emberella', types: ['Spicy'], base: [48, 56, 45, 66, 68], exp: 72, catch: 90,
    age: 22, height: "5'7\"", title: 'Hot Take Vibemon',
    entry: "Born in a candle shop fire she swears she didn't start. Insists she's \"not like other girls\" while literally being on fire. Will steal your hoodie and never give it back.",
    learn: [[1, 'hottake'], [1, 'tanflick'], [6, 'wink'], [9, 'hairflip'], [12, 'smooch'], [17, 'firethirst']],
    look: { sex: 'f', skin: '#f2c2a0', hair: '#ff6a2a', hairStyle: 'long', top: '#e0321e', bottom: '#2b1a1a', outfit: 'crop', horns: '#3a1a1a', tail: 'devil', tailColor: '#e0321e', aura: 'flame' } },
  { id: 'splashton', name: 'Splashton', types: ['Drip'], base: [55, 62, 64, 50, 46], exp: 72, catch: 90,
    age: 23, height: "6'1\"", title: 'Lifeguard Vibemon',
    entry: "A merman lifeguard who has never actually saved anyone; he just poses near the water in slow motion. His abs are load-bearing. Whistle is purely decorative.",
    learn: [[1, 'splash'], [1, 'flex'], [6, 'lanyard'], [9, 'dripcheck'], [14, 'replyall']],
    look: { sex: 'm', skin: '#d9a07a', hair: '#1f6fd1', hairStyle: 'short', top: null, bottom: '#e8352e', outfit: 'trunks', fins: '#3fa7ff', aura: 'drops', prop: 'whistle' } },
  { id: 'fernanda', name: 'Fernanda', types: ['Bloom'], base: [52, 48, 54, 64, 47], exp: 72, catch: 90,
    age: 26, height: "5'6\"", title: 'Plant Mom Vibemon',
    entry: "A dryad and proud plant mom of 47 succulents. Sunbathes on rooftops \"for the photosynthesis.\" Will name a fern after you on the first date.",
    learn: [[1, 'vine'], [1, 'pheromone'], [6, 'thornjab'], [9, 'petal'], [15, 'thorny']],
    look: { sex: 'f', skin: '#c9e6a8', hair: '#2f8a3a', hairStyle: 'long', top: '#6fd36b', bottom: '#2f8a3a', outfit: 'leaf', flower: '#ff7fb0', aura: 'leaves' } },
  { id: 'basicbecca', name: 'Basicbecca', types: ['Basic'], base: [40, 45, 35, 35, 56], exp: 50, catch: 255,
    evo: { to: 'basiqueen', lvl: 12 }, age: 22, height: "5'5\"", title: 'Latte Vibemon',
    entry: "Carries a pumpkin spice latte in every season, including July. Says \"literally\" 400 times a day. Her 12 followers are all alt accounts.",
    learn: [[1, 'smack'], [1, 'hairflip'], [5, 'wink'], [8, 'likeew'], [10, 'literally'], [13, 'pslatte'], [16, 'bedroom']],
    look: { sex: 'f', skin: '#f5d0b5', hair: '#f3d36b', hairStyle: 'ponytail', top: '#ffffff', bottom: '#9a7a5a', outfit: 'crop', prop: 'latte' } },
  { id: 'basiqueen', name: 'Basiqueen', types: ['Basic'], base: [65, 72, 60, 62, 90], exp: 130, catch: 45,
    age: 26, height: "5'8\"", title: 'Ultimate Basic Vibemon',
    entry: "Has ascended to Final Basic. \"Live Laugh Love\" is embroidered on her yoga pants. Has a podcast. You haven't heard of it. Nobody has.",
    learn: [[1, 'smack'], [1, 'hairflip'], [5, 'wink'], [8, 'likeew'], [10, 'literally'], [13, 'pslatte'], [16, 'bedroom'], [20, 'sideeye']],
    look: { sex: 'f', busty: true, skin: '#f0c8a8', hair: '#fff0a0', hairStyle: 'long', top: '#ffb6d0', bottom: '#2a2a2a', outfit: 'crop', prop: 'latte', crown: '#ffd23f', aura: 'glitter' } },
  { id: 'chaddeus', name: 'Chaddeus', types: ['Swole'], base: [55, 75, 45, 30, 45], exp: 60, catch: 190,
    evo: { to: 'gigachadwick', lvl: 16 }, age: 25, height: "6'0\"", title: 'Gym Bro Vibemon',
    entry: "Skipped leg day once and has never forgiven himself. Communicates mostly in grunts and macros. Calls everyone \"king.\"",
    learn: [[1, 'bicep'], [1, 'flex'], [7, 'pommel'], [11, 'shakedown'], [17, 'evenlift']],
    look: { sex: 'm', skin: '#e0a882', hair: '#5a3a1a', hairStyle: 'short', top: '#ff8a1a', bottom: '#333333', outfit: 'tank', prop: 'dumbbell' } },
  { id: 'gigachadwick', name: 'Gigachadwick', types: ['Swole'], base: [85, 115, 75, 45, 60], exp: 150, catch: 45,
    age: 31, height: "6'6\"", title: 'Jawline Vibemon',
    entry: "His jawline is legally classified as a weapon in four regions. Will spot you at the gym whether you asked or not. Has never once used a door handle.",
    learn: [[1, 'bicep'], [1, 'flex'], [7, 'pommel'], [11, 'shakedown'], [17, 'evenlift']],
    look: { sex: 'm', skin: '#c98b62', hair: '#ffd23f', hairStyle: 'swept', top: null, bottom: '#1a1a1a', outfit: 'trunks', belt: '#ffd23f', prop: 'dumbbell', aura: 'glitter' } },
  { id: 'voltina', name: 'Voltina', types: ['Spark'], base: [45, 50, 40, 65, 85], exp: 70, catch: 150,
    age: 23, height: "5'6\"", title: 'Rave Vibemon',
    entry: "A rave goddess powered by energy drinks and questionable decisions. Static cling makes her outfits \"adventurous.\" Has not slept since 2019.",
    learn: [[1, 'static'], [1, 'glowstick'], [7, 'shockvalue'], [12, 'wink'], [16, 'chem']],
    look: { sex: 'f', skin: '#f2c8b0', hair: '#ffe23f', hairStyle: 'pigtails', top: '#2affd5', bottom: '#ff2ad5', outfit: 'crop', antennae: '#ffd23f', aura: 'spark' } },
  { id: 'mothrina', name: 'Mothrina', types: ['Goth'], base: [50, 40, 50, 70, 60], exp: 70, catch: 150,
    age: 26, height: "5'9\"", title: 'Goth Moth Vibemon',
    entry: "A goth moth drawn to lamps, red flags, and men who play bass. Writes poetry exclusively about \"the light.\" (The light is a porch lamp.)",
    learn: [[1, 'smoky'], [1, 'wink'], [7, 'lamplust'], [10, 'eyeliner'], [15, 'brood']],
    look: { sex: 'f', skin: '#e8e0f0', hair: '#1a1222', hairStyle: 'bob', top: '#1a1222', bottom: '#1a1222', outfit: 'gown', wings: 'moth', wingColor: '#9a86b8', antennae: '#2a1a3a' } },
  { id: 'sassquatch', name: 'Sassquatch', types: ['Sass'], base: [70, 60, 55, 75, 50], exp: 90, catch: 90,
    age: 34, height: "7'2\"", title: 'Fabulous Cryptid Vibemon',
    entry: "Rarely sighted. When he is, he's being fabulous. Every photo of him is blurry because he refuses to stop strutting. Moisturizes his fur daily.",
    learn: [[1, 'sideeye'], [1, 'hairflip'], [8, 'snap'], [11, 'shade'], [18, 'readfilth']],
    look: { sex: 'm', skin: '#8a5a3a', hair: '#6a3f22', hairStyle: 'mane', top: '#ff5fc8', bottom: '#6a3f22', outfit: 'boa', furry: true, aura: 'glitter' } },
  { id: 'glamazonia', name: 'Glamazonia', types: ['Glam'], base: [60, 65, 55, 85, 75], exp: 110, catch: 60,
    age: 28, height: "7'0\" (in heels)", title: 'Runway Fairy Vibemon',
    entry: "A seven-foot warrior fairy in stilettos. Her runway walk has toppled empires and at least one Wi-Fi network. Rarely seen in the Velvet Woods.",
    learn: [[1, 'strut'], [1, 'blowkiss'], [8, 'glitter'], [13, 'hairflip'], [20, 'slay']],
    look: { sex: 'f', busty: true, skin: '#c88a6a', hair: '#ff9bd9', hairStyle: 'wild', top: '#ffd1f0', bottom: '#ffd1f0', outfit: 'gown', wings: 'fairy', wingColor: '#bff4ff', crown: '#ffd23f', aura: 'glitter' } },
  { id: 'kareniac', name: 'Kareniac', types: ['Entitled'], base: [55, 55, 60, 55, 40], exp: 70, catch: 120,
    evo: { to: 'karenzilla', lvl: 18 }, age: 41, height: "5'6\"", title: 'Manager-Seeking Vibemon',
    entry: "Native to retail checkouts. Her asymmetric bob is an antenna that can detect a manager within three miles. Feeds on comped appetizers.",
    learn: [[1, 'coupon'], [1, 'entitle'], [7, 'manager'], [10, 'bobcut'], [15, 'onestar']],
    look: { sex: 'f', skin: '#f2c8a8', hair: '#e8c070', hairStyle: 'karen', top: '#7aa0c8', bottom: '#e8e0d0', outfit: 'cardigan', prop: 'phone' } },
  { id: 'karenzilla', name: 'Karenzilla', types: ['Entitled'], base: [85, 90, 90, 90, 55], exp: 170, catch: 45,
    age: 47, height: "6'0\" (with bob)", title: 'Apex Complaint Vibemon',
    entry: "Has spoken to every manager on Earth and now demands to speak to God's supervisor. Banned from four Olive Gardens and one entire timeline.",
    learn: [[1, 'coupon'], [1, 'entitle'], [7, 'manager'], [10, 'bobcut'], [15, 'onestar'], [20, 'karenscream']],
    look: { sex: 'f', busty: true, skin: '#e8b898', hair: '#f0d080', hairStyle: 'karen', bigHair: true, top: '#c84a6a', bottom: '#2a2a3a', outfit: 'cardigan', prop: 'phone', crown: '#c0c0c0', aura: 'rage' } },
];
const DEX_BY_ID = Object.fromEntries(DEX.map((d, i) => [d.id, Object.assign(d, { num: i + 1 })]));
const HEROINES = ['margaux', 'tansy', 'hilde'];

const ITEMS = {
  crushball: { name: 'Crush Ball', price: 200, kind: 'ball', rate: 1, desc: 'A heart-shaped capsule for catching Vibemon. Swipe right!' },
  thirsttrap: { name: 'Thirst Trap', price: 600, kind: 'ball', rate: 1.6, desc: 'A better ball. Irresistible. Works on most egos.' },
  latte: { name: 'Iced Latte', price: 250, kind: 'heal', heal: 25, desc: 'Restores 25 Stamina. Oat milk, obviously.' },
  mimosa: { name: 'Bottomless Mimosa', price: 700, kind: 'heal', heal: 70, desc: 'Restores 70 Stamina. Brunch is a lifestyle.' },
  espresso: { name: 'Espresso Shot', price: 400, kind: 'energy', en: 20, desc: 'Restores 20 Energy. Heart rate: yes.' },
  comeback: { name: 'Comeback Arc', price: 1500, kind: 'revive', desc: 'Revives a fainted Vibemon to half Stamina. Main character energy.' },
};

// Trainer definitions. party: [[speciesId, level], ...] or 'RIVAL'
const TRAINERS = {
  rival_lab: { name: 'RIVAL', cls: 'Rival', party: 'RIVAL', prize: 120, sprite: 'rival' },
  bro_brad: { name: 'Brad', cls: 'Gym Bro', party: [['chaddeus', 4], ['chaddeus', 5]], prize: 20, sprite: 'bro',
    intro: "Brad: Bro. BRO. You looking at my gains? Let's battle, king.", win: "Brad: Respect, king. I'm gonna go cry in the sauna." },
  influ_kayleigh: { name: 'Kayleigh', cls: 'Influencer', party: [['basicbecca', 5], ['voltina', 5]], prize: 25, sprite: 'influencer',
    intro: "Kayleigh: OMG, hold on, I need to film this battle for my story!", win: "Kayleigh: Ugh, deleting this. It's not on brand." },
  goth_raven: { name: 'Raven', cls: 'Goth Girl', party: [['mothrina', 7], ['mothrina', 8]], prize: 30, sprite: 'goth',
    intro: "Raven: You walked into my forest. Ugh. Now I have to *feel* something.", win: "Raven: That was... almost interesting. Don't tell anyone." },
  yoga_skye: { name: 'Skye', cls: 'Yoga Instructor', party: [['fernanda', 7], ['sassquatch', 8]], prize: 30, sprite: 'yoga',
    intro: "Skye: Namaste. Now I'm going to stretch you out. Emotionally.", win: "Skye: My chakras are misaligned. Thanks a lot." },
  bro_tyler: { name: 'Tyler', cls: 'Crypto Bro', party: [['voltina', 8], ['splashton', 8]], prize: 35, sprite: 'bro',
    intro: "Tyler: Have you heard about my NFT Vibemon? No? Battle me and I'll explain.", win: "Tyler: That's fine. I'm diamond-handing this loss." },
  karen_coupon: { name: 'Karen', cls: 'Coupon Clipper', party: [['kareniac', 9], ['basicbecca', 9]], prize: 40, sprite: 'karen',
    intro: "Karen: This coupon expired in 2009 and you WILL honor it. Battle!", win: "Karen: I'm leaving a one-star review of this battle." },
  karen_hoa: { name: 'Karen', cls: 'HOA President', party: [['kareniac', 10], ['chaddeus', 10]], prize: 45, sprite: 'karen',
    intro: "Karen: Your Vibemon's outfit violates HOA bylaw 4.2(c). Prepare to be fined!", win: "Karen: I'm calling an emergency HOA meeting about this." },
  karen_mlm: { name: 'Karen', cls: 'MLM Boss Babe', party: [['basicbecca', 10], ['kareniac', 11]], prize: 50, sprite: 'karen',
    intro: "Karen: Hey hun! Wanna be your own boss? First, beat ME. Then buy my leggings.", win: "Karen: OK but have you considered essential oils for that loss?" },
  warden: { name: 'Warden Karen-Lynn', cls: 'Gym Leader', party: [['basicbecca', 12], ['kareniac', 13], ['karenzilla', 15]], prize: 120, sprite: 'warden', leader: true,
    intro: "Warden Karen-Lynn: I am the Regional Manager of Karen Prison. I have spoken to EVERY manager. Now YOU will speak to ME!",
    win: "Warden Karen-Lynn: Fine. FINE. You win. I'm not mad, I'm just... disappointed in this entire establishment.",
    lose: "Warden Karen-Lynn: Next time, ask permission before losing." },
};

// Your rival is the heroine whose type beats yours.
const RIVAL_OF = { margaux: 'hilde', tansy: 'margaux', hilde: 'tansy' };
const RIVAL_LINES = {
  margaux: { intro: "Margaux: Per company policy, I'm required to evaluate you. Brace yourself.", win: "Margaux: ...Noted. I'll be filing this loss under 'Lessons Learned.'", lose: "Margaux: Performance review: needs improvement." },
  tansy: { intro: "Tansy: OMG, you're, like, SO going down. My nails are literally done for this.", win: "Tansy: Ugh! I broke a nail. You owe me a manicure. And a kingdom.", lose: "Tansy: Bye, Felicia~ ♡" },
  hilde: { intro: "Hilde: Warrior. I sense strength in you. Let us test it — then perhaps get brunch?", win: "Hilde: A worthy defeat. I shall... process my feelings in the garden.", lose: "Hilde: Victory. ...Was I too rough? I am still learning gentleness." },
};

// Wild encounter tables: [speciesId, weight, minLvl, maxLvl]
const ENCOUNTERS = {
  route69: [['basicbecca', 38, 2, 4], ['chaddeus', 28, 3, 5], ['voltina', 18, 3, 5], ['emberella', 8, 4, 5], ['kareniac', 8, 4, 5]],
  velvet: [['mothrina', 25, 5, 8], ['sassquatch', 18, 6, 8], ['fernanda', 14, 5, 8], ['splashton', 14, 5, 8], ['voltina', 10, 6, 8], ['basicbecca', 9, 5, 7], ['glamazonia', 6, 7, 8], ['chaddeus', 4, 6, 8]],
};
