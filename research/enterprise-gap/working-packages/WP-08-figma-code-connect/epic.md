---
TYPE: epic (tracking issue) — DEFERRED / OPTIONAL
TITLE: "[ai] WP-08 — Figma kit + Code Connect (design-to-code), optional"
LABELS: type:tech-debt, severity:P2, area:ai, area:docs, needs-triage
---

## Summary

The design-side equivalent of the manifest/MCP anti-hallucination story: a **Figma kit** with
Variables that map to the tokens, plus **Code Connect** linking each Figma component to its real
coded implementation, surfaced over the Figma Dev Mode MCP so agents generate code consistent with
`@qlik-coe-emea/qlabs-components-*` instead of guessing JSX. (Research doc 02, lever 7.)

## Status: explicitly deferred

brand-ui is **code-first and agent-first**, and `PROJECT.md` lists "no Figma dependency" as a
non-goal. So this is **P2 / optional** and only worth doing if a **design-driven workflow enters
scope** (designers handing off in Figma, or external/agency design input). It's recorded here for
completeness so the decision is explicit rather than an unnoticed gap.

## If/when in scope — issues

### issue-01 — Figma kit + token (Variables) round-trip

- Build a Figma library whose Variables map 1:1 to the DTCG tokens from **WP-04** (modes = the six
  themes). Without WP-04's structured tokens this is impractical, so **WP-08 depends on WP-04**.
- Acceptance: Figma Variables round-trip to/from the DTCG source; modes match the themes.

### issue-02 — Code Connect mappings for core components

- Map the high-traffic components (Button, Input/Form set, Card, Dialog, DataTable) to their coded
  implementations via Code Connect; verify the Figma Dev Mode MCP returns real props.
- Acceptance: Dev Mode shows the real `@qlik-coe-emea/qlabs-components-*` snippet + props for mapped components.

## Definition of done

- Only if scoped: a token-synced Figma kit + Code Connect for core components, validated via the
  Figma MCP. Closes **E6**.

## Dependencies

**Depends on WP-04** (DTCG tokens). Lowest priority in the program; do not start unless design-to-code
is a confirmed requirement.
