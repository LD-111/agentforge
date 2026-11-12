import { compilePrompt } from "../src/blueprints/compile";

interface PreviewProps {
  body: string;
  values: Record<string, string>;
}

export function Preview({ body, values }: PreviewProps) {
  const compiled = compilePrompt(body, values);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">Preview</h2>
      <pre className="tree max-h-48 overflow-auto whitespace-pre-wrap rounded p-2 font-mono">{compiled}</pre>
    </section>
  );
}
