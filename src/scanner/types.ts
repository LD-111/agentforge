export interface RuleExcerpt {
  path: string;
  excerpt: string;
}

export interface WorkspaceContext {
  rootPath: string;
  framework: string;
  language: string;
  dependencies: string[];
  folderTree: string;
  existingRules: RuleExcerpt[];
}
