import type { ClassId } from '../engine/types'

export type ArtStyle = 'illustrated' | 'pixel'

export type ArtRef =
  | { kind: 'hero'; id: string; classId: ClassId; legacy?: string }
  | { kind: 'class'; id: ClassId }
  | { kind: 'npc'; id: string }
  | { kind: 'monster'; id: string }

export const artKey = (ref: ArtRef) => `${ref.kind}:${ref.id}`

export const heroRef = (c: { id: string; classId: ClassId; portrait?: string }): ArtRef => ({
  kind: 'hero',
  id: c.id,
  classId: c.classId,
  legacy: c.portrait,
})

/**
 * Picks the image for a character: your uploads always win, then the bundled illustration
 * (unless the pixel style is chosen). `undefined` means "draw the pixel sprite".
 */
export function resolveArt(
  ref: ArtRef,
  custom: Record<string, string>,
  style: ArtStyle,
  bundled: Record<string, string>,
): string | undefined {
  const fallback = (key: string) => custom[key] ?? (style === 'illustrated' ? bundled[key] : undefined)
  if (ref.kind === 'hero') return custom[artKey(ref)] ?? ref.legacy ?? fallback(`class:${ref.classId}`)
  return fallback(artKey(ref))
}
