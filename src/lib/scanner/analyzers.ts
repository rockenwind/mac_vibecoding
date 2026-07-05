import type { Finding, FindingCategory, FindingConfidence, RepositoryFile, Severity } from "./types";
import { redactSecrets } from "./redaction";

type RuleMatch = {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: FindingConfidence;
  category: FindingCategory;
  pattern: RegExp;
  filePattern?: RegExp;
  whyItMatters: string;
  fixSuggestion: string;
};

const rules: RuleMatch[] = [
  {
    ruleId: "secret.exposed-token",
    title: "Possible exposed credential",
    severity: "critical",
    confidence: "high",
    category: "secret",
    pattern:
      /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?=[A-Za-z0-9_-]*(?:api[_-]?key|apikey|token|secret|password))[A-Za-z0-9_-]+\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,})\b/i,
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
    pattern: /\b(child_process\.exec|exec\(|subprocess\.|os\.system|new Function\(|eval\()/,
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
    pattern: /(reveal|print|show).{0,40}(system prompt|hidden instruction|developer message)/i,
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
    pattern: /\b(?:db|database|client|pool)\.query\s*\(\s*`[^`]*\$\{[^}]+(?:searchParams|get\(|query|params|request|req)[^}]*\}[^`]*`/i,
    filePattern: /\.(?:ts|tsx|js|jsx|py)$/i,
    whyItMatters: "Interpolating request data into database queries can introduce SQL injection paths.",
    fixSuggestion: "Use parameterized queries or a query builder that binds request values separately from SQL text."
  },
  {
    ruleId: "network.user-controlled-request",
    title: "Outbound request uses user-controlled URL",
    severity: "medium",
    confidence: "medium",
    category: "dangerous-execution",
    pattern: /\bfetch\s*\(\s*(?:req|request)\.(?:query|params|body|nextUrl|url)/i,
    filePattern: /\.(?:ts|tsx|js|jsx)$/i,
    whyItMatters: "Fetching user-controlled URLs can create server-side request forgery or data exfiltration risks.",
    fixSuggestion: "Validate destinations against an allowlist and avoid forwarding arbitrary user-provided URLs."
  }
];

const mcpShellCommandPattern = /"command"\s*:\s*"(bash|sh|zsh|cmd|powershell)"/i;
const mcpBroadRootPattern = /"roots"\s*:\s*\[\s*"\/"\s*\]/i;
const apiRoutePathPattern = /(^|\/)api\/.*\/route\.(?:ts|tsx|js|jsx)$/i;
const apiMutationHandlerPattern = /\b(?:export\s+async\s+function\s+)?(?:POST|PUT|PATCH|DELETE)\b/;
const authReviewPattern =
  /\b(getServerSession|requireAuth|requireUser|verifyToken|validateToken|currentUser|auth\s*\(|authorize\s*\(|isAuthenticated|session\s*=|session\s*\.)\b/i;
const adminPathPattern = /(^|\/)admin(\/|$)/i;
const authorizationReviewPattern =
  /\b(authorize\s*\(|requireRole|requireAdmin|hasPermission|canManage|isAdmin|role\s*===|permissions?\.includes|rbac|policy\.enforce)\b/i;
const clientSecretPattern =
  /\bprocess\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*/;

export function analyzeFiles(files: RepositoryFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (isEnvironmentFile(file.path)) {
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

    if (hasBroadFilesystemShellMcpRisk(file.content)) {
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

    if (isApiRouteMissingAuthReview(file)) {
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

    if (isAdminRouteMissingAuthorizationReview(file)) {
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

    if (hasClientSecretExposure(file)) {
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

  return fileName === ".env" || fileName.startsWith(".env.");
}

function hasBroadFilesystemShellMcpRisk(content: string): boolean {
  return mcpShellCommandPattern.test(content) && mcpBroadRootPattern.test(content);
}

function matchesRule(rule: RuleMatch, file: RepositoryFile, line: string): boolean {
  if (rule.filePattern && !rule.filePattern.test(file.path)) {
    return false;
  }

  return rule.pattern.test(line);
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
