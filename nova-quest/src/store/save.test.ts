import { describe, expect, it } from 'vitest'
import { CLASSES } from '../content/classes'
import { createCharacter } from '../engine/character'
import { parseSave, useGame } from './game'

const hero = () => createCharacter('Sven', CLASSES.fighter, { STR: 15, DEX: 13, CON: 14, INT: 8, WIS: 12, CHA: 10 })

describe('save export/import', () => {
  it('round-trips game data and drops UI-only state', () => {
    const g = useGame.getState()
    g.beginAdventure([hero()])
    g.addQuest('Write the README', 'medium')
    const json = useGame.getState().exportSave()
    const file = JSON.parse(json)
    expect(file.game).toBe('nova-quest')
    expect(file.data).not.toHaveProperty('toasts')
    expect(json).not.toMatch(/aiKey/)

    useGame.getState().wipeSave()
    expect(useGame.getState().party).toHaveLength(0)

    useGame.getState().importSave(json)
    const s = useGame.getState()
    expect(s.party[0].name).toBe('Sven')
    expect(s.gold).toBe(25)
    expect(s.quests.map((q) => q.title)).toEqual(['Write the README'])
    expect(s.screen).toBe('scene')
  })

  it('rejects files that are not saves', () => {
    expect(() => parseSave('not json')).toThrow(/Nova Quest save/)
    expect(() => parseSave('{"game":"zelda","data":{"party":[]}}')).toThrow(/Nova Quest save/)
    expect(() => parseSave('{"game":"nova-quest","data":{}}')).toThrow(/Nova Quest save/)
  })

  it('drops unknown keys and repairs dangling screens', () => {
    const data = parseSave(
      JSON.stringify({ game: 'nova-quest', data: { party: [hero()], screen: 'battle', battle: null, evil: 'x', version: 99 } }),
    )
    expect(data).not.toHaveProperty('evil')
    expect(data.version).toBe(1)
    expect(data.screen).toBe('world')
    expect(data.inventory).toEqual({})
    expect(parseSave(JSON.stringify({ game: 'nova-quest', data: { party: [], screen: 'world' } })).screen).toBe('title')
  })
})
