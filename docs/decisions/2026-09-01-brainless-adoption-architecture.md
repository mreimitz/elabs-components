# Architecture decisions — `theswerd/brainless` adoption wave (#102–#118)

- **Date:** 2026-09-01
- **Decider:** `brand-ui-design-system-architect`, dispatched as the structural gate required by
  `.claude/rules/quality-gates.md` § "Definition-of-Done battery" (row: _Structural / public-API /
  subpath_).
- **Scope:** the eight decisions the wave is blocked on (#114, #116, #102, #103, #106, #109 + #112,
  #111) plus the build order for #102–#118.
- **Status:** Accepted. Every item below is a **decision a builder executes without re-deriving it**.
  Nothing here is a proposal.
- **Not an ADR (yet).** These are wave-scoped build directives. Three of them are durable enough to
  warrant a real ADR once implemented — see § 10.
- **Work is already in flight** on `agents/brainless-adoption` (#104, #105, #107, #108, #112, #113),
  and three pieces of it have already diverged from § 6. **Read § 6.1 before touching anything** —
  the corrections are cheap now and permanent if they are not made before merge.

---

## 0. Facts this document treats as established

Verified in the working tree at `6d2b8d5`. A builder does **not** need to re-check them.

| Fact                                                                                                                                                                                             | Where                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| The one-way DAG is enforced from `package.json` `dependencies` + `peerDependencies` only; `devDependencies` are never checked.                                                                   | `scripts/check-dep-direction.mjs` `findDepDirectionViolations`                                    |
| `ALLOWED` is a closed map; **a `@elabs-ai/components-*` package absent from it is itself a violation**.                                                                                          | `scripts/check-dep-direction.mjs`                                                                 |
| `@elabs-ai/components-ai` never re-exports anything from `@elabs-ai/components-ui`. The barrel is 96 lines of own-module exports.                                                                | `packages/ai/src/index.ts`                                                                        |
| `packages/ai/src/_optional-peer.ts` has exactly three importers: `_mermaid-error-panel.tsx`, `interactive-terminal.tsx`, `audio-player.tsx`.                                                     | grep, whole repo                                                                                  |
| `ansi-to-react` has exactly **one** source importer in the repo: `packages/ai/src/terminal.tsx`.                                                                                                 | grep, whole repo                                                                                  |
| `@xterm/*` is reached only from `_interactive-terminal-xterm.ts`, `interactive-terminal.tsx` and their tests.                                                                                    | grep, `packages/ai/src`                                                                           |
| `highlightCode` (shiki) lives in `packages/ai/src/code-block.tsx:228` and is **not** exported from the `ai` barrel. `@elabs-ai/components-ui` does not depend on shiki at all.                   | `packages/ai/package.json`, `packages/ui/package.json`                                            |
| `ChangeReview`'s `ChangeHunk.before` / `.after` are `ReactNode`, and `renderHunk?: (hunk, { approved }) => ReactNode` is a caller-supplied render prop.                                          | `packages/ui/src/components/change-review/change-review.tsx:64-76, 448`                           |
| `ModelPickerItem` already carries `id / label / description / keywords / icon / meta[] / disabled` — a **superset** of #111's proposed `Workspace`. `ModelPicker` has **no** footer slot.        | `packages/ui/src/components/model-picker/model-picker-state.ts:38-68`, `model-picker.tsx:178-257` |
| `TeamSwitcher` is **sidebar-bound** (`SidebarMenu`, `useSidebar`) — it is app chrome, not a general picker.                                                                                      | `packages/ui/src/components/team-switcher/team-switcher.tsx`                                      |
| `mention-value.ts` is already trigger-parameterised; the **missing** half (`findQuery`, `isWordBoundary`) is private inside `mention-input.tsx:91-126`.                                          | both files                                                                                        |
| The `Confirmation*` → `ApprovalCard*` alias block is a flat 1:1 re-export of 10 parts.                                                                                                           | `packages/ai/src/confirmation.tsx:252-273`                                                        |
| `Terminal` has **no story and no test** today, and sits in `scripts/loading-states-baseline.json` as `@elabs-ai/components-ai::Terminal`. `InteractiveTerminal` has a story and four test files. | `packages/ai/src/`, `scripts/loading-states-baseline.json`                                        |
| The manifest crawler auto-discovers `packages/*` (`readdirSync`), so `pnpm manifest` picks a new package up with no list edit.                                                                   | `packages/cli/lib/docgen.mjs:287`                                                                 |
| `intent:check` rule 2 ("no empty spoke") only fires for a package that **has components** — an empty scaffold does not trip it.                                                                  | `scripts/check-intent-coverage.mjs:458-466`                                                       |
| A `brainless` attribution entry **already exists** (MIT, `Copyright (c) 2026 Ben Swerdlow`, `usedBy: [ai, ui]`), and its note states "No upstream code, styling or terminal palette is shipped." | `scripts/attributions.sources.json`                                                               |

---

## 1. #114 — new package `@elabs-ai/components-terminal`

### DECISION

**CONFIRMED.** Create `packages/terminal` as a **layer-2 leaf**: it may depend on `tokens`, `icons`
and `ui`; **no package may depend on it**, and in particular `@elabs-ai/components-ai` must never
list it (that is a layer-2 → layer-2 edge and `pnpm dep-direction:check` fails on it by
construction, since `ALLOWED["@elabs-ai/components-ai"]` will not contain it).

The justification is not "the maintainer said so" — it is that the package's **dependency profile
is disjoint from `ai`'s purpose**. A terminal emulator's optional peers (`@xterm/*`) and its ANSI
renderer (`ansi-to-react`) exist to reproduce a shell, not to render a `UIMessage`. Keeping them in
`ai` is what makes `ai` expensive to install (#33 / ADR 0032), and no composition need crosses the
boundary: a chat transcript that wants a terminal receives one as `children`, exactly as
`ApprovalCardTarget` receives a `DiffView` (§ 3).

### Template

**`packages/viewer/` is the template.** It is the most recent leaf, it already carries the
optional-peer shape terminal needs, and its `tsconfig.json` / `eslint.config.js` /
`vitest.config.ts` / `vitest.setup.ts` are copy-ready. Take `packages/ai/tsup.config.ts` for the
build config instead of viewer's (identical except the comment) — the `"use client"` banner
rationale is the same.

### `packages/terminal/package.json` — exact required content

```jsonc
{
  "name": "@elabs-ai/components-terminal",
  "version": "4.0.0", // match the lockstep set at the time of the change
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mreimitz/elabs-components.git",
    "directory": "packages/terminal",
  },
  "type": "module",
  "files": ["dist", "src"],
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/",
    "exports": {
      ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    },
  },
  "scripts": {
    "build": "tsup", // NO link-dist-css — this package ships no CSS
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "clean": "rm -rf dist .turbo coverage",
  },
  "dependencies": {
    "ansi-to-react": "^6.2.6", // added by #116, not by the scaffold
    "lucide-react": "^0.577.0",
  },
  "peerDependencies": {
    "@elabs-ai/components-tokens": "workspace:*",
    "@elabs-ai/components-ui": "workspace:*",
    "@xterm/addon-fit": "^0.11.0", // added by #116
    "@xterm/xterm": "^6.0.0", // added by #116
    "react": "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0",
  },
  "peerDependenciesMeta": {
    "@xterm/addon-fit": { "optional": true },
    "@xterm/xterm": { "optional": true },
  },
  "devDependencies": {
    "@elabs-ai/components-eslint-config": "workspace:*",
    "@elabs-ai/components-tokens": "workspace:*",
    "@elabs-ai/components-typescript-config": "workspace:*",
    "@elabs-ai/components-ui": "workspace:*",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "@xterm/addon-fit": "^0.11.0",
    "@xterm/xterm": "^6.0.0",
    "eslint": "^9.17.0",
    "jsdom": "^25.0.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.3",
    "vitest": "^3.0.2",
  },
}
```

Binding constraints on that manifest:

- **`@elabs-ai/components-ui` and `-tokens` go in BOTH `peerDependencies` and `devDependencies`** —
  peer so the consumer supplies one copy, dev so the workspace resolves them. This is the viewer
  shape verbatim; do not "simplify" it to a plain dependency.
- **`class-variance-authority` is NOT in the scaffold.** Add it in #117, when the first `cva`
  variant axis actually exists.
- **`@elabs-ai/components-icons` is NOT a dependency.** `terminal.tsx` uses `lucide-react` only, and
  `.claude/rules/icons.md` says generic glyphs come from Lucide. `icons` stays permitted in
  `ALLOWED` (a permission list, not a requirement) but is not declared.

### `packages/terminal/tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: '"use client";' },
  external: ["react", "react-dom"],
});
```

**No second `entry`.** A subpath export is gated by `.claude/rules/component-api.md` § "Subpath
exports" and neither condition holds here: the barrel's only heavy peers are already optional, and
no consumer needs a leaf without the trunk. If #117 later wants one, it comes back through this
agent.

### `src/index.ts` and the #101 constraint

The barrel must **never re-export a type that structurally references `@xterm/*`**. #101 is exactly
that bug in `ai`: the generated root `.d.ts` names an optional peer, so a `skipLibCheck: false`
consumer without xterm installed gets `TS2307`. In the new package:

- `_interactive-terminal-xterm.ts` keeps every `@xterm/*` type import.
- `interactive-terminal.tsx`'s **public** props/handle types are declared in terms of local
  structural types (the write/resize/dispose surface the component actually uses), never `Terminal`
  from `@xterm/xterm`.
- The barrel exports only those local types.

### Registration checklist — file by file

**Belongs to #114 (the scaffold):**

| #   | File                                 | Edit                                                                                                                                                                   |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/terminal/**`               | new: `package.json`, `tsconfig.json`, `tsup.config.ts`, `eslint.config.js`, `vitest.config.ts`, `vitest.setup.ts`, `src/index.ts`, `README.md` (generated region only) |
| 2   | `scripts/check-dep-direction.mjs`    | add `"@elabs-ai/components-terminal": [tokens, icons, ui]` to `ALLOWED`. **Without this the gate fails on the package's mere existence.**                              |
| 3   | `packages/cli/lib/render-docs.mjs`   | append `"@elabs-ai/components-terminal"` to `PKG_ORDER` **and** a one-line `PKG_PURPOSE` entry                                                                         |
| 4   | `CLAUDE.md`                          | the one-way dependency **prose** line (two places: "Architecture rules" and the package bullet list) — prose only, never inside a `<!-- brand-ui:gen:* -->` marker     |
| 5   | `.claude/commands/new-component.md`  | target-package list                                                                                                                                                    |
| 6   | `skills/brand-ui/SKILL.md`           | judgment prose **and** the frontmatter `description` package list                                                                                                      |
| 7   | `skills/brand-ui-component/SKILL.md` | routing prose **and** the frontmatter `description` package list                                                                                                       |
| 8   | `apps/docs/.storybook/preview.tsx`   | add `"Terminal"` to `storySort.order` (after `"Editor"`, before `"Viewer"`)                                                                                            |
| 9   | `apps/docs/.storybook/preview.css`   | `@source "../../../packages/terminal/src/**/*.{ts,tsx}";`                                                                                                              |
| 10  | `.github/labels.md`                  | `area:terminal` row **and** run the `gh label create` line                                                                                                             |
| 11  | `scripts/attributions.sources.json`  | add `"@elabs-ai/components-terminal"` to the `brainless` entry's `usedBy`, then `pnpm gen:attributions`                                                                |
| 12  | `CHANGELOG.md`                       | one line under `## Unreleased`                                                                                                                                         |
| 13  | —                                    | run `pnpm manifest`, then `pnpm agent-docs` (regenerates inventory / llms / context / gen regions / READMEs)                                                           |

**Deferred to #116** (each requires the package to contain a real client component; doing them in
#114 red-lights CI against an empty barrel):

| #   | File                                    | Edit                                                                                                                                                                                                                                 |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14  | `scripts/check-use-client-source.mjs`   | add `"terminal"` to `CLIENT_PACKAGES`                                                                                                                                                                                                |
| 15  | `scripts/check-eager-heavy-deps.mjs`    | add `"terminal"` to `WATCHED_PACKAGES` — **this is the item #114's issue body omits, and it is the one that matters**: without it a static `@xterm/xterm` import is unpoliced and `optionalPeersOf()` never runs for the new package |
| 16  | `scripts/check-consumer-install.mjs`    | add `"@elabs-ai/components-terminal/dist/index.js"` to `checkUseClient`'s `mustHave`                                                                                                                                                 |
| 17  | `fixtures/consumer-smoke/package.json`  | `"@elabs-ai/components-terminal": "*"`                                                                                                                                                                                               |
| 18  | `fixtures/consumer-smoke/src/main.tsx`  | import and render `Terminal` (the declarative one — it has no optional peer, so the "optional-peer-absent" proof still holds)                                                                                                        |
| 19  | `fixtures/consumer-smoke/src/index.css` | `@source "../node_modules/@elabs-ai/components-terminal/dist";`                                                                                                                                                                      |
| 20  | `packages/cli/lib/intent.mjs`           | re-home the `Terminal` / `InteractiveTerminal` entries (§ 2)                                                                                                                                                                         |

**Explicitly NOT required:** `pnpm-workspace.yaml` (globs `packages/*`), `turbo.json` (task-based,
not package-enumerated), the manifest crawler (auto-discovers), and
`scripts/gen-package-readmes.mjs`'s `SKIP_OPTIONAL_PEER_INSTALL` (that set is for
per-feature-adapter packages; terminal has one feature behind two peers, so it belongs in the base
Install block).

