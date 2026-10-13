import { useEffect, useMemo, useRef, useState } from 'react'
import { heroRef, type ArtRef } from '../art/resolve'
import { sfx } from '../audio'
import { Bar } from '../components/Bar'
import { Portrait } from '../components/Portrait'
import { SKILLS } from '../content/classes'
import { ITEMS } from '../content/items'
import { currentActor, isPartyTurn, type BattleAction, type Combatant } from '../engine/combat'
import type { Character, ItemDef, SkillDef } from '../engine/types'
import { useGame } from '../store/game'

type TargetKind = 'enemy' | 'ally' | 'ally-down'
type Menu =
  | { mode: 'root' }
  | { mode: 'skill' }
  | { mode: 'item' }
  | { mode: 'target'; kind: TargetKind; label: string; build: (targetId: string) => BattleAction }

const POPUP_KINDS = new Set(['damage', 'heal', 'miss', 'revive', 'mp'])

function combatantArt(c: Combatant, party: Character[]): ArtRef {
  const hero = c.side === 'party' ? party.find((p) => p.id === c.refId) : undefined
  return hero ? heroRef(hero) : { kind: 'monster', id: c.refId }
}

export function BattleScreen() {
  const battle = useGame((s) => s.battle)
  const heroes = useGame((s) => s.party)
  const battleAction = useGame((s) => s.battleAction)
  const enemyStep = useGame((s) => s.enemyStep)
  const finishBattle = useGame((s) => s.finishBattle)
  const [menu, setMenu] = useState<Menu>({ mode: 'root' })
  const seen = useRef(0)

  const actor = battle ? currentActor(battle) : undefined
  const partyTurn = battle ? isPartyTurn(battle) : false

  useEffect(() => {
    if (!battle || battle.status !== 'active' || partyTurn) return
    const id = window.setTimeout(enemyStep, 850)
    return () => window.clearTimeout(id)
  }, [battle, partyTurn, enemyStep])

  const turnKey = `${battle?.actionSeq ?? 0}`
  const [menuKey, setMenuKey] = useState(turnKey)
  if (menuKey !== turnKey) {
    setMenuKey(turnKey)
    setMenu({ mode: 'root' })
  }

  useEffect(() => {
    if (!battle) return
    const fresh = battle.log.filter((e) => e.id > seen.current)
    if (!fresh.length) return
    seen.current = battle.log[battle.log.length - 1].id
    if (fresh.some((e) => e.crit)) sfx('crit')
    else if (fresh.some((e) => e.kind === 'damage')) sfx('hit')
    else if (fresh.some((e) => e.kind === 'heal' || e.kind === 'revive' || e.kind === 'mp')) sfx('heal')
    else if (fresh.some((e) => e.kind === 'miss')) sfx('miss')
    if (battle.status === 'victory') setTimeout(() => sfx('victory'), 250)
    if (battle.status === 'defeat') setTimeout(() => sfx('defeat'), 250)
  }, [battle])

  const batch = useMemo(() => (battle ? battle.log.filter((e) => e.action === battle.actionSeq && e.action > 0) : []), [battle])

  if (!battle) return null

  const enemies = battle.combatants.filter((c) => c.side === 'enemy')
  const party = battle.combatants.filter((c) => c.side === 'party')
  const critFlash = batch.find((e) => e.crit)
  const hitIds = new Set(batch.filter((e) => e.kind === 'damage').map((e) => e.targetId))
  const hitKey = `hit-${battle.actionSeq}`

  const act = (action: BattleAction) => {
    sfx('confirm')
    battleAction(action)
  }

  const targetable = (c: Combatant): boolean => {
    if (menu.mode !== 'target' || !partyTurn) return false
    if (menu.kind === 'enemy') return c.side === 'enemy' && c.hp > 0
    if (menu.kind === 'ally') return c.side === 'party' && c.hp > 0
    return c.side === 'party' && c.hp <= 0
  }

  const onPick = (c: Combatant) => {
    if (menu.mode === 'target' && targetable(c)) act(menu.build(c.id))
  }

  const chooseSkill = (sk: SkillDef) => {
    if (!actor) return
    if (sk.target === 'enemy') {
      sfx('select')
      setMenu({ mode: 'target', kind: 'enemy', label: sk.name, build: (t) => ({ type: 'skill', actorId: actor.id, skillId: sk.id, targetId: t }) })
    } else if (sk.target === 'ally') {
      sfx('select')
      setMenu({ mode: 'target', kind: 'ally', label: sk.name, build: (t) => ({ type: 'skill', actorId: actor.id, skillId: sk.id, targetId: t }) })
    } else {
      act({ type: 'skill', actorId: actor.id, skillId: sk.id })
    }
  }

  const chooseItem = (it: ItemDef) => {
    if (!actor) return
    sfx('select')
    const kind: TargetKind = it.target === 'enemy' ? 'enemy' : it.target === 'ally-down' ? 'ally-down' : 'ally'
    setMenu({ mode: 'target', kind, label: it.name, build: (t) => ({ type: 'item', actorId: actor.id, itemId: it.id, targetId: t }) })
  }

  const items = Object.entries(battle.inventory)
    .filter(([id, n]) => n > 0 && ITEMS[id])
    .map(([id, n]) => ({ item: ITEMS[id], n }))

  const popupsFor = (id: string) =>
    batch
      .filter((e) => e.targetId === id && POPUP_KINDS.has(e.kind))
      .map((e) => (
        <span key={e.id} className={`popup popup-${e.kind} ${e.crit ? 'popup-crit' : ''}`}>
          {e.kind === 'miss' ? 'MISS' : e.kind === 'damage' ? `-${e.amount}` : `+${e.amount}`}
        </span>
      ))

  return (
    <div className={`battle-screen ${battle.combatants.some((c) => c.side === 'enemy' && c.refId === 'wyrmling') ? 'bg-lair' : 'bg-field'}`}>
      {critFlash && <div key={critFlash.id} className="crit-flash" />}
      <div className="battle-intro" />

      <div className="initiative-strip">
        <span className="pixel tiny muted">Round {battle.round}</span>
        {battle.order.map((id, i) => {
          const c = battle.combatants.find((x) => x.id === id)!
          return (
            <div key={id} className={`init-chip ${i === battle.turn ? 'current' : ''} ${c.hp <= 0 ? 'down' : ''} ${c.side}`} title={`${c.name} (initiative ${c.initiative})`}>
              <Portrait art={combatantArt(c, heroes)} sprite={c.sprite} size={28} alt={c.name} flip={c.side === 'enemy'} />
            </div>
          )
        })}
      </div>

      <div className="enemy-row">
        {enemies.map((e) => (
          <button
            key={e.id}
            className={`enemy ${e.hp <= 0 ? 'down' : ''} ${targetable(e) ? 'targetable' : ''} ${actor?.id === e.id ? 'acting' : ''}`}
            onClick={() => onPick(e)}
            disabled={!targetable(e)}
          >
            <div key={hitIds.has(e.id) ? hitKey : 'idle'} className={`enemy-sprite ${hitIds.has(e.id) ? 'shake' : ''}`}>
              <Portrait art={combatantArt(e, heroes)} variant="full" sprite={e.sprite} size={e.refId === 'wyrmling' ? 220 : 150} alt={e.name} />
            </div>
            <div className="popups">{popupsFor(e.id)}</div>
            <div className="enemy-info">
              <span className="pixel tiny">{e.name}</span>
              <Bar kind="hp" value={e.hp} max={e.maxHp} label={false} />
            </div>
          </button>
        ))}
      </div>

      <div className="battle-log window">
        {battle.log.slice(-4).map((e) => (
          <div key={e.id} className={`log-line log-${e.kind}`} title={e.detail}>
            {e.text}
            {e.detail && <span className="log-detail"> {e.detail}</span>}
          </div>
        ))}
      </div>

      <div className="battle-bottom">
        <div className="command window">
          {battle.status !== 'active' ? null : !partyTurn || !actor ? (
            <div className="pixel tiny muted">{actor?.name} is acting...</div>
          ) : menu.mode === 'root' ? (
            <div className="col">
              <div className="pixel tiny gold">{actor.name}'s turn</div>
              <button className="btn" autoFocus onClick={() => setMenu({ mode: 'target', kind: 'enemy', label: 'Attack', build: (t) => ({ type: 'attack', actorId: actor.id, targetId: t }) })}>
                Attack ({actor.attackName})
              </button>
              <button className="btn" onClick={() => setMenu({ mode: 'skill' })} disabled={!actor.skills.length}>
                Skills
              </button>
              <button className="btn" onClick={() => setMenu({ mode: 'item' })} disabled={!items.length}>
                Items
              </button>
              <button className="btn" onClick={() => act({ type: 'defend', actorId: actor.id })}>
                Defend
              </button>
              <button className="btn" onClick={() => act({ type: 'flee', actorId: actor.id })} disabled={!battle.canFlee}>
                Flee
              </button>
            </div>
          ) : menu.mode === 'skill' ? (
            <div className="col">
              {actor.skills.map((id) => SKILLS[id]).map((sk) => (
                <button key={sk.id} className="btn" disabled={actor.mp < sk.mpCost} onClick={() => chooseSkill(sk)} title={sk.description}>
                  {sk.name} <span className="mp-cost">{sk.mpCost} MP</span>
                  <span className="skill-desc">{sk.description}</span>
                </button>
              ))}
              <button className="btn ghost small" onClick={() => setMenu({ mode: 'root' })}>
                Back
              </button>
            </div>
          ) : menu.mode === 'item' ? (
            <div className="col">
              {items.map(({ item, n }) => (
                <button key={item.id} className="btn" onClick={() => chooseItem(item)} title={item.description}>
                  {item.name} x{n}
                  <span className="skill-desc">{item.description}</span>
                </button>
              ))}
              <button className="btn ghost small" onClick={() => setMenu({ mode: 'root' })}>
                Back
              </button>
            </div>
          ) : (
            <div className="col">
              <div className="pixel tiny gold">{menu.label}: choose a target</div>
              {battle.combatants.filter(targetable).map((c) => (
                <button key={c.id} className="btn" onClick={() => onPick(c)}>
                  {c.name} ({c.hp}/{c.maxHp})
                </button>
              ))}
              <button className="btn ghost small" onClick={() => setMenu({ mode: 'root' })}>
                Back
              </button>
            </div>
          )}
        </div>

        <div className="party-status">
          {party.map((c) => (
            <button
              key={c.id}
              className={`status-card window ${actor?.id === c.id ? 'active' : ''} ${c.hp <= 0 ? 'down' : ''} ${targetable(c) ? 'targetable' : ''}`}
              onClick={() => onPick(c)}
              disabled={!targetable(c)}
            >
              <div key={hitIds.has(c.id) ? hitKey : 'idle'} className={hitIds.has(c.id) ? 'shake' : ''}>
                <Portrait art={combatantArt(c, heroes)} sprite={c.sprite} size={56} alt={c.name} />
              </div>
              <div className="popups">{popupsFor(c.id)}</div>
              <div className="col tight grow">
                <span className="pixel tiny">
                  {c.name}
                  {c.defending && <span className="guard-tag"> GUARD</span>}
                </span>
                <Bar kind="hp" value={c.hp} max={c.maxHp} />
                <Bar kind="mp" value={c.mp} max={c.maxMp} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {battle.status !== 'active' && (
        <div className="check-overlay">
          <div className="window result-window col">
            {battle.status === 'victory' && battle.rewards && (
              <>
                <h1 className="gold center">VICTORY!</h1>
                <p className="center">
                  +{battle.rewards.xp} XP for each hero | +{battle.rewards.gold} gold
                </p>
                {Object.keys(battle.rewards.items).length > 0 && (
                  <p className="center">
                    Loot:{' '}
                    {Object.entries(battle.rewards.items)
                      .map(([id, n]) => `${n}x ${ITEMS[id]?.name ?? id}`)
                      .join(', ')}
                  </p>
                )}
              </>
            )}
            {battle.status === 'defeat' && (
              <>
                <h1 className="danger-text center">DEFEAT</h1>
                <p className="center">The party collapses... and wakes up at the Sleepy Wyvern, a little poorer.</p>
              </>
            )}
            {battle.status === 'fled' && (
              <>
                <h1 className="center">ESCAPED</h1>
                <p className="center">You live to fight another day.</p>
              </>
            )}
            <button className="btn primary" autoFocus onClick={() => { sfx('confirm'); finishBattle() }}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
