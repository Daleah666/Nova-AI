import Link from "next/link";
import type { Character } from "@/lib/types";
import { Avatar } from "./Avatar";

export function CharacterCard({ character }: { character: Character }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-start gap-3 p-4">
        <Avatar name={character.name} src={character.avatarDataUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-tight">
            <Link href={`/characters/${character.id}`} className="hover:text-sky">
              {character.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-fog">{character.age} · companion</p>
          {character.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {character.tags.slice(0, 4).map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-paper px-2 py-0.5 text-[11px] uppercase tracking-wide text-fog"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="line-clamp-3 px-4 pb-3 text-sm text-fog">
        {character.description || character.personality || "No description yet."}
      </p>
      <div className="mt-auto flex gap-2 border-t border-line px-4 py-3">
        <Link
          href={`/characters/${character.id}/chat`}
          className="rounded-full bg-sky px-3 py-1.5 text-sm font-medium text-paper hover:brightness-110"
        >
          Chat
        </Link>
        <Link
          href={`/characters/${character.id}`}
          className="rounded-full px-3 py-1.5 text-sm text-fog hover:text-ink"
        >
          Profile
        </Link>
      </div>
    </article>
  );
}
