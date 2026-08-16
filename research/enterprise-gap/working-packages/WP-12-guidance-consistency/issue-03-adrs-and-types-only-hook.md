---
TYPE: issue
TITLE: "[governance] ADRs for scope boundary + dependency posture; types-only-never-runtime hook"
LABELS: type:tech-debt, severity:P1, area:governance, area:ai, needs-triage
WP: WP-12
---

## Summary

Capture the two **irreversible** decisions as ADRs so the _why_ survives turnover and isn't silently
reversed — (D5) **brand-ui is a presentation layer, not an SDK/runtime**, and (D6) **the Vercel AI SDK
is a types-only, peer dependency, never a runtime one** — and back the latter with a **hook** that
blocks `@qlik-coe-emea/qlabs-components-ai` from importing the AI SDK runtime. A stated rule that nothing enforces is how the
"are we building our own SDK?" drift creeps back in.

## Source

The Vercel-AI-SDK / "are we building our own SDK?" discussion; [`../../06-guidance-architecture.md`](../../06-guidance-architecture.md)
D5/D6. Verified today: `@qlik-coe-emea/qlabs-components-ai` imports the SDK **types only** (12/51 files, all `import type`, no
`useChat`/providers/`streamText`); `ai` is a peer dep `^6.0.0`.

## Severity & impact

**P1.** These are the decisions most likely to be eroded by a well-meaning future change (someone adds
`useChat` to a component "for convenience," or grows a runtime into the core). The ADR records intent;
the hook makes the regression impossible.

## Current state & why the gap exists

`docs/ADR/` exists (4 ADRs) but none cover the scope boundary or the AI-SDK posture. The
`.claude/hooks/` set enforces tokens/boundaries/force-push but not the types-only rule.

## Proposed solution

- **ADR-0005 — brand-ui is a presentation layer (scope boundary).** Context (the generative-UI / A2UI
  / SDK pressure), decision (renders data models; does not own runtime/transport/protocol; batteries-
  included ships as example/template), consequences. Cross-link `PROJECT.md` Non-goals (D5).
- **ADR-0006 — Vercel AI SDK as a types-only peer dependency.** Decision: `@qlik-coe-emea/qlabs-components-ai` may `import type`
  the message model; never the runtime; pin the `ai` major and treat majors as planned migrations;
  alias the types behind a brand-ui boundary (a seam). Record the trade (ecosystem alignment vs being
  downstream of Vercel's model) and the revisit trigger (a vendor-neutral message standard, or a second
  message model from A2UI/AG-UI forcing a real abstraction).
- **Hook — `check-ai-sdk-types-only.sh`** (in `.claude/hooks/`, run in CI too): fail if any
  `packages/ai/**` file imports a **runtime** symbol from `ai`/`@ai-sdk/*` (`useChat`, `streamText`,
  `generateText`, providers) — i.e., allow `import type`, block value imports. Actionable message
  pointing at ADR-0006.

## Affected files

- [ ] `docs/ADR/0005-presentation-layer-scope-boundary.md` (new)
- [ ] `docs/ADR/0006-ai-sdk-types-only-dependency.md` (new)
- [ ] `.claude/hooks/check-ai-sdk-types-only.sh` (new) + register in `.claude/settings.json`
- [ ] `.github/workflows/ci.yml` (run the hook) — coordinate with WP-01
- [ ] `PROJECT.md` (Non-goals link to ADR-0005)

## Acceptance criteria

- [ ] ADR-0005 and ADR-0006 exist, with context/decision/consequences and revisit triggers.
- [ ] A hook + CI check **fails** on a runtime import from `ai`/`@ai-sdk/*` in `packages/ai/**`, and
      **passes** on `import type`.
- [ ] The hook's message points to ADR-0006.
- [ ] `PROJECT.md` Non-goals references ADR-0005 (the scope boundary).

## Test to add

A fixture: a `packages/ai` file with `import { useChat } from "ai"` fails the hook; the same with
`import type { UIMessage } from "ai"` passes. Lock it so the boundary can't silently erode.

## Risks / ripple effects

- The hook must allow legitimate `import type` and only block runtime values — get the AST/regex right
  (test both cases). Keep the blocked-symbol list current as the SDK evolves.

## References

- `../../06-guidance-architecture.md` D5/D6; the dependency discussion; `docs/ADR/` (existing),
  `.claude/hooks/check-package-registered.sh` (hook pattern to follow); WP-01 (CI), WP-10 (enforcement).
