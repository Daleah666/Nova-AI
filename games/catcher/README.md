# Mossring

A small original woodland creature-catcher. You play an unnamed warden. Walk a town and a grass route, meet eight original creatures, and face the stone warden at the far edge of the ring.

## Install

From this folder:

```bash
npm install
```

## Run

```bash
npm run dev
```

Vite prints a local URL. Open it in a browser.

## Build

```bash
npm run build
```

The static site is written to `dist/`. Preview it with `npm run preview`.

## Play

- **New Game** starts with Pipkin at level 5. **Continue** loads `localStorage` key `mossring-save-v1` and stays disabled until that save exists.
- Arrows or WASD move. Buildings, trees, and the map edge block the way.
- Step on the town fountain to heal the party.
- The first step into tall grass on a new game always starts a wild meeting. Later grass steps sometimes do (about one in four).
- In a wild meeting, **Strike**, **Catch**, and **Run** are buttons and keys 1, 2, and 3. Catch throws a seedpod. A full party (6) cannot take another creature.
- Walk into the warden at the far right to battle Graven. There is no running or catching. When Graven falls, the ring is quiet.
- **Save** on the overworld stores the party, where you stand, and whether the boss has fallen. Catching and winning also save.
