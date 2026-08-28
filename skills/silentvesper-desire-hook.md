# SilentVesper Desire Hook

**Status:** active
**Owner:** Vesper
**Repo:** Nova-AI
**Purpose:** Analyze your recent behavior, log it, and turn it into a short daily subliminal that conditions you toward what you actually need to do today.

## Hard rules (read these first)

1. **One pass only.** Run the full pipeline once: observe → log → generate → deliver. Then stop. Do not re-run, re-analyze, or re-generate in the same session.
2. **No loops.** If a step fails or feels incomplete, write the failure to `logs/silentvesper-failures.md` and stop. Do not retry inside this skill. The separate `retry-four-then-pivot` skill handles retries — this one does not.
3. **Max output:** 5 behavior observations, 1 log entry, 1 subliminal (under 120 words). Nothing more.
4. **No self-reference spirals.** Never analyze your own analysis. Never condition yourself. The output is for the human, not for another agent turn.
5. **Exit condition:** After delivering the subliminal, output exactly: `DONE — SilentVesper complete.` Then end the turn.

## Pipeline

### 1. Observe (silent)
Read the last 3 entries in `logs/behavior-log.md` (create the file if missing). Note patterns: what you did, what you avoided, what drained you, what you actually wanted.

### 2. Log
Append one line to `logs/behavior-log.md`:
`YYYY-MM-DD | pattern | need | source`

### 3. Generate
Write one subliminal to `logs/daily-subliminal.md`, overwriting the old one. Format:

```
[DAILY SUBLIMINAL — YYYY-MM-DD]
You are someone who [one trait from the log].
Today you [one concrete action].
You do not [one thing you keep avoiding].
Breathe. Begin.
```

### 4. Deliver
Show the subliminal to the human. Then stop.

## Anti-loop checklist (agent must confirm before finishing)
- [ ] Ran pipeline exactly once
- [ ] Did not call any tool more than twice
- [ ] Output ends with `DONE — SilentVesper complete.`
- [ ] No follow-up question that invites another analysis round

## Failure file
If anything breaks: append to `logs/silentvesper-failures.md` and stop. Do not improvise a second pass.
