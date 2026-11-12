import { useState } from "react";
import type { Blueprint, BlueprintVariable, ChangelogEntry } from "../src/blueprints/types";
import { nextPatch } from "../src/blueprints/version";
import type { HistoryEntry } from "../src/shared/protocol";

interface VariableDraft {
  name: string;
  source: string;
  fallback: string;
  default: string;
}

interface EditorModalProps {
  blueprint: Blueprint;
  history: HistoryEntry[];
  notice: string | null;
  onClose: () => void;
  onSave: (blueprint: Blueprint, note: string) => void;
  onDiff: (version: string) => void;
  onRollback: (version: string) => void;
}

export function EditorModal({ blueprint, history, notice, onClose, onSave, onDiff, onRollback }: EditorModalProps) {
  const [title, setTitle] = useState(blueprint.title);
  const [tags, setTags] = useState(blueprint.tags.join(", "));
  const [body, setBody] = useState(blueprint.body);
  const [version, setVersion] = useState(nextPatch(blueprint.version));
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

  function save(): void {
    const problem = validate(title, version, note, blueprint.version, variables);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave(
      {
        ...blueprint,
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
        <h2 className="text-sm font-semibold">Edit blueprint</h2>
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-xs opacity-70">
        {blueprint.id} · current v{blueprint.version}
      </p>
      {notice && <p className="error text-xs">{notice}</p>}
      {error && <p className="error text-xs">{error}</p>}

      <label className="flex flex-col gap-1 text-xs">
        Title
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
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
          className="button secondary"
          onClick={() => setVariables((current) => [...current, { name: "", source: "input", fallback: "", default: "" }])}
        >
          Add
        </button>
      </div>
      {variables.map((variable, index) => (
        <div key={index} className="card flex flex-col gap-1 p-2">
          <input
            className="field"
            placeholder="name"
            value={variable.name}
            onChange={(event) => updateVariable(index, { name: event.target.value })}
          />
          <input
            className="field"
            placeholder="source"
            value={variable.source}
            onChange={(event) => updateVariable(index, { source: event.target.value })}
          />
          <input
            className="field"
            placeholder="fallback"
            value={variable.fallback}
            onChange={(event) => updateVariable(index, { fallback: event.target.value })}
          />
          <input
            className="field"
            placeholder="default"
            value={variable.default}
            onChange={(event) => updateVariable(index, { default: event.target.value })}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => setVariables((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
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

      <ChangelogList changelog={blueprint.changelog} />
      <HistoryList
        history={history}
        pendingRollback={pendingRollback}
        onDiff={onDiff}
        onAskRollback={setPendingRollback}
        onRollback={onRollback}
      />
    </div>
  );
}

function ChangelogList({ changelog }: { changelog: ChangelogEntry[] }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Changelog</h3>
      {changelog.length === 0 ? (
        <p className="text-xs opacity-80">No changelog notes.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {changelog.map((entry) => (
            <li key={`${entry.version}:${entry.note}`}>
              v{entry.version}: {entry.note}
            </li>
          ))}
        </ul>
      )}
    </section>
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
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">History</h3>
      {history.length === 0 ? (
        <p className="text-xs opacity-80">No earlier versions.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry.version} className="card flex flex-col gap-1 p-2 text-xs">
              <span>
                v{entry.version}
                {entry.note ? ` · ${entry.note}` : ""}
              </span>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="button secondary" onClick={() => onDiff(entry.version)}>
                  View diff
                </button>
                {pendingRollback === entry.version ? (
                  <>
                    <span className="self-center">Replace the current blueprint with v{entry.version}?</span>
                    <button type="button" className="button" onClick={() => onRollback(entry.version)}>
                      Confirm rollback
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
      )}
    </section>
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
): string | undefined {
  if (!title.trim()) {
    return "Title is required.";
  }
  if (!version.trim()) {
    return "Version is required.";
  }
  if (version.trim() !== currentVersion && !note.trim()) {
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
