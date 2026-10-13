import { cardFromJson, readCharacterCard, type CharacterCard } from './card'
import { inspectBorder, opaqueBounds, removeBackground, shouldAutoRemove } from './removeBg'

export const MAX_ART_SIDE = 900

export interface ProcessedArt {
  /** Display image (background removed when that was applied). */
  url: string
  /** Untouched (resized) image, kept only when the background was removed so it can be restored. */
  original?: string
  card: CharacterCard | null
  backgroundRemoved: boolean
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load that image.'))
    }
    img.src = url
  })
}

/** WebP keeps transparency at a fraction of PNG's size; browsers that can't encode it get PNG. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.88)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('Canvas unavailable.')
  return { c, g }
}

/** Downscale, read any embedded character card, and strip flat backgrounds. */
export async function processArtFile(file: File, opts: { removeBg?: 'auto' | 'never' } = {}): Promise<ProcessedArt> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} isn't an image.`)
  const card = file.type === 'image/png' ? readCharacterCard(new Uint8Array(await file.arrayBuffer())) : null
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_ART_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const { c, g } = canvasOf(w, h)
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)

  const pixels = g.getImageData(0, 0, w, h)
  if (opts.removeBg !== 'never' && shouldAutoRemove(inspectBorder(pixels.data, w, h))) {
    const original = encode(c)
    return { url: cutOut(pixels), original, card, backgroundRemoved: true }
  }
  return { url: encode(c), card, backgroundRemoved: false }
}

/** Removes the background from an existing data URL (the "Remove background" button). */
export async function removeBackgroundFromUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  const img = await loadImage(blob)
  const { g } = canvasOf(img.naturalWidth, img.naturalHeight)
  g.drawImage(img, 0, 0)
  return cutOut(g.getImageData(0, 0, img.naturalWidth, img.naturalHeight))
}

function cutOut(pixels: ImageData): string {
  removeBackground(pixels.data, pixels.width, pixels.height)
  const b = opaqueBounds(pixels.data, pixels.width, pixels.height) ?? { x: 0, y: 0, w: pixels.width, h: pixels.height }
  const full = canvasOf(pixels.width, pixels.height)
  full.g.putImageData(pixels, 0, 0)
  const out = canvasOf(b.w, b.h)
  out.g.drawImage(full.c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  return encode(out.c)
}

/** Character-card JSON exports that sit next to their PNGs ("Nyx-character-card.json"). */
export async function readCardJson(file: File): Promise<CharacterCard | null> {
  try {
    return cardFromJson(JSON.parse(await file.text()))
  } catch {
    return null
  }
}
