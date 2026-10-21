# Easy image editor

This is a small page on your own computer. You type what you want to see, press **Generate**, and a picture shows up.

It uses the **same Grok picture API** My Hub already uses (xAI, model `grok-imagine-image-2.0`). You can connect in either of these ways:

- **Direct API.** This editor calls xAI itself. Your key stays in a `.env` file on this computer, or you paste it into the page. The page never saves the pasted key into the project.
- **Hub bridge.** If My Hub is already running (`npm run dev`), choose this. The editor asks the Hub to make the picture. The Hub uses the Grok key it already has. You do not paste the key here.

You only need one of those. Direct API is the simple one if you just want pictures.

## What you need

Node.js, the long-term support version from [nodejs.org](https://nodejs.org).

Check that it is installed. In a terminal:

```bash
node -v
```

You should see a version number, such as `v22`. If the computer says the command is not found, install Node.js and open a new terminal.

## Run it (direct API)

1. Open a terminal in the `image-editor` folder. From the Nova-AI folder that is:

```bash
cd image-editor
```

2. Make your own key file. This copies the example. It does not copy a real key, because the example has none.

```bash
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env` instead.

3. Open `.env` in a text editor. Find this line:

```
XAI_API_KEY=
```

Paste your xAI key right after the `=`. The key starts with `xai-`. You get one at [console.x.ai](https://console.x.ai/). Save the file.

Leave the key out of chat, out of GitHub, and out of screenshots. `.env` is ignored by git.

4. Start the editor:

```bash
node server.mjs
```

`npm start` does the same thing. Leave this terminal open.

5. In your browser, open:

http://127.0.0.1:8787/

6. Leave **Direct API** selected. Type a prompt. Press **Generate**. The first picture can take a little while. When it appears, press **Save picture**.

If you would rather not put the key in `.env`, leave that line empty, start the editor, and paste the key into the box on the page. The box is only for Direct API.

## Run it through the Hub bridge

Use this when My Hub is already running on this computer and already has your Grok key.

1. Start My Hub the way you usually do, from the Hub folder:

```bash
npm run dev
```

That serves the Hub at http://127.0.0.1:8080/ and answers picture requests at http://127.0.0.1:8080/__dev/grok. The editor talks to that local address. It will not send your prompt to any other computer except through the Hub, which then calls xAI.

2. In another terminal, start this editor:

```bash
cd image-editor
node server.mjs
```

You can skip the xAI key in this folder when you use the bridge.

3. Open http://127.0.0.1:8787/

4. Choose **Hub bridge**. The page should say that My Hub is running and already has a Grok key.

5. Type a prompt and press **Generate**.

## Change a picture you already have

Under **Optional picture to change**, choose a PNG, JPEG, or WebP. Then write what you want changed, and press **Generate**. The editor sends that picture to the same Grok edit call My Hub uses.

## Practice mode (no key, no picture from Grok)

To click through the page without a key, add this line to `.env`:

```
IMAGE_EDITOR_MOCK=1
```

Start the editor again. Direct API draws a stand-in picture on your computer and does not call xAI. The page says practice mode is on. Delete that line, or set it to `0`, when you want a real picture.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `No xAI key yet` | Put the key in `.env` on the `XAI_API_KEY=` line and start the editor again, or paste it into the box. |
| `That doesn't look like an xAI key` | The key should start with `xai-`. Copy it again from the xAI console. |
| `My Hub is not running` | Start the Hub with `npm run dev`, or switch back to **Direct API**. |
| `The Hub bridge has no Grok key` | In the Hub, open **AI & keys** and paste the xAI key, or put `XAI_API_KEY` in the Hub's own `.env`. |
| `Port 8787 is already in use` | In `.env`, add `IMAGE_EDITOR_PORT=8788`, start again, and open http://127.0.0.1:8788/ |
| `Couldn't reach xAI` | Check your internet. The key can be fine and the site can still be busy. Try again. |
| The terminal shows the key | It should not. If you see the whole key printed, stop, and do not share that terminal text. |

## What is in this folder

- `server.mjs` — the small program. It serves the page and makes the picture request.
- `public/index.html` — the page you use.
- `.env.example` — the list of settings, with no real secrets.
- `.env` — your copy, after you create it. Git does not upload it.
