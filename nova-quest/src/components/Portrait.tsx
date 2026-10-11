import { Sprite } from './Sprite'

interface Props {
  image?: string
  sprite: string
  size?: number
  className?: string
  flip?: boolean
  alt: string
}

/** Shows uploaded art when available, otherwise the built-in pixel sprite. */
export function Portrait({ image, sprite, size = 64, className = '', flip, alt }: Props) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt}
        width={size}
        height={size}
        className={`portrait-img ${className}`}
        style={{ width: size, height: size, transform: flip ? 'scaleX(-1)' : undefined }}
      />
    )
  }
  return <Sprite id={sprite} size={size} className={className} flip={flip} title={alt} />
}
