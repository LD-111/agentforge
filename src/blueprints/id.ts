const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

export function isBlueprintId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return isBlueprintId(slug) ? slug : "";
}
