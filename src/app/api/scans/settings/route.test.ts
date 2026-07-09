import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  readScanSettings: vi.fn(),
  setBaselineScan: vi.fn(),
  clearBaselineScan: vi.fn(),
  setRuleEnabled: vi.fn(),
  suppressFinding: vi.fn(),
  unsuppressFinding: vi.fn(),
  readScanHistory: vi.fn()
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  repositoryKey: (repository: { owner: string; name: string }) => `${repository.owner}/${repository.name}`,
  setBaselineScan: mocks.setBaselineScan,
  clearBaselineScan: mocks.clearBaselineScan,
  setRuleEnabled: mocks.setRuleEnabled,
  suppressFinding: mocks.suppressFinding,
  unsuppressFinding: mocks.unsuppressFinding
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory
}));

describe("/api/scans/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAN_ADMIN_TOKEN;
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
    mocks.readScanHistory.mockResolvedValue([
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: {
          id: "scan_1",
          repository: {
            owner: "example",
            name: "repo",
            url: "https://github.com/example/repo",
            defaultBranch: "main"
          },
          summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          warnings: [],
          findings: []
        }
      }
    ]);
  });

  it("returns scan settings", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({ baselines: [], suppressions: [], rules: [] });
  });

  it("updates a baseline", async () => {
    mocks.setBaselineScan.mockResolvedValue({
      baselines: [{ repositoryKey: "example/repo", scanId: "scan_1", updatedAt: "now" }],
      suppressions: [],
      rules: []
    });

    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "setBaseline", repositoryKey: "example/repo", scanId: "scan_1" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings.baselines[0].scanId).toBe("scan_1");
    expect(mocks.setBaselineScan).toHaveBeenCalledWith("example/repo", "scan_1");
  });

  it("requires an admin bearer token before updating settings when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "setRuleEnabled", ruleId: "secret.exposed-token", enabled: false })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Admin token is required.");
    expect(mocks.setRuleEnabled).not.toHaveBeenCalled();
  });

  it("accepts the configured admin bearer token before updating settings", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";
    mocks.setRuleEnabled.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [{ ruleId: "secret.exposed-token", enabled: false, updatedAt: "now" }]
    });

    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        headers: { Authorization: "Bearer admin-token" },
        body: JSON.stringify({ action: "setRuleEnabled", ruleId: "secret.exposed-token", enabled: false })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.setRuleEnabled).toHaveBeenCalledWith("secret.exposed-token", false);
  });

  it("rejects a baseline scan from another repository", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "setBaseline", repositoryKey: "other/repo", scanId: "scan_1" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Baseline scan does not belong to this repository.");
    expect(mocks.setBaselineScan).not.toHaveBeenCalled();
  });

  it("updates a rule setting", async () => {
    mocks.setRuleEnabled.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [{ ruleId: "secret.exposed-token", enabled: false, updatedAt: "now" }]
    });

    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "setRuleEnabled", ruleId: "secret.exposed-token", enabled: false })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.setRuleEnabled).toHaveBeenCalledWith("secret.exposed-token", false);
  });

  it("suppresses and unsuppresses findings", async () => {
    mocks.suppressFinding.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
    mocks.unsuppressFinding.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });

    await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({
          action: "suppressFinding",
          repositoryKey: "example/repo",
          fingerprint: "fp",
          reason: "false positive"
        })
      })
    );
    await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "unsuppressFinding", repositoryKey: "example/repo", fingerprint: "fp" })
      })
    );

    expect(mocks.suppressFinding).toHaveBeenCalledWith({
      repositoryKey: "example/repo",
      fingerprint: "fp",
      reason: "false positive"
    });
    expect(mocks.unsuppressFinding).toHaveBeenCalledWith("example/repo", "fp");
  });
});
