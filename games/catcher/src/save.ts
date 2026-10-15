import { isSpeciesId } from "./creatures";
import type { Creature, GameState, SaveData, SpeciesId } from "./types";

export const SAVE_KEY = "mossring-save-v1";

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function toSave(state: GameState): SaveData {
  return {
    party: state.party.map(copyCreature),
    x: state.x,
    y: state.y,
    bossBeaten: state.bossBeaten,
    firstGrassDone: state.firstGrassDone,
  };
}

export function writeSave(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(state)));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return cleanSave(parsed);
  } catch {
    return null;
  }
}

function copyCreature(creature: Creature): Creature {
  return { ...creature };
}

function cleanSave(data: unknown): SaveData | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.party) || record.party.length < 1 || record.party.length > 6) {
    return null;
  }
  const party: Creature[] = [];
  for (const entry of record.party) {
    const creature = cleanCreature(entry);
    if (!creature) return null;
    party.push(creature);
  }
  if (!Number.isInteger(record.x) || !Number.isInteger(record.y)) return null;
  if (typeof record.bossBeaten !== "boolean") return null;
  if (typeof record.firstGrassDone !== "boolean") return null;
  return {
    party,
    x: record.x as number,
    y: record.y as number,
    bossBeaten: record.bossBeaten,
    firstGrassDone: record.firstGrassDone,
  };
}

function cleanCreature(entry: unknown): Creature | null {
  if (!entry || typeof entry !== "object") return null;
  const creature = entry as Record<string, unknown>;
  if (typeof creature.uid !== "string" || creature.uid.length === 0) return null;
  if (!isSpeciesId(creature.speciesId)) return null;
  if (!Number.isInteger(creature.level) || (creature.level as number) < 1 || (creature.level as number) > 100) {
    return null;
  }
  if (!isPositive(creature.maxHp) || !isPositive(creature.attack) || !isPositive(creature.defense)) {
    return null;
  }
  if (typeof creature.hp !== "number" || !Number.isFinite(creature.hp)) return null;
  if (creature.hp < 0 || creature.hp > creature.maxHp) return null;
  const speciesId: SpeciesId = creature.speciesId;
  return {
    uid: creature.uid,
    speciesId,
    level: creature.level as number,
    hp: creature.hp,
    maxHp: creature.maxHp as number,
    attack: creature.attack as number,
    defense: creature.defense as number,
  };
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
