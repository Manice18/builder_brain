/** Supported read paths — GitHub + Notion only (v1). */
export type BuilderBrainIntent =
  | "project_overview"
  | "abandoned_projects"
  | "repo_issues"
  | "repo_activity"
  | "notion_search"
  | "notion_page_content"
  | "sources_status"
  | "general"
  | "mcp_action"
  | "unknown";

export type ClassifiedIntent = {
  intent: BuilderBrainIntent;
  confidence: "high" | "medium" | "low";
};
