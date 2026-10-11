# Nova Quest

A D&D x JRPG x visual novel desk to work and vibe with. Explore a pixel overworld, talk your way through
branching visual-novel scenes with skill checks, fight turn-based JRPG battles on 5e-lite rules, and level
up your party by finishing real-life tasks and focus sessions.

Inspired by [If AI can play Dungeons & Dragons, it can run your ERP](https://thenewstack.io/if-ai-can-play-dungeons-dragons-it-can-run-your-erp/):
the dice, rules, and state live in a deterministic engine, and the optional AI Dungeon Master has to call
real tools (`roll_dice`, `ask_oracle`, `get_party_state`) instead of inventing numbers.

Everything runs in the browser and works fully offline. No account or backend.

## Run it

```bash
cd nova-quest
npm install
npm run dev      # http://localhost:5173
npm test         # engine, content, AI DM, and save tests (Vitest)
npm run lint     # oxlint
npm run build    # type-check + production build into dist/
```

## Features

**Adventure**

- **Party creation:** four classes (Fighter, Wizard, Rogue, Cleric), 4d6-drop-lowest ability rolls, quick party, and your own portrait uploads.
- **Overworld:** arrow keys / WASD (or the on-screen D-pad), Enter or Space to interact. Tall grass and swamps trigger random encounters. Visit the inn, market, mire, and goblin warren. The crystal fully restores the party.
- **Visual-novel scenes:** typewriter dialogue, portraits, branching choices, and ability checks (d20 + modifier vs DC, with a big rolling die). Number keys pick choices.
- **Combat:** initiative order, attack / skills / items / defend / flee, MP-costed spells, crits that double the dice, enemy AI that heals and focuses on the weakest hero, ambush advantage, XP, gold, and loot.
- **Quest line:** help Mira recover the guild ledger from the goblin warren: sneak, bluff, or parley your way in, then face the boss.

**Vibe Desk** (press `Q` anywhere)

| Tab | What it does |
| --- | --- |
| Quests | Add your real tasks with a difficulty. Completing one awards party XP and gold. |
| Focus | Pomodoro timer. Finishing a session is a long rest plus bonus XP. |
| Dice | Any dice notation (`2d6+3`, `4d6kh3`, `1d20` with advantage/disadvantage, crits). |
| Oracle | Mythic-style yes/no oracle with "and/but" results and random twists. |
| DM | Chat with a Dungeon Master (offline mode, or AI with your own key). |
| Journal | Everything that happened: story beats, rolls, battles, quests, level ups. |
| Art | Upload portraits for your heroes and NPCs. |
| Settings | AI provider, sound and ambience, text speed, save export/import/wipe. |

A synthesized lo-fi tavern loop ("Vibes") and retro sound effects are generated with the Web Audio API, so there are no audio files.

## AI Dungeon Master (optional)

Open **Desk > Settings** and choose a preset (OpenAI, OpenRouter, or a local Ollama), or enter any
OpenAI-compatible base URL that supports tool calling. Then paste your API key.

- The key is stored only in this browser's `localStorage` and sent directly to the API you chose. It is kept separate from the save, so exported save files never contain it.
- The DM can call `roll_dice`, `ask_oracle`, and `get_party_state` (party stats, gold, inventory, story flags, location, open real-life quests, recent journal). Every tool call shows in the chat and in the journal.
- Without a key, the offline DM still rolls dice in your messages ("roll 1d20+5"), answers questions ending in `?` with the oracle, and offers story seeds.
- The API must allow browser requests (CORS). OpenAI, OpenRouter, and Ollama do.

## Saving

The game autosaves to `localStorage` after every action. In **Desk > Settings > Save data** you can export
a JSON backup, import it on another device, or wipe everything. Uploaded portraits are downscaled to
256px, but many of them can still fill browser storage. If that happens you'll see a warning; export your
save and remove some art.

## Writing your own content

Everything is data in `src/content/`:

- `scenes.ts`: visual-novel scenes. Each node has optional `speaker` (an NPC id or `'lead'`), `text`, `next`, `choices`, `battle`, and `effects`. Choices can have a `check` (`{ ability, dc, label, success, failure }`), `requires` (`gold` disables the choice when you can't afford it, `flags`/`notFlags` hide it), and `effects` (`gold`, `xp`, `item`, `flag`, `rest`, `journal`). `startIf` picks the entry node from story flags. Use `{lead}` and `{gold}` in text.
- `map.ts`: the overworld as a string grid. Point a landmark at a scene id.
- `monsters.ts`, `classes.ts`, `items.ts`, `npcs.ts`: stats, skills, encounter zones, and NPCs.
- `sprites.ts`: pixel art as string grids plus a palette, rendered as SVG.

`src/content/content.test.ts` checks that every scene link, monster, item, and NPC reference resolves,
so `npm test` catches typos in new content.

## Code map

```
src/
  engine/   pure, seedable game logic: dice, oracle, rules, characters, combat, scenes
  content/  classes, monsters, items, NPCs, map, scenes, sprites
  game/     glue between content and engine (party stats, encounters, AI snapshot)
  store/    Zustand stores: game (autosaved), settings, focus timer
  ai/       AI DM tool definitions, tool loop, offline DM
  screens/  title, party creation, overworld, scene, battle
  desk/     Vibe Desk tabs
  components/, audio.ts, util/
```
