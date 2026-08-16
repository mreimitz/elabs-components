# Scope & non-goals (brand-ui is a presentation layer, not an SDK)

The operational detail for **D5**. The **canonical boundary statement lives once** in
[`docs/DECISIONS.md`](../../docs/DECISIONS.md) (§D5) — do not restate it here or in `PROJECT.md`;
link it. This rule carries only the _how-to-apply_. Human-facing non-goal: `PROJECT.md`
Non-goals. The durable _why_: ADR
[`0007`](../../docs/ADR/0007-presentation-layer-scope-boundary.md).

## What belongs where

The boundary in practice — when a concern comes up, this is the side it falls on:

| Concern                                             | Where it lives                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Rendering messages / surfaces / components          | **brand-ui packages** (`@qlik-coe-emea/qlabs-components-*`) — yes                   |
| Model calls, streaming, transport, providers, tools | **the consuming app / runtime** (e.g. the app's `useChat`) — not us                 |
| A batteries-included runtime (if ever wanted)       | an **example app** or a **registry template** — never inside the component packages |
| The `ai` SDK runtime (`useChat`, `@ai-sdk/*`)       | the app — `@qlik-coe-emea/qlabs-components-ai` imports the SDK **types only** (D6)  |

## Why it's a non-goal (not an omission)

A component library that grows a runtime becomes lock-in and stops being composable — the
opposite of the source-owned, build-with-it model (D1, D4). Keeping model/transport concerns
out of `@qlik-coe-emea/qlabs-components-*` is what lets many apps and many agents drive the same components. The
import-discipline half (types-only `ai`) is in
[`ai-sdk-vs-a2ui.md`](./ai-sdk-vs-a2ui.md) (D6) and enforced by a CI gate + hook (ADR
[`0008`](../../docs/ADR/0008-ai-sdk-types-only-dependency.md)).
