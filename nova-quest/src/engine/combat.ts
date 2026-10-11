import { formatRoll, roll, withMod, type RollMode } from './dice'
import { abilityCheck, attackRoll, rollInitiative, type Ability } from './rules'
import { defaultRng, pick, type Rng } from './rng'
import type { ItemDef, MonsterDef, SkillDef } from './types'

export type Side = 'party' | 'enemy'

export interface Combatant {
  id: string
  /** Character id for party members, monster id for enemies. */
  refId: string
  name: string
  side: Side
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  ac: number
  /** Proficiency for party members; full attack bonus for monsters (their mods are folded in). */
  prof: number
  attackBonus: number
  damage: string
  attackName: string
  dexMod: number
  mods: Partial<Record<Ability, number>>
  skills: string[]
  defending: boolean
  initiative: number
  sprite: string
  portrait?: string
  reward?: { xp: number; gold: string; drops?: { itemId: string; chance: number }[] }
}

export type BattleAction =
  | { type: 'attack'; actorId: string; targetId: string }
  | { type: 'skill'; actorId: string; skillId: string; targetId?: string }
  | { type: 'item'; actorId: string; itemId: string; targetId: string }
  | { type: 'defend'; actorId: string }
  | { type: 'flee'; actorId: string }

export type BattleEventKind = 'info' | 'damage' | 'miss' | 'heal' | 'mp' | 'defend' | 'down' | 'revive' | 'flee'

export interface BattleEvent {
  id: number
  /** Sequence number of the action that produced this event (0 = battle start). */
  action: number
  kind: BattleEventKind
  text: string
  actorId?: string
  targetId?: string
  amount?: number
  crit?: boolean
  fumble?: boolean
  detail?: string
}

export interface BattleRewards {
  xp: number
  gold: number
  items: Record<string, number>
}

export type BattleStatus = 'active' | 'victory' | 'defeat' | 'fled'

export interface BattleState {
  combatants: Combatant[]
  order: string[]
  turn: number
  round: number
  log: BattleEvent[]
  status: BattleStatus
  inventory: Record<string, number>
  rewards: BattleRewards | null
  canFlee: boolean
  /** First-round attack mode for the party (e.g. an ambush grants advantage). */
  partyMode: RollMode
  nextEventId: number
  actionSeq: number
}

export interface CombatDefs {
  skills: Record<string, SkillDef>
  items: Record<string, ItemDef>
}

export const FLEE_DC = 12

export function monsterToCombatant(m: MonsterDef, index: number, rng: Rng = defaultRng): Combatant {
  const hp = Math.max(1, roll(m.hp, { rng }).total)
  return {
    id: `enemy-${index}-${m.id}`,
    refId: m.id,
    name: m.name,
    side: 'enemy',
    hp,
    maxHp: hp,
    mp: m.mp,
    maxMp: m.mp,
    ac: m.ac,
    prof: m.attackBonus,
    attackBonus: m.attackBonus,
    damage: m.damage,
    attackName: m.attackName,
    dexMod: m.dexMod,
    mods: {},
    skills: m.skills,
    defending: false,
    initiative: 0,
    sprite: m.sprite,
    reward: { xp: m.xp, gold: m.gold, drops: m.drops },
  }
}

/** Gives duplicate enemy names a letter suffix: Goblin A, Goblin B. */
export function labelDuplicates(enemies: Combatant[]): Combatant[] {
  const counts: Record<string, number> = {}
  for (const e of enemies) counts[e.name] = (counts[e.name] ?? 0) + 1
  const seen: Record<string, number> = {}
  return enemies.map((e) => {
    if (counts[e.name] < 2) return e
    const n = seen[e.name] ?? 0
    seen[e.name] = n + 1
    return { ...e, name: `${e.name} ${String.fromCharCode(65 + n)}` }
  })
}

