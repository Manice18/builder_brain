const NOTION_PAGE_ID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export function extractNotionPageId(message: string): string | null {
  const match = message.match(NOTION_PAGE_ID_RE);
  return match?.[0] ?? null;
}
