import { describe, expect, it } from "vitest";
import { normalizePostgresUrl, parseEnvFileContent } from "./config";

describe("normalizePostgresUrl", () => {
  it("converts SQLAlchemy psycopg URLs to pg-compatible URLs", () => {
    expect(normalizePostgresUrl("postgresql+psycopg://user:pass@example.test/db?sslmode=require")).toBe(
      "postgresql://user:pass@example.test/db?sslmode=require"
    );
  });
});

describe("parseEnvFileContent", () => {
  it("reads single-quoted environment values without expanding secrets", () => {
    expect(
      parseEnvFileContent("DATABASE_URL='postgresql+psycopg://user:pa$ss@example.test/db?sslmode=require'\n")
    ).toEqual({
      DATABASE_URL: "postgresql+psycopg://user:pa$ss@example.test/db?sslmode=require"
    });
  });
});
