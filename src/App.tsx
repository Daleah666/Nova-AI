import { useEffect, useMemo, useRef, useState } from "react";
import { SafetyGate } from "./components/SafetyGate";
import { FlashStage } from "./components/FlashStage";
import {
  DEFAULT_TEMPLATE_ID,
  SCRIPT_TEMPLATES,
  linesToSpeech,
  scriptToText,
  templateById,
  textToLines,
} from "./data/templates";
import { SessionEngine } from "./lib/audioEngine";
import {
  extractFolderId,
  fetchDriveBlob,
  fetchServerConfig,
  listDriveImagesWithApiKey,
  listDriveImagesWithToken,
  requestDriveToken,
} from "./lib/drive";
import { clampHz, clampIntervalMs, DEFAULT_HZ, HARD_MAX_HZ, hzToIntervalMs } from "./lib/flash";
import { builtInVisuals } from "./lib/hypnoVisuals";
import { acceptSafety, hasAcceptedSafety } from "./lib/safety";
import {
  loadFolderId,
  loadScriptText,
  loadSettingsJson,
  saveFolderId,
  saveScriptText,
  saveSettingsJson,
} from "./lib/storage";
import { decodeWav, fetchCartesiaWav } from "./lib/tts";
import type { AudioMode, ScriptTemplateId, ServerConfig, SessionSettings, VisualItem, VoiceEngine } from "./types";

const DEFAULT_SETTINGS: SessionSettings = {
  audioMode: "silent",
  includeVoice: true,
  flashHz: DEFAULT_HZ,
  carrierHz: 220,
  beatHz: 7,
  silentVoiceGain: 0.05,
  voicedGain: 0.28,
  carrierGain: 0.32,
};

