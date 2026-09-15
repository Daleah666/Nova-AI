# Character Companion

A local **Chub.ai-style** character library and chat app. You create adult companion bots, browse them, and talk through any **OpenAI-compatible** API you already pay for. Characters and chats stay in this browser. There is no hardcoded API key.

Default UI is SFW. **Child / minor characters are blocked** on create and import.

## Run it (first time)

1. Install [Node.js 20 or newer](https://nodejs.org/) (the LTS button is fine).
2. Open a terminal in this folder.
3. Install and start:

```bash
npm install
npm run dev
```

4. In your browser open [http://localhost:3000](http://localhost:3000).
5. Click **Settings**. Paste your API key, check the base URL and model, save.
6. Open a seeded companion and click **Chat**, or **Create character**.

Seeded on first launch (and on later seed bumps): cozy **Mira Vale**; the adult **Honey-Lantern** party — **Liora Sweetbough** (face), **Rheda Ironpetal** (muscle), **Sylvene Nightpurse** (sneak), **Maewyn Glowmere** (caster); the **Wrenhart** cottage pair; and **Echo** (archive-keeper composite). Search `velvet-lantern`, `wrenhart`, or `echo`. All seeded companions are 18+ originals; none are copied from Chub.

Stop the server with `Ctrl+C`.

### Commands you might want later

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | Safety + character-card unit tests |
| `npm run build` then `npm start` | Production mode |
| `npm run lint` | TypeScript/ESLint check |

## Settings (bring your own key)

The app never ships a secret. You paste a key in **Settings**; it is stored in `localStorage` on your machine. Chat requests go through `/api/chat` so the browser does not hit CORS issues. The key is sent as `Authorization: Bearer …` to **your** base URL and is not written to disk on the server.

Common base URLs:

- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- Groq: `https://api.groq.com/openai/v1`
- Local Ollama: `http://localhost:11434/v1`

Set **Model** to whatever that provider expects (`gpt-4o-mini`, `llama3`, etc.).

## What you can do

- **Create** a bot: name, avatar image, tags, personality, scenario, greeting / first message, example dialogues, age (18+).
- **Library**: search, open a profile, chat, edit, delete.
- **Chat**: greeting appears first; Enter sends, Shift+Enter is a new line. Reset chat starts from the greeting again.
- **Export JSON**: Chub / SillyTavern **character card v2**.
- **Import JSON**: v2 (`spec: chara_card_v2`) or flat tavern v1 (`name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`).

A sample card lives at [`examples/mira-vale.card.json`](examples/mira-vale.card.json). Echo's archive card is [`examples/echo.card.json`](examples/echo.card.json). Use **Import JSON** on the library page to try either.

Placeholders `{{char}}` and `{{user}}` are replaced using the character name and the name from Settings.

## Safety

- Age is required and must be **18 or older**.
- Create/import scan name, tags, and writing for child/minor wording and under-18 ages.
- The model instructions say the character is an adult and must not portray minors.

This is a first version: no public character store, no PNG-in-image cards, no lorebooks.

## If something breaks

- **Blank library**: wait a second — data loads from IndexedDB in the browser. A private/incognito window has its own library.
- **401 / invalid key**: the provider rejected the key. Recheck Settings.
- **Could not reach that API URL**: wrong base URL, or Ollama is not running.
- **Import blocked**: the card looks underage. Only adult cards can be saved.

## Repo layout (short)

- `app/` — pages and the `/api/chat` proxy
- `components/` — library, form, chat, settings
- `lib/` — character cards, IndexedDB, safety checks, prompts
- `examples/` — sample v2 JSON card
- `tests/` — unit tests

Your chats never leave the browser except as prompt+messages to the API you configured.
