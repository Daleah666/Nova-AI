import type { Character, CharacterDraft } from "./types";
import { evaluateCharacterSafety } from "./safety";

export type TavernCardV2 = {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
};

export type ParsedCard = {
  draft: CharacterDraft;
  source: "v1" | "v2";
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readAge(extensions: unknown, fallbackFields: Record<string, unknown>): number | null {
  const ext =
    extensions && typeof extensions === "object"
      ? (extensions as Record<string, unknown>)
      : {};
  const nested =
    ext.character_companion && typeof ext.character_companion === "object"
      ? (ext.character_companion as Record<string, unknown>)
      : {};

  const candidates = [nested.age, ext.age, fallbackFields.age];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number.parseInt(value.trim(), 10);
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCharacterCard(raw: unknown): ParsedCard {
  if (!isRecord(raw)) {
    throw new Error("Character card must be a JSON object.");
  }

  if (raw.spec === "chara_card_v2" || isRecord(raw.data)) {
    const data = isRecord(raw.data) ? raw.data : raw;
    const name = asString(data.name).trim();
    if (!name) throw new Error("Card is missing data.name.");

    const age = readAge(data.extensions, data);
    const draft: CharacterDraft = {
      name,
      age: age ?? 0,
      avatarDataUrl: null,
      tags: asStringArray(data.tags),
      description: asString(data.description),
      personality: asString(data.personality),
      scenario: asString(data.scenario),
      firstMes: asString(data.first_mes),
      mesExample: asString(data.mes_example),
      creatorNotes: asString(data.creator_notes),
    };
    return { draft, source: "v2" };
  }

  const name = asString(raw.name).trim();
  if (!name) throw new Error("Card is missing name.");

  const age = readAge(raw.extensions, raw);
  const draft: CharacterDraft = {
    name,
    age: age ?? 0,
    avatarDataUrl: null,
    tags: asStringArray(raw.tags),
    description: asString(raw.description),
    personality: asString(raw.personality),
    scenario: asString(raw.scenario),
    firstMes: asString(raw.first_mes),
    mesExample: asString(raw.mes_example),
    creatorNotes: asString(raw.creatorcomment ?? raw.creator_notes),
  };
  return { draft, source: "v1" };
}

export function parseCharacterCardJson(text: string): ParsedCard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  return parseCharacterCard(raw);
}

export function characterToV2Card(
  character: Character,
  creator = "",
): TavernCardV2 {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMes,
      mes_example: character.mesExample,
      creator_notes: character.creatorNotes,
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: character.tags,
      creator,
      character_version: "1",
      extensions: {
        character_companion: { age: character.age },
      },
    },
  };
}

export function assertImportableDraft(draft: CharacterDraft): void {
  const safety = evaluateCharacterSafety(draft);
  if (!safety.ok) {
    const details = safety.reasons.join("; ");
    throw new Error(
      `Import blocked: only adult (18+) characters are allowed. ${details}`,
    );
  }
}

export function downloadCharacterCard(character: Character, creator = "") {
  const card = characterToV2Card(character, creator);
  const blob = new Blob([JSON.stringify(card, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const slug = character.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  anchor.href = url;
  anchor.download = `${slug || "character"}-card.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
