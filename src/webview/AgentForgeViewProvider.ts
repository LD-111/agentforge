import * as vscode from "vscode";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyImports, parseBundle, sameBlueprint, serializeBundle, type BundleBlueprint } from "../blueprints/bundle";
import { compilePrompt } from "../blueprints/compile";
import { isBlueprintId } from "../blueprints/id";
import { resolveVariables } from "../blueprints/resolve";
import { BlueprintStore } from "../blueprints/store";
import type { Blueprint, BlueprintVariable } from "../blueprints/types";
import { isSafeVersion } from "../blueprints/version";
import { scanWorkspace } from "../scanner/scanWorkspace";
import type { HostMessage, ImportSelection, SidebarBlueprint, SidebarState, WebviewMessage } from "../shared/protocol";
import { copyAndFocus, insertIntoAgent } from "./launch";

export class AgentForgeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "agentforge.sidebar";

  private view?: vscode.WebviewView;
  private pendingImport: BundleBlueprint[] | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store = new BlueprintStore(),
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const { webview } = webviewView;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };

    const messages = webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.onMessage(message);
    });
    webview.html = this.getHtml(webview);

    webviewView.onDidDispose(() => {
      messages.dispose();
      this.view = undefined;
    });
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    try {
      await this.post(await this.loadState());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load AgentForge";
      await this.post({
        type: "state",
        blueprints: [],
        errors: [{ filePath: "", message }],
        context: null,
      });
    }
  }

  async compileFromPalette(): Promise<void> {
    let state: SidebarState;
    try {
      state = await this.loadState();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load blueprints";
      void vscode.window.showErrorMessage(message);
      return;
    }
    if (state.blueprints.length === 0) {
      void vscode.window.showInformationMessage("No blueprints to compile.");
      return;
    }

    const ordered = [...state.blueprints].sort((left, right) => {
      const favorite = Number(Boolean(right.blueprint.favorite)) - Number(Boolean(left.blueprint.favorite));
      if (favorite !== 0) {
        return favorite;
      }
      return left.blueprint.title.localeCompare(right.blueprint.title);
    });
    const picked = await vscode.window.showQuickPick(
      ordered.map((entry) => ({
        label: entry.blueprint.favorite ? `$(star-full) ${entry.blueprint.title}` : entry.blueprint.title,
        description: `v${entry.blueprint.version}`,
        entry,
      })),
      { placeHolder: "Compile a blueprint" },
    );
    if (!picked) {
      return;
    }
    await copyAndFocus(compilePrompt(picked.entry.blueprint.body, picked.entry.values));
  }

  private async onMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message?.type) {
        case "ready":
          await this.refresh();
          return;
        case "compile":
          await this.compile(message.id, message.values, message.mode);
          return;
        case "toggleFavorite":
          await this.toggleFavorite(message.id);
          return;
        case "save":
          await this.save(message.blueprint, message.note);
          return;
        case "create":
          await this.create(message.blueprint, message.note);
          return;
        case "diff":
          await this.showDiff(message.id, message.version);
          return;
        case "rollback":
          await this.rollback(message.id, message.version);
          return;
        case "export":
          await this.exportSet(message.ids);
          return;
        case "importPick":
          await this.pickImport();
          return;
        case "importApply":
          await this.applyImport(message.items);
          return;
        case "importCancel":
          this.pendingImport = null;
          return;
        default:
          return;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "AgentForge could not complete that action.";
      await this.notice(text);
    }
  }

  private async compile(id: string, values: Record<string, string>, mode?: "copy" | "insert"): Promise<void> {
    if (!isStringRecord(values)) {
      await this.notice("Compiled values must be text.");
      return;
    }
    const result = await this.store.read(id);
    if (!result.ok) {
      await this.notice(result.error.message);
      return;
    }
    const compiled = compilePrompt(result.blueprint.body, values);
    if (mode === "insert") {
      await insertIntoAgent(compiled);
      return;
    }
    await copyAndFocus(compiled);
  }

  private async toggleFavorite(id: string): Promise<void> {
    const result = await this.store.read(id);
    if (!result.ok) {
      await this.notice(result.error.message);
      return;
    }
    const next: Blueprint = { ...result.blueprint };
    if (next.favorite) {
      delete next.favorite;
    } else {
      next.favorite = true;
    }
    await this.store.save(next);
    await this.refresh();
  }

  private async save(blueprint: Blueprint, note: string): Promise<void> {
    const existing = await this.store.read(blueprint.id);
    if (!existing.ok) {
      await this.notice(existing.error.message);
      return;
    }
    if (!Array.isArray(blueprint.tags) || !Array.isArray(blueprint.variables)) {
      await this.notice("The blueprint edit was incomplete.");
      return;
    }
    const problem = validateSave(blueprint, note, existing.blueprint.version);
    if (problem) {
      await this.notice(problem);
      return;
    }

    const versionChanged = blueprint.version.trim() !== existing.blueprint.version;
    const next: Blueprint = {
      ...existing.blueprint,
      title: blueprint.title.trim(),
      version: blueprint.version.trim(),
      tags: blueprint.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
      variables: cleanVariables(blueprint.variables),
      body: blueprint.body,
      changelog: versionChanged
        ? [{ version: blueprint.version.trim(), note: note.trim() }, ...existing.blueprint.changelog]
        : existing.blueprint.changelog,
    };
    if (blueprint.favorite) {
      next.favorite = true;
    } else {
      delete next.favorite;
    }

    await this.store.save(next);
    await this.post({ type: "saved" });
    await this.refresh();
  }

  private async create(blueprint: Blueprint, note: string): Promise<void> {
    const id = blueprint.id.trim();
    if (!isBlueprintId(id)) {
      await this.notice("Blueprint id must start with a letter or number and use only letters, numbers, and hyphens.");
      return;
    }
    const existing = await this.store.read(id);
    if (existing.ok || !existing.error.message.startsWith("Blueprint not found:")) {
      await this.notice(`A blueprint named ${id} already exists.`);
      return;
    }
    if (!Array.isArray(blueprint.tags) || !Array.isArray(blueprint.variables)) {
      await this.notice("The blueprint edit was incomplete.");
      return;
    }
    const problem = validateCreate(blueprint, note);
    if (problem) {
      await this.notice(problem);
      return;
    }

    const version = blueprint.version.trim();
    const next: Blueprint = {
      id,
      title: blueprint.title.trim(),
      version,
      tags: blueprint.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
      variables: cleanVariables(blueprint.variables),
      changelog: [{ version, note: note.trim() }],
      body: blueprint.body,
      filePath: "",
    };
    await this.store.save(next);
    await this.post({ type: "saved", id });
    await this.refresh();
  }

  private async exportSet(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      await this.notice("Choose blueprints to export.");
      return;
    }
    const { blueprints } = await this.store.list();
    const byId = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));
    const seen = new Set<string>();
    const selected: BundleBlueprint[] = [];
    for (const id of ids) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const found = byId.get(id);
      if (found) {
        selected.push(found);
      }
    }
    if (selected.length === 0) {
      await this.notice("Nothing to export.");
      return;
    }

    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = folder
      ? vscode.Uri.joinPath(folder, "agentforge-blueprints.json")
      : vscode.Uri.file(path.join(os.homedir(), "agentforge-blueprints.json"));
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { "AgentForge blueprints": ["json"] },
      saveLabel: "Export",
    });
    if (!target) {
      return;
    }
    await writeFile(target.fsPath, serializeBundle(selected), "utf8");
    await this.notice(countLabel("Exported", selected.length));
  }

  private async pickImport(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { "AgentForge blueprints": ["json"] },
      openLabel: "Import",
      title: "Import blueprint set",
    });
    if (!picked || picked.length === 0) {
      return;
    }
    const parsed = parseBundle(await readFile(picked[0].fsPath, "utf8"));
    if (!parsed.ok) {
      await this.notice(parsed.message);
      return;
    }
    if (parsed.blueprints.length === 0) {
      await this.notice("The share file has no blueprints.");
      return;
    }
    const { blueprints } = await this.store.list();
    this.pendingImport = parsed.blueprints;
    await this.post({ type: "importPreview", items: classifyImports(parsed.blueprints, blueprints) });
  }

  private async applyImport(items: ImportSelection[]): Promise<void> {
    const pending = this.pendingImport;
    if (!pending) {
      await this.notice("Import that set again.");
      return;
    }
    if (!isImportSelection(items)) {
      await this.notice("The import selection was incomplete.");
      return;
    }
    if (items.length === 0) {
      await this.notice("Choose at least one blueprint to add.");
      return;
    }

    const bySource = new Map(pending.map((blueprint) => [blueprint.id, blueprint]));
    const { blueprints } = await this.store.list();
    const existing = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));
    const seenSources = new Set<string>();
    const chosenIds = new Set<string>();
    const writes: Blueprint[] = [];

    for (const item of items) {
      const source = bySource.get(item.sourceId);
      if (!source) {
        await this.notice("That blueprint is no longer in the import.");
        return;
      }
      if (seenSources.has(item.sourceId)) {
        await this.notice(`${item.sourceId} is used more than once in this import.`);
        return;
      }
      seenSources.add(item.sourceId);
      const current = existing.get(source.id);
      if (current && sameBlueprint(source, current)) {
        continue;
      }
      const id = item.id.trim();
      if (!isBlueprintId(id)) {
        await this.notice(`${id || "(empty)"} is not a valid blueprint id.`);
        return;
      }
      if (chosenIds.has(id)) {
        await this.notice(`${id} is used more than once in this import.`);
        return;
      }
      const occupied = await this.store.read(id);
      if (occupied.ok || !occupied.error.message.startsWith("Blueprint not found:")) {
        await this.notice(`${id} is already in your library.`);
        return;
      }
      chosenIds.add(id);
      writes.push({
        id,
        title: source.title,
        version: source.version,
        tags: [...source.tags],
        variables: source.variables.map((variable) => ({ ...variable })),
        changelog: source.changelog.map((entry) => ({ ...entry })),
        body: source.body,
        filePath: "",
      });
    }

    for (const blueprint of writes) {
      await this.store.insert(blueprint);
    }
    this.pendingImport = null;
    await this.refresh();
    await this.notice(countLabel("Added", writes.length));
  }

  private async showDiff(id: string, version: string): Promise<void> {
    const current = await this.store.read(id);
    if (!current.ok) {
      await this.notice(current.error.message);
      return;
    }
    const history = await this.store.readHistory(id, version);
    if (!history.ok) {
      await this.notice(history.error.message);
      return;
    }
    await vscode.commands.executeCommand(
      "vscode.diff",
      vscode.Uri.file(history.blueprint.filePath),
      vscode.Uri.file(current.blueprint.filePath),
      `${current.blueprint.title} v${version} ↔ v${current.blueprint.version}`,
    );
  }

  private async rollback(id: string, version: string): Promise<void> {
    const result = await this.store.rollback(id, version);
    if (!result.ok) {
      await this.notice(result.error.message);
      return;
    }
    await this.post({ type: "saved" });
    await this.refresh();
  }

  private async loadState(): Promise<SidebarState> {
    const bundledDir = path.join(this.extensionUri.fsPath, "blueprints");
    await this.store.ensureStore(bundledDir);
    const { blueprints, errors } = await this.store.list();
    const folder = vscode.workspace.workspaceFolders?.[0];
    const context = folder ? await scanWorkspace(folder.uri.fsPath) : null;
    const sidebarBlueprints: SidebarBlueprint[] = [];
    for (const blueprint of blueprints) {
      const history = await this.store.listHistory(blueprint.id);
      sidebarBlueprints.push({
        blueprint,
        values: await resolveVariables(blueprint.variables, context),
        history: history.map((snapshot) => ({
          version: snapshot.version,
          note: snapshot.changelog.find((entry) => entry.version === snapshot.version)?.note ?? "",
        })),
      });
    }
    return { type: "state", blueprints: sidebarBlueprints, errors, context };
  }

  private async notice(message: string): Promise<void> {
    await this.post({ type: "notice", message });
  }

  private async post(message: HostMessage): Promise<void> {
    await this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.css"));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>AgentForge</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function validateSave(blueprint: Blueprint, note: string, currentVersion: string): string | undefined {
  if (!blueprint.title.trim()) {
    return "Title is required.";
  }
  const version = blueprint.version.trim();
  if (!version) {
    return "Version is required.";
  }
  if (!isSafeVersion(version)) {
    return "Version contains unsupported characters.";
  }
  if (version !== currentVersion && !note.trim()) {
    return "An evolution note is required when the version changes.";
  }
  return validateVariables(blueprint.variables);
}

