import type { ZoneId } from './monsters'

/**
 * Legend: ^ mountain, T tree, ~ water (all impassable); . grass, , tall grass, = road,
 * # bridge, % swamp. Landmarks: I inn, H market, M mire shrine, D goblin warren, S save crystal.
 */
export const WORLD: string[] = [
  '^^^^^^^^^^^^^^^^^^^^^^^^',
  '^TTTT......,,,,...^^^D^^',
  '^TT....,,,,,,,....^^.=.^',
  '^T..H==========...TT.=T^',
  '^T..=.....,,,,=,,,..==T^',
  '^...=..TT.,,,,=,,,,.=TT^',
  '^...=..TT.....=.....=.T^',
  '^~~~#~~~~~~~~~#~~~~~#~~^',
  '^...=.........=....%%%%^',
  '^.I.=..,,,....=...%%%%%^',
  '^.S==.,,,,,...=..%%M%%%^',
  '^...=..,,,....====%%%%%^',
  '^TT.=..........TT.%%%%T^',
  '^TTT=====....TTTT..%%TT^',
  '^TTTTTTT.......TTTTTTTT^',
  '^^^^^^^^^^^^^^^^^^^^^^^^',
]

export const MAP_W = WORLD[0].length
export const MAP_H = WORLD.length

export interface TileInfo {
  name: string
  passable: boolean
  /** Chance of a random encounter per step. */
  encounter: number
}

export const TILES: Record<string, TileInfo> = {
  '^': { name: 'Mountains', passable: false, encounter: 0 },
  T: { name: 'Forest', passable: false, encounter: 0 },
  '~': { name: 'River', passable: false, encounter: 0 },
  '.': { name: 'Grassland', passable: true, encounter: 0.07 },
  ',': { name: 'Tall Grass', passable: true, encounter: 0.16 },
  '=': { name: 'Road', passable: true, encounter: 0.02 },
  '#': { name: 'Bridge', passable: true, encounter: 0 },
  '%': { name: 'Swamp', passable: true, encounter: 0.14 },
  I: { name: 'Sleepy Wyvern Inn', passable: true, encounter: 0 },
  H: { name: 'Oakhollow Market', passable: true, encounter: 0 },
  M: { name: 'Mire Shrine', passable: true, encounter: 0 },
  D: { name: 'Goblin Warren', passable: true, encounter: 0 },
  S: { name: 'Save Crystal', passable: true, encounter: 0 },
}

export interface Landmark {
  sceneId?: string
  sprite: string
  label: string
}

export const LANDMARKS: Record<string, Landmark> = {
  I: { sceneId: 'tavern', sprite: 'inn', label: 'Sleepy Wyvern Inn' },
  H: { sceneId: 'market', sprite: 'house', label: 'Oakhollow Market' },
  M: { sceneId: 'mire', sprite: 'shrine', label: 'Mire Shrine' },
  D: { sceneId: 'warren', sprite: 'cave', label: 'Goblin Warren' },
  S: { sprite: 'crystal', label: 'Save Crystal' },
}

export const START_POS = { x: 3, y: 9 }
export const RESPAWN_POS = { x: 3, y: 9 }

export function tileAt(x: number, y: number): string {
  return WORLD[y]?.[x] ?? '^'
}

export function isPassable(x: number, y: number): boolean {
  return TILES[tileAt(x, y)]?.passable ?? false
}

export function zoneAt(x: number, y: number): ZoneId {
  if (x >= 16 && y >= 8) return 'mire'
  if (y <= 6 && x >= 12) return 'highlands'
  return 'meadow'
}

export function findTile(ch: string): { x: number; y: number } | null {
  for (let y = 0; y < MAP_H; y++) {
    const x = WORLD[y].indexOf(ch)
    if (x >= 0) return { x, y }
  }
  return null
}
