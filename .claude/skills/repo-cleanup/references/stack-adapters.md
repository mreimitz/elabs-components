# Stack adapters

Load when `detect-stack.mjs` reports a stack the audit does not handle well, or when adding
support for a new one.

## The portability contract

Every other script consumes `stack.json`. Nothing else in the skill may assume pnpm, vitest, a
`roadmap/` folder, or any other repo-specific shape. If you find yourself writing such an
assumption into an analyzer, it belongs here as an adapter instead.

`stack.json` shape (`repo-cleanup/stack@1`):

```jsonc
{
  "languages": [{ "id": "typescript", "evidence": "tsconfig.json" }],
  "packageManager": { "name": "pnpm", "source": "pnpm-lock.yaml", "confidence": "high" },
  "monorepo": { "isMonorepo": true, "source": "pnpm-workspace.yaml" },
  "tooling": { "testRunner": "vitest", "linter": "…", "formatter": "…", "bundler": "…" },
  "roots": { "source": ["src"], "tests": ["test"], "generated": ["dist", "out"] },
  "git": { "available": true, "commits": 316, "branch": "main" },
  "claude": { "claudeMd": true, "rules": 7, "skills": 2, "…": "…" },
  "gate": {
    "effective": "pnpm typecheck && pnpm test && pnpm lint",
    "configured": null,
    "detected": "pnpm typecheck && pnpm test && pnpm lint",
    "candidates": [{ "id": "test", "command": "pnpm test", "source": "package.json#scripts.test" }],
    "confidence": "medium",
    "note": "DETECTED, not verified — announce before running",
  },
  "unsupported": [],
}
```

## Two invariants

**1. A detected gate is a candidate, never a promise.** `gate.confidence` is `confirmed` only when
the user configured it in `.repo-cleanup.yml`. A detected gate is `medium` and carries a note saying
so. Before running one, announce it — it is in the _potentially expensive_ command class
(`safety-model.md`).

**2. Absence is a first-class answer.** A repo with no manifest, no git and no test runner must
produce a valid `stack.json` with empty fields and a populated `unsupported` array. It must never
throw, and the audit must continue with the analyzers that do not need a stack —
`context-footprint.mjs`, `doc-hygiene.mjs` and `usage-forensics.mjs` need none of it.

## Shipped adapters

| Adapter     | Detects                                                                                | Gate candidates                                                                     |
| ----------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **node/TS** | `package.json`, `tsconfig.json`; pnpm/yarn/npm/bun from `packageManager` then lockfile | `scripts.{typecheck,test,lint,build,e2e}`, run through the detected package manager |
| **python**  | `pyproject.toml`, `requirements.txt`, `setup.py`, `Pipfile`                            | `pytest`, `ruff check .`, `mypy .` — from `[tool.*]` sections                       |
| **go**      | `go.mod`                                                                               | `go test ./...`                                                                     |
| **rust**    | `Cargo.toml`                                                                           | `cargo test`                                                                        |
| **generic** | anything else                                                                          | none; `unsupported` explains why                                                    |

Docker, Java and Ruby are **detected but contribute no gate** — presence is reported so a report can
say "this repo also builds containers, and container build time was not measured", which is more
useful than silence.

## Adding an adapter

1. **Detection** — extend `detectLanguages()` with the manifest file that proves the language, and
   record it as `evidence`. Never infer a language from file extensions alone; a repo with three
   `.py` scripts is not a Python project.
2. **Gate candidates** — add a `detect<Lang>Gate(root)` returning
   `{ id, command, source }[]`, where `id` ∈ `typecheck | test | lint | build | e2e` and `source`
   cites the file and key that produced it. Wire it into `detectGate()` behind a language check.
   Earlier adapters win on a duplicate `id`; order them deliberately.
3. **Roots** — add source/test/generated directory names to the `COMMON_*_ROOTS` lists if the
   language has conventions the current lists miss.
4. **Code extensions** — if the language should participate in dead-file analysis, add its
   extensions to `repo-inventory.mjs`'s `CODE_EXT` **and** an import-extraction rule to
   `IMPORT_RES`. Do not add the extension without the extraction rule: every file becomes an
   unreachable deletion candidate, which is worse than no support at all.
5. **Fixture + test** — add a fixture repo under `tests/fixtures/` and a case in
   `tests/detect-stack.test.mjs`. An adapter without a fixture is untested by construction.

## What an adapter must never do

- **Install anything.** No global installs, no `pip install`, no adding a dependency to the host
  repo to complete an audit. Prefer, in order: tools already in the repo → language built-ins →
  temporary isolated execution → an optional recommendation the user approves.
- **Reach the network.** Blocked unless `privacy.allow_network` is true _and_ the user approves
  in-turn.
- **Run a build to detect a stack.** Detection reads manifests. Execution belongs to `measure-command.mjs`,
  behind an announcement.

## Monorepos

`monorepo.isMonorepo` is detected from `pnpm-workspace.yaml`, `package.json#workspaces`,
`turbo.json`, `nx.json`, `lerna.json`, `rush.json`. What it should change in a report:

- A root gate may not cover every package. Say which packages were covered and which were not.
- Nested `CLAUDE.md` files are **conditional** context, not always-loaded —
  `context-footprint.mjs` already separates them, and a report must not merge the buckets.
- Dead-file analysis across package boundaries is weaker: a package's public entry point is
  consumed by another package through its name, not a relative path. Check `entryPoints` includes
  each package's manifest entry before trusting `deletionCandidates` in a monorepo.
