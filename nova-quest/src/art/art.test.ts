import { describe, expect, it } from 'vitest'
import { cardFromJson, readCharacterCard, readPngText } from './card'
import { matchTarget, normalizeName, type ArtTarget } from './match'
import { inspectBorder, opaqueBounds, removeBackground, shouldAutoRemove } from './removeBg'
import { resolveArt } from './resolve'

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  new DataView(out.buffer).setUint32(0, data.length)
  out.set(latin1(type), 4)
  out.set(data, 8)
  return out
}

function pngWith(...chunks: Uint8Array[]): Uint8Array {
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks, chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

describe('character cards', () => {
  it('reads a chara_card_v2 embedded in a PNG tEXt chunk, including UTF-8 text', () => {
    const card = { spec: 'chara_card_v2', data: { name: 'Clover', description: 'A cheerful bunny companion. ✨' } }
    const png = pngWith(chunk('tEXt', latin1(`chara\0${b64(JSON.stringify(card))}`)))
    expect(readCharacterCard(png)).toEqual({ name: 'Clover', description: 'A cheerful bunny companion. ✨' })
  })

  it('prefers v3 (ccv3) and reads uncompressed iTXt', () => {
    const v3 = b64(JSON.stringify({ spec: 'chara_card_v3', data: { name: 'Nyx', personality: 'Moody.' } }))
    const itxt = new Uint8Array([...latin1('ccv3'), 0, 0, 0, 0, 0, ...latin1(v3)])
    const png = pngWith(chunk('tEXt', latin1(`chara\0${b64('{"name":"Old"}')}`)), chunk('iTXt', itxt))
    expect(readPngText(png).ccv3).toBe(v3)
    expect(readCharacterCard(png)?.name).toBe('Nyx')
  })

  it('returns null for plain images and broken cards', () => {
    expect(readCharacterCard(pngWith())).toBeNull()
    expect(readCharacterCard(pngWith(chunk('tEXt', latin1('chara\0not-base64!'))))).toBeNull()
    expect(readCharacterCard(latin1('GIF89a'))).toBeNull()
  })

  it('accepts flat v1 and nested v2 JSON exports', () => {
    expect(cardFromJson({ name: 'Rosie', description: 'Gardener.' })).toEqual({ name: 'Rosie', description: 'Gardener.' })
    expect(cardFromJson({ spec: 'chara_card_v2', data: { name: ' Lexi ', description: '' } })?.name).toBe('Lexi')
    expect(cardFromJson({ data: {} })).toBeNull()
  })
})

describe('matching files to characters', () => {
  const targets: ArtTarget[] = [
    { key: 'npc:bram', label: 'Old Bram', group: 'Characters', names: ['bram', 'Old Bram'] },
    { key: 'npc:mira', label: 'Mira', group: 'Characters', names: ['mira'] },
    { key: 'monster:goblin', label: 'Goblin', group: 'Monsters', names: ['goblin'] },
    { key: 'npc:grik', label: 'Boss Grik', group: 'Characters', names: ['grik', 'goblin chief', 'Boss Grik'] },
    { key: 'hero:h1', label: 'Clover', group: 'Party', names: ['Clover'] },
  ]
  const key = (file: string, card?: string) => matchTarget(file, card, targets)?.key

  it('normalizes file names', () => {
    expect(normalizeName('Old_Bram-happy (2).PNG')).toBe('old bram happy 2')
    expect(normalizeName('MiraSmile.webp')).toBe('mira smile')
  })

  it("handles plain, Ren'Py-style, and noisy names", () => {
    expect(key('mira.png')).toBe('npc:mira')
    expect(key('mira happy.png')).toBe('npc:mira')
    expect(key('ch_goblin_02.png')).toBe('monster:goblin')
    expect(key('goblin-chief-angry.png')).toBe('npc:grik')
    expect(key('Clover-character-card.png')).toBe('hero:h1')
    expect(key('random-landscape.png')).toBeUndefined()
  })

  it('trusts the character card name over the file name', () => {
    expect(key('IMG_1234.png', 'Old Bram')).toBe('npc:bram')
  })
})

/** w x h RGBA image filled with `bg`, with an opaque `fg` rectangle. */
function image(w: number, h: number, bg: number[], fg: number[], rect: [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3]
      data.set([...(inside ? fg : bg), 255], (y * w + x) * 4)
    }
  }
  return data
}

