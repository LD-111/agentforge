import { useEffect, useState } from "react";
import type { SidebarState } from "../src/shared/protocol";
import type { WorkspaceContext } from "../src/scanner/types";

const vscode = acquireVsCodeApi();

export function App() {
  const [state, setState] = useState<SidebarState | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<SidebarState>) => {
      if (event.data?.type === "state") {
        setState(event.data);
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) {
    return <p className="p-3 text-xs opacity-80">Loading blueprints…</p>;
  }

  return (
    <div className="box-border flex flex-col gap-4 p-3">
      <header>
        <h1 className="text-sm font-semibold">AgentForge</h1>
        <p className="mt-1 text-xs opacity-80">Local prompt blueprints</p>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">Blueprints</h2>
        {state.blueprints.length === 0 ? (
          <p className="text-xs opacity-80">No blueprints in ~/.agentforge/blueprints.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.blueprints.map((blueprint) => (
              <li key={blueprint.id} className="card px-2 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm">{blueprint.title}</span>
                  <span className="shrink-0 text-xs opacity-70">v{blueprint.version}</span>
                </div>
                {blueprint.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {blueprint.tags.map((tag) => (
                      <span key={tag} className="tag rounded px-1.5 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {state.errors.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {state.errors.map((error) => (
              <li key={`${error.filePath}:${error.message}`} className="error text-xs">
                {error.filePath ? `${error.filePath}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">Workspace</h2>
        {state.context ? (
          <ContextSummary context={state.context} />
        ) : (
          <p className="text-xs opacity-80">Open a folder to scan the workspace.</p>
        )}
      </section>
    </div>
  );
}

function ContextSummary({ context }: { context: WorkspaceContext }) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <p>
        <span className="opacity-70">Framework </span>
        {context.framework}
      </p>
      <p>
        <span className="opacity-70">Language </span>
        {context.language}
      </p>
      <div>
        <p className="mb-1 opacity-70">Dependencies</p>
        {context.dependencies.length === 0 ? (
          <p className="opacity-80">None detected.</p>
        ) : (
          <p>{context.dependencies.join(", ")}</p>
        )}
      </div>
      <div>
        <p className="mb-1 opacity-70">Folder tree</p>
        <pre className="tree max-h-40 overflow-auto whitespace-pre rounded p-2 font-mono">{context.folderTree}</pre>
      </div>
      <div>
        <p className="mb-1 opacity-70">Existing rules</p>
        {context.existingRules.length === 0 ? (
          <p className="opacity-80">No AGENTS.md or .cursor/rules files.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {context.existingRules.map((rule) => (
              <li key={rule.path}>{rule.path}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
