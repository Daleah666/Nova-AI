const $ = (id) => document.getElementById(id);
const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m"; };

async function showCode() { $("code").textContent = await chrome.runtime.sendMessage({ type: "token" }); }
$("copyCode").onclick = async () => {
  try { await navigator.clipboard.writeText($("code").textContent); $("copyCode").textContent = "Copied"; setTimeout(() => $("copyCode").textContent = "Copy", 1500); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("code")); getSelection().removeAllRanges(); getSelection().addRange(r); $("note").textContent = "Press Ctrl+C to copy."; }
};
let newArmed = false;
$("newCode").onclick = async () => {
  if (!newArmed) { newArmed = true; $("newCode").textContent = "Tap again: the Hub will need the new code"; setTimeout(() => { newArmed = false; $("newCode").textContent = "New code"; }, 4000); return; }
  newArmed = false; $("newCode").textContent = "New code"; $("code").textContent = await chrome.runtime.sendMessage({ type: "newToken" });
};

async function render() {
  const data = await chrome.runtime.sendMessage({ type: "panelSummary" });
  const { newtabOff } = await chrome.storage.local.get("newtabOff");
  $("trackSw").checked = !data.paused;
  $("newtabSw").checked = !newtabOff;
  $("status").textContent = (data.paused ? "Paused" : "Tracking") + " · v" + chrome.runtime.getManifest().version;
  const total = data.today.reduce((a, s) => a + s.secs, 0);
  $("total").textContent = fmt(total);
  const sites = $("sites"); sites.textContent = "";
  if (!data.today.length) {
    const p = document.createElement("div"); p.className = "empty";
    p.textContent = data.paused ? "Tracking is paused." : "Nothing yet today. Time shows up after a minute of browsing.";
    sites.append(p);
  } else {
    const max = data.today[0].secs || 1;
    data.today.slice(0, 8).forEach((s) => {
      const row = document.createElement("div"); row.className = "brow";
      const n = document.createElement("span"); n.className = "n"; n.textContent = s.domain; n.title = s.domain;
      const tr = document.createElement("span"); tr.className = "tr";
      const i = document.createElement("i"); i.style.width = (s.secs / max * 100).toFixed(1) + "%"; tr.append(i);
      const v = document.createElement("span"); v.className = "v"; v.textContent = fmt(s.secs);
      row.append(n, tr, v); sites.append(row);
    });
  }
  const cols = $("cols"); cols.textContent = "";
  const mx = Math.max(60, ...data.week.map((w) => w.secs));
  data.week.forEach((w, idx) => {
    const i = document.createElement("i");
    i.className = w.secs ? (idx === data.week.length - 1 ? "t" : "") : "z";
    i.style.height = Math.max(3, w.secs / mx * 100) + "%";
    i.title = w.day + ": " + fmt(w.secs);
    cols.append(i);
  });
  const days = data.week.filter((w) => w.secs).length;
  $("avg").textContent = days ? "avg " + fmt(data.week.reduce((a, w) => a + w.secs, 0) / days) + " / day" : "";
}

$("popBtn").onclick = () => chrome.runtime.sendMessage({ type: "openHubWindow" }).then(() => window.close());
$("talkBtn").onclick = () => chrome.runtime.sendMessage({ type: "openVoice" }).then(() => window.close());
$("tabBtn").onclick =() => chrome.runtime.sendMessage({ type: "openHubTab" }).then(() => window.close());
$("sideBtn").onclick = async () => {
  try {
    const w = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: w.id });
    window.close();
  } catch (e) { $("note").textContent = "This version of Chrome can't open the side panel from here. Right-click the Hub icon and choose Open side panel."; }
};
$("trackSw").onchange = async () => { await chrome.storage.local.set({ paused: !$("trackSw").checked }); render(); };
$("newtabSw").onchange = async () => { await chrome.storage.local.set({ newtabOff: !$("newtabSw").checked }); $("note").textContent = $("newtabSw").checked ? "New tabs will open the Hub." : "New tabs will show a plain search box."; };
let armed = false;
$("clearBtn").onclick = async () => {
  if (!armed) { armed = true; $("clearBtn").textContent = "Tap again to clear"; setTimeout(() => { armed = false; $("clearBtn").textContent = "Clear activity"; }, 4000); return; }
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith("act:")));
  armed = false; $("clearBtn").textContent = "Clear activity"; $("note").textContent = "Activity cleared."; render();
};
$("uninstallBtn").onclick = () => chrome.management.uninstallSelf({ showConfirmDialog: true }).catch(() => { $("note").textContent = "Uninstall was cancelled."; });

async function renderTidy() {
  const r = await chrome.runtime.sendMessage({ type: "getTidy" });
  $("tidySw").checked = r.tidy.on; $("tidyMins").value = String(r.tidy.mins); $("tidyAct").value = r.tidy.action;
  $("tidyMins").disabled = $("tidyAct").disabled = !r.tidy.on;
  $("tidyCount").textContent = r.tidied.length ? r.tidied.length + " closed recently, reopen them from the Hub's Settings." : "";
}
async function saveTidy() {
  await chrome.runtime.sendMessage({ type: "setTidy", tidy: { on: $("tidySw").checked, mins: +$("tidyMins").value, action: $("tidyAct").value } });
  renderTidy();
}
["tidySw", "tidyMins", "tidyAct"].forEach((id) => $(id).addEventListener("change", saveTidy));

showCode();
render();
renderTidy();
