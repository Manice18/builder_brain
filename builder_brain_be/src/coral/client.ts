import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ApiError } from "../errors/errors";
import { assertReadOnlySql, ensureLimit } from "./validate";

const execFileAsync = promisify(execFile);

export type CoralResult = {
  rows: unknown[];
};

/**
 * Coral CLI `--format json` returns a bare row array.
 * MCP `sql` may return `{ rows: [...] }`. Accept both.
 */
export function parseCoralJson(stdout: string): CoralResult {
  const parsed: unknown = JSON.parse(stdout);

  if (Array.isArray(parsed)) {
    return { rows: parsed };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "rows" in parsed &&
    Array.isArray((parsed as CoralResult).rows)
  ) {
    return { rows: (parsed as CoralResult).rows };
  }

  return { rows: [] };
}

export class CoralClient {
  constructor(
    private readonly coralBin: string,
    private readonly timeoutMs = 60_000,
  ) {}

  async sql(query: string): Promise<CoralResult> {
    assertReadOnlySql(query);
    const safeQuery = ensureLimit(query, 100);

    try {
      const { stdout } = await execFileAsync(
        this.coralBin,
        ["sql", "--format", "json", safeQuery],
        {
          env: process.env,
          timeout: this.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      return parseCoralJson(stdout);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Coral error";
      throw new ApiError(`Coral query failed: ${message}`, 502);
    }
  }
}
