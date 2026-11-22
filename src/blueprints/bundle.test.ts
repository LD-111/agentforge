import { describe, expect, it } from "vitest";
import { classifyImports, parseBundle, sameBlueprint, serializeBundle, suggestImportId, type BundleBlueprint } from "./bundle";
import type { Blueprint } from "./types";

const review: BundleBlueprint = {
  id: "review",
  title: "Review",
  version: "1.0.0",
  tags: ["qa"],
  variables: [{ name: "focus", source: "input", default: "bugs" }],
  changelog: [{ version: "1.0.0", note: "Start" }],
  body: "Look carefully.",
};

describe("blueprint bundles", () => {
  it("round-trips blueprints and drops favorite and file path", () => {
    const stored: Blueprint = { ...review, favorite: true, filePath: "/tmp/review.md" };
    const raw = serializeBundle([stored]);
    expect(raw).not.toContain("favorite");
    expect(raw).not.toContain("filePath");

    const parsed = parseBundle(raw);
    expect(parsed).toEqual({ ok: true, blueprints: [review] });
  });

  it("rejects a file that is not a blueprint set", () => {
    expect(parseBundle("{")).toEqual({ ok: false, message: "The share file is not valid JSON." });
    expect(parseBundle(JSON.stringify({ format: "other", version: 1, blueprints: [] }))).toEqual({
      ok: false,
      message: "This file is not an AgentForge blueprint set.",
    });
    expect(parseBundle(JSON.stringify({ format: "agentforge-blueprints", version: 2, blueprints: [] }))).toEqual({
      ok: false,
      message: "This blueprint set uses an unsupported format version.",
    });
  });

  it("rejects duplicate ids and invalid blueprint fields", () => {
    expect(parseBundle(bundle([review, review])).ok).toBe(false);
    if (parseBundle(bundle([review, review])).ok) {
      return;
    }
    expect(parseBundle(bundle([review, review]))).toMatchObject({ message: "Duplicate blueprint id: review." });

    expect(parseBundle(bundle([{ ...review, id: "Bad_Id" }]))).toMatchObject({
      message: "Blueprint at index 0 has an invalid id.",
    });
    expect(parseBundle(bundle([{ ...review, version: "1 0" }]))).toMatchObject({
      message: "Blueprint review has an invalid version.",
    });
    expect(parseBundle(bundle([{ ...review, variables: [{ name: "bad name", source: "input" }] }]))).toMatchObject({
      message: "Blueprint review has an invalid variable name: bad name.",
    });
    expect(
      parseBundle(
        bundle([
          {
            ...review,
            variables: [
              { name: "focus", source: "input" },
              { name: "focus", source: "input" },
            ],
          },
        ]),
      ),
    ).toMatchObject({ message: "Blueprint review has a duplicate variable name: focus." });
    expect(parseBundle(bundle([{ ...review, variables: [{ name: "focus", source: " " }] }]))).toMatchObject({
      message: "Blueprint review is missing a source for focus.",
    });
  });

  it("treats favorite and path as irrelevant to an exact copy", () => {
    const stored: Blueprint = { ...review, favorite: true, filePath: "/tmp/review.md" };
    expect(sameBlueprint(review, stored)).toBe(true);
    expect(sameBlueprint(review, { ...review, body: "Look again." })).toBe(false);
  });

  it("suggests the next free suffixed id", () => {
    expect(suggestImportId("review", new Set(["review-2", "review-4"]))).toBe("review-3");
    expect(suggestImportId("review", new Set(["review-2", "review-3"]))).toBe("review-4");
  });

  it("classifies new, duplicate, and conflicting rows without shared suggestions", () => {
    const notes: BundleBlueprint = { ...review, id: "notes", title: "Notes" };
    const incoming: BundleBlueprint[] = [
      review,
      { ...review, body: "Look again." },
      { ...review, id: "review-2", title: "Review copy" },
      { ...review, id: "fresh", title: "Fresh" },
    ];

    expect(classifyImports(incoming, [review, notes])).toEqual([
      { id: "review", title: "Review", version: "1.0.0", tags: ["qa"], status: "duplicate", suggestedId: "review" },
      { id: "review", title: "Review", version: "1.0.0", tags: ["qa"], status: "conflict", suggestedId: "review-3" },
      { id: "review-2", title: "Review copy", version: "1.0.0", tags: ["qa"], status: "new", suggestedId: "review-2" },
      { id: "fresh", title: "Fresh", version: "1.0.0", tags: ["qa"], status: "new", suggestedId: "fresh" },
    ]);
  });
});

function bundle(blueprints: unknown[]): string {
  return JSON.stringify({ format: "agentforge-blueprints", version: 1, blueprints });
}
