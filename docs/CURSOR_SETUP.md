# Cursor setup

1. Open Cursor.
2. File → Open Folder → select the cloned `Nova-AI` repo on your PC.
3. Cursor reads `skills/` automatically as project rules — no cloud, no npm, no API keys.
4. Add more agents in `agents/`, tasks in `tasks/`.

## Sticky skills (live when folder is open)

- `skills/retry-four-then-pivot.md` — four attempts, then educated pivot.
- `skills/shadow-mind.md` — digital twin collection; logs to `logs/user-model.md`.
- `skills/patronizing-tutor.md` — transparent grade-level matching; logs literacy signals locally.

Optional: run Twin Collector (`cd collectors && npm start`) for browser probes — not required for skills to work.
