import { useEffect, useRef, useState } from "react";
import { slugifyTitle } from "../src/blueprints/id";
import type { Blueprint } from "../src/blueprints/types";
import type { HostMessage, SidebarBlueprint, SidebarState } from "../src/shared/protocol";
import { BlueprintList, compareBlueprints } from "./BlueprintList";
import { EditorModal } from "./EditorModal";
import { Icon } from "./Icon";
import { Preview } from "./Preview";
import { VariableForm } from "./VariableForm";

const vscode = acquireVsCodeApi();

export function App() {
  const [state, setState] = useState<SidebarState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Blueprint | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pendingSelect = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const copyRef = useRef<() => void>(() => undefined);

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
        dismissCopied(copiedTimer, setCopied);
      } else if (message.type === "saved") {
        if (message.id) {
          pendingSelect.current = message.id;
          setSelectedId(message.id);
        }
        setDraft(null);
        setEditingId(null);
        setNotice(null);
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state || state.blueprints.length === 0) {
      return;
    }
    if (pendingSelect.current) {
      if (state.blueprints.some((item) => item.blueprint.id === pendingSelect.current)) {
        setSelectedId(pendingSelect.current);
        pendingSelect.current = null;
      }
      return;
    }
    if (!selectedId || !state.blueprints.some((item) => item.blueprint.id === selectedId)) {
      const ordered = [...state.blueprints].sort(compareBlueprints);
      setSelectedId(ordered[0]?.blueprint.id ?? null);
    }
  }, [state, selectedId]);

  useEffect(() => {
    dismissCopied(copiedTimer, setCopied);
  }, [selectedId]);

  const editorOpen = draft !== null || editingId !== null;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editorOpen) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        copyRef.current();
        return;
      }
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      if (searching) {
        searchRef.current?.focus();
      } else {
        setQuery("");
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen, searching]);

  if (!state) {
    return <p className="p-3 text-xs opacity-80">Loading blueprints…</p>;
  }

  const selected = state.blueprints.find((item) => item.blueprint.id === selectedId) ?? null;
  const editingExisting = state.blueprints.find((item) => item.blueprint.id === editingId) ?? null;
  const values = selected ? effectiveValues(selected, overrides[selected.blueprint.id]) : {};
  const dirty = selected ? hasOverride(overrides[selected.blueprint.id]) : false;
  const contextHint = state.context
    ? `Framework ${state.context.framework} · Language ${state.context.language}`
    : "Open a folder to scan the workspace.";

  copyRef.current = () => {
    if (!selected) {
      return;
    }
    vscode.postMessage({ type: "compile", id: selected.blueprint.id, values });
    setCopied(true);
    if (copiedTimer.current !== null) {
      window.clearTimeout(copiedTimer.current);
    }
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, 1500);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-2">
        {notice && !draft && !editingExisting && <p className="error text-xs">{notice}</p>}
        <BlueprintList
          items={state.blueprints}
          selectedId={selectedId}
          searching={searching}
          query={query}
          contextHint={contextHint}
          searchRef={searchRef}
          onQueryChange={setQuery}
          onOpenSearch={() => {
            setQuery("");
            setSearching(true);
          }}
          onCloseSearch={() => {
            setSearching(false);
            setQuery("");
          }}
          onSelect={(id) => {
            setSelectedId(id);
            setSearching(false);
            setQuery("");
          }}
          onToggleFavorite={(id) => vscode.postMessage({ type: "toggleFavorite", id })}
          onEdit={(id) => {
            setSearching(false);
            setQuery("");
            setDraft(null);
            setSelectedId(id);
            setNotice(null);
            setEditingId(id);
          }}
          onCreate={(title) => {
            const trimmed = title.trim();
            setSearching(false);
            setQuery("");
            setNotice(null);
            setEditingId(null);
            setDraft({
              id: slugifyTitle(trimmed),
              title: trimmed,
              version: "1.0.0",
              tags: [],
              variables: [],
              changelog: [],
              body: "",
              filePath: "",
            });
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
        {selected && (
          <div key={selected.blueprint.id} className="flex flex-col gap-3">
            <VariableForm
              variables={selected.blueprint.variables}
              values={values}
              dirty={dirty}
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
            />
            <Preview body={selected.blueprint.body} values={values} />
          </div>
        )}
      </div>
      {selected && (
        <div className="sticky-footer">
          <button type="button" className="button w-full" onClick={() => copyRef.current()}>
            <Icon name="copy" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {draft && (
        <EditorModal
          key="create"
          mode="create"
          blueprint={draft}
          history={[]}
          notice={notice}
          onClose={() => {
            setDraft(null);
            setNotice(null);
          }}
          onSave={(blueprint: Blueprint, note: string) => vscode.postMessage({ type: "create", blueprint, note })}
          onDiff={() => undefined}
          onRollback={() => undefined}
        />
      )}
      {editingExisting && !draft && (
        <EditorModal
          key={editingExisting.blueprint.id}
          mode="edit"
          blueprint={editingExisting.blueprint}
          history={editingExisting.history}
          notice={notice}
          onClose={() => {
            setEditingId(null);
            setNotice(null);
          }}
          onSave={(blueprint: Blueprint, note: string) => vscode.postMessage({ type: "save", blueprint, note })}
          onDiff={(version) => vscode.postMessage({ type: "diff", id: editingExisting.blueprint.id, version })}
          onRollback={(version) => vscode.postMessage({ type: "rollback", id: editingExisting.blueprint.id, version })}
        />
      )}
    </div>
  );
}

function dismissCopied(timer: { current: number | null }, setFlag: (copied: boolean) => void): void {
  setFlag(false);
  if (timer.current !== null) {
    window.clearTimeout(timer.current);
    timer.current = null;
  }
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

function hasOverride(override: Record<string, string> | undefined): boolean {
  return Boolean(override && Object.keys(override).length > 0);
}
