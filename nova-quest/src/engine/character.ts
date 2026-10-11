import { withMod } from './dice'
import { ABILITIES, abilityMod, levelForXp, proficiencyBonus, type Abilities, type Ability } from './rules'
import type { Character, ClassDef } from './types'
import { uid } from './rng'

export interface DerivedStats {
  maxHp: number
  maxMp: number
  ac: number
  prof: number
  attackBonus: number
  damage: string
  mods: Record<Ability, number>
}

export function abilityMods(abilities: Abilities): Record<Ability, number> {
  const mods = {} as Record<Ability, number>
  for (const a of ABILITIES) mods[a] = abilityMod(abilities[a])
  return mods
}

export function deriveStats(c: Pick<Character, 'abilities' | 'level'>, cls: ClassDef): DerivedStats {
  const mods = abilityMods(c.abilities)
  const con = mods.CON
  const perLevel = Math.max(1, Math.floor(cls.hitDie / 2) + 1 + con)
  const maxHp = Math.max(1, cls.hitDie + con) + (c.level - 1) * perLevel
  const maxMp = cls.baseMp + (c.level - 1) * cls.mpPerLevel + Math.max(0, mods[cls.primary])
  const ac = cls.baseAc + Math.max(0, Math.min(mods.DEX, cls.dexToAc))
  const prof = proficiencyBonus(c.level)
  const atkMod = mods[cls.attackAbility]
  return {
    maxHp,
    maxMp,
    ac,
    prof,
    attackBonus: prof + atkMod,
    damage: withMod(cls.weapon, atkMod),
    mods,
  }
}

/** Assigns sorted rolled scores to the class's preferred abilities, highest first. */
export function assignScores(rolled: number[], cls: ClassDef): Abilities {
  const sorted = [...rolled].sort((a, b) => b - a)
  const out = {} as Abilities
  const order = [...cls.priority, ...ABILITIES.filter((a) => !cls.priority.includes(a))]
  order.forEach((a, i) => (out[a] = sorted[i] ?? 10))
  return out
}

export function createCharacter(name: string, cls: ClassDef, abilities: Abilities, portrait?: string): Character {
  const base = { abilities, level: 1 }
  const stats = deriveStats(base, cls)
  return {
    id: uid('hero'),
    name: name.trim() || cls.name,
    classId: cls.id,
    abilities,
    level: 1,
    xp: 0,
    hp: stats.maxHp,
    mp: stats.maxMp,
    portrait,
  }
}

export function grantXp(c: Character, cls: ClassDef, amount: number): { character: Character; leveledUp: boolean } {
  const xp = c.xp + Math.max(0, amount)
  const level = levelForXp(xp)
  if (level === c.level) return { character: { ...c, xp }, leveledUp: false }
  const before = deriveStats(c, cls)
  const after = deriveStats({ ...c, level }, cls)
  return {
    character: {
      ...c,
      xp,
      level,
      hp: Math.min(after.maxHp, c.hp + (after.maxHp - before.maxHp)),
      mp: Math.min(after.maxMp, c.mp + (after.maxMp - before.maxMp)),
    },
    leveledUp: true,
  }
}

export function longRest(c: Character, cls: ClassDef): Character {
  const s = deriveStats(c, cls)
  return { ...c, hp: s.maxHp, mp: s.maxMp }
}
