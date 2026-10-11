import type { Abilities, Ability } from './rules'

export type ClassId = 'fighter' | 'wizard' | 'rogue' | 'cleric'

export interface ClassDef {
  id: ClassId
  name: string
  tagline: string
  hitDie: number
  primary: Ability
  attackAbility: Ability
  weapon: string
  weaponName: string
  baseAc: number
  /** Max DEX modifier added to AC (0 = heavy armor). */
  dexToAc: number
  baseMp: number
  mpPerLevel: number
  skills: string[]
  sprite: string
  /** Suggested stat priority used when auto-assigning rolled scores. */
  priority: Ability[]
}

export interface Character {
  id: string
  name: string
  classId: ClassId
  abilities: Abilities
  level: number
  xp: number
  hp: number
  mp: number
  /** Legacy inline portrait; art now lives in the IndexedDB art library. */
  portrait?: string
  /** Short backstory, e.g. from an imported character card. Shared with the AI DM. */
  bio?: string
}

export type SkillTarget = 'enemy' | 'all-enemies' | 'ally' | 'all-allies' | 'self'

export interface SkillDef {
  id: string
  name: string
  mpCost: number
  description: string
  target: SkillTarget
  effect: 'damage' | 'heal'
  dice: string
  /** Ability whose modifier is added to the dice. */
  ability?: Ability
  /** Requires an attack roll against AC; otherwise it always lands. */
  attack: boolean
}

export interface ItemDef {
  id: string
  name: string
  description: string
  price: number
  target: 'ally' | 'ally-down' | 'enemy'
  effect: 'heal' | 'mp' | 'revive' | 'damage'
  dice: string
}

export interface MonsterDef {
  id: string
  name: string
  description: string
  hp: string
  ac: number
  attackBonus: number
  damage: string
  attackName: string
  dexMod: number
  mp: number
  skills: string[]
  xp: number
  gold: string
  drops?: { itemId: string; chance: number }[]
  sprite: string
  boss?: boolean
}
