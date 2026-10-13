import { roll, withMod, type RollMode, type RollResult } from './dice'
import { defaultRng, type Rng } from './rng'

export const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
export type Ability = (typeof ABILITIES)[number]
export type Abilities = Record<Ability, number>

export const ABILITY_NAMES: Record<Ability, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4)
}

export function rollAbilityScores(rng: Rng = defaultRng): Abilities {
  const scores = {} as Abilities
  for (const a of ABILITIES) scores[a] = roll('4d6kh3', { rng }).total
  return scores
}

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000] as const
export const MAX_LEVEL = XP_THRESHOLDS.length

export function levelForXp(xp: number): number {
  let level = 1
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1
  return level
}

export function xpProgress(xp: number): { level: number; into: number; span: number; ratio: number } {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return { level, into: 0, span: 0, ratio: 1 }
  const floor = XP_THRESHOLDS[level - 1]
  const span = XP_THRESHOLDS[level] - floor
  return { level, into: xp - floor, span, ratio: (xp - floor) / span }
}

export interface CheckResult {
  roll: RollResult
  modifier: number
  dc: number
  total: number
  success: boolean
}

/** Natural 20 always succeeds and natural 1 always fails (table rule, not strict 5e for checks). */
export function abilityCheck(
  modifier: number,
  dc: number,
  opts: { mode?: RollMode; rng?: Rng } = {},
): CheckResult {
  const r = roll(withMod('1d20', modifier), opts)
  const success = r.crit ? true : r.fumble ? false : r.total >= dc
  return { roll: r, modifier, dc, total: r.total, success }
}

export interface AttackResult {
  roll: RollResult
  total: number
  ac: number
  hit: boolean
  crit: boolean
  fumble: boolean
}

export function attackRoll(
  bonus: number,
  ac: number,
  opts: { mode?: RollMode; rng?: Rng } = {},
): AttackResult {
  const r = roll(withMod('1d20', bonus), opts)
  const hit = r.crit || (!r.fumble && r.total >= ac)
  return { roll: r, total: r.total, ac, hit, crit: r.crit, fumble: r.fumble }
}

export function rollInitiative(dexMod: number, rng: Rng = defaultRng): number {
  return roll(withMod('1d20', dexMod), { rng }).total
}
