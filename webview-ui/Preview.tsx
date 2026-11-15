import { compilePrompt } from "../src/blueprints/compile";
import { Disclosure } from "./Disclosure";

interface PreviewProps {
  body: string;
  values: Record<string, string>;
}

export function Preview({ body, values }: PreviewProps) {
  return (
    <Disclosure title="Preview" defaultOpen fill>
      <pre className="tree min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded p-2 font-mono">{compilePrompt(body, values)}</pre>
    </Disclosure>
  );
}
