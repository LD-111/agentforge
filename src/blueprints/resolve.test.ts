import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveVariables } from "./resolve";
import type { BlueprintVariable } from "./types";
import type { WorkspaceContext } from "../scanner/types";

const variables: BlueprintVariable[] = [
  { name: "framework", source: "auto:framework", fallback: "TypeScript" },
  { name: "dependencies", source: "auto:dependencies", fallback: "none" },
  { name: "existing_rules", source: "auto:existing_rules", fallback: "none" },
  { name: "folder_tree", source: "auto:tree(depth=1)" },
  { name: "strictness", source: "input", default: "strict" },
  { name: "tone", source: "auto:unknown", fallback: "calm" },
];

describe("resolveVariables", () => {
  it("uses scanner values, defaults, and fallbacks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agentforge-resolve-"));
    await mkdir(path.join(root, "src", "nested"), { recursive: true });
    await writeFile(path.join(root, "src", "app.ts"), "export {}", "utf8");
    await writeFile(path.join(root, "src", "nested", "hidden.ts"), "export {}", "utf8");

    const context: WorkspaceContext = {
      rootPath: root,
      framework: "Next.js",
      language: "TypeScript",
      dependencies: ["next", "react"],
      folderTree: "",
      existingRules: [{ path: "AGENTS.md", excerpt: "Be careful" }],
    };

    const values = await resolveVariables(variables, context);
    expect(values.framework).toBe("Next.js");
    expect(values.dependencies).toBe("next, react");
    expect(values.existing_rules).toBe("AGENTS.md\nBe careful");
    expect(values.strictness).toBe("strict");
    expect(values.tone).toBe("calm");
    expect(values.folder_tree).toContain("src");
    expect(values.folder_tree).not.toContain("hidden.ts");
  });

  it("falls back when the workspace has no detected value", async () => {
    const values = await resolveVariables(variables, null);
    expect(values.framework).toBe("TypeScript");
    expect(values.dependencies).toBe("none");
    expect(values.existing_rules).toBe("none");
    expect(values.folder_tree).toBe("");
    expect(values.strictness).toBe("strict");
  });

  it("uses the dependency fallback when the dependency list is empty", async () => {
    const context: WorkspaceContext = {
      rootPath: "",
      framework: "",
      language: "Unknown",
      dependencies: [],
      folderTree: "",
      existingRules: [],
    };
    const values = await resolveVariables(
      [{ name: "dependencies", source: "auto:dependencies", fallback: "none" }],
      context,
    );
    expect(values.dependencies).toBe("none");
  });
});
