# Roadmap track — Home experience: templates as products (`apps/home`, `registry`)

Source review: `docs/review/2026-09-23-home-experience.md`.
Decision: a template page is a **product page** — the live screen, the scenario, the agent hand-off above the fold, a tour of the views the nav rail names, and "made of" generated from the registry item's own dependencies; the home page leads with a template that renders natively; every new template is a `<name>-page` registry item on `workspace-shell` that composes ≥ 2 blocks and ≥ 4 packages and has one real interaction path; agents get the same data as text at `/llms/templates`. Items follow the chart-interaction track's format (frontmatter + Finding / Change / Acceptance / Test-gate / Orchestrator notes). Status values: `planned`, `in-progress`, `done`, `dropped` — update the frontmatter and the table together.

Orchestration: `ORCHESTRATOR-PROMPT.md` in this folder is the kickoff prompt. An item is done only on gate-green, **browser-verified** evidence — the home site built and rendered in Chromium, light + dark, 390 / 1440 px, the template's interaction exercised in its story's play function.

## Items

| ID     | Title                                                                                                                                                 | Wave | Priority | Effort | Depends on    | Agent / model                       | Status  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------ | ------------- | ----------------------------------- | ------- |
| RM-147 | Template product page: scenario, hand-off above the fold, tour of views, generated "made of", no repeated examples                                    | 1    | P0       | M      | —             | brand-ui-component-builder / opus   | done    |
| RM-148 | Home showcase leads with a native template; parts row generated from the tour; template prompt names the blocks                                       | 1    | P0       | S      | 147           | brand-ui-component-builder / sonnet | done    |
| RM-149 | `/llms/templates`: every template as text — scenario, views, blocks, packages, commands                                                               | 1    | P1       | S      | 147           | brand-ui-component-builder / sonnet | done    |
| RM-150 | `energy-operations-page`: a utility's site desk — `energy-desk-01` + site table + site map + an analyst dock (charts · data · maps · ai · ui)         | 2    | P0       | M      | 147           | brand-ui-component-builder / opus   | planned |
| RM-151 | `security-ops-page`: a SOC — alert queue, `incident-explorer-01`, asset map, triage dock with an agent's tool calls (data · charts · maps · ai · ui)  | 2    | P0       | M      | 147           | brand-ui-component-builder / opus   | planned |
| RM-152 | `developer-platform-page`: a CI/CD control room — pipeline graph, run log, failing diff, deploy stats (flow · terminal · editor · charts · data · ui) | 2    | P1       | M      | 147           | brand-ui-component-builder / opus   | planned |
| RM-153 | Landing narrative: "pick your world" domain entry on `/` and `/templates`, theme-family swap on template pages                                        | 3    | P1       | M      | 148, 150, 151 | brand-ui-component-builder / sonnet | planned |

Agent names are the `.claude/agents/brand-ui-*.md` definitions; `model` in each file overrides the agent's default for that item.

## Waves

```
wave 1  ┬ RM-147 template product page (opus)        ─ apps/home only; the layer every later item lands in
        ├ RM-148 native featured tile + prompt (sonnet) ← after 147 (reads the tour data)
        └ RM-149 /llms/templates (sonnet)               ← after 147 (same data, as text)
              ▼ home build, e2e, lhci, home-bundle
wave 2  ┬ RM-150 energy-operations-page (opus)   ┐ 3 in parallel, disjoint write sets:
        ├ RM-151 security-ops-page (opus)        │ registry/blocks/<name>-page · its story ·
        └ RM-152 developer-platform-page (opus)  ┘ its home copy · one layout entry each
              ▼ gen, check, story tests, home build, review lane on the three screens
wave 3  └ RM-153 landing narrative (sonnet)          ← needs the wave-2 domains to be worth a "pick your world"
```

Critical path: RM-147 → RM-150 / 151 → RM-153 (≈ 6–8 agent-days). RM-147 is the item to demo first — the market desk page with a scenario, a tour and a made-of list is the difference visible in a day.

## Definition of done for the track

- Every template page renders its screen natively (no Storybook iframe on the page's critical path), shows a scenario, a hand-off above the fold, a tour and a generated made-of list.
- Every new `<name>-page` item: `pnpm gen && pnpm check` green, a play function that exercises its interaction, a `NATIVE_BLOCKS` entry, a `home-catalog-layout.json` entry, seeded data only.
- `/llms/templates` lists every template and matches the site (`pnpm gen:check`).
- Home gates: `pnpm --filter home build`, e2e (smoke, a11y, keyboard, js-off, reduced-motion), `lhci`, `home-bundle` within budget.
- Real-runtime proof: screenshots from Chromium in light and dark for each new page, quoted in the review's §Outcome.
