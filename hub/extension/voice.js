// Talk to the Hub: listens once, shows what it heard, and sends it to your Hub's host.
const $ = (id) => document.getElementById(id);
const btn = $("mic"), st = $("status"), tx = $("text");
let rec = null;
// Dictation mode: what you say gets typed into the box you clicked in the Hub.
const qs = new URLSearchParams(location.search);
const dictate = qs.get("mode") === "dictate";
const target = { tabId: Number(qs.get("tab")), frameId: Number(qs.get("frame")) || 0 };
if (dictate) document.title = "Dictate into the Hub";

async function start() {
  if (rec) { rec.stop(); return; }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
  } catch (e) {
    st.textContent = "Chrome needs permission to use your microphone. Allow it when asked, then press the mic again.";
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { st.textContent = "This version of Chrome can't turn speech into text."; return; }
  const r = new SR(); rec = r;
  r.lang = navigator.language || "en-US"; r.interimResults = true; r.continuous = false;
  let finalText = "";
  r.onresult = (e) => {
    let t = "";
    for (const res of e.results) { t += res[0].transcript; if (res.isFinal) finalText = t; }
    tx.textContent = t;
  };
  r.onerror = (e) => {
    st.textContent = e.error === "no-speech" ? "Didn't catch anything. Press the mic to try again."
      : e.error === "not-allowed" ? "The microphone is blocked for this extension. Allow it in Chrome's site settings, then try again."
      : "Couldn't hear you (" + e.error + "). Press the mic to try again.";
  };
  r.onend = async () => {
    rec = null; btn.classList.remove("on");
    const t = (finalText || tx.textContent).trim();
    if (!t) return;
    st.textContent = dictate ? "Typing it into the Hub…" : "Sending to the Hub…";
    const res = await chrome.runtime.sendMessage(dictate ? { type: "dictation", text: t, tabId: target.tabId, frameId: target.frameId } : { type: "voice", text: t }).catch(() => null);
    st.textContent = res && res.ok ? (dictate ? "Done." : "Sent. Your host is on it.") : "Couldn't reach the Hub. Open it and try again.";
    if (res && res.ok) setTimeout(() => window.close(), 1500);
  };
  r.start();
  btn.classList.add("on");
  st.textContent = dictate ? "Listening… what you say gets typed into the Hub." : "Listening… try “add lunch with Sam tomorrow at 1 to my calendar”.";
}

btn.onclick = start;
start();
