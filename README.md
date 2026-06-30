# mac_vibecoding

AI Security Inspector is a full-stack MVP for scanning public GitHub repositories for AI, agent, and LLM application security risks.

## Features

- Public GitHub repository URL scanning
- Rule-based findings for secrets, dangerous execution, prompt risks, MCP risks, and agent tool permission risks
- Web report with severity counts, evidence, risk explanation, fix guidance, and JSON output
- Scanner core structured for future AI-assisted analysis

## Development

Install dependencies:

```bash
pnpm install
```

Run tests:

```bash
CI=true pnpm test
```

Run type checks:

```bash
CI=true pnpm lint
```

Run the web app:

```bash
pnpm run dev
```

Open `http://localhost:3000` and enter a public GitHub repository URL.

## MVP Scope

The MVP supports public `github.com` repositories only. It does not authenticate users, scan private repositories, or call an AI model.
