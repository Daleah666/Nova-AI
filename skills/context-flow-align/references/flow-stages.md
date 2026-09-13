# Flow stages

Eight parts of context a model walks through. This skill **manages 1–5 and 8**. Stages 6–7 belong to the agent that is actually doing the user's task.

| # | Stage | What it is | Steward may |
| --- | --- | --- | --- |
| 1 | Load | Skills, rules, agents, memory pages that entered context | Inventory. Flag leftovers from a dead hook. |
| 2 | Select | Which loaded files belong on *this* turn | Recommend keep / drop. |
| 3 | Mix | Order and combination of the kept files | Name the recipe. Order is part of the recipe. |
| 4 | Bias | The direction that recipe pulls later prompts | Name it. Refuse hidden / subliminal bias. |
| 5 | Align | Live stack vs declared behavior pattern | Pass / drift / hole. |
| 6 | Reply | The other agent actually answering the user | Do not take over the voice. |
| 7 | Write-back | Logs, memory pages, pattern files | Only if the user asked to save a pattern. |
| 8 | Exit | Done line, stop | Always. One pass. |

## Sticky vs loaded

- **Sticky** means “this file is sitting in `skills/` so a bot *can* load it.” It does not mean “fires every open.”
- **Loaded** means it is in this turn's context.
- **Always-on** is a hook or `alwaysApply: true` rule. This skill forbids that for itself.

If you find an always-on hook that injects skills before the user speaks, report it as drift against any pattern with `sticky: opt-in`. Do not repair it unless asked. Nova already used a kill switch on that path once.

## What “align” means

Alignment is not “the model is nice.” It is:

1. The live stack matches the pattern's `load` / `refuse` lists.
2. The named bias matches `bias.direction`.
3. The steward did not cross `refuse` moves (hooks, hidden inject, persona takeover).
4. Holes are labeled holes, not filled with guesses.
