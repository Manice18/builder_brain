/** Escape a value for use inside Coral SQL single-quoted strings. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
