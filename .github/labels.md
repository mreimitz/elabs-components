# Labels

The `type:*` / `severity:*` / `area:*` taxonomy that `.claude/rules/issue-workflow.md`
("Labels follow `.github/labels.md`") and `docs/ISSUE_WORKFLOW.md` ("Labels") promise, and
that `.claude/agents/brand-ui-root-cause-analyst.md`'s `LABELS:` line and
`/file-issue`/`/session-retro` apply when filing an issue.

Run this once against the repo (idempotent — `gh label create` no-ops with "already
exists", which the `|| true` swallows):

```bash
# --- type: what kind of finding ---------------------------------------------
gh label create "type:bug"        -c "#d73a4a" -d "Something doesn't work as intended" 2>/dev/null || true
gh label create "type:regression" -c "#d73a4a" -d "Worked before; broken now" 2>/dev/null || true
gh label create "type:a11y"       -c "#d73a4a" -d "Accessibility violation (keyboard, ARIA, contrast, semantics)" 2>/dev/null || true
gh label create "type:visual"     -c "#d73a4a" -d "Visual/UX defect — hierarchy, spacing, theming, consistency" 2>/dev/null || true
gh label create "type:tech-debt"  -c "#fbca04" -d "Not user-visible; cleanup, drift, or a convention without teeth" 2>/dev/null || true
gh label create "type:process"    -c "#6f42c1" -d "Agent process / workflow issue (session-retro)" 2>/dev/null || true

# --- severity: how bad -------------------------------------------------------
gh label create "severity:P0" -c "#b60205" -d "Blocking — broken build, data loss, security, or a hard accessibility failure" 2>/dev/null || true
gh label create "severity:P1" -c "#d93f0b" -d "Significant — a real defect on a shipped surface, no safe workaround" 2>/dev/null || true
gh label create "severity:P2" -c "#fbca04" -d "Minor — cosmetic, edge-case, or has a workaround" 2>/dev/null || true

# --- area: which package or cross-cutting surface -----------------------------
gh label create "area:ui"         -c "#1d76db" -d "@elabs-ai/components-ui" 2>/dev/null || true
gh label create "area:data"       -c "#1d76db" -d "@elabs-ai/components-data" 2>/dev/null || true
gh label create "area:ai"         -c "#1d76db" -d "@elabs-ai/components-ai" 2>/dev/null || true
gh label create "area:flow"       -c "#1d76db" -d "@elabs-ai/components-flow" 2>/dev/null || true
gh label create "area:maps"       -c "#1d76db" -d "@elabs-ai/components-maps" 2>/dev/null || true
gh label create "area:charts"     -c "#1d76db" -d "@elabs-ai/components-charts" 2>/dev/null || true
gh label create "area:marketing"  -c "#1d76db" -d "@elabs-ai/components-marketing" 2>/dev/null || true
gh label create "area:editor"     -c "#1d76db" -d "@elabs-ai/components-editor" 2>/dev/null || true
gh label create "area:viewer"     -c "#1d76db" -d "@elabs-ai/components-viewer" 2>/dev/null || true
gh label create "area:terminal"   -c "#1d76db" -d "@elabs-ai/components-terminal" 2>/dev/null || true
gh label create "area:tokens"     -c "#1d76db" -d "@elabs-ai/components-tokens (themes, ThemeProvider)" 2>/dev/null || true
gh label create "area:icons"      -c "#1d76db" -d "@elabs-ai/components-icons" 2>/dev/null || true
gh label create "area:registry"   -c "#1d76db" -d "registry/ — shadcn-compatible copy-own blocks/templates" 2>/dev/null || true
gh label create "area:docs"       -c "#1d76db" -d "docs/, READMEs, ADRs — not a package" 2>/dev/null || true
gh label create "area:governance" -c "#1d76db" -d "CLAUDE.md / .claude/rules / .claude/commands / .claude/hooks / .claude/agents" 2>/dev/null || true
gh label create "area:test"       -c "#1d76db" -d "Test infrastructure / CI gates, not a shipped package" 2>/dev/null || true

# --- cross-cutting (bare, not area:-prefixed) ---------------------------------
gh label create "meta" -c "#c5def5" -d "About how the agent works, not product code (session-retro)" 2>/dev/null || true
```

## Notes

- **Every filed issue carries one `type:*`, one `severity:*`, and one `area:*`** (a
  `[meta]` / `/session-retro` issue also carries the bare `meta` label — see
  `.github/ISSUE_TEMPLATE/session-retro.md`).
- **`area:*` names either a `@elabs-ai/components-<pkg>` package** (matching the package
  list in `CLAUDE.md`) **or one of the four cross-cutting surfaces** — `docs`,
  `governance`, `registry`, `test` — that don't map to a single package.
- If the GitHub connector or `gh` rejects an unknown label at issue-creation time
  (e.g. this script has not been run yet), `/file-issue` retries without labels and
  keeps the `LABELS:` line inside the issue body instead — see
  `.claude/commands/file-issue.md`.
- Adding a package (`CLAUDE.md` "Adding a new package or a public subpath export")
  should add its `area:<pkg>` row here in the same change.
