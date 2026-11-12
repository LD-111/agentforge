const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function compilePrompt(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      return values[name];
    }
    return match;
  });
}
