import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTree } from "./buildTree";
import { detectStack } from "./detectStack";
import { scanWorkspace } from "./scanWorkspace";

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agentforge-scan-"));
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, ...relativePath.split("/"));
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }
  return root;
}

describe("detectStack", () => {
  it("prefers Next.js over React and reports TypeScript dependencies", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({
        dependencies: { next: "15.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.9.0" },
      }),
      "tsconfig.json": "{}",
    });

    const stack = await detectStack(root);
    expect(stack.framework).toBe("Next.js");
    expect(stack.language).toBe("TypeScript");
    expect(stack.dependencies).toEqual(["next", "react", "typescript"]);
  });

  it("detects Express when React is absent", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ dependencies: { express: "4.21.0" } }),
    });

    const stack = await detectStack(root);
    expect(stack.framework).toBe("Express");
    expect(stack.language).toBe("JavaScript");
  });

  it("detects FastAPI from requirements.txt", async () => {
    const root = await fixture({
      "requirements.txt": "fastapi==0.115.0\nuvicorn[standard]>=0.30\n# comment\n",
    });

    const stack = await detectStack(root);
    expect(stack.framework).toBe("FastAPI");
    expect(stack.language).toBe("Python");
    expect(stack.dependencies).toEqual(["fastapi", "uvicorn"]);
  });

  it("detects a Rust crate from Cargo.toml", async () => {
    const root = await fixture({
      "Cargo.toml": "[package]\nname = \"demo\"\n\n[dependencies]\nserde = \"1\"\ntokio = { version = \"1\" }\n",
    });

    const stack = await detectStack(root);
    expect(stack.framework).toBe("Rust");
    expect(stack.language).toBe("Rust");
    expect(stack.dependencies).toEqual(["serde", "tokio"]);
  });
});

describe("buildTree", () => {
  it("limits depth and skips ignored directories", async () => {
    const root = await fixture({
      "readme.md": "hello",
      "src/app.ts": "export {}",
      "src/nested/deeper/hidden.ts": "export {}",
      "node_modules/pkg/index.js": "module.exports = {}",
      ".git/config": "",
      "dist/extension.js": "",
    });

    const tree = await buildTree(root, 2);
    const name = path.basename(root);
    expect(tree).toBe(
      [
        name,
        "├── readme.md",
        "└── src",
        "    ├── app.ts",
        "    └── nested",
      ].join("\n"),
    );
    expect(tree).not.toContain("node_modules");
    expect(tree).not.toContain("hidden.ts");
    expect(tree).not.toContain("dist");
  });
});

describe("scanWorkspace", () => {
  it("collects AGENTS.md files and .cursor/rules, skipping ignored directories", async () => {
    const longRule = `${"rule ".repeat(200)}\n`;
    const root = await fixture({
      "AGENTS.md": longRule,
      ".cursor/rules/style.md": "Use the workspace theme.",
      "src/module/AGENTS.md": "Module rules.",
      "node_modules/AGENTS.md": "Do not collect.",
      "package.json": JSON.stringify({ devDependencies: { typescript: "5.9.0" } }),
    });

    const context = await scanWorkspace(root, 2);
    expect(context.language).toBe("TypeScript");
    expect(context.existingRules.map((rule) => rule.path)).toEqual([
      ".cursor/rules/style.md",
      "AGENTS.md",
      "src/module/AGENTS.md",
    ]);
    const rootRule = context.existingRules.find((rule) => rule.path === "AGENTS.md");
    expect(rootRule?.excerpt.endsWith("…")).toBe(true);
    expect(rootRule?.excerpt.length).toBe(501);
    expect(context.folderTree).toContain("src");
    expect(context.folderTree).not.toContain("node_modules");
  });

  it("reads .cursor/rules when it is a single file", async () => {
    const root = await fixture({
      ".cursor/rules": "Prefer small diffs.",
    });

    const context = await scanWorkspace(root);
    expect(context.existingRules).toEqual([{ path: ".cursor/rules", excerpt: "Prefer small diffs." }]);
  });
});
