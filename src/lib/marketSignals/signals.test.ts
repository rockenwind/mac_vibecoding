import { describe, expect, it } from "vitest";
import { buildMarketSignals } from "./signals";

describe("buildMarketSignals", () => {
  it("ranks security check areas from recent job keywords", () => {
    const result = buildMarketSignals(
      [
        {
          company: "테스트클라우드",
          title: "클라우드 보안 엔지니어",
          description: "AWS IAM과 API 보안 운영 경험",
          matchedKeywords: ["클라우드 보안", "보안"],
          firstSeenAt: "2026-06-30T00:00:00Z"
        },
        {
          company: "테스트관제",
          title: "침해대응 CERT 분석가",
          description: "SIEM 탐지와 사고 대응",
          matchedKeywords: ["침해대응", "SIEM"],
          firstSeenAt: "2026-06-29T00:00:00Z"
        },
        {
          company: "테스트AI",
          title: "LLM 보안 담당자",
          description: "프롬프트 보안과 도구 실행 권한 점검",
          matchedKeywords: ["AI", "LLM"],
          firstSeenAt: "2026-06-28T00:00:00Z"
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
      jobCount: 1,
      trend: "최근 공고에서 클라우드 보안, AWS, IAM 수요가 확인됩니다."
    });
    expect(result.signals[0].score).toBeGreaterThan(result.signals[2].score);
    expect(result.signals[0].template.checklist).toContain("권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다.");
  });

  it("returns an empty signal list when there are no recent jobs", () => {
    const result = buildMarketSignals([], new Date("2026-07-01T00:00:00Z"));

    expect(result.sampleSize).toBe(0);
    expect(result.signals).toEqual([]);
  });

  it("weights recent unique-company demand above older duplicate demand", () => {
    const result = buildMarketSignals(
      [
        {
          company: "신규클라우드",
          title: "클라우드 보안 담당자",
          description: "AWS IAM 권한 검토",
          matchedKeywords: ["클라우드 보안"],
          firstSeenAt: "2026-06-30T00:00:00Z"
        },
        {
          company: "중복관제",
          title: "보안관제 담당자",
          description: "SIEM 탐지 운영",
          matchedKeywords: ["SIEM"],
          firstSeenAt: "2026-05-01T00:00:00Z"
        },
        {
          company: "중복관제",
          title: "보안관제 교대 근무자",
          description: "탐지 룰 운영",
          matchedKeywords: ["탐지"],
          firstSeenAt: "2026-05-02T00:00:00Z"
        }
      ],
      new Date("2026-07-01T00:00:00Z")
    );

    expect(result.signals[0].area).toBe("클라우드 권한과 비밀값 노출");
    expect(result.signals[0].jobCount).toBe(1);
    expect(result.signals[0].template.scanKeywords).toEqual(["클라우드 보안", "AWS", "IAM"]);
  });
});
