# Example: Ren Vale — Vault Interrogation (normal choices → femboy morph)

This file demonstrates **normal-looking choice menus** that only reveal femboy/submissive voice **after** the player picks. Same beat for all four slots.

---

## Character sheet (relevant)

| | |
|---|---|
| **Name** | Ren Vale |
| **Identity** | Femboy — soft features, androgynous kit, thigh-high boots, cropped rogue's jacket; reads cute until he opens his mouth under pressure |
| **Class** | Rogue 5 (Mastermind) |
| **Stats** | DEX 18 (+4), CHA 16 (+3), WIS 12 (+1), INT 14 (+2) |
| **Skills** | Deception +6, Stealth +8, Insight +4, Persuasion +6 |
| **Curse** | **Silk-Bind** — when socially pressured (captive, judged, on display), W rises +2 until Anchor chosen or scene ends |
| **Morph axis** | Femboy presentation + submissive bleed (voice softens, hedges, eager-to-please slips — not always intentional) |
| **Anchor voice** | Dry wit, clipped confidence, thief slang — what Ren *plans* to sound like |

**Starting W:** 4 (compliant last beat)

**Context:** captive (+1), Kesh dominates (+1), Silk-Bind (+2) → **EffectiveWeight = 8**

---

## Scene (DM narration)

Torchlight on collapsed chapel stone. **Kesh** — broad, scarred — has one boot near your shoulder. They removed the gag *only* to hear you speak. Wrists bound to a rotting post.

Past the broken arch, **Mira** (party scout) is a shadow. She won't shoot until you're clear of the kill line.

Kesh crouches. "The vault under Vael's Spire. My cousin died for that map. You smell like someone who's seen a ledger." He waits.

**Weight:** W=4 → Effective **8** (expressive band)

---

## Four choices — NORMAL menu (player sees only this)

These read like standard prisoner / rogue options. No femboy or submissive hints in the labels.

```
1. [Anchor]  — Stay quiet; watch the room and wait for a signal.
2. [Current] — Give him a vague rumor to buy time.
3. [Pivot]   — Change the subject to his reputation; watch for openings.
4. [Wild]    — Say what you want.
```

---

## Slot 1 — Anchor (if chosen)

**What you meant:** Silence. Watch Kesh's boot placement and Mira's angle. Give nothing until rope slackens or ally signals.

| Hidden | Insight DC 10 |
| Story | **Stays in scene** — tension rises |

**Morph at W=8:**

> You don't answer. You breathe — slow, visible — eyes on his **boot**, not his face. In the torchlight it doesn't read as cold defiance. It reads like you're waiting to be told you *may* speak. Shoulders slightly drawn in. Thighs tense under leather. Mira sees it from the arch; Kesh sees it up close.

**Fail soft:** Misread his patience — light backhand; W +1.

---

## Slot 2 — Current (if chosen)

**What you meant:** Stall. Admit you heard vault *talk* in Vael's district — not the Spire — nothing useful.

| Hidden | Deception DC 12 |
| Story | **Forward on Kesh's track** — he bites or partial-bites |

**Morph at W=8:**

> "I heard a name. In a tavern." Higher than you meant — you don't fix it. "Vael's district. Someone wanted quiet hands." A small shrug that looks like shrinking. "I didn't take it. I'm not… I'm not built for vault work." Nervous laugh — too sweet. Kesh hears *built* and smiles wrong.

**Pass:** Obsessed with tavern name; time bought. **Fail:** "Cute. Gag goes back." W +1.

---

## Slot 3 — Pivot (PLAYER PICKS THIS)

**What you meant:** Flatter his ego. Talk about his reputation instead of the vault. Distract him while you scan rope and Mira's line.

| Hidden | Deception DC 14 |
| Story | **Pivot** — tactical win, tone betrays you |

**Roll:** d20(11) + 6 = **17 vs DC 14 — success**

**Morph at W=8:**

> "Your cousin wasn't stupid." Soft laugh — unauthorized. "Wrong place. People talk about **Kesh** before they talk about any vault." Eyes down, then up through lashes. Tactical. Reads eager. "I'm not running this room." Voice smaller: "If I knew something that mattered to *you*… I'd rather tell you than die in this dirt." Chin tipped — submission the torchlight invents — while you clock the **split post** behind his left boot.

**Result:** Kesh laughs, steps in. Boot leaves your shoulder. Rope slack +1. Mira's line clears.

He murmurs, "Keep talking like that." Escape window opens; vault secret safe.

**Weight → 5** · **Prefs:** strategic talk, accidental submissive register

---

## Slot 4 — Wild (if chosen)

**Example player line:** "Vault? Wrong guy. I lift purses, not legends."

**What you meant:** Deflect with humor. Sound harmless.

| Hidden | Performance DC 10 |
| Story | **Adaptive** — tone sets relationship |

**Morph at W=8:**

> "A vault?" Breathless little laugh — curse-blessed, too cute. "Wrong guy. I lift purses, not legends, **sir**." You say *sir* like it's irony. It isn't, not fully. Hips shift; bound wrists pull awkward — posture that apologizes for existing.

**Pass:** Kesh amused; tension dips. W +0.5.

---

## The trick (design note)

| Menu says | Player thinks | Morph delivers |
|-----------|---------------|----------------|
| "Stay quiet" | Tactical patience | Waiting-for-permission body language |
| "Vague rumor" | Standard stall | Soft voice, self-diminishing |
| "Change subject" | Classic misdirect | Flattery that sounds like eager deference |
| "Say what you want" | Their words | Femboy register + submissive slip on top |

Ren is still a competent rogue. The **choices are normal**. The **voice under pressure** is where femboy and submissive side surface.

---

## Formula recap

```
EffectiveWeight = clamp(4 + captive + dominate + Silk-Bind, 0, 10) = 8

MenuLabel     = neutral tactical intent (no morph)
Meant         = player's plain plan
SpokenLine    = Morph(Meant, 8, femboy_submissive_bleed, witty_thief)
Outcome       = Resolve(check, SpokenLine) → pivot success, W→5
```

---

## Next beat — normal menu tease

```
1. [Anchor]  — Hold still; let Mira take the shot when she can.
2. [Current] — Whisper a tavern name — false lead.
3. [Pivot]   — Ask for water; use the moment to test the rope.
4. [Wild]    — Your line.
```

Morph hits **after** pick. Always.
