# Attribution (credit it in the same change)

`scripts/attributions.sources.json` generates `ATTRIBUTION.md` + `AttributionPanel`
(`@elabs-ai/components-ui`).

## The rule

- **Vendor, adapt, port, copy or re-express anything from another project → add it to the
  dataset and run `pnpm gen:attributions` in the SAME change.** Not a follow-up.
- "Anything" > pasted code: rewritten components, re-implemented algorithms, borrowed
  techniques, adopted designs/architectures/guidelines, sample data, images, fonts. Test:
  _would someone say "that came from X"?_ → entry.
- `// Adapted from foo` is a pointer, not an attribution — keep it; only the dataset counts.
- Removed a borrowing → delete its entry.

## Entry

- `name` + canonical URL (upstream GitHub repo, else homepage/license page).
- `license` — SPDX id from the upstream's LICENSE file.
- `copyright` — upstream copyright line, verbatim.
- `usedBy` — `@elabs-ai/components-*` packages it ships through.
- `note` — one sentence: what we took.
- `required: true` ONLY when the license or provider terms oblige display (ODbL, OFL);
  required without a copyright line fails the gate.
- Never verify a license from a badge, README or memory — read LICENSE. Can't establish
  license/holder → say so and stop; never invent.
- Never hand-add an npm dependency — deps and vendored fonts are harvested from manifests
  and shipped `OFL.txt`.

## Gates

- `pnpm attributions:check` — outputs fresh, entries have name + URL, `required` has
  copyright (self-test `pnpm attributions:check:test`).
- `pnpm attribution:provenance:check` — `adapted`/`vendored`/`derived`/`borrowed`/`forked`/
  `copied from` or `port of` in shipped source with no entry fails;
  `scripts/attribution-provenance-baseline.json` ratchets down only (self-test
  `pnpm attribution:provenance:check:test`).
- New upstream URL (in `attributions.generated.ts`) → also
  `scripts/remote-origins-allowlist.json` + `docs/CSP-AND-NETWORK.md`.

Attribution is a notice, not permission: a GPL dep, proprietary asset or third-party
screenshot stays unsafe to ship. Flag to the maintainer.

History and measurements: docs/rules-history/attribution.md
