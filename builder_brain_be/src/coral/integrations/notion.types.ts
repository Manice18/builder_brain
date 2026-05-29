export type NotionConnectionStatus = {
  schema: "notion";
  configured: boolean;
  inputs: Array<{ key: string; is_set: boolean }>;
};

export type NotionSearchHit = {
  object: "page" | "data_source" | string;
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  in_trash?: boolean;
  properties?: unknown;
};

export type NotionPageSummary = {
  id: string;
  url?: string;
  last_edited_time?: string;
  created_time?: string;
  properties?: unknown;
  object?: string;
};

export type NotionDataSourcePage = {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: unknown;
};

export type NotionBlock = {
  id: string;
  type?: string;
  has_children?: boolean;
  text: string;
  created_time?: string;
  last_edited_time?: string;
};

export type NotionPageContent = {
  page_id: string;
  page?: NotionPageSummary;
  title?: string;
  blocks: NotionBlock[];
  content_plain: string;
  block_count: number;
};
