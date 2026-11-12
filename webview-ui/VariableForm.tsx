import type { BlueprintVariable } from "../src/blueprints/types";
import { Disclosure } from "./Disclosure";
import { isWorkspaceSource, sourceLabel } from "./sources";

interface VariableFormProps {
  variables: BlueprintVariable[];
  values: Record<string, string>;
  dirty: boolean;
  onChange: (name: string, value: string) => void;
  onReset: () => void;
}

export function VariableForm({ variables, values, dirty, onChange, onReset }: VariableFormProps) {
  if (variables.length === 0) {
    return <p className="text-xs opacity-80">This blueprint has no variables.</p>;
  }

  const inputs = variables.filter((variable) => !isWorkspaceSource(variable.source));
  const workspace = variables.filter((variable) => isWorkspaceSource(variable.source));
  const reset = dirty ? (
    <button type="button" className="plain shrink-0 text-xs opacity-80" onClick={onReset}>
      Reset
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      {inputs.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">Inputs</h2>
            {reset}
          </div>
          {inputs.map((variable) => (
            <Field
              key={variable.name}
              variable={variable}
              value={values[variable.name] ?? ""}
              hint={variable.source === "input" ? undefined : sourceLabel(variable.source)}
              onChange={onChange}
            />
          ))}
        </section>
      )}
      {workspace.length > 0 && (
        <Disclosure title="Workspace" meta={String(workspace.length)} aside={inputs.length === 0 ? reset : null}>
          {workspace.map((variable) => (
            <Field key={variable.name} variable={variable} value={values[variable.name] ?? ""} hint={sourceLabel(variable.source)} onChange={onChange} />
          ))}
        </Disclosure>
      )}
    </div>
  );
}

function Field({
  variable,
  value,
  hint,
  onChange,
}: {
  variable: BlueprintVariable;
  value: string;
  hint?: string;
  onChange: (name: string, value: string) => void;
}) {
  const multiline = value.includes("\n");
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span>{variable.name}</span>
        {hint ? <span className="opacity-70">{hint}</span> : null}
      </span>
      {multiline ? (
        <textarea
          className="field"
          rows={Math.min(8, Math.max(2, value.split("\n").length))}
          value={value}
          onChange={(event) => onChange(variable.name, event.target.value)}
        />
      ) : (
        <input className="field" value={value} onChange={(event) => onChange(variable.name, event.target.value)} />
      )}
    </label>
  );
}
