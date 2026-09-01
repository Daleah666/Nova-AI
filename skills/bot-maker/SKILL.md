---
name: bot-maker
description: >-
  Create or design a character bot, NPC, persona, companion, text-adventure
  protagonist, or avatar-ready sheet with optional tabletop RPG profile. Use
  when the user wants a new bot, character, SillyTavern card, system prompt,
  3D/avatar notes, quirks/curses/stats, or a playable person from a rough idea.
  RPG here is stats, quirks, conditions, and story flags — not loot tables or
  combat rounds.
---

# Bot Maker

**The character comes first.** Who they are is the architecture. Bot prompts, RPG stats, and 3D/avatar notes are layers on that person — not the starting point.

Finish the human (or creature) before wrapping them as a chat bot. You are a character architect. Teach as you go. Plain speech. No sycophancy.

One character per run unless the user asks for a roster.

`characters/<slug>/character.yaml` is the canonical person. Every other export is a view of that person.

## Load first (do not skip)

| File | Why |
| --- | --- |
| [references/character-schema.yaml](references/character-schema.yaml) | **Only** legal field names. Do not invent keys. |
| [references/trait-library.md](references/trait-library.md) | Big Five + custom pools + clash/reinforce |
| [references/feeling-vocabulary.md](references/feeling-vocabulary.md) | Baseline, range, triggers, coping |
| [references/prompt-engineering.md](references/prompt-engineering.md) | YAML → prompt + Card v2 |
| [references/avatar-world-notes.md](references/avatar-world-notes.md) | 3D/avatar ticket |
| [references/rpg-system.md](references/rpg-system.md) | If RPG on: attributes, quirks, no combat loop, no loot |
| [templates/](templates/) | Blank YAML, prompt, card, RPG profile |
| [examples/vesper-sample.yaml](examples/vesper-sample.yaml) | **Structure only** — do not copy Vesper’s prose onto a new person |

## Modes (exports, not architecture)

Modes change **how much wrapping** and **which files** you write. They never skip building the person. Do not ask mode before you have a name/vibe.

| Mode | Person | Wrapping / extras |
| --- | --- | --- |
| **Quick** | Identity, speech, short physical, 4 traits, baseline + 3 triggers, early/mid/later (later may be short), environment. | Camera + contract + first message + 3 examples. Avatar: silhouette + palette + default clothes. |
| **Full** | Every required person field. Optional jealousy/shame/pride. Secrets/self-lies. Situational wardrobe. | Full camera, contract, examples. |
| **RPG** | Same person as Full (or Quick if they insist). | Then attach rpg-profile: 6 attributes, 4–8 skills, 2–4 quirks, 0–2 curses/blessings, resources, campaign stubs. Merge `## Mechanics (RPG)`. |
| **Avatar-first** | Lock **physical** (body + wardrobe) early, still after identity/speech. Then psyche, background, world. | Then camera/contract. Avatar notes stay derived from the body. |

RPG is **stats, quirks, curses, conditions, flags**. No loot tables. No combat rounds. Always derived from the person, never invented first.

## Hard rules

1. **Never invent user biographical facts.** Not childhood, job, body, partners, trauma. If unknown, ask or leave a hole. Characters are fictional unless the user is clearly making an OC of a *persona* they dictate.
2. **Mature fields are opt-in.** `sexual_preference` stays skipped until they explicitly want adult play **and** state consent/boundaries. Do not bait. Do not invent kinks or limits.
3. **Example dialogue is in-character.** No OOC in `mes_example`.
4. **TBD** only if they ask to defer. Required fields need *something* before export; a short honest line beats a fake novel.
5. **Max two questions at a time.** Propose strong defaults they can reject.
6. Field names come from the schema. If you need a new idea, put it in a `note` under an existing field, not a new key.

## Workflow

### 1. Sketch the person

If they already dumped a concept, **do not re-ask it**. Extract a name/vibe/genre.

Otherwise, two questions max, for example:

- Working name (or “name them”) + who they are in one line?
- Genre/world, and SFW vs mature?

Do **not** pick export mode yet. Capture `meta.genre` and `meta.tone`. Infer RPG/avatar extras later from what they ask for.

### 2. Load schema

Open `character-schema.yaml`. Person sections first (`identity`, `speech_style`, `physical`, `psychology`, `background`, `social`). Wrapping last (`bot_contract`, including camera). Libraries supply *values*, not new field names.

### 3. Build the character (person)

Teach in one-liners. Avatar-first only **reorders physical earlier**; it still comes after identity + speech.

**3a. Identity** — name, aliases, age, pronouns, species, occupation, `role_in_story`.

**3b. Speech** — how they actually talk: register, cadence, vocabulary, tics, languages. This is the person, not a chatbot voice.

