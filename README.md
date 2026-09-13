# Subliminal Deployer

Local web app that cycles hypnotic stills, lets you write a feminine affirmation script, renders **Silent** or **Binaural** audio, and loops both until you stop. Adult, self-use only.

Nothing flashes or speaks until you accept the photosensitive warning **and** click **Start session**. Stop and Pause stay on screen. There is no stealth, autoplay, or hidden overlay. Browser fullscreen is not used, so the stop control cannot be covered.

## How to run

```bash
npm install
cp .env.example .env   # optional; local uploads work with an empty .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite studio + local `/api` helpers |
| `npm run build` | Production bundle |
| `npm run preview` | Serve the bundle (API helpers are dev-server only) |
| `npm test` | Flash-rate cap, safety gate, template, Drive-ID tests |

## What you can do

1. **Visuals** — Built-in stills work offline. Upload files or a local folder. Optionally load a Google Drive folder you pick (OAuth or folder ID + API key).
2. **Script** — Templates plus a full editor. Default goal is stay as girly/feminine as possible. Soft bimbofication is an optional template. Import/export `.txt`.
3. **Audio** — **Silent**: affirmations mixed very low under a brown-noise carrier. **Binaural**: stereo beats (headphones) plus an optional voiced layer. Cartesia TTS if `CARTESIA_API_KEY` is set; otherwise Web Audio + `speechSynthesis`.
4. **Session** — One click starts a loop of the chosen audio + visual cycle. **STOP** (or Escape) ends it. Pause/Resume stay visible.

## Safety (non-negotiable)

- Photosensitive epilepsy warning on first visit (stored as `asd.safety.accepted.v1`).
- Default flash rate **0.5 Hz**. Hard max **~3 Hz** (`src/lib/flash.ts`).
- Huge Stop control while a session is running. Pause is always visible.
- No stealth / hidden modes, no playback without an explicit start.

If you have photosensitive epilepsy, migraines, or light sensitivity, do not run a session.

## Environment variables

Copy `.env.example` to `.env`. **Never put Cartesia or Google API keys in `VITE_*` variables** — those would ship to the browser.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Browser | OAuth Web client ID. In Google Cloud Console, enable the Drive API and add Authorized JavaScript origins: `http://localhost:5173`. Scope used: `drive.readonly`. |
| `GOOGLE_API_KEY` | Vite middleware | Folder-ID listing + image proxy at `/api/drive/list` and `/api/drive/media/:id`. The folder (or files) must be shared as **Anyone with the link** can view. |
| `CARTESIA_API_KEY` | Vite middleware | Optional Sonic TTS via `POST /api/tts`. Get a key at [play.cartesia.ai/keys](https://play.cartesia.ai/keys). |
| `CARTESIA_VOICE_ID` | Vite middleware | Defaults to a public Cartesia voice ID from their API docs. |
| `CARTESIA_MODEL_ID` | Vite middleware | Default `sonic-3.6`. |
| `CARTESIA_VERSION` | Vite middleware | Default `2026-08-14`. |

Without these, the studio still runs: built-in visuals, local uploads, Web Audio carriers, browser speech.

## Google Drive setup (optional)

1. Create a Google Cloud project, enable **Google Drive API**.
2. **OAuth:** Create an OAuth 2.0 **Web application** client. Put the client ID in `VITE_GOOGLE_CLIENT_ID`. Authorized origins: `http://localhost:5173`. Paste a folder URL/ID in the app and click **Sign in to Drive**.
3. **API key:** Restrict a key to the Drive API, put it in `GOOGLE_API_KEY`, share the folder as Anyone-with-the-link, click **Load with API key**.

## Cartesia (optional)

The dev server proxies `POST /api/tts` to `https://api.cartesia.ai/tts/bytes` so the raw `sk_car_…` key never enters the bundle. If the key is missing or the call fails, the session uses `speechSynthesis` mixed against the carrier.

`npm run preview` and a static host will not include that proxy — keep using `npm run dev` for TTS/Drive API-key features, or put the same routes on your own server.

## Stack

Vite 7, React 19, TypeScript, Web Audio, Google Identity Services (optional), Cartesia TTS (optional).
