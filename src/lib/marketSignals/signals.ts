export type MarketJob = {
  title: string;
  description: string;
  matchedKeywords: string[];
};

export type MarketSignal = {
  area: string;
  keywords: string[];
  score: number;
};

export type MarketSignalsReport = {
  generatedAt: string;
  sampleSize: number;
  signals: MarketSignal[];
};

const signalDefinitions: MarketSignal[] = [
  {
    area: "클라우드 권한과 비밀값 노출",
    keywords: ["클라우드 보안", "AWS", "IAM"],
    score: 0
  },
  {
    area: "로그/탐지 설정과 운영 자동화",
    keywords: ["SIEM", "보안관제", "탐지"],
    score: 0
  },
  {
    area: "사고 대응 절차와 민감정보 노출",
    keywords: ["침해대응", "CERT"],
    score: 0
  },
  {
    area: "인증, 입력 검증, 서버 측 요청 위험",
    keywords: ["API 보안", "API"],
    score: 0
  },
  {
    area: "프롬프트 노출, 도구 실행 권한, 모델 연동 보안",
    keywords: ["AI", "LLM", "프롬프트"],
    score: 0
  }
];

export function buildMarketSignals(
  jobs: MarketJob[],
  now: Date
): MarketSignalsReport {
  const signals = signalDefinitions
    .map((definition) => ({
      ...definition,
      score: scoreSignal(definition.keywords, jobs)
    }))
    .filter((signal) => signal.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    generatedAt: now.toISOString(),
    sampleSize: jobs.length,
    signals
  };
}

function scoreSignal(keywords: string[], jobs: MarketJob[]): number {
  return jobs.reduce((score, job) => {
    const haystack = `${job.title} ${job.description} ${job.matchedKeywords.join(" ")}`.toLocaleLowerCase();
    return score + keywords.filter((keyword) => haystack.includes(keyword.toLocaleLowerCase())).length;
  }, 0);
}
