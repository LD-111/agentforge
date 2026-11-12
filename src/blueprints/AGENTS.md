# Blueprints

Pure domain for versioned prompt Markdown. No `vscode` imports.

## Public surface

- [types.ts](types.ts) — `Blueprint`, `BlueprintVariable`, `ChangelogEntry`, `ParseResult`. `toSummary` drops body, variables, changelog, and `filePath`.
- [parser.ts](parser.ts) — `parseBlueprint` and `serializeBlueprint` via gray-matter.
- [compile.ts](compile.ts) — `compilePrompt` replaces `{{name}}` placeholders.
- [resolve.ts](resolve.ts) — `resolveVariables` fills values from workspace context.
- [id.ts](id.ts) — `isBlueprintId`, `slugifyTitle`.
- [version.ts](version.ts) — `isSafeVersion`, `nextPatch`.
- [store.ts](store.ts) — `BlueprintStore` and `defaultBlueprintDir`.

## On-disk contract

Current files are `<id>.md` under `~/.agentforge/blueprints` (or the store root passed to the constructor). History is `~/.agentforge/history/<id>/<version>.md`, beside the blueprints directory.

Required frontmatter: `id`, `title`, `version`. Optional: `tags` (string or string array), `variables`, `changelog`, and `favorite`. `favorite: true` is the only stored favorite state; serialize omits it otherwise. The body is the Markdown after the frontmatter, trimmed on parse.

`ensureStore` creates the directory and copies bundled `.md` seeds only when the user directory has no `.md` files. `save` archives the previous file when the version string changes and that history file does not already exist. Ids must match `isBlueprintId` (`/^[a-z0-9][a-z0-9-]*$/i`). Versions must match `isSafeVersion` (`/^[A-Za-z0-9][A-Za-z0-9._-]*$/`).

## Variable sources

`resolveVariables` understands:

- `input` — `default`, or `""`
- `auto:framework`
- `auto:dependencies` — comma-joined
- `auto:existing_rules` — `path` plus excerpt, blank line between files
- `auto:tree(depth=N)` — calls `buildTree` from the scanner

Any other source, or a missing context value, uses `fallback` or `""`. `compilePrompt` leaves a placeholder unchanged when the name is absent. Placeholder names are `[A-Za-z0-9_]+`.

## Guardrails

- This module may call `buildTree`. It must not import `vscode`, the webview, or the protocol.
- `nextPatch` reads `major.minor.patch` and returns `major.(minor+1).0`. `1.2.0` becomes `1.3.0`. Non-semver input returns `""`.
- Parser failures return `{ ok: false, error }`. Do not throw for bad frontmatter.
- Store methods that take an id throw on an unsafe id. History reads return a `ParseResult` for a missing or unsafe version.
- Tests stay colocated (`parser.test.ts`, `compile.test.ts`, `resolve.test.ts`, `version.test.ts`, `store.test.ts`, `id.test.ts`, `flow.test.ts`).
