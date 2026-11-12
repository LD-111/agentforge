import { describe, expect, it } from "vitest";
import { isBlueprintId, slugifyTitle } from "./id";

describe("isBlueprintId", () => {
  it("accepts ids that start with a letter or number", () => {
    expect(isBlueprintId("nested-agents")).toBe(true);
    expect(isBlueprintId("A1")).toBe(true);
    expect(isBlueprintId("-nope")).toBe(false);
    expect(isBlueprintId("has space")).toBe(false);
    expect(isBlueprintId("")).toBe(false);
  });
});

describe("slugifyTitle", () => {
  it("turns a title into a blueprint id", () => {
    expect(slugifyTitle("My Prompt")).toBe("my-prompt");
    expect(slugifyTitle("  Nested AGENTS.md Generator ")).toBe("nested-agents-md-generator");
    expect(slugifyTitle("---")).toBe("");
  });
});
