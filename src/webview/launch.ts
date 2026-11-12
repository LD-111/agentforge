import * as vscode from "vscode";

const COMPOSER_COMMANDS = ["composerMode.agent", "aichat.newchataction"];

export async function copyAndFocus(compiled: string): Promise<void> {
  await vscode.env.clipboard.writeText(compiled);
  for (const command of COMPOSER_COMMANDS) {
    try {
      await vscode.commands.executeCommand(command);
      void vscode.window.setStatusBarMessage("AgentForge copied the prompt", 4000);
      return;
    } catch {
      // These commands exist in Cursor and are absent in VS Code.
    }
  }
  void vscode.window.showInformationMessage("Prompt copied. Press Ctrl+I to open the agent input, then paste.");
}
