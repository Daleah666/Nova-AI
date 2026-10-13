import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { offlineDmReply, runDmTurn, type ChatTurn, type DmContext } from '../ai/dm'
import { sfx } from '../audio'
import { partySnapshot } from '../game/snapshot'
import { useGame } from '../store/game'
import { useSettings, useUi } from '../store/settings'

const STARTERS = [
  'Start a short side adventure near Oakhollow.',
  'We search the room. What do we find?',
  'Is there a goblin hiding behind that boulder?',
  'Sven attacks with advantage: roll 1d20+5',
]

/** Renders **bold** and line breaks without injecting HTML. */
function renderText(text: string): ReactNode {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
      )}
    </Fragment>
  ))
}

const HISTORY_TURNS = 16

export function DmChat() {
  const dm = useGame((s) => s.dm)
  const addDm = useGame((s) => s.addDm)
  const clearDm = useGame((s) => s.clearDm)
  const { aiKey, aiBaseUrl, aiModel } = useSettings()
  const openDesk = useUi((s) => s.openDesk)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const online = aiKey.trim().length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [dm.length, busy])

  useEffect(() => () => abortRef.current?.abort(), [])

  const ctx: DmContext = {
    getPartyState: () => partySnapshot(useGame.getState()),
    log: (kind, text) => useGame.getState().log(kind, text),
  }

  const send = async (text = input) => {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    setError('')
    sfx('select')
    const history: ChatTurn[] = useGame
      .getState()
      .dm.filter((m): m is typeof m & { role: ChatTurn['role'] } => m.role !== 'event')
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }))
    addDm('user', msg)

    if (!online) {
      const r = offlineDmReply(msg, ctx)
      for (const e of r.events) addDm('event', e.summary)
      addDm('assistant', r.reply)
      if (r.events.length) sfx('dice')
      return
    }

    setBusy(true)
    abortRef.current = new AbortController()
    try {
      const r = await runDmTurn([...history, { role: 'user', content: msg }], { apiKey: aiKey, baseUrl: aiBaseUrl, model: aiModel }, ctx, {
        signal: abortRef.current.signal,
      })
      for (const e of r.events) addDm('event', e.summary)
      if (r.events.length) sfx('dice')
      addDm('assistant', r.reply)
      const plain = r.reply.replace(/\*\*/g, '')
      useGame.getState().log('dm', plain.length > 160 ? `${plain.slice(0, 160)}...` : plain)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col dm-chat">
      <div className="row between">
        <span className={`pixel tiny dm-status ${online ? 'on' : 'off'}`}>{online ? `AI DM: ${aiModel}` : 'Offline DM (dice + oracle)'}</span>
        <div className="row">
          {!online && (
            <button className="btn small" onClick={() => openDesk('settings')}>
              Add API key
            </button>
          )}
          {dm.length > 0 && (
            <button className="btn small ghost" onClick={clearDm}>
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="muted">
        The DM uses real tools instead of making things up: <code>roll_dice</code>, <code>ask_oracle</code>, and{' '}
        <code>get_party_state</code>. Every roll shows up below and in your journal.
      </p>

      <div className="dm-log">
        {dm.length === 0 && (
          <div className="col">
            {STARTERS.map((s) => (
              <button key={s} className="btn small" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {dm.map((m) => (
          <div key={m.id} className={`dm-msg dm-${m.role}`}>
            {m.role === 'event' ? (
              <span>
                <span className="event-tag pixel">tool</span> {m.content}
              </span>
            ) : (
              renderText(m.content)
            )}
          </div>
        ))}
        {busy && <div className="dm-msg dm-assistant dm-typing">The DM is rolling dice and thinking...</div>}
        <div ref={endRef} />
      </div>

      {error && <div className="danger-text">{error}</div>}
      <div className="row">
        <textarea
          className="input grow dm-input"
          rows={2}
          placeholder={online ? 'What do you do?' : 'Ask a yes/no question? or "roll 2d6+1"'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          aria-label="Message the Dungeon Master"
        />
        <button className="btn primary" onClick={() => void send()} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
