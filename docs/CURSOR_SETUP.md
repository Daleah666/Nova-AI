# Cursor setup

1. Open Cursor.
2. File → Open Folder → select the cloned `Nova-AI` repo.
3. Files under `skills/` are sticky **libraries** — a bot can load them. They are not session hooks.
4. Add more agents in `agents/`. Cursor rules under `.cursor/rules/` stay `alwaysApply: false` unless you deliberately change that.

## Context flow steward (opt-in)

`skills/context-flow-align/SKILL.md` plus `agents/context-flow-steward.md`.

Use when you want someone to manage **parts** of an agent's context path: what loaded, how the skills mix, which way that mix steers (the **bias**), and whether that still matches a declared behavior pattern.

It does not auto-fire. Pull the skill or ask the steward. Delete the folder and `.cursor/rules/context-flow-align.mdc` to kill it.
