import { useEffect, useState } from 'react'
import { sfx } from '../audio'
import { useGame } from '../store/game'
import { useFocus } from '../store/focus'
import { useSettings } from '../store/settings'

/** Mounted once (inside the desk) so phases complete even while the panel is closed. */
export function useFocusTicker() {
  const completeFocusSession = useGame((s) => s.completeFocusSession)
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = useFocus.getState()
      if (!f.endsAt || f.endsAt > Date.now()) return
      if (f.mode === 'focus') {
        sfx('levelup')
        completeFocusSession(Math.max(1, Math.round(f.length / 60_000)))
        f.start('break', useSettings.getState().breakMinutes)
      } else {
        sfx('confirm')
        useGame.getState().notify('Break over. Ready for another quest?', 'info')
        f.reset()
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [completeFocusSession])
}

export function useClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])
  return now
}
