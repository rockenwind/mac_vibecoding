import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const queryMock = vi.fn();
const endMock = vi.fn();

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({
    query: queryMock,
    end: endMock
  }))
}));

describe("GET /api/market-signals", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    queryMock.mockReset();
    endMock.mockReset();
  });

  it("returns ranked signals from recent jobs", async () => {
    vi.stubEnv("VIBECODING_DATABASE_URL", "postgresql+psycopg://user:pass@example.test/neondb");
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          company: "테스트클라우드",
          title: "클라우드 보안 엔지니어",
          description: "AWS IAM과 API 보안 운영",
          matched_keywords: ["클라우드 보안"],
          first_seen_at: new Date("2026-06-30T00:00:00Z")
        }
      ]
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sampleSize).toBe(1);
    expect(body.signals[0]).toMatchObject({
      area: "클라우드 권한과 비밀값 노출",
      jobCount: 1,
      template: {
        purpose: "클라우드 권한과 비밀값 노출 위험을 빠르게 확인합니다."
      }
    });
    expect(queryMock.mock.calls[0][0]).toContain("company");
    expect(queryMock.mock.calls[0][0]).toContain("first_seen_at");
    expect(endMock).toHaveBeenCalledOnce();
  });

  it("returns an empty report when the database URL is not configured", async () => {
    vi.stubEnv("MARKET_SIGNALS_DISABLE_ENV_FILE", "1");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sampleSize).toBe(0);
    expect(body.signals).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
