"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/hooks";
import type { AppSettings } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sky";

export function SettingsForm() {
  const { settings, setSettings, ready } = useSettings();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ready) setDraft(settings);
    // Only copy from storage on first ready — not after every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready || !draft) return <p className="text-fog">Loading settings…</p>;

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <form
      className="mx-auto grid max-w-xl gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft) return;
        const next: AppSettings = {
          ...draft,
          apiBaseUrl: draft.apiBaseUrl.trim(),
          model: draft.model.trim(),
          userName: draft.userName.trim() || "You",
        };
        setSettings(next);
        setDraft(next);
        setSaved(true);
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-brass">Settings</p>
        <h1 className="font-display mt-1 text-3xl">Your API</h1>
        <p className="mt-2 text-sm text-fog">
          Paste a key from any OpenAI-compatible provider. It stays in this
          browser only — never commit it, and this app does not read a server
          env secret.
        </p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-fog">Your name (replaces {"{{user}}"})</span>
        <input
          className={fieldClass}
          value={draft.userName}
          onChange={(event) => update("userName", event.target.value)}
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-fog">API base URL</span>
        <input
          className={fieldClass}
          value={draft.apiBaseUrl}
          onChange={(event) => update("apiBaseUrl", event.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <span className="text-xs leading-relaxed text-fog/80">
          OpenAI: <code>https://api.openai.com/v1</code>
          <br />
          OpenRouter: <code>https://openrouter.ai/api/v1</code>
          <br />
          Groq: <code>https://api.groq.com/openai/v1</code>
          <br />
          Ollama: <code>http://localhost:11434/v1</code>
        </span>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-fog">Model</span>
        <input
          className={fieldClass}
          value={draft.model}
          onChange={(event) => update("model", event.target.value)}
          placeholder="gpt-4o-mini"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-fog">API key</span>
        <input
          className={fieldClass}
          type="password"
          autoComplete="off"
          value={draft.apiKey}
          onChange={(event) => update("apiKey", event.target.value)}
          placeholder="sk-…"
        />
      </label>

      <button
        type="submit"
        className="w-fit rounded-full bg-sky px-5 py-2 font-medium text-paper"
      >
        Save settings
      </button>
      {saved && <p className="text-sm text-moss">Saved on this device.</p>}
    </form>
  );
}
