import { describe, expect, it } from "vitest";
import { resolveChatCompletionsUrl } from "@/lib/api-url";

describe("chat completions URL", () => {
  it("appends /chat/completions to an OpenAI-style base", () => {
    expect(resolveChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("does not double the path", () => {
    expect(
      resolveChatCompletionsUrl("https://api.openai.com/v1/chat/completions"),
    ).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("blocks cloud metadata hosts", () => {
    expect(() =>
      resolveChatCompletionsUrl("http://169.254.169.254/latest"),
    ).toThrow(/not allowed/);
  });

  it("rejects non-http protocols", () => {
    expect(() => resolveChatCompletionsUrl("file:///tmp/key")).toThrow(/http/);
  });
});
