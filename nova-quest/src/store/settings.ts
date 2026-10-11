import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Settings {
  aiBaseUrl: string
  aiKey: string
  aiModel: string
  ambient: boolean
  volume: number
  sfx: boolean
  /** Characters per second for the visual-novel typewriter. */
  textSpeed: number
  focusMinutes: number
  breakMinutes: number
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void
}

/** Kept apart from the game save so exported saves never contain the API key. */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      aiBaseUrl: 'https://api.openai.com/v1',
      aiKey: '',
      aiModel: 'gpt-4o-mini',
      ambient: false,
      volume: 0.5,
      sfx: true,
      textSpeed: 45,
      focusMinutes: 25,
      breakMinutes: 5,
      update: (patch) => set(patch),
    }),
    { name: 'nova-quest-settings' },
  ),
)

export type DeskTab = 'quests' | 'focus' | 'dice' | 'oracle' | 'journal' | 'dm' | 'art' | 'settings'

interface UiStore {
  deskOpen: boolean
  deskTab: DeskTab
  openDesk: (tab?: DeskTab) => void
  toggleDesk: () => void
}

export const useUi = create<UiStore>()((set) => ({
  deskOpen: false,
  deskTab: 'quests',
  openDesk: (tab) => set((s) => ({ deskOpen: true, deskTab: tab ?? s.deskTab })),
  toggleDesk: () => set((s) => ({ deskOpen: !s.deskOpen })),
}))
