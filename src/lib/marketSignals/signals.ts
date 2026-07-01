export type MarketJob = {
  company?: string | null;
  title: string;
  description: string;
  matchedKeywords: string[];
  firstSeenAt?: string | Date | null;
};

export type MarketSignalTemplate = {
  purpose: string;
  scanKeywords: string[];
  reviewTargets: string[];
  checklist: string[];
};

export type MarketSignal = {
  area: string;
  keywords: string[];
  score: number;
  jobCount: number;
  trend: string;
  template: MarketSignalTemplate;
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
    score: 0,
    jobCount: 0,
    trend: "",
    template: {
      purpose: "클라우드 권한과 비밀값 노출 위험을 빠르게 확인합니다.",
      scanKeywords: ["클라우드 보안", "AWS", "IAM"],
      reviewTargets: ["인프라 설정", "환경 변수", "배포 설정", "권한 정책"],
      checklist: [
        "권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다.",
        "저장소와 배포 설정에 클라우드 비밀값이 남아 있는지 확인합니다.",
        "운영 계정과 개발 계정의 접근 범위가 분리되어 있는지 확인합니다."
      ]
    }
  },
  {
    area: "로그/탐지 설정과 운영 자동화",
    keywords: ["SIEM", "보안관제", "탐지"],
    score: 0,
    jobCount: 0,
    trend: "",
    template: {
      purpose: "운영 환경에서 탐지와 알림이 빠지는 지점을 확인합니다.",
      scanKeywords: ["SIEM", "보안관제", "탐지"],
      reviewTargets: ["로그 수집 설정", "알림 규칙", "장애 대응 절차"],
      checklist: [
        "중요 이벤트가 중앙 로그로 수집되는지 확인합니다.",
        "탐지 규칙이 실패했을 때 운영자가 알 수 있는지 확인합니다.",
        "반복 점검을 자동화할 수 있는 스크립트나 작업 흐름을 확인합니다."
      ]
    }
  },
  {
    area: "사고 대응 절차와 민감정보 노출",
    keywords: ["침해대응", "CERT"],
    score: 0,
    jobCount: 0,
    trend: "",
    template: {
      purpose: "사고 대응 과정에서 필요한 증적과 민감정보 보호 상태를 확인합니다.",
      scanKeywords: ["침해대응", "CERT"],
      reviewTargets: ["대응 절차 문서", "접근 로그", "민감정보 저장소"],
      checklist: [
        "침해 의심 상황에서 확인할 로그와 담당자가 정리되어 있는지 확인합니다.",
        "민감정보가 평문 파일이나 테스트 데이터에 남아 있는지 확인합니다.",
        "대응 이후 키 회전과 권한 회수 절차가 있는지 확인합니다."
      ]
    }
  },
  {
    area: "인증, 입력 검증, 서버 측 요청 위험",
    keywords: ["API 보안", "API"],
    score: 0,
    jobCount: 0,
    trend: "",
    template: {
      purpose: "API 인증과 입력 검증에서 공격 표면을 줄입니다.",
      scanKeywords: ["API 보안", "API"],
      reviewTargets: ["API 라우트", "인증 미들웨어", "외부 요청 코드"],
      checklist: [
        "인증 없이 호출 가능한 민감 API가 있는지 확인합니다.",
        "사용자 입력이 서버 측 요청 주소나 명령 실행에 연결되는지 확인합니다.",
        "오류 응답이 토큰, 내부 주소, 스택 정보를 노출하지 않는지 확인합니다."
      ]
    }
  },
  {
    area: "프롬프트 노출, 도구 실행 권한, 모델 연동 보안",
    keywords: ["AI", "LLM", "프롬프트"],
    score: 0,
    jobCount: 0,
    trend: "",
    template: {
      purpose: "AI 기능이 외부 입력과 도구 실행을 안전하게 다루는지 확인합니다.",
      scanKeywords: ["AI", "LLM", "프롬프트"],
      reviewTargets: ["프롬프트 구성", "도구 호출 코드", "모델 API 연동"],
      checklist: [
        "시스템 프롬프트나 내부 정책이 사용자에게 노출되는 경로를 확인합니다.",
        "모델 출력이 검증 없이 파일, 명령, 네트워크 도구 실행으로 이어지는지 확인합니다.",
        "모델 API 키와 대화 로그가 안전하게 보관되는지 확인합니다."
      ]
    }
  }
];

export function buildMarketSignals(
  jobs: MarketJob[],
  now: Date
): MarketSignalsReport {
  const signals = signalDefinitions
    .map((definition) => buildSignal(definition, jobs, now))
    .filter((signal) => signal.score > 0)
    .sort((left, right) => right.score - left.score || right.jobCount - left.jobCount);

  return {
    generatedAt: now.toISOString(),
    sampleSize: jobs.length,
    signals
  };
}

function buildSignal(definition: MarketSignal, jobs: MarketJob[], now: Date): MarketSignal {
  const matchedJobs = jobs.filter((job) => countKeywordMatches(definition.keywords, job) > 0);
  const uniqueCompanies = new Set(matchedJobs.map((job) => normalizeCompany(job.company, job.title)));
  const score = matchedJobs.reduce((total, job) => {
    const keywordMatches = countKeywordMatches(definition.keywords, job);
    const recencyWeight = getRecencyWeight(job.firstSeenAt, now);
    const duplicateWeight = 1 / Math.max(1, countCompanyJobs(matchedJobs, job));
    return total + keywordMatches * recencyWeight * duplicateWeight;
  }, 0);

  return {
    ...definition,
    score: Math.round(score * 10) / 10,
    jobCount: uniqueCompanies.size,
    trend: `최근 공고에서 ${definition.keywords.join(", ")} 수요가 확인됩니다.`
  };
}

function countKeywordMatches(keywords: string[], job: MarketJob): number {
  const haystack = `${job.title} ${job.description} ${job.matchedKeywords.join(" ")}`.toLocaleLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword.toLocaleLowerCase())).length;
}

function getRecencyWeight(firstSeenAt: MarketJob["firstSeenAt"], now: Date): number {
  if (!firstSeenAt) {
    return 1;
  }

  const seenAt = firstSeenAt instanceof Date ? firstSeenAt : new Date(firstSeenAt);
  if (Number.isNaN(seenAt.getTime())) {
    return 1;
  }

  const ageInDays = Math.max(0, (now.getTime() - seenAt.getTime()) / 86_400_000);
  if (ageInDays <= 7) {
    return 2;
  }
  if (ageInDays <= 30) {
    return 1.4;
  }
  return 0.5;
}

function countCompanyJobs(jobs: MarketJob[], targetJob: MarketJob): number {
  const targetCompany = normalizeCompany(targetJob.company, targetJob.title);
  return jobs.filter((job) => normalizeCompany(job.company, job.title) === targetCompany).length;
}

function normalizeCompany(company: MarketJob["company"], fallback: string): string {
  return company?.trim().toLocaleLowerCase() || fallback.trim().toLocaleLowerCase();
}
