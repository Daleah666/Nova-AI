# Subliminal Maker

Subliminal Maker writes fresh affirmations from your goals and puts them straight into Mindzoom. Mindzoom keeps playing them in the background, so you get a new subliminal every day without doing anything.

It can:

- **make one every day by itself** (every morning, and when you log in if the morning was missed),
- **make one right now** when you ask,
- **make one with you**, asking 3 quick questions and letting you choose the lines.

You only ever change one file: `my-goals.txt`.

---

## Set it up (3 steps)

**1. Download and unblock it**

- On GitHub, click **Code > Download ZIP**.
- Before unzipping, right-click the ZIP, choose **Properties**, tick **Unblock** at the bottom, and click **OK**. This stops Windows from blocking the files.
- Unzip it. Move the `subliminal-maker` folder somewhere it can stay, like `Documents\subliminal-maker`.

**2. Double-click `Setup.bat`**

It walks you through everything:

1. It finds Mindzoom's affirmations folder. If it can't, paste the folder path or drag the folder into the window.
2. It asks for an AI key. This is optional; press Enter to skip. See [Let an AI write the lines](#optional-let-an-ai-write-the-lines).
3. It puts a **Subliminal Maker** shortcut on your desktop.
4. It asks if you want the daily subliminal. Say yes.
5. It makes your first subliminal.

If Windows says "Windows protected your PC", click **More info > Run anyway**.

**3. Pick it in Mindzoom**

In Mindzoom, choose **000 Daily Subliminal** as your affirmations and leave it picked. The words inside change by themselves every day.

That's it. You never have to open it again unless you want to change something.

---

## The menu

Double-click the **Subliminal Maker** shortcut on your desktop (or `Subliminal.bat` in the folder).

| Pick | What it does |
| --- | --- |
| 1 | Make today's subliminal now. This replaces today's file in Mindzoom. |
| 2 | Make one with me. |
| 3 | Edit my goals. This opens `my-goals.txt` in Notepad. When you close it, it offers to make a fresh one with your changes. |
| 4 | Turn the daily subliminal on or off. |
| 5 | Status: whether daily is on, where Mindzoom is, who writes the lines, and when the last one was made. |
| Q | Quit. |

### Make one with me

It asks:

1. How do you want to feel?
2. What do you want to do more of?
3. Who are you becoming?

Press Enter to skip any question. Then it shows numbered lines:

- type a number to drop that line (or several, like `3 7 12`),
- type `+` and your own line to add it (for example `+ I glow when I smile.`),
- type `R` for fresh lines,
- press Enter when it looks good.

Then save it as **today's daily subliminal**, or as **its own Mindzoom file** with a name you pick (it shows up in Mindzoom as `001 <your name>`). It also asks if you want your answers added to `my-goals.txt`, so the daily ones use them too.

---

## Change what it says

Open `my-goals.txt` (menu option 3, or open it in Notepad). It has three parts:

```
[goals]
Stay girly and feminine all day
Keep a happy, bubbly, confident mindset
Create and post my 3D art

[always include]
I love being me.

[never include]
```

- **`[goals]`**: what you want, one per line, in plain words. Every subliminal has lines for every goal. Each day a different goal gets the **spotlight** and about half the lines.
- **`[always include]`**: your own lines. They go into every subliminal exactly as you write them.
- **`[never include]`**: words or phrases you never want to see. Any made-up line that contains one is dropped.
- Lines starting with `#` are notes and are skipped.

Save the file. The next subliminal uses your changes.

### The rules every made-up line follows

Lines come out short, positive, and in the present tense, like they're already true. A made-up line is dropped if it:

- uses a negative word (not, never, no, stop, quit, without, lose, hate, fear, worry, and words like don't or can't),
- talks about the future (will, going to, want to, try to, hope to, someday, wish),
- makes a health claim (cure, heal, disease, medicine, pain, and similar),
- is longer than 16 words, or
- repeats a line that's already in.

Your `[always include]` lines skip these checks, because they're yours.

### Add your own phrase bank

The built-in lines live in the `phrases` folder, one file per theme: `girly`, `bimbo`, `confidence`, `mindset`, `creative`, `focus`, `calm`, `body`. You can edit them, or add your own:

1. Copy any theme file (like `phrases/calm.txt`) and rename it (like `phrases/dance.txt`).
2. Change the `keywords:` line. When a goal contains one of these words, this theme's lines get used for that goal.
3. Put your lines under the three headings:
   - `[becoming]`: who I am becoming ("I am a natural dancer.")
   - `[why]`: why I care ("Dancing makes me feel free.")
   - `[when]`: when this happens, I do this ("When music plays, my body moves.")

Goals that match no theme still work. Every goal also gets the general lines in `phrases/_templates.txt`, where `{g}` is filled in with your goal (like "staying girly and feminine all day"). A goal written as an "I ..." sentence, like `I am calm and focused`, is used as a line itself.

---

## Optional: let an AI write the lines

It works fine without an AI, using the phrase banks. With an AI key, you get brand-new wording every day.

1. Get an API key from one of these:
   - **Claude** (Anthropic), which starts with `sk-ant-`
   - **Grok** (xAI), which starts with `xai-`
   - **OpenAI**, which starts with `sk-`
2. Run `Setup.bat` again and paste it when asked. Or make a file called `my-key.txt` in the folder and put the key on the first line.

It figures out which AI to use from how the key starts. The AI gets one try per subliminal. Every line it writes still goes through the rules above, and if anything goes wrong, the phrase banks fill in. You'll always get a subliminal.

`my-key.txt` stays on your PC. It is never uploaded to GitHub.

**If the AI keeps getting skipped:** check `made/log.txt`. It says why (for example a wrong key, or no credit left). AI companies sometimes retire model names. If the log mentions the model, open `settings.json` and change the name under `"models"` to a current one from the company's website.

---

## Settings

`settings.json` holds the few things you might want to change:

| Setting | What it means | Default |
| --- | --- | --- |
| `lines` | How many lines in each subliminal | `30` |
| `maxWords` | Longest a made-up line can be | `16` |
| `dailyTime` | When the daily one is made (24-hour time) | `"08:00"` |
| `dailyFileName` | The file name Mindzoom sees | `"000 Daily Subliminal.txt"` |
| `mindzoomFolder` | Mindzoom's affirmations folder. Leave it empty to find it automatically. | `""` |
| `models` | Which AI model to use for each company | |

After changing `dailyTime`, turn daily off and on again in the menu (option 4) so Windows uses the new time. If you change `dailyFileName`, pick the new file in Mindzoom.

---

## Turning it off, and moving it

- **Turn off the daily subliminal:** menu option 4. This removes the task from Windows completely. Your Mindzoom file stays as it is until you make a new one.
- **See it in Windows:** open **Task Scheduler** and look for **Subliminal Maker Daily**. Nothing about it is hidden.
- **Moved the folder?** Run `Setup.bat` again. The daily task and the desktop shortcut point to where the folder was.
- **Uninstall:** turn daily off (option 4), then delete the folder and the desktop shortcut. You can also delete `000 Daily Subliminal.txt` from Mindzoom's affirmations folder.

## Where everything is

| File or folder | What it is |
| --- | --- |
| `my-goals.txt` | Your goals. The only file you need to change. |
| `settings.json` | Optional settings (see above). |
| `phrases/` | The built-in lines, one file per theme. |
| `made/` | A copy of every subliminal it made (with notes on top), plus `log.txt`. |
| `my-key.txt` | Your AI key, if you added one. |
| `Setup.bat` | First-time setup. Safe to run again any time. |
| `Subliminal.bat` | The menu. |
| `subliminal.ps1` | The program itself. |

It only makes one subliminal per day on its own. If the daily task runs twice (morning and login), the second run sees today's is done and stops.

## If something's wrong

| Problem | Fix |
| --- | --- |
| Status says Mindzoom is missing | Run `Setup.bat` and paste the folder path. It's usually `C:\Users\<you>\AppData\Local\Mindzoom\Mindzoom3.1.0\affirmations`. |
| Mindzoom still shows yesterday's words | Pick another affirmation file in Mindzoom, then pick **000 Daily Subliminal** again, or restart Mindzoom. |
| A daily one didn't show up | Check menu option 5, then `made/log.txt`. The PC has to be on (it catches up when you log in). |
| Windows only allowed the morning time | Some PCs need admin rights for the at-login start. The morning time still works. |
| I don't like a line | Add a word from it to `[never include]`, or drop it in "Make one with me". |

---

## Check on your PC

These things only work on Windows, so they couldn't be tested before shipping. Please try them once:

- [ ] `Setup.bat` finds Mindzoom's affirmations folder (or accepts the pasted path).
- [ ] **000 Daily Subliminal** shows up in Mindzoom and plays.
- [ ] After menu option 1, Mindzoom shows the new words. Note whether you had to re-pick the file or restart Mindzoom.
- [ ] The **Subliminal Maker** shortcut appears on the desktop and opens the menu.
- [ ] **Subliminal Maker Daily** appears in Task Scheduler with a daily trigger and an at-log-on trigger.
- [ ] Right-click the task in Task Scheduler and choose **Run**. A new file appears in `made/` and `made/log.txt` gets a line. A console window may flash for a second; that's normal.
- [ ] The next morning (or after logging in), there's a new subliminal without you doing anything.
- [ ] Menu option 4 turns daily off, and the task disappears from Task Scheduler.

---

## For tinkerers

`subliminal.ps1` runs on the Windows PowerShell 5.1 that comes with Windows. Nothing else needs installing.

```
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -Now      # make today's now
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -WithMe   # make one with me
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -Daily    # what the daily task runs (skips if today's is done)
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -On       # turn daily on
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -Off      # turn daily off
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -Status   # show status
powershell -ExecutionPolicy Bypass -File subliminal.ps1 -Setup    # run setup
```

It also reads the key from the `ANTHROPIC_API_KEY`, `XAI_API_KEY`, or `OPENAI_API_KEY` environment variable when there's no `my-key.txt`.

### Running the tests

The tests use [Pester](https://pester.dev) 5 or newer and never touch your real Mindzoom folder.

```
Install-Module Pester -MinimumVersion 5.0 -Scope CurrentUser -Force -SkipPublisherCheck
cd subliminal-maker
Invoke-Pester ./tests
```
