import { sqlLiteral } from "../sql.js";

export const notionQueries = {
  connectionStatus: () => `
    SELECT key, is_set
    FROM coral.inputs
    WHERE schema_name = 'notion'
  `,

  /** Provider-ranked search (preferred for discovery). */
  searchObjects: (query: string, object?: "page" | "data_source") => {
    const args = [`query => ${sqlLiteral(query)}`];
    if (object) {
      args.push(`object => ${sqlLiteral(object)}`);
    }
    return `
      SELECT
        object,
        id,
        url,
        created_time,
        last_edited_time,
        in_trash,
        properties
      FROM notion.search_objects(${args.join(", ")})
      LIMIT 50
    `;
  },

  /** Compatibility search table — optional title filter via virtual column. */
  search: (query?: string, objectFilter?: "page" | "data_source") => {
    const filters: string[] = [];
    if (query) {
      filters.push(`query = ${sqlLiteral(query)}`);
    }
    if (objectFilter) {
      filters.push(`object_filter = ${sqlLiteral(objectFilter)}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    return `
      SELECT
        object,
        id,
        url,
        created_time,
        last_edited_time,
        in_trash,
        properties
      FROM notion.search
      ${where}
      LIMIT 50
    `;
  },

  page: (pageId: string) => `
    SELECT
      id,
      object,
      url,
      created_time,
      last_edited_time,
      in_trash,
      properties,
      parent
    FROM notion.pages
    WHERE page_id = ${sqlLiteral(pageId)}
    LIMIT 1
  `,

  dataSourcePages: (dataSourceId: string) => `
    SELECT
      id,
      url,
      created_time,
      last_edited_time,
      in_trash,
      properties
    FROM notion.data_source_pages
    WHERE data_source_id = ${sqlLiteral(dataSourceId)}
    LIMIT 100
  `,

  dataSource: (dataSourceId: string) => `
    SELECT id, name, properties, created_time, last_edited_time
    FROM notion.data_sources
    WHERE data_source_id = ${sqlLiteral(dataSourceId)}
    LIMIT 1
  `,

  /** All pages/data sources visible to the integration. */
  listVisible: (limit = 20) => `
    SELECT object, id, url, last_edited_time, properties
    FROM notion.search
    LIMIT ${Math.min(limit, 100)}
  `,

  /** Page body blocks — `block_id` can be a page ID (Notion API). */
  blockChildren: (blockId: string, limit = 500) => `
    SELECT
      id,
      type,
      has_children,
      rich_text,
      created_time,
      last_edited_time
    FROM notion.block_children
    WHERE block_id = ${sqlLiteral(blockId)}
    LIMIT ${Math.min(limit, 500)}
  `,
};
