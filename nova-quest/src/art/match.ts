export interface ArtTarget {
  key: string
  label: string
  group: 'Party' | 'Hero classes' | 'Characters' | 'Monsters'
  /** Names a file may use for this target, e.g. id, display name, nickname. */
  names: string[]
}

/** "Old_Bram-happy (2).PNG" -> "old bram happy 2" */
export function normalizeName(s: string): string {
  return s
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Finds the best target for an image. Character-card names are trusted first; otherwise any whole-word
 * name in the filename counts, so Ren'Py-style names like "mira happy.png" or "ch_goblin_02.png" work.
 * Longer (more specific) names win.
 */
export function matchTarget(filename: string, cardName: string | undefined, targets: ArtTarget[]): ArtTarget | undefined {
  const sources = [cardName ? normalizeName(cardName) : '', normalizeName(filename)].filter(Boolean)
  for (const src of sources) {
    const padded = ` ${src} `
    let best: { t: ArtTarget; score: number } | undefined
    for (const t of targets) {
      for (const raw of t.names) {
        const n = normalizeName(raw)
        if (!n) continue
        const score = src === n ? 1000 + n.length : padded.includes(` ${n} `) ? n.length : 0
        if (score && (!best || score > best.score)) best = { t, score }
      }
    }
    if (best) return best.t
  }
  return undefined
}
