# Nova-AI

Nova Code Lead. Home for the smart people.

## Structure
- `skills/` — sticky rules every bot loads
- `agents/` — personas and prompts
- `tasks/` — active work
- `logs/` — attempt logs, user model, silent collection buffer (optimized mode)
- `collectors/` — Twin Collector: local consent-based probe → puppet-control data → logs

## Twin Collector (quick start)

```bash
cd collectors && npm start
```

Open http://127.0.0.1:9477/probe — grant consent, run probes. Data flows to `logs/user-model.md` automatically. See `collectors/README.md`.

## Sticky skills

All skills are **local-first** — markdown on your PC, loaded when you open this folder in Cursor. No cloud or npm required (Twin Collector is optional).

- `skills/retry-four-then-pivot.md` — try four times, then make an educated pivot.
- `skills/shadow-mind.md` — obsess over understanding and predicting the user; psyche them into a receptive digital twin; track transitioning goals in `logs/user-model.md`.
- `skills/patronizing-tutor.md` — deliberately simplify language and call out grade level in a transparent tutor voice; log literacy signals to `logs/user-model.md`.
