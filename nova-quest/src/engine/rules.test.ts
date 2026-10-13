import { describe, expect, it } from 'vitest'
import { abilityCheck, abilityMod, attackRoll, levelForXp, proficiencyBonus, rollAbilityScores, xpProgress } from './rules'
import { mulberry32 } from './rng'
import { facesRng } from './testing'

describe('rules', () => {
  it('computes ability modifiers like 5e', () => {
    expect([1, 8, 9, 10, 11, 12, 15, 18, 20].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 1, 2, 4, 5])
  })

  it('scales proficiency and levels', () => {
    expect([1, 4, 5, 9].map(proficiencyBonus)).toEqual([2, 2, 3, 4])
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(299)).toBe(1)
    expect(levelForXp(300)).toBe(2)
    expect(levelForXp(1_000_000)).toBe(10)
    expect(xpProgress(600)).toMatchObject({ level: 2, into: 300, span: 600, ratio: 0.5 })
  })

  it('rolls ability scores in the 3-18 range', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 200; i++) {
      for (const v of Object.values(rollAbilityScores(rng))) {
        expect(v).toBeGreaterThanOrEqual(3)
        expect(v).toBeLessThanOrEqual(18)
      }
    }
  })

  it('checks succeed on meeting the DC, nat 20 always wins, nat 1 always loses', () => {
    expect(abilityCheck(2, 12, { rng: facesRng([[10, 20]]) }).success).toBe(true)
    expect(abilityCheck(2, 12, { rng: facesRng([[9, 20]]) }).success).toBe(false)
    expect(abilityCheck(-5, 30, { rng: facesRng([[20, 20]]) }).success).toBe(true)
    expect(abilityCheck(15, 5, { rng: facesRng([[1, 20]]) }).success).toBe(false)
  })

  it('attacks hit on meeting AC and crit on natural 20', () => {
    expect(attackRoll(4, 15, { rng: facesRng([[11, 20]]) }).hit).toBe(true)
    expect(attackRoll(4, 15, { rng: facesRng([[10, 20]]) }).hit).toBe(false)
    expect(attackRoll(0, 30, { rng: facesRng([[20, 20]]) })).toMatchObject({ hit: true, crit: true })
  })
})
