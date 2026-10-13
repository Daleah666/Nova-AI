/**
 * Reads character cards (SillyTavern / TavernAI "chara_card_v2" and v3) from PNG text chunks
 * or from the standalone JSON files those tools export.
 */
export interface CharacterCard {
  name: string
  description: string
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

/** Uncompressed tEXt and iTXt chunks, keyed by keyword. */
export function readPngText(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isPng(bytes)) return out
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const latin1 = new TextDecoder('latin1')
  const utf8 = new TextDecoder()
  let p = 8
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p)
    const type = latin1.decode(bytes.subarray(p + 4, p + 8))
    const data = bytes.subarray(p + 8, p + 8 + len)
    if (type === 'IEND') break
    if (type === 'tEXt') {
      const nul = data.indexOf(0)
      if (nul > 0) out[latin1.decode(data.subarray(0, nul))] = latin1.decode(data.subarray(nul + 1))
    } else if (type === 'iTXt') {
      const nul = data.indexOf(0)
      const compressed = data[nul + 1] === 1
      if (nul > 0 && !compressed) {
        let q = nul + 3
        q = data.indexOf(0, q) + 1 // language tag
        q = data.indexOf(0, q) + 1 // translated keyword
        if (q > 0) out[latin1.decode(data.subarray(0, nul))] = utf8.decode(data.subarray(q))
      }
    }
    p += 12 + len
  }
  return out
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.trim())
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Accepts a parsed card JSON in any common shape (v1 flat, v2/v3 with `data`). */
export function cardFromJson(json: unknown): CharacterCard | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  const d = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name.trim() : ''
  if (!name) return null
  const description = [d.description, d.personality].find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? ''
  return { name: name.slice(0, 40), description: description.trim() }
}

export function readCharacterCard(bytes: Uint8Array): CharacterCard | null {
  const text = readPngText(bytes)
  const raw = text.ccv3 ?? text.chara
  if (!raw) return null
  try {
    return cardFromJson(JSON.parse(decodeBase64Utf8(raw)))
  } catch {
    return null
  }
}
