import type { Element } from "./combat";
import type { Creature, Species, SpeciesId } from "./types";

export const SPECIES: Record<SpeciesId, Species> = {
  pipkin: {
    id: "pipkin",
    name: "Pipkin",
    type: "Gale",
    baseHp: 28,
    hpGain: 5,
    baseAtk: 10,
    atkGain: 2,
    baseDef: 8,
    defGain: 1,
  },
  cindermote: {
    id: "cindermote",
    name: "Cindermote",
    type: "Ember",
    baseHp: 20,
    hpGain: 3,
    baseAtk: 10,
    atkGain: 1,
    baseDef: 5,
    defGain: 1,
  },
  brooklet: {
    id: "brooklet",
    name: "Brooklet",
    type: "Tide",
    baseHp: 24,
    hpGain: 4,
    baseAtk: 9,
    atkGain: 1,
    baseDef: 7,
    defGain: 1,
  },
  pebbleback: {
    id: "pebbleback",
    name: "Pebbleback",
    type: "Stone",
    baseHp: 30,
    hpGain: 4,
    baseAtk: 7,
    atkGain: 1,
    baseDef: 12,
    defGain: 1,
  },
  fernskip: {
    id: "fernskip",
    name: "Fernskip",
    type: "Gale",
    baseHp: 18,
    hpGain: 4,
    baseAtk: 12,
    atkGain: 1,
    baseDef: 4,
    defGain: 1,
  },
  ashling: {
    id: "ashling",
    name: "Ashling",
    type: "Ember",
    baseHp: 18,
    hpGain: 3,
    baseAtk: 10,
    atkGain: 1,
    baseDef: 5,
    defGain: 1,
  },
  kelpwisp: {
    id: "kelpwisp",
    name: "Kelpwisp",
    type: "Tide",
    baseHp: 26,
    hpGain: 4,
    baseAtk: 8,
    atkGain: 1,
    baseDef: 8,
    defGain: 1,
  },
  graven: {
    id: "graven",
    name: "Graven",
    type: "Stone",
    baseHp: 29,
    hpGain: 5,
    baseAtk: 13,
    atkGain: 1,
    baseDef: 7,
    defGain: 1,
  },
};

/** Route creatures. Pipkin is the starter. Graven is the boss and is never wild. */
export const WILD_IDS: readonly SpeciesId[] = [
  "cindermote",
  "brooklet",
  "pebbleback",
  "fernskip",
  "ashling",
  "kelpwisp",
];

const WILD_SET = new Set<SpeciesId>(WILD_IDS);
if (WILD_SET.has("pipkin") || WILD_SET.has("graven") || WILD_IDS.length !== 6) {
  throw new Error("Wild roster must be the six route creatures");
}

let uidSeq = 0;

function makeUid(): string {
  uidSeq += 1;
  return `m${uidSeq.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function isSpeciesId(id: unknown): id is SpeciesId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(SPECIES, id);
}

export function speciesOf(id: SpeciesId): Species {
  return SPECIES[id];
}

export function speciesName(id: SpeciesId): string {
  return SPECIES[id].name;
}

export function speciesType(id: SpeciesId): Element {
  return SPECIES[id].type;
}

export function statsFor(
  id: SpeciesId,
  level: number,
): { maxHp: number; attack: number; defense: number } {
  const species = SPECIES[id];
  const steps = level - 1;
  return {
    maxHp: species.baseHp + species.hpGain * steps,
    attack: species.baseAtk + species.atkGain * steps,
    defense: species.baseDef + species.defGain * steps,
  };
}

export function makeCreature(id: SpeciesId, level: number): Creature {
  const stats = statsFor(id, level);
  return {
    uid: makeUid(),
    speciesId: id,
    level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
  };
}

const pipkin = statsFor("pipkin", 5);
const graven = statsFor("graven", 8);
if (pipkin.maxHp !== 48 || pipkin.attack !== 18 || pipkin.defense !== 12) {
  throw new Error("Pipkin level 5 stats drifted");
}
if (graven.maxHp !== 64 || graven.attack !== 20 || graven.defense !== 14) {
  throw new Error("Graven level 8 stats drifted");
}
