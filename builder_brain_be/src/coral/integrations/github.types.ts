export type GithubConnectionStatus = {
  schema: "github";
  configured: boolean;
  inputs: Array<{ key: string; is_set: boolean }>;
};

export type GithubRepo = {
  name: string;
  full_name?: string;
  owner?: string;
  owner_type?: "User" | "Organization";
  description?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  private?: boolean;
  archived?: boolean;
  fork?: boolean;
  permissions_admin?: boolean;
  permissions_push?: boolean;
};

export type GithubCommit = {
  sha?: string;
  message?: string;
  author_date?: string;
  author_login?: string;
};

export type GithubIssue = {
  title?: string;
  html_url?: string;
  state?: string;
  number?: number;
  repository_url?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  comments?: number;
  labels?: unknown;
  assignee_login?: string;
};

export type RepoIssuesContext = {
  owner: string;
  repo: string;
  full_name: string;
  html_url?: string;
  state_filter: "open" | "closed" | "all";
  open_issues: GithubIssue[];
  notion_pages?: Array<{
    id: string;
    url?: string;
    title?: string;
    last_edited_time?: string;
  }>;
};
