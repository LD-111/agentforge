import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BlueprintStore } from "./store";
import type { Blueprint } from "./types";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agentforge-store-"));
  tempDirs.push(dir);
  return dir;
}

const blueprint: Blueprint = {
  id: "nested-agents-architect",
  title: "Nested AGENTS.md Generator",
  version: "1.0.0",
  tags: ["setup"],
  variables: [{ name: "framework", source: "auto:framework", fallback: "TypeScript" }],
  changelog: [{ version: "1.0.0", note: "Initial baseline prompt." }],
  body: "Generate AGENTS.md files.",
  filePath: "",
};

describe("BlueprintStore", () => {
  afterEach(() => {
    tempDirs.length = 0;
  });

  it("saves and reads a blueprint as markdown with YAML frontmatter", async () => {
    const store = new BlueprintStore(await tempDir());
    await store.save(blueprint);

    const result = await store.read(blueprint.id);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blueprint.title).toBe(blueprint.title);
    expect(result.blueprint.variables[0]).toEqual(blueprint.variables[0]);
    expect(result.blueprint.changelog).toEqual(blueprint.changelog);
    expect(result.blueprint.body).toBe(blueprint.body);
    expect(result.blueprint.filePath.endsWith(`${blueprint.id}.md`)).toBe(true);
  });

  it("lists valid blueprints and reports malformed files", async () => {
    const root = await tempDir();
    const store = new BlueprintStore(root);
    await store.save(blueprint);
    await writeFile(path.join(root, "broken.md"), "---\nid: broken\n---\n", "utf8");

    const listed = await store.list();
    expect(listed.blueprints.map((item) => item.id)).toEqual([blueprint.id]);
    expect(listed.errors).toHaveLength(1);
    expect(listed.errors[0]?.message).toContain("title");
  });

  it("copies bundled blueprints only when the store has no markdown files", async () => {
    const root = await tempDir();
    const bundled = await tempDir();
    await writeFile(path.join(bundled, "nested-agents-architect.md"), "---\nid: nested-agents-architect\ntitle: Nested\nversion: 1.2.0\n---\nBody\n", "utf8");
    await writeFile(path.join(bundled, "notes.txt"), "ignore me", "utf8");

    const store = new BlueprintStore(root);
    await store.ensureStore(bundled);
    const first = await readFile(path.join(root, "nested-agents-architect.md"), "utf8");
    expect(first).toContain("title: Nested");

    await writeFile(path.join(root, "nested-agents-architect.md"), "---\nid: nested-agents-architect\ntitle: Kept\nversion: 9.0.0\n---\nEdited\n", "utf8");
    await store.ensureStore(bundled);
    const second = await readFile(path.join(root, "nested-agents-architect.md"), "utf8");
    expect(second).toContain("title: Kept");
  });

  it("inserts a new blueprint and refuses an id that already exists", async () => {
    const store = new BlueprintStore(await tempDir());
    await store.insert(blueprint);

    const result = await store.read(blueprint.id);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blueprint.title).toBe(blueprint.title);
    expect(await store.listHistory(blueprint.id)).toEqual([]);

    await expect(store.insert({ ...blueprint, title: "Other", body: "Replaced." })).rejects.toThrow(
      `A blueprint named ${blueprint.id} already exists.`,
    );
    const reread = await store.read(blueprint.id);
    expect(reread.ok).toBe(true);
    if (!reread.ok) {
      return;
    }
    expect(reread.blueprint.title).toBe(blueprint.title);
    expect(reread.blueprint.body).toBe(blueprint.body);
  });

  it("refuses to insert over a markdown file that already uses the id", async () => {
    const root = await tempDir();
    await writeFile(path.join(root, "broken.md"), "---\nid: broken\n---\n", "utf8");
    const store = new BlueprintStore(root);

    await expect(store.insert({ ...blueprint, id: "broken", title: "Broken" })).rejects.toThrow(
      "A blueprint named broken already exists.",
    );
    const raw = await readFile(path.join(root, "broken.md"), "utf8");
    expect(raw).not.toContain("title: Broken");
  });

  it("returns a structured miss when the id does not exist", async () => {
    const store = new BlueprintStore(await tempDir());
    const result = await store.read("missing-blueprint");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe("Blueprint not found: missing-blueprint");
  });

  it("archives the previous version on bump and keeps the first snapshot", async () => {
    const parent = await tempDir();
    const store = new BlueprintStore(path.join(parent, "blueprints"));
    await store.save(blueprint);
    await store.save({
      ...blueprint,
      version: "1.1.0",
      body: "Updated prompt.",
      changelog: [{ version: "1.1.0", note: "Tightened the instructions." }, ...blueprint.changelog],
    });

    const history = await store.listHistory(blueprint.id);
    expect(history.map((item) => item.version)).toEqual(["1.0.0"]);
    expect(history[0]?.body).toBe(blueprint.body);

    await store.rollback(blueprint.id, "1.0.0");
    await store.save({ ...blueprint, body: "Edited in place." });
    const reread = await store.readHistory(blueprint.id, "1.0.0");
    expect(reread.ok).toBe(true);
    if (!reread.ok) {
      return;
    }
    expect(reread.blueprint.body).toBe(blueprint.body);
  });

  it("rolls back to a snapshot and can round-trip a favorite flag", async () => {
    const parent = await tempDir();
    const store = new BlueprintStore(path.join(parent, "blueprints"));
    await store.save(blueprint);
    await store.save({ ...blueprint, version: "1.1.0", body: "Newer body." });

    const restored = await store.rollback(blueprint.id, "1.0.0");
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.blueprint.body).toBe(blueprint.body);
    expect(restored.blueprint.version).toBe("1.0.0");

    await store.save({ ...restored.blueprint, favorite: true });
    const favorite = await store.read(blueprint.id);
    expect(favorite.ok).toBe(true);
    if (!favorite.ok) {
      return;
    }
    expect(favorite.blueprint.favorite).toBe(true);
  });
});
