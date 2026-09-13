"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToDataUrl } from "@/lib/avatar";
import { newId, saveCharacter } from "@/lib/db";
import {
  evaluateCharacterSafety,
  formatSafetyError,
} from "@/lib/safety";
import type { Character, CharacterDraft } from "@/lib/types";
import { Avatar } from "./Avatar";

const IMPORT_KEY = "cc-import-draft";

export const EMPTY_DRAFT: CharacterDraft = {
  name: "",
  age: 18,
  avatarDataUrl: null,
  tags: [],
  description: "",
  personality: "",
  scenario: "",
  firstMes: "",
  mesExample: "",
  creatorNotes: "",
};

const fieldClass =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink outline-none placeholder:text-fog/50 focus:border-sky";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-fog">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-relaxed text-fog/80">{hint}</span> : null}
    </label>
  );
}

export function CharacterForm({
  existing,
  imported,
}: {
  existing?: Character;
  imported?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterDraft>(
    existing
      ? {
          name: existing.name,
          age: existing.age,
          avatarDataUrl: existing.avatarDataUrl,
          tags: existing.tags,
          description: existing.description,
          personality: existing.personality,
          scenario: existing.scenario,
          firstMes: existing.firstMes,
          mesExample: existing.mesExample,
          creatorNotes: existing.creatorNotes,
        }
      : EMPTY_DRAFT,
  );
  const [tagInput, setTagInput] = useState(
    existing ? existing.tags.join(", ") : "",
  );
  const [confirmed, setConfirmed] = useState(Boolean(existing));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importBanner, setImportBanner] = useState(imported ?? false);

  useEffect(() => {
    if (existing) return;
    const raw = sessionStorage.getItem(IMPORT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(IMPORT_KEY);
    try {
      const parsed = JSON.parse(raw) as CharacterDraft;
      setDraft({ ...EMPTY_DRAFT, ...parsed });
      setTagInput((parsed.tags ?? []).join(", "));
      setImportBanner(true);
    } catch {
      setError("Imported card could not be read. Try the JSON file again.");
    }
  }, [existing]);

  const title = useMemo(
    () => (existing ? `Edit ${existing.name}` : "New companion"),
    [existing],
  );

  function update<K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      update("avatarDataUrl", dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that image.");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const next: CharacterDraft = {
      ...draft,
      name: draft.name.trim(),
      tags,
    };

    if (!next.name) {
      setError("Give the companion a name.");
      return;
    }
    if (!confirmed) {
      setError("Confirm this character is an adult (18+) before saving.");
      return;
    }

    const safety = evaluateCharacterSafety(next);
    if (!safety.ok) {
      setError(formatSafetyError(safety));
      return;
    }

    setBusy(true);
    const now = Date.now();
    const character: Character = existing
      ? { ...existing, ...next, updatedAt: now }
      : {
          ...next,
          id: newId(),
          createdAt: now,
          updatedAt: now,
        };

    try {
      await saveCharacter(character);
      router.push(`/characters/${character.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto grid max-w-3xl gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-brass">Character card</p>
        <h1 className="font-display mt-1 text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-fog">
          Same fields Chub / SillyTavern use: personality, scenario, first
          message, example dialogues. Default UI is SFW. Child or minor
          characters are blocked.
        </p>
      </div>

      {importBanner && (
        <p className="rounded-xl border border-brass/40 bg-panel px-4 py-3 text-sm text-brass">
          Imported a tavern/Chub JSON card. Check the fields, set age 18+, and
          save.
        </p>
      )}

      {error && (
        <pre className="whitespace-pre-wrap rounded-xl border border-rose/40 bg-panel px-4 py-3 text-sm text-rose">
          {error}
        </pre>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel p-4">
        <Avatar name={draft.name || "New"} src={draft.avatarDataUrl} size="lg" />
        <div className="grid gap-2 text-sm">
          <span className="text-fog">Avatar image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onAvatar(event.target.files?.[0])}
          />
          {draft.avatarDataUrl && (
            <button
              type="button"
              className="w-fit text-left text-fog underline"
              onClick={() => update("avatarDataUrl", null)}
            >
              Remove image
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={fieldClass}
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Age" hint="Required. Must be 18 or older.">
          <input
            className={fieldClass}
            type="number"
            min={18}
            max={120}
            step={1}
            value={draft.age}
            onChange={(event) => update("age", Number(event.target.value))}
            required
          />
        </Field>
      </div>

      <Field label="Tags" hint="Comma-separated. Example: cartographer, cozy, witty">
        <input
          className={fieldClass}
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          placeholder="cozy, tea, maps"
        />
      </Field>

      <Field label="Description / appearance">
        <textarea
          className={`${fieldClass} min-h-28`}
          value={draft.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>

      <Field label="Personality">
        <textarea
          className={`${fieldClass} min-h-28`}
          value={draft.personality}
          onChange={(event) => update("personality", event.target.value)}
        />
      </Field>

      <Field
        label="Scenario"
        hint="Use {{char}} and {{user}} if you want names filled in at chat time."
      >
        <textarea
          className={`${fieldClass} min-h-24`}
          value={draft.scenario}
          onChange={(event) => update("scenario", event.target.value)}
        />
      </Field>

      <Field label="Greeting / first message">
        <textarea
          className={`${fieldClass} min-h-28`}
          value={draft.firstMes}
          onChange={(event) => update("firstMes", event.target.value)}
        />
      </Field>

      <Field
        label="Example dialogues"
        hint="Tavern style: wrap beats with <START> and use {{user}} / {{char}}."
      >
        <textarea
          className={`${fieldClass} min-h-36 font-mono text-sm`}
          value={draft.mesExample}
          onChange={(event) => update("mesExample", event.target.value)}
          placeholder={`<START>\n{{user}}: Hello\n{{char}}: Welcome in.`}
        />
      </Field>

      <Field label="Creator notes (optional, sent to the model)">
        <textarea
          className={`${fieldClass} min-h-20`}
          value={draft.creatorNotes}
          onChange={(event) => update("creatorNotes", event.target.value)}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          I confirm this character is an adult (18+), not a child or minor, and
          not coded as underage.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-sky px-5 py-2 font-medium text-paper disabled:opacity-60"
        >
          {busy ? "Saving…" : existing ? "Save changes" : "Create companion"}
        </button>
        <button
          type="button"
          className="rounded-full px-5 py-2 text-fog"
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
