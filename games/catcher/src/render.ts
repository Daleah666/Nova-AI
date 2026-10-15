import { BOSS_SPRITE, COLS, MAP, ROWS, TILE, type Tile } from "./map";
import { drawCreature, drawWarden } from "./sprites";
import type { SpeciesId } from "./types";

type Rect = { x: number; y: number; w: number; h: number };

const HOUSES = findBuildings();

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  time: number,
  playerX: number,
  playerY: number,
): void {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) drawGround(ctx, x, y, MAP[y][x]);
  }
  for (const house of HOUSES) drawHouse(ctx, house);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = MAP[y][x];
      if (tile === "tree") drawTree(ctx, x, y);
      if (tile === "fountain") drawFountain(ctx, x, y, time);
      if (tile === "tallGrass") drawTallGrass(ctx, x, y, time);
    }
  }
  const bob = Math.sin(time / 240) * 1.1;
  drawWarden(ctx, BOSS_SPRITE.x, BOSS_SPRITE.y, BOSS_SPRITE.height, "boss");
  drawWarden(ctx, (playerX + 0.5) * TILE, (playerY + 1) * TILE - 2 + bob, 30, "player");
  if (MAP[playerY]?.[playerX] === "tallGrass") {
    drawFrontGrass(ctx, playerX, playerY, time);
  }
}

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  time: number,
  leadId: SpeciesId,
  foeId: SpeciesId,
  width: number,
  height: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#173024");
  sky.addColorStop(0.42, "#4d7c49");
  sky.addColorStop(0.72, "#6e9a52");
  sky.addColorStop(1, "#c6a36c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 7; i += 1) {
    const tx = 30 + i * 96;
    const th = 70 + (i % 3) * 18;
    drawCanopy(ctx, tx, height * 0.48, th, i);
  }
  ctx.fillStyle = "#b99262";
  ctx.beginPath();
  ctx.ellipse(width / 2, height - 28, width * 0.46, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a37d4e";
  ctx.beginPath();
  ctx.ellipse(width / 2, height - 24, width * 0.34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(time / 280) * 4;
  const ground = height - 34;
  const foeHeight = foeId === "graven" ? 188 : 148;
  drawCreature(ctx, foeId, width * 0.72, ground + bob, foeHeight);
  drawCreature(ctx, leadId, width * 0.28, ground + 8 - bob, 124);
}

export function drawTitleScene(ctx: CanvasRenderingContext2D, time: number, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#234232");
  sky.addColorStop(1, "#d7b56d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  drawCanopy(ctx, 70, height * 0.7, 90, 1);
  drawCanopy(ctx, width - 70, height * 0.68, 100, 2);
  ctx.fillStyle = "#7eae5c";
  ctx.fillRect(0, height * 0.72, width, height);
  const bob = Math.sin(time / 260) * 3;
  drawCreature(ctx, "pipkin", width * 0.5, height * 0.86 + bob, 110);
}

export function drawVictoryScene(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  drawCreature(ctx, "graven", width / 2, height - 6, height - 16);
}

function drawGround(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile): void {
  const px = x * TILE;
  const py = y * TILE;
  const n = hash(x, y);
  let color = n > 0.5 ? "#7eae5c" : "#74a454";
  if (tile === "path") color = n > 0.55 ? "#d7b37a" : "#c9a56c";
  if (tile === "tallGrass") color = n > 0.5 ? "#3f7a3a" : "#356b34";
  if (tile === "tree") color = "#1d3824";
  if (tile === "building") color = "#6a5138";
  if (tile === "boss") color = "#cbb892";
  if (tile === "fountain") color = "#74a454";
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE, TILE);
  if (tile === "path" && n > 0.72) {
    ctx.fillStyle = "rgba(90, 60, 30, 0.28)";
    ctx.fillRect(px + 8 + n * 10, py + 12, 4, 3);
  }
  if (tile === "ground" && n > 0.9) {
    ctx.fillStyle = n > 0.95 ? "#f2e2a8" : "#d8e4f2";
    ctx.beginPath();
    ctx.arc(px + 16, py + 18, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tile === "boss") {
    ctx.strokeStyle = "#8d7b58";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 16, py + 18, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, house: Rect): void {
  const px = house.x * TILE;
  const py = house.y * TILE;
  const pw = house.w * TILE;
  const ph = house.h * TILE;
  ctx.fillStyle = "rgba(30, 20, 10, 0.2)";
  ctx.fillRect(px + 6, py + ph * 0.4, pw, ph * 0.55);
  ctx.fillStyle = "#8a4036";
  ctx.beginPath();
  ctx.moveTo(px - 6, py + ph * 0.42);
  ctx.lineTo(px + pw / 2, py - 8);
  ctx.lineTo(px + pw + 6, py + ph * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a85a48";
  ctx.beginPath();
  ctx.moveTo(px + pw / 2, py - 4);
  ctx.lineTo(px + pw / 2 + 8, py + 8);
  ctx.lineTo(px + pw / 2 - 8, py + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f0ddb8";
  ctx.fillRect(px + 3, py + ph * 0.36, pw - 6, ph * 0.6);
  ctx.strokeStyle = "#6b4a32";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 3.5, py + ph * 0.36, pw - 7, ph * 0.6);
  const doorX = px + pw / 2 - 6;
  ctx.fillStyle = "#5a3328";
  ctx.fillRect(doorX, py + ph * 0.62, 12, ph * 0.34);
  ctx.fillStyle = "#9ec7c2";
  const winY = py + ph * 0.48;
  ctx.fillRect(px + 8, winY, 8, 8);
  if (house.w >= 3) ctx.fillRect(px + pw - 16, winY, 8, 8);
  if (house.w >= 3) {
    ctx.fillStyle = "#6e5140";
    ctx.fillRect(px + pw - 14, py + 4, 6, 12);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE + 16;
  const py = y * TILE + 16;
  const n = hash(x, y);
  ctx.fillStyle = "#5c4030";
  ctx.fillRect(px - 3, py + 2, 6, 12);
  drawCanopy(ctx, px, py + 2, 16 + n * 4, x + y);
}

function drawCanopy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, salt: number): void {
  const shift = hash(salt, 2);
  ctx.fillStyle = "#245233";
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y + 1, r * 0.68, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.45, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shift > 0.5 ? "#3f7a48" : "#32663c";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.2, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
}

function drawFountain(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const cx = x * TILE + 16;
  const cy = y * TILE + 18;
  ctx.fillStyle = "#b7c4ae";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6eb0aa";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const jet = 5 + Math.sin(time / 180) * 2;
  ctx.fillStyle = "#dff6f8";
  ctx.fillRect(cx - 1, cy - jet - 2, 2, jet);
  for (let i = 0; i < 3; i += 1) {
    const phase = (time / 700 + i / 3) % 1;
    ctx.globalAlpha = 1 - phase;
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * 3, cy - 4 - phase * 12, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTallGrass(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const px = x * TILE;
  const py = y * TILE;
  for (let i = 0; i < 6; i += 1) {
    const n = hash(x + i, y);
    const bx = px + 4 + n * 24;
    const sway = Math.sin(time / 280 + x * 0.8 + i) * 2.2;
    ctx.strokeStyle = n > 0.45 ? "#9ed56a" : "#214f28";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, py + 30);
    ctx.quadraticCurveTo(bx + sway, py + 16, bx + sway * 1.3, py + 6 + n * 6);
    ctx.stroke();
  }
}

function drawFrontGrass(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.strokeStyle = "#24562c";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const sway = Math.sin(time / 260 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 8 + i * 8, py + 31);
    ctx.quadraticCurveTo(px + 8 + i * 8 + sway, py + 24, px + 6 + i * 8, py + 20);
    ctx.stroke();
  }
}

function findBuildings(): Rect[] {
  const seen: boolean[][] = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  const rects: Rect[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (MAP[y][x] !== "building" || seen[y][x]) continue;
      let w = 0;
      while (x + w < COLS && MAP[y][x + w] === "building") w += 1;
      let h = 1;
      for (;;) {
        if (y + h >= ROWS) break;
        let full = true;
        for (let i = 0; i < w; i += 1) {
          if (MAP[y + h][x + i] !== "building") full = false;
        }
        if (!full) break;
        h += 1;
      }
      for (let yy = y; yy < y + h; yy += 1) {
        for (let xx = x; xx < x + w; xx += 1) seen[yy][xx] = true;
      }
      rects.push({ x, y, w, h });
    }
  }
  return rects;
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
