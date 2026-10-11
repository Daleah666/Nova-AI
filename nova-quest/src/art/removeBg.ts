/**
 * Background removal for flat-background character art (generated sprites, green screens, sticker sheets).
 * Flood-fills from the image border through pixels close to the border colour, then feathers the edge
 * and un-mixes the background colour out of edge pixels.
 */

export interface BorderInfo {
  color: [number, number, number]
  /** Share of border pixels within a small distance of the median border colour. */
  uniformity: number
  /** True when the border has no transparency yet. */
  opaque: boolean
}

const dist = (d: ArrayLike<number>, i: number, c: readonly number[]) =>
  Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2])

function borderIndices(w: number, h: number): number[] {
  const out: number[] = []
  for (let x = 0; x < w; x++) out.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) out.push(y * w, y * w + w - 1)
  return out
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function inspectBorder(data: ArrayLike<number>, w: number, h: number): BorderInfo {
  const idx = borderIndices(w, h)
  const color: [number, number, number] = [0, 1, 2].map((ch) => median(idx.map((p) => data[p * 4 + ch]))) as [number, number, number]
  let close = 0
  let opaque = true
  for (const p of idx) {
    if (dist(data, p * 4, color) < 40) close++
    if (data[p * 4 + 3] < 250) opaque = false
  }
  return { color, uniformity: close / idx.length, opaque }
}

/** Auto-remove only when it's clearly a flat backdrop, so photos and painted scenes are left alone. */
export function shouldAutoRemove(info: BorderInfo): boolean {
  return info.opaque && info.uniformity >= 0.9
}

/** Mutates RGBA `data` in place. Returns the number of pixels made fully transparent. */
export function removeBackground(data: Uint8ClampedArray, w: number, h: number, tolerance = 70): number {
  const { color: bg } = inspectBorder(data, w, h)
  const hard = tolerance + 40
  const lo = tolerance * 0.55
  const hi = tolerance * 1.6
  const n = w * h
  const d = new Float32Array(n)
  for (let p = 0; p < n; p++) d[p] = dist(data, p * 4, bg)

  const bgMask = new Uint8Array(n)
  const stack: number[] = []
  for (const p of borderIndices(w, h)) {
    if (d[p] < hard && !bgMask[p]) {
      bgMask[p] = 1
      stack.push(p)
    }
  }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w
    const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]
    for (const q of neighbours) {
      if (q >= 0 && q < n && !bgMask[q] && d[q] < hard) {
        bgMask[q] = 1
        stack.push(q)
      }
    }
  }

  // Pockets of a saturated key colour (green/magenta screens) enclosed by the figure, e.g. between arm and body.
  const chroma = Math.max(...bg) - Math.min(...bg)
  if (chroma > 120) for (let p = 0; p < n; p++) if (d[p] < lo) bgMask[p] = 1

  let removed = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (bgMask[p]) {
      data[i + 3] = 0
      removed++
      continue
    }
    const x = p % w
    const nearBg =
      (x > 0 && bgMask[p - 1]) || (x < w - 1 && bgMask[p + 1]) || (p >= w && bgMask[p - w]) || (p + w < n && bgMask[p + w])
    if (!nearBg) continue
    const a = Math.min(1, Math.max(0, (d[p] - lo) / (hi - lo)))
    if (a <= 0.02) {
      data[i + 3] = 0
      removed++
      continue
    }
    for (let ch = 0; ch < 3; ch++) data[i + ch] = Math.min(255, Math.max(0, (data[i + ch] - (1 - a) * bg[ch]) / a))
    data[i + 3] = Math.round(data[i + 3] * a)
  }
  return removed
}

/** Bounding box of pixels with visible alpha, padded, or null when the image is empty. */
export function opaqueBounds(data: ArrayLike<number>, w: number, h: number, pad = 4) {
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  return { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y }
}
