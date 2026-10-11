import { describe, expect, it } from 'vitest'
import { findTile, isPassable, LANDMARKS, MAP_W, START_POS, TILES, WORLD } from './map'

describe('world map', () => {
  it('is rectangular and uses only known tiles', () => {
    for (const row of WORLD) {
      expect(row.length).toBe(MAP_W)
      for (const ch of row) expect(TILES[ch], `unknown tile "${ch}"`).toBeDefined()
    }
  })

  it('can reach every landmark from the start', () => {
    const seen = new Set<string>([`${START_POS.x},${START_POS.y}`])
    const queue = [START_POS]
    while (queue.length) {
      const { x, y } = queue.shift()!
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        const key = `${nx},${ny}`
        if (!seen.has(key) && isPassable(nx, ny)) {
          seen.add(key)
          queue.push({ x: nx, y: ny })
        }
      }
    }
    for (const ch of Object.keys(LANDMARKS)) {
      const pos = findTile(ch)
      expect(pos, ch).not.toBeNull()
      expect(seen.has(`${pos!.x},${pos!.y}`), `landmark ${ch} unreachable`).toBe(true)
    }
  })
})
