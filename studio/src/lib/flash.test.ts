import { describe, expect, it } from "vitest";
import { clampHz, clampIntervalMs, DEFAULT_HZ, HARD_MAX_HZ, hzToIntervalMs } from "./flash";

describe("flash rate cap", () => {
  it("defaults to a slow 0.5 Hz", () => {
    expect(DEFAULT_HZ).toBe(0.5);
    expect(hzToIntervalMs(DEFAULT_HZ)).toBe(2000);
  });

  it("never allows faster than 3 Hz", () => {
    expect(clampHz(60)).toBe(HARD_MAX_HZ);
    expect(clampIntervalMs(1)).toBe(Math.round(1000 / HARD_MAX_HZ));
    expect(hzToIntervalMs(999)).toBe(Math.round(1000 / HARD_MAX_HZ));
  });

  it("rejects non-finite values", () => {
    expect(clampHz(Number.NaN)).toBe(DEFAULT_HZ);
    expect(clampIntervalMs(Number.POSITIVE_INFINITY)).toBe(hzToIntervalMs(DEFAULT_HZ));
  });
});
