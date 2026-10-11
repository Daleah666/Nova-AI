import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_ID, SCRIPT_TEMPLATES, scriptToText, templateById, textToLines } from "../data/templates";

const BANNED = [
  /\bstealth\b/i,
  /\bhidden mode\b/i,
  /\bnazi\b/i,
  /\bklan\b/i,
  /\bslur\b/i,
];

describe("script templates", () => {
  it("ships a girly default and optional bimbo set", () => {
    expect(SCRIPT_TEMPLATES.some((t) => t.id === "girly-default")).toBe(true);
    const bimbo = SCRIPT_TEMPLATES.find((t) => t.id === "soft-bimbo");
    expect(bimbo?.optional).toBe(true);
  });

  it("defaults to short Silent Ideas lines", () => {
    expect(DEFAULT_TEMPLATE_ID).toBe("silent-ideas");
    const program = templateById(DEFAULT_TEMPLATE_ID);
    expect(program.lines.length).toBeGreaterThanOrEqual(12);
    expect(program.lines.length).toBeLessThanOrEqual(18);
    const banned = /\b(not|don't|dont|stop|never)\b|\bI will\b|\bI want\b/i;
    for (const line of program.lines) {
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(line).not.toMatch(banned);
    }
    expect(textToLines(scriptToText(program.lines))).toEqual(program.lines);
  });

  it("does not include stealth or racist targeting copy", () => {
    const blob = SCRIPT_TEMPLATES.flatMap((t) => [t.name, t.blurb, ...t.lines]).join("\n");
    for (const re of BANNED) {
      expect(blob).not.toMatch(re);
    }
  });

  it("round-trips editor text and strips comments", () => {
    const text = scriptToText(["I stay girly", "I choose pink"]);
    expect(textToLines(text)).toEqual(["I stay girly", "I choose pink"]);
    expect(textToLines("# hi\n\nI stay girly\n")).toEqual(["I stay girly"]);
  });
});
