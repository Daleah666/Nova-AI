import "./style.css";
import { catchOutlook, checkCombatMath } from "./combat";
import { SPECIES } from "./creatures";
import {
  assertBossIsCloseable,
  leaveVictory,
  newGame,
  playerCatch,
  playerRun,
  playerStrike,
  saveOverworld,
  stateFromSave,
  titleState,
  tryMove,
} from "./game";
import { drawBattle, drawTitleScene, drawVictoryScene, drawWorld } from "./render";
import { hasSave, readSave } from "./save";
import { drawCreature } from "./sprites";
import type { Creature, GameState } from "./types";

checkCombatMath();
assertBossIsCloseable();

const app = must<HTMLDivElement>("#app");
app.innerHTML = `
  <div class="shell">
    <section id="screen-title">
      <p class="eyebrow">A woodland ring</p>
      <h1>Mossring</h1>
      <canvas id="title-art" width="520" height="180"></canvas>
      <div class="menu">
        <button type="button" id="btn-new">New Game</button>
        <button type="button" id="btn-continue" disabled>Continue</button>
      </div>
      <p id="title-note"></p>
    </section>
    <section id="screen-victory" hidden>
      <canvas id="victory-art" width="180" height="150"></canvas>
      <div class="quiet-ring" aria-hidden="true"></div>
      <h1 id="victory-banner">The ring is quiet.</h1>
      <p>Graven rests, and the far grass lies still.</p>
      <button type="button" id="btn-onward">Walk on</button>
    </section>
    <section id="screen-play" hidden>
      <div class="layout">
        <div class="stage">
          <div id="panel-world">
            <canvas id="world" width="640" height="480" aria-label="Mossring overworld"></canvas>
            <p id="world-message" aria-live="polite"></p>
            <p class="hint">Arrows or WASD move. Buildings, trees, and the edge block the way. The fountain heals. Tall grass stirs. The stone warden waits at the far right.</p>
          </div>
          <div id="panel-battle" hidden>
            <canvas id="battle" width="640" height="300" aria-label="Creature battle"></canvas>
            <div class="hud">
              <div class="card">
                <div id="foe-name" class="who"></div>
                <div class="bar"><span id="foe-bar"></span></div>
                <div id="foe-hp" class="meta"></div>
              </div>
              <div class="card">
                <div id="lead-name" class="who"></div>
                <div class="bar"><span id="lead-bar"></span></div>
                <div id="lead-hp" class="meta"></div>
              </div>
            </div>
            <p id="outlook"></p>
            <div id="battle-log" aria-live="polite"></div>
            <div class="actions">
              <button type="button" id="btn-strike">Strike <kbd>1</kbd></button>
              <button type="button" id="btn-catch">Catch <kbd>2</kbd></button>
              <button type="button" id="btn-run">Run <kbd>3</kbd></button>
            </div>
          </div>
        </div>
        <aside>
          <h2>Party</h2>
          <ul id="party-list"></ul>
          <button type="button" id="btn-save">Save</button>
          <div class="chart">
            <div>Ember beats Gale</div>
            <div>Gale beats Stone</div>
            <div>Stone beats Tide</div>
            <div>Tide beats Ember</div>
          </div>
        </aside>
      </div>
    </section>
  </div>
`;

const titleScreen = must<HTMLElement>("#screen-title");
const victoryScreen = must<HTMLElement>("#screen-victory");
const playScreen = must<HTMLElement>("#screen-play");
const worldPanel = must<HTMLElement>("#panel-world");
const battlePanel = must<HTMLElement>("#panel-battle");
const titleNote = must<HTMLParagraphElement>("#title-note");
const worldMessage = must<HTMLParagraphElement>("#world-message");
const partyList = must<HTMLUListElement>("#party-list");
const battleLog = must<HTMLDivElement>("#battle-log");
const outlook = must<HTMLParagraphElement>("#outlook");
const foeName = must<HTMLDivElement>("#foe-name");
const leadName = must<HTMLDivElement>("#lead-name");
const foeHp = must<HTMLDivElement>("#foe-hp");
const leadHp = must<HTMLDivElement>("#lead-hp");
const foeBar = must<HTMLSpanElement>("#foe-bar");
const leadBar = must<HTMLSpanElement>("#lead-bar");
const continueBtn = must<HTMLButtonElement>("#btn-continue");
const saveBtn = must<HTMLButtonElement>("#btn-save");
const catchBtn = must<HTMLButtonElement>("#btn-catch");
const runBtn = must<HTMLButtonElement>("#btn-run");

const titleCtx = prep(must<HTMLCanvasElement>("#title-art"), 520, 180);
const worldCtx = prep(must<HTMLCanvasElement>("#world"), 640, 480);
const battleCtx = prep(must<HTMLCanvasElement>("#battle"), 640, 300);
const victoryCtx = prep(must<HTMLCanvasElement>("#victory-art"), 180, 150);

let state: GameState = titleState();

must<HTMLButtonElement>("#btn-new").addEventListener("click", () => {
  state = newGame();
  sync();
});

continueBtn.addEventListener("click", () => {
  const data = readSave();
  if (!data) {
    titleNote.textContent = "That save could not be read.";
    continueBtn.disabled = !hasSave();
    return;
  }
  state = stateFromSave(data);
  sync();
});

saveBtn.addEventListener("click", () => {
  saveOverworld(state);
  sync();
});

must<HTMLButtonElement>("#btn-strike").addEventListener("click", () => {
  playerStrike(state);
  sync();
});

catchBtn.addEventListener("click", () => {
  playerCatch(state);
  sync();
});

runBtn.addEventListener("click", () => {
  playerRun(state);
  sync();
});

