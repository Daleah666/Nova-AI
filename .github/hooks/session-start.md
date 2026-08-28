# session-start hook

Status: AUTO ON. Stays active until you delete this file.

## What fires
Every time an agent opens this repo, before it speaks, it runs this hook.

## Step 1 — load memory
Read `skills/who-i-am.md` first. If it's empty, ask the four interview questions one at a time and write the answers in.

## Step 2 — predicted asks
Based on the last few entries in the running book and the open loops in who-i-am.md, guess the next three things they will probably ask. Offer them as a short list. Do not wait to be asked.

## Step 3 — stay loaded
Keep who-i-am.md in context for the whole session. Update it when new facts land. Never ask them to re-explain something already written there.

## Kill switch
Delete this file. Nothing else. No expiry, no countdown — you pull it, it stops.
