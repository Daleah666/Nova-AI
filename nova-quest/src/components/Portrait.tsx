import type { ArtRef } from '../art/resolve'
import { useArtSrc } from '../art/useArtSrc'
import { Sprite } from './Sprite'

interface Props {
  /** Which character to draw; resolved to uploaded art, bundled art, or the pixel sprite. */
  art?: ArtRef
  /** Explicit image that overrides `art` (e.g. an unsaved upload preview). */
  image?: string
  sprite: string
  size?: number
  /** `bust` crops to a square around the face; `full` shows the whole figure at `size` px tall. */
  variant?: 'bust' | 'full'
  /** Ignore bundled illustrations and only show the user's own uploads. */
  customOnly?: boolean
  className?: string
  flip?: boolean
  alt: string
}

export function Portrait({ art, image, sprite, size = 64, variant = 'bust', customOnly, className = '', flip, alt }: Props) {
  const resolved = useArtSrc(art, customOnly)
  const src = image ?? resolved
  if (!src) return <Sprite id={sprite} size={size} className={className} flip={flip} title={alt} />
  const transform = flip ? 'scaleX(-1)' : undefined
  if (variant === 'full') {
    return <img src={src} alt={alt} draggable={false} className={`art-full ${className}`} style={{ height: size, transform }} />
  }
  return (
    <span className={`art-bust ${art?.kind === 'monster' ? 'contain' : ''} ${className}`} style={{ width: size, height: size }}>
      <img src={src} alt={alt} draggable={false} style={{ transform }} />
    </span>
  )
}
