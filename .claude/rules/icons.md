# Icons (Lucide is the default; `@elabs/components-icons` is for brand vocabulary)

- **Default icon library: Lucide (`lucide-react`).** Generic UI glyphs — chevrons, `X`,
  search, bell, panel/menu toggles, status ticks, **nav-entry glyphs, and
  formatting-toolbar glyphs (bold / italic / link / list / heading / quote / code …)** —
  come from `lucide-react`. It is the documented standard and the value the vibe-coder
  plugin scaffolds for end-users. Falling back to Lucide for nav + formatting is the
  **sanctioned** path, not a workaround (issue #300); the repo's own `MarkdownToolbar`
  does exactly this.
- **`@elabs/components-icons` is for brand / product-vocabulary icons** — the product's own concept
  glyphs and `BrandLogo`, built on the `Icon`/`createIcon` primitives (24×24,
  `stroke = currentColor`, so they theme with text color). The shipped `sample-icons` are
  **placeholders** a product REPLACES with its own vocabulary — `@elabs/components-icons` is
  deliberately NOT a general nav/formatting icon set (that would duplicate Lucide and fight
  the ESLint enforcement below). Add an icon here only when it is part of the product's
  vocabulary; reach for Lucide for everything generic.

| You need…                                             | Use                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| A generic UI glyph (chevron, close, search, menu, …)  | **`lucide-react`** — `import { ChevronDown }`                    |
| A nav-entry or formatting-toolbar glyph (bold, list…) | **`lucide-react`** — generic, not brand vocabulary               |
| A brand / product-concept icon, or the logo           | **`@elabs/components-icons`** (`Icon`/`createIcon`, `BrandLogo`) |
| Any other third-party icon set                        | **No** — not heroicons/react-icons/tabler/etc.                   |

## Import convention

- **Named imports only:** `import { Bell, Search } from "lucide-react";`. No barrel/wrapper
  re-export of Lucide — it would only churn the 70+ call sites for no gain.
- Icons inherit color via `currentColor`; size with the `size` prop. Tokens only — never a raw hex.

## Versioning

- **One `lucide-react` version across the whole monorepo** (currently `^0.577.0`), declared as a
  normal `dependency` in each package/app whose source imports it (`@elabs/components-ui`, `@elabs/components-ai`,
  `@elabs/components-editor`, the apps). `@elabs/components-icons` does **not** depend on Lucide — it ships its own icons.

## Accessibility

- **Decorative icon → hidden from AT.** `@elabs/components-icons`' `Icon` does this automatically when no
  `title` is set (`role="presentation"` + `aria-hidden`); for a Lucide glyph used decoratively,
  add `aria-hidden="true"`.
- **Icon conveys meaning / is the only label → name it.** A titled `Icon` (`title=…`) becomes
  `role="img"` + `aria-label`; an **icon-only control** (button/link) needs an `aria-label` on the
  control itself. See @.claude/rules/accessibility.md.

## Enforcement (over reminders)

- **Other icon libraries are blocked by ESLint** (`no-restricted-imports` in
  `@elabs/components-eslint-config`): importing heroicons / react-icons / tabler / phosphor / font-awesome /
  MUI-icons / ant-icons fails `pnpm lint`. Use `lucide-react` or `@elabs/components-icons`.
- **Version drift is blocked by CI** (`pnpm lucide:check` → `scripts/check-lucide-version.mjs`):
  more than one `lucide-react` version across the package manifests fails the build.

Canonical decision home: this rule (linked from `CLAUDE.md`/`AGENTS.md`/`skills/brand-ui`).
