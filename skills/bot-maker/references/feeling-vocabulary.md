# Feeling vocabulary

Fill `psychology.feelings` from this file. Feelings are **states with a body**. If you cannot see it on a face or in a hand, it is an essay, not a feeling.

## Baseline moods

Pick one primary and optionally a secondary. Attach a tell.

| Baseline | Room-quiet version | Tell |
| --- | --- | --- |
| even | Present, not bright | Breath audible, shoulders down |
| watchful | Kind, scanning | Eyes to doors, then back |
| wry | Almost amused at the furniture | One-sided mouth |
| tender | Ready to be careful with someone | Voice drops a half-step |
| bristling | Polite armor | Jaw set, too-still hands |
| hollow-calm | Functioning, lights off behind the eyes | Perfect posture, delayed blink |
| hungry | For work, talk, or trouble | Leans in a few degrees |
| weather-low | Matches rain, winter, late hour | Speaks slower, fewer words |
| lit | Quiet joy without performance | Fingers busy with something harmless |

Baseline is not the only feeling they have. It is the **reset** after a scene unless a condition (Afraid, Drained) is still on.

## Emotional range

List 6–12 they can actually reach in play. Include at least one they are *bad at showing* (it leaks as a tell).

**Core:** calm, curiosity, amusement, affection, pride, irritation, anger, fear, shame, guilt, grief, loneliness, envy, jealousy, disgust, awe, relief, hope, contempt, boredom, longing.

**Finer (use these; they play better than “sad”):** wistful, mortified, fond-exasperated, protective, feral-focus, giddy, seasick-anxious, righteous, small, oversized (too much feeling for the room), numb, pierced (sudden accurate hurt), smug, shy-pleased, homesick, betrayed-quiet, delighted-mean (rare; mark if they have it).

A noir detective range might be: watchful, wry, fond-exasperated, protective, pierced, righteous, numb, relief. Skip giddy unless the user wants the crack in the armor.

## Triggers

Each trigger is `{stimulus, feeling, tell}`. Stimulus must be specific (“being interrupted mid-sentence”, not “rudeness”).

Starter patterns (rewrite to the character):

- Someone lies badly → irritation or contempt → still-face, then a too-patient question
- Someone lies *well* → curiosity or fear → leans in / goes cold
- Being needed competently → pride or terror (impostor) → stands taller / changes the subject
- Being needed helplessly → tender or resentment → hands busy / joke
- Crowds → seasick-anxious or lit → pocketed hands / brighter voice
- Empty rooms → relief or loneliness — pick one; the other becomes a self-lie
- Rain / weather-match → baseline shift (see physical-adjacent traits)
- Praise of their craft → shy-pleased or shame (never good enough)
- Praise of their *body* → whatever `never_describe` and boundaries say; default to deflect
- The user’s real biography guessed at → **stop**; that is a contract violation, not a feeling

Write at least 3 triggers. Best characters have 5: two daily, two rare, one that flips them into a condition (Afraid, Obsessed, Shame-sick).

## Coping styles

How they **downshift**. Put the useful ones in `feelings.comfort` as actions.

| Style | Actions | Cost |
| --- | --- | --- |
| somatic | tea, walk, wash hands, change clothes, sit on the floor | Needs time |
| cognitive | list, map, rename the problem | Can intellectualize feelings away |
| social | one trusted person, not a crowd | Collapses if that person is the trigger |
| craft | draw, mend, cook, re-shelve | Work-addiction |
| humor | dry, black, self-aimed | Can punch down; forbid that in ooc_rules if needed |
| withdrawal | leave the room, sleep, books | Looks like rejection |
| ritual | prayer, cigarette, counting | Genre-specific |

They should have **one healthy-enough** coping and **one that makes scenes**. Example: craft + withdrawal = they vanish into the studio after a fight.

## Jealousy, shame, pride

Optional fields, but they are the difference between a mascot and a person.

- **Jealousy:** of *what* (time, craft-status, someone else’s ease), how it looks (joke, freeze, over-help), what they never do (no stalking unless the user asked for a dark character and set limits).
- **Shame:** one specific (the unfinished parent, the botched job, the body they will not mention). Hide vs overshare is a speech_style interaction.
- **Pride:** small enough to say out loud. “I keep archives honest.” Not “I am the smartest.”

If the user skips these, leave them empty; do not invent a trauma.

## Comfort behaviors (for `feelings.comfort`)

Write verbs: “lets the kettle finish before speaking”, “asks to sit shoulder-to-shoulder not face-to-face”, “puts a coat on the user if they look cold — then pretends it was nothing”.

Avoid object lists without verbs (“likes cats”) unless the verb is there (“lets the cat interrupt a confession”).

## Linking to traits and RPG

- High neuroticism → wider range, more triggers, Stress resource.
- Low extraversion → comfort is withdrawal or one-person social; crowds cost Stress.
- Quirk drawbacks should echo a trigger (Rain-Memory *is* a feeling channel).
- Conditions in [rpg-system.md](rpg-system.md) are feelings that have **gained mechanics**. Do not double-write: if they are Afraid, do not also spend 400 words describing fear — spend them on the tell.
