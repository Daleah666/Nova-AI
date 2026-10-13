import { describe, expect, it } from 'vitest'
import { askOracle, LIKELIHOODS } from './oracle'
import { mulberry32 } from './rng'
import { facesRng } from './testing'

describe('askOracle', () => {
  it('matches each likelihood threshold over many asks', () => {
    const rng = mulberry32(7)
    for (const l of LIKELIHOODS) {
      let yes = 0
      const n = 20000
      for (let i = 0; i < n; i++) if (askOracle('?', l.id, rng).yes) yes++
      expect(Math.abs(yes / n - l.threshold / 100)).toBeLessThan(0.02)
    }
  })

  it('qualifies answers near the line and at the extremes', () => {
    expect(askOracle('q', 'even', facesRng([[3, 100]])).answer).toBe('Yes, and...')
    expect(askOracle('q', 'even', facesRng([[30, 100]])).answer).toBe('Yes')
    expect(askOracle('q', 'even', facesRng([[48, 100]])).answer).toBe('Yes, but...')
    expect(askOracle('q', 'even', facesRng([[53, 100]])).answer).toBe('No, but...')
    expect(askOracle('q', 'even', facesRng([[70, 100]])).answer).toBe('No')
    expect(askOracle('q', 'even', facesRng([[95, 100]])).answer).toBe('No, and...')
  })

  it('adds a twist on doubles', () => {
    const r = askOracle('Is there a goblin behind the boulder?', 'likely', facesRng([[33, 100], [2, 10]]))
    expect(r.twist).toBeTruthy()
    expect(askOracle('q', 'likely', facesRng([[34, 100]])).twist).toBeNull()
  })
})
