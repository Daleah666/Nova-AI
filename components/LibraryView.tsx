"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseCharacterCardJson } from "@/lib/card";
import { listCharacters } from "@/lib/db";
import { evaluateTextPolicy, formatSafetyError } from "@/lib/safety";
import type { Character } from "@/lib/types";
import { CharacterCard } from "./CharacterCard";

const IMPORT_KEY = "cc-import-draft";

export function LibraryView() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listCharacters()
      .then(setCharacters)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load library.");
        setCharacters([]);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((character) => {
      const hay = [
        character.name,
        character.description,
        character.personality,
        ...character.tags,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [characters, query]);

  async function onImport(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      const { draft } = parseCharacterCardJson(text);
      if (draft.age && draft.age < 18) {
        setError(
          "Import blocked: this card’s age is under 18. Only adult companions are allowed.",
        );
        return;
      }
      const textPolicy = evaluateTextPolicy(draft);
      if (!textPolicy.ok) {
        setError(formatSafetyError(textPolicy));
        return;
      }
      sessionStorage.setItem(IMPORT_KEY, JSON.stringify(draft));
      router.push("/characters/new?import=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brass">Library</p>
          <h1 className="font-display mt-1 text-4xl">Companions</h1>
          <p className="mt-2 max-w-xl text-fog">
            Browse your bots, import a Chub / Tavern v2 JSON card, or make a new
            adult character and chat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm hover:border-sky">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                onImport(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <Link
            href="/characters/new"
            className="rounded-full bg-sky px-4 py-2 text-sm font-medium text-paper"
          >
            Create character
          </Link>
        </div>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search names, tags, personality…"
        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none placeholder:text-fog/60 focus:border-sky"
      />

      {error && (
        <pre className="whitespace-pre-wrap rounded-xl border border-rose/40 bg-panel px-4 py-3 text-sm text-rose">
          {error}
        </pre>
      )}

      {characters === null ? (
        <p className="text-fog">Opening your local library…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel px-6 py-12 text-center">
          <p className="font-display text-2xl">No companions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-fog">
            Create one, or import a <code className="text-brass">.json</code>{" "}
            character card. There is a sample card in{" "}
            <code className="text-brass">examples/</code> in the repo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </div>
  );
}
