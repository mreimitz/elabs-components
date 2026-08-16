---
TYPE: epic (tracking issue)
TITLE: "[test] WP-02 — Bring story/test/theme coverage to the documented bar"
LABELS: type:tech-debt, severity:P1, area:test, area:docs, needs-triage
---

## Summary

The repo's rules say "every component needs a story" and "story + smoke test = done", and "theme-safe
in all six themes" must be _observed_. Reality (verified counts, 2026-06-06): **~35 tests for ~162
components (~21%)**, four packages with **zero** tests, `@qlik-coe-emea/qlabs-components-icons` with **zero** stories, and
`@qlik-coe-emea/qlabs-components-ai` at 14 stories for 51 components. Because the Storybook MCP serves _stories_, an
unstoried component is invisible to the agent path — so this is both a quality gap and an
agent-capability gap. This package closes the gap between the documented gates and the actual repo,
and is only meaningful once WP-01 lands CI to enforce it.

## Verified baseline

| Package                                     | Components | Stories | Tests |
| ------------------------------------------- | ---------- | ------- | ----- |
| `@qlik-coe-emea/qlabs-components-ui`        | 69         | 63      | 18    |
| `@qlik-coe-emea/qlabs-components-ai`        | 51         | 14      | 4     |
| `@qlik-coe-emea/qlabs-components-editor`    | 14         | 9       | 9     |
| `@qlik-coe-emea/qlabs-components-icons`     | 8          | 0       | 0     |
| `@qlik-coe-emea/qlabs-components-flow`      | 6          | 1       | 0     |
| `@qlik-coe-emea/qlabs-components-marketing` | 6          | 1       | 0     |
| `@qlik-coe-emea/qlabs-components-data`      | 5          | 1       | 1     |
| `@qlik-coe-emea/qlabs-components-charts`    | 3          | 1       | 0     |

## Child issues

- **issue-01-story-coverage** — every component gets a story (start with the zeros). _(P1)_
- **issue-02-smoke-tests** — add render+behavior smoke tests to the four zero-test packages and
  raise `@qlik-coe-emea/qlabs-components-ai`. _(P1)_
- **issue-03-six-theme-aa-artifact-and-acme** — run the `brand-ui-audit` six-theme AA sweep, commit
  the report, fix any failures, and remove the orphan `acme` theme. _(P1)_

## Definition of done

- Story coverage ~100% across packages; `test-storybook` (interaction + axe) green in CI.
- Smoke tests exist for every package (no zero-test packages).
- A committed six-theme AA audit artifact with zero P0 contrast failures.
- Orphan `acme` theme removed (or promoted to `THEMES` if intended).
- Closes **C2, C2b, C3, C4, A4, B4**.

## Dependencies

Depends on **WP-01** (CI to enforce). Should precede **WP-05** so new widgets are born compliant.
