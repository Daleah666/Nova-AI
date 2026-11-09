import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { VisualItem } from "../types";
import {
  ART_STILLS,
  ART_STILLS_PUBLIC_PATH,
  artStillVisuals,
  builtInVisuals,
  withLocalFolder,
} from "./hypnoVisuals";

describe("bundled art stills", () => {
  it("ships six built-in art stills ahead of hypnotic patterns", () => {
    const visuals = builtInVisuals();
    const art = artStillVisuals();

    expect(ART_STILLS).toHaveLength(6);
    expect(art).toHaveLength(6);
    expect(visuals.slice(0, 6)).toEqual(art);
    expect(art.every((item) => item.source === "built-in")).toBe(true);
    expect(new Set(visuals.map((item) => item.id)).size).toBe(visuals.length);
  });

  it("points each still at the public stills folder and keeps the file on disk", () => {
    for (const still of ART_STILLS) {
      expect(existsSync(resolve(process.cwd(), "public/stills", still.file))).toBe(true);
    }

    const srcs = artStillVisuals().map((item) => item.src);
    expect(srcs).toEqual([
      `${ART_STILLS_PUBLIC_PATH}/01-pink-alley.jpg`,
      `${ART_STILLS_PUBLIC_PATH}/02-oh-heat.png`,
      `${ART_STILLS_PUBLIC_PATH}/03-gyaru-milkshake.jpg`,
      `${ART_STILLS_PUBLIC_PATH}/04-bimbofication-sequence.png`,
      `${ART_STILLS_PUBLIC_PATH}/05-glasses-pout.png`,
      `${ART_STILLS_PUBLIC_PATH}/06-glasses-open.png`,
    ]);
  });
});

describe("local folder fallback", () => {
  it("keeps built-in stills, preserves Drive extras, and replaces the previous local set", () => {
    const builtIn: VisualItem[] = artStillVisuals();
    const drive: VisualItem = {
      id: "drive-1",
      name: "drive.jpg",
      src: "/api/drive/media/1",
      source: "drive",
    };
    const oldLocal: VisualItem = {
      id: "local-old",
      name: "old.png",
      src: "blob:old",
      source: "local",
    };
    const nextLocal: VisualItem[] = [
      { id: "local-new", name: "new.png", src: "blob:new", source: "local" },
    ];

    const merged = withLocalFolder([...builtIn, drive, oldLocal], nextLocal);

    expect(merged.filter((item) => item.source === "built-in")).toEqual(builtIn);
    expect(merged.filter((item) => item.source === "drive")).toEqual([drive]);
    expect(merged.filter((item) => item.source === "local")).toEqual(nextLocal);
    expect(merged.some((item) => item.id === "local-old")).toBe(false);
  });
});
