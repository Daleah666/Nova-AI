import { useArt } from '../store/art'
import { useSettings } from '../store/settings'
import { BUNDLED_ART } from './bundled'
import { resolveArt, type ArtRef } from './resolve'

export function useArtSrc(art: ArtRef | undefined, customOnly = false) {
  const custom = useArt((s) => s.art)
  const style = useSettings((s) => s.artStyle)
  return art ? resolveArt(art, custom, customOnly ? 'pixel' : style, BUNDLED_ART) : undefined
}
