---
"@elabs-ai/components-flow": minor
---

`FlowEdgeTokens` renders a weighted edge's live replay/animation state (position, active token count) as a compound indicator on the edge itself, for a consumer (`ProcessReplay`) driving tokens along the flow. `layoutFlowElk` adds an elkjs-powered layout adapter alongside the existing dagre/`layoutGraph` algorithms, for graphs whose layered layout benefits from ELK's constraint solver (e.g. a pinned backbone via `pinBackbone`); `elkjs` is an OPTIONAL peer dependency, loaded lazily on first use, with a development-only console warning and a dagre fallback when it is not installed.
