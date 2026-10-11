import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CLASSES, SKILLS } from '../content/classes'
import { ITEMS } from '../content/items'
import { isPassable, LANDMARKS, RESPAWN_POS, START_POS, TILES, tileAt, zoneAt } from '../content/map'
import { ZONES } from '../content/monsters'
import { SCENES } from '../content/scenes'
import { grantXp, longRest } from '../engine/character'
import {
  applyAction,
  chooseEnemyAction,
  startBattle,
  type BattleAction,
  type BattleState,
  type CombatDefs,
} from '../engine/combat'
import { formatRoll } from '../engine/dice'
import { abilityCheck, abilityMod, ABILITY_NAMES, type CheckResult } from '../engine/rules'
import { entryNode, type Check, type Effect } from '../engine/scene'
import { uid } from '../engine/rng'
import type { Character } from '../engine/types'
import { characterToCombatant, rollEncounter, spawnEnemies } from '../game/party'

export type Screen = 'title' | 'create' | 'world' | 'scene' | 'battle'
export type Facing = 'up' | 'down' | 'left' | 'right'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'epic'
export type JournalKind = 'story' | 'roll' | 'oracle' | 'quest' | 'battle' | 'dm' | 'focus' | 'level'

export const QUEST_REWARDS: Record<Difficulty, { xp: number; gold: number; label: string }> = {
  easy: { xp: 25, gold: 5, label: 'Easy' },
  medium: { xp: 60, gold: 15, label: 'Medium' },
  hard: { xp: 120, gold: 30, label: 'Hard' },
  epic: { xp: 300, gold: 75, label: 'Epic' },
}

export const FOCUS_XP = 20

export interface Quest {
  id: string
  title: string
  difficulty: Difficulty
  done: boolean
  createdAt: number
  doneAt?: number
}

export interface JournalEntry {
  id: string
  at: number
  kind: JournalKind
  text: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'event'
  content: string
  at: number
}

export interface Toast {
  id: string
  text: string
  kind: 'info' | 'level' | 'reward' | 'danger'
}

export interface GameData {
  version: 1
  screen: Screen
  party: Character[]
  gold: number
  inventory: Record<string, number>
  flags: Record<string, boolean>
  pos: { x: number; y: number }
  facing: Facing
  stepsSinceBattle: number
  scene: { sceneId: string; nodeId: string } | null
  battle: BattleState | null
  battleReturn: { victoryNode?: string } | null
  quests: Quest[]
  journal: JournalEntry[]
  dm: ChatMessage[]
  npcArt: Record<string, string>
  focusSessions: number
}

export type MoveResult = 'blocked' | 'moved' | 'scene' | 'battle' | 'crystal' | 'ignored'

interface GameActions {
  newGame: () => void
  beginAdventure: (party: Character[]) => void
  setScreen: (screen: Screen) => void
  move: (dx: number, dy: number) => MoveResult
  interact: () => MoveResult
  startScene: (sceneId: string) => void
  gotoNode: (nodeId: string) => void
  advance: () => void
  choose: (index: number) => void
  rollCheck: (check: Check, characterId: string, choiceIndex?: number) => CheckResult
  endScene: () => void
  beginBattle: (enemyIds: string[], opts?: { canFlee?: boolean; ambush?: boolean; victoryNode?: string }) => void
  battleAction: (action: BattleAction) => void
  enemyStep: () => void
  finishBattle: () => void
  grantPartyXp: (amount: number, reason: string) => void
  restParty: (reason: string) => void
  addQuest: (title: string, difficulty: Difficulty) => void
  completeQuest: (id: string) => void
  deleteQuest: (id: string) => void
  clearDoneQuests: () => void
  completeFocusSession: (minutes: number) => void
  log: (kind: JournalKind, text: string) => void
  addDm: (role: ChatMessage['role'], content: string) => void
  clearDm: () => void
  setPortrait: (characterId: string, dataUrl: string | undefined) => void
  setNpcArt: (npcId: string, dataUrl: string | undefined) => void
  exportSave: () => string
  importSave: (json: string) => void
}

interface Ephemeral {
  toasts: Toast[]
  notify: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void
}

export type GameStore = GameData & GameActions & Ephemeral

export const COMBAT_DEFS: CombatDefs = { skills: SKILLS, items: ITEMS }

const MAX_JOURNAL = 300
const MAX_DM = 120

