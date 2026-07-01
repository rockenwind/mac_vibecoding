import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function normalizePostgresUrl(value: string): string {
  return value.replace(/^postgresql\+psycopg:\/\//, "postgresql://");
}

export function parseEnvFileContent(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...valueParts] = line.split("=");
        return [key, unwrapEnvValue(valueParts.join("="))];
      })
  );
}

export function getMarketSignalsDatabaseUrl(): string | null {
  const configured =
    process.env.VIBECODING_DATABASE_URL ??
    process.env.DATABASE_URL ??
    (process.env.MARKET_SIGNALS_DISABLE_ENV_FILE === "1" ? null : readVibecodingEnvDatabaseUrl());
  return configured ? normalizePostgresUrl(configured) : null;
}

function readVibecodingEnvDatabaseUrl(): string | null {
  const envPath = join(process.cwd(), "apps", "vibecoding", ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }

  return parseEnvFileContent(readFileSync(envPath, "utf8")).DATABASE_URL ?? null;
}

function unwrapEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
