import { describe, expect, it } from "vitest";
import { buildMarketSignals } from "./signals";

describe("buildMarketSignals", () => {
  it("ranks security check areas from recent job keywords", () => {
    const result = buildMarketSignals(
      [
        {
          title: "클라우드 보안 엔지니어",
          description: "AWS IAM과 API 보안 운영 경험",
          matchedKeywords: ["클라우드 보안", "보안"]
        },
        {
          title: "침해대응 CERT 분석가",
          description: "SIEM 탐지와 사고 대응",
          matchedKeywords: ["침해대응", "SIEM"]
        },
        {
          title: "LLM 보안 담당자",
          description: "프롬프트 보안과 도구 실행 권한 점검",
          matchedKeywords: ["AI", "LLM"]
        }
      ],
      new Date("2026-07-01T00:00:00Z")
    );

    expect(result.generatedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(result.sampleSize).toBe(3);
    expect(result.signals.slice(0, 3).map((signal) => signal.area)).toEqual([
      "클라우드 권한과 비밀값 노출",
      "프롬프트 노출, 도구 실행 권한, 모델 연동 보안",
      "로그/탐지 설정과 운영 자동화"
    ]);
    expect(result.signals[0]).toMatchObject({
      keywords: ["클라우드 보안", "AWS", "IAM"],
      score: 3
    });
  });

  it("returns an empty signal list when there are no recent jobs", () => {
    const result = buildMarketSignals([], new Date("2026-07-01T00:00:00Z"));

    expect(result.sampleSize).toBe(0);
    expect(result.signals).toEqual([]);
  });
});
