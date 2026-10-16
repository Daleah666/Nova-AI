"use client";

import { useParams } from "next/navigation";
import { CharacterProfile } from "@/components/CharacterProfile";

export default function CharacterPage() {
  const params = useParams<{ id: string }>();
  return <CharacterProfile characterId={params.id} />;
}
