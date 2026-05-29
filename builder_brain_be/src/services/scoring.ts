import type { ProjectMemoryRow } from "./projectMemory.types.js";

export type ProjectPriority = {
  project: string;
  score: number;
  signals: string[];
};

/**
 * Deterministic priority from GitHub + Notion signals (not LLM).
 */
export function scoreProjectPriorities(
  projects: ProjectMemoryRow[],
): ProjectPriority[] {
  return projects
    .map((p) => {
      const signals: string[] = [];
      let score = 0;

      if (!p.is_stale) {
        score += 0.5;
        signals.push("recent code activity");
      } else {
        score += 0.15;
        signals.push(`${p.stale_days ?? "?"}d since last commit`);
      }

      if (p.notion_pages.length > 0) {
        score += 0.25 + Math.min(p.notion_pages.length * 0.05, 0.2);
        signals.push(`${p.notion_pages.length} linked Notion page(s)`);
      }

      const recentNotion = p.notion_pages[0]?.last_edited_time;
      if (recentNotion) {
        const days = Math.floor(
          (Date.now() - Date.parse(recentNotion)) / (1000 * 60 * 60 * 24),
        );
        if (days <= 7) {
          score += 0.2;
          signals.push("Notion edited this week");
        }
      }

      return { project: p.repo_name, score, signals };
    })
    .sort((a, b) => b.score - a.score);
}
