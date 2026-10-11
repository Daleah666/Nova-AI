import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FocusMode = 'idle' | 'focus' | 'break'

interface FocusStore {
  mode: FocusMode
  /** Epoch ms when the running phase ends; null when paused or idle. */
  endsAt: number | null
  /** Remaining ms while paused. */
  remaining: number
  /** Length of the current phase in ms, for progress display. */
  length: number
  start: (mode: Exclude<FocusMode, 'idle'>, minutes: number) => void
  pause: () => void
  resume: () => void
  reset: () => void
}

/** Stores an end timestamp rather than ticking state, so the timer survives reloads and closed panels. */
export const useFocus = create<FocusStore>()(
  persist(
    (set, get) => ({
      mode: 'idle',
      endsAt: null,
      remaining: 0,
      length: 0,
      start: (mode, minutes) => {
        const ms = Math.round(minutes * 60_000)
        set({ mode, endsAt: Date.now() + ms, remaining: ms, length: ms })
      },
      pause: () => {
        const { endsAt } = get()
        if (endsAt) set({ endsAt: null, remaining: Math.max(0, endsAt - Date.now()) })
      },
      resume: () => {
        const { endsAt, remaining, mode } = get()
        if (!endsAt && mode !== 'idle') set({ endsAt: Date.now() + remaining })
      },
      reset: () => set({ mode: 'idle', endsAt: null, remaining: 0, length: 0 }),
    }),
    { name: 'nova-quest-focus' },
  ),
)

export function remainingMs(s: { endsAt: number | null; remaining: number }, now = Date.now()): number {
  return s.endsAt ? Math.max(0, s.endsAt - now) : s.remaining
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
