import { useEffect, type RefObject } from "react";
import type { SidebarBlueprint } from "../src/shared/protocol";
import { Icon } from "./Icon";

interface BlueprintListProps {
  items: SidebarBlueprint[];
  selectedId: string | null;
  searching: boolean;
  query: string;
  folderHint: string | null;
  searchRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onCreate: (title: string) => void;
  onExport: () => void;
  onImport: () => void;
}

export function BlueprintList({
  items,
  selectedId,
  searching,
  query,
  folderHint,
  searchRef,
  onQueryChange,
  onOpenSearch,
  onCloseSearch,
  onSelect,
  onToggleFavorite,
  onEdit,
  onCreate,
  onExport,
  onImport,
}: BlueprintListProps) {
  useEffect(() => {
    if (searching) {
      searchRef.current?.focus();
    }
  }, [searching, searchRef]);

  const ordered = [...items].sort(compareBlueprints);
  const visible = searching ? ordered.filter((item) => matches(item, query)) : ordered;
  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {searching && (
          <input
            ref={searchRef}
            className="field grow"
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
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={searching ? "Close search" : "Search blueprints"}
          title={searching ? "Close search" : "Search blueprints"}
          onClick={searching ? onCloseSearch : onOpenSearch}
        >
          <Icon name={searching ? "close" : "search"} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={trimmed ? `Create "${trimmed}"` : "New blueprint"}
          title={trimmed ? `Create "${trimmed}"` : "New blueprint"}
          onClick={() => onCreate(query)}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="icon-button disabled:opacity-40"
          aria-label="Export blueprints"
          title="Export blueprints"
          disabled={items.length === 0}
          onClick={onExport}
        >
          <Icon name="export" />
        </button>
        <button type="button" className="icon-button" aria-label="Import blueprints" title="Import blueprints" onClick={onImport}>
          <Icon name="import" />
        </button>
      </div>
      {folderHint && <p className="text-xs opacity-70">{folderHint}</p>}
      {visible.length === 0 && items.length === 0 && <p className="text-xs opacity-80">No blueprints in ~/.agentforge/blueprints.</p>}
      {searching && visible.length === 0 && items.length > 0 && <p className="text-xs opacity-80">No matching blueprints.</p>}
      <ul className="flex flex-col gap-0.5">
        {visible.map((item) => {
          const { blueprint } = item;
          const selected = blueprint.id === selectedId;
          return (
            <li key={blueprint.id} className={selected ? "row selected" : "row"}>
              <div className="flex items-center gap-1 px-1 py-0.5">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={blueprint.favorite ? "Remove favorite" : "Mark as favorite"}
                  title={blueprint.favorite ? "Remove favorite" : "Mark as favorite"}
                  aria-pressed={blueprint.favorite ?? false}
                  onClick={() => onToggleFavorite(blueprint.id)}
                >
                  <Icon name={blueprint.favorite ? "starFilled" : "star"} />
                </button>
                <button type="button" className="flex min-w-0 flex-1 items-baseline gap-2 text-left" onClick={() => onSelect(blueprint.id)}>
                  <span className="truncate text-sm">{blueprint.title}</span>
                  <span className="shrink-0 text-xs opacity-70">v{blueprint.version}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Edit ${blueprint.title}`}
                  title="Edit blueprint"
                  onClick={() => onEdit(blueprint.id)}
                >
                  <Icon name="pencil" />
                </button>
              </div>
              {selected && blueprint.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pb-1">
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
      </ul>
    </div>
  );
}

export function compareBlueprints(left: SidebarBlueprint, right: SidebarBlueprint): number {
  const favorite = Number(Boolean(right.blueprint.favorite)) - Number(Boolean(left.blueprint.favorite));
  if (favorite !== 0) {
    return favorite;
  }
  return left.blueprint.title.localeCompare(right.blueprint.title);
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