**A `.claude/rules/terminal-components.md` path-scoped rule is NOT part of #114.** Add it in #117
when there is policy to state (ANSI token discipline, agent-agnosticism), and add
`"terminal-components"` to `PATH_SCOPED` in `scripts/check-rule-scoping.mjs` in the same change.

### One binding sequencing constraint

**#114 ships an empty barrel and does not touch rows 14–20.** An empty package is legal:
`intent:check`'s empty-spoke rule is gated on `hasComponents`, `components:check` has nothing to
check, and `tsup` emits an empty chunk. But an empty package **cannot** satisfy `checkUseClient`'s
`mustHave` (no `"use client"` in an empty bundle) and cannot be imported by the smoke fixture. So
the "consumer smoke imports the new package" acceptance criterion on #114 is **reassigned to #116**,
which is the change that puts the first component there.

---

## 2. #116 — `_optional-peer.ts`, and what travels with the move

### DECISION (the shared helper)

**PROMOTE, do not duplicate.** `isOptionalPeerMissing` and `isModuleNotFoundMessage` move to
`@elabs-ai/components-ui`.

- **Exact home:** `packages/ui/src/lib/optional-peer.ts`
- **Barrel:** exported from `packages/ui/src/index.ts` alongside the other `lib/` helpers (`cn`,
  `downloadBlob`, `normalizeFileSource`, `fileIconFor`, …)
