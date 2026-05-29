/**
 * LLMs often emit markdown tables on a single line (`| a | | b |`).
 * Insert row breaks so remark-gfm can parse them.
 */
export function normalizeMarkdown(content: string): string {
  let out = content.replace(/\|\s+\|/g, "|\n|");

  // react-markdown does not render raw HTML; <br> shows up literally in tables.
  out = out.replace(/<br\s*\/?>\s*•\s*/gi, " · ");
  out = out.replace(/<br\s*\/?>/gi, " · ");

  return out;
}
