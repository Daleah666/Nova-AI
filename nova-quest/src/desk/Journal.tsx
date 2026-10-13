import { useState } from 'react'
import { useGame, type JournalKind } from '../store/game'

const FILTERS: (JournalKind | 'all')[] = ['all', 'story', 'battle', 'roll', 'oracle', 'quest', 'focus', 'level', 'dm']

export function Journal() {
  const journal = useGame((s) => s.journal)
  const log = useGame((s) => s.log)
  const [filter, setFilter] = useState<JournalKind | 'all'>('all')
  const [note, setNote] = useState('')

  const entries = [...journal].reverse().filter((e) => filter === 'all' || e.kind === filter)

  return (
    <div className="col">
      <p className="muted">Everything that happens is written down, so neither you nor the DM forgets the cobbler.</p>
      <div className="row">
        <input
          className="input grow"
          placeholder="Add a note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && note.trim()) {
              log('story', note.trim())
              setNote('')
            }
          }}
          aria-label="Journal note"
        />
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip chip-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {entries.length === 0 && <p className="muted">Nothing here yet.</p>}
      <ul className="journal-list">
        {entries.slice(0, 150).map((e) => (
          <li key={e.id} className={`journal-entry j-${e.kind}`}>
            <span className="j-meta pixel tiny">
              {e.kind} {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
