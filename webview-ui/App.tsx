import { useEffect, useRef, useState } from "react";
import { slugifyTitle } from "../src/blueprints/id";
import type { Blueprint } from "../src/blueprints/types";
import type { HostMessage, ImportPreviewItem, SidebarBlueprint, SidebarState } from "../src/shared/protocol";
import { BlueprintList, compareBlueprints } from "./BlueprintList";
import { EditorModal } from "./EditorModal";
import { ExportModal } from "./ExportModal";
import { Icon } from "./Icon";
import { ImportModal } from "./ImportModal";
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
  const [actionLabel, setActionLabel] = useState<ActionLabel>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importItems, setImportItems] = useState<ImportPreviewItem[] | null>(null);
  const pendingSelect = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const actionTimer = useRef<number | null>(null);
  const sendRef = useRef<() => void>(() => undefined);
  const menuRef = useRef<HTMLDivElement>(null);

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
        dismissAction(actionTimer, setActionLabel);
        if (message.message.startsWith("Added ")) {
          setImportItems(null);
        }
      } else if (message.type === "importPreview") {
        if (!Array.isArray(message.items)) {
          return;
        }
        setImportItems(message.items);
        setExporting(false);
        setNotice(null);
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
      if (actionTimer.current !== null) {
        window.clearTimeout(actionTimer.current);
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
    dismissAction(actionTimer, setActionLabel);
    setMenuOpen(false);
  }, [selectedId]);

  const editorOpen = draft !== null || editingId !== null || exporting || importItems !== null;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editorOpen) {
        return;
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        sendRef.current();
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

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

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

  const flash = (label: Exclude<ActionLabel, "idle">) => {
    setActionLabel(label);
    if (actionTimer.current !== null) {
      window.clearTimeout(actionTimer.current);
    }
    actionTimer.current = window.setTimeout(() => {
      setActionLabel("idle");
      actionTimer.current = null;
    }, 1500);
  };

  sendRef.current = () => {
    if (!selected) {
      return;
    }
    setMenuOpen(false);
    vscode.postMessage({ type: "compile", id: selected.blueprint.id, values, mode: "insert" });
    flash("placed");
  };

  const copyPrompt = () => {
    if (!selected) {
      return;
    }
    setMenuOpen(false);
    vscode.postMessage({ type: "compile", id: selected.blueprint.id, values, mode: "copy" });
    flash("copied");
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-2">
        <div className="sidebar-top flex flex-col gap-3">
          {notice && !draft && !editingExisting && !importItems && <p className="error text-xs">{notice}</p>}
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
            onExport={() => {
              setSearching(false);
              setQuery("");
              setNotice(null);
              setExporting(true);
            }}
            onImport={() => {
              setSearching(false);
              setQuery("");
              setNotice(null);
              vscode.postMessage({ type: "importPick" });
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
            <VariableForm
              key={selected.blueprint.id}
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
          )}
        </div>
        {selected && <Preview key={selected.blueprint.id} body={selected.blueprint.body} values={values} />}
      </div>
      {selected && (
        <div className="sticky-footer">
          <div className="split-button" ref={menuRef}>
            <button type="button" className="button split-main" onClick={() => sendRef.current()}>
              <Icon name="send" />
              {actionText(actionLabel)}
            </button>
            <button
              type="button"
              className="button split-caret"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="More actions"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name="chevron" className="split-caret-icon" />
            </button>
            {menuOpen && (
              <div role="menu" className="split-menu">
                <button type="button" role="menuitem" className="split-menu-item" onClick={copyPrompt}>
                  Copy
                </button>
              </div>
            )}
          </div>
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
      {exporting && !importItems && (
        <ExportModal
          items={[...state.blueprints].sort(compareBlueprints).map((item) => ({
            id: item.blueprint.id,
            title: item.blueprint.title,
            version: item.blueprint.version,
          }))}
          onClose={() => setExporting(false)}
          onExport={(ids) => {
            setExporting(false);
            vscode.postMessage({ type: "export", ids });
          }}
        />
      )}
      {importItems && (
        <ImportModal
          key={importItems.map((item) => `${item.id}:${item.status}:${item.suggestedId}`).join("|")}
          items={importItems}
          notice={notice}
          onClose={() => {
            setImportItems(null);
            setNotice(null);
            vscode.postMessage({ type: "importCancel" });
          }}
          onApply={(items) => vscode.postMessage({ type: "importApply", items })}
        />
      )}
    </div>
  );
}

type ActionLabel = "idle" | "copied" | "placed";

function actionText(label: ActionLabel): string {
  if (label === "placed") {
    return "Placed";
  }
  if (label === "copied") {
    return "Copied";
  }
  return "Send to Agent";
}

function dismissAction(timer: { current: number | null }, setLabel: (label: ActionLabel) => void): void {
  setLabel("idle");
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
