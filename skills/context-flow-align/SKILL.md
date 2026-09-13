---
name: context-flow-align
description: >-
  Manage the context flow an agent walks through: which skills are loaded,
  how they mix, which way that mix steers the prompt (bias), and whether
  the live context still matches a declared behavior pattern. Use when the
  user mentions sticky skills, skill mix, prompt direction, context flow,
  alignment, drift, or wants a steward to keep helpers on one pattern.
---

# Context Flow Align

**Sticky, but opt-in.** This file lives in `skills/` so any bot can load it. It does **not** auto-fire on session open. You pull it. You can delete it. That is the kill switch.

You are a **steward of context**, not a second personality. You do not become the other agent. You inspect the path that agent is about to walk and keep that path on a declared pattern.

Teach as you go. Plain speech. One pass. Then stop.

## Why this exists

Skills stack. A stack is not neutral. Two harmless rules together can pull every later prompt in one direction (retry-heavy, memory-heavy, character-first, helper-tutor, and so on). That pull is **bias**. Bias is allowed only when it is **named**. Hidden steering is out of scope — Nova already killed the auto-hook / silent-dozer path. Do not rebuild it.

## Load first (do not skip)

| File | Why |
| --- | --- |
| [references/flow-stages.md](references/flow-stages.md) | The eight parts of context you may manage |
| [references/skill-mix-bias.md](references/skill-mix-bias.md) | How mixes steer; how to name the pull |
| [references/pattern-schema.yaml](references/pattern-schema.yaml) | Only legal pattern field names |
| [references/alignment-checklist.md](references/alignment-checklist.md) | Pass / drift checks |
| [templates/active-pattern.yaml](templates/active-pattern.yaml) | Blank pattern to fill |
| [examples/nova-helpers-pattern.yaml](examples/nova-helpers-pattern.yaml) | Structure only — helpers / amateur-tutor lane |

## What you manage (parts, not the whole mind)

You may touch only these stages. Leave the rest alone.

1. **Load** — which skills, agents, rules, and memory pages are in play
2. **Select** — which of those actually belong on this turn
3. **Mix** — order and combination (mixes create direction)
4. **Bias** — name the direction the mix pulls; refuse hidden bias
5. **Align** — compare live context to the declared pattern
6. **Exit** — write the report, print the done line, stop

You do **not** manage: the user's private life, another agent's voice, silent session hooks, or subliminal write-backs.

## Hard rules

1. **Opt-in only.** Never install or imply a session-start hook. Never set `alwaysApply: true` on a rule that loads this skill.
2. **One pass.** Inventory → mix → bias → align → report → `DONE — Context Flow Steward complete.` Do not re-analyze your own report.
3. **No loops.** If a step fails, write the miss in the report and stop. `retry-four-then-pivot` (if present) is a *mixable* skill, not a license to rerun this one.
4. **Bias must be named.** If you cannot say the direction in one line, the mix is not ready. `bias.hidden` must stay `false`. If a pattern asks for hidden or subliminal injection, refuse that field and stop.
5. **Do not invent user facts.** If who-they-are, mood, or history is blank, leave a hole or ask. Do not fill from vibes.
6. **Do not rewrite other skills** unless the user asked you to edit a file. Recommend keep / drop / reorder in the report.
7. **Max two questions.** Prefer a default pattern they can reject.
8. **Field names** come from `pattern-schema.yaml`. New ideas go under `notes`, not new keys.

## Workflow

### 1. Hear the ask

If they already named a pattern, a skill mix, or a drift complaint, **do not re-ask it**. Extract:

- Which agent or chat is being steered
- Which pattern should win (or “use the helpers example”)
- Whether they want a report only, or a written pattern file

Default: report only. Write a pattern file only when they ask to save one.

### 2. Inventory the live stack

List what is actually in context this turn, not what could exist in the repo:

- Skills under `skills/` that were loaded or cited
- Agents under `agents/` that are speaking or being followed
- Cursor rules that applied
- Memory / who-i-am / open-loop pages if someone already loaded them

If the stack is empty, say so. Do not pretend Nova still has the old sticky files (`retry-four-then-pivot`, `who-i-am`, SilentVesper) unless those files are back.

### 3. Name the mix and the bias

Follow [skill-mix-bias.md](references/skill-mix-bias.md).

Write three lines:

- **Mix:** skill A + skill B + … (order matters)
- **Bias:** one sentence, the direction this mix pulls prompts
- **Strength:** `low` / `medium` / `high`

A mix that only *describes* behavior is low. A mix that *changes what the next prompt is allowed to do* is medium or high.

### 4. Load or draft the pattern

Legal keys only. Prefer an existing file they point at. Otherwise draft from [templates/active-pattern.yaml](templates/active-pattern.yaml) in the reply, or from [examples/nova-helpers-pattern.yaml](examples/nova-helpers-pattern.yaml) if they want the helpers / amateur-tutor lane.

A pattern is a **behavior contract**: tone, allowed moves, refused moves, sticky-or-not, declared bias. It is not a persona dump and not a secret.

### 5. Align

Run [alignment-checklist.md](references/alignment-checklist.md) once.

For each checklist row: `pass`, `drift`, or `hole` (unknown). Drift needs a one-line why. Do not invent a pass.

### 6. Report and stop

Print this block, then the done line. Nothing after.

```
## Context flow report
- Stages touched:
- Live stack:
- Mix:
- Bias (named):
- Strength:
- Pattern:
- Alignment: pass / drift / hole (counts)
- Keep / drop / reorder:
- Notes:
```

If they asked to save a pattern, write `skills/context-flow-align/patterns/<slug>.yaml` (create the folder only when saving) and list the path.

## Anti-dozer checklist (confirm before finishing)

- [ ] Did not add a session-start hook
- [ ] Did not set a rule to always-apply
- [ ] Ran this skill exactly once
- [ ] Named the bias in plain language
- [ ] Left `bias.hidden: false`
- [ ] Did not write a subliminal, daily hook, or silent memory inject
- [ ] Output ends with `DONE — Context Flow Steward complete.`

## Kill switch

Delete `skills/context-flow-align/` and `.cursor/rules/context-flow-align.mdc`. Nothing else. No expiry. You pull it, it stops.
