import { describe, expect, it } from 'vitest'
import { DiceParseError, formatRoll, isValidDice, parseDice, roll, withMod } from './dice'
import { mulberry32 } from './rng'
import { facesRng } from './testing'

describe('parseDice', () => {
  it('parses simple and compound notation', () => {
    expect(parseDice('d20')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 20 }])
    expect(parseDice('3d6 + 5')).toEqual([
      { kind: 'dice', sign: 1, count: 3, sides: 6 },
      { kind: 'flat', sign: 1, value: 5 },
    ])
    expect(parseDice('2d8-1')[1]).toEqual({ kind: 'flat', sign: -1, value: 1 })
    expect(parseDice('d%')[0]).toMatchObject({ sides: 100 })
  })

  it('parses keep highest / lowest', () => {
    expect(parseDice('4d6kh3')[0]).toMatchObject({ count: 4, sides: 6, keep: { highest: true, n: 3 } })
    expect(parseDice('2d20kl1')[0]).toMatchObject({ keep: { highest: false, n: 1 } })
  })

  it('rejects garbage', () => {
    for (const bad of ['', 'abc', '3d', 'd1', '2d6 3', '0d6', '3d6kh4', '1000d6']) {
      expect(() => parseDice(bad), bad).toThrow(DiceParseError)
    }
    expect(isValidDice('1d20+5')).toBe(true)
    expect(isValidDice('roll')).toBe(false)
  })
})

describe('roll', () => {
  it('sums dice and modifiers', () => {
    const r = roll('3d6+5', { rng: facesRng([[4, 6], [2, 6], [6, 6]]) })
    expect(r.total).toBe(17)
    expect(r.modifier).toBe(5)
    expect(r.natural).toBeNull()
  })

  it('keeps the highest three of 4d6', () => {
    const r = roll('4d6kh3', { rng: facesRng([[1, 6], [5, 6], [3, 6], [6, 6]]) })
    expect(r.total).toBe(14)
    expect(r.dice[0].kept.sort()).toEqual([3, 5, 6])
  })

  it('flags natural 20 and natural 1', () => {
    expect(roll('1d20+3', { rng: facesRng([[20, 20]]) })).toMatchObject({ natural: 20, crit: true, total: 23 })
    expect(roll('d20', { rng: facesRng([[1, 20]]) })).toMatchObject({ natural: 1, fumble: true })
  })

  it('advantage takes the higher d20, disadvantage the lower', () => {
    const adv = roll('1d20+2', { mode: 'advantage', rng: facesRng([[4, 20], [17, 20]]) })
    expect(adv.natural).toBe(17)
    expect(adv.total).toBe(19)
    const dis = roll('1d20+2', { mode: 'disadvantage', rng: facesRng([[4, 20], [17, 20]]) })
    expect(dis.natural).toBe(4)
    expect(dis.total).toBe(6)
  })

  it('ignores advantage when there is no single d20 to apply it to', () => {
    const r = roll('2d6', { mode: 'advantage', rng: facesRng([[3, 6], [4, 6]]) })
    expect(r.mode).toBe('normal')
    expect(r.total).toBe(7)
  })

  it('critical damage doubles the dice but not the modifier', () => {
    const r = roll('1d8+3', { critical: true, rng: facesRng([[5, 8], [7, 8]]) })
    expect(r.dice[0].rolls).toHaveLength(2)
    expect(r.total).toBe(15)
  })

  it('stays within bounds over many rolls', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 2000; i++) {
      const t = roll('2d6-1', { rng }).total
      expect(t).toBeGreaterThanOrEqual(1)
      expect(t).toBeLessThanOrEqual(11)
    }
  })

  it('formats a readable breakdown', () => {
    const r = roll('1d20+5', { mode: 'advantage', rng: facesRng([[3, 20], [20, 20]]) })
    expect(formatRoll(r)).toBe('1d20+5: [20 | dropped 3] + 5 = 25 (advantage, NAT 20)')
  })

  it('withMod appends signed modifiers', () => {
    expect(withMod('1d20', 3)).toBe('1d20+3')
    expect(withMod('1d20', -2)).toBe('1d20-2')
    expect(withMod('1d20', 0)).toBe('1d20')
  })
})
