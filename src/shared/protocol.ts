import type { BlueprintParseError, BlueprintSummary } from "../blueprints/types";
import type { WorkspaceContext } from "../scanner/types";

export interface SidebarState {
  type: "state";
  blueprints: BlueprintSummary[];
  errors: BlueprintParseError[];
  context: WorkspaceContext | null;
}

export interface ReadyMessage {
  type: "ready";
}
