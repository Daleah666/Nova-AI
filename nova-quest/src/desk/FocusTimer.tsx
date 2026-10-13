import { sfx } from '../audio'
import { FOCUS_XP, useGame } from '../store/game'
import { formatClock, remainingMs, useFocus } from '../store/focus'
import { useClock } from './focusHooks'
import { useSettings } from '../store/settings'

export function FocusBadge() {
  const f = useFocus()
  const now = useClock()
  if (f.mode === 'idle') return null
  return (
    <span className={`focus-badge pixel tiny ${f.mode}`} title={f.mode === 'focus' ? 'Focus session' : 'Break'}>
      {f.mode === 'focus' ? 'FOCUS' : 'BREAK'} {formatClock(remainingMs(f, now))}
      {!f.endsAt && ' (paused)'}
    </span>
  )
}

export function FocusTimer() {
  const f = useFocus()
  const now = useClock()
  const sessions = useGame((s) => s.focusSessions)
  const { focusMinutes, breakMinutes, update } = useSettings()
  const left = remainingMs(f, now)
  const ratio = f.length ? 1 - left / f.length : 0
  const R = 70
  const C = 2 * Math.PI * R

  return (
    <div className="col focus">
      <p className="muted">
        Work in focus sessions. Finishing one counts as a long rest (full HP and MP) and grants {FOCUS_XP} XP to every hero.
      </p>
      <div className="focus-ring">
        <svg viewBox="0 0 160 160" width={180} height={180}>
          <circle cx="80" cy="80" r={R} className="ring-bg" />
          <circle
            cx="80"
            cy="80"
            r={R}
            className={`ring-fg ${f.mode}`}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="focus-center">
          <div className="pixel tiny muted">{f.mode === 'idle' ? 'READY' : f.mode === 'focus' ? 'FOCUS' : 'BREAK'}</div>
          <div className="focus-clock pixel">{formatClock(f.mode === 'idle' ? focusMinutes * 60_000 : left)}</div>
        </div>
      </div>
      <div className="row wrap center-row">
        {f.mode === 'idle' && (
          <button
            className="btn primary"
            onClick={() => {
              sfx('confirm')
              f.start('focus', focusMinutes)
            }}
          >
            Start focus
          </button>
        )}
        {f.mode !== 'idle' && f.endsAt && (
          <button className="btn" onClick={f.pause}>
            Pause
          </button>
        )}
        {f.mode !== 'idle' && !f.endsAt && (
          <button className="btn primary" onClick={f.resume}>
            Resume
          </button>
        )}
        {f.mode !== 'idle' && (
          <button className="btn ghost" onClick={f.reset}>
            Stop
          </button>
        )}
      </div>
      <div className="row wrap">
        <label className="row">
          Focus
          <input
            className="input num"
            type="number"
            min={1}
            max={180}
            value={focusMinutes}
            onChange={(e) => update({ focusMinutes: Math.max(1, Math.min(180, Number(e.target.value) || 25)) })}
          />
          min
        </label>
        <label className="row">
          Break
          <input
            className="input num"
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) => update({ breakMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })}
          />
          min
        </label>
      </div>
      <p className="muted">Sessions completed: {sessions}</p>
    </div>
  )
}
