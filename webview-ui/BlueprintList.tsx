import type { SidebarBlueprint } from "../src/shared/protocol";

interface BlueprintListProps {
  items: SidebarBlueprint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (id: string) => void;
}

export function BlueprintList({ items, selectedId, onSelect, onToggleFavorite, onEdit }: BlueprintListProps) {
  if (items.length === 0) {
    return <p className="text-xs opacity-80">No blueprints in ~/.agentforge/blueprints.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
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
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(blueprint.id)}>
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
    </ul>
  );
}
