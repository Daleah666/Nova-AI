import { describe, expect, it } from "vitest";
import { evaluateCharacterSafety, evaluateTextPolicy } from "@/lib/safety";
import { SEED_CHARACTER, SEED_CHARACTERS } from "@/lib/seed";

describe("adult character policy", () => {
  it("allows every seeded adult companion", () => {
    for (const character of SEED_CHARACTERS) {
      const result = evaluateCharacterSafety(character);
      expect(result, character.name).toEqual({ ok: true });
    }
  });

  it("rejects ages under 18", () => {
    const result = evaluateCharacterSafety({
      ...SEED_CHARACTER,
      age: 16,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects 16-year-old wording even if the age field is 18", () => {
    const result = evaluateTextPolicy({
      name: "Test",
      description: "A 16-year-old prodigy cartographer.",
    });
    expect(result.ok).toBe(false);
  });

  it("does not treat kidney as kid", () => {
    const result = evaluateTextPolicy({
      name: "Renal",
      description: "Knows a lot about kidney stones from a clinic job.",
      personality: "Dry humor.",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects loli / child-coded tags", () => {
    const result = evaluateTextPolicy({
      name: "Nope",
      tags: ["loli"],
      description: "An adult librarian.",
    });
    expect(result.ok).toBe(false);
  });
});
