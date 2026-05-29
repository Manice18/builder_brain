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

export type ChatPipelineResult = {
  answer: string;
  intent: BuilderBrainIntent;
  confidence: string;
  sql?: string;
  rowCount: number;
  rows: unknown[];
  projectPriorities?: unknown[];
  usedLlm: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "complete" | "error" | "cancelled";
  meta?: {
    intent?: BuilderBrainIntent;
    confidence?: string;
    rowCount?: number;
    usedLlm?: boolean;
  };
};

export type StreamPhase = "classifying" | "querying" | "summarizing" | "complete";

export type SourceStatus = {
  schema: string;
  configured: boolean;
  inputs?: Array<{ key: string; is_set: boolean }>;
};