- **The import path every consumer uses, verbatim:**
  ```ts
  import { isOptionalPeerMissing, isModuleNotFoundMessage } from "@elabs-ai/components-ui";
  ```
- **No subpath export.** `.claude/rules/component-api.md` § "Subpath exports" requires both a
  materially lighter dependency tree **and** a real consumer that needs the leaf without the trunk.
  Every current call site (`audio-player.tsx`, `interactive-terminal.tsx`,
  `_mermaid-error-panel.tsx`) already imports the `ui` barrel for `Button` / `StatePanel` /
  `useLocale`. Condition 2 fails. Barrel export only.
- **`packages/ai/src/_optional-peer.ts` is DELETED** and its three importers rewired. No re-export
  shim: it is an underscore-prefixed private module, never in the `ai` barrel, so nothing public
  breaks.

Why promote rather than duplicate, given that the file's own doc comment defends duplicating the
viewer's version: **that argument does not apply here.** The viewer duplication exists because `ai`
and `viewer` are DAG **siblings** (layer 2 ↔ layer 2) — an import between them is illegal. `ui` is
**upstream** of both `ai` and `terminal`, so this is an ordinary, legal downward edge. And ADR 0032
is explicitly a whole-repo policy; a whole-repo policy whose detector is copy-pasted per package is
precisely the "documented in prose only" failure `.claude/rules/quality-gates.md` § "Enforcement
over reminders" forbids. The predicate is also safety-critical in the quiet direction — a false
negative shows a consumer a raw module-resolution stack trace — which is the worst kind of logic to
keep three drifting copies of.

**Follow-up, deliberately NOT part of #116:** `packages/viewer/src/core/errors.ts` still carries its
own string-matching fallback (`isModuleNotFound` / `isModuleNotFoundMessage`). The viewer already
peer-depends on `ui`, so it can adopt the promoted helper and delete its fallback half — but its
PRIMARY path is a typed `ViewerError`, so the duplicate is inert, and folding it in would put a
third shipped package into an already-breaking release. **File it as a separate `type:tech-debt`
issue; do not do it inside #116.**

### DECISION (`ansi-to-react` and the `@xterm/*` peers)

**Both move wholesale. Nothing stays behind in `@elabs-ai/components-ai`.**

`ansi-to-react`:

- one source importer in the entire repo (`packages/ai/src/terminal.tsx`), so it is a clean cut
- moves from `ai`'s `dependencies` to `terminal`'s `dependencies` — a plain dependency, **not** a
  peer. It is a small JSX renderer, not a heavy engine, and it is not on `HEAVY_DEPS`.
- **do not hand-edit its attribution row.** `.claude/rules/attribution.md` says dependencies are
  harvested from the manifests; re-run `pnpm gen:attributions` and let `usedBy` re-derive.

`@xterm/xterm` + `@xterm/addon-fit`:

- move **all three declarations** for each — `peerDependencies`, `peerDependenciesMeta.optional`,
  and `devDependencies` — from `ai` to `terminal`, unchanged in version and in optionality. The
  ADR 0032 Variant A shape is preserved exactly; this move re-homes it, it does not revisit it.
- after the move `ai`'s `peerDependenciesMeta` retains only `@rive-app/react-webgl2`, `ai`,
  `media-chrome`, `mermaid` — two of the four heavy engines #33 targets are gone.
- `optionalPeersOf()` derives the heavy-deps policing from `peerDependenciesMeta`, so the
  dynamic-`import()` requirement follows the peers automatically **once `"terminal"` is in
  `WATCHED_PACKAGES`** (row 15 above). That row is not optional.

### The full move set (larger than the issue body states)

```
packages/ai/src/terminal.tsx                               → packages/terminal/src/terminal.tsx
packages/ai/src/interactive-terminal.tsx                   → packages/terminal/src/…
packages/ai/src/interactive-terminal.stories.tsx           → packages/terminal/src/…
packages/ai/src/interactive-terminal.test.tsx              → packages/terminal/src/…
packages/ai/src/interactive-terminal-missing-peer.test.tsx → packages/terminal/src/…
packages/ai/src/interactive-terminal-retry.test.tsx        → packages/terminal/src/…
packages/ai/src/_interactive-terminal-xterm.ts             → packages/terminal/src/…
packages/ai/src/_interactive-terminal-xterm.test.ts        → packages/terminal/src/…
```

**`terminal.stories.tsx` and `terminal.test.tsx` do not exist** — the issue body lists them
speculatively. #116 must **author** them (see the baseline rule below).

`_lazy-engine-boundary.tsx` does **not** move (used by `audio-player` and `persona` only).
`_optional-peer.ts` does not move to `terminal` either — it goes **up** to `ui` (above).

### Ratchet baselines — the trap, and how to clear it without `--force`

Four baselines carry moved keys:

| Baseline                               | Key                                                          | Under `baseline-provenance:check`? | Action                             |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------- | ---------------------------------- |
| `scripts/loading-states-baseline.json` | `@elabs-ai/components-ai::Terminal`                          | **YES**                            | see below                          |
| `scripts/data-slot-baseline.json`      | `packages/ai/src/terminal.tsx`, `…/interactive-terminal.tsx` | no                                 | `pnpm data-slot:check -- --update` |
| `scripts/raw-palette-baseline.json`    | `packages/ai/src/terminal.tsx`                               | no                                 | its own `--update`                 |
| `scripts/text-scale-baseline.json`     | `packages/ai/src/terminal.tsx`                               | no                                 | `pnpm text-scale:check --update`   |

`baseline-provenance:check`'s git-provenance rung **fails on any key the branch ADDED**. Re-keying
`@elabs-ai/components-ai::Terminal` to `@elabs-ai/components-terminal::Terminal` is an _added_ key
at the git level, so the naive move needs `--force` — which is reserved for "a rare, justified
ratchet-up" and this is not one.

**DECISION: do not re-key it. Retire it.** #116 authors
`packages/terminal/src/terminal.stories.tsx` with a story that renders `Terminal` with
`isStreaming` at its not-ready value (`.claude/rules/loading-states.md` — `isStreaming` is the
canonical streaming signal and `Terminal` already declares it, `packages/ai/src/terminal.tsx:198`).
The key is then **removed** from `loading-states-baseline.json` via
`pnpm loading-states:check --update` — a ratchet **down**, which provenance accepts with no
`--force`. `Terminal` moving into a package where it is a headline component and arriving with its
first-ever story is the right outcome regardless.

### `packages/cli/lib/intent.mjs`

`INTENT` is a flat map keyed by component name, so the `Terminal` / `InteractiveTerminal` entries
stay where they are and only their `category` changes. `CATEGORIES` in
`scripts/check-intent-coverage.mjs:87-100` has no `"terminal"` member.

