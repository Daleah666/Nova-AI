import { describe, expect, it } from "vitest";
import { extractFolderId } from "./drive";

describe("extractFolderId", () => {
  it("accepts a raw ID", () => {
    expect(extractFolderId("  abc123_X  ")).toBe("abc123_X");
  });

  it("pulls the ID from a Drive folder URL", () => {
    expect(
      extractFolderId("https://drive.google.com/drive/folders/1AbCDef-ghi?usp=sharing"),
    ).toBe("1AbCDef-ghi");
  });
});
