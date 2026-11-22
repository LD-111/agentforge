import { isBlueprintId } from "./id";
import type { BlueprintVariable, ChangelogEntry } from "./types";
import { isSafeVersion } from "./version";

export const BUNDLE_FORMAT = "agentforge-blueprints";
export const BUNDLE_VERSION = 1;

export interface BundleBlueprint {
  id: string;
  title: string;
  version: string;
  tags: string[];
  variables: BlueprintVariable[];
  changelog: ChangelogEntry[];
  body: string;
}

export type BundleParseResult = { ok: true; blueprints: BundleBlueprint[] } | { ok: false; message: string };

export type ImportStatus = "new" | "duplicate" | "conflict";

export interface ClassifiedImport {
  id: string;
  title: string;
  version: string;
  tags: string[];
  status: ImportStatus;
  suggestedId: string;
}

export function serializeBundle(blueprints: readonly BundleBlueprint[]): string {
  return `${JSON.stringify(
    {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      blueprints: blueprints.map(toBundleBlueprint),
    },
    null,
    2,
  )}\n`;
}

export function parseBundle(raw: string): BundleParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: "The share file is not valid JSON." };
  }
  if (!isRecord(value) || value.format !== BUNDLE_FORMAT) {
    return { ok: false, message: "This file is not an AgentForge blueprint set." };
  }
  if (value.version !== BUNDLE_VERSION) {
    return { ok: false, message: "This blueprint set uses an unsupported format version." };
  }
  if (!Array.isArray(value.blueprints)) {
    return { ok: false, message: "This blueprint set has no blueprint list." };
  }

  const blueprints: BundleBlueprint[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.blueprints.length; index += 1) {
    const read = readBlueprint(value.blueprints[index], index);
    if (typeof read === "string") {
      return { ok: false, message: read };
    }
    if (seen.has(read.id)) {
      return { ok: false, message: `Duplicate blueprint id: ${read.id}.` };
    }
    seen.add(read.id);
    blueprints.push(read);
  }
  return { ok: true, blueprints };
}

export function sameBlueprint(left: BundleBlueprint, right: BundleBlueprint): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.version === right.version &&
    left.body === right.body &&
    sameStrings(left.tags, right.tags) &&
    sameVariables(left.variables, right.variables) &&
    sameChangelog(left.changelog, right.changelog)
  );
}

export function suggestImportId(id: string, taken: ReadonlySet<string>): string {
  let suffix = 2;
  let candidate = `${id}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${id}-${suffix}`;
  }
  return candidate;
}

export function classifyImports(incoming: readonly BundleBlueprint[], existing: readonly BundleBlueprint[]): ClassifiedImport[] {
  const byId = new Map(existing.map((blueprint) => [blueprint.id, blueprint]));
  const taken = new Set<string>([...existing.map((blueprint) => blueprint.id), ...incoming.map((blueprint) => blueprint.id)]);
  const classified: ClassifiedImport[] = [];

  for (const blueprint of incoming) {
    const current = byId.get(blueprint.id);
    let status: ImportStatus;
    let suggestedId: string;
    if (current && sameBlueprint(blueprint, current)) {
      status = "duplicate";
      suggestedId = blueprint.id;
    } else if (current) {
      status = "conflict";
      suggestedId = suggestImportId(blueprint.id, taken);
      taken.add(suggestedId);
    } else {
      status = "new";
      suggestedId = blueprint.id;
    }
    classified.push({
      id: blueprint.id,
      title: blueprint.title,
      version: blueprint.version,
      tags: [...blueprint.tags],
      status,
      suggestedId,
    });
  }
  return classified;
}

function toBundleBlueprint(blueprint: BundleBlueprint): BundleBlueprint {
  return {
    id: blueprint.id,
    title: blueprint.title,
    version: blueprint.version,
    tags: [...blueprint.tags],
    variables: blueprint.variables.map((variable) => ({ ...variable })),
    changelog: blueprint.changelog.map((entry) => ({ ...entry })),
    body: blueprint.body,
  };
}

function readBlueprint(value: unknown, index: number): BundleBlueprint | string {
  if (!isRecord(value)) {
    return `Blueprint at index ${index} is not an object.`;
  }
  const id = asString(value.id);
  if (!id || !isBlueprintId(id)) {
    return `Blueprint at index ${index} has an invalid id.`;
  }
  const title = asString(value.title);
  if (!title) {
    return `Blueprint ${id} is missing a title.`;
  }
  const version = asString(value.version);
  if (!version || !isSafeVersion(version)) {
    return `Blueprint ${id} has an invalid version.`;
  }
  if (typeof value.body !== "string") {
    return `Blueprint ${id} is missing a body.`;
  }
  const tags = readTags(value.tags, id);
  if (typeof tags === "string") {
    return tags;
  }
  const variables = readVariables(value.variables, id);
  if (typeof variables === "string") {
    return variables;
  }
  const changelog = readChangelog(value.changelog, id);
  if (typeof changelog === "string") {
    return changelog;
  }
  return { id, title, version, tags, variables, changelog, body: value.body };
}

function readTags(value: unknown, id: string): string[] | string {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `Blueprint ${id} has invalid tags.`;
  }
  const tags: string[] = [];
  for (const item of value) {
    const tag = asString(item);
    if (!tag) {
      return `Blueprint ${id} has invalid tags.`;
    }
    tags.push(tag);
  }
  return tags;
}

function readVariables(value: unknown, id: string): BlueprintVariable[] | string {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `Blueprint ${id} has an invalid variable list.`;
  }
  const variables: BlueprintVariable[] = [];
  const names = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      return `Blueprint ${id} has an invalid variable name: (empty).`;
    }
    const name = asString(item.name);
    if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
      return `Blueprint ${id} has an invalid variable name: ${name || "(empty)"}.`;
    }
    if (names.has(name)) {
      return `Blueprint ${id} has a duplicate variable name: ${name}.`;
    }
    names.add(name);
    const source = asString(item.source);
    if (!source) {
      return `Blueprint ${id} is missing a source for ${name}.`;
    }
    const variable: BlueprintVariable = { name, source };
    if (item.fallback !== undefined) {
      const fallback = asString(item.fallback);
      if (!fallback) {
        return `Blueprint ${id} has an invalid fallback for ${name}.`;
      }
      variable.fallback = fallback;
    }
    if (item.default !== undefined) {
      const defaultValue = asString(item.default);
      if (!defaultValue) {
        return `Blueprint ${id} has an invalid default for ${name}.`;
      }
      variable.default = defaultValue;
    }
    variables.push(variable);
  }
  return variables;
}

function readChangelog(value: unknown, id: string): ChangelogEntry[] | string {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `Blueprint ${id} has an invalid changelog.`;
  }
  const changelog: ChangelogEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      return `Blueprint ${id} has an invalid changelog entry at index ${index}.`;
    }
    const version = asString(item.version);
    const note = asString(item.note);
    if (!version || note === undefined) {
      return `Blueprint ${id} has an invalid changelog entry at index ${index}.`;
    }
    changelog.push({ version, note });
  }
  return changelog;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameVariables(left: readonly BlueprintVariable[], right: readonly BlueprintVariable[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        item.name === other.name &&
        item.source === other.source &&
        item.fallback === other.fallback &&
        item.default === other.default
      );
    })
  );
}

function sameChangelog(left: readonly ChangelogEntry[], right: readonly ChangelogEntry[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return other !== undefined && item.version === other.version && item.note === other.note;
    })
  );
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
