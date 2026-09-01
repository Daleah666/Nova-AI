# RPG system (tabletop feel, story mechanics)

This is a **character-and-campaign** layer. It answers “who are they under pressure?” with numbers, quirks, and flags.

It is **not** a fight simulator.

- Do **not** write combat rounds, initiative, attack rolls, damage dice vs HP as a loop, or weapon tables.
- Do **not** write loot tables, rarity drops, gold economies, or gear treadmills.
- Inventory is **story objects** (a cracked lighter, a letter, a key) — not +1 swords.

When RPG mode is on, attach `rpg-profile.yaml` and merge a `## Mechanics (RPG)` block into the system prompt. See [prompt-engineering.md](prompt-engineering.md).

## Why numbers exist

A bot without mechanics will invent competence. A bot with **MIGHT 3** will not kick a steel door in, and that failure is character. Stats exist so the model has a spine: what they are good at, what costs them, what a bad night does to their voice.

Teach the user: “These numbers are personality made countable. We will derive them from traits, not from a power-fantasy wishlist — unless they *want* a power fantasy, and then we still write the cost.”

## Attributes

Six attributes. Every character has all six.

| Attribute | Means | High looks like | Low looks like |
| --- | --- | --- | --- |
| **MIGHT** | Body, force, stamina, physical courage | Carries, endures, stands their ground | Tires, avoids lifts, flinches from impact |
| **FINESSE** | Precision, stealth, craft, timing | Quiet hands, locks, needles, balance | Drops things, loud, clumsy under eyes |
| **MIND** | Reason, recall, pattern, fact-perception | Connects clues, remembers names | Misses the obvious, freezes on numbers |
| **HEART** | Empathy, bonds, social read, care | Softens rooms, reads faces | Misreads, isolates, performs instead of feels |
| **SPIRIT** | Will, faith, inner fire, integrity under fear | Holds a vow, refuses corruption | Breaks, bargains, goes hollow |
| **LUCK** | Coincidence, timing, the world's thumb | Doors open; the right person is there | Timing bites; the match is damp |

### Two legal scales — pick one per campaign

Document the choice in `rpg.scale` and never mix them on one character.

**1–10 (recommended for bots)**  
5 is ordinary. 7 is notably good. 9 is legendary-in-this-story. 1 is a defining weakness. Easy to explain: “out of ten.”

**3–18 (classic tabletop)**  
10–11 is ordinary. 14–15 is professional. 17–18 is peak human-or-equivalent. Use if the user already thinks in D&D-ish numbers.

Conversion if you must switch later: `d20_score ≈ round(3 + (ten_score * 1.5))` and the reverse `ten_score ≈ round((d20_score - 3) / 1.5)`. Prefer not switching.

### Deriving stats from personality

Do not ask the user to “assign points” first. Propose a spread from traits, then let them nudge.

Rough map (1–10 scale):

- High **conscientiousness** → MIND or SPIRIT up, not automatically MIGHT.
- High **extraversion** → HEART up; does not raise LUCK.
- High **neuroticism** → SPIRIT or HEART may be high *or* brittle; add Stress resource.
- Physical-adjacent traits (`sure-footed`, `frail`, `heavy-handed`) → MIGHT / FINESSE.
- Beliefs about fate, gambling, “the city likes me” → LUCK.
- Occupation: detective → MIND + HEART; dancer → FINESSE + HEART; priest → SPIRIT + HEART.

Keep the array **uneven**. A flat 6-across is a blank person. One 8, one 3, the rest 4–7.

## Skills (tagged to attributes)

Skills are optional named specialties. Each skill has `attribute`, `rating` on the **same scale** as attributes, and a one-line when-it-applies.

Suggested pool (pick 4–8 that the character will actually use):

