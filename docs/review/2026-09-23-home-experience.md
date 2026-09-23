# Home experience review — templates as lived-in products (2026-09-23)

Trigger: the maintainer's brief after the chart-interaction track closed — "enhance the entire
home implementation with more real-life use cases leveraging multiple components, build more
templates with our app shells; the target is to make home a truly mind-blowing experience for
agents and humans." This review looks at `apps/home` as it stands on `feat/chart-interaction-track`
(`5bd0d48`), rendered locally at 1440 px in the light theme, and turns the gap between what the
templates ARE and what the site SAYS about them into an ordered track.

Outcome: `roadmap/home-experience/` (RM-147 … RM-153), three waves — the experience layer on the
22 templates that exist, new multi-package use-case templates on `workspace-shell`, and the home
landing narrative that lets a visitor enter by the world they work in.

Status (2026-09-23, `feat/home-developer-platform`): all seven items are done — see each item's
"Outcome" section. 25 templates, every one with a domain; three new products (energy, security,
developer platform); `/` and `/templates` enter by world; template pages carry the theme bar.

## 1. What home has today (evidence)

Rendered and read: `/`, `/templates`, `/templates/market-desk`, `/templates/agentic-ai-workspace`,
`/agents`, `/start`, `/blocks`, `/visualizations`; code: `components/catalog/doc-page.tsx`,
`app/(catalog)/templates/[slug]/page.tsx`, `lib/template-entries.ts`, `content/prompts.ts`,
`components/catalog/block-render-meta.ts`, `components/gallery/{sections,template-showcase}.tsx`,
`registry/blocks/market-desk-page/market-desk-page.tsx`, `registry/blocks/workspace-shell/`.

