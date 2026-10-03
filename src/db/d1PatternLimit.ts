// D1 refuses a LIKE or GLOB pattern longer than 50 bytes with "LIKE or GLOB
// pattern too complex". node:sqlite has no such limit, and a CHECK runs only
// when a row is written, so an overlong pattern passes CREATE TABLE and every
// unit test, then fails D1's first insert (#167, #489).

/** The longest LIKE or GLOB pattern D1 runs, in bytes. */
export const D1_PATTERN_LIMIT = 50;

/** A LIKE or GLOB string literal in SQL text, as SQLite reads it. */
export interface SqlPattern {
  readonly operator: "GLOB" | "LIKE";
  readonly pattern: string;
  readonly bytes: number;
}

/** Every `GLOB '...'` and `LIKE '...'` literal in `sql`, `NOT GLOB` and `NOT LIKE` included. */
export function sqlPatterns(sql: string): SqlPattern[] {
  return [...sql.matchAll(/\b(GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map(([, operator, quoted]) => {
    const pattern = quoted.replaceAll("''", "'");
    return { operator: operator.toUpperCase() as SqlPattern["operator"], pattern, bytes: Buffer.byteLength(pattern, "utf8") };
  });
}

/** The patterns in `sql` that D1 would refuse. */
export function overlongPatterns(sql: string): SqlPattern[] {
  return sqlPatterns(sql).filter(({ bytes }) => bytes > D1_PATTERN_LIMIT);
}
