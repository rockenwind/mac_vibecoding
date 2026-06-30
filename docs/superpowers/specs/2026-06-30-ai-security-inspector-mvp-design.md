# AI Security Inspector MVP Design

## Summary

AI Security Inspector is a web-based service that scans public GitHub repositories for AI, agent, and LLM application security risks. The MVP accepts a GitHub repository URL, fetches a focused set of repository files, runs rule-based security analyzers, and displays a developer-friendly findings report in the browser.

The first version does not call an AI model. It uses deterministic rules so the product can run without API keys, cost, or model availability. The scanner is still structured around analyzer interfaces so AI-assisted explanation, prioritization, and remediation can be added later.

## Goals

- Provide a usable web screen and backend API in the same project.
- Support public GitHub repository URLs as the first input source.
- Detect early AI security risks in code, prompts, agent tools, MCP configs, and credential handling.
- Return findings with severity, evidence, risk explanation, and fix guidance.
- Keep the architecture open for private repositories, GitHub App installation, PR checks, and AI-powered analysis.

## Non-Goals

- Private repository scanning.
- GitHub OAuth or GitHub App installation.
- Persistent user accounts or team management.
- Full static analysis, dataflow analysis, or exploit validation.
- Live scanning of deployed services.
- AI model calls in the MVP.

## Product Flow

1. The user opens the web app.
2. The user enters a public GitHub repository URL.
3. The frontend sends the URL to the scan API.
4. The backend validates and normalizes the GitHub URL.
5. The backend fetches repository metadata and selected file contents.
6. The scanner runs rule-based analyzers over the fetched files.
7. The API returns a scan result.
8. The frontend shows a severity summary, findings list, detailed evidence, and JSON report view.

## Architecture

Use a single full-stack web application for the MVP.

- Frontend: repository URL input, scan state, summary counts, findings list, finding details, JSON report view.
- API layer: request validation, GitHub URL normalization, scan orchestration, response shaping.
- GitHub source adapter: public repository metadata and file retrieval.
- Scanner core: file filtering, analyzer execution, finding aggregation.
- Analyzers: independent rule modules that emit normalized findings.
- Report model: stable JSON shape shared by frontend and backend.

This keeps the first product small while preserving clear boundaries. If the service grows, the scanner core and GitHub adapter can move into a standalone backend service without changing the report contract.

## API Design

### `POST /api/scans`

Request:

```json
{
  "repositoryUrl": "https://github.com/owner/repo"
}
```

Response:

```json
{
  "scan": {
    "id": "scan_...",
    "repository": {
      "owner": "owner",
      "name": "repo",
      "url": "https://github.com/owner/repo",
      "defaultBranch": "main"
    },
    "summary": {
      "critical": 0,
      "high": 1,
      "medium": 3,
      "low": 2,
      "info": 1
    },
    "findings": []
  }
}
```

The MVP can return the scan result synchronously. A future version can make the same endpoint create an asynchronous scan job and add `GET /api/scans/:id`.

## Finding Model

Each finding includes:

- `id`: stable identifier for the finding instance.
- `ruleId`: identifier for the analyzer rule.
- `title`: short human-readable issue name.
- `severity`: `critical`, `high`, `medium`, `low`, or `info`.
- `category`: security area, such as `secret`, `agent-tooling`, `prompt-injection`, `mcp`, or `dangerous-execution`.
- `filePath`: repository-relative file path.
- `lineStart`: optional one-based line number.
- `lineEnd`: optional one-based line number.
- `evidence`: short matched snippet or reason, with suspected secrets redacted.
- `whyItMatters`: concise risk explanation.
- `fixSuggestion`: practical remediation guidance.

## Initial Analyzer Rules

### Secrets and Credentials

- Detect likely API keys, tokens, and private keys.
- Flag committed `.env`-style files.
- Flag credential-like config keys in source files.

### AI Prompt and LLM App Risks

- Flag prompt templates that include direct instructions to reveal system prompts or secrets.
- Flag user input being inserted into high-trust prompt sections without guardrails.
- Flag prompt files that appear to store sensitive operational instructions.

### Agent and Tool Permission Risks

- Flag broad shell execution patterns such as `child_process.exec`, `subprocess`, and `os.system`.
- Flag file deletion or filesystem-wide access patterns in agent tool definitions.
- Flag network fetch tools that accept arbitrary user-provided URLs.

### MCP Configuration Risks

- Flag MCP server configs that expose broad filesystem access.
- Flag MCP configs that combine shell access and broad file access.
- Flag local server definitions without clear command boundaries.

### Dangerous Code Execution

- Flag `eval`, `exec`, dynamic function construction, and unsafe deserialization patterns.
- Flag direct command construction with user-controlled input when detectable by simple rules.

## File Selection

The scanner should inspect likely relevant text files and avoid large or generated content.

Include:

- Source files: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.rb`, `.java`, `.cs`.
- Config files: `.json`, `.yaml`, `.yml`, `.toml`, `.env`, `.ini`.
- Prompt and AI files: `.prompt`, `.md`, files with `prompt`, `agent`, `mcp`, `tool`, or `openai` in the path.

Exclude:

- Binary files.
- Lockfiles for the MVP unless needed later.
- Generated folders such as `node_modules`, `dist`, `build`, `.next`, `.git`, and `coverage`.
- Very large files above 200 KB in the MVP.

## Sensitive Data Handling

The scanner may detect real secrets in public repositories. Findings should show enough evidence for a developer to locate the issue, but must redact secret values in API responses and the UI. For example, an exposed key should be displayed as `sk-...redacted...` instead of the full value.

The MVP does not persist scan results beyond the request lifecycle. If file-based or database persistence is added later, stored findings should keep the same redaction behavior.

## Error Handling

- Invalid URL: return a clear validation error.
- Unsupported host: only `github.com` is supported in the MVP.
- Private or unavailable repository: explain that the MVP supports public repositories only.
- GitHub rate limit: return a friendly retry message.
- Empty scan target: return an informational result with no findings.
- Partial file fetch failure: continue scanning available files and include a warning.

## Testing Strategy

- Unit tests for GitHub URL parsing and normalization.
- Unit tests for file filtering.
- Unit tests for each analyzer rule with small fixture files.
- API tests for valid URL, invalid URL, unavailable repository, and empty scan result.
- UI smoke test for entering a repo URL and rendering a findings report from mocked API data.

## Expansion Path

After the MVP works:

1. Add asynchronous scan jobs and persistent scan history.
2. Add GitHub authentication for private repositories.
3. Add GitHub App installation and PR scan comments.
4. Add AI-assisted finding explanation and remediation suggestions.
5. Add organization-level dashboards and recurring scans.
6. Add deeper static analysis for source-to-sink validation.

## Open Decisions Resolved

- The MVP starts with public GitHub repository scanning, not local CLI scanning.
- The MVP includes both web UI and backend API.
- The first scanner is rule-based, with an AI analyzer interface reserved for later.
- The project starts as a single full-stack web application.
