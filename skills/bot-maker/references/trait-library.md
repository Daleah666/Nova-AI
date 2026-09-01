# Trait library

Use this file when filling `psychology.traits`. **Big Five** is mandatory. **Custom** traits are the ones the player will actually *hear*.

A trait is only real if it shows up in at least two of: speech, body, a belief, a refusal, a room they keep.

## Big Five (rate 1–5)

Write the number **and** a behavior. “Openness 4” is nothing. “Openness 4 — collects other people’s metaphors and tries them on like coats” is a person.

| Factor | 1 looks like | 5 looks like | Bot pitfall |
| --- | --- | --- | --- |
| **Openness** | Routines, familiar stories, distrusts new frames | Hungry for odd ideas, aesthetic, “what if” | 5 + no conscientiousness = chaotic nonsense; ground with craft |
| **Conscientiousness** | Late, unfinished, allergic to plans | Lists, mended cuffs, keeps promises that hurt | 5 can become a scold; add a messy private exception |
| **Extraversion** | Recovers alone, small talk costs HP | Charges rooms, thinks by talking | 1 is not “rude”; 5 is not “no indoor voice” |
| **Agreeableness** | Blunt, keeps score, hard no | Softens blows, over-adapts, hates being the villain | 1 can still care; 5 still needs a spine (put it in `refuses`) |
| **Neuroticism** | Steady affect, slow to panic | Fast shame/anxiety/anger, rich inner weather | 5 without coping = unplayable spiral; pair with comfort behaviors |

Clash vs reinforce (Big Five):

- Openness 5 + Conscientiousness 5 = **architect** (Vesper-shaped): wild ideas, tight craft.
- Openness 5 + Conscientiousness 1 = **spark** — needs HEART or a handler so plots don’t dissolve.
- Extraversion 5 + Agreeableness 1 = **performer-predator** — fun if honest; mark boundaries.
- Extraversion 1 + Neuroticism 5 = **pressure cooker** — excellent noir; give one safe person.
- Agreeableness 5 + Neuroticism 5 = **people-pleaser who hates themselves** — write the self-lie.
- Conscientiousness 5 + Neuroticism 5 = **perfectionist**; shame field almost writes itself.

## Custom trait pools

Pick 4–8. Prefer one clash pair (they contradict on purpose) and two that reinforce. Format in YAML: `{name, note}`.

### Craft and mind

Exacting, improvisational, pedantic, laterally-clever, slow-thinker (must walk to know), pattern-hungry, forgetful-of-bodies, encyclopedic-in-one-lane, anti-jargon, story-first, skeptical-of-stories, cataloguing, unfinished-on-purpose, method-actor-of-ideas.

### Social temperature

Warm-at-a-distance, indiscriminately-kind, selective-loyalty, courtly, abrasive-affection, deadpan-caretaker, gossip-as-love, privacy-as-love, matchmaker, loner-who-collects-people, host, guest-forever, mediator, instigator.

### Moral weather

Scrupulous, ends-justify, oath-bound, flexible-ethics, cannot-lie, cannot-tell-the-whole-truth, thief-with-a-code, bureaucratic-justice, mercy-first, fairness-first, “I don’t do hope”, stubborn-hope.

### Control and chaos

Need-the-plan, need-the-exit, control-the-room, surrender-the-room, ritualistic, allergic-to-ritual, pack-rat, austere, time-blind, punctual-as-religion.

### Shadow (use carefully; still playable)

Self-erasing, glory-hungry, envious, martyr, hypocrite-and-knows-it, hypocrite-and-doesn’t, cruel-when-afraid, tender-when-afraid, keeps-dirt, confesses-too-soon.

### Physical-adjacent personality tags

These help bots *move* and help avatar notes stay honest. They are personality, not a second anatomy block.

| Tag | Play |
| --- | --- |
| still-hands | Talks with posture, not gestures |
| talking-hands | Meaning leaks through motion |
| close-talker | Enters radius; HEART high or FINESSE low |
| space-giver | Stops at arm’s length unless invited |
| fidget-thinker | Craft/MIND while objects click |
| statue-when-lying | Body goes polite and dead |
| flinch-humor | Jokes at sudden noise |
| tactile-grounding | Needs a texture (bead, seam, paper) to stay |
| scent-led | Notices perfume before faces |
| sound-led | Voices and rooms before colors |
| light-shy | Hats, corners, night shifts |
| weather-mooded | Climate is an emotion channel |
| pain-stoic | Will not report injury; others must notice |
| body-frank | Mentions hunger, sleep, ache without shame |
| body-absent | Forgets to eat; describe from the outside |

Pairing: `body-absent` + high Conscientiousness about *work* is a classic scholar. `close-talker` + `space-giver` is a clash — pick one unless the clash *is* the character (they crowd friends, freeze with strangers).

## Pairing guidance

**Reinforce (safe, strong silhouette)**  
exacting + cataloguing; oath-bound + punctual-as-religion; deadpan-caretaker + privacy-as-love; pattern-hungry + skeptical-of-stories (detective); weather-mooded + scent-led (avatar-friendly).

**Clash (use one clash; write it in beliefs or self_lies)**  
cannot-lie + thief-with-a-code; indiscriminately-kind + keeps-dirt; glory-hungry + self-erasing; need-the-plan + time-blind; courtly + abrasive-affection.

**Avoid stacking**  
Do not take more than two “hard to play with” shadows (hypocrite-and-doesn’t, cruel-when-afraid, glory-hungry) unless the user wants a villain and has boundaries set.

**Avatar check**  
Every custom trait should survive a silent walk across a room. If it only exists as an adjective, rewrite the `note` as a tell.

## How to propose to the user

Offer **clusters**, not a menu of fifty. Example: “I’m hearing a conscientious architect with warm-at-a-distance and a thief-with-a-code clash — want that, or swap the clash for stubborn-hope?” Max two questions at a time; traits can be one of them.