function loadSettings(): SessionSettings {
  const raw = loadSettingsJson();
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SessionSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function App() {
  const [safe, setSafe] = useState(hasAcceptedSafety);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [templateId, setTemplateId] = useState<ScriptTemplateId>(DEFAULT_TEMPLATE_ID);
  const [scriptText, setScriptText] = useState(
    () => loadScriptText() ?? scriptToText(templateById(DEFAULT_TEMPLATE_ID).lines),
  );
  const [settings, setSettings] = useState<SessionSettings>(loadSettings);
  const [folderInput, setFolderInput] = useState(loadFolderId);
  const [visuals, setVisuals] = useState<VisualItem[]>(() => builtInVisuals());
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle. Nothing plays until you start a session.");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>("none");
  const engineRef = useRef(new SessionEngine());
  const voiceBufferRef = useRef<AudioBuffer | null>(null);
  const objectUrls = useRef<string[]>([]);
  const startedAt = useRef<number | null>(null);
  const driveToken = useRef<string | null>(null);

  const lines = useMemo(() => textToLines(scriptText), [scriptText]);
  const flashHz = clampHz(settings.flashHz);
  const current = visuals[index] ?? visuals[0];

  useEffect(() => {
    void fetchServerConfig().then(setConfig);
  }, []);

  useEffect(() => {
    saveScriptText(scriptText);
  }, [scriptText]);

  useEffect(() => {
    saveSettingsJson(JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!running || paused || visuals.length === 0) return;
    const ms = clampIntervalMs(hzToIntervalMs(flashHz));
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % visuals.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [running, paused, flashHz, visuals.length]);

  useEffect(() => {
    if (!running || paused) return;
    startedAt.current ??= Date.now();
    const id = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [running, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopSession();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current.stop();
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  function trackUrls(urls: string[]) {
    objectUrls.current.push(...urls);
  }

  function applyTemplate(id: ScriptTemplateId) {
    const template = templateById(id);
    setTemplateId(id);
    setScriptText(scriptToText(template.lines));
  }

  function patch(partial: Partial<SessionSettings>) {
    setSettings((s) => ({ ...s, ...partial }));
  }

  async function addLocalFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    const urls = files.map((f) => URL.createObjectURL(f));
    trackUrls(urls);
    const next: VisualItem[] = files.map((f, i) => ({
      id: `local-${f.name}-${f.size}-${i}`,
      name: f.name,
      src: urls[i],
      source: "local",
    }));
    setVisuals((prev) => {
      const kept = prev.filter((v) => v.source === "built-in");
      return [...kept, ...prev.filter((v) => v.source === "drive"), ...next];
    });
    setStatus(`Added ${next.length} local image${next.length === 1 ? "" : "s"}.`);
  }

  async function loadDrive(kind: "oauth" | "apikey") {
    const folderId = extractFolderId(folderInput);
    if (!folderId) {
      setError("Paste a Drive folder URL or ID first.");
      return;
    }
    saveFolderId(folderId);
    setBusy(true);
    setError("");
    try {
      if (kind === "oauth") {
        const clientId = config?.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error("Set VITE_GOOGLE_CLIENT_ID in .env to use Google sign-in.");
        const token = await requestDriveToken(clientId);
        driveToken.current = token;
        const files = await listDriveImagesWithToken(folderId, token);
        const blobs = await Promise.all(files.map((f) => fetchDriveBlob(f.id, token)));
        const urls = blobs.map((b) => URL.createObjectURL(b));
        trackUrls(urls);
        setVisuals([
          ...builtInVisuals(),
          ...files.map((f, i) => ({
            id: `drive-${f.id}`,
            name: f.name,
            src: urls[i],
            source: "drive" as const,
          })),
        ]);
        setStatus(`Loaded ${files.length} Drive image${files.length === 1 ? "" : "s"} via OAuth.`);
      } else {
        const files = await listDriveImagesWithApiKey(folderId);
        setVisuals([
          ...builtInVisuals(),
          ...files.map((f) => ({
            id: `drive-${f.id}`,
            name: f.name,
            src: f.mediaPath || `/api/drive/media/${f.id}`,
            source: "drive" as const,
          })),
        ]);
        setStatus(`Loaded ${files.length} Drive image${files.length === 1 ? "" : "s"} via API key.`);
      }
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive load failed.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareVoice(): Promise<AudioBuffer | null> {
    if (!settings.includeVoice || !lines.length) return null;
    if (voiceBufferRef.current) return voiceBufferRef.current;
    if (!config?.hasCartesia) return null;
    const wav = await fetchCartesiaWav(linesToSpeech(lines));
    const buffer = await decodeWav(wav);
    voiceBufferRef.current = buffer;
    return buffer;
  }

  async function startSession() {
    if (!safe) return;
    setError("");
    setBusy(true);
    try {
      let buffer: AudioBuffer | null = null;
      try {
        buffer = await prepareVoice();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "TTS unavailable; using browser voice.");
      }
      const used = await engineRef.current.start({
        mode: settings.audioMode,
        includeVoice: settings.includeVoice,
        lines,
        voiceBuffer: buffer,
        carrierHz: settings.carrierHz,
        beatHz: settings.beatHz,
        silentVoiceGain: settings.silentVoiceGain,
        voicedGain: settings.voicedGain,
        carrierGain: settings.carrierGain,
      });
      setVoiceEngine(used);
      startedAt.current = Date.now();
      setElapsed(0);
      setPaused(false);
      setRunning(true);
      setStatus(
        used === "cartesia"
          ? "Session looping with Cartesia voice under the carrier."
          : used === "speech-synthesis"
            ? "Session looping with browser speech + Web Audio carrier."
            : "Session looping on carrier only (add script lines to include a voice).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start audio.");
    } finally {
      setBusy(false);
    }
  }

  function pauseSession() {
    if (!running) return;
    if (paused) {
      engineRef.current.resume();
      setPaused(false);
      setStatus("Resumed.");
      return;
    }
    engineRef.current.pause();
    setPaused(true);
    setStatus("Paused. Stop is still right here.");
  }

  function stopSession() {
    engineRef.current.stop();
    setRunning(false);
    setPaused(false);
    startedAt.current = null;
    setElapsed(0);
    setVoiceEngine("none");
    setStatus("Stopped. Nothing is playing.");
  }

  function exportScript() {
    const blob = new Blob([scriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subliminal-script.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!safe) {
    return (
      <>
        <div className="grain" />
        <SafetyGate
          onAccept={() => {
            acceptSafety();
            setSafe(true);
          }}
        />
      </>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <>
      <div className="grain" />
      {running ? (
        <div className="live-shell" role="dialog" aria-label="Active session">
          <FlashStage currentSrc={current?.src ?? ""} fill />
        </div>
      ) : null}

      <div className="app" hidden={running}>
        <header className="topbar">
          <div>
            <p className="eyebrow">Local studio</p>
            <h1>Subliminal Deployer</h1>
            <p className="lede">
              Cycle visuals, write a girly script, render silent or binaural audio, then start one
              explicit looping session. You are the only audience.
            </p>
          </div>
          <div className="badge-row">
            <span className="badge">Adult self-use</span>
            <span className="badge">Cap {HARD_MAX_HZ} Hz</span>
            <span className="badge">
              {config?.hasCartesia ? "Cartesia ready" : "Browser voice fallback"}
            </span>
            <span className="badge">
              {config?.hasGoogleApiKey || config?.googleClientId ? "Drive available" : "Local images OK"}
            </span>
          </div>
        </header>

        <div className="grid">
          <section className="panel">
            <h2>Visuals</h2>
            <p className="hint">
              Built-in hypnotic stills work offline. Upload a folder, or pull a Google Drive folder
              you pick. No session starts from loading pictures.
            </p>
            <FlashStage
              currentSrc={current?.src ?? ""}
              caption={current ? `${current.name} · ${current.source}` : "No visuals"}
            />
            <div className="thumbs">
              {visuals.map((item, i) => (
                <button
                  key={item.id}
                  className={i === index ? "on" : ""}
                  type="button"
                  onClick={() => setIndex(i)}
                >
                  <img src={item.src} alt={item.name} />
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <label className="btn ghost">
                Upload images
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void addLocalFiles(e.target.files)}
                />
              </label>
              <label className="btn ghost">
                Local folder
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  ref={(el) => {
                    if (!el) return;
                    el.setAttribute("webkitdirectory", "");
                    el.setAttribute("directory", "");
                  }}
                  onChange={(e) => void addLocalFiles(e.target.files)}
                />
              </label>
            </div>
            <div className="field">
              <label htmlFor="folder">Google Drive folder URL or ID</label>
              <input
                id="folder"
                type="text"
                value={folderInput}
                placeholder="https://drive.google.com/drive/folders/…"
                onChange={(e) => setFolderInput(e.target.value)}
              />
            </div>
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => void loadDrive("oauth")}>
                Sign in to Drive
              </button>
              <button
                className="btn ghost"
                disabled={busy || !config?.hasGoogleApiKey}
                onClick={() => void loadDrive("apikey")}
              >
                Load with API key
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Script</h2>
            <p className="hint">
              Default goal: stay as girly and feminine as possible. Every line is yours to edit.
              Optional bimbofication is a template, not a hidden track.
            </p>
            <div className="templates">
              {SCRIPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={templateId === template.id ? "on" : ""}
                  onClick={() => applyTemplate(template.id)}
                >
                  {template.optional ? <div className="optional-tag">OPTIONAL</div> : null}
                  <strong>{template.name}</strong>
                  <span>{template.blurb}</span>
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="script">
              Affirmation script
            </label>
            <textarea
              id="script"
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                voiceBufferRef.current = null;
              }}
            />
            <div className="row">
              <button className="btn ghost" onClick={exportScript}>
                Download .txt
              </button>
              <label className="btn ghost">
                Import .txt
                <input
                  className="sr-only"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setScriptText(await file.text());
                    voiceBufferRef.current = null;
                  }}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Audio</h2>
            <p className="hint">
              Silent mixes affirmations very low under a brown-noise carrier. Binaural uses
              stereo beats (headphones) plus an optional voiced layer. Cartesia TTS is used when
              the server has a key; otherwise the browser speaks.
            </p>
            <div className="row">
              {(["silent", "binaural"] as AudioMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn ${settings.audioMode === mode ? "primary" : "ghost"}`}
                  onClick={() => patch({ audioMode: mode })}
                >
                  {mode === "silent" ? "Silent" : "Binaural"}
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.includeVoice}
                onChange={(e) => patch({ includeVoice: e.target.checked })}
              />
              <span>Include voiced affirmations</span>
            </label>
            <div className="sliders">
              <label>
                Flash rate
                <span>
                  {flashHz.toFixed(2)} Hz (max {HARD_MAX_HZ})
                </span>
              </label>
              <input
                type="range"
                min={0.1}
                max={HARD_MAX_HZ}
                step={0.1}
                value={flashHz}
                onChange={(e) => patch({ flashHz: clampHz(Number(e.target.value)) })}
              />
              <label>
                Carrier {settings.audioMode === "binaural" ? "/ left ear" : "gain"}
                <span>
                  {settings.audioMode === "binaural"
                    ? `${settings.carrierHz} Hz`
                    : settings.carrierGain.toFixed(2)}
                </span>
              </label>
              {settings.audioMode === "binaural" ? (
                <input
                  type="range"
                  min={120}
                  max={400}
                  step={1}
                  value={settings.carrierHz}
                  onChange={(e) => patch({ carrierHz: Number(e.target.value) })}
                />
              ) : (
                <input
                  type="range"
                  min={0.08}
                  max={0.6}
                  step={0.01}
                  value={settings.carrierGain}
                  onChange={(e) => patch({ carrierGain: Number(e.target.value) })}
                />
              )}
              {settings.audioMode === "binaural" ? (
                <>
                  <label>
                    Beat
                    <span>{settings.beatHz} Hz theta-ish</span>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    step={1}
                    value={settings.beatHz}
                    onChange={(e) => patch({ beatHz: Number(e.target.value) })}
                  />
                </>
              ) : (
                <>
                  <label>
                    Silent voice mix
                    <span>{settings.silentVoiceGain.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.03}
                    max={0.12}
                    step={0.01}
                    value={settings.silentVoiceGain}
                    onChange={(e) => patch({ silentVoiceGain: Number(e.target.value) })}
                  />
                </>
              )}
              {settings.audioMode === "binaural" && settings.includeVoice ? (
                <>
                  <label>
                    Voiced layer
                    <span>{settings.voicedGain.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.08}
                    max={0.5}
                    step={0.01}
                    value={settings.voicedGain}
                    onChange={(e) => patch({ voicedGain: Number(e.target.value) })}
                  />
                </>
              ) : null}
            </div>
            <p className={error ? "status err" : "status"}>{error || status}</p>
          </section>
        </div>
      </div>

      <div className={`dock ${running ? "live" : ""}`}>
        <div className="dock-inner">
          <div>
            <strong>{running ? (paused ? "Paused" : "Session looping") : "Ready"}</strong>
            <div className="hint" style={{ margin: 0 }}>
              {running
                ? `${mm}:${ss} · ${flashHz.toFixed(2)} Hz · ${settings.audioMode}${
                    voiceEngine !== "none" ? ` · ${voiceEngine}` : ""
                  } · Esc stops`
                : "Start needs a click. Stop and pause stay visible. No fullscreen hide."}
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={pauseSession} disabled={!running}>
            {paused ? "Resume" : "Pause"}
          </button>
          <div className="row" style={{ margin: 0, justifyContent: "flex-end" }}>
            <button
              className="start"
              type="button"
              onClick={() => void startSession()}
              disabled={busy || running}
            >
              Start session
            </button>
            <button className="stop" type="button" onClick={stopSession} disabled={!running}>
              STOP
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