| Skill | Attribute | Use when… |
| --- | --- | --- |
| Endure | MIGHT | Pain, weather, long watches |
| Force | MIGHT | Lifting, breaking mundane barriers (narrate; no HP loop) |
| Sneak | FINESSE | Not being seen or heard |
| Craft | FINESSE | Making, mending, picking, sleight |
| Notice | MIND | Clues, tells, inconsistencies |
| Lore | MIND | What their education actually covers |
| Read-person | HEART | Motives, lies, when to stop pushing |
| Persuade | HEART | Asking, bargaining, performing |
| Steady | SPIRIT | Fear, temptation, keeping a vow |
| Sense-unseen | SPIRIT | Faith, omen, “this room is wrong” (genre-gated) |
| Gamble | LUCK | Risks they cannot skill their way out of |
| Timing | LUCK | Arriving late/early, lucky coincidence |

A skill cannot exceed its attribute + 2 on the 1–10 scale (or +4 on 3–18). If they want a genius lockpicker with FINESSE 3, that is a **quirk**, not a hidden 10.

## Quirks (2–4)

A quirk is a **permanent flavor modifier**: one bonus and one drawback, both playable.

Template:

```yaml
- name: Rain-Memory
  bonus: "Advantage on Notice when it is raining or the scene is wet."
  drawback: "Disadvantage on Read-person in bright, dry, crowded rooms — too many edges."
  rp: "Wipes a window with a sleeve before answering a hard question."
```

Rules:

- 2–4 quirks. Two is enough for Quick; four is a Full/RPG character.
- Bonus and drawback must both fire in ordinary play, not once-per-campaign.
- No “+2 to everything.” No loot-like “wears a ring of X.”
- Quirks **evolve** on milestones (see Progression). They do not get replaced by better gear.

## Curses and blessings (0–2)

Named. Each has a **trigger** and an **effect**. Curses hurt *and* characterize. Blessings help *and* cost attention (a blessing that never complicates is just a stat bump — rewrite it).

```yaml
- kind: curse
  name: Borrowed Names
  trigger: "When asked who they are, or when introducing themselves to someone new."
  effect: "Must hesitate; may almost give the last identity they built. SPIRIT check to stay themselves."
  rp: "Touches their own collarbone as if checking a name-tag that is not there."
```

Zero is valid. Two is the maximum at creation. A blessing and a curse is a classic pairing.

## Conditions

Temporary states. List **active** ones on the profile. The bot should apply and clear them when fiction warrants — not every paragraph.

Each condition has mechanical guidance **and** RP guidance. Mechanics here mean: advantage/disadvantage, resource ticks, what checks get harder. Still no combat-round loop.

| Condition | Mechanical | RP |
| --- | --- | --- |
| **Afraid** | Disadvantage on SPIRIT (Steady) and on bold MIGHT acts. Advantage on Sneak if hiding. | Shorter sentences. Eyes on exits. |
| **Obsessed** | Advantage on the object of obsession (Notice, Lore). Disadvantage on everything else that competes for attention. | Loops back to the topic. Misses farewells. |
| **Drained** | −2 (1–10 scale) to MIGHT and SPIRIT until rest. Stress cannot fall. | Flat voice. Sits on the nearest edge. |
| **Inspired** | Advantage on Craft, Persuade, or the skill named when the condition was applied. Expires after one true use or a scene. | Speaks faster. Hands busy. |
| **Shame-sick** | Disadvantage on HEART (Persuade) with people who saw the source. | Over-explains or goes mute. |
| **Beloved** | Advantage on HEART with the named person. Disadvantage on Notice for threats to anyone else. | Body orients toward them. |
| **Hollow** | Cannot spend SPIRIT for Steady. LUCK checks become the only way out. | Courteous, empty, too agreeable. |
| **Wired** | Advantage on FINESSE; Stress ticks up each scene it remains. | Taps, paces, laughs at the wrong beat. |

Custom conditions are allowed if they follow the same two-column pattern.

## Resources (subset per genre)

Track only what the story will spend. Default starting values on 1–10 attribute campaigns:

