import { useCallback, useEffect, useRef } from 'react'
import { sfx } from '../audio'
import { PartyPanel } from '../components/PartyPanel'
import { Portrait } from '../components/Portrait'
import { Sprite } from '../components/Sprite'
import { CLASSES } from '../content/classes'
import { LANDMARKS, MAP_H, MAP_W, TILES, tileAt, WORLD, zoneAt } from '../content/map'
import { ZONES } from '../content/monsters'
import { leadOf } from '../game/party'
import { useGame, type MoveResult } from '../store/game'

const TILE_CLASS: Record<string, string> = {
  '^': 't-mountain',
  T: 't-tree',
  '~': 't-water',
  '.': 't-grass',
  ',': 't-tall',
  '=': 't-road',
  '#': 't-bridge',
  '%': 't-swamp',
  I: 't-grass',
  H: 't-road',
  M: 't-swamp',
  D: 't-grass',
  S: 't-grass',
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
}

function feedback(r: MoveResult) {
  if (r === 'blocked') sfx('bump')
  else if (r === 'battle') sfx('encounter')
  else if (r === 'scene' || r === 'crystal') sfx('confirm')
}

export function Overworld() {
  const pos = useGame((s) => s.pos)
  const facing = useGame((s) => s.facing)
  const party = useGame((s) => s.party)
  const flags = useGame((s) => s.flags)
  const move = useGame((s) => s.move)
  const interact = useGame((s) => s.interact)
  const last = useRef(0)

  const step = useCallback(
    (dx: number, dy: number) => {
      const now = performance.now()
      if (now - last.current < 110) return
      last.current = now
      feedback(move(dx, dy))
    },
    [move],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
      if (dir) {
        e.preventDefault()
        step(dir[0], dir[1])
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        feedback(interact())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, interact])

  const lead = leadOf(party)
  const here = tileAt(pos.x, pos.y)
  const landmark = LANDMARKS[here]
  const zone = ZONES[zoneAt(pos.x, pos.y)]
  const objective = flags['ledger-returned']
    ? 'Chapter complete! Explore freely, grind levels, and clear real quests.'
    : flags['has-ledger']
      ? 'Return the Great Ledger to Mira at the Sleepy Wyvern Inn.'
      : flags['met-mira']
        ? 'Find the Goblin Warren in the north-east and recover the Ledger.'
        : 'Visit the Sleepy Wyvern Inn.'

  return (
    <div className="world-screen">
      <div className="map-frame window">
        <div className="map" style={{ gridTemplateColumns: `repeat(${MAP_W}, 1fr)`, aspectRatio: `${MAP_W} / ${MAP_H}` }}>
          {WORLD.flatMap((row, y) =>
            [...row].map((ch, x) => (
              <div key={`${x},${y}`} className={`tile ${TILE_CLASS[ch] ?? 't-grass'}`}>
                {LANDMARKS[ch] && <Sprite id={LANDMARKS[ch].sprite} size={64} className="tile-sprite" title={LANDMARKS[ch].label} />}
              </div>
            )),
          )}
          {lead && (
            <div
              className={`player facing-${facing}`}
              style={{ left: `${(pos.x / MAP_W) * 100}%`, top: `${(pos.y / MAP_H) * 100}%`, width: `${100 / MAP_W}%`, height: `${100 / MAP_H}%` }}
            >
              <Portrait image={lead.portrait} sprite={CLASSES[lead.classId].sprite} size={64} flip={facing === 'left'} alt={lead.name} className="player-sprite" />
            </div>
          )}
        </div>
      </div>

      <aside className="world-side col">
        <div className="window col">
          <div className="row between">
            <h3>{landmark?.label ?? TILES[here]?.name}</h3>
            <span className="muted">{zone.name}</span>
          </div>
          <p className="objective">{objective}</p>
          {landmark && (
            <button className="btn primary" onClick={() => feedback(interact())}>
              {landmark.sceneId ? `Enter ${landmark.label}` : 'Touch the crystal (rest)'}
            </button>
          )}
          <div className="dpad" aria-label="Movement controls">
            <span />
            <button className="btn small" onClick={() => step(0, -1)} aria-label="Up">
              ^
            </button>
            <span />
            <button className="btn small" onClick={() => step(-1, 0)} aria-label="Left">
              &lt;
            </button>
            <button className="btn small" onClick={() => feedback(interact())} aria-label="Interact">
              A
            </button>
            <button className="btn small" onClick={() => step(1, 0)} aria-label="Right">
              &gt;
            </button>
            <span />
            <button className="btn small" onClick={() => step(0, 1)} aria-label="Down">
              v
            </button>
            <span />
          </div>
        </div>
        <div className="window">
          <PartyPanel />
        </div>
      </aside>
    </div>
  )
}
