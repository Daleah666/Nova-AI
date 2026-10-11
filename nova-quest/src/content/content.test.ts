import { describe, expect, it } from 'vitest'
import { CLASS_LIST, SKILLS } from './classes'
import { ITEMS } from './items'
import { LANDMARKS } from './map'
import { MONSTERS, ZONES } from './monsters'
import { NPCS } from './npcs'
import { SCENES } from './scenes'
import { SPRITES } from './sprites'
import { isValidDice } from '../engine/dice'

describe('content integrity', () => {
  it('scene links point at real nodes, NPCs, monsters and items', () => {
    for (const scene of Object.values(SCENES)) {
      const has = (id: string | undefined, where: string) =>
        expect(id === undefined || id in scene.nodes, `${scene.id}: ${where} -> ${id}`).toBe(true)
      has(scene.start, 'start')
      for (const s of scene.startIf ?? []) has(s.node, 'startIf')
      for (const [id, node] of Object.entries(scene.nodes)) {
        has(node.next, `${id}.next`)
        for (const who of [node.speaker, node.show]) {
          if (who && who !== 'lead') expect(NPCS[who], `${scene.id}.${id} npc ${who}`).toBeDefined()
        }
        if (node.battle) {
          has(node.battle.victory, `${id}.battle`)
          for (const m of node.battle.enemies) expect(MONSTERS[m], m).toBeDefined()
        }
        for (const c of node.choices ?? []) {
          has(c.next, `${id}.choice`)
          if (c.check) {
            has(c.check.success, `${id}.check.success`)
            has(c.check.failure, `${id}.check.failure`)
          }
        }
        for (const e of [...(node.effects ?? []), ...(node.choices ?? []).flatMap((c) => c.effects ?? [])]) {
          if (e.type === 'item') expect(ITEMS[e.id], e.id).toBeDefined()
        }
      }
    }
  })

  it('landmarks, classes, monsters and NPCs reference real scenes, skills and sprites', () => {
    for (const l of Object.values(LANDMARKS)) {
      if (l.sceneId) expect(SCENES[l.sceneId]).toBeDefined()
      expect(SPRITES[l.sprite]).toBeDefined()
    }
    for (const c of CLASS_LIST) {
      expect(SPRITES[c.sprite]).toBeDefined()
      for (const s of c.skills) expect(SKILLS[s], s).toBeDefined()
    }
    for (const m of Object.values(MONSTERS)) {
      expect(SPRITES[m.sprite]).toBeDefined()
      for (const s of m.skills) expect(SKILLS[s], s).toBeDefined()
      for (const d of [m.hp, m.damage, m.gold]) expect(isValidDice(d), d).toBe(true)
    }
    for (const z of Object.values(ZONES)) for (const m of z.monsters) expect(MONSTERS[m]).toBeDefined()
    for (const n of Object.values(NPCS)) expect(SPRITES[n.sprite]).toBeDefined()
    for (const s of Object.values(SKILLS)) expect(isValidDice(s.dice), s.id).toBe(true)
  })
})
