import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compilePrompt } from "./compile";
import { resolveVariables } from "./resolve";
import { BlueprintStore } from "./store";
import { scanWorkspace } from "../scanner/scanWorkspace";

describe("blueprint compile flow", () => {
  it("overrides a variable, archives a version bump, and rolls back", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "agentforge-flow-"));
    const store = new BlueprintStore(path.join(parent, "blueprints"));
    await store.ensureStore(path.join(process.cwd(), "blueprints"));
    const loaded = await store.read("nested-agents-architect");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }

    const context = await scanWorkspace(process.cwd(), 2);
    const values = await resolveVariables(loaded.blueprint.variables, context);
    const compiled = compilePrompt(loaded.blueprint.body, { ...values, strictness: "loose" });
    expect(compiled).toContain("loose");
    expect(compiled).toContain(values.framework);
    expect(compiled).not.toContain("{{strictness}}");
    expect(compiled).not.toContain("{{framework}}");

    await store.save({
      ...loaded.blueprint,
      version: "1.3.0",
      changelog: [
        { version: "1.3.0", note: "Smoke note for the version bump." },
        ...loaded.blueprint.changelog,
      ],
    });
    const history = await store.listHistory(loaded.blueprint.id);
    expect(history.map((item) => item.version)).toContain("1.2.0");
    expect(history.find((item) => item.version === "1.2.0")?.body).toBe(loaded.blueprint.body);

    const restored = await store.rollback(loaded.blueprint.id, "1.2.0");
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.blueprint.version).toBe("1.2.0");
    expect(restored.blueprint.body).toBe(loaded.blueprint.body);
  });
});
