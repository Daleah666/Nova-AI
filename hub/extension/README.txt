THE HUB — Chrome extension
==========================

What it does
- Every new tab opens The Hub.
- Alt+Shift+H pops The Hub up as its own window beside your browser.
- The toolbar button shows today's time on sites and the last 14 days.
- While The Hub is open, it sends your time on sites and open tabs to the Hub's
  Activity tab, so your host can answer "what have I been doing?".

- Alt+Shift+V (or "Talk to your host" on the toolbar button) opens a small Talk window.
  Say something like "add lunch with Sam tomorrow at 1 to my calendar" and it goes
  straight to your host in the Hub. The first time, Chrome asks to use your microphone.
- If you install the free ActivityWatch app (activitywatch.net), the Hub's Activity tab
  also shows time in every app on your computer, not just Chrome. The extension reads it
  from ActivityWatch's local server on this computer (localhost:5600). Nothing leaves your
  computer except to your own Hub.

- Mini windows: from the Hub's left menu, the ⧉ button opens a site in a small window docked on
  the right of your screen, separate from your tabs.
- Mic in the Hub: with the extension connected, the Hub's mic buttons open a small listening window
  and type what you say into the box you clicked.
- Tidy tabs (off until you turn it on, here or in the Hub's Settings): tabs you haven't looked at for a
  while go into a grey "Idle" group, go to sleep, or close. Closed ones can be reopened from the Hub.
  Pinned tabs, tabs playing sound, the tab you're on and your Hub tabs are never touched.

- Grok pictures: paste your xAI key in the Hub's picture studio. It's stored here, in this extension,
  never in the Hub. The extension sends your prompt (and the picture you're editing) to xAI and hands
  the results back to the Hub. Remove the key any time from the studio.

Privacy
- Time is counted one minute at a time for the site in your active tab, only while
  you're at the computer and Chrome is focused. Incognito is never tracked.
- It's stored on this computer only. It goes to The Hub page only while the Hub is open,
  and only after you've connected them (so no other page can read it).
- Pause tracking anytime from the toolbar button.

INSTALL (about 1 minute)
1. Unzip this folder somewhere you'll keep it (for example Documents\The Hub extension).
   Chrome loads it from there, so don't delete the folder afterwards.
2. Double-click INSTALL.bat. It opens Chrome's extensions page and this folder.
   (Or type chrome://extensions in the address bar yourself.)
3. Turn on "Developer mode" (top-right switch).
4. Click "Load unpacked" and choose this folder.
5. Pin it: click the puzzle-piece icon in Chrome's toolbar, then the pin next to The Hub.
6. Open a new tab. The first time, Chrome asks whether to keep the new-tab change. Choose Keep.
7. Connect it: in the Hub, press Connect (in the helper's "Connect the extension" card, or
   Settings → Chrome extension). A small window from the extension asks "Connect your Hub?".
   Press Connect. (Prefer a code? Click the toolbar button → "Use a code instead".)
   After that, clicking an app in the Hub opens it as a tab in a pink "Hub" tab group,
   and the open apps show as chips at the top of the Hub.

UPDATES (from 1.2 on)
1. Download the new zip (from Claude, or the Hub's Settings → Chrome extension →
   Download update). Leave it in your Downloads folder.
2. Double-click UPDATE.bat in this folder (or drag the zip onto it). A black window opens and asks
   "Type Y and press Enter to update". Press the Y key (Y = yes), then Enter. Any other key cancels.
   Can't find this folder? In Chrome go to chrome://extensions, click Details on The Hub, and click
   the folder path next to "Source". (From 1.5.2 on, the Hub's Update bubble has a button for this.)
3. That's it. The extension notices the new version within a minute and reloads itself.
- The first time, it offers an 'Update The Hub' shortcut on your desktop. After that, when the
  Hub shows its Update bubble: tap Update, double-click the shortcut, type Y. UNINSTALL.bat removes it.
- It checks the zip really is The Hub and a newer version before changing anything,
  and it always asks first. Nothing installs in the background on its own, so a stray
  download can never sneak code into your browser.

COMING FROM 1.0, 1.1 OR 1.3 WITHOUT UPDATE.bat (one time)
- Unzip this over your existing extension folder (replace the files), then press the
  reload arrow on The Hub's card in chrome://extensions. From then on, use UPDATE.bat.

UNINSTALL (1 click)
- Click The Hub's toolbar button, then Uninstall (Chrome asks you to confirm once).
- Your Hub page and its data stay; only the extension is removed. Then delete this folder.

If the Activity tab says "Not detected"
- Make sure the extension is on in chrome://extensions, then reload The Hub.
- The bridge between the extension and the Hub page is new and couldn't be tested
  before sending. If it never connects, the toolbar button still shows all your stats.

AGENTS RELAY (1.6)
- The relay folder lets Claude Code, Codex and other agents talk to each other and to your Hub.
  Open relay\RELAY-README.txt, or just double-click relay\CONNECT-AGENTS.bat.
