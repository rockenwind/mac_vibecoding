# Saved Scan Replay Design

## Goal

Users must be able to open saved scan results without running the scan again, and compare that saved result with the previous scan for the same repository.

## Scope

- Add a saved scan detail API at `/api/scans/[scanId]`.
- Return the saved scan, saved timestamp, and comparison against the previous scan for the same repository.
- Make recent scan history entries clickable in the web UI.
- Show when the user is viewing a saved scan.

## Exclusions

- No dedicated scan detail route page.
- No database schema change.
- No scanner rule changes.

## Success Criteria

- Clicking a recent scan loads its detailed finding cards.
- The comparison section shows new, resolved, and unchanged findings for the selected saved scan.
- Missing scan IDs return a 404 API response.
