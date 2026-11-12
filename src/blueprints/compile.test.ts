import { describe, expect, it } from "vitest";
import { compilePrompt } from "./compile";

describe("compilePrompt", () => {
  it("replaces named placeholders and leaves unknown ones", () => {
    const compiled = compilePrompt("Use {{framework}} with {{ strictness }}. Keep {{missing}}.", {
      framework: "Next.js",
      strictness: "strict",
    });
    expect(compiled).toBe("Use Next.js with strict. Keep {{missing}}.");
  });

  it("replaces a placeholder with an empty string when the value is empty", () => {
    expect(compilePrompt("Hello {{name}}.", { name: "" })).toBe("Hello .");
  });
});
