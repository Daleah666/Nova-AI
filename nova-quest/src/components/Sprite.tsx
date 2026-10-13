import { memo } from 'react'
import { SPRITES } from '../content/sprites'

interface Props {
  id: string
  size?: number
  className?: string
  flip?: boolean
  title?: string
}

export const Sprite = memo(function Sprite({ id, size = 48, className = '', flip, title }: Props) {
  const sprite = SPRITES[id]
  if (!sprite) return null
  const h = sprite.rows.length
  const w = Math.max(...sprite.rows.map((r) => r.length))
  const side = Math.max(w, h)
  const ox = (side - w) / 2
  const oy = side - h
  const rects = []
  for (let y = 0; y < h; y++) {
    const row = sprite.rows[y]
    for (let x = 0; x < row.length; x++) {
      const color = sprite.palette[row[x]]
      if (color) rects.push(<rect key={`${x},${y}`} x={x + ox} y={y + oy} width={1.02} height={1.02} fill={color} />)
    }
  }
  return (
    <svg
      className={`sprite ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      role="img"
      aria-label={title ?? id}
    >
      {rects}
    </svg>
  )
})
