# scope-and-non-goals — history

Moved out of .claude/rules/scope-and-non-goals.md on 2026-09-06 so it stops loading into every session. This is the record of incidents, measurements and rejected alternatives behind the rule; the binding rule itself lives in the rule file.

This rule carried no incident log or measurements — only framing prose around the D5
"what belongs where" table and the one-paragraph rationale. The condensation kept every
placement decision in the table, every pointer (DECISIONS.md §D5, PROJECT.md Non-goals, ADR
0007, ai-sdk-vs-a2ui.md, ADR 0008) and the why in one sentence, and dropped the framing,
headings and restatements listed below. The full pre-condensation wording follows so each
dropped clause is preserved verbatim in its original position.

## What was dropped (each clause is verbatim in the original wording below)

- Intro: "The operational detail for **D5**." and "This rule carries only the
  _how-to-apply_." (kept as "Applies **D5**"); "The durable _why_: ADR 0007" (the ADR is now
  cited beside the why sentence); the Markdown link syntax around `docs/DECISIONS.md`, ADR
  0007 and ADR 0008 (kept as plain names — they resolve from the repo root).
- Section heading "## What belongs where" and its lead-in "The boundary in practice — when a
  concern comes up, this is the side it falls on:".
- Table cell asides: "— yes", "(e.g. the app's `useChat`) — not us", "(if ever wanted)",
  "never inside the component packages" (kept as "never in a package"), "imports the SDK
  **types only**" (kept as "types only").
- Section heading "## Why it's a non-goal (not an omission)".
- Why paragraph: "becomes lock-in and stops being composable — the opposite of the
  source-owned, build-with-it model (D1, D4)" (kept as "is lock-in and stops composing (D1,
  D4)"); "many apps and many agents drive the same components" (kept as "many apps and agents
  drive one component set"); "The import-discipline half (types-only `ai`) is in" (kept as
  "Types-only `ai` (D6):").

## Original wording (verbatim, as of 2026-09-06; links re-based to this directory)

# Scope & non-goals (brand-ui is a presentation layer, not an SDK)

The operational detail for **D5**. The **canonical boundary statement lives once** in
[`docs/DECISIONS.md`](../DECISIONS.md) (§D5) — do not restate it here or in `PROJECT.md`;
link it. This rule carries only the _how-to-apply_. Human-facing non-goal: `PROJECT.md`
Non-goals. The durable _why_: ADR
[`0007`](../ADR/0007-presentation-layer-scope-boundary.md).

## What belongs where

The boundary in practice — when a concern comes up, this is the side it falls on:

| Concern                                             | Where it lives                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Rendering messages / surfaces / components          | **brand-ui packages** (`@elabs-ai/components-*`) — yes                              |
| Model calls, streaming, transport, providers, tools | **the consuming app / runtime** (e.g. the app's `useChat`) — not us                 |
| A batteries-included runtime (if ever wanted)       | an **example app** or a **registry template** — never inside the component packages |
| The `ai` SDK runtime (`useChat`, `@ai-sdk/*`)       | the app — `@elabs-ai/components-ai` imports the SDK **types only** (D6)             |

## Why it's a non-goal (not an omission)

A component library that grows a runtime becomes lock-in and stops being composable — the
opposite of the source-owned, build-with-it model (D1, D4). Keeping model/transport concerns
out of `@elabs-ai/components-*` is what lets many apps and many agents drive the same components. The
import-discipline half (types-only `ai`) is in
[`ai-sdk-vs-a2ui.md`](../../.claude/rules/ai-sdk-vs-a2ui.md) (D6) and enforced by a CI gate + hook (ADR
[`0008`](../ADR/0008-ai-sdk-types-only-dependency.md)).
