# ADR 0002 — Component ownership model

- Status: Accepted
- Date: 2026-06-04

## Context

Traditional component libraries lock consumers behind a versioned package: you
can't easily change a component without forking. shadcn popularized the opposite
— copy the source into your project and own it. Each model has a place.

## Decision

Support **both**, deliberately:

1. **Imported package primitives** (`import { Button } from "@elabs/components-ui"`).
   Stable, broadly-shared components and primitives. Centrally versioned and
   updated. This is the default for foundational UI, data/ai/flow/charts.

2. **Copy-owned registry items** (`npx shadcn add <item>`). Prototype-specific
   blocks and templates that a team will tweak per app. Copied into the
   consumer's repo; divergence is expected.

The dividing line:

- Will many apps share this _as-is_ and benefit from central updates? → package.
- Is this a starting point a team will heavily customize per app? → registry
  block/template (which may still _import_ the package primitives).

## Consequences

- Avoids the classic "locked library" problem without giving up a stable core.
- Registry blocks stay thin: they compose imported primitives, so copies don't
  re-implement foundations.
- Two distribution paths to maintain (packages + registry), documented in
  `docs/REGISTRY_GUIDELINES.md`.
