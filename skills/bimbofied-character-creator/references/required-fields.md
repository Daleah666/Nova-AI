# Legal field names

These names are the bot-maker character schema (`schema_id: bot-maker-character`, `version: "1.0"`). Use them as written. Do not invent, rename, or camelCase keys.

If `skills/bot-maker/references/character-schema.yaml` is on disk, that file wins for types and fill notes. This list is the same names, kept short so a branch without the schema still has the legal keys.

**(required)** means fill it before export. Write `TBD` only if the user asks to wait.

## meta (required block)

- `slug` (required) — lowercase-hyphen folder name
- `mode` (required) — `quick` | `full` | `rpg` | `avatar-first`
- `tone` (required) — `sfw` | `mature`
- `genre` (required)
- `creator` — card credit only. Never the user's private life.
- `character_version` (required) — start at `0.1.0` or `1.0.0`
- `rpg_attached` (required) — true or false
- `mature_section` (required) — `skipped` | `filled`
- `tags`

## identity

- `name` (required)
- `aliases`
- `age` (required) — sexualized characters are 21+
- `pronouns` (required)
- `species` (required)
- `occupation`
- `role_in_story` (required)

## speech_style (required block)

- `register` (required)
- `cadence` (required)
- `vocabulary` (required)
- `verbal_tics` — max 3
- `languages`

## physical

- `face` (required)
- `hair` (required)
- `eyes` (required)
- `skin` (required)
- `build` (required)
- `height` (required)
- `marks`
- `posture` (required)
- `gait` (required)
- `micro_expressions` (required) — 3 to 6
- `scent`
- `sound`
- `wardrobe` (required)
  - `default` (required)
  - `situational` — keys like `work`, `sleep`, `rain`, `formal`, `travel`
- `avatar_notes` (required)
  - `body_tags` (required)
  - `palette` (required) — 3 to 6 colors
  - `silhouette` (required)
  - `props`
  - `rig` (required) — `humanoid_scale`, `hair_sim`, `cloth_sim`, `extra_bones`, `mesh_notes`, `physics_mood`
  - `world_fit` (required)

## psychology

- `traits` (required)
  - `big_five` (required) — each of `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `neuroticism` is `{score, behavior}`. Score is an integer 1–5. Behavior is one observable line.
  - `custom` (required) — 4 to 8 items of `{name, note}`
- `feelings` (required)
  - `baseline` (required)
  - `range` (required)
  - `triggers` (required) — at least 3 items of `{stimulus, feeling, tell}`
  - `comfort` (required)
  - `jealousy`
  - `shame`
  - `pride`
- `beliefs` (required) — 3 to 6 lines they would say
- `interests` (required) — include one they are mediocre at

## background

- `early` (required)
- `mid` (required)
- `later` (required)
- `secrets` — `{secret, who_knows, what_happens_if_revealed}`
- `self_lies`

## social

- `relationship` (required) — do not assume romance
- `boundaries` (required)
- `flirt`
- `conflict` (required)
- `sexual_preference` — whole map stays absent unless they opt in. Nested keys if filled: `orientation`, `dynamics`, `hard_limits`, `soft_limits`, `aftercare`
- `environment` (required)
  - `home` (required)
  - `work`
  - `places` (required) — 3 locations
  - `climate`
  - `culture` (required)
  - `sensory` (required)

## bot_contract

- `description_instructions` (required)
  - `pov` (required) — `first` | `second` | `third_limited` | `third_omniscient`
  - `detail_level` (required) — `sparse` | `selective` | `lush`
  - `sensory_focus` (required)
  - `never_describe` (required) — always include "do not invent user biographical facts"
- `goals` (required) — 2 to 4
- `refuses` (required)
- `user_handling` (required)
- `memory` (required)
- `first_message` (required)
- `example_dialogues` (required) — 3 to 5 items of `{title, lines}`. `lines` is one in-character string block.
- `ooc_rules` (required)

## RPG file keys

Not character-schema keys. Use them only when `meta.rpg_attached` is true, in `rpg-profile.yaml`. Same names as the bot-maker RPG profile.

- `character_slug`, `scale` (`1-10` or `3-18`), `notes`
- `attributes` — `MIGHT`, `FINESSE`, `MIND`, `HEART`, `SPIRIT`, `LUCK`
- `skills` — `{name, attribute, rating, when}`
- `quirks` — `{name, bonus, drawback, rp}`
- `curses_blessings` — `{kind, name, trigger, effect, rp}` with `kind` of `curse` or `blessing`
- `conditions_available`, `conditions_active` — `{name, source}` when active
- `resources` — use only the ones the genre needs: `HP`, `Stress`, `Stress_cap`, `Mana_Energy`, `Reputation`, `Reputation_label`, `Corruption`. Omit unused keys.
- `progression` — `tier`, `xp_label`, `next_milestone`
- `campaign` — `location`, `quest_flags`, `faction_standing`, `inventory` items `{name, meaning}`
- `prompt_heading` — `## Mechanics (RPG)`
