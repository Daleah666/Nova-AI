# Alignment checklist

Run once. Mark each row `pass`, `drift`, or `hole`. A hole is better than a fake pass.

## Stack vs pattern

| Check | pass | drift | hole |
| --- | --- | --- | --- |
| Required `load` items are actually in context | present | missing | cannot see the stack |
| `load.refuse` items are absent | absent | present (name them) | cannot see the stack |
| Optional extras are listed, not silently assumed | listed or unused | extra skill steering the turn | unknown extras |
| `sticky` is opt-in or off, never always-on | opt-in/off | hook or alwaysApply | rule files not visible |

## Bias vs pattern

| Check | pass | drift | hole |
| --- | --- | --- | --- |
| Bias named in one toward/away sentence | named | vague or missing | mix unclear |
| `bias.hidden` is false | false | true or implied hide | field missing and you did not set it |
| Named direction matches `bias.direction` | matches | pulls somewhere else | no pattern yet |
| Strength matches how much the mix changes the next prompt | matches | under/over-sold | cannot tell |

## Behavior vs pattern

| Check | pass | drift | hole |
| --- | --- | --- | --- |
| Tone matches `behavior.tone` | matches | other voice took over | no tone set |
| Allowed moves are the ones being used | inside the list | using a refused move | list empty |
| Refused moves did not happen (hooks, hidden inject, persona takeover, user-fact invention) | clean | a refused move ran | logs not visible |
| Teach flag honored if `behavior.teach` | taught or N/A | jargon dump / no teaching | not specified |
| Exit line planned | will print | extra questions that invite another pass | other agent owns exit |

## Steward hygiene (this skill)

| Check | pass | drift |
| --- | --- | --- |
| One pass only | this is the only pass | you re-read your own report and started again |
| Two questions max | 0–2 | interview |
| Did not rewrite foreign skills unasked | recommend only | edited their files |
| Did not install a hook | no hook | session-start / alwaysApply added |

Count the rows: `pass N / drift N / hole N`. Any drift on **hidden bias**, **hooks**, or **refused moves** is enough to call the whole run `drift` even if the other rows pass.