function validateCreate(blueprint: Blueprint, note: string): string | undefined {
  if (!blueprint.title.trim()) {
    return "Title is required.";
  }
  const version = blueprint.version.trim();
  if (!version) {
    return "Version is required.";
  }
  if (!isSafeVersion(version)) {
    return "Version contains unsupported characters.";
  }
  if (!note.trim()) {
    return "An evolution note is required.";
  }
  return validateVariables(blueprint.variables);
}

function validateVariables(variables: BlueprintVariable[]): string | undefined {
  const names = new Set<string>();
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      return `Invalid variable name: ${name || "(empty)"}`;
    }
    if (names.has(name)) {
      return `Duplicate variable name: ${name}`;
    }
    names.add(name);
    if (!variable.source.trim()) {
      return `Variable ${name} is missing a source.`;
    }
  }
  return undefined;
}

function cleanVariables(variables: BlueprintVariable[]): BlueprintVariable[] {
  return variables.map((variable) => {
    const next: BlueprintVariable = {
      name: variable.name.trim(),
      source: variable.source.trim(),
    };
    const fallback = variable.fallback?.trim();
    const defaultValue = variable.default?.trim();
    if (fallback) {
      next.fallback = fallback;
    }
    if (defaultValue) {
      next.default = defaultValue;
    }
    return next;
  });
}

function countLabel(verb: "Exported" | "Added", count: number): string {
  return `${verb} ${count} blueprint${count === 1 ? "" : "s"}.`;
}

function isImportSelection(value: unknown): value is ImportSelection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        typeof (item as { sourceId?: unknown }).sourceId === "string" &&
        typeof (item as { id?: unknown }).id === "string",
    )
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === "string");
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
