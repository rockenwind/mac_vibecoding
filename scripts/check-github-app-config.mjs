import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env.local");
const env = { ...process.env, ...readEnvFile(envFile) };
const missing = ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"].filter((key) => !env[key]?.trim());
const errors = [];

if (missing.length) {
  errors.push(`Missing required values: ${missing.join(", ")}`);
}

if (env.GITHUB_APP_ID && !/^\d+$/.test(env.GITHUB_APP_ID.trim())) {
  errors.push("GITHUB_APP_ID must be a numeric GitHub App ID.");
}

const privateKey = env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
if (privateKey && (!privateKey.includes("-----BEGIN") || !privateKey.includes("PRIVATE KEY-----"))) {
  errors.push("GITHUB_APP_PRIVATE_KEY must be a PEM private key. Escaped \\n line breaks are supported.");
}

if (errors.length) {
  console.error("GitHub App configuration is not ready.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("Create .env.local from .env.example and fill in the GitHub App values.");
  process.exit(1);
}

console.log("GitHub App configuration looks ready.");
console.log(`- GITHUB_APP_ID: set`);
console.log(`- GITHUB_APP_PRIVATE_KEY: set`);
console.log(`- GITHUB_APP_CLIENT_ID: ${env.GITHUB_APP_CLIENT_ID?.trim() ? "set" : "not set"}`);

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = unquote(rawValue);
  }

  return values;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
