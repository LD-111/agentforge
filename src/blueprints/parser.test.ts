import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBlueprint, serializeBlueprint } from "./parser";
import type { Blueprint } from "./types";

const sample: Blueprint = {
  id: "nested-agents-architect",
  title: "Nested AGENTS.md Generator",
  version: "1.2.0",
  tags: ["architecture", "guardrails", "setup"],
  variables: [
    { name: "framework", source: "auto:framework", fallback: "TypeScript" },
    { name: "folder_tree", source: "auto:tree(depth=2)" },
    { name: "strictness", source: "input", default: "strict" },
  ],
  changelog: [
    {
      version: "1.2.0",
      note: "Added rule requiring agent to update AGENTS.md after structural refactors.",
    },
    { version: "1.0.0", note: "Initial baseline prompt." },
  ],
  body: "You are a Senior Software Architect.",
  filePath: "nested-agents-architect.md",
};

describe("parseBlueprint", () => {
  it("round-trips frontmatter, variables, and changelog", () => {
    const raw = serializeBlueprint(sample);
    const result = parseBlueprint(raw, sample.filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blueprint).toEqual({ ...sample, body: sample.body.trim() });
  });

  it("parses the bundled nested-agents blueprint", async () => {
    const filePath = path.join(process.cwd(), "blueprints", "nested-agents-architect.md");
    const raw = await readFile(filePath, "utf8");
    const result = parseBlueprint(raw, filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blueprint.id).toBe("nested-agents-architect");
    expect(result.blueprint.version).toBe("1.2.0");
    expect(result.blueprint.variables.map((variable) => variable.source)).toEqual([
      "auto:framework",
      "auto:tree(depth=2)",
      "input",
    ]);
    expect(result.blueprint.changelog).toHaveLength(2);
    expect(result.blueprint.body).toContain("{{framework}}");
  });

  it("returns a structured error when required frontmatter is missing", () => {
    const result = parseBlueprint("---\nid: only-id\n---\nBody\n", "broken.md");
    expect(result).toEqual({
      ok: false,
      error: {
        filePath: "broken.md",
        message: "Missing required frontmatter: title, version",
      },
    });
  });

  it("ignores unknown frontmatter keys", () => {
    const result = parseBlueprint(
      "---\nid: extra\ntitle: Extra\nversion: 1\nauthor: Lorenzo\n---\nHello\n",
      "extra.md",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blueprint).toMatchObject({
      id: "extra",
      title: "Extra",
      version: "1",
      tags: [],
      variables: [],
      changelog: [],
      body: "Hello",
    });
    expect(result.blueprint).not.toHaveProperty("author");
  });

  it("round-trips a favorite flag and omits it when unset", () => {
    const favorite = serializeBlueprint({ ...sample, favorite: true });
    const parsed = parseBlueprint(favorite, sample.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.blueprint.favorite).toBe(true);

    const plain = parseBlueprint(serializeBlueprint(sample), sample.filePath);
    expect(plain.ok).toBe(true);
    if (!plain.ok) {
      return;
    }
    expect(plain.blueprint).not.toHaveProperty("favorite");
  });

  it("returns a structured error for invalid YAML", () => {
    const result = parseBlueprint("---\nid: [unterminated\n---\n", "bad.md");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.filePath).toBe("bad.md");
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});
