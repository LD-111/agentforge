# Webview UI

React 19 sidebar. Bundled as a browser IIFE from [main.tsx](main.tsx). It mounts [App.tsx](App.tsx) into `#root`.

## Components

- [App.tsx](App.tsx) — state, host listener, selection, variable overrides, keyboard shortcuts, the editor session, and the export and import overlays. The list, errors, and variable form scroll in a top region. Preview fills the leftover height. A split button sits in the sticky footer: Send to Agent places the prompt, and the caret menu copies. Posts `ready` on mount. Ctrl/Cmd+Enter sends when an overlay is closed. `/` focuses search when focus is outside a field. Escape and an outside click close the action menu. Send shows "Placed" and Copy shows "Copied" briefly; a `notice` clears that state. `imported` closes the import overlay. Export and import results are VS Code popups, not sidebar text.
- [BlueprintList.tsx](BlueprintList.tsx) — search toggle, create, export, import, and the blueprint rows. A row click selects. Search filters and is not required to pick. Rows sort favorites first, then title. Tags render on the selected row. Favorite and edit are icon buttons. Export is disabled when there are no blueprints. When no folder is open, it shows "Open a folder to scan the workspace." Framework and language are not shown. `compareBlueprints` is the sidebar order, including the default selection.
- [ExportModal.tsx](ExportModal.tsx) — checklist of current blueprints, all checked, with select all. Export is disabled when none are checked. Closing does not write a file.
- [ImportModal.tsx](ImportModal.tsx) — checklist from `importPreview`. `new` rows start checked and the id is fixed. `duplicate` rows are unchecked, disabled, and labeled already in the library. `conflict` rows start unchecked; the id field is prefilled with `suggestedId` and can be edited while the row is checked. Add sends `{ sourceId, id }` for the checked rows. It does not render a notice. A rejected import leaves the checklist open. Closing posts `importCancel`. The host `imported` message closes it.
- [VariableForm.tsx](VariableForm.tsx) — `input` variables stay open, as a single line when the value has no newline. Sources that start with `auto:` sit in a collapsed Workspace disclosure and stay editable. Reset shows only when that blueprint has overrides. It does not compile.
- [Preview.tsx](Preview.tsx) — open `compilePrompt` preview that fills leftover height and scrolls inside that space. Switching blueprints opens it again. It does not copy to the clipboard.
- [EditorModal.tsx](EditorModal.tsx) — create and edit. Close, add, and remove are icon buttons. Variable source is a select: input, framework, dependencies, existing rules, folder tree with a depth, or custom. Changelog and history start collapsed. Create slugs the title with `slugifyTitle` until the id is edited by hand. Edit starts the version field at `nextPatch`.
- [Icon.tsx](Icon.tsx) — inline 16px icons. No icon font.
- [Disclosure.tsx](Disclosure.tsx) — section toggle. Starts collapsed unless `defaultOpen` is set. `fill` lets an open section grow.
- [sources.ts](sources.ts) — labels and select values for variable sources. Saved `source` strings stay the ones the resolver reads.
- [styles.css](styles.css) — Tailwind 4 entry (`@import "tailwindcss"`) plus classes (`.card`, `.field`, `.button`, `.icon-button`, `.row`, `.disclosure`, `.sidebar-top`, `.preview-fill`, `.sticky-footer`, `.split-button`, `.tree`, `.error`) using VS Code theme variables.
- [vscode.d.ts](vscode.d.ts) — `acquireVsCodeApi` typing.

## Boundaries

The UI may import pure helpers and types from `src/blueprints` (`compilePrompt`, `slugifyTitle`, `isBlueprintId`, `nextPatch`, blueprint types) and `src/shared` (`HostMessage`, `SidebarBlueprint`, `HistoryEntry`, `ImportPreviewItem`, `ImportSelection`). It must not import `vscode`, `BlueprintStore`, the scanner, or Node APIs.

Talk to the host only through `acquireVsCodeApi().postMessage` and the `message` listener. Handle `state`, `notice`, `saved`, `importPreview`, and `imported`. Ignore anything else.

## Guardrails

- Do not duplicate compile or id rules. Call the functions in `src/blueprints`.
- Variable overrides live in React state. Reset clears them. Send and Copy send the effective values with `mode` `"insert"` or `"copy"`; they do not write the blueprint file.
- A `saved` message with an `id` selects that blueprint after the next `state`. Close the editor on every `saved`.
- Styling stays in `styles.css` and Tailwind utilities. Do not add a second CSS pipeline.
- This package has no Vitest project. Behavior that needs tests belongs in `src/`.
