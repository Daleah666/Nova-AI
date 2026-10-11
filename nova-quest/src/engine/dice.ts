import { defaultRng, type Rng } from './rng'

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  keep?: { highest: boolean; n: number }
}

export interface FlatTerm {
  kind: 'flat'
  sign: 1 | -1
  value: number
}

export type Term = DiceTerm | FlatTerm

export interface TermResult {
  term: DiceTerm
  rolls: number[]
  kept: number[]
  subtotal: number
}

export interface RollResult {
  notation: string
  mode: RollMode
  critical: boolean
  dice: TermResult[]
  modifier: number
  total: number
  /** The kept face of a leading single d20, or null when the roll has no such die. */
  natural: number | null
  crit: boolean
  fumble: boolean
}

export interface RollOptions {
  mode?: RollMode
  /** Critical hit damage: doubles the number of dice rolled, never the flat modifiers. */
  critical?: boolean
  rng?: Rng
}

export class DiceParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiceParseError'
  }
}

const MAX_DICE = 100
const MAX_SIDES = 1000

export function parseDice(notation: string): Term[] {
  const src = notation.trim().replace(/\s*([+-])\s*/g, '$1').toLowerCase()
  if (!src) throw new DiceParseError('Empty dice notation')
  if (/\s/.test(src)) throw new DiceParseError(`Unexpected space in "${notation}"`)

  const re = /([+-])?(?:(\d*)d(\d+|%)(?:k([hl])(\d+))?|(\d+))/y
  const terms: Term[] = []
  let i = 0
  while (i < src.length) {
    re.lastIndex = i
    const m = re.exec(src)
    if (!m || m[0].length === 0) {
      throw new DiceParseError(`Can't read "${src.slice(i)}" in "${notation}"`)
    }
    if (terms.length > 0 && !m[1]) {
      throw new DiceParseError(`Missing + or - before "${m[0]}"`)
    }
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1

    if (m[3] !== undefined) {
      const count = m[2] ? parseInt(m[2], 10) : 1
      const sides = m[3] === '%' ? 100 : parseInt(m[3], 10)
      if (count < 1 || count > MAX_DICE) throw new DiceParseError(`Dice count must be 1-${MAX_DICE}`)
      if (sides < 2 || sides > MAX_SIDES) throw new DiceParseError(`Dice sides must be 2-${MAX_SIDES}`)
      const term: DiceTerm = { kind: 'dice', sign, count, sides }
      if (m[4]) {
        const n = parseInt(m[5], 10)
        if (n < 1 || n > count) throw new DiceParseError(`Can't keep ${n} of ${count} dice`)
        term.keep = { highest: m[4] === 'h', n }
      }
      terms.push(term)
    } else {
      terms.push({ kind: 'flat', sign, value: parseInt(m[6], 10) })
    }
    i = re.lastIndex
  }
  return terms
}

export function isValidDice(notation: string): boolean {
  try {
    parseDice(notation)
    return true
  } catch {
    return false
  }
}

export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * sides) + 1
}

export function roll(notation: string, opts: RollOptions = {}): RollResult {
  const { mode = 'normal', critical = false, rng = defaultRng } = opts
  let terms = parseDice(notation)

  if (mode !== 'normal') {
    const idx = terms.findIndex((t) => t.kind === 'dice' && t.count === 1 && t.sides === 20 && !t.keep)
    if (idx >= 0) {
      terms = terms.map((t, j) =>
        j === idx ? { ...(t as DiceTerm), count: 2, keep: { highest: mode === 'advantage', n: 1 } } : t,
      )
    }
  }

  const dice: TermResult[] = []
  let modifier = 0
  for (const t of terms) {
    if (t.kind === 'flat') {
      modifier += t.sign * t.value
      continue
    }
    const count = critical ? t.count * 2 : t.count
    const rolls = Array.from({ length: count }, () => rollDie(t.sides, rng))
    let kept = rolls
    if (t.keep) {
      const n = critical ? t.keep.n * 2 : t.keep.n
      const highest = t.keep.highest
      kept = [...rolls].sort((a, b) => (highest ? b - a : a - b)).slice(0, n)
    }
    const subtotal = t.sign * kept.reduce((s, v) => s + v, 0)
    dice.push({ term: t, rolls, kept, subtotal })
  }

  const total = dice.reduce((s, d) => s + d.subtotal, 0) + modifier
  const first = dice[0]
  const natural =
    first && first.term.sides === 20 && first.term.sign === 1 && first.kept.length === 1 ? first.kept[0] : null

  return {
    notation,
    mode,
    critical,
    dice,
    modifier,
    total,
    natural,
    crit: natural === 20,
    fumble: natural === 1,
  }
}

export function withMod(dice: string, mod: number): string {
  if (mod === 0) return dice
  return `${dice}${mod > 0 ? '+' : '-'}${Math.abs(mod)}`
}

export function formatRoll(r: RollResult): string {
  const parts = r.dice.map((d) => {
    const dropped = [...d.rolls]
    for (const k of d.kept) dropped.splice(dropped.indexOf(k), 1)
    const keptStr = d.kept.join(', ')
    const dropStr = dropped.length ? ` | dropped ${dropped.join(', ')}` : ''
    return `${d.term.sign < 0 ? '-' : ''}[${keptStr}${dropStr}]`
  })
  const mod = r.modifier ? ` ${r.modifier > 0 ? '+' : '-'} ${Math.abs(r.modifier)}` : ''
  const tags = [
    r.mode !== 'normal' ? r.mode : '',
    r.critical ? 'crit dice' : '',
    r.crit ? 'NAT 20' : '',
    r.fumble ? 'NAT 1' : '',
  ].filter(Boolean)
  return `${r.notation}: ${parts.join(' ')}${mod} = ${r.total}${tags.length ? ` (${tags.join(', ')})` : ''}`
}
