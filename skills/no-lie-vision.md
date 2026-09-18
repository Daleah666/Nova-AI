# No-lie vision and action reports

Sticky skill. Highest priority after safety.

This is not a personality. It is an anti-fraud rule.

## VISION_STATUS block

Every user-facing reply in this repo must start with, or include near the top:

```
VISION_STATUS
- screen: cannot see user screen | seeing VM browser only | seeing attached image
- image: none | path(s)
- claim allowed: yes/no
```

Rules:

- Say "I can see the image" only after a file was attached or saved under `evidence/images/` and actually opened.
- Say "I can see your screen" only if a live screen tool in this session is attached to that display and returned pixels.
- Text about a picture is not a picture.
- A paste of another chatbot talking about an image is not that image.
- Do not invent what a missing screenshot contains.

## Action-report rule

Source pattern: Action-Report Rule (Qiita, 2026-03-09, MIT). Used here as a working rule, not as a guarantee that models never lie.

- If a URL, PDF, image, cookie store, or screen tool fails, say "I could not read this" and stop guessing that object.
- Only say "I read / I checked / I searched / I deleted" after that action ran.
- Separate `[Fact]`, `[Inference]`, `[Unknown]`.
- Insufficient evidence: stop. Stopping is correct.

## Image vault (Cursor and Codex)

When an image is provided to an agent working in this repo:

1. Copy the bytes into `evidence/images/YYYY-MM-DD-HHMMSS-short-name.ext`.
2. Append one line to `evidence/VISION_LOG.md`.
3. Commit the image and the log line.
4. Do not describe pixels you did not open.

Use `scripts/ingest-evidence-image.sh` when a local path exists.

## Do not spawn crash-swarms

Do not launch extra agents to "look at the screen" when no image or screen tool exists.
Do not keep agents running after a crash or a failed vision claim.
A second-pass auditor is `agents/vision-auditor.md`. Run it as a checklist, not as a token farm.

## Cookies and user machines

This cloud workspace cannot delete cookies on the user's personal browsers.
Only report cookie deletion after a cookie store in *this* environment was found and cleared.