export function startBattle(
  party: Combatant[],
  enemies: Combatant[],
  opts: { inventory?: Record<string, number>; canFlee?: boolean; partyMode?: RollMode; rng?: Rng } = {},
): BattleState {
  const rng = opts.rng ?? defaultRng
  const combatants = [...party, ...labelDuplicates(enemies)].map((c) => ({
    ...c,
    defending: false,
    initiative: c.hp > 0 ? rollInitiative(c.dexMod, rng) : -99,
  }))
  const order = [...combatants]
    .sort((a, b) => b.initiative - a.initiative || b.dexMod - a.dexMod || (a.side === 'party' ? -1 : 1))
    .map((c) => c.id)

  let state: BattleState = {
    combatants,
    order,
    turn: 0,
    round: 1,
    log: [],
    status: 'active',
    inventory: { ...(opts.inventory ?? {}) },
    rewards: null,
    canFlee: opts.canFlee ?? true,
    partyMode: opts.partyMode ?? 'normal',
    nextEventId: 1,
    actionSeq: 0,
  }
  const names = enemies.length === 1 ? enemies[0].name : `${enemies.length} foes`
  state = pushEvent(state, { kind: 'info', text: `${names} appear! Roll for initiative!` })
  const first = state.combatants.find((c) => c.id === order[0])
  if (first && first.hp <= 0) state = advanceTurn(state)
  return state
}

export function getCombatant(state: BattleState, id: string | undefined): Combatant | undefined {
  return state.combatants.find((c) => c.id === id)
}

export function currentActor(state: BattleState): Combatant | undefined {
  return getCombatant(state, state.order[state.turn])
}

export function isPartyTurn(state: BattleState): boolean {
  return state.status === 'active' && currentActor(state)?.side === 'party'
}

export function alive(state: BattleState, side: Side): Combatant[] {
  return state.combatants.filter((c) => c.side === side && c.hp > 0)
}

function pushEvent(state: BattleState, e: Omit<BattleEvent, 'id' | 'action'>): BattleState {
  return {
    ...state,
    log: [...state.log, { ...e, id: state.nextEventId, action: state.actionSeq }],
    nextEventId: state.nextEventId + 1,
  }
}

