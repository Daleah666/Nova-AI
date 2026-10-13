# Side overlay bar — geometry spec

Status: text-only. No screenshot is in `evidence/images/`.
Which exact app owns the bar is `[Unknown]` until a vaulted image exists.

## Repeat of the asked product

User wants the **black control strip only**.

Not the full overlay canvas.
Not browser chrome.
Not the mirrored / visual stage.

All current buttons move onto that strip.
The strip sits on a **side edge**.
A dismiss click collapses the strip to a **tiny hit target** in the **bottom corner of the middle (second) monitor**.
The collapsed target stays in the stack. It is still there if the user is not on the back-most overlay behind the mirrors.

Later (not this slice): a borderless always-on-top floaty.
This slice: add a **snippet / screen-clip button** as an icon on the strip.

## Exact layout (autistic / tech)

Coordinate space: the user's desktop as a union of monitors.
`M0` = first / back overlay host.
`M1` = middle screen = "second monitor" in the user's words.
`M2` = remaining screen if present. Unused unless proven.

Let `B` be the current black bar's axis-aligned bounding box.

### Size

Two accepted targets. Pick one after a vaulted screenshot:

| Token | Meaning | Constraint |
| --- | --- | --- |
| `HALF` | "split the bar in half" | If `B` is horizontal: `width' = width(B) / 2`, `height' = height(B)`. If `B` is already a side rail: `height' = height(B) / 2`, `width' = width(B)`. |
| `QUARTER` | "one fourth the size" | `area(B') = area(B) / 4`, keep aspect of the **black pixels only**. |

Do not scale the whole overlay window and call that done.
Crop to the black control region first. Then apply `HALF` or `QUARTER`.

### Crop

Keep only pixels that are the control plate (black / near-black dock).
Discard:

- translucent full-screen dimmers
- visual / mirror stage
- page content
- URL bar / tabs if this is still in a browser

Clickable hit box = the cropped plate. No invisible full-screen catcher.

### Dock (expanded)

- Edge: `left` or `right` of `M1`. Default `right` of `M1` until a picture says otherwise.
- Anchor: vertical center of `M1`, then user-drag.
- Width of a side rail: `max(72px, width(black-plate))` after `HALF`/`QUARTER`.
- Buttons: single column on a side rail, or single row if `HALF` stays horizontal. No wrap that grows the plate back to full width.

### Collapse (dismiss)

On the hide / click-away control:

1. Expanded plate unmounts from the side.
2. A remnant control mounts at `M1.bottom-right` (or `M1.bottom-left` if the rail was left-docked).
3. Remnant size: `<= 48 x 48` CSS px, icon only.
4. Remnant stays `always on that monitor corner`, not on `M0` or `M2`.
5. Z-order: remnant remains in the overlay stack. User can still find it unless they switch to the first / back-most overlay behind the mirrors. That is accepted.

### Snippet button

- One icon button on the plate.
- Action: fire the OS screen clipper (`ms-screenclip:` on Windows; Screenshot app on macOS; a later Linux bind).
- Do not auto-upload the clip into a chat until the user says so.
- After a clip file exists, ingest it with `scripts/ingest-evidence-image.sh` so Cursor and Codex cannot pretend they saw a different picture.

### Out of scope this slice

- Electron / PWA / Aitum wrapper
- alwaysOnTop floaty
- moving the app out of the browser
Those are parked. Do not start them to look busy.

## Candidate host apps `[Inference]`

From this repo's history, a bottom dock exists on the Subliminal Deployer (`716085a`, `.dock` / `.dock-inner`, dark plate `#2a1218`).
From the user's pasted Google chat, other names appear: SillyTavern, Vencord, Aitum. Those names are **not verified** in this workspace.

Do not implement against the wrong host. Wait for a vaulted screenshot.
