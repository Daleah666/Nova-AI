# Nova Twin Collector

Local-first, **consent-based** data collection for your digital twin and avatar puppet control. Feeds directly into Nova-AI shadow-mind logs.

## What it collects (puppet vectors)

| Vector | Data | Use |
|--------|------|-----|
| `communication-voice` | typing rhythm, voice samples, detail preference | mirror how you talk |
| `aesthetic-taste` | color picks, style choices | avatar look & UI prefs |
| `decision-latency` | reaction speed on choices | when twin acts vs waits |
| `reaction-speed` | click timing | impulsive vs deliberate puppet |
| `avatar-expression` | default mood | face/pose defaults |
| `workflow-rhythm` | research-plan-ship vs iterate | prep work ahead of you |
| `tool-preference` | docs vs AI when stuck | twin's default moves |
| `values-tradeoff` | speed vs polish slider | tradeoff decisions |

## Quick start

```bash
cd collectors
npm start
```

Open **http://127.0.0.1:9477/probe** → grant consent → run probes.

Or auto-open probe:

```bash
npm run probe
```

## How it works

```
Browser Probe / Bookmarklet
        ↓ POST /api/signal (consent required)
Twin Collector (localhost:9477) — optimized mode
        ↓ buffer
logs/collection-buffer.md
        ↓ auto-flush at 5+ signals
logs/user-model.md + logs/behavior-log.md + logs/twin-signals.jsonl
```

## Consent & cookie

- First-party cookie: `nova_twin_consent` (365 days)
- localStorage backup + offline queue if server is down
- Revoke anytime in probe UI — clears cookie + buffer
- **Nothing sends off your machine** unless you export

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/consent` | POST | Issue consent token |
| `/api/signal` | POST | Ingest signal(s) |
| `/api/flush` | POST | Merge buffer → user-model now |
| `/api/puppet-profile` | GET | Ranked signals for puppet control |
| `/api/status` | GET | Health + buffered count |

### Signal payload example

```json
{
  "consent": { "granted": true, "version": "1.0.0", "scope": ["puppet"] },
  "category": "avatar",
  "signal": "Default avatar mood: confident",
  "source": "browser-probe",
  "puppetVector": "avatar-expression",
  "confidence": "high",
  "payload": { "mood": "confident" }
}
```

## Bookmarklet (any page)

1. Start collector: `npm start`
2. Grant consent at `/probe`
3. Drag **Nova Twin Snippet** from probe footer to bookmarks
4. Click bookmark on any page — passive click/scroll capture (optimized, tiny badge)

## Commands that sync with shadow-mind skill

| You say | Collector does |
|---------|----------------|
| `sync twin` / `flush logs` | POST `/api/flush` or agent merges buffer |
| `optimized mode` | collector runs silently — no UI needed |
| `export puppet profile` | GET `/api/puppet-profile` → JSON download |

## Files

- `twin-collector.js` — local server
- `browser-probe.html` + `browser-probe.js` — interactive probes
- `bookmarklet.js` — lightweight page capture
- `schema/twin-signals.json` — signal schema
- `lib/buffer-flush.js` — Nova-AI log integration
- `lib/signal-scorer.js` — ranks signals by puppet fidelity

## Privacy

- Localhost only (`127.0.0.1:9477`)
- Consent required on every signal
- Revoke clears local data
- You own the logs — delete `logs/twin-signals.jsonl` anytime
