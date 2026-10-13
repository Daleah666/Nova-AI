import { useEffect, useRef } from 'react'
import { sfx } from '../audio'
import { useGame } from '../store/game'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const dismiss = useGame((s) => s.dismissToast)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    for (const t of toasts) {
      if (seen.current.has(t.id)) continue
      seen.current.add(t.id)
      if (t.kind === 'level') sfx('levelup')
    }
  }, [toasts])

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast window toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  )
}
