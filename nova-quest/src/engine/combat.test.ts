import { describe, expect, it } from 'vitest'
import {
  applyAction,
  chooseEnemyAction,
  currentActor,
  isPartyTurn,
  labelDuplicates,
  startBattle,
  type Combatant,
  type CombatDefs,
} from './combat'
import { facesRng } from './testing'

function fighter(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'hero',
    refId: 'hero',
    name: 'Sven',
    side: 'party',
    hp: 12,
    maxHp: 12,
    mp: 4,
    maxMp: 4,
    ac: 16,
    prof: 2,
    attackBonus: 5,
    damage: '1d8+3',
    attackName: 'Longsword',
    dexMod: 0,
    mods: { STR: 3, WIS: 2 },
    skills: ['cure'],
    defending: false,
    initiative: 0,
    sprite: 'fighter',
    ...over,
  }
}

function goblin(over: Partial<Combatant> = {}): Combatant {
  return {
    ...fighter(),
    id: 'gob',
    refId: 'goblin',
    name: 'Goblin',
    side: 'enemy',
    hp: 7,
    maxHp: 7,
    ac: 13,
    attackBonus: 4,
    damage: '1d6+2',
    dexMod: 2,
    mods: {},
    skills: [],
    reward: { xp: 50, gold: '1d6', drops: [{ itemId: 'potion', chance: 1 }] },
    ...over,
  }
}

const defs: CombatDefs = {
  skills: {
    cure: {
      id: 'cure',
      name: 'Cure Wounds',
      mpCost: 2,
      description: '',
      target: 'ally',
      effect: 'heal',
      dice: '1d8',
      ability: 'WIS',
      attack: false,
    },
  },
  items: {
    feather: {
      id: 'feather',
      name: 'Phoenix Feather',
      description: '',
      price: 50,
      target: 'ally-down',
      effect: 'revive',
      dice: '0',
    },
  },
}

/** Hero rolls 20 initiative, goblin rolls 1, so the hero always acts first. */
function heroFirst(party: Combatant[], enemies: Combatant[], extra: Parameters<typeof startBattle>[2] = {}) {
  const faces: [number, number][] = [...party, ...enemies].filter((c) => c.hp > 0).map((c) => [c.side === 'party' ? 20 : 1, 20])
  return startBattle(party, enemies, { ...extra, rng: facesRng(faces) })
}

describe('combat', () => {
  it('orders turns by initiative and starts on the party', () => {
    const s = heroFirst([fighter()], [goblin()])
    expect(currentActor(s)?.id).toBe('hero')
    expect(isPartyTurn(s)).toBe(true)
  })

  it('a hit that drops the last enemy wins the battle with rewards', () => {
    let s = heroFirst([fighter()], [goblin()])
    // attack d20=15 hits AC 13, damage d8=4 (+3) = 7, then gold 1d6=3, drop roll uses rng() < 1
    s = applyAction(s, { type: 'attack', actorId: 'hero', targetId: 'gob' }, defs, facesRng([[15, 20], [4, 8], [3, 6], [1, 2]]))
    expect(s.status).toBe('victory')
    expect(s.rewards).toEqual({ xp: 50, gold: 3, items: { potion: 1 } })
  })

  it('a miss passes the turn to the enemy, and the enemy AI picks a target', () => {
    let s = heroFirst([fighter()], [goblin()])
    s = applyAction(s, { type: 'attack', actorId: 'hero', targetId: 'gob' }, defs, facesRng([[5, 20]]))
    expect(s.log.at(-1)?.kind).toBe('miss')
    expect(currentActor(s)?.id).toBe('gob')
    const action = chooseEnemyAction(s, defs, () => 0.9)
    expect(action).toMatchObject({ type: 'attack', actorId: 'gob', targetId: 'hero' })
  })

  it('defending halves incoming damage until the defender acts again', () => {
    let s = heroFirst([fighter()], [goblin()])
    s = applyAction(s, { type: 'defend', actorId: 'hero' }, defs)
    // goblin hits: d20=15 vs AC 16 -> 15+4=19 hits; d6=6 +2 = 8 -> halved to 4
    s = applyAction(s, { type: 'attack', actorId: 'gob', targetId: 'hero' }, defs, facesRng([[15, 20], [6, 6]]))
    expect(s.combatants.find((c) => c.id === 'hero')?.hp).toBe(8)
    expect(s.combatants.find((c) => c.id === 'hero')?.defending).toBe(false)
    expect(s.round).toBe(2)
  })

  it('heal skills spend MP and cap at max HP', () => {
    let s = heroFirst([fighter({ hp: 5 })], [goblin()])
    s = applyAction(s, { type: 'skill', actorId: 'hero', skillId: 'cure', targetId: 'hero' }, defs, facesRng([[8, 8]]))
    const hero = s.combatants.find((c) => c.id === 'hero')!
    expect(hero.hp).toBe(12)
    expect(hero.mp).toBe(2)
  })

  it('items consume inventory and can revive a downed ally', () => {
    const ally = fighter({ id: 'ally', name: 'Mira', hp: 0 })
    let s = heroFirst([fighter(), ally], [goblin()], { inventory: { feather: 1 } })
    s = applyAction(s, { type: 'item', actorId: 'hero', itemId: 'feather', targetId: 'ally' }, defs, facesRng([]))
    expect(s.inventory.feather).toBe(0)
    expect(s.combatants.find((c) => c.id === 'ally')?.hp).toBe(3)
  })

  it('downed combatants are skipped in the turn order', () => {
    const ally = fighter({ id: 'ally', name: 'Mira', hp: 0 })
    let s = heroFirst([fighter(), ally], [goblin()])
    s = applyAction(s, { type: 'defend', actorId: 'hero' }, defs)
    expect(currentActor(s)?.id).toBe('gob')
  })

  it('fleeing can succeed, fail, or be forbidden', () => {
    const ok = applyAction(heroFirst([fighter()], [goblin()]), { type: 'flee', actorId: 'hero' }, defs, facesRng([[15, 20]]))
    expect(ok.status).toBe('fled')
    const fail = applyAction(heroFirst([fighter()], [goblin()]), { type: 'flee', actorId: 'hero' }, defs, facesRng([[3, 20]]))
    expect(fail.status).toBe('active')
    const boss = applyAction(heroFirst([fighter()], [goblin()], { canFlee: false }), { type: 'flee', actorId: 'hero' }, defs, facesRng([]))
    expect(boss.status).toBe('active')
  })

  it('losing every party member is a defeat', () => {
    let s = heroFirst([fighter({ hp: 1 })], [goblin()])
    s = applyAction(s, { type: 'defend', actorId: 'hero' }, defs)
    s = applyAction(s, { type: 'attack', actorId: 'gob', targetId: 'hero' }, defs, facesRng([[18, 20], [3, 6]]))
    expect(s.status).toBe('defeat')
  })

  it('ignores actions from anyone but the current actor', () => {
    const s = heroFirst([fighter()], [goblin()])
    expect(applyAction(s, { type: 'defend', actorId: 'gob' }, defs)).toBe(s)
  })

  it('labels duplicate enemy names', () => {
    const names = labelDuplicates([goblin({ id: 'a' }), goblin({ id: 'b' }), goblin({ id: 'c', name: 'Slime' })]).map((e) => e.name)
    expect(names).toEqual(['Goblin A', 'Goblin B', 'Slime'])
  })
})