describe('background removal', () => {
  it('clears a flat magenta backdrop and keeps the figure', () => {
    const data = image(20, 20, [250, 0, 160], [40, 60, 200], [5, 4, 10, 12])
    const info = inspectBorder(data, 20, 20)
    expect(shouldAutoRemove(info)).toBe(true)
    const removed = removeBackground(data, 20, 20)
    expect(removed).toBe(400 - 120)
    expect(data[3]).toBe(0)
    expect(data[(10 * 20 + 10) * 4 + 3]).toBe(255)
    expect(opaqueBounds(data, 20, 20, 0)).toEqual({ x: 5, y: 4, w: 10, h: 12 })
  })

  it('removes enclosed pockets of a saturated key colour', () => {
    const data = image(20, 20, [0, 255, 0], [200, 40, 40], [4, 4, 12, 12])
    data.set([0, 250, 5, 255], (10 * 20 + 10) * 4)
    removeBackground(data, 20, 20)
    expect(data[(10 * 20 + 10) * 4 + 3]).toBe(0)
  })

  it('keeps white details inside a figure on a white backdrop', () => {
    const data = image(20, 20, [255, 255, 255], [30, 30, 30], [4, 4, 12, 12])
    data.set([255, 255, 255, 255], (10 * 20 + 10) * 4)
    removeBackground(data, 20, 20)
    expect(data[(10 * 20 + 10) * 4 + 3]).toBe(255)
    expect(data[3]).toBe(0)
  })

  it('keeps pale skin that touches a white backdrop', () => {
    const data = image(20, 20, [255, 255, 255], [250, 214, 180], [4, 4, 12, 12])
    removeBackground(data, 20, 20)
    expect(data[(10 * 20 + 10) * 4 + 3]).toBe(255)
    expect(data[(4 * 20 + 10) * 4 + 3]).toBeGreaterThan(200)
    expect(data[3]).toBe(0)
  })

  it('does not auto-remove busy or already-transparent images', () => {
    const noisy = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256))
    expect(shouldAutoRemove(inspectBorder(noisy, 16, 16))).toBe(false)
    const clear = image(16, 16, [0, 0, 0], [9, 9, 9], [4, 4, 4, 4])
    for (let i = 3; i < clear.length; i += 4) clear[i] = 0
    expect(shouldAutoRemove(inspectBorder(clear, 16, 16))).toBe(false)
  })
})

describe('resolveArt', () => {
  const bundled = { 'class:fighter': 'b-fighter', 'npc:mira': 'b-mira', 'monster:slime': 'b-slime' }

  it('prefers uploads, then legacy portraits, then class art, then bundled art', () => {
    const hero = { kind: 'hero', id: 'h1', classId: 'fighter' } as const
    expect(resolveArt(hero, { 'hero:h1': 'mine' }, 'illustrated', bundled)).toBe('mine')
    expect(resolveArt({ ...hero, legacy: 'old' }, {}, 'illustrated', bundled)).toBe('old')
    expect(resolveArt(hero, { 'class:fighter': 'my-fighter' }, 'pixel', bundled)).toBe('my-fighter')
    expect(resolveArt(hero, {}, 'illustrated', bundled)).toBe('b-fighter')
    expect(resolveArt(hero, {}, 'pixel', bundled)).toBeUndefined()
  })

  it('falls back to pixel sprites when nothing matches', () => {
    expect(resolveArt({ kind: 'npc', id: 'mira' }, {}, 'illustrated', bundled)).toBe('b-mira')
    expect(resolveArt({ kind: 'npc', id: 'nobody' }, {}, 'illustrated', bundled)).toBeUndefined()
    expect(resolveArt({ kind: 'monster', id: 'slime' }, { 'monster:slime': 'goo' }, 'pixel', bundled)).toBe('goo')
  })
})
