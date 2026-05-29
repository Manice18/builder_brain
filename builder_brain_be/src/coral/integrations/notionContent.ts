/** Parse Notion `rich_text` JSON from Coral `notion.block_children`. */
export function plainTextFromRichText(richText: unknown): string {
  if (richText == null) return "";

  let parsed: unknown = richText;
  if (typeof richText === "string") {
    const trimmed = richText.trim();
    if (!trimmed) return "";
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return richText;
    }
  }

  if (!Array.isArray(parsed)) return "";

  return parsed
    .map((item) => {
      if (typeof item !== "object" || item === null) return "";
      const o = item as Record<string, unknown>;
      if (typeof o.plain_text === "string") return o.plain_text;
      const text = o.text;
      if (typeof text === "object" && text !== null && "content" in text) {
        return String((text as { content?: string }).content ?? "");
      }
      return "";
    })
    .join("");
}

export function blocksToPlainContent(
  blocks: Array<{ type?: string; text: string }>,
): string {
  return blocks
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n");
}
