import { rollDie } from './dice'
import { defaultRng, type Rng } from './rng'

export const LIKELIHOODS = [
  { id: 'very-unlikely', label: 'Very Unlikely', threshold: 10 },
  { id: 'unlikely', label: 'Unlikely', threshold: 25 },
  { id: 'even', label: '50/50', threshold: 50 },
  { id: 'likely', label: 'Likely', threshold: 75 },
  { id: 'very-likely', label: 'Very Likely', threshold: 90 },
  { id: 'certain', label: 'Near Certain', threshold: 97 },
] as const

export type Likelihood = (typeof LIKELIHOODS)[number]['id']

export type OracleAnswer = 'Yes, and...' | 'Yes' | 'Yes, but...' | 'No, but...' | 'No' | 'No, and...'

export interface OracleResult {
  question: string
  likelihood: Likelihood
  roll: number
  threshold: number
  answer: OracleAnswer
  yes: boolean
  twist: string | null
}

export const TWISTS = [
  'An NPC acts against expectations.',
  'A hidden enemy reveals itself.',
  'Something valuable is lost or broken.',
  'An old friend (or rival) appears.',
  'The weather turns dramatically.',
  'A clue points somewhere unexpected.',
  'Someone is not who they claim to be.',
  'A door opens that should have stayed shut.',
  'The party is being watched.',
  'A small kindness is repaid.',
] as const

export function likelihoodInfo(id: Likelihood) {
  return LIKELIHOODS.find((l) => l.id === id) ?? LIKELIHOODS[2]
}

/**
 * Solo-play yes/no oracle. Rolls d100 against the likelihood threshold; rolls in the
 * extreme fifth of either band are emphatic ("and"), rolls within 5 of the line are
 * qualified ("but"), and doubles (11, 22, ... 99) add a random twist.
 */
export function askOracle(question: string, likelihood: Likelihood = 'even', rng: Rng = defaultRng): OracleResult {
  const { threshold } = likelihoodInfo(likelihood)
  const r = rollDie(100, rng)
  const yes = r <= threshold
  const emphaticYes = Math.max(1, Math.floor(threshold / 5))
  const emphaticNo = 100 - Math.floor((100 - threshold) / 5)

  let answer: OracleAnswer
  if (yes) {
    answer = r <= emphaticYes ? 'Yes, and...' : r > threshold - 5 ? 'Yes, but...' : 'Yes'
  } else {
    answer = r > emphaticNo ? 'No, and...' : r <= threshold + 5 ? 'No, but...' : 'No'
  }

  const twist = r % 11 === 0 ? TWISTS[rollDie(TWISTS.length, rng) - 1] : null
  return { question, likelihood, roll: r, threshold, answer, yes, twist }
}
