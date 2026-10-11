import type { Rng } from './rng'

/** Builds an Rng that produces the given die faces in order. Each entry is [face, sides]. */
export function facesRng(faces: [number, number][]): Rng {
  let i = 0
  return () => {
    if (i >= faces.length) throw new Error(`facesRng exhausted after ${faces.length} rolls`)
    const [face, sides] = faces[i++]
    return (face - 0.5) / sides
  }
}
