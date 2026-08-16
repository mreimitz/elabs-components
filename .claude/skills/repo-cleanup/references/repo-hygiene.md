# Repo hygiene

Load in `repo` mode and in a full audit. How to read `repo-inventory.mjs`.

## The one thing to get right

The script produces **deletion candidates**. It is structurally incapable of proving something is
unused, and it says so in every candidate. Your job is not to convert candidates into deletions —
it is to rank which are worth a human's verification, and to make the uncertainty legible.

A report that says "these 12 files are dead" is wrong even when it is right, because the reader
will act on it without doing the one search that would have caught the exception.

## Why static analysis cannot close this

`extractImports` is a regex, not a parser. It sees `import`/`require`/`export … from` and literal
`import('…')`. It is blind to:

- computed specifiers — `import(\`./handlers/${name}.js\`)`
- plugin registries and reflection
- runtime-loaded templates, locale files, SQL, shaders
- string paths in config that tooling resolves
- anything referenced from **outside** the repo — CI, deploy scripts, another repo

`computedImportFiles` lists every file in the repo that uses a non-literal import. **If that list
is non-empty, no deletion candidate can exceed `medium` confidence**, because any one of those
files could reach any candidate invisibly.

## What the fields mean

| Field                            | Use                                                                                                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nonCodeReferences`              | Files outside the code graph that mention the path or its stem. **A non-empty list is strong counter-evidence** — something names this file. Confidence drops to `low`; usually the candidate is in use and the import graph simply cannot see how. |
| `highRiskReasons`                | Categories where "unused" is unprovable: migrations, fixtures, deploy/infra, locales, served assets, conventional entry points, `.d.ts`. Never above `low` confidence, regardless of how clean the search looked.                                   |
| `searchesRun` / `searchesNotRun` | Copy both into the finding verbatim. The second list is the finding's real content.                                                                                                                                                                 |
| `proposedValidation`             | The concrete check before deletion. Include it; a candidate without one is not actionable.                                                                                                                                                          |

## Unused dependencies

`unusedDependencies` splits into two very different sets, and the observation reports them
separately:

- **`mentionedInScriptsOrConfig`** — named in a package script or a config file. These are almost
  always **in use** as a binary or a config-referenced plugin (`biome`, `tsc`, `vite`,
  `electron-builder`). Do not propose removing them; if anything, they are evidence the detector
  works.
- **`noMentionAnywhere`** — no import site and no mention anywhere. Still only `medium` confidence:
  a package can be a peer, or resolved implicitly by a framework convention. Worth a look, not a
  deletion.

Removing a dependency is a `risk: high` finding regardless of confidence, because the failure mode
(a broken install or a broken build for someone else) is expensive and delayed.

## Disabled tests

`.skip` and `.todo` are debt with a name on it. **`.only` is different and worse**: it silently
disables every _other_ test in its file, so a green suite can be reporting on three tests instead of
three hundred. A `.only` in committed code is at least `high` severity and its impact is
"unknown number of tests not running" — which is exactly the kind of thing this repo's own rules
were written about.

Report `focusedOnly` separately from the total. They are not the same finding.

## Git signals

- **`topChurn`** — commit count per file. High churn alone is not a defect. High churn **combined
  with** size, complexity, or co-change is where the maintenance cost lives. Never report churn
  alone as a finding.
- **`coChange`** — files changed together in 3+ commits. A source file and its test co-changing is
  healthy. Two source files in different modules co-changing repeatedly is a coupling smell worth
  naming — but it is `medium` confidence at best, because a shared release commit produces the same
  signal.
- **`revertCommits`** — commits whose subject starts with `Revert`. A count, not a diagnosis.

Do **not** infer ownership or bus-factor from this data. The script does not collect authorship,
deliberately: a single-commit signal is a bad basis for a claim about a person.

## Large and secret-bearing files

- `largeFiles` — over the configured `limits.max_file_size_mb`, tracked in git. Large is not
  automatically wrong; a committed binary usually is. Say which it looks like and why.
- `secretBearingTracked` — paths that _look_ like credential files, detected **by name only**. The
  contents were never read (`safety-model.md`). Some are committed on purpose — a scope-only
  `.npmrc`, a `.env.example`. Report the path and let the owner decide; never assert a leak you did
  not and will not verify.

## Turning observations into findings

| Observation                   | Finding shape                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPO.deletion-candidates`    | One finding for the _set_, not one per file, unless a single file is individually significant. `risk: high`, confidence per the fields above. `recommended_action` is the validation, not the deletion. |
| `REPO.unused-dependencies`    | Only from `noMentionAnywhere`. If that list is empty, this is not a finding — say so.                                                                                                                   |
| `REPO.disabled-tests`         | `.only` separately and at higher severity than `.skip`/`.todo`.                                                                                                                                         |
| `REPO.large-files`            | Frame by _kind_ (committed build output vs a legitimately large fixture).                                                                                                                               |
| `REPO.secret-bearing-tracked` | `informational` unless the repo's own rules say the path should not be committed — check them first.                                                                                                    |
| `GIT.churn` / `GIT.co-change` | Supporting evidence for an architecture finding. Rarely a finding alone.                                                                                                                                |

## Limits — state these in every `REPO-`/`GIT-` finding

- Regex import extraction; computed specifiers are invisible.
- Non-code reference search is full-text and can miss a path assembled from fragments.
- The entry-point set is heuristic. A project with an unusual entry convention will produce false
  candidates — check `entryPoints` looks right before trusting `deletionCandidates`.
- Without git, the file listing comes from a filesystem walk and ignores `.gitignore` semantics
  beyond the configured `exclude` list.
