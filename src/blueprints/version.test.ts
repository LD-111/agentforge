import { describe, expect, it } from "vitest";
import { isSafeVersion, nextPatch } from "./version";

describe("nextPatch", () => {
  it("increments the middle version segment", () => {
    expect(nextPatch("1.2.0")).toBe("1.3.0");
  });

  it("returns an empty string for a non-numeric version", () => {
    expect(nextPatch("v1")).toBe("");
  });
});

describe("isSafeVersion", () => {
  it("accepts dotted versions and rejects path characters", () => {
    expect(isSafeVersion("1.2.0")).toBe(true);
    expect(isSafeVersion("../1.2.0")).toBe(false);
    expect(isSafeVersion("")).toBe(false);
  });
});