**What is strong.** `/agents` and `/start` are the best pages on the site: one route, absolute
urls, the prompt a visitor pastes, the done gate. `/templates` lists 22 templates in three
families with live crops of the working area (`thumb-crop.ts`, anchored on the shell's content
column). Eleven `<name>-page` registry items are whole products on `workspace-shell` and render
natively on the site (`NATIVE_BLOCKS` stage `screen`): revenue ops, control tower, agent ops
center, customer 360, support desk, incident command, market desk, project hub, agent studio,
A2UI assistant, process explorer. Each composes ≥ 2 blocks and ≥ 4 packages and has a real
interaction (the market desk's ticket validates, reviews and fills a blotter).

**What is weak — the findings.**

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                               | Root cause (file)                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | A template page is a screenshot with chips. Under the native render: a "Packages" badge row, the scaffold chip, a prompt card — then a second "Examples" section that repeats the SAME screen as a Storybook iframe (blank when Storybook is unreachable). No scenario (who sits in front of it, what happens), no tour of the views the nav rail promises (Market · Watchlist · Charts · Orders), no map of the blocks and components it is made of. | `doc-page.tsx`: `examples = heroProp \|\| nativeBlock ? page.stories : rest` re-lists every story as an iframe even when the hero already rendered it natively; `templates/[slug]/page.tsx` passes no narrative — `lead` falls back to the registry description's first sentence. |
| b   | The agent hand-off sits at the bottom of a long page and is generic. `DocPage` suppresses its own `PromptCard` for templates (`showAgentRoute = … && page.section !== "templates"`), the page supplies one via `children`, so it lands under the chips. The prompt says "build this on top of the scaffold" — it never names the blocks the template is made of, so an agent copies a screenshot's worth of intent, not a recipe.                     | `templates/[slug]/page.tsx` L72–102; `content/prompts.ts` `newProjectPrompt` has no `blocks` argument.                                                                                                                                                                            |
| c   | The home page's featured template tile ("Agentic AI Workspace") renders blank in the container while the five crops beside it render natively — the one template the site leads with is the one without a registry item, so it depends on the Storybook origin.                                                                                                                                                                                       | `sections.tsx` `FEATURED_TEMPLATE = "agentic-ai-workspace"` → `StoryThumb`; `featuredTemplateCopy.parts` hard-codes that template's parts.                                                                                                                                        |
| d   | "Made of" is generated data nobody shows. `registry.json` already carries `registryDependencies` (`command-center-market-tape-01`, `workspace-shell`) and `dependencies` per `-page` item, and `catalog-pages.json` carries them on `page.block` — the template page shows only the package names as badges.                                                                                                                                          | `templates/[slug]/page.tsx` L60–71.                                                                                                                                                                                                                                               |
| e   | No machine-readable template recipe. `/llms.txt` and `/llms/<pkg>` describe packages; an agent asked "build me a support desk" has to read the site's HTML to learn that `support-desk-page` exists, what it composes and the one command that copies it in.                                                                                                                                                                                          | `app/llms/[pkg]/route.ts` is per package; nothing lists templates.                                                                                                                                                                                                                |
| f   | Domain coverage is business-ops heavy. Eleven products, all sales/ops/support/agents. Nothing for the worlds the newest blocks were built for — the energy desk (`energy-desk-01`) and the incident explorer (`incident-explorer-01`) have no product around them; no security, clinical, people, developer-platform or merchant product.                                                                                                             | `registry/registry.items.json` categories `template`.                                                                                                                                                                                                                             |
| h   | Eleven of the 22 template pages have NO agent hand-off at all. The page gates its scaffold chip and prompt card on `playbook`, and playbooks are the six CLI archetypes — so every `<name>-page` template (the whole products) renders chips and nothing an agent can paste.                                                                                                                                                                          | `templates/[slug]/page.tsx` `playbook = playbooks.find(p => p.archetype === slug)` → `{playbook ? … : null}`.                                                                                                                                                                     |
| g   | The landing page's "What are you building?" is a grid of six. A visitor from a domain has to know the product name to find their world; there is no "pick your world" entry, and no theme swap on a template page to see the product in a brand family.                                                                                                                                                                                               | `sections.tsx` `UseCasesSection`; `doc-page.tsx` has no theme control.                                                                                                                                                                                                            |

## 2. Reference products

- **The component-vendor template galleries** (the two shadcn-derived block registries): every
  template page leads with the screen, then "what's inside" as a list of the blocks it composes,
  each linking to its own page, then one install line. That "made of" list is what we are missing
  and what our registry already knows.
- **Design-tool community files**: a template is sold by its scenario ("a fintech dashboard for
  a treasury team"), with a per-screen walkthrough. Our nav rails already name the screens.
- **Agent-first docs** (`llms.txt` convention): one text file per thing an agent may want,
  addressable by url, with the exact commands. We do this per package; templates need it most.

## 3. Decisions

1. **A template page is a product page, not a component page.** Order: the live screen → the
   scenario (two sentences: who, what happens) → the agent hand-off (command + prompt, above the
   fold) → the tour (one line per nav view) → made of (blocks with links, packages with links) →
   examples only for stories the hero did NOT already render → the API/theming tail. The narrative
   is authored once per template in `content/template-tours.ts`; the made-of list is generated
   from `page.block.registryDependencies` / `dependencies`, never typed.
2. **The home page leads with a template that renders natively.** The featured tile is a
   `-page` registry item; its parts row is generated from the template's tour, not hard-coded.
3. **Every new template is a `<name>-page` registry item on `workspace-shell`** (registry.md D4),
   composes ≥ 2 registry blocks and ≥ 4 packages, has ONE real interaction path (something the
   visitor can do that changes the screen — a ticket, a triage, a period), seeded data only, a
   story at `apps/docs/stories/templates-<name>.stories.tsx` with a play function, and a copy under
   `apps/home/components/blocks/` registered in `NATIVE_BLOCKS` as `screen`.
4. **Agents get templates as text.** `/llms/templates` lists every template with its scenario,
   views, blocks, packages and the copy/scaffold command; each template page's prompt names the
   blocks. Same generated data as the human page.
5. **Honest copy stays.** No "mind-blowing" in the copy. The experience is the screens
   themselves, the tour and the one-paste hand-off.

## 4. Scope

In: `apps/home` (template pages, home showcase, `/llms/templates`, landing narrative), new
`registry/blocks/<name>-page` items with their stories and data, `scripts/lib/home-catalog-layout.json`
entries, `content/template-tours.ts`. Out: package changes (none needed; a defect found while
building a template is filed, not fixed in the template), the Storybook app beyond the new
stories, the CLI `create` archetypes.

## 5. Work packages

See `roadmap/home-experience/README.md`. Wave 1 (RM-147 … RM-149) is the experience layer on
what exists; wave 2 (RM-150 … RM-152) is new products; wave 3 (RM-153) is the landing narrative.

## 6. Not planned

- Static screenshots as thumbnails (ADR 0038 keeps live renders; the native path removes the
  Storybook dependency where it matters).
- A theme-family picker on every catalogue page — only on template pages (RM-153), where a
  whole product is on screen.
- Testimonials, counters, "trusted by" (home.md: honest copy).
