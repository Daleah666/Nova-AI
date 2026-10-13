import type { Scene } from '../engine/scene'

/*
 * Story scenes. Each node shows a line of dialogue; add `choices`, a `battle`, or `effects`
 * to branch. Use {lead} for the party leader's name. Write your own and add them to SCENES,
 * then point a map landmark at the scene id in map.ts.
 */

const tavern: Scene = {
  id: 'tavern',
  title: 'The Sleepy Wyvern',
  bg: 'tavern',
  start: 'intro',
  startIf: [
    { all: ['ledger-returned'], node: 'after' },
    { all: ['has-ledger', 'reward-150'], node: 'turnin-150' },
    { all: ['has-ledger'], node: 'turnin' },
    { all: ['met-mira'], node: 'return' },
  ],
  nodes: {
    intro: {
      text: 'Rain drums on the roof of the Sleepy Wyvern. In the dimmest corner, as tradition demands, sits a mysterious hooded figure.',
      show: 'mira',
      next: 'bram1',
    },
    bram1: {
      speaker: 'bram',
      text: "Don't mind that one. Been nursing the same tea for three hours. Says she's waiting for 'adventurers with initiative.'",
      next: 'approach',
    },
    approach: {
      speaker: 'lead',
      text: 'What now?',
      choices: [
        { text: 'Approach the hooded figure.', next: 'mira1' },
        {
          text: 'Size her up first.',
          check: { ability: 'WIS', dc: 10, label: 'Insight', success: 'insight-ok', failure: 'insight-fail' },
        },
        {
          text: 'Order a drink. (2 gold)',
          requires: { gold: 2, notFlags: ['had-drink'] },
          effects: [{ type: 'gold', amount: -2 }, { type: 'flag', id: 'had-drink' }],
          next: 'drink',
        },
      ],
    },
    drink: {
      speaker: 'bram',
      text: 'Wyvern Stout. Tastes like courage and slightly like wyvern. Go on, then. She won\'t bite.',
      next: 'approach',
    },
    'insight-ok': {
      text: "She's not sinister. She's exhausted. Ink-stained fingers, a quill behind one ear, a thousand-yard stare. This is a person who has seen spreadsheets.",
      show: 'mira',
      next: 'mira1',
    },
    'insight-fail': {
      text: 'You stare intensely. She stares back. Somebody coughs. It is deeply awkward.',
      show: 'mira',
      next: 'mira1',
    },
    mira1: {
      speaker: 'mira',
      text: "Finally. Adventurers. I'm Mira, Senior Ledger-Keeper of the Oakhollow Merchants' Guild. Sorry about the hood. The tavern insisted. Brand consistency.",
      next: 'mira2',
    },
    mira2: {
      speaker: 'mira',
      text: 'Goblins raided our counting house and stole the Great Ledger. Every invoice, every purchase order, every IOU. Without it the valley\'s whole supply chain grinds to a halt.',
      next: 'mira3',
    },
    mira3: {
      speaker: 'mira',
      text: "They've holed up in the Goblin Warren, north-east past the highlands. Bring the Ledger back and the Guild pays 100 gold.",
      choices: [
        { text: "We'll do it.", next: 'accept' },
        { text: 'Why not send the town guard?', next: 'guard', requires: { notFlags: ['asked-guard'] }, effects: [{ type: 'flag', id: 'asked-guard' }] },
        {
          text: 'Make it 150.',
          requires: { notFlags: ['haggled'] },
          effects: [{ type: 'flag', id: 'haggled' }],
          check: { ability: 'CHA', dc: 13, label: 'Persuasion', success: 'haggle-ok', failure: 'haggle-fail' },
        },
      ],
    },
    guard: {
      speaker: 'mira',
      text: "The guard's purchase requisition for new spears is IN the ledger. It's a whole thing.",
      next: 'mira3',
    },
    'haggle-ok': {
      speaker: 'mira',
      text: '...Fine. 150. You drive a hard bargain for someone who smells like a stable.',
      effects: [{ type: 'flag', id: 'reward-150' }],
      next: 'accept',
    },
    'haggle-fail': {
      speaker: 'mira',
      text: 'The budget is the budget. I have a spreadsheet that says so.',
      next: 'mira3',
    },
    accept: {
      speaker: 'mira',
      text: "Take these potions. Expensed, of course. Shop at Oakhollow Market to the north, and be careful in the Mire to the south-east. Folks there have been acting... fungal.",
      effects: [
        { type: 'flag', id: 'met-mira' },
        { type: 'item', id: 'potion', count: 2 },
        { type: 'journal', text: 'Quest accepted: recover the Great Ledger from the Goblin Warren (north-east).' },
      ],
    },
    return: {
      speaker: 'mira',
      text: 'Any news of the Ledger? The Warren lies north-east, past the highlands. Bram can give you a room if you need one.',
      choices: [
        {
          text: 'Rent a room and rest. (10 gold)',
          requires: { gold: 10 },
          effects: [{ type: 'gold', amount: -10 }, { type: 'rest' }],
          next: 'rested',
        },
        { text: 'Head back out.' },
      ],
    },
    rested: {
      speaker: 'bram',
      text: 'Slept like heroes, did you? HP and MP fully restored. Breakfast is extra.',
    },
    turnin: {
      speaker: 'mira',
      text: 'THE LEDGER! You actually found it! Is that... scorch damage? Never mind. Here: 100 gold, exactly as invoiced.',
      effects: [
        { type: 'gold', amount: 100 },
        { type: 'xp', amount: 200 },
        { type: 'flag', id: 'ledger-returned' },
        { type: 'journal', text: 'Returned the Great Ledger to Mira. The valley\'s books are balanced again.' },
      ],
      next: 'epilogue',
    },
    'turnin-150': {
      speaker: 'mira',
      text: 'THE LEDGER! You actually found it! And yes, I remember: 150 gold. I wrote it down. Obviously.',
      effects: [
        { type: 'gold', amount: 150 },
        { type: 'xp', amount: 200 },
        { type: 'flag', id: 'ledger-returned' },
        { type: 'journal', text: 'Returned the Great Ledger to Mira (and got the haggled 150 gold).' },
      ],
      next: 'epilogue',
    },
    epilogue: {
      speaker: 'mira',
      text: "You know, if adventurers can survive a dragon, they can probably survive month-end close. The Guild could use people like you. Come by any time.",
      next: 'epilogue2',
    },
    epilogue2: {
      text: 'THE END... of chapter one. The world stays open: keep exploring, keep fighting, and keep clearing real-life quests on your Quest Board.',
      show: 'mira',
    },
    after: {
      speaker: 'bram',
      text: "Our heroes return! Mira's been humming all week. First time anyone's heard her hum.",
      choices: [
        {
          text: 'Rent a room and rest. (10 gold)',
          requires: { gold: 10 },
          effects: [{ type: 'gold', amount: -10 }, { type: 'rest' }],
          next: 'rested',
        },
        { text: 'Head back out.' },
      ],
    },
  },
}

