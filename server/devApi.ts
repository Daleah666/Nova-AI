import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const CARTESIA_API = "https://api.cartesia.ai";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function query(url: URL, key: string): string {
  return url.searchParams.get(key)?.trim() ?? "";
}

async function handleTts(req: IncomingMessage, res: ServerResponse) {
  const apiKey = process.env.CARTESIA_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 501, {
      ok: false,
      error: "CARTESIA_API_KEY is not set. Browser speechSynthesis will be used instead.",
    });
    return;
  }

  let transcript = "";
  try {
    const parsed = JSON.parse(await readBody(req)) as { transcript?: string };
    transcript = (parsed.transcript ?? "").trim();
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
    return;
  }

  if (!transcript) {
    sendJson(res, 400, { ok: false, error: "transcript is required." });
    return;
  }

  const voiceId =
    process.env.CARTESIA_VOICE_ID?.trim() || "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4";
  const modelId = process.env.CARTESIA_MODEL_ID?.trim() || "sonic-3.6";
  const version = process.env.CARTESIA_VERSION?.trim() || "2026-08-14";

  const upstream = await fetch(`${CARTESIA_API}/tts/bytes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Cartesia-Version": version,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: modelId,
      transcript,
      voice: { id: voiceId },
      language: "en",
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        sample_rate: 44100,
      },
      generation_config: { speed: 0.85, emotion: "calm" },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    sendJson(res, 502, {
      ok: false,
      error: `Cartesia TTS failed (${upstream.status}).`,
      detail: detail.slice(0, 500),
    });
    return;
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "no-store");
  res.end(audio);
}

async function handleDriveList(url: URL, res: ServerResponse) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  const folderId = query(url, "folderId");
  if (!apiKey) {
    sendJson(res, 501, {
      ok: false,
      error: "GOOGLE_API_KEY is not set. Use OAuth or local uploads.",
    });
    return;
  }
  if (!folderId) {
    sendJson(res, 400, { ok: false, error: "folderId is required." });
    return;
  }

  const q = `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false and mimeType contains 'image/'`;
  const driveUrl = new URL(`${DRIVE_API}/files`);
  driveUrl.searchParams.set("q", q);
  driveUrl.searchParams.set("fields", "files(id,name,mimeType,thumbnailLink)");
  driveUrl.searchParams.set("pageSize", "100");
  driveUrl.searchParams.set("key", apiKey);
  driveUrl.searchParams.set("supportsAllDrives", "true");
  driveUrl.searchParams.set("includeItemsFromAllDrives", "true");

  const upstream = await fetch(driveUrl);
  if (!upstream.ok) {
    const detail = await upstream.text();
    sendJson(res, 502, {
      ok: false,
      error: `Drive list failed (${upstream.status}). Share the folder as Anyone-with-the-link, or use OAuth.`,
      detail: detail.slice(0, 500),
    });
    return;
  }

  const data = (await upstream.json()) as {
    files?: { id: string; name: string; mimeType: string; thumbnailLink?: string }[];
  };
  sendJson(res, 200, {
    ok: true,
    files: (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      mediaPath: `/api/drive/media/${encodeURIComponent(f.id)}`,
    })),
  });
}

async function handleDriveMedia(id: string, res: ServerResponse) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 501, { ok: false, error: "GOOGLE_API_KEY is not set." });
    return;
  }
  if (!id) {
    sendJson(res, 400, { ok: false, error: "file id is required." });
    return;
  }

  const driveUrl = new URL(`${DRIVE_API}/files/${encodeURIComponent(id)}`);
  driveUrl.searchParams.set("alt", "media");
  driveUrl.searchParams.set("key", apiKey);
  driveUrl.searchParams.set("supportsAllDrives", "true");

  const upstream = await fetch(driveUrl);
  if (!upstream.ok) {
    const detail = await upstream.text();
    sendJson(res, 502, {
      ok: false,
      error: `Drive media failed (${upstream.status}).`,
      detail: detail.slice(0, 400),
    });
    return;
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") || "application/octet-stream",
  );
  res.setHeader("Cache-Control", "private, max-age=300");
  res.end(buf);
}

export function subliminalDevApi(): Plugin {
  return {
    name: "subliminal-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? "";
        if (!raw.startsWith("/api/")) {
          next();
          return;
        }

        const url = new URL(raw, "http://localhost");
        try {
          if (url.pathname === "/api/config" && req.method === "GET") {
            sendJson(res, 200, {
              googleClientId: process.env.VITE_GOOGLE_CLIENT_ID?.trim() || "",
              hasGoogleApiKey: Boolean(process.env.GOOGLE_API_KEY?.trim()),
              hasCartesia: Boolean(process.env.CARTESIA_API_KEY?.trim()),
            });
            return;
          }
          if (url.pathname === "/api/tts" && req.method === "POST") {
            await handleTts(req, res);
            return;
          }
          if (url.pathname === "/api/drive/list" && req.method === "GET") {
            await handleDriveList(url, res);
            return;
          }
          const media = url.pathname.match(/^\/api\/drive\/media\/([^/]+)$/);
          if (media && req.method === "GET") {
            await handleDriveMedia(decodeURIComponent(media[1]), res);
            return;
          }
          sendJson(res, 404, { ok: false, error: "Unknown API route." });
        } catch (err) {
          sendJson(res, 500, {
            ok: false,
            error: err instanceof Error ? err.message : "Server error.",
          });
        }
      });
    },
  };
}
