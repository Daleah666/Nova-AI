/**
 * Ranks signals by puppet-control fidelity value.
 * Higher score = more useful for digital twin / avatar mirroring.
 */

const PUPPET_WEIGHTS = {
  "movement-style": 8,
  "aesthetic-taste": 9,
  "decision-latency": 7,
  "communication-voice": 10,
  "tool-preference": 6,
  "goal-alignment": 8,
  "reaction-speed": 7,
  "values-tradeoff": 9,
  "avatar-pose": 10,
  "avatar-expression": 10,
  "workflow-rhythm": 7,
};

const CONFIDENCE_MULT = { low: 0.5, medium: 1, high: 1.5 };

const CATEGORY_BONUS = {
  puppet: 5,
  avatar: 4,
  aesthetic: 3,
  preference: 2,
  decision: 2,
  communication: 3,
};

export function scoreSignal(signal) {
  let score = 1;

  if (signal.puppetVector && PUPPET_WEIGHTS[signal.puppetVector]) {
    score += PUPPET_WEIGHTS[signal.puppetVector];
  }

  if (signal.category && CATEGORY_BONUS[signal.category]) {
    score += CATEGORY_BONUS[signal.category];
  }

  if (signal.payload && Object.keys(signal.payload).length > 0) {
    score += 2;
  }

  if (signal.quote) score += 1;

  score *= CONFIDENCE_MULT[signal.confidence] || 1;

  return Math.round(score * 10) / 10;
}

export function rankSignals(signals) {
  return [...signals]
    .map((s) => ({ ...s, fidelityScore: scoreSignal(s) }))
    .sort((a, b) => b.fidelityScore - a.fidelityScore);
}

export function topPuppetVectors(signals, limit = 5) {
  const counts = {};
  for (const s of signals) {
    if (!s.puppetVector) continue;
    counts[s.puppetVector] = (counts[s.puppetVector] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([vector, count]) => ({ vector, count }));
}
