import { describe, expect, it } from "vitest";
import { shouldScanFile } from "./fileFilter";

describe("shouldScanFile", () => {
  it("includes source and AI-related files", () => {
    expect(shouldScanFile({ path: "src/agent.ts", size: 1000 })).toBe(true);
    expect(shouldScanFile({ path: "prompts/system.prompt", size: 1000 })).toBe(true);
    expect(shouldScanFile({ path: "mcp.json", size: 1000 })).toBe(true);
  });

  it("includes environment file variants", () => {
    expect(shouldScanFile({ path: ".env.local", size: 1000 })).toBe(true);
    expect(shouldScanFile({ path: "config/.env.production", size: 1000 })).toBe(true);
  });

  it("excludes generated folders and lockfiles", () => {
    expect(shouldScanFile({ path: "node_modules/pkg/index.js", size: 1000 })).toBe(false);
    expect(shouldScanFile({ path: "package-lock.json", size: 1000 })).toBe(false);
    expect(shouldScanFile({ path: "dist/app.js", size: 1000 })).toBe(false);
  });

  it("excludes large files", () => {
    expect(shouldScanFile({ path: "src/large.ts", size: 205_000 })).toBe(false);
  });
});