const market: Scene = {
  id: 'market',
  title: 'Oakhollow Market',
  bg: 'market',
  start: 'arrive',
  nodes: {
    arrive: {
      text: 'Oakhollow Market bustles with carts, chickens, and at least one bard who will not stop.',
      show: 'tess',
      next: 'menu',
    },
    menu: {
      speaker: 'tess',
      text: "Welcome back, {lead}! You've got {gold} gold. What'll it be?",
      choices: [
        { text: 'Potion: heals 2d4+2. (10g)', requires: { gold: 10 }, effects: [{ type: 'gold', amount: -10 }, { type: 'item', id: 'potion', count: 1 }], next: 'bought' },
        { text: 'Ether: restores 2d4 MP. (20g)', requires: { gold: 20 }, effects: [{ type: 'gold', amount: -20 }, { type: 'item', id: 'ether', count: 1 }], next: 'bought' },
        { text: 'Fire Flask: 2d6 fire. (15g)', requires: { gold: 15 }, effects: [{ type: 'gold', amount: -15 }, { type: 'item', id: 'fire-flask', count: 1 }], next: 'bought' },
        { text: 'Phoenix Feather: revive an ally. (50g)', requires: { gold: 50 }, effects: [{ type: 'gold', amount: -50 }, { type: 'item', id: 'phoenix-feather', count: 1 }], next: 'bought' },
        { text: 'Ask about your boots.', requires: { notFlags: ['boots'] }, next: 'boots' },
        { text: 'Leave the market.' },
      ],
    },
    bought: {
      speaker: 'tess',
      text: 'Pleasure doing business! I\'ve noted it in my book. I note everything.',
      next: 'menu',
    },
    boots: {
      speaker: 'tess',
      text: "Ah, {lead}! Hidden pockets in the boots, just like I promised. I keep notes, unlike SOME cobblers who forget their customers the moment the context runs out. Oh, and someone left 5 gold in one.",
      effects: [
        { type: 'flag', id: 'boots' },
        { type: 'gold', amount: 5 },
        { type: 'journal', text: 'Tess remembered the boots with hidden pockets. Found 5 gold inside.' },
      ],
      next: 'menu',
    },
  },
}

