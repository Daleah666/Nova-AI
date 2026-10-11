import { del, get, set as idbSet } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useGame } from './game'

interface ArtStore {
  /** Custom images by art key (`hero:<id>`, `class:<id>`, `npc:<id>`, `monster:<id>`). */
  art: Record<string, string>
  /** Pre-background-removal versions, so "Restore original" works. */
  original: Record<string, string>
  hydrated: boolean
  setArt: (key: string, url: string, original?: string) => void
  removeArt: (key: string) => void
  restoreOriginal: (key: string) => void
  mergeArt: (art: Record<string, string>) => void
  clearArt: (filter?: (key: string) => boolean) => void
}

const omit = (rec: Record<string, string>, key: string) => {
  const out = { ...rec }
  delete out[key]
  return out
}

/** IndexedDB holds hundreds of MB, unlike localStorage's ~5 MB, so big PNG collections fit. */
const idbStorage = createJSONStorage(() => ({
  getItem: async (k: string) => (await get<string>(k)) ?? null,
  setItem: (k: string, v: string) => idbSet(k, v),
  removeItem: (k: string) => del(k),
}))

export const useArt = create<ArtStore>()(
  persist(
    (set) => ({
      art: {},
      original: {},
      hydrated: false,
      setArt: (key, url, original) =>
        set((s) => ({ art: { ...s.art, [key]: url }, original: original ? { ...s.original, [key]: original } : omit(s.original, key) })),
      removeArt: (key) => set((s) => ({ art: omit(s.art, key), original: omit(s.original, key) })),
      restoreOriginal: (key) =>
        set((s) => (s.original[key] ? { art: { ...s.art, [key]: s.original[key] }, original: omit(s.original, key) } : s)),
      mergeArt: (art) => set((s) => ({ art: { ...s.art, ...art } })),
      clearArt: (filter) =>
        set((s) => {
          if (!filter) return { art: {}, original: {} }
          const keep = (rec: Record<string, string>) => Object.fromEntries(Object.entries(rec).filter(([k]) => !filter(k)))
          return { art: keep(s.art), original: keep(s.original) }
        }),
    }),
    {
      name: 'nova-quest-art',
      storage: idbStorage,
      partialize: (s) => ({ art: s.art, original: s.original }),
      onRehydrateStorage: () => () => {
        useArt.setState({ hydrated: true })
        migrateLegacyArt()
      },
    },
  ),
)

/** Moves portraits that older versions kept inside the localStorage save into the art library. */
export function migrateLegacyArt() {
  const g = useGame.getState()
  const moved: Record<string, string> = {}
  for (const [id, url] of Object.entries(g.npcArt ?? {})) moved[`npc:${id}`] = url
  for (const c of g.party) if (c.portrait) moved[`hero:${c.id}`] = c.portrait
  if (!Object.keys(moved).length) return
  const existing = useArt.getState().art
  useArt.getState().mergeArt(Object.fromEntries(Object.entries(moved).filter(([k]) => !existing[k])))
  useGame.setState({ npcArt: {}, party: g.party.map((c) => ({ ...c, portrait: undefined })) })
}

const isImageUrl = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image/')

/** Adds the custom art library to an exported save so a backup carries the user's images too. */
export function withArtLibrary(saveJson: string): string {
  const art = useArt.getState().art
  if (!Object.keys(art).length) return saveJson
  return JSON.stringify({ ...JSON.parse(saveJson), art }, null, 2)
}

/** Restores art from an imported save: the `art` library plus portraits embedded by older versions. */
export function importArtLibrary(saveJson: string) {
  const raw = (JSON.parse(saveJson) as { art?: unknown }).art
  if (raw && typeof raw === 'object') {
    useArt.getState().mergeArt(Object.fromEntries(Object.entries(raw).filter(([k, v]) => /^(hero|class|npc|monster):/.test(k) && isImageUrl(v))))
  }
  migrateLegacyArt()
}

export const clearHeroArt = () => useArt.getState().clearArt((k) => k.startsWith('hero:'))
