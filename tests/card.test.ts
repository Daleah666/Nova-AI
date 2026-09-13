import { describe, expect, it } from "vitest";
import {
  characterToV2Card,
  parseCharacterCard,
  parseCharacterCardJson,
} from "@/lib/card";
import { SEED_CHARACTER } from "@/lib/seed";

describe("character cards", () => {
  it("round-trips a v2 Chub/Tavern card", () => {
    const card = characterToV2Card(SEED_CHARACTER, "buppy");
    const parsed = parseCharacterCard(card);
    expect(parsed.source).toBe("v2");
    expect(parsed.draft.name).toBe("Mira Vale");
    expect(parsed.draft.age).toBe(32);
    expect(parsed.draft.firstMes).toContain("shop bell");
    expect(parsed.draft.tags).toContain("cartographer");
  });

  it("parses flat v1 tavern JSON", () => {
    const parsed = parseCharacterCardJson(
      JSON.stringify({
        name: "Rowan Hale",
        description: "A 29-year-old lighthouse radio operator.",
        personality: "Steady, spare with words.",
        scenario: "A night watch.",
        first_mes: "The static clears. \"Say again?\"",
        mes_example: "{{user}}: Hi\n{{char}}: Copy.",
        tags: ["lighthouse"],
        extensions: { character_companion: { age: 29 } },
      }),
    );
    expect(parsed.source).toBe("v1");
    expect(parsed.draft.name).toBe("Rowan Hale");
    expect(parsed.draft.age).toBe(29);
    expect(parsed.draft.personality).toContain("Steady");
  });

  it("throws on junk JSON", () => {
    expect(() => parseCharacterCardJson("not-json")).toThrow(/valid JSON/);
  });
});
