import { useState } from 'react'
import { sfx } from '../audio'
import { QUEST_REWARDS, useGame, type Difficulty } from '../store/game'

const DIFFS = Object.keys(QUEST_REWARDS) as Difficulty[]

export function QuestBoard() {
  const quests = useGame((s) => s.quests)
  const partySize = useGame((s) => s.party.length)
  const addQuest = useGame((s) => s.addQuest)
  const completeQuest = useGame((s) => s.completeQuest)
  const deleteQuest = useGame((s) => s.deleteQuest)
  const clearDone = useGame((s) => s.clearDoneQuests)
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const open = quests.filter((q) => !q.done)
  const done = quests.filter((q) => q.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const submit = () => {
    if (!title.trim()) return
    sfx('confirm')
    addQuest(title, difficulty)
    setTitle('')
  }

  return (
    <div className="col">
      <p className="muted">
        Turn real tasks into quests. Finishing one pays out XP and gold to your party.
        {partySize === 0 && ' (Create a party to collect XP. Gold is banked either way.)'}
      </p>
      <div className="row">
        <input
          className="input grow"
          placeholder="e.g. Reply to the invoice email"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="New quest"
        />
      </div>
      <div className="row wrap">
        {DIFFS.map((d) => (
          <button key={d} className={`btn small ${d === difficulty ? 'primary' : ''}`} onClick={() => setDifficulty(d)}>
            {QUEST_REWARDS[d].label} ({QUEST_REWARDS[d].xp}xp)
          </button>
        ))}
        <button className="btn small" onClick={submit} disabled={!title.trim()}>
          Post quest
        </button>
      </div>

      <h3>Open quests ({open.length})</h3>
      {open.length === 0 && <p className="muted">The board is empty. Suspiciously peaceful.</p>}
      <ul className="quest-list">
        {open.map((q) => (
          <li key={q.id} className={`quest diff-${q.difficulty}`}>
            <button
              className="quest-check"
              aria-label={`Complete ${q.title}`}
              onClick={() => {
                sfx('heal')
                completeQuest(q.id)
              }}
            />
            <span className="grow">{q.title}</span>
            <span className="pixel tiny reward">
              {QUEST_REWARDS[q.difficulty].xp}xp / {QUEST_REWARDS[q.difficulty].gold}g
            </span>
            <button className="icon-btn" onClick={() => deleteQuest(q.id)} aria-label={`Delete ${q.title}`}>
              x
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <div className="row between">
            <h3>Completed ({done.length})</h3>
            <button className="btn small ghost" onClick={clearDone}>
              Clear
            </button>
          </div>
          <ul className="quest-list">
            {done.slice(0, 12).map((q) => (
              <li key={q.id} className="quest done">
                <span className="quest-check checked" />
                <span className="grow">{q.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
