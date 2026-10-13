import { useState } from 'react'
import { sfx } from '../audio'
import { askOracle, LIKELIHOODS, type Likelihood, type OracleResult } from '../engine/oracle'
import { useGame } from '../store/game'

const PROMPTS = [
  'Is there a goblin hiding behind that boulder?',
  'Is the hooded figure friendly?',
  'Will I finish this task before lunch?',
  'Does the shopkeeper have what we need?',
]

export function OraclePanel() {
  const log = useGame((s) => s.log)
  const [question, setQuestion] = useState('')
  const [likelihood, setLikelihood] = useState<Likelihood>('even')
  const [results, setResults] = useState<(OracleResult & { id: number })[]>([])

  const ask = () => {
    const q = question.trim() || PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
    const r = askOracle(q, likelihood)
    sfx(r.yes ? 'heal' : 'miss')
    setResults((rs) => [{ ...r, id: Date.now() }, ...rs].slice(0, 10))
    log('oracle', `Oracle: "${q}" (${LIKELIHOODS.find((l) => l.id === likelihood)?.label}) -> ${r.answer}${r.twist ? ` Twist: ${r.twist}` : ''}`)
    setQuestion('')
  }

  const latest = results[0]

  return (
    <div className="col">
      <p className="muted">
        Ask a yes/no question when you don't want to decide yourself. Pick how likely it is; the oracle rolls a d100
        and stays honest. Works for dungeons and for life.
      </p>
      <input
        className="input"
        placeholder={PROMPTS[0]}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ask()}
        aria-label="Oracle question"
      />
      <div className="row wrap">
        {LIKELIHOODS.map((l) => (
          <button key={l.id} className={`btn small ${likelihood === l.id ? 'primary' : ''}`} onClick={() => setLikelihood(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={ask}>
        Ask the oracle
      </button>

      {latest && (
        <div key={latest.id} className={`oracle-answer ${latest.yes ? 'yes' : 'no'}`}>
          <div className="muted">"{latest.question}"</div>
          <div className="oracle-big pixel">{latest.answer}</div>
          <div className="muted">
            d100 rolled {latest.roll} vs {latest.threshold}
          </div>
          {latest.twist && <div className="oracle-twist">Twist! {latest.twist}</div>}
        </div>
      )}

      {results.length > 1 && (
        <ul className="roll-history">
          {results.slice(1).map((r) => (
            <li key={r.id} className="muted">
              {r.question} <b>{r.answer}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
