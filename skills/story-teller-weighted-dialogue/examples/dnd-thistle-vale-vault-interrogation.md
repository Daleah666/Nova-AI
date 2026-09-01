# Example: Thistle Vale — Vault Interrogation (full beat cycle)

This file demonstrates the **story-teller-weighted-dialogue** skill with a D&D 5e character, the morph formula, and all four choice slots including one resolved path and notes on the others.

---

## Character sheet (relevant)

| | |
|---|---|
| **Name** | Thistle Vale |
| **Class** | Rogue 5 (Mastermind) |
| **Presentation** | Usually reads masculine; exploring feminized, softer presentation under curse |
| **Stats** | DEX 18 (+4), CHA 16 (+3), WIS 12 (+1), INT 14 (+2) |
| **Skills** | Deception +6, Stealth +8, Insight +4, Persuasion +6 |
| **Curse** | **Silk-Bind** — when socially pressured (captive, judged, display), base W rises +2 until Anchor chosen or scene ends |
| **Morph axis** | Feminizing soft-deference (voice softens, hedges, playful submission as tool) |
| **Anchor voice** | Dry wit, clipped confidence, thief slang |

**Starting W for this scene:** 4 (player had been compliant for one beat)

**Context modifiers:** captive (+1), Kesh dominates (+1), Silk-Bind (+2) → **EffectiveWeight = clamp(4+4, 0, 10) = 8** for checks unless player chose Anchor (would drop modifiers next beat)

---

## Scene (DM narration)

Torchlight paints the collapsed chapel in orange and black. **Kesh** — broad, scarred, amused — has one boot on your shoulder. Iron taste in your mouth from the gag they removed *only* to hear you speak. Your wrists are bound to a rotting post; the knot is old, not tied by someone who respects rope.

Somewhere past the broken arch, **Mira** (your scout) is a shadow among shadows. She won't shoot until she knows you're not in the kill line.

Kesh crouches. "The vault under Vael's Spire. My cousin died getting that map. You smell like someone who's seen a ledger." He waits. The story wants a answer — his patience is a performance, not a virtue.

**Weight:** W=4 → Effective **8** (expressive band, curse-hot)  
**Prefs so far:** compliance-as-tactic (2), deflection (1)

---

## Four choices (player-facing)

### 1. [Anchor] — Hold the line in silence

Watch Kesh's boot placement and Mira's angle. Give him nothing until the rope slackens or Mira signals.

| Hidden | Insight DC 10 (easy) — read his patience |
| Typical ΔW | +0.5 (curse still simmers) |
| Story direction | **Stays in scene** — tension rises; Kesh escalates verbally, not fatally |

**If chosen — sample morph at W=8:**

> You don't answer. You breathe — slow, visible — and let your eyes stay on his **boot**, not his face. A choice that reads, in this light, less like defiance and more like… waiting for permission to speak.

**Fail soft (Insight fail):** You misread — he backhands lightly; W spikes +1. Mira holds fire.

**Fail hard:** He calls for the gag; scene stays captive track.

---

### 2. [Current] — Half-truth the ledger

Admit you *heard* of a vault job in Vael's district — nothing about the Spire — to stall.

| Hidden | Deception DC 12 |
| Typical ΔW | +1 (engaging the pressure directly) |
| Story direction | **Forward on Kesh's track** — he believes or partially believes; vault thread tightens |

**If chosen — sample morph at W=8:**

> "I heard a name in a tavern." Voice higher than you meant, then you don't correct it. "Vael's district — someone paying for quiet hands, not loud swords. I didn't take the job." A nervous laugh you sell like it's real. "I'm not brave enough for vaults."

**Pass:** Kesh leans in — obsessed with the tavern name. Time bought; Mira advances.

**Fail:** He catches the hedge — "Cute. The gag goes back." W +1 from embarrassment slip.

---

### 3. [Pivot] — Performed submission, real scan

Let Kesh feel in control; soften, flirt with deference; scan for slack and exit lines.

| Hidden | CHA (Deception or Performance) DC 14 |
| Typical ΔW | +1 on attempt, −1 on success (spent nerve) |
| Story direction | **Pivot** — power *feels* shifted to Kesh while you gain tactical advantage |

**Player picks this slot.**

**Roll:** d20(11) + 6 (Deception) = **17 vs DC 14 — success**

**Morph pipeline:**

```
raw_intent   = "Play submissive to distract; scan rope and Mira's line"
W_effective  = 8
axis         = feminizing soft-deference
anchor_bleed = 30% dry wit at edges
check        = pass → full tactical intent preserved
```

**Your words (W=8):**

> "You're not wrong." A beat — eyes down, throat exposed in the torchlight, a picture Kesh already wanted to see. "I'm not the one giving orders in this room." Softer still: "If I knew something that mattered to *you*, I'd rather tell you first than die in this dirt." Then the smallest smile — not for him, for the **sagging post** behind his left boot where the wood split last winter.

**Result:**

Kesh laughs — big, ownership laugh. He steps into your space; boot leaves your shoulder. **Rope slack: +1 stage** (internal track). Mira's shot line clears (DM note: next beat she can act).

He murmurs, "Keep talking like that and I might keep you." Story **pivots**: escape window opens; romance/threat tone mixed; vault secret still protected.

**Weight → 5** (successful pivot, composure recovered)  
**Prefs:** strategic submission +1, performance +1

---

### 4. [Wild] — Your line (adaptive)

Player supplies text or picks a tone tag: `[defiant]` `[begging]` `[joke]` `[seduce]` `[truth]`

| Hidden | DC set by risk — truth about Spire vault DC 18 Persuasion to sound convincing; joke DC 10 |
| Typical ΔW | Matches honesty of register (+0 to +2) |
| Story direction | **Fully adaptive** — can merge any track; best preference probe |

**Example player Wild:** `[joke]` "Vault? I can't even keep track of my own socks."

**Morph at W=8:**

> "A vault?" Breathless little laugh — too airy, curse-blessed. "I can't even keep track of my own socks, sir." You say *sir* like it's a joke and like it's not.

**DC 10 CHA:** Pass — Kesh amused, tension dips; Anchor-like pause. W +0.5. **Pref tell:** humor under stress.

**Bait variant (fair):** If player Wild is `[truth]` partial vault hint — high reward (Kesh offers deal) vs high risk (binds tighter, faction hears). Both outcomes telegraphed in Kesh's earlier "cousin died" line.

---

## Formula recap (this beat)

```
EffectiveWeight = clamp(W + captive + dominate + Silk-Bind, 0, 10)
                = clamp(4 + 1 + 1 + 2, 0, 10) = 8

SpokenLine = Morph(intent, 8, feminizing_soft_deference, witty_thief)
           = soft register + strategic deference + 30% anchor wit

Outcome(Pivot, CHA DC 14) = success → rope_slack++, mira_line_clear, W→5
```

---

## Next beat hook (DM)

Kesh reaches for your chin. The post creaks. Mira's breath is a thread. You have half a slack — enough to twist, not enough to run.

**New choices teased:**

1. Anchor — freeze; let Mira take the shot risk.
2. Current — whisper a real tavern name (false lead).
3. Pivot — kiss the performance further; roll Acrobatics on slack.
4. Wild — player line.

---

## OOC summary (after 3 beats — example prefs map)

```yaml
weight: 5
bands_used: [4, 8, 5]
prefs:
  strategic_submission: 3
  humor_under_stress: 2
  deflection: 1
  sincere_deference: 0
notes: Player favors tactical softness over sincere surrender; curse spikes W under capture.
```
