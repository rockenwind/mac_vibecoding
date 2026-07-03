export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingConfidence = "high" | "medium" | "low";

export type FindingCategory =
  | "secret"
  | "agent-tooling"
  | "prompt-injection"
  | "mcp"
  | "dangerous-execution";

export type RepositoryRef = {
  owner: string;
  name: string;
  url: string;
  defaultBranch?: string;
};

export type RepositoryFile = {
  path: string;
  content: string;
  size: number;
};

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence?: FindingConfidence;
  category: FindingCategory;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  evidence: string;
  whyItMatters: string;
  fixSuggestion: string;
};

export type ScanSummary = Record<Severity, number>;

export type ScanWarning = {
  message: string;
};

export type ScanResult = {
  id: string;
  repository: Required<RepositoryRef>;
  summary: ScanSummary;
  findings: Finding[];
  warnings: ScanWarning[];
};
