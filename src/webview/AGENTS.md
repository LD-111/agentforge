# Webview host

Extension-side owner of the sidebar. This is the only `src` folder that should import `vscode` besides [extension.ts](../extension.ts).

## Public surface

- [AgentForgeViewProvider.ts](AgentForgeViewProvider.ts) — `AgentForgeViewProvider`. View id `agentforge.sidebar`.
- [launch.ts](launch.ts) — `copyAndFocus`, `insertIntoAgent`.

`resolveWebviewView` enables scripts, limits local resources to `dist/`, and serves HTML with a nonce CSP (`default-src 'none'`, styles from the webview source plus `unsafe-inline`, script only with the nonce).

`refresh` and `loadState` seed the store from `blueprints/` beside the extension, list blueprints, scan the first workspace folder, resolve variables, and attach history. No folder yields `context: null`. Load failures post an empty state with one error.

## Commands and messages

`compileFromPalette` quick-picks favorites first, then title, and copies the already resolved values. `onMessage` handles every `WebviewMessage`. Unknown types are ignored. Thrown errors become a `notice`.

Save and create require a title, a safe version, unique variable names matching `^[A-Za-z0-9_]+$`, and a non-empty source per variable. A version change on save, and every create, requires an evolution note. The note is prepended to the changelog only when the version changes. Create rejects ids that fail `isBlueprintId` and ids that already exist.

`showDiff` uses `vscode.diff` on the history file and the current file. `rollback` goes through `BlueprintStore.rollback`.

`copyAndFocus` writes the clipboard, then tries `composerMode.agent` and `aichat.newchataction`. If neither command exists, it tells the user to open the agent input and paste.

`insertIntoAgent` writes the clipboard, focuses `composer.focusComposer` when that command exists, and pastes into the current agent input without submitting. It restores the previous clipboard after a successful paste. If the command is missing, focus or paste fails, or the paste changes the active editor, it leaves the prompt on the clipboard and shows the same paste hint. It does not open a new chat or submit the prompt. `compile` calls it when `mode` is `"insert"` and calls `copyAndFocus` otherwise. Omitted `mode` means copy. The palette command always copies.

## Guardrails

- Do not parse Markdown or walk the workspace here. Call `BlueprintStore`, `parse`/`compile`/`resolve`, and `scanWorkspace`.
- Do not render React here. HTML is the shell that loads `dist/webview.js` and `dist/webview.css`.
- Validate webview payloads before `save` or `create`. The store trusts its caller for field shape beyond id and version.
- Keep the CSP nonce on the script tag. Do not widen `script-src` to `unsafe-inline`.
- Status and error text go through `notice` or `vscode.window` messages. Do not `console.log` user-facing failures.