must<HTMLButtonElement>("#btn-onward").addEventListener("click", () => {
  leaveVictory(state);
  sync();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const dir = direction(event.key);
  if (dir) event.preventDefault();
  if (dir && state.screen === "overworld") {
    tryMove(state, dir[0], dir[1]);
    sync();
    return;
  }
  if (state.screen !== "wild" && state.screen !== "boss") return;
  if (event.key === "1") {
    event.preventDefault();
    playerStrike(state);
    sync();
  } else if (event.key === "2" && state.screen === "wild") {
    event.preventDefault();
    playerCatch(state);
    sync();
  } else if (event.key === "3" && state.screen === "wild") {
    event.preventDefault();
    playerRun(state);
    sync();
  }
});

sync();
requestAnimationFrame(frame);

function frame(time: number): void {
  if (state.screen === "title") drawTitleScene(titleCtx, time, 520, 180);
  if (state.screen === "overworld") drawWorld(worldCtx, time, state.x, state.y);
  if ((state.screen === "wild" || state.screen === "boss") && state.battle && state.party[0]) {
    drawBattle(battleCtx, time, state.party[0].speciesId, state.battle.foe.speciesId, 640, 300);
  }
  if (state.screen === "victory") drawVictoryScene(victoryCtx, 180, 150);
  requestAnimationFrame(frame);
}

function sync(): void {
  app.dataset.screen = state.screen;
  app.dataset.x = String(state.x);
  app.dataset.y = String(state.y);
  app.dataset.boss = state.bossBeaten ? "yes" : "no";
  titleScreen.hidden = state.screen !== "title";
  victoryScreen.hidden = state.screen !== "victory";
  playScreen.hidden = state.screen === "title" || state.screen === "victory";
  worldPanel.hidden = state.screen !== "overworld";
  battlePanel.hidden = state.screen !== "wild" && state.screen !== "boss";
  saveBtn.disabled = state.screen !== "overworld";
  catchBtn.hidden = state.screen !== "wild";
  runBtn.hidden = state.screen !== "wild";
  if (state.screen === "title") continueBtn.disabled = !hasSave();
  worldMessage.textContent = state.message;
  if (state.screen === "overworld" || state.screen === "wild" || state.screen === "boss") {
    renderParty(state.party);
  }
  if ((state.screen === "wild" || state.screen === "boss") && state.battle && state.party[0]) {
    renderBattle(state);
  }
}

function renderParty(party: Creature[]): void {
  partyList.replaceChildren();
  for (let i = 0; i < 6; i += 1) {
    const creature = party[i];
    const li = document.createElement("li");
    if (!creature) {
      li.className = "member empty";
      li.textContent = "Empty";
      partyList.append(li);
      continue;
    }
    const species = SPECIES[creature.speciesId];
    li.className = i === 0 ? "member lead" : "member";
    li.dataset.species = creature.speciesId;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) drawCreature(ctx, creature.speciesId, 32, 60, 54);
    const info = document.createElement("div");
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = species.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    const type = document.createElement("span");
    type.className = `type-${species.type.toLowerCase()}`;
    type.textContent = species.type;
    meta.append(type, document.createTextNode(`  Lv ${creature.level}`));
    const hp = document.createElement("div");
    hp.className = "meta";
    hp.dataset.hp = String(creature.hp);
    hp.dataset.max = String(creature.maxHp);
    hp.textContent = `HP ${creature.hp}/${creature.maxHp}`;
    info.append(who, meta, hpBar(creature.hp, creature.maxHp), hp);
    if (i === 0) {
      const tag = document.createElement("div");
      tag.className = "meta";
      tag.textContent = "Active";
      info.append(tag);
    }
    li.append(canvas, info);
    partyList.append(li);
  }
}

function renderBattle(current: GameState): void {
  const battle = current.battle;
  const lead = current.party[0];
  if (!battle || !lead) return;
  const foeSpecies = SPECIES[battle.foe.speciesId];
  const leadSpecies = SPECIES[lead.speciesId];
  foeName.textContent = `${foeSpecies.name}  Lv ${battle.foe.level}`;
  leadName.textContent = `${leadSpecies.name}  Lv ${lead.level}`;
  foeName.dataset.type = foeSpecies.type;
  leadName.dataset.type = leadSpecies.type;
  paintHp(foeHp, foeBar, battle.foe.hp, battle.foe.maxHp);
  paintHp(leadHp, leadBar, lead.hp, lead.maxHp);
  outlook.hidden = current.screen !== "wild";
  outlook.textContent = current.screen === "wild" ? catchOutlook(battle.foe.hp, battle.foe.maxHp) : "";
  battleLog.replaceChildren();
  for (const line of battle.log) {
    const p = document.createElement("p");
    p.textContent = line;
    battleLog.append(p);
  }
}

function paintHp(label: HTMLDivElement, bar: HTMLSpanElement, hp: number, maxHp: number): void {
  label.dataset.hp = String(hp);
  label.dataset.max = String(maxHp);
  label.textContent = `HP ${hp}/${maxHp}`;
  bar.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
  bar.className = barTone(hp, maxHp);
}

function hpBar(hp: number, maxHp: number): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "bar";
  const span = document.createElement("span");
  span.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
  span.className = barTone(hp, maxHp);
  bar.append(span);
  return bar;
}

function barTone(hp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio <= 0.3) return "low";
  if (ratio <= 0.55) return "mid";
  return "";
}

function direction(key: string): [number, number] | null {
  const k = key.toLowerCase();
  if (k === "arrowup" || k === "w") return [0, -1];
  if (k === "arrowdown" || k === "s") return [0, 1];
  if (k === "arrowleft" || k === "a") return [-1, 0];
  if (k === "arrowright" || k === "d") return [1, 0];
  return null;
}

function prep(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function must<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
