const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function nextPatch(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return "";
  }
  return `${match[1]}.${Number(match[2]) + 1}.0`;
}

export function isSafeVersion(version: string): boolean {
  return SAFE_VERSION.test(version);
}
