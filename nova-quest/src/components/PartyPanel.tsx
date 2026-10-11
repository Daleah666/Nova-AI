import { CLASSES } from '../content/classes'
import { ITEMS } from '../content/items'
import { xpProgress } from '../engine/rules'
import { statsOf } from '../game/party'
import { useGame } from '../store/game'
import { Bar } from './Bar'
import { heroRef } from '../art/resolve'
import { Portrait } from './Portrait'

export function PartyPanel({ compact = false }: { compact?: boolean }) {
  const party = useGame((s) => s.party)
  const gold = useGame((s) => s.gold)
  const inventory = useGame((s) => s.inventory)
  const items = Object.entries(inventory).filter(([, n]) => n > 0)

  return (
    <div className="col party-panel">
      {party.map((c) => {
        const s = statsOf(c)
        const xp = xpProgress(c.xp)
        return (
          <div key={c.id} className={`hero-card ${c.hp <= 0 ? 'down' : ''}`}>
            <Portrait art={heroRef(c)} sprite={CLASSES[c.classId].sprite} size={compact ? 40 : 52} alt={c.name} />
            <div className="grow col tight">
              <div className="row between">
                <span className="pixel tiny">{c.name}</span>
                <span className="muted">
                  Lv{c.level} {CLASSES[c.classId].name}
                </span>
              </div>
              <Bar kind="hp" value={c.hp} max={s.maxHp} />
              <Bar kind="mp" value={c.mp} max={s.maxMp} />
              {!compact && (
                <div title={`${xp.into}/${xp.span} XP to next level`}>
                  <Bar kind="xp" value={xp.into} max={xp.span || 1} label={false} />
                </div>
              )}
            </div>
          </div>
        )
      })}
      {!compact && (
        <div className="inventory">
          <div className="row between">
            <span className="pixel tiny">Bag</span>
            <span className="gold pixel tiny">{gold} G</span>
          </div>
          {items.length === 0 ? (
            <span className="muted">Empty.</span>
          ) : (
            <div className="chips">
              {items.map(([id, n]) => (
                <span key={id} className="chip" title={ITEMS[id]?.description}>
                  {ITEMS[id]?.name ?? id} x{n}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
