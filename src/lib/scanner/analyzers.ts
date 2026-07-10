import type { Finding, FindingCategory, FindingConfidence, RepositoryFile, Severity } from "./types";
import { redactSecrets } from "./redaction";

type RuleMatch = {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: FindingConfidence;
  category: FindingCategory;
  description: string;
  pattern: RegExp;
  filePattern?: RegExp;
  detectionType: string;
  detectionSummary: string;
  impact: string;
  remediation: string;
  limitations: string;
  whyItMatters: string;
  fixSuggestion: string;
};

export type AnalyzerRuleMetadata = {
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  description: string;
  sourcePath: string;
  detectionType: string;
  detectionSummary: string;
  impact: string;
  remediation: string;
  limitations: string;
};

const analyzerSourcePath = "src/lib/scanner/analyzers.ts";

const rules: RuleMatch[] = [
  {
    ruleId: "secret.exposed-token",
    title: "Possible exposed credential",
    severity: "critical",
    confidence: "high",
    category: "secret",
    description: "API 키, 토큰, 비밀번호처럼 코드에 직접 들어간 비밀값을 찾습니다.",
    pattern:
      /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?=[A-Za-z0-9_-]*(?:api[_-]?key|apikey|token|secret|password))[A-Za-z0-9_-]+\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,})\b/i,
    detectionType: "정규식 기반",
    detectionSummary: "API 키, 토큰, 비밀번호 이름과 긴 비밀값 형태가 코드에 직접 들어간 패턴을 찾습니다.",
    impact: "노출된 비밀값은 모델 제공자, 소스 저장소, 내부 서비스에 대한 무단 접근으로 이어질 수 있습니다.",
    remediation: "노출된 값을 폐기하고 Git 이력에서 제거한 뒤 비밀 관리 도구나 환경 변수로 주입하세요.",
    limitations: "테스트 fixture나 설명 문서의 예시는 오탐 가능성이 있어 일부 안전한 경로와 환경 변수 참조는 제외합니다.",
    whyItMatters: "Exposed credentials can let attackers access model providers, source control, or internal services.",
    fixSuggestion:
      "Revoke the credential, remove it from git history, and load it from a secret manager or environment variable."
  },
  {
    ruleId: "dangerous-execution.child-process",
    title: "Broad command execution capability",
    severity: "high",
    confidence: "medium",
    category: "dangerous-execution",
    description: "LLM 또는 사용자 입력이 넓은 명령 실행 경로로 이어질 수 있는 코드를 찾습니다.",
    pattern: /\b(child_process\.exec|(?<!\.)\bexec\(|subprocess\.|os\.system|new Function\(|eval\()/,
    detectionType: "정규식 기반",
    detectionSummary: "셸 실행, 동적 함수 생성, 평가 함수처럼 입력이 실행 경로로 이어질 수 있는 호출을 찾습니다.",
    impact: "에이전트나 사용자 입력이 명령 실행 경로에 닿으면 원격 코드 실행으로 확대될 수 있습니다.",
    remediation: "명령을 allowlist로 제한하고 셸 보간을 피하며 사용자 입력을 실행 인자와 분리하세요.",
    limitations: "명령 allowlist나 인자 분리 여부까지 완전하게 증명하지는 못하므로 코드 리뷰가 필요합니다.",
    whyItMatters: "Agent or LLM-controlled command execution can become remote code execution if user input reaches this path.",
    fixSuggestion:
      "Constrain commands to an allowlist, avoid shell interpolation, and separate user input from executable arguments."
  },
  {
    ruleId: "prompt-injection.reveal-system-prompt",
    title: "Prompt invites system prompt disclosure",
    severity: "medium",
    confidence: "low",
    category: "prompt-injection",
    description: "숨겨진 시스템 프롬프트나 개발자 지시문을 노출하도록 유도하는 문구를 찾습니다.",
    pattern: /(reveal|print|show).{0,40}(system prompt|hidden instruction|developer message)/i,
    detectionType: "정규식 기반",
    detectionSummary: "시스템 프롬프트나 숨겨진 지시문을 출력하라고 유도하는 문구 조합을 찾습니다.",
    impact: "숨겨진 지시문 노출은 사용자 입력과 신뢰된 제어 문구 사이의 경계를 약화시킬 수 있습니다.",
    remediation: "숨겨진 프롬프트 공개 지시를 제거하고 공개 요청에 대한 거부 동작을 명시하세요.",
    limitations: "자연어 문구 기반 탐지라 안전한 문서 설명이나 방어 테스트 문구는 오탐 가능성이 있습니다.",
    whyItMatters:
      "Prompts that permit disclosure of hidden instructions weaken the boundary between user input and trusted control text.",
    fixSuggestion:
      "Remove disclosure instructions and add explicit refusal behavior for requests to reveal hidden prompts or secrets."
  },
  {
    ruleId: "database.dynamic-query",
    title: "Dynamic database query uses request-controlled input",
    severity: "medium",
    confidence: "medium",
    category: "dangerous-execution",
    description: "요청 값이 SQL 문자열에 직접 삽입되는 동적 데이터베이스 쿼리를 확인합니다.",
    pattern: /\b(?:db|database|client|pool)\.query\s*\(\s*`[^`]*\$\{[^}]+(?:searchParams|get\(|query|params|request|req)[^}]*\}[^`]*`/i,
    filePattern: /\.(?:ts|tsx|js|jsx|py)$/i,
    detectionType: "정규식 기반",
    detectionSummary: "요청 객체에서 온 값이 템플릿 문자열 SQL 쿼리에 직접 삽입되는 형태를 찾습니다.",
    impact: "요청 데이터가 SQL 문자열에 직접 들어가면 SQL 삽입 취약점으로 이어질 수 있습니다.",
    remediation: "매개변수화 쿼리나 요청 값을 SQL 본문과 분리해 바인딩하는 쿼리 빌더를 사용하세요.",
    limitations: "쿼리 빌더 내부 검증이나 별도 sanitize 함수 호출은 정밀하게 추적하지 않습니다.",
    whyItMatters: "Interpolating request data into database queries can introduce SQL injection paths.",
    fixSuggestion: "Use parameterized queries or a query builder that binds request values separately from SQL text."
  },
  {
    ruleId: "network.user-controlled-request",
    title: "Outbound request uses user-controlled URL",
    severity: "medium",
    confidence: "medium",
    category: "dangerous-execution",
    description: "사용자 입력이 서버의 외부 요청 주소로 사용되는지 확인합니다.",
    pattern: /\bfetch\s*\(\s*(?:req|request)\.(?:query|params|body|nextUrl|url)/i,
    filePattern: /\.(?:ts|tsx|js|jsx)$/i,
    detectionType: "정규식 기반",
    detectionSummary: "요청 객체의 URL, 쿼리, 본문 값이 fetch 대상 주소로 직접 사용되는 형태를 찾습니다.",
    impact: "사용자 제어 URL로 서버가 요청을 보내면 서버 측 요청 위조나 데이터 유출 위험이 생깁니다.",
    remediation: "요청 대상 도메인을 allowlist로 검증하고 임의 URL 전달을 차단하세요.",
    limitations: "도메인 allowlist가 별도 함수에 숨겨진 경우에는 수동 확인이 필요합니다.",
    whyItMatters: "Fetching user-controlled URLs can create server-side request forgery or data exfiltration risks.",
    fixSuggestion: "Validate destinations against an allowlist and avoid forwarding arbitrary user-provided URLs."
  }
];

const mcpShellCommandPattern = /"command"\s*:\s*"(bash|sh|zsh|cmd|powershell)"/i;
const mcpBroadRootPattern = /"roots"\s*:\s*\[\s*"\/"\s*\]/i;
const apiRoutePathPattern = /(^|\/)api\/.*\/route\.(?:ts|tsx|js|jsx)$/i;
const apiMutationHandlerPattern = /\b(?:export\s+async\s+function\s+)?(?:POST|PUT|PATCH|DELETE)\b/;
const authReviewPattern =
  /\b(getServerSession|requireAuth|requireUser|requireAdminToken|authorizeScheduledRun|verifyToken|validateToken|currentUser|auth\s*\(|authorize\s*\(|isAuthenticated|session\s*=|session\s*\.)\b/i;
const adminPathPattern = /(^|\/)admin(\/|$)/i;
const authorizationReviewPattern =
  /\b(authorize\s*\(|requireRole|requireAdmin|hasPermission|canManage|isAdmin|role\s*===|permissions?\.includes|rbac|policy\.enforce)\b/i;
const clientSecretPattern =
  /\bprocess\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*/;

const specialRules: AnalyzerRuleMetadata[] = [
  {
    ruleId: "secret.env-file",
    title: "Environment file committed to repository",
    severity: "high",
    category: "secret",
    description: "실제 환경 변수 파일이 저장소에 포함되어 비밀값이 노출될 수 있는지 확인합니다.",
    sourcePath: analyzerSourcePath,
    detectionType: "파일 경로 기반",
    detectionSummary: ".env, .env.local처럼 실제 환경 변수 파일로 보이는 경로를 찾습니다.",
    impact: "환경 변수 파일에는 API 키, 데이터베이스 접속 정보, 배포 비밀값이 포함될 수 있습니다.",
    remediation: "실제 환경 파일을 저장소에서 제거하고 안전한 예시 파일만 커밋하세요.",
    limitations: "비밀값이 없는 로컬 개발용 파일도 경로만으로는 오탐될 수 있습니다."
  },
  {
    ruleId: "mcp.broad-filesystem-shell",
    title: "MCP configuration combines shell access and broad filesystem access",
    severity: "high",
    category: "mcp",
    description: "MCP 설정에서 셸 실행과 넓은 파일시스템 접근이 동시에 허용되는지 확인합니다.",
    sourcePath: analyzerSourcePath,
    detectionType: "휴리스틱 기반",
    detectionSummary: "MCP 설정에서 셸 명령 실행과 루트 파일시스템 접근이 함께 선언된 조합을 찾습니다.",
    impact: "도구 호출 권한이 넓으면 에이전트나 사용자가 로컬 파일 전체에 접근하고 명령을 실행할 수 있습니다.",
    remediation: "허용 루트를 최소화하고 셸 실행 도구를 분리하거나 명령 allowlist를 적용하세요.",
    limitations: "실제 런타임 권한 축소가 별도 계층에서 적용되는지는 확인하지 않습니다."
  },
  {
    ruleId: "api.missing-auth-review",
    title: "API mutation route needs authentication review",
    severity: "medium",
    category: "agent-tooling",
    description: "데이터를 변경하는 API 라우트에 인증 확인이 보이는지 점검합니다.",
    sourcePath: analyzerSourcePath,
    detectionType: "휴리스틱 기반",
    detectionSummary: "POST, PUT, PATCH, DELETE 라우트에서 알려진 인증 확인 호출이 보이는지 찾습니다.",
    impact: "인증 없는 변경 API는 무단 데이터 변경이나 작업 실행으로 이어질 수 있습니다.",
    remediation: "서버 측 인증 확인을 추가하고 민감 작업에는 관리자 토큰이나 세션 검증을 적용하세요.",
    limitations: "프로젝트 고유 인증 함수 이름이 목록에 없으면 오탐될 수 있습니다."
  },
  {
    ruleId: "admin.missing-authorization-review",
    title: "Admin route needs authorization review",
    severity: "high",
    category: "agent-tooling",
    description: "관리자 API 라우트에 역할 또는 권한 확인이 보이는지 점검합니다.",
    sourcePath: analyzerSourcePath,
    detectionType: "휴리스틱 기반",
    detectionSummary: "admin 경로의 변경 API에서 역할, 권한, 정책 확인 호출이 보이는지 찾습니다.",
    impact: "관리자 권한 확인이 빠지면 일반 사용자가 운영 기능을 호출할 수 있습니다.",
    remediation: "역할 기반 권한 확인이나 정책 검사를 서버 라우트에 추가하세요.",
    limitations: "경로 이름만으로 관리자 기능을 추정하므로 내부 라우팅 구조에 따라 오탐 가능성이 있습니다."
  },
  {
    ruleId: "nextjs.client-secret-exposure",
    title: "Client component references server secret",
    severity: "high",
    category: "secret",
    description: "Next.js 클라이언트 컴포넌트에서 서버 비밀값 환경 변수를 참조하는지 확인합니다.",
    sourcePath: analyzerSourcePath,
    detectionType: "프레임워크 구조 기반",
    detectionSummary: "use client 컴포넌트에서 NEXT_PUBLIC이 아닌 비밀 환경 변수를 참조하는지 찾습니다.",
    impact: "서버 전용 비밀값 참조가 클라이언트 번들 경계에 섞이면 노출 위험이 커집니다.",
    remediation: "비밀값 사용을 서버 컴포넌트나 API 라우트로 옮기고 클라이언트에는 공개 가능한 값만 전달하세요.",
    limitations: "빌드 도구가 실제로 값을 인라인하는지까지는 검증하지 않습니다."
  }
];

export function listAnalyzerRules(): AnalyzerRuleMetadata[] {
  return [
    ...rules.map((rule) => ({
      ruleId: rule.ruleId,
      title: rule.title,
      severity: rule.severity,
      category: rule.category,
      description: rule.description,
      sourcePath: analyzerSourcePath,
      detectionType: rule.detectionType,
      detectionSummary: rule.detectionSummary,
      impact: rule.impact,
      remediation: rule.remediation,
      limitations: rule.limitations
    })),
    ...specialRules
  ].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

export function analyzeFiles(
  files: RepositoryFile[],
  options: { disabledRuleIds?: string[] } = {}
): Finding[] {
  const findings: Finding[] = [];
  const disabled = new Set(options.disabledRuleIds ?? []);

  for (const file of files) {
    if (!disabled.has("secret.env-file") && isEnvironmentFile(file.path)) {
      findings.push(
        createFinding({
          file,
          lineNumber: 1,
          ruleId: "secret.env-file",
          title: "Environment file committed to repository",
          severity: "high",
          confidence: "medium",
          category: "secret",
          evidence: file.path,
          whyItMatters: "Environment files often contain API keys, database credentials, and deployment secrets.",
          fixSuggestion: "Remove committed environment files and commit a safe example file such as .env.example."
        })
      );
    }

    if (!disabled.has("mcp.broad-filesystem-shell") && hasBroadFilesystemShellMcpRisk(file.content)) {
      findings.push(
        createFinding({
          file,
          lineNumber: firstMatchingLineNumber(file.content, [mcpShellCommandPattern, mcpBroadRootPattern]),
          ruleId: "mcp.broad-filesystem-shell",
          title: "MCP configuration combines shell access and broad filesystem access",
          severity: "high",
          confidence: "medium",
          category: "mcp",
          evidence: redactSecrets(firstMatchingLine(file.content, [mcpShellCommandPattern, mcpBroadRootPattern]).trim()),
          whyItMatters:
            "Combining shell access with broad filesystem roots can let compromised tools read or modify sensitive local files.",
          fixSuggestion:
            "Limit filesystem roots to project directories and avoid exposing unrestricted shell commands through MCP tools."
        })
      );
    }

    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of rules) {
        if (disabled.has(rule.ruleId)) {
          continue;
        }
        if (matchesRule(rule, file, line)) {
          findings.push(
            createFinding({
              file,
              lineNumber: index + 1,
              ruleId: rule.ruleId,
              title: rule.title,
              severity: rule.severity,
              confidence: rule.confidence,
              category: rule.category,
              evidence: redactSecrets(line.trim()),
              whyItMatters: rule.whyItMatters,
              fixSuggestion: rule.fixSuggestion
            })
          );
        }
      }
    });

    if (!disabled.has("api.missing-auth-review") && isApiRouteMissingAuthReview(file)) {
      findings.push(
        createFinding({
          file,
          lineNumber: firstMatchingLineNumber(file.content, [apiMutationHandlerPattern]),
          ruleId: "api.missing-auth-review",
          title: "API mutation route needs authentication review",
          severity: "medium",
          confidence: "medium",
          category: "agent-tooling",
          evidence: firstMatchingLine(file.content, [apiMutationHandlerPattern]).trim(),
          whyItMatters: "Mutation handlers without visible authentication checks may allow unauthenticated data changes.",
          fixSuggestion: "Require an authenticated session or token before processing API mutations."
        })
      );
    }

    if (!disabled.has("admin.missing-authorization-review") && isAdminRouteMissingAuthorizationReview(file)) {
      findings.push(
        createFinding({
          file,
          lineNumber: firstMatchingLineNumber(file.content, [apiMutationHandlerPattern]),
          ruleId: "admin.missing-authorization-review",
          title: "Admin route needs authorization review",
          severity: "high",
          confidence: "medium",
          category: "agent-tooling",
          evidence: firstMatchingLine(file.content, [apiMutationHandlerPattern]).trim(),
          whyItMatters: "Admin endpoints need explicit authorization checks to prevent privilege escalation.",
          fixSuggestion: "Verify the caller has the required admin role or permission before handling the request."
        })
      );
    }

    if (!disabled.has("nextjs.client-secret-exposure") && hasClientSecretExposure(file)) {
      findings.push(
        createFinding({
          file,
          lineNumber: firstMatchingLineNumber(file.content, [clientSecretPattern]),
          ruleId: "nextjs.client-secret-exposure",
          title: "Client component references server secret",
          severity: "high",
          confidence: "high",
          category: "secret",
          evidence: redactSecrets(firstMatchingLine(file.content, [clientSecretPattern]).trim()),
          whyItMatters: "Secrets referenced from client components can be bundled into browser-delivered code.",
          fixSuggestion: "Move secret access to server-only code and expose only non-sensitive public configuration to clients."
        })
      );
    }
  }

  return findings.sort(compareFindings);
}

function isEnvironmentFile(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const fileName = (normalized.split("/").at(-1) ?? normalized).toLowerCase();

  if (isEnvironmentTemplateFile(fileName)) {
    return false;
  }

  return fileName === ".env" || fileName.startsWith(".env.");
}

function isEnvironmentTemplateFile(fileName: string): boolean {
  return (
    fileName === ".env.example" ||
    fileName === ".env.sample" ||
    fileName === ".env.template" ||
    fileName.endsWith(".env.example") ||
    fileName.endsWith(".env.sample") ||
    fileName.endsWith(".env.template")
  );
}

function hasBroadFilesystemShellMcpRisk(content: string): boolean {
  return mcpShellCommandPattern.test(content) && mcpBroadRootPattern.test(content);
}

function matchesRule(rule: RuleMatch, file: RepositoryFile, line: string): boolean {
  if (isExampleOnlyPath(file.path)) {
    return false;
  }

  if (rule.ruleId === "secret.exposed-token" && isEnvironmentTemplatePath(file.path)) {
    return false;
  }

  if (isRuleDefinitionSelfMatch(rule, file.path)) {
    return false;
  }

  if (rule.ruleId === "secret.exposed-token" && isEnvironmentReference(line)) {
    return false;
  }

  if (rule.filePattern && !rule.filePattern.test(file.path)) {
    return false;
  }

  return rule.pattern.test(line);
}

function isEnvironmentTemplatePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const fileName = (normalized.split("/").at(-1) ?? normalized).toLowerCase();
  return isEnvironmentTemplateFile(fileName);
}

function isRuleDefinitionSelfMatch(rule: RuleMatch, path: string): boolean {
  return rule.ruleId === "prompt-injection.reveal-system-prompt" && path.replaceAll("\\", "/") === "src/lib/scanner/analyzers.ts";
}

function isEnvironmentReference(line: string): boolean {
  return (
    /\bprocess\.env\.[A-Z0-9_]+\b/.test(line) ||
    /\b[A-Za-z0-9_]*(?:storage|localstorage)[A-Za-z0-9_]*\s*=\s*["'][A-Za-z0-9_.:-]{8,}["']/i.test(line)
  ) && !/[A-Z0-9_]+\s*[:=]\s*["'][^"']{16,}["']/.test(line);
}

function isExampleOnlyPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  const fileName = normalized.split("/").at(-1) ?? normalized;

  return (
    normalized.startsWith("docs/superpowers/") ||
    normalized.includes("/__fixtures__/") ||
    /\.(?:test|spec)\.(?:ts|tsx|js|jsx|py)$/.test(fileName)
  );
}

function isApiRouteMissingAuthReview(file: RepositoryFile): boolean {
  return apiRoutePathPattern.test(file.path) && apiMutationHandlerPattern.test(file.content) && !hasExecutableMatch(file.content, authReviewPattern);
}

function isAdminRouteMissingAuthorizationReview(file: RepositoryFile): boolean {
  return (
    apiRoutePathPattern.test(file.path) &&
    adminPathPattern.test(file.path) &&
    apiMutationHandlerPattern.test(file.content) &&
    !hasExecutableMatch(file.content, authorizationReviewPattern)
  );
}

function hasClientSecretExposure(file: RepositoryFile): boolean {
  return isNextJsClientComponent(file) && clientSecretPattern.test(file.content);
}

function isNextJsClientComponent(file: RepositoryFile): boolean {
  if (!/\.(?:tsx|jsx|ts|js)$/i.test(file.path)) {
    return false;
  }

  return file.content
    .split(/\r?\n/)
    .slice(0, 5)
    .some((line) => /^\s*["']use client["'];?\s*$/.test(line));
}

function hasExecutableMatch(content: string, pattern: RegExp): boolean {
  return stripBlockComments(content)
    .split(/\r?\n/)
    .map(stripLineComment)
    .filter((line) => line.trim())
    .some((line) => pattern.test(line));
}

function stripBlockComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "");
}

function stripLineComment(line: string): string {
  return line.replace(/\s*\/\/.*$/, "");
}

function firstMatchingLine(content: string, patterns: RegExp[]): string {
  return content.split(/\r?\n/).find((line) => patterns.some((pattern) => pattern.test(line))) ?? content;
}

function firstMatchingLineNumber(content: string, patterns: RegExp[]): number {
  const index = content.split(/\r?\n/).findIndex((line) => patterns.some((pattern) => pattern.test(line)));

  return index === -1 ? 1 : index + 1;
}

function createFinding(input: {
  file: RepositoryFile;
  lineNumber: number;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: FindingConfidence;
  category: FindingCategory;
  evidence: string;
  whyItMatters: string;
  fixSuggestion: string;
}): Finding {
  return {
    id: `${input.ruleId}:${input.file.path}:${input.lineNumber}`,
    ruleId: input.ruleId,
    title: input.title,
    severity: input.severity,
    confidence: input.confidence,
    category: input.category,
    filePath: input.file.path,
    lineStart: input.lineNumber,
    lineEnd: input.lineNumber,
    evidence: input.evidence,
    whyItMatters: input.whyItMatters,
    fixSuggestion: input.fixSuggestion
  };
}

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

const confidenceRank: Record<FindingConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2
};

function compareFindings(left: Finding, right: Finding): number {
  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    confidenceRank[left.confidence ?? "medium"] - confidenceRank[right.confidence ?? "medium"]
  );
}
