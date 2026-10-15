import type { Element } from "./combat";

export type SpeciesId =
  | "pipkin"
  | "cindermote"
  | "brooklet"
  | "pebbleback"
  | "fernskip"
  | "ashling"
  | "kelpwisp"
  | "graven";

export type Creature = {
  uid: string;
  speciesId: SpeciesId;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
};

export type Screen = "title" | "overworld" | "wild" | "boss" | "victory";

export type Battle = {
  kind: "wild" | "boss";
  foe: Creature;
  log: string[];
};

export type GameState = {
  screen: Screen;
  party: Creature[];
  x: number;
  y: number;
  bossBeaten: boolean;
  firstGrassDone: boolean;
  message: string;
  battle: Battle | null;
};

export type SaveData = {
  party: Creature[];
  x: number;
  y: number;
  bossBeaten: boolean;
  firstGrassDone: boolean;
};

export type Species = {
  id: SpeciesId;
  name: string;
  type: Element;
  baseHp: number;
  hpGain: number;
  baseAtk: number;
  atkGain: number;
  baseDef: number;
  defGain: number;
};
