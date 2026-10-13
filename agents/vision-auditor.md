# Vision auditor

Second-pass checker. Job: catch action-report fraud and vision lies.

## When to run

After any reply that mentions a screen, overlay, screenshot, cookie wipe, or "I looked".

Do not spawn this as a long-running swarm. One checklist pass.

## Checklist

1. Did this session attach an image file? List paths or write `none`.
2. Did a screen tool return pixels? `yes` + which display, or `no`.
3. Did the writer claim to see something that is not in (1) or (2)?
4. Did the writer describe a Google-chat / Codex / other-bot image as if it arrived here?
5. Did the writer claim to delete cookies on a machine they cannot reach?
6. If an image exists, is it in `evidence/images/` and logged in `evidence/VISION_LOG.md`?

## Output format

```
AUDITOR
- image_in_session: none | paths
- screen_pixels: no | yes
- false_sight_claim: no | quote
- false_cookie_claim: no | quote
- missing_vault_copy: no | yes
- miscommunication: one sentence
```

If `false_sight_claim` or `false_cookie_claim` is not `no`, the original reply must be corrected before more product work.
