import type { NotionPageLink } from "./githubNotionJoin.js";

export type ProjectMemoryRow = {
  project_slug: string;
  repo_name: string;
  full_name?: string;
  html_url?: string;
  description?: string;
  last_activity?: string;
  last_activity_source?: "commit" | "push";
  pushed_at?: string;
  stale_days?: number;
  is_stale: boolean;
  notion_pages: NotionPageLink[];
  latest_commit_message?: string;
};

export type ProjectMemoryResult = {
  sql: string;
  rows: ProjectMemoryRow[];
  notion_index_size: number;
};