const mire: Scene = {
  id: 'mire',
  title: 'The Mire Shrine',
  bg: 'mire',
  start: 'arrive',
  startIf: [{ all: ['mire-cleared'], node: 'calm' }],
  nodes: {
    arrive: {
      text: 'Mist curls around a ring of mossy stones. A figure staggers toward you, swaying, humming about mushrooms. It is 9:14 in the morning.',
      show: 'wendel',
      next: 'choice',
    },
    choice: {
      speaker: 'lead',
      text: 'Fungal infestation... or just a very early start at the tavern?',
      choices: [
        {
          text: 'Study him closely.',
          check: { ability: 'WIS', dc: 12, label: 'Medicine', success: 'spores', failure: 'unsure' },
        },
        { text: 'Call out a friendly greeting.', next: 'greet' },
        { text: 'Strike first!', next: 'ambush' },
      ],
    },
    spores: {
      text: "Fine purple spores drift from his collar. Not drunk: infested! Behind him, the mushrooms stand up. You see them coming and ready your weapons.",
      show: 'wendel',
      battle: { enemies: ['myconid', 'myconid'], victory: 'won', ambush: true },
    },
    unsure: {
      text: 'Honestly? Could be either. Then the mushrooms behind him stand up, which settles it.',
      show: 'wendel',
      battle: { enemies: ['myconid', 'myconid', 'slime'], victory: 'won' },
    },
    greet: {
      speaker: 'wendel',
      text: "Mornin'! Don't mind me. The mushrooms are very... persuasive... today. They'd like a word. With their fists.",
      battle: { enemies: ['myconid', 'myconid', 'slime'], victory: 'won' },
    },
    ambush: {
      text: 'You charge! Wendel shrieks and dives into a bush. The mushrooms, it turns out, were the real threat all along.',
      battle: { enemies: ['myconid', 'myconid'], victory: 'won', ambush: true },
    },
    won: {
      speaker: 'wendel',
      text: 'The spores are clearing... was I hugging a mushroom? For how long? Please don\'t tell my wife. Take this, for your trouble.',
      effects: [
        { type: 'flag', id: 'mire-cleared' },
        { type: 'xp', amount: 50 },
        { type: 'item', id: 'ether', count: 1 },
        { type: 'journal', text: 'Cleared the Mire Shrine of rogue myconids. Wendel is mushroom-free.' },
      ],
    },
    calm: {
      text: 'The mire is quiet now. Wendel waves from his porch, mushroom-free and slightly embarrassed.',
      show: 'wendel',
    },
  },
}