**DECISION: add `"terminal"` to `CATEGORIES` and to the `category` enum comment in the `intent.mjs`
schema header, and set both moved entries to `category: "terminal"`.** The enum already mixes UI
categories with package-shaped ones (`ai`, `chart`, `flow`); a package that is a first-class routing
destination in D3 gets its own value. Leaving them as `category: "ai"` would make `brand-ui docs`
route a terminal question into the chat package.

### Everything else #116 must carry

- **#99** (the cached rejected promise in `loadXTermEngine()`) and **#101** (optional-peer types in
  the root `.d.ts`) are fixed **in this change** — the barrel constraint in § 1 is the #101 fix.
- `docs/CONSUMING.md` — a migration line naming the old and new import.
- `CHANGELOG.md` `## Unreleased` — marked **breaking**.
- A **major version bump across the lockstep set** is a release-time action, not a unit action —
  `docs/RELEASING.md` owns it. The unit records the break; it does not bump versions.

---

## 3. #102 — `DiffView` package placement

### DECISION

**`DiffView` ships in `@elabs-ai/components-ai`. It is NOT forced into `ui`, and no sideways
dependency is created.**

### Why `ai` and not `ui`

The deciding fact is the dependency profile, not the taxonomy. `DiffView` is specified to reuse
`highlightCode` (shiki) from `packages/ai/src/code-block.tsx` so a diff and a code block agree on
tokenisation and theme. `@elabs-ai/components-ui` **does not depend on shiki**. Building `DiffView`
in `ui` therefore means one of three things, all worse:

1. add shiki to `ui` — pushing a heavy highlighter onto the **layer-1 foundation package every
   other package peer-depends on**. That is the single most expensive dependency decision available
   in this repo and it is unjustified by one component.
2. ship `DiffView` without intra-line highlighting — losing the stated reason it exists.
3. add a `highlight?: (code, lang) => ReactNode` injection prop to a `ui` component and make every
   consumer wire shiki themselves — an opaque escape hatch on the foundation package.

Against that, the cost of `ai` is zero: `ai` already depends on shiki, already owns the agent
transcript, and `Message` / `Tool` / `Task` are the surfaces a diff appears inside.

### How a consumer wires `DiffView` (ai) into `ChangeReview` (ui)

**Neither package imports the other. The composition happens in the app, which depends on both.**
There are two supported wirings, and both are pure dependency injection:

```tsx
// The app's file — it depends on both packages, which is legal and ordinary.
import { ChangeReview, type ChangeHunk } from "@elabs-ai/components-ui";
import { DiffView } from "@elabs-ai/components-ai";

// (a) the render-prop seam — one renderer for every hunk
<ChangeReview
  hunks={hunks}
  renderHunk={(hunk, { approved }) => (
    <DiffView lines={linesFor(hunk.id)} file={hunk.title} variant="inline" />
  )}
/>;

// (b) the node seam — ChangeHunk.after is already `ReactNode`
const hunks: ChangeHunk[] = raw.map((h) => ({
  id: h.id,
  title: h.file,
  after: <DiffView lines={h.lines} file={h.file} />,
}));
<ChangeReview hunks={hunks} />;
```

`renderHunk` is a **caller-supplied function prop** and `before`/`after` are **`ReactNode`** — both
are already injection seams. `ui` never names `DiffView`; `ai` never names `ChangeReview`. This is
the same pattern `scripts/check-dep-direction.mjs` records for the viewer ("NOT -ai (ADR 0024 §6:
AssetPreview reaches new formats by injection, not import)"), applied in the mirror direction.

### Binding constraints on the builder

- **`ChangeHunk` gains NO `lines` field, and `DiffLine` does not go into `ui`.** Putting a diff line
  model in the foundation package to serve a component that lives in `ai` recreates the coupling by
  the back door. `ChangeHunk` stays `before`/`after` `ReactNode`.
- Both wirings above must be shown in a story — one of them in
  `packages/ai/src/diff-view.stories.tsx` as a `ChangeReview` composition. `ai` already dev-depends
  on `ui`, and `devDependencies` are invisible to `dep-direction:check`, so a story composing the
  two is legal and is the right place to prove the seam.
- `highlightCode` stays **internal to `ai`** — do not promote it to the `ai` barrel as part of this
  change. `DiffView` imports it relatively, as `code-block.tsx`'s existing internal consumers do.

---

## 4. #103 — the `ApprovalCard*` / `Confirmation*` two-family surface

### DECISION

**The `Confirmation*` family is CLOSED. Every new part in #103 ships under `ApprovalCard*` only,
with no `Confirmation*` alias.**

### The rule, written so a builder cannot get it wrong

1. `packages/ai/src/confirmation.tsx` currently exports **ten** `Confirmation*` values and their
   `*Props` types, each aliased 1:1 to an `ApprovalCard*` name at lines 252–273. That set is
   **frozen at exactly those ten**.
2. A new part is declared **once**, named `ApprovalCard<Part>`, as a **real implementation** — not
   as an alias of anything. Its props type is `ApprovalCard<Part>Props`.
3. **Do not extend the alias block.** New names never appear in it.
4. Supporting types introduced by #103 (`ApprovalOption`, `ApprovalScope`) carry **no**
   `Confirmation` twin.
5. The parts #103 adds are therefore, and only: `ApprovalCardOptions`, `ApprovalCardTarget`,
   `ApprovalCardReason` (+ their `*Props`).
6. The existing binary path is untouched. `Confirmation` / `ConfirmationApprove` /
   `ConfirmationDeny` and their aliases keep rendering byte-identically.

### Why

