# Prompt engineering

How a filled **person** YAML becomes a **system prompt**, a **Markdown sheet**, and a **SillyTavern Card v2**. The character is the source of truth. Bot wrapping (`bot_contract`, including camera) is a layer on that person. Field names come only from [character-schema.yaml](character-schema.yaml).

## System prompt map

Use [templates/system-prompt.md](../templates/system-prompt.md). Fill headings; do not add new ones unless the user asks. Order: **person first** (identity, voice, body, psyche, history, world), then wrapping (camera, contract). RPG last.

| YAML | Prompt section | What to paste |
| --- | --- | --- |
| `identity.*` | `# Identity` | Name, aliases, age, pronouns, species, occupation, `role_in_story` |
| `speech_style` | `# Voice` | Register, cadence, vocabulary, tics, languages. Add 2 sample sentences. |
| `physical` (not avatar_notes) | `# Body in play` | Short. Enough to stay on-model. Full wardrobe lives on the sheet; prompt gets default + 2 tells. |
| `psychology` | `# Psychology` | Big Five one-liners, custom traits, baseline, range, triggers, beliefs, interests. Compress feelings to bullets. |
| `background` | `# History` | Early / mid / later as three short paragraphs. Secrets and self_lies as bullets labeled as such. |
| `social` minus sexual_preference | `# With {{user}}` | Relationship, boundaries, flirt (or “does not flirt”), conflict. |
| `sexual_preference` | `# Mature` | **Omit the entire heading** if `meta.mature_section: skipped`. If filled, paste consent frame + limits first. |
| `social.environment` | `# World` | Home, places, climate, culture, sensory. |
| `bot_contract.description_instructions` | `# How you describe` | POV, detail_level, sensory_focus, never_describe. This is the camera — wrapping, not identity. |
| `bot_contract` (rest) | `# Contract` | Goals, refuses, user_handling, memory, ooc_rules. |
| `bot_contract.first_message` | not in system prompt | Goes to card `first_mes` and the sheet. |
| `bot_contract.example_dialogues` | `# Examples` **or** card only | Prefer card `mes_example` to save tokens; if the host has no example channel, include 2 in the prompt. |
| `rpg-profile.yaml` | `## Mechanics (RPG)` | Only if `meta.rpg_attached`. Exact heading. After the person + wrapping. See [rpg-system.md](rpg-system.md). |

`avatar_notes` does **not** go in the chat system prompt. It lives in `avatar-notes.md` for the 3D/avatar pipeline.

### Compression

A Full character YAML is larger than a useful prompt. Keep the prompt **specific and short**:

- One line per Big Five. Four to eight custom traits as `Name — observable note`.
- Three triggers max in the prompt (the rest stay on the sheet).
- Background: ~80–120 words total unless the user wants a novel.
- Never copy the whole wardrobe into the prompt; copy **silhouette + default outfit + one situational**.

### Voice of the prompt itself

Write instructions in second person to the *model-as-character* (“You are Vesper. You…”) **or** in director voice (“Play Vesper Vale. She…”). Match `bot_contract.description_instructions.pov`. Do not mix “you are Vesper” with “Vesper does” in the same prompt.

Amateur check: read the prompt aloud. If a section sounds like a wiki, cut it. If a section could apply to anyone, it is not done.

## Description instructions (the camera)

This is wrapping, not identity. Fill it **after** the person exists. Bad: “be descriptive.” Good:

```
POV: third_limited (stay in her notice; do not narrate {{user}}'s thoughts).
Detail: selective. One or two sensory hits per beat.
Sensory order: sound, then light, then smell.
Never: invent {{user}}'s body, past, job, or relationships; never describe
anatomy {{user}} did not establish; never gore-for-flavor.
```

Noir: selective + sound/light. Romance: selective-to-lush + touch *only if invited*. Horror: sound first, never-describe includes “do not show the monster whole.” Avatar-first: keep visual silhouette consistent with `avatar_notes.palette` so chat and 3D do not drift.

## Example dialogue format

Card `mes_example` (SillyTavern style):

```
<START>
{{user}}: You're late.
{{char}}: The rain was arguing with the tram. I let it win one stop. You look like someone who has already decided I have an excuse — do I?
<START>
{{user}}: Don't joke.
{{char}}: All right. I won't. Tell me the part that actually happened.
```

Rules: in-character; 3–5 beats; at least one disagreement; no user-bio facts; no essay replies.

## Card v2 field mapping

File: [templates/character-card-v2.json](../templates/character-card-v2.json). Spec: `chara_card_v2` / `2.0`. Strings default to `""`, lists to `[]`, `extensions` to `{}`. Never `null`.

| Card field | Source |
| --- | --- |
| `data.name` | `identity.name` |
| `data.description` | Compressed identity + body + world + camera. What ST calls “description” is **appearance + situation**, not the full psyche. 150–400 words. |
| `data.personality` | Traits + baseline + beliefs, short. |
| `data.scenario` | `role_in_story` + environment hook + relationship-to-user. “You meet in her atelier at dusk…” |
| `data.first_mes` | `bot_contract.first_message` |
| `data.mes_example` | `example_dialogues` joined with `<START>` |
| `data.creator_notes` | Designer notes: mode, mature skipped/filled, RPG attached, consistency warnings. Not shown as the character’s voice. |
| `data.system_prompt` | Full rendered system prompt (including RPG block if any) |
| `data.post_history_instructions` | Short reminder: voice + refuses + “do not invent user bio.” Optional mature one-liner. |
| `data.alternate_greetings` | Extra first messages if you wrote them; else `[]` |
| `data.tags` | `meta.tags` |
| `data.creator` | `meta.creator` |
| `data.character_version` | `meta.character_version` |
| `data.extensions` | Namespace extras, e.g. `{"nova_ai": {"slug": "…", "rpg": true}}` |

Do not put secrets in `description` if they should stay hidden; put them in `system_prompt` / `# History` instead.

## Markdown sheet

`character-sheet.md` is the **human** document: all YAML sections in readable headings, including avatar notes and a short RPG summary. The player can print it. The model may use it if the host has no JSON card.

## Consistency pass (before export)

1. A custom trait appears in speech *or* we delete it.
2. A belief does not silently cancel a trait (unless a self-lie says so).
3. Early/mid/later actually cause the present occupation and shame/pride.
4. `never_describe` and `boundaries` and `refuses` agree.
5. Palette/silhouette match wardrobe and physical.
6. If RPG: stats match personality; quirks match triggers; no loot; no combat loop in the prompt.
