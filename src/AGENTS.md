# Extension host

Composition root for the AgentForge extension. [extension.ts](extension.ts) activates the sidebar and registers commands. Domain work lives in the child modules below.

## Responsibilities

- Register `AgentForgeViewProvider` for view id `agentforge.sidebar` with `retainContextWhenHidden`.
- Register `agentforge.refresh` and `agentforge.compileBlueprint`.
- Refresh the sidebar when workspace folders change.

`deactivate` is empty. Do not put parsing, scanning, storage, or UI rendering in `extension.ts`.

## Boundaries

| Module | Owns |
| --- | --- |
| [blueprints](blueprints/AGENTS.md) | Markdown model, compile, resolve, versioned store |
| [scanner](scanner/AGENTS.md) | Workspace stack, tree, rule excerpts |
| [shared](shared/AGENTS.md) | Host and webview message types |
| [webview](webview/AGENTS.md) | Provider, validation, clipboard launch |

## Guardrails

- Keep `extension.ts` as wiring. New host behavior goes in `webview/` and calls the domain modules.
- Scan and compile against the first workspace folder only. Do not add multi-root behavior here without updating [webview/AGENTS.md](webview/AGENTS.md) and the root [AGENTS.md](../AGENTS.md).
- Commands stay declared in [package.json](../package.json) and registered in `activate`. A command without both is dead.
