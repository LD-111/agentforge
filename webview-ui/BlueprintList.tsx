import { useEffect, useRef } from "react";
import type { SidebarBlueprint } from "../src/shared/protocol";

interface BlueprintListProps {
  items: SidebarBlueprint[];
  selectedId: string | null;
  searching: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onCreate: (title: string) => void;
}

export function BlueprintList({
  items,
  selectedId,
  searching,
  query,
  onQueryChange,
  onOpenSearch,
  onCloseSearch,
  onSelect,
  onToggleFavorite,
  onEdit,
  onCreate,
}: BlueprintListProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) {
      inputRef.current?.focus();
    }
  }, [searching]);

  if (!searching && items.length === 0) {
    return (
      <button type="button" className="plain text-xs opacity-80" onClick={onOpenSearch}>
        No blueprints in ~/.agentforge/blueprints.
      </button>
    );
  }

  const visible = searching ? items.filter((item) => matches(item, query)) : items;
  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-2">
      {searching && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            className="field"
            value={query}
            placeholder="Search blueprints"
            aria-label="Search blueprints"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onCloseSearch();
              }
            }}
          />
          <button type="button" className="button secondary shrink-0" onClick={onCloseSearch}>
            Close
          </button>
        </div>
      )}
      {searching && visible.length === 0 && trimmed.length > 0 && (
        <p className="text-xs opacity-80">No matching blueprints.</p>
      )}
      <ul className="flex flex-col gap-2">
        {visible.map((item) => {
          const { blueprint } = item;
          const selected = blueprint.id === selectedId;
          return (
            <li key={blueprint.id} className={selected ? "card selected px-2 py-2" : "card px-2 py-2"}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="star shrink-0"
                  aria-label={blueprint.favorite ? "Remove favorite" : "Mark as favorite"}
                  onClick={() => onToggleFavorite(blueprint.id)}
                >
                  {blueprint.favorite ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => (searching ? onSelect(blueprint.id) : onOpenSearch())}
                >
                  <span className="block text-sm">{blueprint.title}</span>
                  <span className="text-xs opacity-70">v{blueprint.version}</span>
                </button>
                <button type="button" className="button secondary shrink-0" onClick={() => onEdit(blueprint.id)}>
                  Edit
                </button>
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
          );
        })}
        {searching && (
          <li>
            <button type="button" className="button w-full" onClick={() => onCreate(query)}>
              {trimmed ? `Create "${trimmed}"` : "Create new blueprint"}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function matches(item: SidebarBlueprint, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const { blueprint } = item;
  return (
    blueprint.title.toLowerCase().includes(needle) ||
    blueprint.id.toLowerCase().includes(needle) ||
    blueprint.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}
