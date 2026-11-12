import type { BlueprintVariable } from "./types";
import { buildTree } from "../scanner/buildTree";
import type { RuleExcerpt, WorkspaceContext } from "../scanner/types";

const TREE_SOURCE = /^auto:tree\(depth=(\d+)\)$/;

export async function resolveVariables(
  variables: BlueprintVariable[],
  context: WorkspaceContext | null,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const variable of variables) {
    values[variable.name] = await resolveVariable(variable, context);
  }
  return values;
}

async function resolveVariable(variable: BlueprintVariable, context: WorkspaceContext | null): Promise<string> {
  const source = variable.source.trim();
  if (source === "input") {
    return variable.default ?? "";
  }
  if (source === "auto:framework") {
    return present(context?.framework) ?? variable.fallback ?? "";
  }
  if (source === "auto:dependencies") {
    const joined = context?.dependencies.join(", ") ?? "";
    return present(joined) ?? variable.fallback ?? "";
  }
  if (source === "auto:existing_rules") {
    const joined = formatRules(context?.existingRules ?? []);
    return present(joined) ?? variable.fallback ?? "";
  }

  const tree = TREE_SOURCE.exec(source);
  if (tree) {
    if (!context?.rootPath) {
      return variable.fallback ?? "";
    }
    const built = await buildTree(context.rootPath, Number(tree[1]));
    return present(built) ?? variable.fallback ?? "";
  }

  return variable.fallback ?? "";
}

function formatRules(rules: RuleExcerpt[]): string {
  return rules.map((rule) => `${rule.path}\n${rule.excerpt}`).join("\n\n");
}

function present(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}
