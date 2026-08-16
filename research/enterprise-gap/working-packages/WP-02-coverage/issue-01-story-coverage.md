---
TYPE: issue
TITLE: "[test] Story coverage to ~100% — start with the zero-story packages"
LABELS: type:tech-debt, severity:P1, area:test, area:docs, area:ai, area:icons, needs-triage
WP: WP-02
---

## Summary

Stories are the discovery + documentation + agent-capability surface (Storybook autodocs for humans,
the Storybook MCP for agents). Coverage is uneven: `@qlik-coe-emea/qlabs-components-icons` has **0** stories; `@qlik-coe-emea/qlabs-components-flow`,
`@qlik-coe-emea/qlabs-components-charts`, `@qlik-coe-emea/qlabs-components-marketing` have **1 each**; `@qlik-coe-emea/qlabs-components-ai` has **14 for 51 components**. The
rules require a story per component; this brings reality up to the rule. "Missing example = missing
agent capability" (research doc 02, lever 8).

## Source

Static repo analysis, 2026-06-06 (gaps C2b, A4). Counts via `find packages/*/src -name "*.stories.tsx"`.

## Severity & impact

**P1.** Unstoried components can't be verified across themes, don't appear in autodocs, and are
invisible to the Storybook-MCP agent path — so agents can't reliably use ~37 `@qlik-coe-emea/qlabs-components-ai` components,
all 8 icons, and most of flow/charts/marketing.

## Current state & why the gap exists

`@qlik-coe-emea/qlabs-components-ai` was vendored in bulk (AI Elements) faster than stories were authored; domain packages
(flow/charts/marketing/icons) shipped with a single demo story. The `ai-chat-components` rule already
says "every component needs a co-located `*.stories.tsx`" — this is drift from that rule.

## Proposed solution

Author co-located `*.stories.tsx` (with `tags: ["autodocs"]`) for every exported component, in
priority order:

1. **`@qlik-coe-emea/qlabs-components-icons`** (0 → 8+): a gallery story + per-icon autodocs; include `BrandLogo`.
2. **`@qlik-coe-emea/qlabs-components-flow`, `@qlik-coe-emea/qlabs-components-charts`, `@qlik-coe-emea/qlabs-components-marketing`** (1 → all): cover the documented states
   (e.g. flow: empty/populated/selected/zoomed; charts: each card; marketing: each section).
3. **`@qlik-coe-emea/qlabs-components-ai`** (14 → 51): prioritize the interactive/streaming states unique to chat (message
   append, tool-call, reasoning reveal) per the `ai-chat-components` rule.
4. Backfill the remaining `@qlik-coe-emea/qlabs-components-ui` (63 → 69) and `@qlik-coe-emea/qlabs-components-editor` gaps.

Use the Storybook MCP `get-storybook-story-instructions` before authoring (framework-correct
patterns), and verify with `preview-stories` across the six theme slugs.

## Affected files

- [ ] `packages/icons/src/**/*.stories.tsx` (new)
- [ ] `packages/flow/src/**/*.stories.tsx`, `packages/charts/...`, `packages/marketing/...` (new)
- [ ] `packages/ai/src/*.stories.tsx` (≈37 new)
- [ ] remaining `packages/ui` / `packages/editor` gaps
- [ ] `apps/docs/.storybook/preview.tsx` (confirm storySort groups for any new title groups)

## Acceptance criteria

- [ ] Every exported component has at least a Default story with `tags: ["autodocs"]`.
- [ ] `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` passes (interaction + axe) for the new stories.
- [ ] New stories render in all six themes via `preview-stories` (`globals=theme:<slug>`).
- [ ] No package has 0 stories.

## Test to add

`test-storybook` (interaction + axe) is the lock; it runs in CI per WP-01 (promote the
`storybook-tests` job to blocking once this lands).

## Risks / ripple effects

- Authoring stories may surface real a11y/contrast bugs — **file those separately** via `/file-issue`
  (finders report, builders fix); don't silently patch components inside the story PR.
- Large `@qlik-coe-emea/qlabs-components-ai` batch — split into per-area PRs to keep review sane.

## References

- `.claude/rules/ai-chat-components.md`, `.claude/rules/storybook-mcp.md`, `.claude/rules/quality-gates.md`
- research doc 02 §3/§8; gap C2b, A4
