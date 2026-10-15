export const TILE = 32;
export const COLS = 20;
export const ROWS = 15;

export const SPAWN = { x: 3, y: 7 };

/** Boss warden sprite stands on tiles (18, 5), (18, 6), and (18, 7). */
export const BOSS_SPRITE = { x: 18 * TILE + TILE / 2, y: 8 * TILE - 2, height: 86 };

export type Tile =
  | "ground"
  | "tree"
  | "building"
  | "fountain"
  | "path"
  | "tallGrass"
  | "boss";

function blank(): Tile[][] {
  return Array.from({ length: ROWS }, () => Array<Tile>(COLS).fill("ground"));
}

function buildMap(): Tile[][] {
  const tiles = blank();
  for (let x = 0; x < COLS; x += 1) {
    tiles[0][x] = "tree";
    tiles[ROWS - 1][x] = "tree";
  }
  for (let y = 0; y < ROWS; y += 1) {
    tiles[y][0] = "tree";
    tiles[y][COLS - 1] = "tree";
  }

  fillRect(tiles, 1, 1, 3, 3, "building");
  fillRect(tiles, 5, 1, 2, 3, "building");
  fillRect(tiles, 2, 9, 3, 3, "building");

  tiles[5][4] = "fountain";

  for (let y = 2; y <= 12; y += 1) {
    tiles[y][9] = "path";
    tiles[y][10] = "path";
  }
  for (let x = 4; x <= 10; x += 1) {
    tiles[7][x] = "path";
  }

  for (let y = 2; y <= 12; y += 1) {
    for (let x = 11; x <= 17; x += 1) {
      if (tiles[y][x] === "ground") tiles[y][x] = "tallGrass";
    }
  }

  tiles[12][1] = "tree";
  tiles[12][2] = "tree";
  tiles[13][1] = "tree";

  tiles[5][18] = "boss";
  tiles[6][18] = "boss";
  tiles[7][18] = "boss";
  return tiles;
}

function fillRect(
  tiles: Tile[][],
  x: number,
  y: number,
  w: number,
  h: number,
  tile: Tile,
): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) tiles[yy][xx] = tile;
  }
}

export const MAP: Tile[][] = buildMap();

export function tileAt(x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return MAP[y][x];
}

export function isWalkable(tile: Tile | null): tile is "ground" | "path" | "tallGrass" | "fountain" {
  return tile === "ground" || tile === "path" || tile === "tallGrass" || tile === "fountain";
}

function assertMap(): void {
  if (MAP.length !== ROWS || MAP.some((row) => row.length !== COLS)) {
    throw new Error("Mossring map must be 20 by 15");
  }
  const spawn = tileAt(SPAWN.x, SPAWN.y);
  if (spawn !== "ground") throw new Error("Spawn must be open town ground");
  if (tileAt(4, 5) !== "fountain") throw new Error("Fountain missing");

  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[SPAWN.x, SPAWN.y]];
  let grass = false;
  let fountain = false;
  let bossTouch = false;
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = tileAt(x, y);
    if (tile === "tallGrass") grass = true;
    if (tile === "fountain") fountain = true;
    const steps: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      const neighbor = tileAt(nx, ny);
      if (neighbor === "boss") bossTouch = true;
      if (isWalkable(neighbor)) queue.push([nx, ny]);
    }
  }
  if (!grass || !fountain || !bossTouch) {
    throw new Error("Map must reach the fountain, tall grass, and boss warden");
  }
}

assertMap();
