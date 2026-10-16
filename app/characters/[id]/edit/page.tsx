"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CharacterForm } from "@/components/CharacterForm";
import { getCharacter } from "@/lib/db";
import type { Character } from "@/lib/types";

export default function EditCharacterPage() {
  const params = useParams<{ id: string }>();
  const [character, setCharacter] = useState<Character | null | undefined>(
    undefined,
  );

  useEffect(() => {
    getCharacter(params.id).then(setCharacter);
  }, [params.id]);

  if (character === undefined) return <p className="text-fog">Loading…</p>;
  if (!character) {
    return (
      <p className="text-fog">
        Character not found. <Link href="/">Library</Link>
      </p>
    );
  }

  return <CharacterForm existing={character} />;
}
