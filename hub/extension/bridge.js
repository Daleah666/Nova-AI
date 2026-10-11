// The Hub — bridge. Runs only inside your Hub page on claude.ai (it checks for the Hub's marker tag and
// that the page is shown inside claude.ai) and does nothing anywhere else.
// Nothing is shared until you connect: either press Connect in the Hub and confirm in the window this
// extension opens, or paste the code from the toolbar button.
(() => {
  if (!document.querySelector('meta[name="the-hub-bridge"]')) return;
  const anc = location.ancestorOrigins ? Array.from(location.ancestorOrigins) : [];
  const onClaude = location.origin === "https://claude.ai" || anc.includes("https://claude.ai");
  if (!onClaude) return;

  const post = (type, payload) => window.postMessage({ source: "the-hub-extension", type, payload }, "*");
  let token = "";
  let timer = null;
  let paired = false;
  chrome.runtime.onMessage.addListener((m) => {
    if (!m) return;
    if (m.type === "hub-voice" && paired && typeof m.text === "string") post("voice", { text: m.text });
    if (m.type === "hub-dictation" && paired && typeof m.text === "string") post("dictation", { text: m.text });
    // Sent only after you press Connect in the extension's own window.
    if (m.type === "hub-token" && typeof m.token === "string") { token = m.token; post("token", { token: m.token }); }
  });
  const ask = (m) => chrome.runtime.sendMessage(Object.assign({ token }, m)).catch(() => ({ error: "gone" }));

  async function sendActivity() {
    const res = await ask({ type: "summary" });
    if (!res || res.error) { if (res && res.error === "pair") post(token ? "pair-failed" : "pair-needed"); return; }
    post("activity", res);
  }

  window.addEventListener("message", async (e) => {
    // Only the Hub page itself, never an add-on or any other frame inside it.
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== "the-hub-page") return;
    if (typeof d.token === "string" && d.token) token = d.token;
    if (d.type === "pair-request") { await chrome.runtime.sendMessage({ type: "pairRequest" }).catch(() => {}); return; }
    if (d.type === "hello" || d.type === "request") {
      const v = await ask({ type: "verify" });
      if (v && v.ok) {
        paired = true;
        post("paired");
        sendActivity();
        if (!timer) timer = setInterval(sendActivity, 60000);
        const pv = await ask({ type: "pendingVoice" });
        if (pv && pv.text) post("voice", { text: pv.text });
      } else {
        post(token ? "pair-failed" : "pair-needed");
      }
      return;
    }
    if (!paired) return;
    if (d.type === "open") { const r = await ask({ type: "open", url: d.url }); if (r && r.ok) setTimeout(sendActivity, 800); return; }
    if (d.type === "focus") { await ask({ type: "focus", tabId: d.tabId }); return; }
    if (d.type === "close") { await ask({ type: "close", tabId: d.tabId }); setTimeout(sendActivity, 400); return; }
    if (d.type === "peek") { await ask({ type: "peek", url: d.url }); return; }
    if (d.type === "dictate") { await ask({ type: "dictate" }); return; }
    if (d.type === "setTidy") { await ask({ type: "setTidy", tidy: d.tidy }); sendActivity(); return; }
    if (d.type === "reopen") { await ask({ type: "reopen", url: d.url }); setTimeout(sendActivity, 500); return; }
    // Calls that answer back (Grok images and the Grok key status). The key itself is only ever sent one way, to be stored.
    if (d.type === "call" && typeof d.reqId === "string" && ["grokImage", "grokKeySet", "grokKeyClear", "grokKeyStatus", "grokKeyTest", "openExtDetails", "relayCall", "relayCodeSet", "relayCodeClear", "relayStatus", "keyStatus", "keySet", "keyClear", "keyTest"].includes(d.op)) {
      const res = await ask(Object.assign({}, d.args || {}, { type: d.op }));
      post("reply", { reqId: d.reqId, result: res });
      return;
    }
  });

  post("present", { version: chrome.runtime.getManifest().version, caps: ["connect", "peek", "dictate", "tidy", "grok", "details", "relay", "keys"] });
})();
