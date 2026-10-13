import { CLASSES } from '../content/classes'
import { MONSTERS, ZONES, type ZoneId } from '../content/monsters'
import { deriveStats } from '../engine/character'
import { monsterToCombatant, type Combatant } from '../engine/combat'
import { defaultRng, pick, type Rng } from '../engine/rng'
import type { Character } from '../engine/types'

export function statsOf(c: Character) {
  return deriveStats(c, CLASSES[c.classId])
}

export function characterToCombatant(c: Character): Combatant {
  const cls = CLASSES[c.classId]
  const s = deriveStats(c, cls)
  return {
    id: c.id,
    refId: c.id,
    name: c.name,
    side: 'party',
    hp: c.hp,
    maxHp: s.maxHp,
    mp: c.mp,
    maxMp: s.maxMp,
    ac: s.ac,
    prof: s.prof,
    attackBonus: s.attackBonus,
    damage: s.damage,
    attackName: cls.weaponName,
    dexMod: s.mods.DEX,
    mods: s.mods,
    skills: cls.skills,
    defending: false,
    initiative: 0,
    sprite: cls.sprite,
    portrait: c.portrait,
  }
}

export function spawnEnemies(ids: string[], rng: Rng = defaultRng): Combatant[] {
  return ids.filter((id) => MONSTERS[id]).map((id, i) => monsterToCombatant(MONSTERS[id], i, rng))
}

/** Group size grows with party size and level so a full party gets a real fight. */
export function rollEncounter(zone: ZoneId, party: Character[], rng: Rng = defaultRng): string[] {
  const avgLevel = party.reduce((s, c) => s + c.level, 0) / Math.max(1, party.length)
  const max = Math.min(4, Math.max(1, Math.round(party.length * 0.6 + avgLevel * 0.4)))
  const count = 1 + Math.floor(rng() * max)
  return Array.from({ length: count }, () => pick(ZONES[zone].monsters, rng))
}

export function leadOf(party: Character[]): Character | undefined {
  return party.find((c) => c.hp > 0) ?? party[0]
}

export function bestAt(party: Character[], ability: keyof Character['abilities']): Character | undefined {
  return [...party].sort((a, b) => b.abilities[ability] - a.abilities[ability])[0]
}