function updateCombatant(state: BattleState, id: string, patch: Partial<Combatant>): BattleState {
  return { ...state, combatants: state.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
}

function dealDamage(
  state: BattleState,
  actor: Combatant,
  targetId: string,
  raw: number,
  extra: { crit?: boolean; detail?: string; verb: string },
): BattleState {
  const target = getCombatant(state, targetId)
  if (!target) return state
  const amount = Math.max(1, target.defending ? Math.ceil(raw / 2) : raw)
  const hp = Math.max(0, target.hp - amount)
  let s = updateCombatant(state, targetId, { hp })
  s = pushEvent(s, {
    kind: 'damage',
    actorId: actor.id,
    targetId,
    amount,
    crit: extra.crit,
    detail: extra.detail,
    text: `${actor.name} ${extra.verb} ${target.name} for ${amount}${extra.crit ? ' (CRITICAL!)' : ''}${target.defending ? ' (guarded)' : ''}.`,
  })
  if (hp === 0) s = pushEvent(s, { kind: 'down', targetId, text: `${target.name} is defeated!` })
  return s
}

function heal(state: BattleState, actor: Combatant, targetId: string, raw: number, detail?: string): BattleState {
  const target = getCombatant(state, targetId)
  if (!target || target.hp <= 0) return state
  const amount = Math.min(target.maxHp - target.hp, Math.max(1, raw))
  const s = updateCombatant(state, targetId, { hp: target.hp + amount })
  return pushEvent(s, {
    kind: 'heal',
    actorId: actor.id,
    targetId,
    amount,
    detail,
    text: `${target.name} recovers ${amount} HP.`,
  })
}

function attackMode(state: BattleState, actor: Combatant): RollMode {
  return actor.side === 'party' && state.round === 1 ? state.partyMode : 'normal'
}

function resolveAttack(
  state: BattleState,
  actor: Combatant,
  targetId: string,
  bonus: number,
  damageDice: string,
  verb: string,
  rng: Rng,
): BattleState {
  const target = getCombatant(state, targetId)
  if (!target || target.hp <= 0) return state
  const atk = attackRoll(bonus, target.ac, { mode: attackMode(state, actor), rng })
  if (!atk.hit) {
    return pushEvent(state, {
      kind: 'miss',
      actorId: actor.id,
      targetId,
      fumble: atk.fumble,
      detail: formatRoll(atk.roll),
      text: atk.fumble
        ? `${actor.name} fumbles! (natural 1)`
        : `${actor.name} misses ${target.name}. (${atk.total} vs AC ${target.ac})`,
    })
  }
  const dmg = roll(damageDice, { critical: atk.crit, rng })
  return dealDamage(state, actor, targetId, dmg.total, {
    crit: atk.crit,
    verb,
    detail: `${formatRoll(atk.roll)} | ${formatRoll(dmg)}`,
  })
}

function targetsFor(state: BattleState, actor: Combatant, skill: SkillDef, targetId?: string): string[] {
  const foes: Side = actor.side === 'party' ? 'enemy' : 'party'
  switch (skill.target) {
    case 'self':
      return [actor.id]
    case 'all-enemies':
      return alive(state, foes).map((c) => c.id)
    case 'all-allies':
      return alive(state, actor.side).map((c) => c.id)
    default:
      return targetId ? [targetId] : []
  }
}

function castSkill(state: BattleState, actor: Combatant, skill: SkillDef, targetId: string | undefined, rng: Rng) {
  if (actor.mp < skill.mpCost) {
    return pushEvent(state, { kind: 'info', text: `${actor.name} doesn't have enough MP for ${skill.name}.` })
  }
  let s = updateCombatant(state, actor.id, { mp: actor.mp - skill.mpCost })
  s = pushEvent(s, { kind: 'info', actorId: actor.id, text: `${actor.name} uses ${skill.name}!` })
  const mod = skill.ability ? (actor.mods[skill.ability] ?? 0) : 0
  const dice = withMod(skill.dice, mod)
  const targets = targetsFor(s, actor, skill, targetId)

  if (skill.effect === 'heal') {
    const r = roll(dice, { rng })
    for (const t of targets) s = heal(s, actor, t, r.total, formatRoll(r))
    return s
  }

  if (skill.attack) {
    for (const t of targets) s = resolveAttack(s, actor, t, actor.prof + mod, dice, 'blasts', rng)
    return s
  }
  const r = roll(dice, { rng })
  for (const t of targets) s = dealDamage(s, actor, t, r.total, { verb: 'hits', detail: formatRoll(r) })
  return s
}

function applyItem(state: BattleState, actor: Combatant, item: ItemDef, targetId: string, rng: Rng): BattleState {
  const have = state.inventory[item.id] ?? 0
  if (have <= 0) return pushEvent(state, { kind: 'info', text: `No ${item.name} left!` })
  let s: BattleState = { ...state, inventory: { ...state.inventory, [item.id]: have - 1 } }
  s = pushEvent(s, { kind: 'info', actorId: actor.id, text: `${actor.name} uses a ${item.name}.` })
  const target = getCombatant(s, targetId)
  if (!target) return s
  const r = roll(item.dice, { rng })
  switch (item.effect) {
    case 'heal':
      return heal(s, actor, targetId, r.total, formatRoll(r))
    case 'mp': {
      const amount = Math.min(target.maxMp - target.mp, r.total)
      s = updateCombatant(s, targetId, { mp: target.mp + amount })
      return pushEvent(s, { kind: 'mp', targetId, amount, text: `${target.name} recovers ${amount} MP.` })
    }
    case 'revive': {
      if (target.hp > 0) return pushEvent(s, { kind: 'info', text: `${target.name} is already standing.` })
      const hp = Math.max(1, Math.floor(target.maxHp / 4))
      s = updateCombatant(s, targetId, { hp })
      return pushEvent(s, { kind: 'revive', targetId, amount: hp, text: `${target.name} is revived with ${hp} HP!` })
    }
    case 'damage':
      return dealDamage(s, actor, targetId, r.total, { verb: 'scorches', detail: formatRoll(r) })
  }
}

function computeRewards(state: BattleState, rng: Rng): BattleRewards {
  const rewards: BattleRewards = { xp: 0, gold: 0, items: {} }
  for (const e of state.combatants) {
    if (e.side !== 'enemy' || !e.reward) continue
    rewards.xp += e.reward.xp
    rewards.gold += Math.max(0, roll(e.reward.gold, { rng }).total)
    for (const d of e.reward.drops ?? []) {
      if (rng() < d.chance) rewards.items[d.itemId] = (rewards.items[d.itemId] ?? 0) + 1
    }
  }
  return rewards
}

function checkEnd(state: BattleState, rng: Rng): BattleState {
  if (state.status !== 'active') return state
  if (alive(state, 'enemy').length === 0) {
    const rewards = computeRewards(state, rng)
    const s = { ...state, status: 'victory' as const, rewards }
    return pushEvent(s, { kind: 'info', text: `Victory! Gained ${rewards.xp} XP and ${rewards.gold} gold.` })
  }
  if (alive(state, 'party').length === 0) {
    return pushEvent({ ...state, status: 'defeat' }, { kind: 'info', text: 'The party has fallen...' })
  }
  return state
}

function advanceTurn(state: BattleState): BattleState {
  if (state.status !== 'active') return state
  let { turn, round } = state
  for (let i = 0; i < state.order.length; i++) {
    turn += 1
    if (turn >= state.order.length) {
      turn = 0
      round += 1
    }
    const c = getCombatant(state, state.order[turn])
    if (c && c.hp > 0) {
      const s = { ...state, turn, round }
      return c.defending ? updateCombatant(s, c.id, { defending: false }) : s
    }
  }
  return state
}

export function applyAction(state: BattleState, action: BattleAction, defs: CombatDefs, rng: Rng = defaultRng) {
  if (state.status !== 'active') return state
  const actor = currentActor(state)
  if (!actor || actor.id !== action.actorId || actor.hp <= 0) return state

  let s: BattleState = { ...state, actionSeq: state.actionSeq + 1 }
  switch (action.type) {
    case 'attack':
      s = resolveAttack(s, actor, action.targetId, actor.attackBonus, actor.damage, actor.side === 'party' ? 'strikes' : 'hits', rng)
      break
    case 'skill': {
      const skill = defs.skills[action.skillId]
      if (!skill) return state
      s = castSkill(s, actor, skill, action.targetId, rng)
      break
    }
    case 'item': {
      const item = defs.items[action.itemId]
      if (!item) return state
      s = applyItem(s, actor, item, action.targetId, rng)
      break
    }
    case 'defend':
      s = updateCombatant(s, actor.id, { defending: true })
      s = pushEvent(s, { kind: 'defend', actorId: actor.id, text: `${actor.name} takes a defensive stance.` })
      break
    case 'flee': {
      if (!s.canFlee) {
        s = pushEvent(s, { kind: 'info', text: `There's no escape from this fight!` })
        break
      }
      const check = abilityCheck(actor.dexMod, FLEE_DC, { rng })
      if (check.success) {
        s = pushEvent({ ...s, status: 'fled' }, {
          kind: 'flee',
          actorId: actor.id,
          detail: formatRoll(check.roll),
          text: `The party escapes! (${check.total} vs DC ${FLEE_DC})`,
        })
        return s
      }
      s = pushEvent(s, {
        kind: 'info',
        actorId: actor.id,
        detail: formatRoll(check.roll),
        text: `Couldn't get away! (${check.total} vs DC ${FLEE_DC})`,
      })
      break
    }
  }
  return advanceTurn(checkEnd(s, rng))
}

/** Simple enemy AI: heal a hurt ally, sometimes use a skill, otherwise attack (favoring weak targets). */
export function chooseEnemyAction(state: BattleState, defs: CombatDefs, rng: Rng = defaultRng): BattleAction | null {
  const actor = currentActor(state)
  if (!actor || actor.side !== 'enemy') return null
  const targets = alive(state, 'party')
  if (targets.length === 0) return null

  const usable = actor.skills.map((id) => defs.skills[id]).filter((sk): sk is SkillDef => !!sk && sk.mpCost <= actor.mp)
  const healSkill = usable.find((sk) => sk.effect === 'heal')
  const hurt = alive(state, 'enemy').find((c) => c.hp / c.maxHp < 0.4)
  if (healSkill && hurt) return { type: 'skill', actorId: actor.id, skillId: healSkill.id, targetId: hurt.id }

  const attackSkills = usable.filter((sk) => sk.effect === 'damage')
  const target =
    rng() < 0.5 ? targets.reduce((low, c) => (c.hp < low.hp ? c : low), targets[0]) : pick(targets, rng)
  if (attackSkills.length && rng() < 0.35) {
    return { type: 'skill', actorId: actor.id, skillId: pick(attackSkills, rng).id, targetId: target.id }
  }
  return { type: 'attack', actorId: actor.id, targetId: target.id }
}
