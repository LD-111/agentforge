# Shared protocol

[protocol.ts](protocol.ts) is the only host/webview channel. It is types only. No functions, no `vscode`, no I/O.

## Host to webview (`HostMessage`)

- `state` — `SidebarState`: `blueprints` (`SidebarBlueprint` with blueprint, resolved `values`, and `history`), `errors`, and `context` (`WorkspaceContext` or `null`).
- `notice` — `{ message }` for a recoverable failure.
- `saved` — editor should close. Optional `id` selects the created blueprint.

## Webview to host (`WebviewMessage`)

- `ready` — webview mounted; host loads state.
- `compile` — `{ id, values }`. `values` must be a string record.
- `toggleFavorite` — `{ id }`.
- `save` — `{ blueprint, note }` for an existing id.
- `create` — `{ blueprint, note }` for a new id.
- `diff` — `{ id, version }` opens the history snapshot against the current file.
- `rollback` — `{ id, version }` restores that snapshot and archives the current file first.

`HistoryEntry` is `{ version, note }`. The note comes from the snapshot changelog entry with the same version, or `""`.

## Guardrails

- Adding or changing a message requires the provider switch in [AgentForgeViewProvider.ts](../webview/AgentForgeViewProvider.ts) and the listener in [App.tsx](../../webview-ui/App.tsx) in the same change.
- Do not put runtime validation in this file. The provider checks ids, versions, and variable shapes before it touches the store.
- Import these types from both bundles. Keep them free of Node and DOM APIs so the webview bundle can include them.
