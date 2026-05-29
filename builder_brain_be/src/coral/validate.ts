import { ApiError } from "../errors/errors.js";

export function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  const head = upper.split(/\s+/)[0] ?? "";

  if (head !== "SELECT" && head !== "WITH") {
    throw new ApiError("Only SELECT or WITH queries are allowed", 400);
  }
  if (trimmed.includes(";")) {
    throw new ApiError("Multi-statement queries are not allowed", 400);
  }
}

export function ensureLimit(sql: string, fallbackLimit = 100): string {
  return /\bLIMIT\b/i.test(sql) ? sql : `${sql}\nLIMIT ${fallbackLimit}`;
}
