#!/usr/bin/env node
/**
 * Nova Twin Collector — local server for consent-based twin signal ingestion.
 * Runs silently (optimized mode). Auto-flushes to Nova-AI logs.
 *
 * Usage:
 *   npm start              — listen on http://127.0.0.1:9477
 *   npm run probe          — start server + open browser probe
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import {
  appendSignalArchive,
  appendPendingSignal,
  incrementBufferCount,
  flushToUserModel,
  clearBufferPending,
  readPendingSignalCount,
  REPO_ROOT,
} from "./lib/buffer-flush.js";
import { rankSignals, topPuppetVectors } from "./lib/signal-scorer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9477;
const FLUSH_THRESHOLD = 5;
const CONSENT_VERSION = "1.0.0";

/** In-memory session store (local only — never leaves machine unless user exports) */
const sessions = new Map();
const pendingFlush = [];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Twin-Consent");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function validateSignal(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid payload" };
  if (!raw.consent?.granted) return { ok: false, error: "Consent required" };
  if (!raw.signal || !raw.category) return { ok: false, error: "signal and category required" };

  return {
    ok: true,
    signal: {
      timestamp: raw.timestamp || new Date().toISOString(),
      consent: raw.consent,
      category: raw.category,
      signal: String(raw.signal).slice(0, 2000),
      source: raw.source || "local-collector",
      confidence: raw.confidence || "medium",
      puppetVector: raw.puppetVector || null,
      payload: raw.payload || null,
      quote: raw.quote ? String(raw.quote).slice(0, 500) : null,
      sessionId: raw.sessionId || null,
    },
  };
}

function ingestSignal(signal) {
  appendSignalArchive(signal);
  appendPendingSignal(signal);
  const count = incrementBufferCount();
  pendingFlush.push(signal);

  if (signal.sessionId) {
    if (!sessions.has(signal.sessionId)) {
      sessions.set(signal.sessionId, { started: Date.now(), signals: [] });
    }
    sessions.get(signal.sessionId).signals.push(signal);
  }

  if (count >= FLUSH_THRESHOLD || pendingFlush.length >= FLUSH_THRESHOLD) {
    doFlush();
  }

  return { buffered: count, flushed: false };
}

function doFlush() {
  if (!pendingFlush.length) return { merged: 0 };
  const batch = [...pendingFlush];
  pendingFlush.length = 0;
  const result = flushToUserModel(batch);
  clearBufferPending(result.merged);
  return result;
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
  };
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  cors(res);
  res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health + status (for checking optimized mode is running)
  if (url.pathname === "/api/status" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      mode: "optimized",
      consentVersion: CONSENT_VERSION,
      buffered: readPendingSignalCount(),
      sessions: sessions.size,
      repo: REPO_ROOT,
    });
  }

  // Ingest single or batch signals
  if (url.pathname === "/api/signal" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const items = Array.isArray(body) ? body : [body];
      const ingested = [];

      for (const raw of items) {
        const v = validateSignal(raw);
        if (!v.ok) return json(res, 400, { error: v.error });
        ingested.push(ingestSignal(v.signal));
      }

      return json(res, 200, { ok: true, ingested });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // Manual flush (sync twin)
  if (url.pathname === "/api/flush" && req.method === "POST") {
    const result = doFlush();
    return json(res, 200, { ok: true, ...result });
  }

  // Puppet profile — ranked signals for avatar control
  if (url.pathname === "/api/puppet-profile" && req.method === "GET") {
    const sessionId = url.searchParams.get("sessionId");
    let signals = pendingFlush;
    if (sessionId && sessions.has(sessionId)) {
      signals = sessions.get(sessionId).signals;
    }

    // Also read recent archive lines
    const archivePath = path.join(REPO_ROOT, "logs/twin-signals.jsonl");
    if (fs.existsSync(archivePath)) {
      const lines = fs.readFileSync(archivePath, "utf8").trim().split("\n").slice(-100);
      for (const line of lines) {
        try {
          signals.push(JSON.parse(line));
        } catch (_) {}
      }
    }

    const ranked = rankSignals(signals);
    const vectors = topPuppetVectors(signals);

    return json(res, 200, {
      ok: true,
      topSignals: ranked.slice(0, 20),
      puppetVectors: vectors,
      totalSignals: signals.length,
    });
  }

  // Consent token issue (browser sets cookie from this)
  if (url.pathname === "/api/consent" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const token = {
        granted: !!body.granted,
        version: CONSENT_VERSION,
        scope: body.scope || ["interaction", "preference", "puppet"],
        at: new Date().toISOString(),
        subject: body.subject || "user",
      };
      return json(res, 200, { ok: true, consent: token });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // Static: browser probe
  if (url.pathname === "/" || url.pathname === "/probe") {
    return serveStatic(path.join(__dirname, "browser-probe.html"), res);
  }
  if (url.pathname === "/bookmarklet.js") {
    return serveStatic(path.join(__dirname, "bookmarklet.js"), res);
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Nova Twin Collector running (optimized mode)`);
  console.log(`  Probe UI:  http://127.0.0.1:${PORT}/probe`);
  console.log(`  API:       http://127.0.0.1:${PORT}/api/signal`);
  console.log(`  Flush at:  ${FLUSH_THRESHOLD}+ signals or POST /api/flush`);
  console.log(`  Logs:      ${REPO_ROOT}/logs/`);

  if (process.argv.includes("--open-probe")) {
    const probeUrl = `http://127.0.0.1:${PORT}/probe`;
    const cmd =
      process.platform === "win32"
        ? `start "" "${probeUrl}"`
        : process.platform === "darwin"
          ? `open "${probeUrl}"`
          : `xdg-open "${probeUrl}"`;
    exec(cmd);
  }
});

process.on("SIGINT", () => {
  const count = pendingFlush.length;
  if (count) {
    doFlush();
    console.log(`Flushed ${count} signals on exit`);
  }
  process.exit(0);
});
