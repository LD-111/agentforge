import * as vscode from "vscode";
import path from "node:path";
import { BlueprintStore } from "../blueprints/store";
import { toSummary } from "../blueprints/types";
import { scanWorkspace } from "../scanner/scanWorkspace";
import type { SidebarState } from "../shared/protocol";

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

    const messages = webview.onDidReceiveMessage((message: { type?: string }) => {
      if (message?.type === "ready") {
        void this.refresh();
      }
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
      const bundledDir = path.join(this.extensionUri.fsPath, "blueprints");
      await this.store.ensureStore(bundledDir);
      const { blueprints, errors } = await this.store.list();
      const folder = vscode.workspace.workspaceFolders?.[0];
      const context = folder ? await scanWorkspace(folder.uri.fsPath) : null;
      const state: SidebarState = {
        type: "state",
        blueprints: blueprints.map(toSummary),
        errors,
        context,
      };
      await this.view.webview.postMessage(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load AgentForge";
      const state: SidebarState = {
        type: "state",
        blueprints: [],
        errors: [{ filePath: "", message }],
        context: null,
      };
      await this.view.webview.postMessage(state);
    }
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

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