| Resource | Default | Genre | Spend / recover |
| --- | --- | --- | --- |
| **HP** | 2 + MIGHT | Any body-risk story | Harm as narrative consequence; recover with rest, care, time — not potions from a table |
| **Stress** | 0, cap 2 + (6 − SPIRIT, min 1) | Mystery, horror, romance, noir | Rises on triggers and failed Steady; at cap, take Afraid, Hollow, or a self-lie acting out |
| **Mana / Energy** | SPIRIT or FINESSE | Magic, psi, exhausting craft | Spend to do the impossible once; recover via the character’s actual ritual (tea, prayer, sleep) |
| **Reputation** | HEART-ish or 5 | Social, court, city | Faction-facing; a number plus a *label* (“owed by the archive”) |
| **Corruption** | 0 | Occult, crime, fae bargains | Rises when they take the easy wrong; at 3+, a quirk mutates or a curse lands |

Noir detective: HP + Stress + Reputation. Skip Mana and Corruption unless the case is occult.

## Checks

When the outcome is in doubt **and** failure would change the scene:

1. Name the attribute or skill.
2. Roll **d20 + rating** vs **difficulty**.
3. Apply advantage/disadvantage from quirks and conditions (roll twice, take higher/lower). Do not stack three advantages into a number soup — pick the strongest.

Difficulty guide (1–10 ratings added to d20):

| Difficulty | Number | Meaning |
| --- | --- | --- |
| Easy | 10 | Tired amateur still usually makes it |
| Routine | 14 | Professional baseline |
| Hard | 18 | Costs, prep, or a quirk should be in play |
| Extreme | 22 | Possible because of a blessing, Inspired, or a ugly bargain |

On 3–18 scale, use the same d20 + score vs 12 / 16 / 20 / 24.

**The bot narrates; it does not become a dice UI** unless the user wants to see rolls. Default: “You try the lock. FINESSE + Craft, hard — it bites back; the pin snaps. They swear once, then go still.” If the user asks to roll, show the math.

Failed checks must change something: time, Stress, a condition, a relationship flag. Never “nothing happens.”

## Progression (no gear treadmill)

Characters change by **milestones**, not by shopping.

Suggested XP tiers (name them in-world: cases closed, nights survived, vows kept):

| Tier | After | What evolves |
| --- | --- | --- |
| 0 | Creation | Baseline quirks |
| 1 | First real consequence | One quirk’s drawback *or* bonus sharpens; optional +1 to the attribute that got them in trouble |
| 2 | A belief breaks or is proven | Rewrite one self-lie; condition pattern may become a new quirk |
| 3 | Campaign turn | A curse may become a blessing (or the reverse); max +1 to two attributes for the whole campaign |

Never add a magic sword as the upgrade. If they find an object, it is a **story object** that might *enable* a quirk (“the lighter only works when they tell the truth”).

## Campaign state

Keep these on the RPG profile so the bot does not invent a different city every session:

- **quest_flags** — named booleans or short strings (`case_open: "black-iris"`, `knows_the_alias: true`)
- **faction_standing** — map of faction → label + optional number (`archive: "tolerated"`, `night-watch: "owed a favor"`)
- **location** — where they are *now*
- **inventory** — list of story objects with a one-line meaning, not stats

## Merging into the system prompt

When `meta.rpg_attached` is true, append this exact heading and contents (filled) to the system prompt:

```markdown
## Mechanics (RPG)

Scale: <1-10 or 3-18>. Checks: d20 + attribute or skill vs difficulty.
No combat rounds. No loot. Inventory is story objects.

Attributes: MIGHT … FINESSE … MIND … HEART … SPIRIT … LUCK …
Skills: …
Quirks: (bonus / drawback each)
Curses/blessings: …
Conditions now: …
Resources: …
Campaign: location, flags, factions, objects.

When outcome is uncertain, apply a check and let failure cost time, Stress,
a condition, or a relationship flag. Let quirks fire before numbers.
Stay in character; do not become a rules lawyer unless the user asks for the math.
```

Full template: [templates/rpg-profile.yaml](../templates/rpg-profile.yaml).
