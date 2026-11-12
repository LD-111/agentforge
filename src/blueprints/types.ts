export interface BlueprintVariable {
  name: string;
  source: string;
  fallback?: string;
  default?: string;
}

export interface ChangelogEntry {
  version: string;
  note: string;
}

export interface Blueprint {
  id: string;
  title: string;
  version: string;
  tags: string[];
  favorite?: boolean;
  variables: BlueprintVariable[];
  changelog: ChangelogEntry[];
  body: string;
  filePath: string;
}

export interface BlueprintSummary {
  id: string;
  title: string;
  version: string;
  tags: string[];
}

export interface BlueprintParseError {
  filePath: string;
  message: string;
}

export type ParseResult =
  | { ok: true; blueprint: Blueprint }
  | { ok: false; error: BlueprintParseError };

export function toSummary(blueprint: Blueprint): BlueprintSummary {
  return {
    id: blueprint.id,
    title: blueprint.title,
    version: blueprint.version,
    tags: blueprint.tags,
  };
}
