# @elabs-ai/components-flow

## 4.3.0

### Minor Changes

- 88f57c2: `FlowEdgeTokens` renders a weighted edge's live replay/animation state (position, active token count) as a compound indicator on the edge itself, for a consumer (`ProcessReplay`) driving tokens along the flow. `layoutFlowElk` adds an elkjs-powered layout adapter alongside the existing dagre/`layoutGraph` algorithms, for graphs whose layered layout benefits from ELK's constraint solver (e.g. a pinned backbone via `pinBackbone`); `elkjs` is an OPTIONAL peer dependency, loaded lazily on first use, with a development-only console warning and a dagre fallback when it is not installed.
- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

### Patch Changes

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [18f063e]
  - @elabs-ai/components-ui@4.3.0
  - @elabs-ai/components-tokens@4.3.0

## 4.2.0

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
