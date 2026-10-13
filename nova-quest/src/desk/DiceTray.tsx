import { useState } from 'react'
import { DieRoll } from '../components/DieRoll'
import { formatRoll, roll, type RollMode, type RollResult } from '../engine/dice'
import { useGame } from '../store/game'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', '2d6', '4d6kh3', '1d20+5']

interface Entry {
  id: number
  result: RollResult
}

export function DiceTray() {
  const log = useGame((s) => s.log)
  const [notation, setNotation] = useState('1d20')
  const [mode, setMode] = useState<RollMode>('normal')
  const [critical, setCritical] = useState(false)
  const [history, setHistory] = useState<Entry[]>([])
  const [error, setError] = useState('')

  const doRoll = (n = notation) => {
    try {
      const result = roll(n, { mode, critical })
      setHistory((h) => [{ id: Date.now() + Math.random(), result }, ...h].slice(0, 12))
      log('roll', `Dice tray: ${formatRoll(result)}`)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const latest = history[0]?.result
  const single = latest && latest.dice.length === 1 && latest.dice[0].kept.length === 1
  const sides = latest?.dice[0]?.term.sides ?? 20

  return (
    <div className="col">
      <p className="muted">
        Real dice with standard notation: <code>3d6+5</code>, <code>4d6kh3</code>, <code>2d20kl1</code>. Advantage and
        disadvantage apply to a single d20. Critical doubles the dice, never the modifiers.
      </p>
      <div className="row">
        <input
          className="input grow"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doRoll()}
          aria-label="Dice notation"
        />
        <button className="btn primary" onClick={() => doRoll()}>
          Roll
        </button>
      </div>
      {error && <span className="danger-text">{error}</span>}
      <div className="chips">
        {QUICK.map((q) => (
          <button
            key={q}
            className="chip chip-btn"
            onClick={() => {
              setNotation(q)
              doRoll(q)
            }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="row wrap">
        {(['normal', 'advantage', 'disadvantage'] as RollMode[]).map((m) => (
          <button key={m} className={`btn small ${mode === m ? 'primary' : ''}`} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
        <label className="row">
          <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
          critical hit
        </label>
      </div>

      {latest && (
        <div className="dice-result">
          {single ? (
            <DieRoll key={history[0].id} value={latest.dice[0].kept[0]} sides={sides} size={110} />
          ) : (
            <div key={history[0].id} className="dice-total pixel die-landed">
              {latest.total}
            </div>
          )}
          <div className="col tight">
            <span className="pixel">{latest.total}</span>
            <span className="muted">{formatRoll(latest)}</span>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <ul className="roll-history">
          {history.slice(1).map((h) => (
            <li key={h.id} className="muted">
              {formatRoll(h.result)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
