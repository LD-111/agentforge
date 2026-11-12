import matter from "gray-matter";
import type { Blueprint, BlueprintVariable, ChangelogEntry, ParseResult } from "./types";

const REQUIRED_FIELDS = ["id", "title", "version"] as const;

export function parseBlueprint(raw: string, filePath: string): ParseResult {
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(raw);
  } catch (error) {
    return {
      ok: false,
      error: {
        filePath,
        message: error instanceof Error ? error.message : "Invalid YAML frontmatter",
      },
    };
  }

  const data = isRecord(parsed.data) ? parsed.data : {};
  const missing = REQUIRED_FIELDS.filter((field) => !asNonEmptyString(data[field]));
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        filePath,
        message: `Missing required frontmatter: ${missing.join(", ")}`,
      },
    };
  }

  const variables = readVariables(data.variables, filePath);
  if (!variables.ok) {
    return variables;
  }

  const changelog = readChangelog(data.changelog, filePath);
  if (!changelog.ok) {
    return changelog;
  }

  return {
    ok: true,
    blueprint: {
      id: asNonEmptyString(data.id) as string,
      title: asNonEmptyString(data.title) as string,
      version: asNonEmptyString(data.version) as string,
      tags: readTags(data.tags),
      variables: variables.value,
      changelog: changelog.value,
      body: parsed.content.trim(),
      filePath,
    },
  };
}

export function serializeBlueprint(blueprint: Blueprint): string {
  const content = blueprint.body.endsWith("\n") ? blueprint.body : `${blueprint.body}\n`;
  return matter.stringify(content, {
    id: blueprint.id,
    title: blueprint.title,
    version: blueprint.version,
    tags: blueprint.tags,
    variables: blueprint.variables,
    changelog: blueprint.changelog,
  });
}

function readTags(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readVariables(
  value: unknown,
  filePath: string,
): { ok: true; value: BlueprintVariable[] } | { ok: false; error: { filePath: string; message: string } } {
  if (value === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: { filePath, message: "variables must be a list" } };
  }

  const variables: BlueprintVariable[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      return { ok: false, error: { filePath, message: `Variable at index ${index} is missing name or source` } };
    }
    const name = asNonEmptyString(item.name);
    const source = asNonEmptyString(item.source);
    if (!name || !source) {
      return { ok: false, error: { filePath, message: `Variable at index ${index} is missing name or source` } };
    }
    const variable: BlueprintVariable = { name, source };
    const fallback = asOptionalString(item.fallback);
    const defaultValue = asOptionalString(item.default);
    if (fallback !== undefined) {
      variable.fallback = fallback;
    }
    if (defaultValue !== undefined) {
      variable.default = defaultValue;
    }
    variables.push(variable);
  }
  return { ok: true, value: variables };
}

function readChangelog(
  value: unknown,
  filePath: string,
): { ok: true; value: ChangelogEntry[] } | { ok: false; error: { filePath: string; message: string } } {
  if (value === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: { filePath, message: "changelog must be a list" } };
  }

  const changelog: ChangelogEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      return { ok: false, error: { filePath, message: `Changelog entry at index ${index} is missing version or note` } };
    }
    const version = asNonEmptyString(item.version);
    const note = asOptionalString(item.note);
    if (!version || note === undefined) {
      return { ok: false, error: { filePath, message: `Changelog entry at index ${index} is missing version or note` } };
    }
    changelog.push({ version, note });
  }
  return { ok: true, value: changelog };
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return asNonEmptyString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
