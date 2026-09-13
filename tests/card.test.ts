import { describe, expect, it } from "vitest";
import {
  characterToV2Card,
  parseCharacterCard,
  parseCharacterCardJson,
} from "@/lib/card";
import { MICAELA_WRENHART, MICAH_WRENHART, SEED_CHARACTER } from "@/lib/seed";

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

  it("exports Micah Wrenhart with adult age on the companion extension", () => {
    const card = characterToV2Card(MICAH_WRENHART);
    const parsed = parseCharacterCard(card);
    expect(parsed.draft.name).toBe("Micah Wrenhart");
    expect(parsed.draft.age).toBe(24);
    expect(parsed.draft.tags).toContain("wrenhart");
    expect(parsed.draft.firstMes).toContain("questionable armor");
  });

  it("exports Micaela Wrenhart as an adult woman counterpart", () => {
    const card = characterToV2Card(MICAELA_WRENHART);
    const parsed = parseCharacterCard(card);
    expect(parsed.draft.name).toBe("Micaela Wrenhart");
    expect(parsed.draft.age).toBe(24);
    expect(parsed.draft.tags).toContain("micaela");
    expect(parsed.draft.tags).not.toContain("femboy");
    expect(parsed.draft.firstMes).toContain("brave wife");
  });

  it("throws on junk JSON", () => {
    expect(() => parseCharacterCardJson("not-json")).toThrow(/valid JSON/);
  });
});
