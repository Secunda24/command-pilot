import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let envLoaded = false;

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(contents: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = stripWrappingQuotes(rawValue).replace(/\\n/g, "\n");

    if (key) {
      entries[key] = normalizedValue;
    }
  }

  return entries;
}

export function loadCommandPilotEnv(): void {
  if (envLoaded) {
    return;
  }

  const runtimeDirectory = dirname(fileURLToPath(import.meta.url));
  const serviceRoot = resolve(runtimeDirectory, "../..");
  const repoRoot = resolve(runtimeDirectory, "../../../../");
  const candidateFiles = [
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
    resolve(serviceRoot, ".env.local"),
    resolve(serviceRoot, ".env")
  ];

  for (const filePath of candidateFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const fileEntries = parseEnvFile(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(fileEntries)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  envLoaded = true;
}
