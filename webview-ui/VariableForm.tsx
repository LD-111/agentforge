import type { BlueprintVariable } from "../src/blueprints/types";

interface VariableFormProps {
  variables: BlueprintVariable[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onReset: () => void;
  onCompile: () => void;
}

export function VariableForm({ variables, values, onChange, onReset, onCompile }: VariableFormProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">Variables</h2>
        <button type="button" className="button secondary" onClick={onReset}>
          Reset
        </button>
      </div>
      {variables.length === 0 ? (
        <p className="text-xs opacity-80">This blueprint has no variables.</p>
      ) : (
        variables.map((variable) => (
          <label key={variable.name} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-xs">
              <span>{variable.name}</span>
              <span className="opacity-70">{variable.source}</span>
            </span>
            <textarea
              className="field"
              rows={Math.min(8, Math.max(2, (values[variable.name] ?? "").split("\n").length))}
              value={values[variable.name] ?? ""}
              onChange={(event) => onChange(variable.name, event.target.value)}
            />
          </label>
        ))
      )}
      <button type="button" className="button" onClick={onCompile}>
        Compile & Copy
      </button>
    </section>
  );
}