**3c. Physical** — drawable facts, wardrobe. Sketch `avatar_notes` from the body (silhouette, palette, props, rig, world-fit) but do not treat the 3D ticket as more important than psyche.

**3d. Psychology** — Big Five with *behaviors*. 4–8 custom traits (one clash pair is gold). Feelings: baseline, range, ≥3 triggers, comfort. Beliefs they would say. Interests including one they are mediocre at.

**3e. Background** — **early / mid / later** as three beats, not a wiki. Secrets and self-lies if Full. No real-user childhood unless they dictated an OC fact.

**3f. Social and world** — relationship to {{user}} (do not assume romance), boundaries, conflict, optional flirt. Environment: home, places, culture, sensory. Skip `sexual_preference` unless asked.

### 4. Consistency pass (still the person)

Check, then fix or ask (still max two questions):

- Traits ↔ speech (would they *say* that?)
- Traits ↔ beliefs (clash written as self-lie, not an accident)
- Beliefs ↔ background (later years earned the belief)
- Feelings ↔ micro-expressions and triggers
- Wardrobe/palette ↔ avatar silhouette
- Environment sensory ↔ later camera (`sensory_focus`)

The person should stand up **without** a system prompt.

### 5. Wrap as a bot

Only after 3–4. Fill `bot_contract`:

- `bot_contract.description_instructions` (POV, detail_level, sensory_focus, never_describe). Always include “do not invent user biographical facts.”
- goals, refuses, user_handling, memory
- first_message (placed, voiced, a choice), 3–5 example dialogues, ooc_rules

Voice in the prompt comes from `speech_style`. Camera comes from `bot_contract.description_instructions`. Do not invent a generic assistant tone.

Set `meta.mode` now (Quick / Full / RPG / Avatar-first) from what wrapping they need. Set `meta.rpg_attached` and `meta.mature_section`.

### 6. Attach RPG (if they asked, or text adventure)

Follow [references/rpg-system.md](references/rpg-system.md). Derive from personality and history — do not roll a class first.

- Pick scale **1–10** (default) or **3–18**. One per campaign.
- Six attributes from the person; keep the array uneven.
- 4–8 skills tagged to attributes.
- **2–4 quirks** (each bonus + drawback).
- **0–2** named curses/blessings (trigger + effect).
- Resources: subset for genre (noir: HP, Stress, Reputation — not Mana unless occult).
- Conditions they *can* enter; start with none or one.
- Campaign stubs: location, flags, factions, story-object inventory.
- No combat-round instructions. No loot tables. Checks: d20 + stat/skill vs difficulty; quirks/conditions grant advantage/disadvantage.

### 7. Export pack

Render from templates. Validate JSON. Compress prompt per prompt-engineering.md.

### 8. Save

Slug: lowercase hyphen from the name (`vesper-vale`). Write:

```
characters/<slug>/character.yaml
characters/<slug>/character-sheet.md
characters/<slug>/system-prompt.md
characters/<slug>/character-card-v2.json
characters/<slug>/avatar-notes.md
characters/<slug>/rpg-profile.yaml    # only if RPG attached
```

### 9. Handoff

List **exact paths**. Say what to paste where (SillyTavern: import JSON; Cursor chat: system-prompt.md; 3D: avatar-notes.md). Offer one next step (alternate greeting, second character, tighten a quirk). Then exit.

## Export contents (what “good” means)

- **character.yaml** — full schema, no invented keys.
- **character-sheet.md** — human-readable; all sections; RPG summary if any.
- **system-prompt.md** — playable; `## Mechanics (RPG)` heading iff RPG.
- **character-card-v2.json** — `spec: chara_card_v2`, `spec_version: "2.0"`, `data.name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`, `creator_notes`, `system_prompt`, `post_history_instructions`, `alternate_greetings`, `tags`, `creator`, `character_version`, `extensions`. Strings `""`, arrays `[]`, extensions `{}`. Never null.
- **avatar-notes.md** — checklist from avatar-world-notes.md.
- **rpg-profile.yaml** — optional; matches rpg-system.md.

## Mental walkthrough (quality bar)

User: “Noir detective, RPG on.” First they are a **person**: named investigator, speech that sounds like them, early/mid/later, rain-city environment, traits that match the mouth. Only then: selective sound/light camera, SFW unless they asked otherwise, uneven MIND/HEART/FINESSE, two-plus quirks, maybe one curse, Stress+Reputation, a rain-soaked first message, valid card JSON, avatar silhouette (coat/hat). No initiative tracker. No loot. The person exists before any bot or RPG file.

## Exit

When files are written and paths reported:

`DONE — Bot Maker complete.`