function freshData(): GameData {
  return {
    version: 1,
    screen: 'title',
    party: [],
    gold: 0,
    inventory: {},
    flags: {},
    pos: { ...START_POS },
    facing: 'down',
    stepsSinceBattle: 0,
    scene: null,
    battle: null,
    battleReturn: null,
    quests: [],
    journal: [],
    dm: [],
    npcArt: {},
    focusSessions: 0,
  }
}

const DATA_KEYS = Object.keys(freshData()) as (keyof GameData)[]

function pickData(s: GameStore): GameData {
  const out = {} as Record<string, unknown>
  for (const k of DATA_KEYS) out[k] = s[k]
  return out as unknown as GameData
}

const DIRS: Record<string, Facing> = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' }

export const useGame = create<GameStore>()(
  persist(
    (set, get) => {
      const log = (kind: JournalKind, text: string) =>
        set((s) => ({ journal: [...s.journal, { id: uid('j'), at: Date.now(), kind, text }].slice(-MAX_JOURNAL) }))

      const notify = (text: string, kind: Toast['kind'] = 'info') => {
        const id = uid('t')
        set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-5) }))
        setTimeout(() => get().dismissToast(id), 3800)
      }

      const applyEffects = (effects: Effect[] = []) => {
        for (const e of effects) {
          switch (e.type) {
            case 'gold':
              set((s) => ({ gold: Math.max(0, s.gold + e.amount) }))
              if (e.amount > 0) notify(`+${e.amount} gold`, 'reward')
              break
            case 'xp':
              get().grantPartyXp(e.amount, 'story')
              break
            case 'item':
              set((s) => ({ inventory: { ...s.inventory, [e.id]: (s.inventory[e.id] ?? 0) + e.count } }))
              notify(`Got ${e.count}x ${ITEMS[e.id]?.name ?? e.id}`, 'reward')
              break
            case 'flag':
              set((s) => ({ flags: { ...s.flags, [e.id]: true } }))
              break
            case 'rest':
              get().restParty('a night at the inn')
              break
            case 'journal':
              log('story', e.text)
              break
          }
        }
      }

      const landmarkHere = (): MoveResult => {
        const { pos } = get()
        const ch = tileAt(pos.x, pos.y)
        const mark = LANDMARKS[ch]
        if (!mark) return 'ignored'
        if (mark.sceneId) {
          get().startScene(mark.sceneId)
          return 'scene'
        }
        get().restParty('the Save Crystal')
        notify('The crystal hums. Party restored and game saved.', 'reward')
        return 'crystal'
      }

      return {
        ...freshData(),
        toasts: [],
        notify,
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        log,

        newGame: () => set({ ...freshData(), screen: 'create', quests: get().quests, npcArt: get().npcArt }),

        beginAdventure: (party) => {
          set({ party, gold: 25, inventory: { potion: 1 }, flags: {}, pos: { ...START_POS }, facing: 'down' })
          log('story', `The party sets out: ${party.map((c) => `${c.name} the ${CLASSES[c.classId].name}`).join(', ')}.`)
          get().startScene('tavern')
        },

        setScreen: (screen) => set({ screen }),

        move: (dx, dy) => {
          const s = get()
          if (s.screen !== 'world') return 'ignored'
          const facing = DIRS[`${dx},${dy}`] ?? s.facing
          const x = s.pos.x + dx
          const y = s.pos.y + dy
          if (!isPassable(x, y)) {
            set({ facing })
            return 'blocked'
          }
          set({ pos: { x, y }, facing, stepsSinceBattle: s.stepsSinceBattle + 1 })
          const result = landmarkHere()
          if (result !== 'ignored') return result
          const tile = TILES[tileAt(x, y)]
          if (s.stepsSinceBattle >= 4 && Math.random() < tile.encounter) {
            const zone = zoneAt(x, y)
            const enemies = rollEncounter(zone, s.party)
            log('battle', `Ambushed in the ${ZONES[zone].name}!`)
            get().beginBattle(enemies)
            return 'battle'
          }
          return 'moved'
        },

        interact: () => (get().screen === 'world' ? landmarkHere() : 'ignored'),

        startScene: (sceneId) => {
          const scene = SCENES[sceneId]
          if (!scene) return
          set({ screen: 'scene', scene: { sceneId, nodeId: '' } })
          get().gotoNode(entryNode(scene, get().flags))
        },

        gotoNode: (nodeId) => {
          const cur = get().scene
          if (!cur) return
          const node = SCENES[cur.sceneId]?.nodes[nodeId]
          if (!node) return get().endScene()
          set({ scene: { ...cur, nodeId }, screen: 'scene' })
          applyEffects(node.effects)
        },

        advance: () => {
          const cur = get().scene
          if (!cur) return
          const node = SCENES[cur.sceneId]?.nodes[cur.nodeId]
          if (!node) return get().endScene()
          if (node.choices?.length) return
          if (node.battle) {
            const { enemies, canFlee, ambush, victory } = node.battle
            return get().beginBattle(enemies, { canFlee, ambush, victoryNode: victory })
          }
          if (node.next) return get().gotoNode(node.next)
          get().endScene()
        },

        choose: (index) => {
          const cur = get().scene
          if (!cur) return
          const choice = SCENES[cur.sceneId]?.nodes[cur.nodeId]?.choices?.[index]
          if (!choice || choice.check) return
          if (choice.requires?.gold && get().gold < choice.requires.gold) return
          applyEffects(choice.effects)
          if (choice.next) get().gotoNode(choice.next)
          else get().endScene()
        },

        rollCheck: (check, characterId, choiceIndex) => {
          const s = get()
          const c = s.party.find((p) => p.id === characterId) ?? s.party[0]
          const mod = abilityMod(c.abilities[check.ability])
          const result = abilityCheck(mod, check.dc)
          if (choiceIndex !== undefined && s.scene) {
            const choice = SCENES[s.scene.sceneId]?.nodes[s.scene.nodeId]?.choices?.[choiceIndex]
            applyEffects(choice?.effects)
          }
          log(
            'roll',
            `${c.name} rolls ${check.label} (${ABILITY_NAMES[check.ability]}) vs DC ${check.dc}: ${formatRoll(result.roll)} - ${result.success ? 'success' : 'failure'}.`,
          )
          return result
        },

        endScene: () => set({ scene: null, screen: get().party.length ? 'world' : 'title' }),

        beginBattle: (enemyIds, opts = {}) => {
          const s = get()
          const battle = startBattle(s.party.map(characterToCombatant), spawnEnemies(enemyIds), {
            inventory: s.inventory,
            canFlee: opts.canFlee ?? true,
            partyMode: opts.ambush ? 'advantage' : 'normal',
          })
          set({
            battle,
            battleReturn: s.scene ? { victoryNode: opts.victoryNode } : null,
            screen: 'battle',
          })
        },

        battleAction: (action) => {
          const b = get().battle
          if (b) set({ battle: applyAction(b, action, COMBAT_DEFS) })
        },

        enemyStep: () => {
          const b = get().battle
          if (!b) return
          const action = chooseEnemyAction(b, COMBAT_DEFS)
          if (action) set({ battle: applyAction(b, action, COMBAT_DEFS) })
        },

        finishBattle: () => {
          const s = get()
          const b = s.battle
          if (!b || b.status === 'active') return

          if (b.status === 'defeat') {
            const lost = Math.floor(s.gold / 2)
            set({
              party: s.party.map((c) => longRest(c, CLASSES[c.classId])),
              gold: s.gold - lost,
              pos: { ...RESPAWN_POS },
              battle: null,
              battleReturn: null,
              scene: null,
              screen: 'world',
              stepsSinceBattle: 0,
            })
            log('battle', `The party was defeated and woke up at the Sleepy Wyvern, ${lost} gold lighter.`)
            notify(`Defeated... You wake at the inn. Lost ${lost} gold.`, 'danger')
            return
          }

          const party = s.party.map((c) => {
            const cb = b.combatants.find((x) => x.refId === c.id)
            return cb ? { ...c, hp: Math.max(1, cb.hp), mp: cb.mp } : c
          })
          const inventory = Object.fromEntries(Object.entries(b.inventory).filter(([, n]) => n > 0))
          set({ party, inventory, battle: null, stepsSinceBattle: 0 })

          if (b.status === 'victory' && b.rewards) {
            const { xp, gold, items } = b.rewards
            set((st) => {
              const inv = { ...st.inventory }
              for (const [id, n] of Object.entries(items)) inv[id] = (inv[id] ?? 0) + n
              return { gold: st.gold + gold, inventory: inv }
            })
            const loot = Object.entries(items).map(([id, n]) => `${n}x ${ITEMS[id]?.name ?? id}`)
            log('battle', `Victory! +${xp} XP, +${gold} gold${loot.length ? `, found ${loot.join(', ')}` : ''}.`)
            get().grantPartyXp(xp, 'battle')
            const victoryNode = s.battleReturn?.victoryNode
            set({ battleReturn: null })
            if (victoryNode && get().scene) return get().gotoNode(victoryNode)
            set({ screen: get().scene ? 'scene' : 'world' })
            return
          }

          log('battle', 'The party fled the battle.')
          set({ battleReturn: null, scene: null, screen: 'world' })
        },

        grantPartyXp: (amount, reason) => {
          if (amount <= 0) return
          const leveled: Character[] = []
          const party = get().party.map((c) => {
            const r = grantXp(c, CLASSES[c.classId], amount)
            if (r.leveledUp) leveled.push(r.character)
            return r.character
          })
          set({ party })
          notify(`+${amount} XP (${reason})`, 'reward')
          for (const c of leveled) log('level', `${c.name} reached level ${c.level}!`)
          if (leveled.length) {
            const names = leveled.map((c) => `${c.name} (Lv${c.level})`).join(', ')
            notify(`LEVEL UP! ${names}`, 'level')
          }
        },

        restParty: (reason) => {
          set((s) => ({ party: s.party.map((c) => longRest(c, CLASSES[c.classId])) }))
          log('story', `Long rest at ${reason}. HP and MP restored.`)
        },

        addQuest: (title, difficulty) => {
          const t = title.trim()
          if (!t) return
          set((s) => ({ quests: [...s.quests, { id: uid('q'), title: t, difficulty, done: false, createdAt: Date.now() }] }))
        },

        completeQuest: (id) => {
          const q = get().quests.find((x) => x.id === id)
          if (!q || q.done) return
          const r = QUEST_REWARDS[q.difficulty]
          set((s) => ({
            quests: s.quests.map((x) => (x.id === id ? { ...x, done: true, doneAt: Date.now() } : x)),
            gold: s.gold + r.gold,
          }))
          log('quest', `Quest complete: "${q.title}" (+${r.xp} XP, +${r.gold} gold).`)
          notify(`Quest complete! +${r.gold} gold`, 'reward')
          get().grantPartyXp(r.xp, 'real-life quest')
        },

        deleteQuest: (id) => set((s) => ({ quests: s.quests.filter((q) => q.id !== id) })),
        clearDoneQuests: () => set((s) => ({ quests: s.quests.filter((q) => !q.done) })),

        completeFocusSession: (minutes) => {
          set((s) => ({ focusSessions: s.focusSessions + 1 }))
          log('focus', `Finished a ${minutes}-minute focus session. The party takes a long rest.`)
          if (get().party.length) {
            get().restParty('the end of a focus session')
            get().grantPartyXp(FOCUS_XP, 'focus session')
          }
          notify('Focus session complete! Long rest taken.', 'reward')
        },

        addDm: (role, content) =>
          set((s) => ({ dm: [...s.dm, { id: uid('m'), role, content, at: Date.now() }].slice(-MAX_DM) })),
        clearDm: () => set({ dm: [] }),

        setPortrait: (characterId, dataUrl) =>
          set((s) => ({ party: s.party.map((c) => (c.id === characterId ? { ...c, portrait: dataUrl } : c)) })),

        setNpcArt: (npcId, dataUrl) =>
          set((s) => {
            const npcArt = { ...s.npcArt }
            if (dataUrl) npcArt[npcId] = dataUrl
            else delete npcArt[npcId]
            return { npcArt }
          }),

        exportSave: () => JSON.stringify({ game: 'nova-quest', savedAt: new Date().toISOString(), data: pickData(get()) }, null, 2),

        importSave: (json) => {
          const parsed = JSON.parse(json) as { game?: string; data?: Partial<GameData> }
          const data = parsed?.data
          if (parsed?.game !== 'nova-quest' || !data || !Array.isArray(data.party)) {
            throw new Error("That file doesn't look like a Nova Quest save.")
          }
          set({ ...freshData(), ...data, version: 1 })
          notify('Save loaded!', 'reward')
        },
      }
    },
    {
      name: 'nova-quest-save',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickData(s),
    },
  ),
)
