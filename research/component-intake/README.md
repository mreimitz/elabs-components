# component-intake · one front door for "I have an idea for a new element"

A spec for a **single entry point** — `/new-element` — that you call with a rough idea and it decides
**what the idea should become** (reuse / extend / a base primitive / a composition / a registry block /
a template / a token / an icon / a hook / a playbook), then **routes** to the right existing builder.
Behind it sits a dedicated read-only **`element-classifier`** agent that scans the whole library first.

> Design only — nothing in `.claude/` or `packages/` is changed here.
> **Backlog:** [`working-packages/EI-01-element-intake/`](./working-packages/EI-01-element-intake/).

## Why this exists (the grounded gap)

`/new-component` today triages **only one axis — overlap** (reuse / extend / merge / replace / create),
then **assumes a package component** and scaffolds `packages/<pkg>/src/components/<name>/`. It has **no
classifier for _what kind_ of artifact** the idea is, and **no routing** to `/new-registry-item` (blocks/
templates), `/new-theme` (tokens), the icon flow, or playbooks. The taxonomy _exists_
(`.claude/rules/registry.md`: "component = single primitive; block = multi-part feature using installed
packages; template = a whole page composed of blocks") and the package-vs-registry decision _exists_
(`brand-ui-registry` / `/new-registry-item`) — but they're **siloed**, with no upstream router. This pack
adds that router.

## The decision model (two axes + the taxonomy)

The classifier answers two questions, in order, then places + routes:

**Axis 1 — Does it already exist? (overlap)** — the dedupe axis `/new-component` already has.
reuse · extend · merge · replace · genuinely-new.

**Axis 2 — What kind of artifact is it? (the missing axis)** — only when "genuinely new":

1. **Is it a component at all?** It might really be a **token**, an **icon**, a **hook/util**, or a
   **playbook** (a composition _pattern_, not a new exported component).
2. **Composition depth** (informational): a **primitive** (wraps a Radix primitive / native element,
   owns its markup) vs a **composition** (assembles existing `@qlik-coe-emea/qlabs-components-*` components). _Composition does
   NOT by itself mean "block"_ — `AppShell`, `DataTable`, and `ThemeSwitcher` are compositions that live
   in packages.
3. **Ownership / stability** (the deciding axis, per `registry.md`): **stable + shared across apps →
   package**; **prototype-specific + tweak-per-app → registry**.

### Routing table (idea → becomes → built by)

| The idea is really…                                                         | Becomes                             | Routed to                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| already covered                                                             | **reuse** (import path)             | nothing built — hand over the import                                                          |
| covered except a variant/prop/size                                          | **extend** existing                 | `/new-component` (extend path)                                                                |
| overlaps / supersedes an existing one                                       | **merge / replace**                 | `/new-component` (merge/replace plan)                                                         |
| a single primitive, stable & shared                                         | **package component** (primitive)   | `/new-component` → `@qlik-coe-emea/qlabs-components-<pkg>`                                    |
| a composition of `@qlik-coe-emea/qlabs-components-*` parts, stable & shared | **package component** (composition) | `/new-component` (reuse the children)                                                         |
| a composition, prototype-specific / tweak-per-app                           | **registry block**                  | `/new-registry-item` (`registry:block`)                                                       |
| a whole page / feature                                                      | **registry template**               | `/new-registry-item` (template)                                                               |
| a color / spacing / radius / motion value                                   | **token**                           | `/new-theme` + token-parity (WP-10 issue-05)                                                  |
| a glyph                                                                     | **icon**                            | `@qlik-coe-emea/qlabs-components-icons` (brand) or Lucide (generic) — DP-01 issue-03 boundary |
| reusable logic, no markup                                                   | **hook / util**                     | `/new-component`-style scaffold (no story/registry)                                           |
| a _pattern_ of composing existing parts                                     | **playbook / recipe**               | WP-09 playbook (not a new export)                                                             |

The placement sub-decision (which `@qlik-coe-emea/qlabs-components-*` package, or which `registry/` folder) reuses
`/new-component` Step 2 + `brand-ui-component`'s package map.

## The two pieces

1. **`/new-element` — the front door (the "one function").** Capture the idea (one line; ask 1–2
   clarifying questions only when they change the route — chiefly _"will many apps share this, or is it
   app-specific?"_, which resolves the ownership axis) → invoke the classifier agent → present its
   findings table + the single recommended route → **confirm via `AskUserQuestion`** → **hand off** to the
   matching existing builder, passing the classifier's notes (package, reuse targets, children to compose).
   The existing commands (`/new-component`, `/new-registry-item`, `/new-theme`) become the **builders
   behind** the door; experts can still call them directly.

2. **`element-classifier` — the scan-everything agent (read-only).** Its one job: map the **entire**
   library and return a structured classification. It reads the **ground truth** (the
   `brand-ui.manifest.json` + the generated `llms.txt` — see [agent-docs architecture, doc 11](../enterprise-gap/11-agent-docs-architecture.md)),
   the registry, and live stories via the Storybook MCP when up. It **does not build** (finders report,
   builders fix). A dedicated agent (not inline command logic) because the scan is context-heavy and
   reusable — the **vibe-coder plugin** can call the same classifier for end-users — and isolating it
   keeps the front-door command lean and the scan's tokens out of the main thread. Tier: **opus** (a
   structural taxonomy/placement decision), escalating to **design-system-architect** for the hardest
   new-package / subpath calls.

## Relationship to the rest of the program

- **Operationalizes** the gap found in the `/new-component` analysis (no artifact-kind classifier; no
  routing). Adds the canonical decision tree as `.claude/rules/element-intake.md` (one source — feeds
  **WP-12** guidance consistency).
- **Consumes** the agent-docs ground truth (**doc 11** — manifest + `llms.txt`) so the scan is complete
  and cheap; born-compliant scaffolding + gates come from **WP-10**; dedupe/merge outcomes feed
  **WP-13** (consolidation).
- **Reused by** the **vibe-coder-plugin** (the same classifier powers the plugin's "what should this be?"
  step for end-users).

---

_Grounded in `.claude/commands/new-component.md`, `new-registry-item.md`, `.claude/rules/registry.md` +
`conceptual-framing.md`, `skills/brand-ui-component` + `brand-ui-registry`, and the agent set. Design
only — another agent implements from [`EI-01`](./working-packages/EI-01-element-intake/)._
