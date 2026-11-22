import { useState } from "react";
import type { ImportPreviewItem, ImportSelection } from "../src/shared/protocol";
import { Icon } from "./Icon";

interface ImportModalProps {
  items: ImportPreviewItem[];
  notice: string | null;
  onClose: () => void;
  onApply: (items: ImportSelection[]) => void;
}

interface RowState {
  checked: boolean;
  id: string;
}

export function ImportModal({ items, notice, onClose, onApply }: ImportModalProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const item of items) {
      initial[item.id] = { checked: item.status === "new", id: item.suggestedId };
    }
    return initial;
  });

  const selected: ImportSelection[] = items.flatMap((item) => {
    if (item.status === "duplicate") {
      return [];
    }
    const row = rows[item.id];
    if (!row?.checked) {
      return [];
    }
    return [{ sourceId: item.id, id: item.status === "new" ? item.id : row.id.trim() }];
  });
  const missingId = selected.some((item) => item.id.length === 0);

  function updateRow(sourceId: string, patch: Partial<RowState>): void {
    setRows((current) => {
      const row = current[sourceId];
      if (!row) {
        return current;
      }
      return { ...current, [sourceId]: { ...row, ...patch } };
    });
  }

  return (
    <div className="overlay box-border flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Import blueprints</h2>
        <button type="button" className="icon-button" aria-label="Close import" title="Close import" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <p className="text-xs opacity-70">Choose which blueprints to add. Nothing already in your library is replaced.</p>
      {notice && <p className="error text-xs">{notice}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const row = rows[item.id];
          const duplicate = item.status === "duplicate";
          return (
            <li key={item.id} className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={duplicate ? false : (row?.checked ?? false)}
                  disabled={duplicate}
                  onChange={() => updateRow(item.id, { checked: !row?.checked })}
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="shrink-0 text-xs opacity-70">v{item.version}</span>
              </label>
              {item.tags.length > 0 && <p className="pl-6 text-xs opacity-70">{item.tags.join(", ")}</p>}
              {item.status === "new" && <p className="pl-6 text-xs opacity-70">{item.id}</p>}
              {duplicate && <p className="pl-6 text-xs opacity-70">Already in your library.</p>}
              {item.status === "conflict" && (
                <label className="flex flex-col gap-1 pl-6 text-xs">
                  New id
                  <input
                    className="field disabled:opacity-60"
                    aria-label={`New id for ${item.title}`}
                    value={row?.id ?? ""}
                    disabled={!row?.checked}
                    onChange={(event) => updateRow(item.id, { id: event.target.value })}
                  />
                  <span className="opacity-70">Id in use. The existing prompt stays.</span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="button"
        disabled={selected.length === 0 || missingId}
        onClick={() => onApply(selected)}
      >
        Add
      </button>
    </div>
  );
}
