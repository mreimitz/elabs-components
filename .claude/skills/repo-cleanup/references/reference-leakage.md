# Reference leakage — third-party product names outside their two allowed homes

Script: `scripts/reference-leakage.mjs`. Mode: `refs` (and part of `audit`).
Findings use category `provenance`, so their ids read `REF-1`, `REF-2`, …

## The rule being enforced

While a feature is planned, competitor and reference products get named constantly —
"Datawrapper parity", "Qlik Sense does X", "Grafana's grid". That is honest working talk and it
is how the work got specified.

It becomes a problem the moment it survives into something a **user, a customer or a downstream
agent** reads. Then the library is describing itself in another vendor's vocabulary, it implies
a relationship or an endorsement that does not exist, and it dates badly — the reference product
changes and the claim silently stops being true.

A third-party product name is allowed in exactly two places:

1. **Attribution surfaces** — crediting upstream is the entire point of the file.
2. **Theme surfaces** — the brand IS the artefact being shipped.

Everywhere else it is a leak.

## What the script gives you

`observations[]`, not findings. You write the findings.

| Code                             | What it says                                                      |
| -------------------------------- | ----------------------------------------------------------------- |
| `REF.totals`                     | counts by tier and zone                                           |
| `REF.shipped`                    | mentions in surfaces a user or agent reads — the ones that matter |
| `REF.path-named`                 | files and directories whose own PATH names a product              |
| `REF.research-documents`         | files dense enough to BE research rather than contain a leak      |
| `REF.by-product` / `REF.by-zone` | what accounts for the leakage, and where                          |
| `REF.load-bearing`               | mentions the software needs — never batch-edit these              |
| `REF.review-tier`                | real company names with a known false-positive rate               |

## Zones decide severity, not the name

The same string gets opposite verdicts depending on where it sits. `Qlik` is correct inside a
theme and a leak inside a changeset. Any reading that ranks by name alone gets this backwards.

| Zone            | What is in it                                                                  | Deny-tier severity |
| --------------- | ------------------------------------------------------------------------------ | ------------------ |
| `shipped`       | package source, registry, the website, the manifest, changesets, plugin skills | **high**           |
| `published-doc` | `docs/`, Storybook stories and MDX, the root positioning files                 | medium             |
| `internal`      | the roadmap, the research write-ups, repo scripts                              | low                |
| `allowed`       | attribution and theme surfaces                                                 | not reported       |

A changeset is `shipped`, not internal: it becomes the published changelog.

## Three mention classes that are NOT the same mistake

Read the `context` label on every hit before recommending anything.

- **`package-specifier`** — the name is inside an import path or a dependency mapping
  (`["@mui/material", "mui"]`). **Load-bearing.** Deleting it breaks the software. Report, never
  edit.
- **`migration-source`** — the libraries a migrate command converts _from_. Also load-bearing:
  the command has to name what it converts.
- **`interop-claim`** — a true technical statement ("React, React Flow, Radix and Recharts all
  write a `style` attribute"). Often correct and arguably owed. A judgement call, never a
  batch fix.
- **`planning-reference`** — parity notes, gap analyses, "their own guidance is…". **This is the
  real leak** and the thing the rule exists for.
- **`demo-data`** — a real company used as a fixture value (`source: "Shopify"`). Swap the value;
  do not delete the field.
- **`path-citation`** — the name is inside a cited file path. The path itself is the leak, so
  this is actionable, not exempt.

## Dense files are not line edits

A competitor survey is not a document with leaks in it; it is a document made of them. When a
file crosses the density threshold, or its path names a product, the recommendation is **retire
or relocate the file**, never "fix N lines". Rewriting a research document line by line destroys
the research and still leaves the shape behind. The honest options are: move it out of the
repository, or delete it the way finished roadmap items are already retired.

## Writing the finding

- Lead with `shipped` + `planning-reference`. That is the intersection that actually reaches a
  reader.
- `confidence: confirmed` is available here — the scan is a static proof over the full tracked
  file set, not a sample. State the count.
- **`estimated_impact` is `unquantified`** unless you can say what the mention costs. "Reads as
  an affiliation" is a real harm and not a number; do not invent one.
- Every finding's `limitations` must carry the list's own blind spot: it is **curated**, so a
  reference product nobody added is invisible, and a paraphrase that describes a competitor's
  feature without naming it is undetectable.

## What it cannot see

- A **curated** list only finds names on it. No heuristic covers the gap — "capitalised word
  that looks like a brand" was measured in this repo and reported the linear scale 444 times.
- A paraphrase ("the tool most people compare us to") is invisible.
- Binary and built artefacts are not scanned. A leak baked into a bundle stays until the source
  is fixed and it is rebuilt.
- Whether a named product is a leak or a required interop claim is a **judgement**, and the
  script does not make it.
