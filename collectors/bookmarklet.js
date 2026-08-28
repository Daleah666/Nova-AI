/**
 * Nova Twin Bookmarklet — lightweight passive capture on any page.
 * Requires: twin-collector server running + consent cookie from probe.
 */
(function () {
  const API = "http://127.0.0.1:9477";

  function getConsent() {
    const match = document.cookie.match(/nova_twin_consent=([^;]+)/);
    if (match) {
      try {
        return JSON.parse(decodeURIComponent(match[1]));
      } catch (_) {}
    }
    return JSON.parse(localStorage.getItem("nova_twin_consent") || "null");
  }

  const consent = getConsent();
  if (!consent?.granted) {
    alert("Nova Twin: open http://127.0.0.1:9477/probe and grant consent first.");
    return;
  }

  const sessionId = localStorage.getItem("nova_twin_session") || crypto.randomUUID();
  localStorage.setItem("nova_twin_session", sessionId);

  const scope = consent.scope || [];
  const signals = [];

  function emit(category, signal, puppetVector, payload) {
    signals.push({
      consent,
      timestamp: new Date().toISOString(),
      category,
      signal,
      source: "bookmarklet",
      sessionId,
      confidence: "medium",
      puppetVector,
      payload,
    });
  }

  // Page context
  emit("pattern", `Visited: ${document.title}`, "workflow-rhythm", {
    url: location.href,
    title: document.title,
  });

  // Scroll depth (engagement rhythm)
  if (scope.includes("interaction")) {
    let maxScroll = 0;
    const onScroll = () => {
      const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (pct > maxScroll) maxScroll = pct;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    setTimeout(() => {
      window.removeEventListener("scroll", onScroll);
      if (maxScroll > 10) {
        emit("interaction", `Scroll depth ${maxScroll}% on page`, "workflow-rhythm", { scrollPct: maxScroll });
      }
    }, 30000);
  }

  // Click preference (what they interact with)
  if (scope.includes("interaction") || scope.includes("puppet")) {
    document.addEventListener(
      "click",
      (e) => {
        const t = e.target.closest("a, button, [role=button]");
        if (!t) return;
        const label = (t.textContent || t.getAttribute("aria-label") || t.tagName).trim().slice(0, 80);
        emit("decision", `Clicked: ${label}`, "reaction-speed", {
          tag: t.tagName,
          href: t.href || null,
        });
      },
      { capture: true, passive: true }
    );
  }

  // Batch send every 10s
  setInterval(() => {
    if (!signals.length) return;
    const batch = signals.splice(0, signals.length);
    fetch(`${API}/api/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {
      const buf = JSON.parse(localStorage.getItem("nova_twin_offline_buffer") || "[]");
      localStorage.setItem("nova_twin_offline_buffer", JSON.stringify(buf.concat(batch)));
    });
  }, 10000);

  // Visual indicator (tiny, non-intrusive)
  const badge = document.createElement("div");
  badge.textContent = "◉ twin";
  badge.title = "Nova Twin collecting (optimized)";
  Object.assign(badge.style, {
    position: "fixed",
    bottom: "12px",
    right: "12px",
    background: "#16161f",
    color: "#a78bfa",
    font: "11px monospace",
    padding: "4px 8px",
    borderRadius: "6px",
    border: "1px solid #2a2a3a",
    zIndex: "999999",
    opacity: "0.7",
    pointerEvents: "none",
  });
  document.body.appendChild(badge);
})();
