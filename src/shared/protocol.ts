import type { Blueprint, BlueprintParseError, ChangelogEntry } from "../blueprints/types";
import type { WorkspaceContext } from "../scanner/types";

export interface HistoryEntry {
  version: string;
  note: string;
}

export interface SidebarBlueprint {
  blueprint: Blueprint;
  values: Record<string, string>;
  history: HistoryEntry[];
}

export interface SidebarState {
  type: "state";
  blueprints: SidebarBlueprint[];
  errors: BlueprintParseError[];
  context: WorkspaceContext | null;
}

export interface ReadyMessage {
  type: "ready";
}

export interface CompileMessage {
  type: "compile";
  id: string;
  values: Record<string, string>;
  mode?: "copy" | "insert";
}

export interface ToggleFavoriteMessage {
  type: "toggleFavorite";
  id: string;
}

export interface SaveMessage {
  type: "save";
  blueprint: Blueprint;
  note: string;
}

export interface CreateMessage {
  type: "create";
  blueprint: Blueprint;
  note: string;
}

export interface DiffMessage {
  type: "diff";
  id: string;
  version: string;
}

export interface RollbackMessage {
  type: "rollback";
  id: string;
  version: string;
}

export interface ExportMessage {
  type: "export";
  ids: string[];
}

export interface ImportPickMessage {
  type: "importPick";
}

export interface ImportSelection {
  sourceId: string;
  id: string;
}

export interface ImportApplyMessage {
  type: "importApply";
  items: ImportSelection[];
}

export interface ImportCancelMessage {
  type: "importCancel";
}

export type WebviewMessage =
  | ReadyMessage
  | CompileMessage
  | ToggleFavoriteMessage
  | SaveMessage
  | CreateMessage
  | DiffMessage
  | RollbackMessage
  | ExportMessage
  | ImportPickMessage
  | ImportApplyMessage
  | ImportCancelMessage;

export interface NoticeMessage {
  type: "notice";
  message: string;
}

export interface SavedMessage {
  type: "saved";
  id?: string;
}

export interface ImportPreviewItem {
  id: string;
  title: string;
  version: string;
  tags: string[];
  status: "new" | "duplicate" | "conflict";
  suggestedId: string;
}

export interface ImportPreviewMessage {
  type: "importPreview";
  items: ImportPreviewItem[];
}

export interface ImportedMessage {
  type: "imported";
}

export type HostMessage = SidebarState | NoticeMessage | SavedMessage | ImportPreviewMessage | ImportedMessage;
