const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, "sk-...redacted..."],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "ghp_...redacted..."],
  [
    /\b((?:api[_-]?key|token|secret|password)\s*[:=]\s*)(["']?)[A-Za-z0-9_./+=-]{16,}\2/gi,
    "$1$2...redacted...$2"
  ]
];

export function redactSecrets(value: string): string {
  return secretPatterns.reduce((redacted, [pattern, replacement]) => {
    return redacted.replace(pattern, replacement);
  }, value);
}
