# Finding Detail Reporting Design

## Goal

Repository scan results must explain each finding in a way a user can act on without opening the raw JSON report.

## Scope

- Add a top-level risk summary after a scan that highlights critical and high findings.
- Make each finding show Korean labels for vulnerability, impact, evidence, affected location, and required action.
- Add priority wording per severity so critical and high findings are clearly distinguished.
- Improve recent scan history with the highest-risk finding title.

## Exclusions

- No scanner rule changes.
- No AI-generated remediation.
- No GitHub Issue workflow changes.

## Success Criteria

- A user can see what vulnerability was found, why it matters, and what action is needed from the main scan results screen.
- Existing report download and JSON details continue to work.
