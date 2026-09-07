# Icons

- **Default icon library: Lucide (`lucide-react`)** for every generic UI glyph, nav-entry
  and formatting-toolbar glyphs (bold, italic, link, list, heading, quote, code) included —
  the **sanctioned** path (#300).
- **`@elabs-ai/components-icons` = brand / product-vocabulary icons only** (+ `BrandLogo`),
  built on `Icon`/`createIcon` (24×24, `stroke = currentColor`). The shipped `sample-icons`
  are placeholders a product REPLACES. Add an icon there only when it is product
  vocabulary — never a generic glyph.

| You need…                          | Use                              |
| ---------------------------------- | -------------------------------- |
| Generic UI glyph (chevron, close…) | **`lucide-react`**               |
| Nav or formatting-toolbar glyph    | **`lucide-react`** (generic)     |
| Brand / product icon or logo       | **`@elabs-ai/components-icons`** |
| Any other third-party icon set     | **No** (heroicons, tabler, …)    |

## Usage

- **Named imports only** (`import { Bell } from "lucide-react";`), no barrel/wrapper re-export.
- Color via `currentColor`, size via the `size` prop. Tokens only — never a raw hex.
- **One `lucide-react` version monorepo-wide**, a normal `dependency` in each package/app
  whose source imports it; `@elabs-ai/components-icons` never depends on it.

## Accessibility

- **Decorative → hidden from AT.** `Icon` does it automatically when no `title` is set
  (`role="presentation"` + `aria-hidden`); a decorative Lucide glyph gets `aria-hidden="true"`.
- **Conveys meaning / is the only label → name it.** `Icon title=…` becomes `role="img"` +
  `aria-label`; an icon-only control carries `aria-label` itself. See @.claude/rules/accessibility.md.

## Enforcement

- Other icon sets fail `pnpm lint` (`no-restricted-imports`, `@elabs-ai/components-eslint-config`);
  version drift fails `pnpm lucide:check`.

Canonical decision home: this rule.
History and measurements: docs/rules-history/icons.md
