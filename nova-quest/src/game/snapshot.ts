import { CLASSES, SKILLS } from '../content/classes'
import { ITEMS } from '../content/items'
import { LANDMARKS, TILES, tileAt, zoneAt } from '../content/map'
import { ZONES } from '../content/monsters'
import type { GameData } from '../store/game'
import { statsOf } from './party'

/** Compact, model-friendly view of the save used by the AI DM's get_party_state tool. */
export function partySnapshot(s: Pick<GameData, 'party' | 'gold' | 'inventory' | 'flags' | 'pos' | 'journal' | 'quests'>) {
  const here = tileAt(s.pos.x, s.pos.y)
  return {
    party: s.party.map((c) => {
      const st = statsOf(c)
      return {
        name: c.name,
        class: CLASSES[c.classId].name,
        level: c.level,
        hp: `${c.hp}/${st.maxHp}`,
        mp: `${c.mp}/${st.maxMp}`,
        ac: st.ac,
        attack: `${CLASSES[c.classId].weaponName} +${st.attackBonus} (${st.damage})`,
        ability_modifiers: st.mods,
        skills: CLASSES[c.classId].skills.map((id) => SKILLS[id].name),
      }
    }),
    gold: s.gold,
    inventory: Object.fromEntries(Object.entries(s.inventory).map(([id, n]) => [ITEMS[id]?.name ?? id, n])),
    story_flags: Object.keys(s.flags).filter((k) => s.flags[k]),
    location: LANDMARKS[here]?.label ?? `${TILES[here]?.name ?? 'Wilds'} in the ${ZONES[zoneAt(s.pos.x, s.pos.y)].name}`,
    open_real_life_quests: s.quests.filter((q) => !q.done).map((q) => q.title),
    recent_journal: s.journal.slice(-12).map((j) => `[${j.kind}] ${j.text}`),
  }
}
