import { useState } from "react";
import { isBlueprintId, slugifyTitle } from "../src/blueprints/id";
import type { Blueprint, BlueprintVariable, ChangelogEntry } from "../src/blueprints/types";
import { nextPatch } from "../src/blueprints/version";
import type { HistoryEntry } from "../src/shared/protocol";
import { Disclosure } from "./Disclosure";
import { Icon } from "./Icon";
import { SOURCE_KINDS, formatSource, parseSource } from "./sources";

interface VariableDraft {
  name: string;
  source: string;
  fallback: string;
  default: string;
}

interface EditorModalProps {
  mode: "create" | "edit";
  blueprint: Blueprint;
  history: HistoryEntry[];
  notice: string | null;
  onClose: () => void;
  onSave: (blueprint: Blueprint, note: string) => void;
  onDiff: (version: string) => void;
  onRollback: (version: string) => void;
}

export function EditorModal({ mode, blueprint, history, notice, onClose, onSave, onDiff, onRollback }: EditorModalProps) {
  const creating = mode === "create";
  const [title, setTitle] = useState(blueprint.title);
  const [id, setId] = useState(blueprint.id);
  const [idEdited, setIdEdited] = useState(false);
  const [tags, setTags] = useState(blueprint.tags.join(", "));
  const [body, setBody] = useState(blueprint.body);
  const [version, setVersion] = useState(creating ? blueprint.version : nextPatch(blueprint.version));
  const [note, setNote] = useState("");
  const [variables, setVariables] = useState<VariableDraft[]>(
    blueprint.variables.map((variable) => ({
      name: variable.name,
      source: variable.source,
      fallback: variable.fallback ?? "",
      default: variable.default ?? "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingRollback, setPendingRollback] = useState<string | null>(null);

  function updateVariable(index: number, patch: Partial<VariableDraft>): void {
    setVariables((current) => current.map((variable, itemIndex) => (itemIndex === index ? { ...variable, ...patch } : variable)));
  }

  function updateTitle(value: string): void {
    setTitle(value);
    if (creating && !idEdited) {
      setId(slugifyTitle(value));
    }
  }

  function save(): void {
    const problem = validate(title, version, note, blueprint.version, variables, creating ? id : undefined);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave(
      {
        ...blueprint,
        ...(creating ? { id: id.trim() } : {}),
        title: title.trim(),
        version: version.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        variables: variables.map(toVariable),
        body,
      },
      note.trim(),
    );
  }

  return (
    <div className="overlay box-border flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{creating ? "New blueprint" : "Edit blueprint"}</h2>
        <button type="button" className="icon-button" aria-label="Close editor" title="Close editor" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {!creating && (
        <p className="text-xs opacity-70">
          {blueprint.id} · current v{blueprint.version}
        </p>
      )}
      {notice && <p className="error text-xs">{notice}</p>}
      {error && <p className="error text-xs">{error}</p>}

      {creating && (
        <label className="flex flex-col gap-1 text-xs">
          Id
          <input
            className="field"
            value={id}
            onChange={(event) => {
              setIdEdited(true);
              setId(event.target.value);
            }}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs">
        Title
        <input className="field" value={title} onChange={(event) => updateTitle(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Tags
        <input className="field" value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Prompt
        <textarea className="field" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Variables</h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Add variable"
          title="Add variable"
          onClick={() => setVariables((current) => [...current, { name: "", source: "input", fallback: "", default: "" }])}
        >
          <Icon name="plus" />
        </button>
      </div>
      {variables.map((variable, index) => (
        <VariableDraftRow key={index} variable={variable} onChange={(patch) => updateVariable(index, patch)} onRemove={() => setVariables((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
      ))}

      <label className="flex flex-col gap-1 text-xs">
        Version
        <input className="field" value={version} onChange={(event) => setVersion(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Evolution note
        <textarea className="field" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button type="button" className="button" onClick={save}>
        Save
      </button>

      {!creating && (
        <>
          <Disclosure title="Changelog">
            <ChangelogList changelog={blueprint.changelog} />
          </Disclosure>
          <Disclosure title="History">
            <HistoryList
              history={history}
              pendingRollback={pendingRollback}
              onDiff={onDiff}
              onAskRollback={setPendingRollback}
              onRollback={onRollback}
            />
          </Disclosure>
        </>
      )}
    </div>
  );
}

function VariableDraftRow({
  variable,
  onChange,
  onRemove,
}: {
  variable: VariableDraft;
  onChange: (patch: Partial<VariableDraft>) => void;
  onRemove: () => void;
}) {
  const parsed = parseSource(variable.source);
  return (
    <div className="card flex flex-col gap-1 p-2">
      <div className="flex items-center gap-1">
        <input
          className="field grow"
          placeholder="name"
          aria-label="Variable name"
          value={variable.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <button type="button" className="icon-button" aria-label="Remove variable" title="Remove variable" onClick={onRemove}>
          <Icon name="trash" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <select
          className="field grow"
          aria-label="Variable source"
          value={parsed.kind}
          onChange={(event) => {
            const kind = event.target.value;
            if (kind === "custom") {
              onChange({ source: parsed.kind === "custom" ? variable.source : "" });
              return;
            }
            onChange({ source: formatSource(kind, parsed.depth) });
          }}
        >
          {SOURCE_KINDS.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
        {parsed.kind === "auto:tree" && (
          <input
            className="field narrow"
            aria-label="Tree depth"
            inputMode="numeric"
            value={parsed.depth}
            onChange={(event) => onChange({ source: formatSource("auto:tree", event.target.value) })}
          />
        )}
      </div>
      {parsed.kind === "custom" && (
        <input
          className="field"
          placeholder="source"
          aria-label="Custom source"
          value={variable.source}
          onChange={(event) => onChange({ source: event.target.value })}
        />
      )}
      <div className="flex gap-1">
        <input
          className="field grow"
          placeholder="fallback"
          aria-label="Fallback"
          value={variable.fallback}
          onChange={(event) => onChange({ fallback: event.target.value })}
        />
        <input
          className="field grow"
          placeholder="default"
          aria-label="Default"
          value={variable.default}
          onChange={(event) => onChange({ default: event.target.value })}
        />
      </div>
    </div>
  );
}

function ChangelogList({ changelog }: { changelog: ChangelogEntry[] }) {
  if (changelog.length === 0) {
    return <p className="text-xs opacity-80">No changelog notes.</p>;
  }
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {changelog.map((entry) => (
        <li key={`${entry.version}:${entry.note}`}>
          v{entry.version}: {entry.note}
        </li>
      ))}
    </ul>
  );
}

function HistoryList({
  history,
  pendingRollback,
  onDiff,
  onAskRollback,
  onRollback,
}: {
  history: HistoryEntry[];
  pendingRollback: string | null;
  onDiff: (version: string) => void;
  onAskRollback: (version: string | null) => void;
  onRollback: (version: string) => void;
}) {
  if (history.length === 0) {
    return <p className="text-xs opacity-80">No earlier versions.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {history.map((entry) => (
        <li key={entry.version} className="card flex flex-col gap-1 p-2 text-xs">
          <span>
            v{entry.version}
            {entry.note ? ` · ${entry.note}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="icon-button"
              aria-label={`View diff for v${entry.version}`}
              title="View diff"
              onClick={() => onDiff(entry.version)}
            >
              <Icon name="diff" />
            </button>
            {pendingRollback === entry.version ? (
              <>
                <span className="self-center">Replace with v{entry.version}?</span>
                <button type="button" className="button" onClick={() => onRollback(entry.version)}>
                  Confirm
                </button>
                <button type="button" className="button secondary" onClick={() => onAskRollback(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="button secondary" onClick={() => onAskRollback(entry.version)}>
                Rollback
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function toVariable(variable: VariableDraft): BlueprintVariable {
  const next: BlueprintVariable = {
    name: variable.name.trim(),
    source: variable.source.trim(),
  };
  if (variable.fallback.trim()) {
    next.fallback = variable.fallback.trim();
  }
  if (variable.default.trim()) {
    next.default = variable.default.trim();
  }
  return next;
}

function validate(
  title: string,
  version: string,
  note: string,
  currentVersion: string,
  variables: VariableDraft[],
  id?: string,
): string | undefined {
  if (id !== undefined && !isBlueprintId(id.trim())) {
    return "Id must start with a letter or number and use only letters, numbers, and hyphens.";
  }
  if (!title.trim()) {
    return "Title is required.";
  }
  if (!version.trim()) {
    return "Version is required.";
  }
  if (id !== undefined) {
    if (!note.trim()) {
      return "An evolution note is required.";
    }
  } else if (version.trim() !== currentVersion && !note.trim()) {
    return "An evolution note is required when the version changes.";
  }
  const names = variables.map((variable) => variable.name.trim());
  if (names.some((name) => !/^[A-Za-z0-9_]+$/.test(name))) {
    return "Variable names must use letters, numbers, and underscores.";
  }
  if (new Set(names).size !== names.length) {
    return "Variable names must be unique.";
  }
  if (variables.some((variable) => !variable.source.trim())) {
    return "Every variable needs a source.";
  }
  return undefined;
}
