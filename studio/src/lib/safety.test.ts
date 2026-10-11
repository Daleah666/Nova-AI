import { describe, expect, it } from "vitest";
import { acceptSafety, hasAcceptedSafety } from "./safety";

describe("safety gate storage", () => {
  it("starts unaccepted and records an explicit yes", () => {
    localStorage.clear();
    expect(hasAcceptedSafety()).toBe(false);
    acceptSafety();
    expect(hasAcceptedSafety()).toBe(true);
  });
});
