import * as vscode from "vscode";

const COMPOSER_COMMANDS = ["composerMode.agent", "aichat.newchataction"];
const FOCUS_COMPOSER = "composer.focusComposer";
const PASTE_HINT = "Prompt copied. Press Ctrl+I to open the agent input, then paste.";

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
  void vscode.window.showInformationMessage(PASTE_HINT);
}

export async function insertIntoAgent(compiled: string): Promise<void> {
  const previous = await vscode.env.clipboard.readText();
  await vscode.env.clipboard.writeText(compiled);

  const commands = await vscode.commands.getCommands(true);
  if (!commands.includes(FOCUS_COMPOSER)) {
    void vscode.window.showInformationMessage(PASTE_HINT);
    return;
  }

  try {
    await vscode.commands.executeCommand(FOCUS_COMPOSER);
  } catch {
    void vscode.window.showInformationMessage(PASTE_HINT);
    return;
  }

  await delay(150);
  const editor = vscode.window.activeTextEditor;
  const version = editor?.document.version;
  try {
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
  } catch {
    void vscode.window.showInformationMessage(PASTE_HINT);
    return;
  }

  await delay(100);
  if (editor && editor.document.version !== version) {
    await vscode.commands.executeCommand("undo");
    void vscode.window.showInformationMessage(PASTE_HINT);
    return;
  }

  if (previous !== compiled) {
    await vscode.env.clipboard.writeText(previous);
  }
  void vscode.window.setStatusBarMessage("AgentForge placed the prompt in the agent input", 4000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
