/**
 * Nova Twin Probe — browser-side consent + interaction capture.
 * Open via twin-collector server or locally as file (API calls need server).
 */
(function () {
  const API = "http://127.0.0.1:9477";
  const COOKIE_NAME = "nova_twin_consent";
  const SESSION_KEY = "nova_twin_session";
  const BUFFER_KEY = "nova_twin_offline_buffer";

  const state = {
    consent: null,
    sessionId: null,
    typingSamples: [],
    choiceLog: [],
    startTime: Date.now(),
  };

  // ── Consent cookie (first-party, 365 days) ──
  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    if (!match) return null;
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch {
      return null;
    }
  }

  async function requestConsent(scope) {
    const res = await fetch(`${API}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granted: true, scope, subject: "buppy" }),
    });
    const data = await res.json();
    state.consent = data.consent;
    setCookie(COOKIE_NAME, state.consent, 365);
    localStorage.setItem(COOKIE_NAME, JSON.stringify(state.consent));
    return state.consent;
  }

  function revokeConsent() {
    state.consent = { granted: false, at: new Date().toISOString() };
    setCookie(COOKIE_NAME, state.consent, -1);
    localStorage.removeItem(COOKIE_NAME);
    localStorage.removeItem(BUFFER_KEY);
    updateUI();
  }

  function loadConsent() {
    state.consent = getCookie(COOKIE_NAME) || JSON.parse(localStorage.getItem(COOKIE_NAME) || "null");
    return state.consent?.granted;
  }

  function sessionId() {
    if (state.sessionId) return state.sessionId;
    state.sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, state.sessionId);
    return state.sessionId;
  }

  function buildSignal(category, signal, extras = {}) {
    return {
      consent: state.consent,
      timestamp: new Date().toISOString(),
      category,
      signal,
      sessionId: sessionId(),
      source: "browser-probe",
      ...extras,
    };
  }

  async function sendSignal(sig) {
    if (!state.consent?.granted) return;
    try {
      await fetch(`${API}/api/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Twin-Consent": "1" },
        body: JSON.stringify(sig),
      });
    } catch {
      const buf = JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]");
      buf.push(sig);
      localStorage.setItem(BUFFER_KEY, JSON.stringify(buf));
    }
  }

  async function flushOffline() {
    const buf = JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]");
    if (!buf.length) return;
    try {
      await fetch(`${API}/api/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buf),
      });
      localStorage.removeItem(BUFFER_KEY);
    } catch (_) {}
  }

  // ── Interaction capture (puppet vectors) ──

  function captureTyping(el) {
    let lastKey = Date.now();
    let chars = 0;
    el.addEventListener("keydown", () => {
      const now = Date.now();
      const delta = now - lastKey;
      if (delta > 50 && delta < 2000) {
        state.typingSamples.push(delta);
        chars++;
      }
      lastKey = now;
    });
    el.addEventListener("blur", () => {
      if (chars < 5) return;
      const avg = state.typingSamples.reduce((a, b) => a + b, 0) / state.typingSamples.length;
      const wpm = Math.round((60000 / avg) * 5); // rough estimate
      sendSignal(
        buildSignal("communication", `Typing rhythm: ~${wpm} WPM equivalent, avg ${Math.round(avg)}ms between keys`, {
          puppetVector: "communication-voice",
          confidence: "medium",
          payload: { wpmEstimate: wpm, avgKeyMs: Math.round(avg), sampleSize: state.typingSamples.length },
        })
      );
      state.typingSamples = [];
      chars = 0;
    });
  }

  function captureChoice(label, value, vector, category = "preference") {
    state.choiceLog.push({ label, value, at: Date.now() });
    sendSignal(
      buildSignal(category, `${label}: chose "${value}"`, {
        puppetVector: vector,
        confidence: "high",
        payload: { label, value },
      })
    );
  }

  function captureReactionSpeed(btnLabel, startMs) {
    const ms = Date.now() - startMs;
    sendSignal(
      buildSignal("decision", `Reaction to "${btnLabel}": ${ms}ms`, {
        puppetVector: "reaction-speed",
        confidence: "high",
        payload: { label: btnLabel, reactionMs: ms },
      })
    );
  }

  // ── UI ──
  function $(id) {
    return document.getElementById(id);
  }

  function updateUI() {
    const granted = state.consent?.granted;
    $("consent-panel").classList.toggle("hidden", granted);
    $("probe-panel").classList.toggle("hidden", !granted);
    $("status-dot").className = granted ? "dot on" : "dot off";
    $("status-text").textContent = granted ? "Collecting (optimized)" : "Consent required";
  }

  async function initUI() {
    $("grant-btn").addEventListener("click", async () => {
      const scopes = [...document.querySelectorAll('input[name="scope"]:checked')].map((c) => c.value);
      await requestConsent(scopes.length ? scopes : ["interaction", "preference", "puppet"]);
      await flushOffline();
      updateUI();
    });

    $("revoke-btn").addEventListener("click", revokeConsent);

    $("sync-btn").addEventListener("click", async () => {
      await fetch(`${API}/api/flush`, { method: "POST" });
      $("sync-result").textContent = "Twin synced to logs ✓";
    });

    $("export-btn").addEventListener("click", async () => {
      const res = await fetch(`${API}/api/puppet-profile?sessionId=${sessionId()}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `puppet-profile-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });

    // Preference probes — map directly to puppet control axes
    const reactionStart = Date.now();
    document.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        captureChoice(btn.dataset.label, btn.dataset.choice, btn.dataset.vector, btn.dataset.category || "preference");
        captureReactionSpeed(btn.dataset.label, reactionStart);
        btn.classList.add("picked");
      });
    });

    // Avatar expression probe
    $("avatar-mood").addEventListener("change", (e) => {
      captureChoice("Default avatar mood", e.target.value, "avatar-expression", "avatar");
    });

    // Aesthetic color pick
    $("color-pick").addEventListener("input", (e) => {
      $("color-preview").style.background = e.target.value;
    });
    $("color-pick").addEventListener("change", (e) => {
      captureChoice("Preferred accent color", e.target.value, "aesthetic-taste", "aesthetic");
    });

    // Free-form voice sample
    $("voice-sample").addEventListener("blur", (e) => {
      const text = e.target.value.trim();
      if (text.length < 10) return;
      sendSignal(
        buildSignal("communication", "Voice sample captured for communication mirroring", {
          puppetVector: "communication-voice",
          confidence: "high",
          quote: text.slice(0, 200),
          payload: { length: text.length, wordCount: text.split(/\s+/).length },
        })
      );
    });

    captureTyping($("voice-sample"));

    // Values tradeoff
    $("speed-polish").addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      $("speed-polish-label").textContent = v < 40 ? "Speed" : v > 60 ? "Polish" : "Balanced";
    });
    $("speed-polish").addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      sendSignal(
        buildSignal("decision", `Speed vs polish slider: ${v}/100 (${v < 40 ? "speed-first" : v > 60 ? "polish-first" : "balanced"})`, {
          puppetVector: "values-tradeoff",
          confidence: "high",
          payload: { speedPolish: v },
        })
      );
    });

    loadConsent();
    updateUI();
    flushOffline();

    // Ping server status
    fetch(`${API}/api/status`)
      .then((r) => r.json())
      .then((d) => {
        $("server-status").textContent = d.ok ? `Server OK · ${d.buffered} buffered` : "Server offline";
      })
      .catch(() => {
        $("server-status").textContent = "Server offline — signals queue locally";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
