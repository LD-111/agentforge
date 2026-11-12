# Webview UI

React 19 sidebar. Bundled as a browser IIFE from [main.tsx](main.tsx). It mounts [App.tsx](App.tsx) into `#root`.

## Components

- [App.tsx](App.tsx) — state, host listener, selection, variable overrides, and the editor session. Posts `ready` on mount.
- [BlueprintList.tsx](BlueprintList.tsx) — search, select, favorite, edit, and create.
- [VariableForm.tsx](VariableForm.tsx) — edit resolved values, reset overrides, compile.
- [Preview.tsx](Preview.tsx) — `compilePrompt` preview. It does not copy to the clipboard.
- [EditorModal.tsx](EditorModal.tsx) — create and edit. Create slugs the title with `slugifyTitle` until the id is edited by hand. Edit starts the version field at `nextPatch`.
- [styles.css](styles.css) — Tailwind 4 entry (`@import "tailwindcss"`) plus a few classes (`.card`, `.field`, `.button`, `.tree`, `.error`) using VS Code theme variables.
- [vscode.d.ts](vscode.d.ts) — `acquireVsCodeApi` typing.

## Boundaries

The UI may import pure helpers and types from `src/blueprints` (`compilePrompt`, `slugifyTitle`, `isBlueprintId`, `nextPatch`, blueprint types) and `src/shared` (`HostMessage`, `SidebarBlueprint`, `HistoryEntry`). It must not import `vscode`, `BlueprintStore`, the scanner, or Node APIs.

Talk to the host only through `acquireVsCodeApi().postMessage` and the `message` listener. Handle `state`, `notice`, and `saved`. Ignore anything else.

## Guardrails

- Do not duplicate compile or id rules. Call the functions in `src/blueprints`.
- Variable overrides live in React state. Reset clears them. Compile sends the effective values; it does not write the blueprint file.
- A `saved` message with an `id` selects that blueprint after the next `state`. Close the editor on every `saved`.
- Styling stays in `styles.css` and Tailwind utilities. Do not add a second CSS pipeline.
- This package has no Vitest project. Behavior that needs tests belongs in `src/`.
