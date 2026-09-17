# Researching a brand for a theme

Used by both `brand-ui-create-theme` and `brand-ui-update-theme`. The output of research is
a **source ledger**: every value you will propose points at a row in it.

## 1 · Source ledger (build it as you go)

One row per source you actually opened:

| id  | title                       | url or file               | kind      | worked? |
| --- | --------------------------- | ------------------------- | --------- | ------- |
| s1  | Brand guidelines PDF, p. 12 | ./brand/guide.pdf         | guideline | yes     |
| s2  | Product app stylesheet      | https://app.example.com/… | live-css  | yes     |
| s3  | Press kit                   | https://example.com/press | press-kit | 403     |

`kind` is one of `user-file`, `guideline`, `design-system`, `live-css`, `press-kit`,
`screenshot`, `third-party`, `search`. A source that failed stays in the ledger with what happened — a
silent gap reads as if you checked.

Every proposed value then carries a **confidence**:

| confidence  | meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `measured`  | read from the brand's own shipped CSS / design tokens / SVG                  |
| `guideline` | stated in an official brand or design-system document                        |
| `derived`   | computed from a measured/guideline value (hover shade, dark-mode lift, ramp) |
| `inferred`  | no source states it; chosen to fit — say why in the note                     |

A value reported by a **third party** (colour-aggregator sites, design-scrape galleries,
blog posts) is never `measured` — it is `inferred` until a first-party source confirms it,
and its ledger `kind` is `third-party`.

A colour you remember but did not see in a source this session is `inferred`, never
`guideline`.

## 2 · Order of work

1. **Everything the user gave you first.** Open every link and read every file (PDF pages,
   images, CSS, Figma/token exports, screenshots). The user's material outranks anything
   you find yourself; when they conflict, keep the user's and list the conflict as an open
   question.
2. **Official brand material.** Search `"<brand> brand guidelines"`, `"<brand> press kit"`,
   `"<brand> media kit logo"`, `"<brand> design system"`. Prefer the brand's own domain.
3. **The live product** (the app people log in to, not the marketing site, when the theme is
   for product UI). Fetch the HTML, then the stylesheets it links. Look for CSS custom
   properties (`--color-primary`, `--brand-*`), design-token JSON, `theme-color` meta, and
   the most frequent non-neutral colours. A design system's public docs site often lists its
   tokens outright.
4. **Marketing site** last — it is often more expressive than the product; mark values from
   it as such in the note.

**Raw files need a raw download.** A page-summarising fetch tool (WebFetch and the like)
passes content through a model: it drops `<head>` (so no stylesheet links, `theme-color` or
favicons), and it can silently alter SVG paths and CSS values. Download HTML, CSS, SVG, PDF
and token JSON byte-for-byte with `curl -sL -o <scratch>/<file> <url>`. If raw downloads are
not permitted in this session, ask the person to allow them; if they decline, every value and
logo you got only through a summarising fetch is at most `inferred`, and the logo goes under
Problems as unverified.

Run independent fetches in parallel (or in parallel subagents that each return ledger rows,
not page dumps).

## 3 · What to capture

| Need                           | Where it usually is                                            | Token(s)                                                                 |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Primary brand colour           | guideline "primary palette"; product primary button            | `--primary`, `--ring`, `--sidebar-primary`, `--chart-1`                  |
| Hover / pressed                | product button `:hover`/`:active` CSS                          | `--primary-hover`, `--primary-active`                                    |
| Neutrals (ground, text, rules) | product body background, text colour, border colours           | `--background`, `--card`, `--foreground`, `--border`, `--muted*`         |
| Status colours                 | product alerts/toasts/validation CSS                           | `--destructive`, `--success`, `--warning`, `--info`                      |
| Chart palette                  | guideline "data visualisation" page; product charts            | `--chart-1…12`, `--chart-seq-*`, `--chart-div-*`                         |
| Links                          | product `a` colour                                             | `--link`                                                                 |
| Radius, control height         | product button/input computed CSS                              | `--radius-base`, `--control-size`, `--control-radius`                    |
| Typeface(s) + licence          | guideline typography page; `@font-face` / `font-family` in CSS | `--font-sans`, `--font-display`, `--font-mono`                           |
| Logo mark + lockup             | press kit SVG; site header inline SVG                          | `--brand-logo-mark`, `--brand-logo-lockup`, `--brand-logo-lockup-aspect` |
| Dark mode                      | product dark theme CSS, if one exists                          | the whole dark scheme                                                    |

Record hex/rgb exactly as found; convert with `theme-kit.mjs oklch`, never by hand.

## 4 · The logo

Try in this order and stop at the first that yields a clean SVG:

1. Official press/media kit SVG (download the file).
2. The inline `<svg>` or `.svg` `src` in the site/product header.
3. An SVG favicon / `mask-icon` / `apple-touch-icon` declared in the page head (mark only).
4. A PNG — last resort; say so in Problems. A raster logo cannot be recoloured per mode.

Save downloads to a scratch folder, never straight into the project. Then:

- Square **mark** and wide **lockup** (mark + wordmark) are separate files. If only a lockup
  exists, crop nothing — propose the lockup and leave `--brand-logo-mark: initial`, and say so.
- One colourway **per mode**: a dark wordmark disappears on a dark ground. Use the brand's
  reversed/white version for dark, or recolour the wordmark fills to the dark scheme's
  foreground and keep the brand-coloured mark.
- `node theme-kit.mjs svg <file>` gives the token and the aspect ratio. It refuses scripts,
  event handlers and external references — clean the file rather than working around it.
- Logos are the brand owner's trademarks. The theme is fine for internal/demo use; say in
  the proposal that public use needs the owner's permission.

## 5 · The typeface

- Open-licence face (OFL, Apache): it may ship with the theme — `.woff2` files under
  `fonts/<face>/`, the licence file beside them, a `<family>-fonts.css` with `@font-face`
  rules only.
- Proprietary or unclear licence: do **not** download or ship it. Name the closest open
  alternative, put the brand face first in the stack (it renders where installed), and list
  it under open questions.

## 6 · Failure modes to avoid

- Presenting a remembered palette as researched. If the fetch failed, the value is
  `inferred` and the source row says the fetch failed.
- Copying the marketing site's hero gradient into product surfaces. Brand colour is an
  accent; grounds stay near-neutral.
- Dropping a brand colour that fails contrast. Keep it as the mark (`--primary`), change the
  ink on it, or darken it — and record the change as a deviation with both values.
- Checking only text contrast. Chart series must also stay apart from each other: no two
  adjacent `--chart-*` series with near-identical lightness and hue, in **every** mode —
  including series 9–12 and the sequential/diverging ramps in a derived dark mode, which
  must be re-derived, not left at the reference values.
- Pasting whole fetched pages into the conversation. Extract the rows; discard the rest.
