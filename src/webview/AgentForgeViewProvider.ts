import * as vscode from "vscode";
import path from "node:path";
import { compilePrompt } from "../blueprints/compile";
import { resolveVariables } from "../blueprints/resolve";
import { BlueprintStore } from "../blueprints/store";
import type { Blueprint, BlueprintVariable } from "../blueprints/types";
import { isSafeVersion } from "../blueprints/version";
import { scanWorkspace } from "../scanner/scanWorkspace";
import type { HostMessage, SidebarBlueprint, SidebarState, WebviewMessage } from "../shared/protocol";
import { copyAndFocus } from "./launch";

export class AgentForgeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "agentforge.sidebar";

  private view?: vscode.WebviewView;

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
          await this.compile(message.id, message.values);
          return;
        case "toggleFavorite":
          await this.toggleFavorite(message.id);
          return;
        case "save":
          await this.save(message.blueprint, message.note);
          return;
        case "diff":
          await this.showDiff(message.id, message.version);
          return;
        case "rollback":
          await this.rollback(message.id, message.version);
          return;
        default:
          return;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "AgentForge could not complete that action.";
      await this.notice(text);
    }
  }

  private async compile(id: string, values: Record<string, string>): Promise<void> {
    if (!isStringRecord(values)) {
      await this.notice("Compiled values must be text.");
      return;
    }
    const result = await this.store.read(id);
    if (!result.ok) {
      await this.notice(result.error.message);
      return;
    }
    await copyAndFocus(compilePrompt(result.blueprint.body, values));
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
  const names = new Set<string>();
  for (const variable of blueprint.variables) {
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