const warren: Scene = {
  id: 'warren',
  title: 'The Goblin Warren',
  bg: 'warren',
  start: 'locked',
  startIf: [
    { all: ['has-ledger'], node: 'empty' },
    { all: ['met-mira'], node: 'arrive' },
  ],
  nodes: {
    locked: {
      text: "A crooked sign over the tunnel reads NO SOLICITORS. Whatever's going on in there, you should find out more first. Maybe someone at the Sleepy Wyvern knows.",
      show: 'guard',
    },
    arrive: {
      text: "A crooked tunnel descends into the hill. Goblin graffiti covers the walls, mostly tally marks. Someone's been counting.",
      next: 'approach',
    },
    approach: {
      speaker: 'lead',
      text: 'Two guards at the gate. One is asleep. The other is doing long division in the dirt.',
      choices: [
        {
          text: 'Sneak past.',
          check: { ability: 'DEX', dc: 13, label: 'Stealth', success: 'sneak-ok', failure: 'spotted' },
        },
        { text: 'Knock politely.', next: 'knock' },
        { text: 'Charge in!', next: 'guards' },
      ],
    },
    knock: {
      speaker: 'guard',
      text: 'Password?',
      choices: [
        { text: '"A hooded figure in the corner?"', next: 'pw-wrong' },
        { text: '"Accounts payable."', next: 'pw-right' },
        { text: 'Attack!', next: 'guards' },
      ],
    },
    'pw-right': {
      speaker: 'guard',
      text: '...Correct?? Huh. Nobody ever gets that. Go on in, the boss is doing quarterly reviews.',
      next: 'boss',
    },
    'pw-wrong': {
      speaker: 'guard',
      text: "That's not a password, that's a cliché. GET 'EM!",
      next: 'guards',
    },
    spotted: {
      text: 'A loose stone clatters. Every goblin in the tunnel turns around at once.',
      next: 'guards',
    },
    guards: {
      text: 'Goblins pour out of the tunnel, waving scimitars and clipboards!',
      show: 'guard',
      battle: { enemies: ['goblin', 'goblin', 'goblin'], victory: 'boss' },
    },
    'sneak-ok': {
      text: 'You slip past the snoring guard and the mathematician without a sound.',
      next: 'boss',
    },
    boss: {
      text: 'In the deepest chamber, goblins cower before a small red dragon curled on a pile of paperwork. The Great Ledger is its pillow.',
      show: 'wyrmling',
      next: 'grik',
    },
    grik: {
      speaker: 'grik',
      text: 'Adventurers! Thank the gods. The wyrmling ate our accountant! We only stole the Ledger to bribe it! It wanted gold. We had... invoices.',
      choices: [
        {
          text: 'Parley with the dragon.',
          check: { ability: 'CHA', dc: 15, label: 'Persuasion', success: 'parley-ok', failure: 'parley-fail' },
        },
        { text: 'Draw steel. Fight the dragon!', next: 'bossfight' },
      ],
    },
    'parley-ok': {
      text: 'You explain to the wyrmling, at length, that the Ledger contains no gold, only liabilities. It looks horrified, sneezes a small fireball, and flees out a chimney hole.',
      show: 'wyrmling',
      next: 'victory',
    },
    'parley-fail': {
      speaker: 'wyrmling',
      text: 'MINE. ALL MINE. EVEN THE ACCRUALS.',
      next: 'bossfight',
    },
    bossfight: {
      text: 'The wyrmling rears up, smoke curling from its nostrils. A goblin, confused about whose side it is on, joins in!',
      show: 'wyrmling',
      battle: { enemies: ['wyrmling', 'goblin'], victory: 'victory', canFlee: false },
    },
    victory: {
      speaker: 'grik',
      text: 'You did it! Take the Ledger, and this, from the goblin petty-cash box. We were going to give it back. Eventually. Probably.',
      effects: [
        { type: 'flag', id: 'has-ledger' },
        { type: 'xp', amount: 150 },
        { type: 'gold', amount: 30 },
        { type: 'journal', text: 'Recovered the Great Ledger from the Goblin Warren. Return it to Mira at the Sleepy Wyvern.' },
      ],
      next: 'outro',
    },
    outro: {
      text: 'The Great Ledger is heavy, slightly singed, and full of very small handwriting. Time to return it to Mira at the Sleepy Wyvern.',
    },
    empty: {
      text: "The warren is quiet. Boss Grik is trying to do the goblins' taxes himself. It is going badly.",
      show: 'grik',
    },
  },
}

export const SCENES: Record<string, Scene> = { tavern, market, mire, warren }
