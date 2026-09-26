# apps/diagram — architecture diagrams from YAML (test & demo app)

A local test-and-demo app for `@elabs-ai/components-flow`: it renders **system architecture diagrams** (cloud, SaaS, on-premises, data movement, security, "who runs what") from a **YAML definition** on the brand-ui flow canvas, and is the proving ground for the custom nodes, zones, edges and the YAML dialect that later move into the flow package (`flow/architecture`).

- **Not deployed. Not part of the standard gates.** Scripts are named `dev`, `build:local`, `typecheck:local`, `lint:local` on purpose, so turbo/CI never pick them up. There is no `test` script.
- **Everything about this app lives in this folder**: plan and research in `docs/`, work packages in `roadmap/`, examples in `examples/`, vendored icon packs in `public/icons/` (see `THIRD_PARTY_ICONS.md` once it exists; never publish them).
- **Only library components, templates and registry blocks are used.** Missing primitives are built in the library, not here. The app's own custom node/edge components are the one exception — that is the consumer's job by contract.

Start here: `docs/2026-09-26-plan.md` (decisions, dialect, phases) · `docs/2026-09-26-research.md` (landscape, licensing, React Flow facts, repo inventory) · `roadmap/README.md` (work packages).

```sh
pnpm --filter @elabs-ai/diagram dev          # once P0 has landed
```
