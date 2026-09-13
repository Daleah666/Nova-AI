"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadCharacterCard } from "@/lib/card";
import { deleteCharacter, getCharacter } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { applyMacros } from "@/lib/macros";
import type { Character } from "@/lib/types";
import { Avatar } from "./Avatar";

export function CharacterProfile({ characterId }: { characterId: string }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [character, setCharacter] = useState<Character | null | undefined>(
    undefined,
  );

  useEffect(() => {
    getCharacter(characterId).then(setCharacter);
  }, [characterId]);

  if (character === undefined) return <p className="text-fog">Loading…</p>;
  if (!character) {
    return (
      <p className="text-fog">
        Missing character. <Link href="/">Library</Link>
      </p>
    );
  }

  const names = { char: character.name, user: settings.userName };

  const current = character;

  async function onDelete() {
    if (!window.confirm(`Delete ${current.name}? This also deletes the chat.`)) {
      return;
    }
    await deleteCharacter(current.id);
    router.push("/");
  }

  return (
    <article className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-start gap-5">
        <Avatar name={character.name} src={character.avatarDataUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-brass">Profile</p>
          <h1 className="font-display mt-1 text-4xl">{character.name}</h1>
          <p className="mt-1 text-fog">{character.age} · adult companion</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {character.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-panel px-2 py-0.5 text-[11px] uppercase tracking-wide text-fog"
              >
                {tag}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/characters/${character.id}/chat`}
              className="rounded-full bg-sky px-4 py-2 text-sm font-medium text-paper"
            >
              Chat
            </Link>
            <Link
              href={`/characters/${character.id}/edit`}
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              Edit
            </Link>
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2 text-sm"
              onClick={() => downloadCharacterCard(character, settings.userName)}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm text-rose"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <Section title="Description">
        {applyMacros(character.description, names) || "—"}
      </Section>
      <Section title="Personality">
        {applyMacros(character.personality, names) || "—"}
      </Section>
      <Section title="Scenario">
        {applyMacros(character.scenario, names) || "—"}
      </Section>
      <Section title="Greeting">
        {applyMacros(character.firstMes, names) || "—"}
      </Section>
      <Section title="Example dialogues">
        <pre className="whitespace-pre-wrap font-mono text-sm text-fog">
          {character.mesExample || "—"}
        </pre>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-xs uppercase tracking-[0.18em] text-fog">{title}</h2>
      <div className="mt-2 whitespace-pre-wrap leading-relaxed">{children}</div>
    </section>
  );
}
