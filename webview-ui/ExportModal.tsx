import { useState } from "react";
import { Icon } from "./Icon";

interface ExportItem {
  id: string;
  title: string;
  version: string;
}

interface ExportModalProps {
  items: ExportItem[];
  onClose: () => void;
  onExport: (ids: string[]) => void;
}

export function ExportModal({ items, onClose, onExport }: ExportModalProps) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(items.map((item) => item.id)));
  const allChecked = items.length > 0 && items.every((item) => checked.has(item.id));
  const selected = items.filter((item) => checked.has(item.id)).map((item) => item.id);

  function toggleAll(): void {
    setChecked(allChecked ? new Set() : new Set(items.map((item) => item.id)));
  }

  function toggle(id: string): void {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="overlay box-border flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Export blueprints</h2>
        <button type="button" className="icon-button" aria-label="Close export" title="Close export" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <p className="text-xs opacity-70">Choose the blueprints to share. The file contains their current text.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allChecked} disabled={items.length === 0} onChange={toggleAll} />
        Select all
      </label>
      {items.length === 0 && <p className="text-xs opacity-80">No blueprints to export.</p>}
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="shrink-0 text-xs opacity-70">v{item.version}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="button" disabled={selected.length === 0} onClick={() => onExport(selected)}>
        Export
      </button>
    </div>
  );
}
