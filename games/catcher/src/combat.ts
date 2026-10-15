export type Element = "Ember" | "Tide" | "Gale" | "Stone";

/** Ember beats Gale, Gale beats Stone, Stone beats Tide, Tide beats Ember. */
const STRONG_AGAINST: Record<Element, Element> = {
  Ember: "Gale",
  Gale: "Stone",
  Stone: "Tide",
  Tide: "Ember",
};

/** Pure. Advantage 1.5, disadvantage 0.75, otherwise 1. */
export function effectiveness(attackType: Element, defendType: Element): number {
  if (STRONG_AGAINST[attackType] === defendType) return 1.5;
  if (STRONG_AGAINST[defendType] === attackType) return 0.75;
  return 1;
}

/**
 * Pure strike damage. Always at least 1.
 * Uses attack, defense, and type effectiveness.
 */
export function strikeDamage(
  attack: number,
  defense: number,
  attackType: Element,
  defendType: Element,
): number {
  const mult = effectiveness(attackType, defendType);
  const raw = Math.floor((attack * mult * 8) / Math.max(1, defense));
  return Math.max(1, raw);
}

/**
 * Pure catch chance in the range 0..1.
 * Low at full HP (about 0.08). Reliable at or under 30% HP (about 0.85).
 */
export function catchChance(currentHp: number, maxHp: number): number {
  if (!(maxHp > 0)) return 0;
  const ratio = Math.min(1, Math.max(0, currentHp / maxHp));
  if (ratio <= 0.3) {
    const t = (0.3 - ratio) / 0.3;
    return 0.85 + t * 0.1;
  }
  const t = (1 - ratio) / 0.7;
  return 0.08 + t * 0.77;
}

export function catchOutlook(currentHp: number, maxHp: number): string {
  const chance = catchChance(currentHp, maxHp);
  if (chance >= 0.85) return "A seedpod would likely hold.";
  if (chance >= 0.45) return "A seedpod might hold.";
  return "A seedpod would barely hold.";
}

export function checkCombatMath(): void {
  if (effectiveness("Ember", "Gale") !== 1.5) throw new Error("Ember should beat Gale");
  if (effectiveness("Gale", "Stone") !== 1.5) throw new Error("Gale should beat Stone");
  if (effectiveness("Stone", "Tide") !== 1.5) throw new Error("Stone should beat Tide");
  if (effectiveness("Tide", "Ember") !== 1.5) throw new Error("Tide should beat Ember");
  if (effectiveness("Gale", "Ember") !== 0.75) throw new Error("Gale should resist Ember poorly");
  if (effectiveness("Stone", "Gale") !== 0.75) throw new Error("Stone should resist Gale poorly");
  if (effectiveness("Tide", "Stone") !== 0.75) throw new Error("Tide should resist Stone poorly");
  if (effectiveness("Ember", "Tide") !== 0.75) throw new Error("Ember should resist Tide poorly");
  if (effectiveness("Ember", "Ember") !== 1) throw new Error("matching types are neutral");
  if (effectiveness("Ember", "Stone") !== 1) throw new Error("Ember and Stone are neutral");
  if (effectiveness("Tide", "Gale") !== 1) throw new Error("Tide and Gale are neutral");
  if (catchChance(100, 100) >= 0.2) throw new Error("full HP catch should be low");
  if (catchChance(30, 100) < 0.85) throw new Error("30% HP catch should be reliable");
  if (catchChance(10, 100) < 0.85) throw new Error("under 30% HP catch should be reliable");
  if (strikeDamage(1, 999, "Stone", "Stone") !== 1) throw new Error("damage floors at 1");
  const advantage = strikeDamage(18, 14, "Gale", "Stone");
  const disadvantage = strikeDamage(20, 12, "Stone", "Gale");
  if (advantage !== 15 || disadvantage !== 10) {
    throw new Error("starter versus Graven damage drifted");
  }
}
