import { mkdir, readdir, readFile, copyFile, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBlueprint, serializeBlueprint } from "./parser";
import type { Blueprint, BlueprintParseError, ParseResult } from "./types";
import { isSafeVersion } from "./version";

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
    this.assertId(blueprint.id);
    if (!isSafeVersion(blueprint.version)) {
      throw new Error(`Invalid blueprint version: ${blueprint.version}`);
    }
    const existing = await this.read(blueprint.id);
    if (existing.ok && existing.blueprint.version !== blueprint.version) {
      await this.archiveSnapshot(existing.blueprint);
    }
    await this.writeCurrent(blueprint);
  }

  async listHistory(id: string): Promise<Blueprint[]> {
    this.assertId(id);
    const directory = path.join(this.historyRoot(), id);
    let files: string[];
    try {
      files = (await readdir(directory)).filter((file) => file.endsWith(".md"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const snapshots: Blueprint[] = [];
    for (const file of files) {
      const filePath = path.join(directory, file);
      const result = parseBlueprint(await readFile(filePath, "utf8"), filePath);
      if (result.ok) {
        snapshots.push(result.blueprint);
      }
    }
    return snapshots.sort((left, right) => compareVersions(right.version, left.version));
  }

  async readHistory(id: string, version: string): Promise<ParseResult> {
    this.assertId(id);
    if (!isSafeVersion(version)) {
      return { ok: false, error: { filePath: "", message: `Invalid blueprint version: ${version}` } };
    }
    const filePath = this.historyPath(id, version);
    try {
      const raw = await readFile(filePath, "utf8");
      return parseBlueprint(raw, filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ok: false, error: { filePath, message: `History not found: ${id}@${version}` } };
      }
      throw error;
    }
  }

  async rollback(id: string, version: string): Promise<ParseResult> {
    const snapshot = await this.readHistory(id, version);
    if (!snapshot.ok) {
      return snapshot;
    }
    const current = await this.read(id);
    if (current.ok) {
      await this.archiveSnapshot(current.blueprint);
    }
    await this.writeCurrent({ ...snapshot.blueprint, id });
    return this.read(id);
  }

  private historyRoot(): string {
    return path.join(path.dirname(this.rootDir), "history");
  }

  private historyPath(id: string, version: string): string {
    return path.join(this.historyRoot(), id, `${version}.md`);
  }

  private async archiveSnapshot(blueprint: Blueprint): Promise<void> {
    if (!isSafeVersion(blueprint.version)) {
      throw new Error(`Invalid blueprint version: ${blueprint.version}`);
    }
    const filePath = this.historyPath(blueprint.id, blueprint.version);
    if (await exists(filePath)) {
      return;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, serializeBlueprint({ ...blueprint, filePath }), "utf8");
  }

  private async writeCurrent(blueprint: Blueprint): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, `${blueprint.id}.md`);
    await writeFile(filePath, serializeBlueprint({ ...blueprint, filePath }), "utf8");
  }

  private assertId(id: string): void {
    if (!ID_PATTERN.test(id)) {
      throw new Error(`Invalid blueprint id: ${id}`);
    }
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0 && Number.isFinite(difference)) {
      return difference;
    }
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
