import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadSqliteSchema(): string {
  const schemaPath = resolve(process.cwd(), "src", "db", "schema.sql");
  return readFileSync(schemaPath, "utf8");
}
