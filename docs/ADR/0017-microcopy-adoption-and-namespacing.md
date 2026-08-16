# ADR 0017 — Microcopy adoption and key namespacing

- **Status:** Accepted
- **Date:** 2026-08-01
- **Supersedes the open question in:** ADR
  [`0014`](./0014-i18n-direction-and-microcopy-seam.md) §(c)
- **Context:** consumer report (qlabs-workbench) item #11 — "all strings are
  hardcoded English, blocks localization"

## Context

ADR 0014 shipped the seam — `LocaleProvider` with `t()`, `formatNumber`,
`formatDate`, a `messages` override prop, and `{name}` interpolation — but its
§(b) scope only covered the `Intl` formatting leak. The **microcopy** half named
in its own title was never carried through, and §(c) left "are non-English locales
in scope now or later" open.

The result: `t()` was called in **zero** components repo-wide, `DEFAULT_MESSAGES`
held 10 keys, and `@qlik-coe-emea/qlabs-components-ai` alone hardcoded ~100 user-visible English strings —
including three end-user **error messages** and 16 `aria-label`s. Worse, several
of those duplicated keys the shared bundle _already had_: `inline-citation.tsx`
hardcoded `"Previous"`/`"Next"` while `previous`/`next` existed, and
`artifact.tsx` hardcoded `"Close"` next to an existing `close`.

## Decision

### 1. The seam is adopted, and non-English locales are in scope

`useLocale()` is **provider-optional** — with no `<LocaleProvider>` it returns the
shipped `en-US` defaults ([`locale-provider.tsx`](../../packages/ui/src/components/locale-provider/locale-provider.tsx)).
So adopting `t()` requires no ancestor, no consumer change, and is **not a
breaking change**, provided every new default value is **byte-identical** to the
literal it replaces. That property is what makes this safe to do incrementally,
and it is asserted by tests (`packages/ai/src/microcopy.test.tsx`).

Adoption is worthwhile even for English-only consumers: it makes microcopy
**overridable**, which enterprise tone/branding needs independently of translation.

### 2. Key namespacing — generic keys stay bare and are REUSED

- **Generic, cross-package concepts stay bare**: `close`, `copy`, `previous`,
  `next`, `loading`, `noResults`, … A component reaches for an existing bare key
  before minting anything. This is what closes the duplication gap above.
- **Package-specific microcopy is namespaced** `<pkg>.<area>.<key>` —
  e.g. `ai.promptInput.errorMaxFiles`, `ai.gallery.downloadImage`. Without this a
  flat bundle of ~100 `@qlik-coe-emea/qlabs-components-ai` keys would swamp the shared set and collide with
  future packages.

### 3. `DEFAULT_MESSAGES` stays in `@qlik-coe-emea/qlabs-components-ui`

Even though the keys belong to `@qlik-coe-emea/qlabs-components-ai`. This is correct under the one-way
package DAG (`ai → ui`, enforced by `pnpm dep-direction:check`) and gives
consumers **one** bundle to override. The modular alternative — per-package
message files merged at provider construction — was rejected: it forces every
consumer to import and merge N bundles to translate one app.

### 4. Three-level override chain

**explicit prop → `t(key)` → shipped English default.** An explicit prop always
wins, mirroring `LocaleProvider`'s own fallback chain. Where a component already
has a `children`/slot, prefer that over adding a label prop.

### 5. Brand names are permanently excluded

`open-in-chat.tsx`'s provider names ("ChatGPT", "Claude", "Cursor", …) must NOT be
translated. They are encoded as gate exemptions so they never nag.

## Consequences

- `DEFAULT_MESSAGES` grows from 10 to 31 keys: the generic set plus `ai.*` for the
  end-user error messages, every `aria-label`, and the placeholders — the strings
  a user genuinely cannot work around.
- Remaining `@qlik-coe-emea/qlabs-components-ai` strings (JSX text nodes, default props) are **not yet**
  routed. They are held by the ratchet below so the number can only fall.
- **A surface the original audit could not see:** `Streamdown` accepts a
  `translations` prop with **32 keys** (`copyCode`, `downloadDiagram`,
  `externalLinkWarning`, …) that `@qlik-coe-emea/qlabs-components-ai` passes nothing for. Every
  streamed-markdown surface therefore leaks 32 more English strings. Tracked as
  follow-up work under `ai.streamdown.*`, to be wired in the shared
  `_lazy-mermaid`/plugins path so all three call sites are one edit.

## Enforcement

`pnpm microcopy:check` (`scripts/check-microcopy.mjs`, self-tested) is a
per-file **ratchet** over `aria-label` / `placeholder` / `title` literals and
capitalized JSX text nodes in `packages/*/src`, excluding tests and stories.
Counts may only go **down** (`--update` after a cleanup); a new hardcoded string
fails CI. `// i18n-exempt: <reason>` covers brand names and code samples;
`registry/` is warn-only because it is copy-own.

Without the ratchet, Stage-2 progress would be silently reversible — the same way
ADR 0014's microcopy half quietly never happened.
