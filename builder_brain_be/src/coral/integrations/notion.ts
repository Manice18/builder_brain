import type { CoralClient } from "../client.js";
import { notionQueries } from "./notion.queries.js";
import {
  blocksToPlainContent,
  plainTextFromRichText,
} from "./notionContent.js";
import type {
  NotionBlock,
  NotionConnectionStatus,
  NotionDataSourcePage,
  NotionPageContent,
  NotionPageSummary,
  NotionSearchHit,
} from "./notion.types.js";

function asRecord(row: unknown): Record<string, unknown> {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : {};
}

function mapSearchHit(row: unknown): NotionSearchHit {
  const r = asRecord(row);
  return {
    object: String(r.object ?? ""),
    id: String(r.id ?? ""),
    url: r.url != null ? String(r.url) : undefined,
    created_time: r.created_time != null ? String(r.created_time) : undefined,
    last_edited_time:
      r.last_edited_time != null ? String(r.last_edited_time) : undefined,
    in_trash: r.in_trash === true,
    properties: r.properties,
  };
}

function mapPage(row: unknown): NotionPageSummary {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    object: r.object != null ? String(r.object) : undefined,
    url: r.url != null ? String(r.url) : undefined,
    created_time: r.created_time != null ? String(r.created_time) : undefined,
    last_edited_time:
      r.last_edited_time != null ? String(r.last_edited_time) : undefined,
    properties: r.properties,
  };
}

function mapDataSourcePage(row: unknown): NotionDataSourcePage {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    url: r.url != null ? String(r.url) : undefined,
    last_edited_time:
      r.last_edited_time != null ? String(r.last_edited_time) : undefined,
    properties: r.properties,
  };
}

/**
 * Notion read integration via Coral SQL.
 * Credentials live in Coral (`coral source add notion`), not in this app.
 */
export class NotionIntegration {
  constructor(private readonly coral: CoralClient) {}

  async getConnectionStatus(): Promise<NotionConnectionStatus> {
    const { rows } = await this.coral.sql(notionQueries.connectionStatus());
    const inputs = (rows ?? []).map((row) => {
      const r = asRecord(row);
      return {
        key: String(r.key ?? ""),
        is_set: r.is_set === true,
      };
    });
    const configured = inputs.some(
      (i) => i.key === "NOTION_API_KEY" && i.is_set,
    );
    return { schema: "notion", configured, inputs };
  }

  async searchObjects(
    query: string,
    object?: "page" | "data_source",
  ): Promise<NotionSearchHit[]> {
    const { rows } = await this.coral.sql(
      notionQueries.searchObjects(query, object),
    );
    return rows.map(mapSearchHit);
  }

  async search(
    query?: string,
    objectFilter?: "page" | "data_source",
  ): Promise<NotionSearchHit[]> {
    const { rows } = await this.coral.sql(
      notionQueries.search(query, objectFilter),
    );
    return rows.map(mapSearchHit);
  }

  async getPage(pageId: string): Promise<NotionPageSummary | null> {
    const { rows } = await this.coral.sql(notionQueries.page(pageId));
    const first = rows[0];
    return first ? mapPage(first) : null;
  }

  async getDataSourcePages(
    dataSourceId: string,
  ): Promise<NotionDataSourcePage[]> {
    const { rows } = await this.coral.sql(
      notionQueries.dataSourcePages(dataSourceId),
    );
    return rows.map(mapDataSourcePage);
  }

  async listVisible(limit = 20): Promise<NotionSearchHit[]> {
    const { rows } = await this.coral.sql(notionQueries.listVisible(limit));
    return rows.map(mapSearchHit);
  }

  async getBlockChildren(
    blockId: string,
    limit = 500,
  ): Promise<NotionBlock[]> {
    const { rows } = await this.coral.sql(
      notionQueries.blockChildren(blockId, limit),
    );
    return (rows ?? []).map((row) => {
      const r = asRecord(row);
      const rich_text = r.rich_text;
      return {
        id: String(r.id ?? ""),
        type: r.type != null ? String(r.type) : undefined,
        has_children: r.has_children === true,
        text: plainTextFromRichText(rich_text),
        created_time:
          r.created_time != null ? String(r.created_time) : undefined,
        last_edited_time:
          r.last_edited_time != null ? String(r.last_edited_time) : undefined,
      };
    });
  }

  /**
   * Page metadata (`notion.pages`) plus body text from `notion.block_children`.
   */
  async getPageContent(pageId: string): Promise<NotionPageContent | null> {
    const page = await this.getPage(pageId);
    if (!page) return null;

    const blocks = await this.getBlockChildren(pageId);
    const hit: NotionSearchHit = {
      object: "page",
      id: page.id,
      url: page.url,
      last_edited_time: page.last_edited_time,
      properties: page.properties,
    };
    const title = inferPageTitle(hit);

    return {
      page_id: pageId,
      page,
      title,
      blocks,
      content_plain: blocksToPlainContent(blocks),
      block_count: blocks.length,
    };
  }
}

function inferPageTitle(hit: NotionSearchHit): string | undefined {
  const props = hit.properties;
  if (!props || typeof props !== "object") return undefined;
  for (const value of Object.values(props as Record<string, unknown>)) {
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.title)) {
        for (const part of record.title) {
          if (
            typeof part === "object" &&
            part !== null &&
            typeof (part as { plain_text?: string }).plain_text === "string"
          ) {
            return (part as { plain_text: string }).plain_text;
          }
        }
      }
    }
  }
  return undefined;
}

export function createNotionIntegration(coral: CoralClient): NotionIntegration {
  return new NotionIntegration(coral);
}
