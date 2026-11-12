# Scanner

Reads the first workspace root into a `WorkspaceContext`. No `vscode` imports and no blueprint imports.

## Public surface

- [scanWorkspace.ts](scanWorkspace.ts) — `scanWorkspace(rootPath, treeDepth = 2)`.
- [detectStack.ts](detectStack.ts) — `detectStack`. Reads root `package.json`, `tsconfig.json`, `requirements.txt`, and `Cargo.toml`.
- [buildTree.ts](buildTree.ts) — `buildTree` and `IGNORE_DIRS`.
- [types.ts](types.ts) — `WorkspaceContext`, `RuleExcerpt`.

`WorkspaceContext` is `rootPath`, `framework`, `language`, `dependencies`, `folderTree`, and `existingRules`.

## Detection

Language is TypeScript when `typescript` is a dependency or `tsconfig.json` exists, otherwise JavaScript when `package.json` exists, otherwise Python or Rust from the matching manifest, otherwise `Unknown`.

Framework match order for npm: Next.js, Angular, Vue, Svelte, React, NestJS, Fastify, Express. Python: Django, Flask, FastAPI. A `Cargo.toml` with no JS or Python framework match yields framework `Rust`.

## Limits

`buildTree` skips `node_modules`, `.git`, `dist`, `out`, `build`, `coverage`, `__pycache__`, `target`, `.venv`, and `venv`. It also skips symlinks.

Rule collection keeps files whose basename is `AGENTS.md`, plus `.cursor/rules` and anything under it. Caps: depth 6, 50 files, 500-character excerpts. Deeper or later files are dropped. Unreadable directories (`ENOENT`, `EACCES`) are skipped.

## Guardrails

- Do not import `vscode`, gray-matter, or `src/blueprints`. `resolve.ts` is allowed to call `buildTree`; this folder does not call back.
- The webview provider calls `scanWorkspace` only. Do not reimplement stack, tree, or rule walks in the host.
- Changing `IGNORE_DIRS`, excerpt length, file cap, or depth changes the prompt context. Update this file and the root [AGENTS.md](../../AGENTS.md) in the same change.
- Tests live in [scanner.test.ts](scanner.test.ts).
