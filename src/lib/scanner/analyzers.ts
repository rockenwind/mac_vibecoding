import type { Finding, FindingCategory, RepositoryFile, Severity } from "./types";
import { redactSecrets } from "./redaction";

type RuleMatch = {
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  pattern: RegExp;
  whyItMatters: string;
  fixSuggestion: string;
};

const rules: RuleMatch[] = [
  {
    ruleId: "secret.exposed-token",
    title: "Possible exposed credential",
    severity: "critical",
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
    category: "prompt-injection",
    pattern: /(reveal|print|show).{0,40}(system prompt|hidden instruction|developer message)/i,
    whyItMatters:
      "Prompts that permit disclosure of hidden instructions weaken the boundary between user input and trusted control text.",
    fixSuggestion:
      "Remove disclosure instructions and add explicit refusal behavior for requests to reveal hidden prompts or secrets."
  }
];

const mcpShellCommandPattern = /"command"\s*:\s*"(bash|sh|zsh|cmd|powershell)"/i;
const mcpBroadRootPattern = /"roots"\s*:\s*\[\s*"\/"\s*\]/i;

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
        if (rule.pattern.test(line)) {
          findings.push(
            createFinding({
              file,
              lineNumber: index + 1,
              ruleId: rule.ruleId,
              title: rule.title,
              severity: rule.severity,
              category: rule.category,
              evidence: redactSecrets(line.trim()),
              whyItMatters: rule.whyItMatters,
              fixSuggestion: rule.fixSuggestion
            })
          );
        }
      }
    });
  }

  return findings;
}

function isEnvironmentFile(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const fileName = (normalized.split("/").at(-1) ?? normalized).toLowerCase();

  return fileName === ".env" || fileName.startsWith(".env.");
}

function hasBroadFilesystemShellMcpRisk(content: string): boolean {
  return mcpShellCommandPattern.test(content) && mcpBroadRootPattern.test(content);
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
    category: input.category,
    filePath: input.file.path,
    lineStart: input.lineNumber,
    lineEnd: input.lineNumber,
    evidence: input.evidence,
    whyItMatters: input.whyItMatters,
    fixSuggestion: input.fixSuggestion
  };
}
