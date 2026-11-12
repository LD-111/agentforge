# Bundled blueprints

Seed Markdown shipped inside the extension. On first run, `BlueprintStore.ensureStore` copies these `.md` files into `~/.agentforge/blueprints` only when that directory has no `.md` files. Later edits in the sidebar write to the user directory, not here.

The shipped seed is [nested-agents-architect.md](nested-agents-architect.md).

## File shape

Each file is gray-matter Markdown accepted by `parseBlueprint`:

- Required frontmatter: `id`, `title`, `version`.
- `id` matches `isBlueprintId` (`/^[a-z0-9][a-z0-9-]*$/i`) and is the filename without `.md`.
- `version` matches `isSafeVersion`.
- `tags` is a list of strings.
- `variables` entries have `name` and `source`, plus optional `fallback` and `default`.
- `changelog` entries have `version` and `note`.
- The body uses `{{variable_name}}` placeholders.

Variable sources the resolver understands: `input`, `auto:framework`, `auto:dependencies`, `auto:existing_rules`, and `auto:tree(depth=N)`.

## Guardrails

- These files are seeds, not the live store. Do not read or write `~/.agentforge` from this directory.
- A new seed is picked up only by users whose blueprint directory is still empty. Document that in the changelog of the seed itself.
- Keep the body free of instructions that assume a specific host path inside this repo. The compiled prompt is pasted into whatever workspace the user has open.
- Changing the frontmatter shape means changing `parseBlueprint` and [src/blueprints/AGENTS.md](../src/blueprints/AGENTS.md) together.
