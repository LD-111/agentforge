import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildTree, IGNORE_DIRS } from "./buildTree";
import { detectStack } from "./detectStack";
import type { RuleExcerpt, WorkspaceContext } from "./types";

const EXCERPT_LIMIT = 500;
const MAX_RULE_FILES = 50;
const MAX_RULE_DEPTH = 6;

export async function scanWorkspace(rootPath: string, treeDepth = 2): Promise<WorkspaceContext> {
  const stack = await detectStack(rootPath);
  const [folderTree, existingRules] = await Promise.all([
    buildTree(rootPath, treeDepth),
    collectRules(rootPath),
  ]);

  return {
    rootPath,
    framework: stack.framework,
    language: stack.language,
    dependencies: stack.dependencies,
    folderTree,
    existingRules,
  };
}

async function collectRules(rootPath: string): Promise<RuleExcerpt[]> {
  const rules: RuleExcerpt[] = [];
  await walk(rootPath, rootPath, 0, rules);
  return rules;
}

async function walk(rootPath: string, dir: string, depth: number, rules: RuleExcerpt[]): Promise<void> {
  if (depth > MAX_RULE_DEPTH || rules.length >= MAX_RULE_FILES) {
    return;
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "EACCES") {
      return;
    }
    throw error;
  }

  const visible = entries
    .filter((entry) => !entry.isSymbolicLink())
    .sort((left, right) => compareNames(left.name, right.name));

  for (const entry of visible) {
    if (rules.length >= MAX_RULE_FILES) {
      return;
    }
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await walk(rootPath, path.join(dir, entry.name), depth + 1, rules);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(rootPath, fullPath).split(path.sep).join("/");
    if (!isRuleFile(relative)) {
      continue;
    }
    const raw = await readFile(fullPath, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "");
    rules.push({
      path: relative,
      excerpt: normalized.length > EXCERPT_LIMIT ? `${normalized.slice(0, EXCERPT_LIMIT)}…` : normalized,
    });
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

function isRuleFile(relativePath: string): boolean {
  if (path.posix.basename(relativePath) === "AGENTS.md") {
    return true;
  }
  return relativePath === ".cursor/rules" || relativePath.startsWith(".cursor/rules/");
}
