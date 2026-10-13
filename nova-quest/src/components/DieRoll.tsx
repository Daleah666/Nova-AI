import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio'

interface Props {
  /** Final face to land on. Give the component a new `key` to roll again. */
  value: number
  sides?: number
  size?: number
  onDone?: () => void
}

const SHAPES: Record<number, string> = {
  4: '50,6 95,90 5,90',
  6: '10,10 90,10 90,90 10,90',
  8: '50,4 95,50 50,96 5,50',
  10: '50,4 94,40 78,94 22,94 6,40',
  12: '50,4 92,30 92,70 50,96 8,70 8,30',
  20: '50,3 93,27 93,73 50,97 7,73 7,27',
}

export function DieRoll({ value, sides = 20, size = 96, onDone }: Props) {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * sides))
  const [rolling, setRolling] = useState(true)
  const latest = useRef({ value, onDone })

  useEffect(() => {
    latest.current = { value, onDone }
  })

  useEffect(() => {
    sfx('dice')
    let ticks = 0
    const id = window.setInterval(() => {
      ticks++
      if (ticks < 12) {
        setFace(1 + Math.floor(Math.random() * sides))
        return
      }
      window.clearInterval(id)
      setFace(latest.current.value)
      setRolling(false)
      latest.current.onDone?.()
    }, 55)
    return () => window.clearInterval(id)
  }, [sides])

  const shape = SHAPES[sides] ?? SHAPES[20]
  const crit = !rolling && sides === 20 && value === 20
  const fumble = !rolling && sides === 20 && value === 1
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`die ${rolling ? 'die-rolling' : 'die-landed'} ${crit ? 'die-crit' : ''} ${fumble ? 'die-fumble' : ''}`}
      role="img"
      aria-label={rolling ? 'rolling' : `rolled ${value}`}
    >
      <polygon points={shape} className="die-body" />
      {sides === 20 && <polygon points="50,24 76,66 24,66" className="die-facet" />}
      <text x="50" y={sides === 4 ? 72 : 58} textAnchor="middle" className="die-text">
        {face}
      </text>
    </svg>
  )
}
