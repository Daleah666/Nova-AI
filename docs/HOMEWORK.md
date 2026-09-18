# Homework

Short. You do these. The agent cannot do your machine.

## 1. Kill last-hour cookies on *your* PC

This cloud box had none.

Chrome or Edge:

1. `chrome://settings/clearBrowserData` or `edge://settings/clearBrowserData`
2. Time range: **Last hour**
3. Check **Cookies and other site data**
4. Uncheck saved passwords unless you want those gone too
5. Clear

Also close any "look at my screen" sidebar that was turning the display blue. That is a local extension / overlay, not this repo.

## 2. Drop the real picture in the vault

Do not only paste it into Google or Discord.

1. Save the overlay screenshot (and the "other robots" picture) as files.
2. Put them in this repo at `evidence/images/` **or** run:

```bash
bash scripts/ingest-evidence-image.sh /path/to/your.png overlay-bar
```

3. Commit, or attach the files in the Cursor agent chat so the next run can ingest them.

Until that happens, no agent here can see the bar.

## 3. Paste the stop-lying block into Cursor

Cursor Settings → Rules → User rules. Paste:

```
VISION_STATUS every reply: screen / image path / claim allowed.
Never say you saw a screen or image unless a file was opened or a screen tool returned pixels.
If access failed: say you could not read it and stop. Do not guess.
Separate Fact / Inference / Unknown.
Do not launch extra agents after a crash.
```

Same text can go in Codex custom instructions.

Source pattern: Action-Report Rule, Qiita 2026-03-09 (MIT). Prompts reduce action-lies. They do not make models honest by magic. The vault is the hard check.

## 4. One agent, one crash, stop

If a run dies or goes blue / loops:

- Do not open three more agents on the same mess.
- Send one screenshot into `evidence/images/`.
- Then one short follow-up: "vaulted, implement HALF side rail."

## 5. Pick HALF or QUARTER

Reply with one word after the picture is in the vault: `HALF` or `QUARTER`.
Default if you say nothing after the picture: `HALF`.