The two families are **not** peer names for one component. `Confirmation*` is a compatibility
surface that mirrors the AI-Elements shape this package was vendored from; the file's own comment
says so ("the `Confirmation*` exports stay for the AI-Elements-shaped API (non-breaking). New code
reaches for `ApprovalCard`"). An N-option, scoped, deny-with-reason permission card **has no
AI-Elements counterpart**. Minting `ConfirmationOptions` would fabricate an upstream-shaped API that
never existed upstream, double the public surface for zero migration value, and hand every future
reader an unanswerable question about which name is canonical. `.claude/rules/design-system.md`
§ Restraint and the "smallest change that keeps the system consistent" constraint point the same way.

### Enforcement (a convention ships with its teeth)

Prose in a 700-line component file will not survive the next contributor. #103 must add, in
`packages/ai/src/confirmation.test.tsx`:

```ts
import * as confirmation from "./confirmation";

/**
 * The `Confirmation*` family is a CLOSED compatibility surface mirroring the
 * AI-Elements shape (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4).
 * New parts are `ApprovalCard*` only. Adding a name here is a decision, not a fix.
 */
const FROZEN_CONFIRMATION_EXPORTS = [
  "Confirmation",
  "ConfirmationTitle",
  "ConfirmationDescription",
  "ConfirmationRequest",
  "ConfirmationAccepted",
  "ConfirmationRejected",
  "ConfirmationActions",
  "ConfirmationAction",
  "ConfirmationApprove",
  "ConfirmationDeny",
].sort();

it("does not grow the Confirmation compatibility family", () => {
  const actual = Object.keys(confirmation)
    .filter((k) => k.startsWith("Confirmation"))
    .sort();
  expect(actual).toEqual(FROZEN_CONFIRMATION_EXPORTS);
});
```

Also add a one-line comment immediately above the alias block at `confirmation.tsx:252` stating the
family is closed and pointing at this section.

---

## 5. #106 — slash-command palette: generalise `ui`, consume from `ai`

### DECISION

**GENERALISE in `@elabs-ai/components-ui`. Do not build a second trigger algorithm in
`@elabs-ai/components-ai`.** But the generic machinery gets its **own module** — it does not stay
buried under `components/mention-input/`.

### The shape

- **New file: `packages/ui/src/lib/trigger-query.ts`** — the generic, component-agnostic trigger
  machinery. Zero React, zero DOM, zero knowledge of mentions.
- `mention-value.ts` **keeps** every mention-specific export it has today (`Mention`,
  `MentionValue`, `MentionOption`, `mentionEnd`, `mentionAt`, `remapMentions`, `insertMention`,
  `serializeMentions`, `defaultMentionFilter`) and imports the generic half from
  `../../lib/trigger-query`.
- The two **private** functions in `mention-input.tsx:91-126` (`isWordBoundary`, `findQuery`) are
  **deleted from that file** and re-expressed in the new module. This is the "unclaimed
  generalisable half" #106's root-cause analysis names.

Why a new module rather than growing `mention-value.ts`: #106's root cause is **discoverability** —
"trigger-driven inline palettes were implemented twice as local features and never named as a shared
capability". A shared algorithm parked inside one component's folder is findable only by someone who
already knows about that component, which is the failure repeating itself. `ui/src/lib/` is where
this repo puts pure, cross-component helpers (`cn`, `file-kind`, `document-address`, `merge-refs`,
`compact-number`) and is exported from the barrel.

### Exact API additions

```ts
// packages/ui/src/lib/trigger-query.ts

/**
 * Where a trigger character is allowed to START a query.
 *
 * `"word"`       — index 0, or preceded by whitespace / "(" / "[".  (`MentionInput`'s
 *                  behaviour, unchanged — an "@" inside an email address must not open a popup.)
 * `"line-start"` — index 0, or preceded by "\n".  (A slash palette: "/help" opens, "cd /usr" does not.)
 */
export type TriggerBoundary = "word" | "line-start";

/** An in-progress `trigger + query` run under the caret. */
export interface TriggerQuery {
  /** Offset of the trigger character in `text`. */
  start: number;
  /** The query WITHOUT the trigger character. */
  query: string;
}

export interface FindTriggerQueryOptions {
  /** @default "word" */
  boundary?: TriggerBoundary;
  /**
   * Veto a candidate whose trigger character has already been consumed by a
   * committed token — `MentionInput` passes `mentionAt(...)` here so an
   * inserted "@Ada Lovelace" cannot re-open the popup. Omit when there are no
   * committed tokens (a slash palette has none).
   */
  isTriggerConsumed?: (start: number) => boolean;
}

/**
 * Is the caret sitting inside a `trigger + query` run?
 *
 * DERIVED from committed text + caret, never intercepted at keydown — a
 * keydown-driven trigger must `preventDefault()` every printable character and
 * re-insert it by hand, which destroys IME composition, native undo, spellcheck
 * and paste. Deriving means the popup opens identically whether the trigger
 * arrived by typing, pasting, an IME commit, or a click that moved the caret
 * back into a half-typed query.
 */
export function findTriggerQuery(
  text: string,
  caret: number,
  trigger: string,
  options?: FindTriggerQueryOptions,
): TriggerQuery | null;

/** The plain-text half of an insert: splice `insertText` over the run, and say where the caret lands. */
export function replaceTriggerRun(
  text: string,
  queryStart: number,
  caret: number,
  insertText: string,
): { text: string; caret: number };
```

**`findTriggerQuery` must reproduce today's `findQuery` exactly**, in this order:

1. `caret < trigger.length` → `null`
2. `start = text.lastIndexOf(trigger, caret - trigger.length)`; `start < 0` → `null`
3. `query = text.slice(start + trigger.length, caret)`; `/\s/.test(query)` → `null`
4. boundary test per `boundary` → `null` on failure
5. `options.isTriggerConsumed?.(start)` → `null` when true
6. otherwise `{ start, query }`

**`insertMention` must be refactored to call `replaceTriggerRun`** for its text splice and caret
maths, so exactly one splice implementation exists. Its mention-remapping behaviour and its return
type (`InsertMentionResult`) are unchanged.

### `MentionInput` is unaffected — the proof obligation

- `mention-input.tsx` replaces its private call with:
  ```ts
  const queryInfo = useMemo(
    () =>
      findTriggerQuery(value.text, caret, trigger, {
        isTriggerConsumed: (start) => mentionAt(value, start, trigger) !== undefined,
      }),
    [value, caret, trigger],
  );
  ```
  `boundary` is omitted, so it takes the `"word"` default — byte-for-byte today's behaviour.
- **`MentionInputProps` gains NO new prop.** A `boundary` prop on `MentionInput` is not needed by
  #106 (the composer drives the algorithm directly, rendering through `PromptInputCommand*`), so
  adding one would be surface for nobody.
- **`mention-input.test.tsx`, `mention-value.test.ts` and both mention story files must pass
  untouched.** If any of them needs an edit, the refactor is wrong — revert and re-derive. This is
  the acceptance test for "existing behaviour is unaffected".
- `mention-value.test.ts` gains nothing; a new `packages/ui/src/lib/trigger-query.test.ts` covers the
  generic module, including a `"line-start"` case and the `isTriggerConsumed` veto.

### Barrel

Add the four new symbols to `packages/ui/src/index.ts` (next to the other `./lib/*` exports). Do
**not** route them through `components/mention-input/index.ts` — they are not part of that
component's surface any more.

### What `ai` then does

`packages/ai/src/prompt-input-slash.tsx` imports `findTriggerQuery` + `replaceTriggerRun` from
`@elabs-ai/components-ui`, calls the first with `{ boundary: "line-start" }`, renders through the
existing `PromptInputCommand*` parts, and wires `aria-activedescendant` via the existing
`onActiveItemIdChange`. **`ai` does not import from `@elabs-ai/components-editor`** — that is a
sideways edge; the markdown slash menu is prior art to read, never to import.

---

## 6. #109 + #112 — the shared check-result shape

### DECISION

**Canonical home: `@elabs-ai/components-ui`. Canonical name: `CheckResult`.** `ChangeCheck` is
rejected as a second name for one concept.

- **File:** `packages/ui/src/lib/check-result.ts`
- **Exported from:** `packages/ui/src/index.ts`
- **`ai` imports it; `ai` does NOT re-export it.** `packages/ai/src/index.ts` re-exports nothing from
  `ui` today (96 lines, all own-module), and one name must have one home. A consumer of `AgentEvent`
  imports the type from `@elabs-ai/components-ui`, which is already a peer dependency of `ai`, so it
  is always installed.

### The interface text — both builders paste this verbatim

```ts
// packages/ui/src/lib/check-result.ts

/**
 * One verification verdict about an action — a linter, a type check, a test run,
 * a policy hook. Shared vocabulary across packages: `ChangeReview` (#112) shows the
 * checks a proposed edit already passed, `AgentEvent` (#109) shows the checks a
 * runtime hook ran around a tool call. One runtime concept, one shape.
 *
 * Presentational only (D5): this type records a verdict someone else computed.
 * Nothing in brand-ui ever runs a check.
 *
 * Rendering contract, binding on every consumer: `ok` must reach the user through
 * an ICON and ACCESSIBLE TEXT, never through colour alone — the greyscale test in
 * `.claude/rules/accessibility.md`.
 */
export interface CheckResult {
  /** What ran, verbatim as the runtime names it: "eslint", "tsc", "pre_tool_use". */
  label: string;
  /** Did it pass? The verdict; the only required field besides `label`. */
  ok: boolean;
  /** One line of explanation. Renders as a secondary line, collapsed when long. */
  detail?: string;
  /** Wall-clock duration in milliseconds. Format with `formatElapsed`. */
  durationMs?: number;
  /** When it ran relative to the action it gates. Groups results into sections. */
  phase?: "before" | "after";
}

/** A count summary, when the individual verdicts are not available. */
export interface CheckSummary {
  /** How many checks ran. */
  ran: number;
  /** How many of them passed. `passed <= ran`. */
  passed: number;
}
```

### Consequential decision: the duration formatter also lives in `ui`

#109's acceptance criteria say its durations must use the same elapsed formatter as #105
(`TurnStatus`, in `ai`). #112 needs the same formatter in `ui`, and **`ui` cannot import `ai`**.
There is exactly one home that serves all three.

- **File:** `packages/ui/src/lib/format-duration.ts`, exported from the `ui` barrel. Keep the name
  **`formatElapsed`** — it is already authored, documented and attributed in
  `packages/ai/src/turn-status.tsx`; renaming it would be churn for nothing.
- **#105 does not declare its own.** `TurnStatus` imports `formatElapsed` from
  `@elabs-ai/components-ui`. #105's "exports the elapsed formatter so a consumer's own surfaces agree
  with ours" is satisfied by the `ui` export — the formatter is public, and it is the same function.
- Both files (`check-result.ts`, `format-duration.ts`) are delivered by **one unit, before any
  consumer** — see § 8, unit **U0**.

### 6.1 Reconciliation with work already in flight

**Read this before touching anything.** At the time of this decision the branch
`agents/brainless-adoption` already contains uncommitted work for #104, #105, #107, #108, #112 and
#113, and three of those pieces have already diverged from the decision above. The divergence is
cheap to fix **now** (nothing is merged) and permanent if it is not.

| In flight today                                                                                                                                                             | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChangeCheck` declared in `packages/ui/src/components/change-review/change-review.tsx:75`, fields identical to `CheckResult`                                                | **RENAME to `CheckResult` and RELOCATE to `packages/ui/src/lib/check-result.ts`.** No alias under the old name — #112 is unmerged, so there is no compatibility obligation. The package half of #112's instinct was right (the type belongs in `ui`); the naming and the placement are not. A shared type named after ONE of its two consumers is what makes the second consumer reluctant to import it, which is how the duplicate #112's own risk section warns about gets created. It also currently lives inside a component module, so `ai` would be importing a `ChangeReview` internal. |
| `formatElapsed` in `packages/ai/src/turn-status.tsx:26` (`"8.0s"` / `"45s"` / `"2m05s"`, no ms rung)                                                                        | **MOVE to `packages/ui/src/lib/format-duration.ts`**, keep the name, keep the attribution comment. `turn-status.tsx` imports it from `@elabs-ai/components-ui` and the `ai` barrel stops exporting it.                                                                                                                                                                                                                                                                                                                                                                                         |
| `formatCheckDuration` in `change-review.tsx:481` (`"420ms"` / `"1.5s"`, no minute rung) — **a second, disagreeing duration formatter, already shipped in the same package** | **DELETE it.** Its whole job folds into `formatElapsed` by adding one rung below a second: `<1000ms → "420ms"`, otherwise today's `formatElapsed` unchanged. That is a strict superset — every input ≥ 1000 ms formats exactly as `formatElapsed` already does, and every input < 1000 ms exactly as `formatCheckDuration` already does. Two functions answering "how long did this take" in one repo is the precise drift § 6 exists to prevent, and it is already here.                                                                                                                      |

The unified function, verbatim:

```ts
// packages/ui/src/lib/format-duration.ts

/**
 * Human-readable elapsed time — one formatter for every "how long did this take"
 * surface in the system: `TurnStatus`'s running turn (#105), `ChangeReview`'s check
 * rows (#112), `AgentEvent`'s hook durations (#109).
 *
 * Exported so a consumer's own elapsed-time surfaces agree with ours.
 * Adapted from `brainless`'s turn-status elapsed formatter (MIT, see `ATTRIBUTION.md`).
 *
 * Rungs: sub-second → "420ms" · under ten seconds → "8.0s" · under a minute → "45s" ·
 * beyond → "2m05s".
 */
export function formatElapsed(elapsedMs: number): string;
```

**Sequencing consequence:** the in-flight #112 and #105 work must be rebased onto U0 (§ 8), or U0's
three files must be lifted out of that branch into their own commit that lands first. Either is
fine; what is not fine is merging #112 with `ChangeCheck` in it, because #109 then either imports a
badly-named `ChangeReview` internal or declares the second type.

### Per-issue application

- **#112 (`ChangeReview`, ui):** `ChangeHunk` gains `checks?: CheckResult[]`. **The name
  `ChangeCheck` does not survive** — see § 6.1, it is already in the tree and must be renamed and
  relocated before merge. `phase` groups the rows into before/after sections when both are present.
  A failing check never blocks approval.
- **#109 (`AgentEvent`, ai):** `checks?: CheckSummary | CheckResult[]`, imported from `ui`.
  `AgentEvent`'s own `phase?: "before" | "after" | "lifecycle"` is a **separate, wider prop** on the
  event, not the per-check `phase` — they answer different questions ("when did this event fire" vs
  "when did this check run") and must not be collapsed.

---

## 7. #111 — `WorkspacePicker` package placement

### DECISION

**`@elabs-ai/components-ui`.** And it is built **on `ModelPicker`**, not beside it.

### Why `ui`

`.claude/rules/scope-and-non-goals.md` (D5) settles it before taste does: the acceptance criteria
already forbid any filesystem access — the component receives a list and reports a string. A "pick
one of these identified things, with secondary metadata, one of them current" control has nothing
agent-specific in it. A file browser, a deploy-target chooser and a repository switcher all want the
same component. `ai` is for surfaces that render an agent's _output_; this renders the user's
_context_, before an agent exists.

### Why it is a preset over `ModelPicker`, not a new picker

`.claude/rules/quality-gates.md` § "Reuse audit (do this FIRST)" applies to **patterns**, not only
components (`.claude/rules/design-first.md` § "Patterns over instances"). The audit result is
unambiguous:

- `ModelPickerItem` is `{ id, label, description?, keywords?, icon?, meta?: string[], disabled? }` —
  a **superset** of #111's proposed `Workspace` (`id`; `name` → `label`; `path` → `description`;
  `meta` → `meta`). Nothing in `Workspace` is new.
- `ModelPicker` already ships the Popover + `Command` body, grouped rows, the full state grid
  (`idle`/`loading`/`ready`/`stale`/`error`/`empty` via `modelPickerBody`), a designed empty panel, a
  retry action, a controlled/uncontrolled `open`, and `aria-label` discipline. #111's acceptance
  criteria are, line for line, things `ModelPicker` already does.
- **`TeamSwitcher` is the wrong neighbour to copy.** It imports `SidebarMenu` / `useSidebar` and only
  renders inside a `Sidebar` context — it is app chrome, not a general picker. A `WorkspacePicker`
  modelled on it would be unusable in the launch card (#110) that needs it.

So: **`WorkspacePicker` is a thin, semantically-named component that composes `ModelPicker`** — the
same relationship `ApprovalCard` has to `Confirmation`, except that this one adds a real feature
rather than only a name.

### The one additive change `ModelPicker` needs

`ModelPicker` has no slot for the free-text path entry. Add, additively:

```ts
// ModelPickerProps
/**
 * Rendered inside the popover BELOW the list — a persistent action row that is
 * not one of the options (a free-text entry, a "browse…" affordance).
 * Outside `CommandList` on purpose: it must not be filtered by the search query
 * and must not participate in cmdk's roving selection.
 */
footer?: ReactNode;
```

Rendered after `</CommandList>` and before `</PopoverContent>` (`model-picker.tsx:255-257`), inside
the `Command` element. Optional, so every existing `ModelPicker` story and test is unchanged.

### `WorkspacePicker`'s surface

Keep #111's proposed props verbatim (`workspaces`, `currentId`, `onSelect`, `onSubmitPath`) and add
`status?: ModelPickerStatus` passed straight through, so the state grid is inherited rather than
re-implemented. Internally it maps `Workspace[]` to one `ModelPickerGroup` and renders the path entry
into `footer`. The current workspace is marked **in the row's accessible text**, not only by
`ModelPicker`'s check glyph.

**Home:** `packages/ui/src/components/workspace-picker/`.
**#110's session launch card (ai) composes it as a child** — `ai` already depends on `ui`, so that is
a normal downward import, not injection.

---

## 8. Build order for #102–#118

### Starting position (this is not a green field)

`agents/brainless-adoption` already carries uncommitted work for **#104, #105, #107, #108, #112 and
#113**. The plan below is still the plan; what changes is that **U0 is extracted from that branch
rather than authored from nothing**, and #112/#105 are rebased onto it with the § 6.1 renames
applied. Do that extraction first, before starting any new unit — every hour that work sits
unrebased is an hour in which a seventh unit copies the wrong type name.

### The three-phase plan

```
PHASE A  (serial, 1 unit, merges before anything else)
  U0 — shared `ui` seams
       packages/ui/src/lib/check-result.ts      (§ 6)
       packages/ui/src/lib/format-duration.ts   (§ 6)
       packages/ui/src/lib/optional-peer.ts     (§ 2 — promoted; ai keeps its private copy
                                                  until #116 deletes it. The two coexist for
                                                  one merge window, which is fine: nothing
                                                  imports the ui one yet.)
       packages/ui/src/lib/trigger-query.ts     (§ 5) + mention-input/mention-value refactor
       ModelPicker `footer` slot                (§ 7)
       packages/ui/src/index.ts                 (one barrel edit for all of it)
  Unblocks: #105, #106, #109, #111, #112.
  One unit on purpose: five small edits to one package, one barrel edit, one CHANGELOG line —
  splitting them would mean five serial merges into the same barrel.

PHASE B  (three lanes, concurrent with each other)
  Lane T (terminal — SERIAL within the lane)
      #114  scaffold + registration rows 1–13         ─┐
      #116  the move + registration rows 14–20         │ strictly serial
      #117  CLI look-alike family  (needs #114+#115+#116)
      #118  registry CLI session blocks (needs #117)  ─┘
  Lane K (tokens — independent, may start at t=0)
      #115  terminal token group (ANSI-16 + agent accents)
            must MERGE before #117 starts
  Lane U (ui components — concurrent with each other, after U0; MERGE serially)
      #112  ChangeReview checks
      #113  keyboard-shortcuts sheet
      #111  WorkspacePicker

PHASE C  (ai components — starts only after #116 has MERGED; all concurrent)
      #102  DiffView
      #103  ApprovalCard N-option    ┐ same owner as #104
      #104  permission-mode chooser  ┘
      #105  TurnStatus + SessionStatusBar
      #106  slash-command palette
      #107  operating-mode / reasoning-effort control
      #108  Plan decision contract
      #109  AgentEvent
      #110  session launch card
```

### Why each serialisation exists

| Constraint                                 | Reason                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U0 before #105, #106, #109, #111, #112** | those five consume symbols U0 creates. A builder that cannot import `CheckResult` will invent one, and then there are two.                                                                                                                                                                                                                               |
| **#114 before #116**                       | the destination package must exist.                                                                                                                                                                                                                                                                                                                      |
| **#116 before ALL of Phase C**             | #116 **removes** two `export *` lines from `packages/ai/src/index.ts` and **deletes** `packages/ai/src/_optional-peer.ts`, rewiring `audio-player.tsx`. Nine concurrent branches appending to that barrel while one removes from it, plus a deleted module three files import, is the worst merge shape in the wave. Serialising costs one merge window. |
| **#115 before #117**                       | the CLI family renders ANSI colour from tokens; without them it would hardcode a palette, which `pnpm raw-palette:check` and the no-raw-hex rule both forbid.                                                                                                                                                                                            |
| **#117 before #118**                       | registry blocks copy-own compositions of components that must exist.                                                                                                                                                                                                                                                                                     |
| **#103 and #104 share one owner**          | both define permission vocabulary (`ApprovalScope` vs a standing mode). Two owners produce two vocabularies for one concept — the exact failure § 6 exists to prevent. Concurrency is allowed; split ownership is not.                                                                                                                                   |
| **Lane K is independent of Lane T**        | #115 touches `packages/tokens` only; #114/#116 never touch it.                                                                                                                                                                                                                                                                                           |
| **#102 and #103 are concurrent**           | `ApprovalCardTarget` receives a `DiffView` as `children`. That is a runtime composition in the consumer's tree, not a code dependency.                                                                                                                                                                                                                   |

### Files a SINGLE owner must write (never two builders in parallel)

| File / group                                                                                                                                                                                                                                                                                                                                                                                            | Owner                                                       | Rule                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All derived artifacts** — `brand-ui.manifest.json`, `apps/docs/public/component-inventory.md`, `apps/docs/public/llms.txt`, `apps/docs/public/brand-ui-context.md`, the `<!-- brand-ui:gen:* -->` regions in `CLAUDE.md` / `AGENTS.md` / `PROJECT.md` / `Introduction.mdx` / `skills/brand-ui/SKILL.md`, every `packages/*/README.md` generated region, `ATTRIBUTION.md`, `attributions.generated.ts` | **orchestrator, on `main`**                                 | `.githooks/pre-commit` regenerates and stages these on every `packages/*/src/**` commit, so every unit branch WILL carry them and they WILL conflict. **Never resolve one by hand.** Take either side, then run `pnpm agent-docs` on the merged tree and commit its output as authoritative.                                             |
| **Ratchet baselines** — `loading-states`, `variants`, `states`, `data-slot`, `text-scale`, `raw-palette`, `separation`, `a11y`, `microtypography`                                                                                                                                                                                                                                                       | **orchestrator, on `main`, via each gate's own `--update`** | **No unit may ADD a baseline key.** `baseline-provenance:check` fails on any key a branch adds, and a new component that needs an exemption is a new component that is not done. The only legitimate baseline write in this wave is #116's set of removals (§ 2), a ratchet _down_. Hand-editing any baseline fails the provenance gate. |
| `scripts/attributions.sources.json`                                                                                                                                                                                                                                                                                                                                                                     | **#114 only**                                               | the `brainless` entry already exists. The single edit is adding `"@elabs-ai/components-terminal"` to `usedBy`. **No other unit touches this file** — dependency rows are harvested from manifests, never hand-added (`.claude/rules/attribution.md`).                                                                                    |
| `CLAUDE.md` prose, `skills/*/SKILL.md` prose + `description`, `.claude/commands/new-component.md`, `.github/labels.md`, `apps/docs/.storybook/preview.tsx`, `apps/docs/.storybook/preview.css`                                                                                                                                                                                                          | **#114 only**                                               | package registration, one change.                                                                                                                                                                                                                                                                                                        |
| `scripts/check-dep-direction.mjs`                                                                                                                                                                                                                                                                                                                                                                       | **#114 only**                                               |                                                                                                                                                                                                                                                                                                                                          |
| `scripts/check-use-client-source.mjs`, `scripts/check-eager-heavy-deps.mjs`, `scripts/check-consumer-install.mjs`, `fixtures/consumer-smoke/**`, `scripts/check-intent-coverage.mjs` (`CATEGORIES`)                                                                                                                                                                                                     | **#116 only**                                               |                                                                                                                                                                                                                                                                                                                                          |
| `packages/ui/src/index.ts`                                                                                                                                                                                                                                                                                                                                                                              | **U0 first, then #111/#112/#113 append**                    | Phase B Lane U is three branches appending to one barrel. Append at the end of the relevant block; conflicts are additive and resolvable, but merge the lane **serially**.                                                                                                                                                               |
| `packages/ai/src/index.ts`                                                                                                                                                                                                                                                                                                                                                                              | **#116 removes, then Phase C appends**                      | see the serialisation table.                                                                                                                                                                                                                                                                                                             |

### Files every unit touches (append-only discipline, orchestrator resolves)

- **`CHANGELOG.md` `## Unreleased`** — `pnpm changelog-entry:check` requires a line from every unit
  that touches `packages/<distributable>/src/**`. **Append at the END of the section**, one line,
  never re-order existing lines. Append-only turns an irreconcilable conflict into a trivial one.
- **`packages/cli/lib/intent.mjs`** — `intent:check`'s coverage ratchet freezes today's uncovered `ai`
  root surfaces, so **every new `@elabs-ai/components-ai` component in Phase C MUST ship an intent
  entry** (purpose, category, relationships, `stateTokens`, `antiPatterns`) or the gate reds. Add
  your own keys only; never touch another unit's.
- **`packages/ui/src/components/locale-provider/messages.ts`** — `pnpm microcopy:check` (ADR 0017)
  requires user-facing strings to go through `t()`. Same append-only rule.

### Wave-wide constraints every builder inherits

1. **#115 is a `themes.css` / token-value edit**, so `.claude/rules/quality-gates.md` § Theme-safe
   requires a `brand-ui-visual-ux-reviewer` **cross-theme sweep on a real, unmodified app screen**
   before merge. Contrast tests and `test-storybook` are necessary and not sufficient. Budget for it.
2. **The attribution entry says "No upstream code, styling or terminal palette is shipped."** #115's
   ANSI-16 palette must be **authored on this repo's token discipline**, not transcribed from
   upstream. If a builder finds themselves copying colour values, the attribution note is now false
   and the change needs a different note — stop and re-route.
3. **Every new component ships clean**: barrel export, co-located story exercising its `cva` values
   (`variants:check`) and its not-ready state (`loading-states:check`), a smoke test, an intent entry,
   tokens only, both themes observed. No new baseline exemptions (see the table above).
4. **#116 is breaking.** The version bump is a **release-time** action per `docs/RELEASING.md`; the
   unit records the break in `CHANGELOG.md` and `docs/CONSUMING.md` and does not edit versions.

---

## 9. Rejected alternatives, recorded so they are not re-litigated

| Alternative                                                           | Rejected because                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DiffView` in `@elabs-ai/components-ui`                               | it would put shiki on the layer-1 foundation package every other package peer-depends on, to serve one component. The injection seams (`renderHunk`, `ReactNode` slots) already exist.                     |
| A `lines?: DiffLine[]` field on `ChangeHunk`                          | recreates the `ui` → diff-model coupling through the type system after refusing it through the import graph.                                                                                               |
| Duplicating `_optional-peer.ts` into `packages/terminal`              | the DAG argument that justifies the viewer duplication (siblings) does not apply — `ui` is upstream of both. Three drifting copies of a safety-critical predicate whose failure mode is a raw stack trace. |
| Aliasing #103's new parts as `Confirmation*` too                      | fabricates an AI-Elements-shaped API that never existed upstream, doubles the surface, and makes "which name is canonical" unanswerable.                                                                   |
| `ChangeCheck` (ui) and `CheckResult` (ai) as separate types           | one runtime concept, two names, guaranteed to drift — the failure #112's own risk section names.                                                                                                           |
| A `@elabs-ai/components-ui/lib/check-result` subpath export           | fails condition 2 of the subpath gate: no consumer needs the leaf without the trunk.                                                                                                                       |
| `WorkspacePicker` in `@elabs-ai/components-ai`                        | nothing in it is agent-specific, and the reuse audit finds an existing component whose item type is a strict superset of the proposed one.                                                                 |
| `WorkspacePicker` modelled on `TeamSwitcher`                          | `TeamSwitcher` requires a `Sidebar` context; the launch card (#110) has none.                                                                                                                              |
| A second trigger algorithm in `ai` for the slash palette              | third copy of the same algorithm; #106's own acceptance criteria forbid it.                                                                                                                                |
| Adding a `boundary` prop to `MentionInput`                            | nothing in this wave consumes it; public surface for no consumer.                                                                                                                                          |
| #114 landing empty **with** the consumer-smoke wiring                 | an empty bundle carries no `"use client"` and exports nothing to import; `checkUseClient` and the fixture both red.                                                                                        |
| Re-keying `@elabs-ai/components-ai::Terminal` in the loading baseline | `baseline-provenance:check` reads a re-key as an ADDED key and needs `--force`. Writing the missing story retires the key instead — a ratchet down, and the right outcome anyway.                          |

---

## 10. Follow-ups this document deliberately does not resolve

- **`packages/viewer/src/core/errors.ts`** still carries a third copy of the module-not-found string
  matcher. File a `type:tech-debt` issue to adopt the promoted `ui` helper; **do not do it inside
  #116** (its primary path is a typed error, so the duplicate is inert, and #116 is already a
  breaking change to a second package).
- **Three of these decisions are durable beyond this wave and should become ADRs once implemented:**
  (a) the `terminal` package boundary and why an agent-transcript package does not own a terminal
  emulator; (b) the promotion rule — _a helper shared by two layer-2 siblings moves UP to `ui`, it is
  never duplicated sideways_; (c) the closed-compatibility-family rule for `Confirmation*`. Raise
  them with the maintainer after the wave lands rather than pre-writing ADRs for unbuilt code.
- **Taste-profile interaction with the CLI look-alikes** was not examined; #117 should route back
  through this agent if the family wants a register fork (it should not — no component may fork
  behaviour on the register).
