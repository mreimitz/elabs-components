# Attribution (borrow it, credit it — in the same change)

This repo is built on other people's work and is headed for public release. Every
project we take from is credited in **one dataset**, which generates both the public
[`ATTRIBUTION.md`](../../ATTRIBUTION.md) and the in-product `AttributionPanel`
(`@elabs/components-ui`) — so the page and the product cannot disagree.

## The rule

**If you vendor, adapt, port, copy or re-express anything from another project, you
add it to `scripts/attributions.sources.json` and run `pnpm gen:attributions` in the
SAME change.** Not in a follow-up, not in an issue.

"Anything" is broader than pasted code: a component you rewrote onto our tokens, an
algorithm you re-implemented, a technique borrowed from someone's plugin, a design or
architecture an ADR says we adopted, sample data, an image, a font, a rule adopted
from someone's guidelines. If a reasonable person would say _"that came from X"_, X
gets an entry.

**A source comment is a pointer, not an attribution.** `// Adapted from foo` at the
top of a file is useful and should stay — but it reaches no reader of the repo, no
consumer of the package, and no license-compliance review. Only the dataset does.

## What an entry needs

Every entry carries a **name** and a **canonical URL** — the upstream **GitHub repo**
wherever one exists, otherwise the project's own homepage or license page. Both are
gated; a credit nobody can follow is not a credit. Also give it:

- `license` — the SPDX identifier read from the upstream's actual LICENSE file.
- `copyright` — the upstream copyright line, **verbatim**. Retyping from memory is how
  a notice drifts from the file it describes.
- `usedBy` — the `@elabs/components-*` packages it reaches a consumer through.
- `note` — one sentence: what we actually took.
- `required: true` **only** when a license or provider terms _oblige_ the notice to be
  displayed (ODbL, the OFL, provider terms) — as opposed to a courtesy credit. A
  required notice with no copyright line fails the gate.

**Never verify a license from a badge, a README claim, or memory.** Read the upstream
LICENSE file. If you cannot establish the license or the copyright holder, say so and
stop — do not invent a plausible value. An attribution that is confidently wrong is
worse than one that is missing.

**Never hand-add an npm dependency.** Dependencies and vendored fonts are harvested
from the manifests and the shipped `OFL.txt` files. A hand-written duplicate goes
stale the moment the dependency moves.

## Removing a borrowing

Deleting the borrowed code is only half the change — delete its entry too. A credit
for something we no longer ship overstates what the product contains.

## Enforce (a convention ships with its teeth)

- **`pnpm attributions:check`** — both generated outputs are fresh, every entry has a
  name and a URL, and every `required` notice has a copyright line. Self-tested via
  `pnpm attributions:check:test`.
- **`pnpm attribution:provenance:check`** — scans shipped source for provenance
  phrases (`adapted from`, `vendored from`, `derived from`, `borrowed from`,
  `forked from`, `copied from`, `port of`) and **fails when the named upstream has no
  entry in the dataset**. This is the rung that catches the next borrow: it is
  specifically not possible to write `// Adapted from acme/widget` and ship it
  uncredited. Pre-existing unresolvable cases are frozen in
  `scripts/attribution-provenance-baseline.json`, which only ratchets down. Self-tested
  via `pnpm attribution:provenance:check:test`.
- A new upstream URL also lands in shipped source (`attributions.generated.ts`), so a
  new origin needs an entry in `scripts/remote-origins-allowlist.json` and a line in
  `docs/CSP-AND-NETWORK.md` — see @.claude/rules/quality-gates.md.

## What attribution does NOT do

Crediting something is not a license to use it. Attribution satisfies a notice
requirement; it does not grant permission, and it does not make a GPL dependency,
a proprietary asset or a third-party screenshot safe to ship. Those are licensing
decisions for the maintainer — flag them, don't resolve them by adding a row.
