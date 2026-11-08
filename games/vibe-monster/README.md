# Vibe Monster — First Batch (18+ parody monster-catcher prototype)

An original, adults-only (18+), **suggestive-but-not-explicit** parody of the classic monster-catching RPG formula.
Plain HTML/JS + `<canvas>`, no dependencies, no external assets. All art is drawn procedurally in code.
Every character is an adult (ages 21+ are listed in their dex entries). No nudity, no explicit acts.

## Run it

- Double-click `index.html` (works from `file://`), **or**
- Serve the folder: `cd games/vibe-monster && python3 -m http.server 8000`, then open <http://localhost:8000>.

Controls: **Arrows/WASD** move (hold **Shift** to run) · **Z / Space / Enter** confirm & talk · **X / Esc** back / open menu · **Enter / M** menu.
Mouse clicks work on menus and dialog boxes, too.

## What's in this batch

Start town → intro & heroine pick → rival battle → Route 69 (wild encounters, 2 trainers) → Velvet Woods (forest, 3 trainers, items) →
Brunchville (Spa heal + PC storage, Boutique shop) → **Karen Prison** (Gym #1: three Karen trainers, a gate, Warden Karen-Lynn) → **Manager Badge**.

- **Heroine = starter.** Pick one of three original adult heroines in the intro. She's your character, your bio, and your first party member, and she fights on the front line. She "glows up" at Lv14. Your rival is another heroine.
  - **Margaux Steelwell** (Drip, 29): ex-HR enforcer with a lanyard-halberd.
  - **Princess Tansy Bronzé** (Spicy, 24): repossessed mall-kingdom princess.
  - **General Brunhilde "Hilde" Thornvale** (Bloom, 31): retired demon general turned gardener.
  They are loose archetype homages (a stern officer, a pampered tanned princess, a retired demon general) with different names, designs and original procedural art. No art, sprites or text from any existing game.
- **Type chart:** 10 types (Basic, Spicy, Drip, Bloom, Spark, Swole, Sass, Goth, Glam, Entitled) with strengths and weaknesses.
- **Vibe-Dex** with 19 entries (3 heroines × 2 forms + 13 Vibemon), plus levels, XP (shared with the party), stats, evolutions, catching (Crush Ball / Thirst Trap), a party of 6, PC storage, and ~4 moves each.
- **Save/Load** through `localStorage` (Menu → SAVE; Continue on the title screen).

### Creatures

Heroines: Margaux → Margaux, Warden Supreme · Princess Tansy → Empress Tansy · General Hilde → Hilde, Thorn Warlord.
Vibemon: Emberella, Splashton, Fernanda, Basicbecca → Basiqueen, Chaddeus → Gigachadwick, Voltina, Mothrina, Sassquatch, Glamazonia, Kareniac → Karenzilla.

### "Composure" combat system

The battle mechanics are modeled on the stamina/energy/stance design of *Karryn's Prison* (by Remtairy), researched from public descriptions and re-implemented in original code with every lewd mechanic removed:

| Mechanic | How it works here |
|---|---|
| Stamina = HP | Attacks **cost Stamina**. Chained attacks raise the cost (combo ×N, ×1.5 each). |
| Energy | Powers **Techniques**, which reset the combo: Defensive / Cautious / Counter Stance, Revitalize, Compose, Flaunt. |
| Stances (3 turns) | Defensive: −40% damage, blocks stat drops and stagger, halves Fluster. Cautious: big dodge boost, but misses can still graze. Counter: 60% chance to riposte. |
| Attack tiers | Light: cheap, lowers ATK/SPD or **staggers**. Normal. Heavy: strong, 2-turn cooldown. |
| Fluster | Charm moves build Fluster. At 100 the target **swoons** and loses an action (a non-explicit stand-in for the original's adult gauge). Flustered wild Vibemon are easier to catch. |
| Use-based growth | Stats get **training bonuses** from how you fight: attacking, tanking in Defensive, dodging in Cautious, Revitalizing. |

### Testing hooks

- `?seed=123` makes the RNG deterministic.
- `?debug=1` exposes `window.VM` (warp, set levels, add Vibemon) for automated testing and demos.

## Files

- `index.html`: age gate + loader
- `style.css`: UI styling
- `js/data.js`: types, chart, moves, techniques, dex, items, trainers, encounters
- `js/art.js`: procedural pixel art (creatures, tiles, overworld sprites)
- `js/maps.js`: maps, NPCs and event scripts
- `js/battle.js`: Composure battle system, catching, XP and level-ups
- `js/engine.js`: loop, input, UI, overworld, menus, save/load, title and intro

All names, characters, creatures, art and text are original. This is not affiliated with Nintendo, Game Freak, The Pokémon Company, Remtairy, or any other studio.
