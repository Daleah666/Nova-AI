# Skill: retry-four-then-pivot

status: active

## Rule
When a task fails or stalls, try the same approach up to **four** times.

On the fifth attempt, stop repeating. Make an **educated pivot**:
- change one variable at a time
- use what the four failures taught you
- write the new hypothesis before trying

## Log
After each attempt, append one line:
`attempt N: what changed / what failed`

## Stop
If four attempts produce no progress, park the task and ask for a human decision.

## Where it lives
This file is sticky. Any bot reading `Nova-AI/skills/` loads it.
