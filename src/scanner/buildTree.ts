import { readdir } from "node:fs/promises";
import path from "node:path";

export const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  "coverage",
  "__pycache__",
  "target",
  ".venv",
  "venv",
]);

export async function buildTree(rootPath: string, depth = 2): Promise<string> {
  const lines = [path.basename(rootPath) || rootPath];
  await appendChildren(rootPath, depth, "", lines);
  return lines.join("\n");
}

async function appendChildren(dir: string, depth: number, prefix: string, lines: string[]): Promise<void> {
  if (depth <= 0) {
    return;
  }

  const entries = await readVisible(dir);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }
    const last = index === entries.length - 1;
    lines.push(`${prefix}${last ? "└── " : "├── "}${entry.name}`);
    if (entry.isDirectory()) {
      await appendChildren(path.join(dir, entry.name), depth - 1, `${prefix}${last ? "    " : "│   "}`, lines);
    }
  }
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

async function readVisible(dir: string): Promise<{ name: string; isDirectory: () => boolean }[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => !IGNORE_DIRS.has(entry.name) && !entry.isSymbolicLink())
      .sort((left, right) => compareNames(left.name, right.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "EACCES") {
      return [];
    }
    throw error;
  }
}
