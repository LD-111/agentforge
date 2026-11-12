import { useEffect, useState } from "react";
import type { Blueprint } from "../src/blueprints/types";
import type { HostMessage, SidebarBlueprint, SidebarState } from "../src/shared/protocol";
import { BlueprintList } from "./BlueprintList";
import { EditorModal } from "./EditorModal";
import { Preview } from "./Preview";
import { VariableForm } from "./VariableForm";

const vscode = acquireVsCodeApi();

export function App() {
  const [state, setState] = useState<SidebarState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }
      if (message.type === "state") {
        setState(message);
      } else if (message.type === "notice") {
        setNotice(message.message);
      } else if (message.type === "saved") {
        setEditingId(null);
        setNotice(null);
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!state || state.blueprints.length === 0) {
      return;
    }
    if (!selectedId || !state.blueprints.some((item) => item.blueprint.id === selectedId)) {
      setSelectedId(state.blueprints[0]?.blueprint.id ?? null);
    }
  }, [state, selectedId]);

  if (!state) {
    return <p className="p-3 text-xs opacity-80">Loading blueprints…</p>;
  }

  const selected = state.blueprints.find((item) => item.blueprint.id === selectedId) ?? null;
  const editing = state.blueprints.find((item) => item.blueprint.id === editingId) ?? null;
  const values = selected ? effectiveValues(selected, overrides[selected.blueprint.id]) : {};

  return (
    <div className="relative box-border flex min-h-full flex-col gap-4 p-3">
      <header>
        <h1 className="text-sm font-semibold">AgentForge</h1>
        <p className="mt-1 text-xs opacity-80">
          {state.context
            ? `Framework ${state.context.framework} · Language ${state.context.language}`
            : "Open a folder to scan the workspace."}
        </p>
      </header>
      {notice && !editing && <p className="error text-xs">{notice}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">Blueprints</h2>
        <BlueprintList
          items={state.blueprints}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleFavorite={(id) => vscode.postMessage({ type: "toggleFavorite", id })}
          onEdit={(id) => {
            setSelectedId(id);
            setNotice(null);
            setEditingId(id);
          }}
        />
        {state.errors.length > 0 && (
          <ul className="flex flex-col gap-1">
            {state.errors.map((error) => (
              <li key={`${error.filePath}:${error.message}`} className="error text-xs">
                {error.filePath ? `${error.filePath}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <>
          <VariableForm
            variables={selected.blueprint.variables}
            values={values}
            onChange={(name, value) =>
              setOverrides((current) => ({
                ...current,
                [selected.blueprint.id]: { ...current[selected.blueprint.id], [name]: value },
              }))
            }
            onReset={() =>
              setOverrides((current) => {
                const next = { ...current };
                delete next[selected.blueprint.id];
                return next;
              })
            }
            onCompile={() =>
              vscode.postMessage({ type: "compile", id: selected.blueprint.id, values })
            }
          />
          <Preview body={selected.blueprint.body} values={values} />
        </>
      )}

      {editing && (
        <EditorModal
          key={editing.blueprint.id}
          blueprint={editing.blueprint}
          history={editing.history}
          notice={notice}
          onClose={() => {
            setEditingId(null);
            setNotice(null);
          }}
          onSave={(blueprint: Blueprint, note: string) => vscode.postMessage({ type: "save", blueprint, note })}
          onDiff={(version) => vscode.postMessage({ type: "diff", id: editing.blueprint.id, version })}
          onRollback={(version) => vscode.postMessage({ type: "rollback", id: editing.blueprint.id, version })}
        />
      )}
    </div>
  );
}

function effectiveValues(item: SidebarBlueprint, override: Record<string, string> | undefined): Record<string, string> {
  const values = { ...item.values };
  if (!override) {
    return values;
  }
  for (const variable of item.blueprint.variables) {
    if (Object.prototype.hasOwnProperty.call(override, variable.name)) {
      values[variable.name] = override[variable.name] ?? "";
    }
  }
  return values;
}
