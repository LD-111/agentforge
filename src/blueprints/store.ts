import { mkdir, readdir, readFile, copyFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBlueprint, serializeBlueprint } from "./parser";
import type { Blueprint, BlueprintParseError, ParseResult } from "./types";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

export function defaultBlueprintDir(): string {
  return path.join(os.homedir(), ".agentforge", "blueprints");
}

export class BlueprintStore {
  constructor(private readonly rootDir: string = defaultBlueprintDir()) {}

  async ensureStore(bundledDir?: string): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    if (!bundledDir) {
      return;
    }

    const existing = (await readdir(this.rootDir)).filter((file) => file.endsWith(".md"));
    if (existing.length > 0) {
      return;
    }

    let bundled: string[];
    try {
      bundled = await readdir(bundledDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const file of bundled) {
      if (!file.endsWith(".md")) {
        continue;
      }
      await copyFile(path.join(bundledDir, file), path.join(this.rootDir, file));
    }
  }

  async list(): Promise<{ blueprints: Blueprint[]; errors: BlueprintParseError[] }> {
    await mkdir(this.rootDir, { recursive: true });
    const files = (await readdir(this.rootDir)).filter((file) => file.endsWith(".md")).sort();
    const blueprints: Blueprint[] = [];
    const errors: BlueprintParseError[] = [];

    for (const file of files) {
      const filePath = path.join(this.rootDir, file);
      const raw = await readFile(filePath, "utf8");
      const result = parseBlueprint(raw, filePath);
      if (result.ok) {
        blueprints.push(result.blueprint);
      } else {
        errors.push(result.error);
      }
    }

    blueprints.sort((left, right) => left.title.localeCompare(right.title));
    return { blueprints, errors };
  }

  async read(id: string): Promise<ParseResult> {
    const { blueprints, errors } = await this.list();
    const found = blueprints.find((blueprint) => blueprint.id === id);
    if (found) {
      return { ok: true, blueprint: found };
    }

    const filePath = path.join(this.rootDir, `${id}.md`);
    const error = errors.find((entry) => entry.filePath === filePath);
    if (error) {
      return { ok: false, error };
    }

    return {
      ok: false,
      error: { filePath, message: `Blueprint not found: ${id}` },
    };
  }

  async save(blueprint: Blueprint): Promise<void> {
    if (!ID_PATTERN.test(blueprint.id)) {
      throw new Error(`Invalid blueprint id: ${blueprint.id}`);
    }
    await mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, `${blueprint.id}.md`);
    await writeFile(filePath, serializeBlueprint({ ...blueprint, filePath }), "utf8");
  }
}
