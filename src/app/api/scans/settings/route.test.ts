import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  readScanSettings: vi.fn(),
  setRuleEnabled: vi.fn(),
  suppressFinding: vi.fn(),
  unsuppressFinding: vi.fn()
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  repositoryKey: (repository: { owner: string; name: string }) => `${repository.owner}/${repository.name}`,
  setRuleEnabled: mocks.setRuleEnabled,
  suppressFinding: mocks.suppressFinding,
  unsuppressFinding: mocks.unsuppressFinding
}));

describe("/api/scans/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAN_ADMIN_TOKEN;
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
  });

  it("returns scan settings", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({ suppressions: [], rules: [] });
    expect(body.settings.baselines).toBeUndefined();
  });

  it.each([
    { action: "setBaseline", repositoryKey: "example/repo", scanId: "scan_1" },
    { action: "clearBaseline", repositoryKey: "example/repo" }
  ])("rejects the removed $action action", async (body) => {
    const response = await PATCH(
      new Request("http://localhost/api/scans/settings", {
        method: "PATCH",
        body: JSON.stringify(body)
      })
    );

    expect(response.status).toBe(400);
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
    const body = await response.json();
    expect(body.settings.baselines).toBeUndefined();
    expect(mocks.setRuleEnabled).toHaveBeenCalledWith("secret.exposed-token", false);
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
