import * as vscode from "vscode";
import { AgentForgeViewProvider } from "./webview/AgentForgeViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new AgentForgeViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentForgeViewProvider.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("agentforge.refresh", () => provider.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void provider.refresh();
    }),
  );
}

export function deactivate(): void {}
