import { catchChance, effectiveness, strikeDamage } from "./combat";
import {
  WILD_IDS,
  makeCreature,
  speciesName,
  speciesType,
  statsFor,
} from "./creatures";
import { SPAWN, isWalkable, tileAt } from "./map";
import { writeSave } from "./save";
import type { Battle, Creature, GameState, SaveData } from "./types";

export function titleState(): GameState {
  return {
    screen: "title",
    party: [],
    x: SPAWN.x,
    y: SPAWN.y,
    bossBeaten: false,
    firstGrassDone: false,
    message: "",
    battle: null,
  };
}

export function newGame(): GameState {
  return {
    screen: "overworld",
    party: [makeCreature("pipkin", 5)],
    x: SPAWN.x,
    y: SPAWN.y,
    bossBeaten: false,
    firstGrassDone: false,
    message: "The town fountain mends a tired party.",
    battle: null,
  };
}

export function stateFromSave(data: SaveData): GameState {
  let x = data.x;
  let y = data.y;
  const tile = tileAt(x, y);
  if (!isWalkable(tile)) {
    x = SPAWN.x;
    y = SPAWN.y;
  }
  return {
    screen: "overworld",
    party: data.party.map((creature) => ({ ...creature })),
    x,
    y,
    bossBeaten: data.bossBeaten,
    firstGrassDone: data.firstGrassDone,
    message: data.bossBeaten ? "The ring is quiet." : "You return to the wood.",
    battle: null,
  };
}

export function tryMove(state: GameState, dx: number, dy: number): void {
  if (state.screen !== "overworld") return;
  const nx = state.x + dx;
  const ny = state.y + dy;
  const tile = tileAt(nx, ny);
  if (tile === "boss") {
    if (state.bossBeaten) {
      state.message = "The ring is quiet.";
      return;
    }
    startBoss(state);
    return;
  }
  if (!isWalkable(tile)) return;
  state.x = nx;
  state.y = ny;
  state.message = "";
  if (tile === "fountain") {
    healParty(state.party);
    state.message = "The fountain mends the party.";
    return;
  }
  if (tile === "tallGrass") {
    const forced = !state.firstGrassDone;
    state.firstGrassDone = true;
    if (forced || Math.random() < 0.25) startWild(state);
  }
}

export function playerStrike(state: GameState): void {
  if (!inBattle(state) || !state.battle) return;
  const lead = state.party[0];
  if (!lead || lead.hp <= 0) {
    recoverInTown(state);
    return;
  }
  const foe = state.battle.foe;
  const dealt = strikeDamage(lead.attack, foe.defense, speciesType(lead.speciesId), speciesType(foe.speciesId));
  foe.hp = Math.max(0, foe.hp - dealt);
  const mult = effectiveness(speciesType(lead.speciesId), speciesType(foe.speciesId));
  pushLog(state.battle, `${speciesName(lead.speciesId)} strikes for ${dealt}. ${tone(mult)}`);
  if (foe.hp <= 0) {
    if (state.battle.kind === "boss") {
      state.bossBeaten = true;
      state.battle = null;
      state.screen = "victory";
      state.message = "The ring is quiet.";
      writeSave(state);
      return;
    }
    const name = speciesName(foe.speciesId);
    state.battle = null;
    state.screen = "overworld";
    state.message = `${name} slips back into the grass.`;
    return;
  }
  foeStrike(state);
}

export function playerCatch(state: GameState): void {
  if (state.screen !== "wild" || !state.battle || state.battle.kind !== "wild") return;
  const foe = state.battle.foe;
  const chance = catchChance(foe.hp, foe.maxHp);
  const caught = Math.random() < chance;
  if (!caught) {
    pushLog(state.battle, "The seedpod splits. It breaks free.");
    foeStrike(state);
    return;
  }
  if (state.party.length >= 6) {
    state.battle = null;
    state.screen = "overworld";
    state.message = "Your party is full.";
    return;
  }
  state.party.push(makeCreature(foe.speciesId, foe.level));
  const name = speciesName(foe.speciesId);
  state.battle = null;
  state.screen = "overworld";
  state.message = `${name} joins the party.`;
  if (!writeSave(state)) state.message = `${name} joins the party. The save did not keep.`;
}

export function playerRun(state: GameState): void {
  if (state.screen !== "wild" || !state.battle || state.battle.kind !== "wild") return;
  state.battle = null;
  state.screen = "overworld";
  state.message = "You step back from the grass.";
}

export function saveOverworld(state: GameState): void {
  if (state.screen !== "overworld") return;
  state.message = writeSave(state) ? "Saved." : "The save did not keep.";
}

export function leaveVictory(state: GameState): void {
  if (state.screen !== "victory") return;
  state.screen = "overworld";
  state.message = "The ring is quiet.";
}

export function assertBossIsCloseable(): void {
  const pipkin = statsFor("pipkin", 5);
  const graven = statsFor("graven", 8);
  const hit = strikeDamage(pipkin.attack, graven.defense, "Gale", "Stone");
  const back = strikeDamage(graven.attack, pipkin.defense, "Stone", "Gale");
  const hitsToKo = Math.ceil(graven.maxHp / hit);
  const counters = hitsToKo - 1;
  if (hit < 1 || back < 1 || counters * back >= pipkin.maxHp) {
    throw new Error("Pipkin must be able to finish Graven");
  }
}

function startWild(state: GameState): void {
  const speciesId = WILD_IDS[Math.floor(Math.random() * WILD_IDS.length)];
  const level = 4 + Math.floor(Math.random() * 3);
  const foe = makeCreature(speciesId, level);
  state.screen = "wild";
  state.battle = {
    kind: "wild",
    foe,
    log: [`A wild ${speciesName(speciesId)} steps out of the grass.`],
  };
}

function startBoss(state: GameState): void {
  const foe = makeCreature("graven", 8);
  state.screen = "boss";
  state.battle = {
    kind: "boss",
    foe,
    log: ["Graven bars the far edge of the ring."],
  };
}

function foeStrike(state: GameState): void {
  if (!state.battle) return;
  const lead = state.party[0];
  if (!lead) {
    recoverInTown(state);
    return;
  }
  const foe = state.battle.foe;
  const dealt = strikeDamage(foe.attack, lead.defense, speciesType(foe.speciesId), speciesType(lead.speciesId));
  lead.hp = Math.max(0, lead.hp - dealt);
  pushLog(state.battle, `${speciesName(foe.speciesId)} strikes for ${dealt}.`);
  if (lead.hp <= 0) recoverInTown(state);
}

function recoverInTown(state: GameState): void {
  healParty(state.party);
  state.x = SPAWN.x;
  state.y = SPAWN.y;
  state.battle = null;
  state.screen = "overworld";
  state.message = "You wake in town. The party is mended.";
}

function healParty(party: Creature[]): void {
  for (const creature of party) creature.hp = creature.maxHp;
}

function pushLog(battle: Battle, line: string): void {
  battle.log.push(line);
  if (battle.log.length > 8) battle.log.shift();
}

function tone(mult: number): string {
  if (mult > 1) return "It lands hard.";
  if (mult < 1) return "It glances off.";
  return "It connects.";
}

function inBattle(state: GameState): boolean {
  return state.screen === "wild" || state.screen === "boss";
}
