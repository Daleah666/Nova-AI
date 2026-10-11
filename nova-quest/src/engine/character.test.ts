import { describe, expect, it } from 'vitest'
import { assignScores, createCharacter, deriveStats, grantXp, longRest } from './character'
import type { ClassDef } from './types'

const fighter: ClassDef = {
  id: 'fighter',
  name: 'Fighter',
  tagline: '',
  hitDie: 10,
  primary: 'STR',
  attackAbility: 'STR',
  weapon: '1d8',
  weaponName: 'Longsword',
  baseAc: 16,
  dexToAc: 0,
  baseMp: 2,
  mpPerLevel: 1,
  skills: [],
  sprite: 'fighter',
  priority: ['STR', 'CON', 'DEX'],
}

describe('character', () => {
  const abilities = assignScores([15, 14, 13, 12, 10, 8], fighter)

  it('assigns the best scores to the class priorities', () => {
    expect(abilities).toMatchObject({ STR: 15, CON: 14, DEX: 13 })
  })

  it('derives level 1 stats from class and abilities', () => {
    const s = deriveStats({ abilities, level: 1 }, fighter)
    expect(s).toMatchObject({ maxHp: 12, maxMp: 4, ac: 16, prof: 2, attackBonus: 4, damage: '1d8+2' })
  })

  it('levels up from XP, growing max HP without healing damage', () => {
    const c = { ...createCharacter('Sven', fighter, abilities), hp: 5 }
    const { character, leveledUp } = grantXp(c, fighter, 300)
    expect(leveledUp).toBe(true)
    expect(character.level).toBe(2)
    expect(character.hp).toBe(5 + 8)
    expect(longRest(character, fighter).hp).toBe(deriveStats(character, fighter).maxHp)
  })
})
