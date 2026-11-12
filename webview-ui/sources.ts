const NAMED_SOURCES = [
  { kind: "input", label: "Input" },
  { kind: "auto:framework", label: "Framework" },
  { kind: "auto:dependencies", label: "Dependencies" },
  { kind: "auto:existing_rules", label: "Existing rules" },
] as const;

export const SOURCE_KINDS = [
  ...NAMED_SOURCES,
  { kind: "auto:tree", label: "Folder tree" },
  { kind: "custom", label: "Custom" },
] as const;

const TREE_SOURCE = /^auto:tree\(depth=(\d+)\)$/;

export function isWorkspaceSource(source: string): boolean {
  return source.startsWith("auto:");
}

export function parseSource(source: string): { kind: string; depth: string } {
  const tree = TREE_SOURCE.exec(source);
  if (tree?.[1]) {
    return { kind: "auto:tree", depth: tree[1] };
  }
  if (NAMED_SOURCES.some((option) => option.kind === source)) {
    return { kind: source, depth: "2" };
  }
  return { kind: "custom", depth: "2" };
}

export function formatSource(kind: string, depth: string): string {
  if (kind === "auto:tree") {
    const digits = depth.replace(/\D/g, "");
    return `auto:tree(depth=${digits || "2"})`;
  }
  return kind;
}

export function sourceLabel(source: string): string {
  const parsed = parseSource(source);
  if (parsed.kind === "custom") {
    return source;
  }
  return SOURCE_KINDS.find((option) => option.kind === parsed.kind)?.label ?? source;
}
