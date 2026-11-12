import { readFile } from "node:fs/promises";
import path from "node:path";

export interface StackInfo {
  framework: string;
  language: string;
  dependencies: string[];
}

const JS_FRAMEWORKS: { dep: string; framework: string }[] = [
  { dep: "next", framework: "Next.js" },
  { dep: "@angular/core", framework: "Angular" },
  { dep: "vue", framework: "Vue" },
  { dep: "svelte", framework: "Svelte" },
  { dep: "react", framework: "React" },
  { dep: "@nestjs/core", framework: "NestJS" },
  { dep: "fastify", framework: "Fastify" },
  { dep: "express", framework: "Express" },
];

const PYTHON_FRAMEWORKS: { dep: string; framework: string }[] = [
  { dep: "django", framework: "Django" },
  { dep: "flask", framework: "Flask" },
  { dep: "fastapi", framework: "FastAPI" },
];

export async function detectStack(rootPath: string): Promise<StackInfo> {
  const packageJson = await readOptional(path.join(rootPath, "package.json"));
  const requirements = await readOptional(path.join(rootPath, "requirements.txt"));
  const cargo = await readOptional(path.join(rootPath, "Cargo.toml"));
  const tsconfig = await readOptional(path.join(rootPath, "tsconfig.json"));

  const packageDeps = packageJson ? dependencyNames(parsePackageJson(packageJson)) : [];
  const pythonDeps = requirements ? parseRequirements(requirements) : [];
  const rustDeps = cargo ? parseCargoDeps(cargo) : [];
  const dependencies = unique([...packageDeps, ...pythonDeps, ...rustDeps]);

  const jsFramework = matchFramework(packageDeps, JS_FRAMEWORKS);
  const pythonFramework = matchFramework(pythonDeps, PYTHON_FRAMEWORKS);
  const framework = jsFramework ?? pythonFramework ?? (cargo !== undefined ? "Rust" : "Unknown");

  let language = "Unknown";
  if (packageJson !== undefined || tsconfig !== undefined) {
    const hasTypeScript = packageDeps.includes("typescript") || tsconfig !== undefined;
    language = hasTypeScript ? "TypeScript" : "JavaScript";
  } else if (requirements !== undefined) {
    language = "Python";
  } else if (cargo !== undefined) {
    language = "Rust";
  }

  dependencies.sort(compareNames);
  return { framework, language, dependencies };
}

function matchFramework(deps: string[], table: { dep: string; framework: string }[]): string | undefined {
  const present = new Set(deps);
  return table.find((entry) => present.has(entry.dep))?.framework;
}

function dependencyNames(manifest: { dependencies?: unknown; devDependencies?: unknown }): string[] {
  return unique([...objectKeys(manifest.dependencies), ...objectKeys(manifest.devDependencies)]);
}

function objectKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value);
}

function parsePackageJson(raw: string): { dependencies?: unknown; devDependencies?: unknown } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as { dependencies?: unknown; devDependencies?: unknown };
  } catch {
    return {};
  }
}

function parseRequirements(raw: string): string[] {
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
      continue;
    }
    const name = trimmed.split(/[<=>~!;\s[]/)[0]?.trim().toLowerCase();
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function parseCargoDeps(raw: string): string[] {
  const names: string[] = [];
  let inDependencies = false;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inDependencies = trimmed === "[dependencies]" || trimmed === "[dev-dependencies]";
      continue;
    }
    if (!inDependencies || !trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*=/.exec(trimmed);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }
  return names;
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
