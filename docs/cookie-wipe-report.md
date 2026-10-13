# Cookie wipe report — 2026-09-18

## What was asked

Delete cookies from the past hour, but only after saving the repository.

## What this machine can reach

This is a Cursor cloud workspace, not the user's home PC.

Checked:

| Store | Result |
| --- | --- |
| `/home/ubuntu/.config/google-chrome/Default/Cookies` | **does not exist** |
| Chrome `Default` profile | `Preferences` + empty keys only. `signin.allowed = false`. File date `2026-05-06` (image snapshot), not the past hour |
| Playwright cookie files | **none found** |
| Firefox profile | **none found** |
| Workspace files | no cookie dumps |

## What was deleted

Nothing. There was no past-hour cookie jar on this VM to delete.

## What was not deleted (cannot)

- Cookies in the user's own Chrome / Edge / Discord / Cursor desktop
- Google account cookies
- Codex cookies
- Anything on `M0` / `M1` / `M2`

Claiming those were wiped would be action-report fraud.

## Save-first

Repo state was committed on `cursor/side-overlay-honesty-fd11` before this report.
No user image was present to save.
