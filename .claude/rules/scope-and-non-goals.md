# Scope & non-goals (presentation layer, not an SDK)

Applies **D5**. The boundary statement lives ONCE in `docs/DECISIONS.md` §D5 — link it, never
restate it here or in `PROJECT.md` (human-facing home: its Non-goals).

| Concern                                         | Where it lives                                    |
| ----------------------------------------------- | ------------------------------------------------- |
| Rendering messages, surfaces, components        | `@elabs-ai/components-*`                          |
| Model calls/streaming/transport/providers/tools | the consuming app/runtime (its `useChat`)         |
| A batteries-included runtime                    | example app/registry template, never in a package |
| `ai` SDK runtime (`useChat`, `@ai-sdk/*`)       | app (`@elabs-ai/components-ai`: types only, D6)   |

A library that grows a runtime is lock-in and stops composing (D1, D4): keeping model/transport
out lets many apps and agents drive one component set (ADR 0007). Types-only `ai` (D6):
[`ai-sdk-vs-a2ui.md`](./ai-sdk-vs-a2ui.md), enforced by a CI gate + hook (ADR 0008).

History and measurements: docs/rules-history/scope-and-non-goals.md
