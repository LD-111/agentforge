# Shared protocol

[protocol.ts](protocol.ts) is the only host/webview channel. It is types only. No functions, no `vscode`, no I/O.

## Host to webview (`HostMessage`)

- `state` — `SidebarState`: `blueprints` (`SidebarBlueprint` with blueprint, resolved `values`, and `history`), `errors`, and `context` (`WorkspaceContext` or `null`).
- `notice` — `{ message }` for a recoverable failure.
- `saved` — editor should close. Optional `id` selects the created blueprint.
- `importPreview` — `{ items }` for a parsed share file. Each item is `{ id, title, version, tags, status, suggestedId }`. `status` is `"new"`, `"duplicate"`, or `"conflict"`.

## Webview to host (`WebviewMessage`)

- `ready` — webview mounted; host loads state.
- `compile` — `{ id, values, mode? }`. `values` must be a string record. `mode` is `"copy"` or `"insert"`. Omitted means copy.
- `toggleFavorite` — `{ id }`.
- `save` — `{ blueprint, note }` for an existing id.
- `create` — `{ blueprint, note }` for a new id.
- `diff` — `{ id, version }` opens the history snapshot against the current file.
- `rollback` — `{ id, version }` restores that snapshot and archives the current file first.
- `export` — `{ ids }` writes a share file for those blueprints.
- `importPick` — host opens a JSON file and posts `importPreview`.
- `importApply` — `{ items }`, each `{ sourceId, id }`, inserts the checked rows.
- `importCancel` — drops the parsed share file held by the host.

`HistoryEntry` is `{ version, note }`. The note comes from the snapshot changelog entry with the same version, or `""`.

## Guardrails

- Adding or changing a message requires the provider switch in [AgentForgeViewProvider.ts](../webview/AgentForgeViewProvider.ts) and the listener in [App.tsx](../../webview-ui/App.tsx) in the same change.
- Do not put runtime validation in this file. The provider checks ids, versions, and variable shapes before it touches the store.
- Import these types from both bundles. Keep them free of Node and DOM APIs so the webview bundle can include them.
