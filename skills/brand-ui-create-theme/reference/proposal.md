# The theme proposal

The proposal is one JSON file plus one draft stylesheet per mode, all in a scratch folder.
`theme-kit.mjs proposal` renders them into a page the person reviews. Nothing enters the
project until they approve.

## proposal.json

```json
{
  "family": "acme",
  "label": "Acme",
  "mode": "create",
  "summary": "Two sentences: what the theme is based on and its overall character.",
  "sources": [
    {
      "id": "s1",
      "title": "Acme brand guidelines 2026, p. 12",
      "url": "https://acme.example/brand.pdf",
      "kind": "guideline"
    },
    {
      "id": "s2",
      "title": "app.acme.example main stylesheet",
      "url": "https://app.acme.example/assets/main.css",
      "kind": "live-css"
    }
  ],
  "fonts": {
    "sans": "\"Acme Sans\", Inter, var(--font-cjk-sans), \"Helvetica Neue\", Arial, sans-serif",
    "display": "\"Acme Sans\", Inter, var(--font-cjk-sans), \"Helvetica Neue\", Arial, sans-serif",
    "mono": "\"Source Code Pro\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "note": "Acme Sans is proprietary (s1) — not shipped; renders where installed, Inter otherwise."
  },
  "schemes": {
    "light": {
      "tokens": {
        "--primary": {
          "value": "#0B5FFF",
          "source": "s2",
          "confidence": "measured",
          "note": ".btn-primary background"
        },
        "--primary-hover": { "value": "#0A4FD6", "source": "s2", "confidence": "measured" },
        "--primary-foreground": { "value": "#FFFFFF", "source": "s2", "confidence": "measured" },
        "--font-sans": {
          "value": "\"Acme Sans\", Inter, var(--font-cjk-sans), Arial, sans-serif",
          "source": "s1",
          "confidence": "guideline"
        },
        "--radius-base": { "value": "0.375rem", "source": "s2", "confidence": "measured" }
      }
    },
    "dark": { "tokens": {} }
  },
  "deviations": [
    {
      "token": "--muted-foreground",
      "scheme": "light",
      "from": "#8A8F98",
      "to": "oklch(0.52 0.01 260)",
      "why": "3.4:1 on the card; darkened to clear 4.5:1"
    }
  ],
  "questions": ["The guidelines show no dark mode — derive one, or ship light only?"]
}
```

- `schemes.<mode>.tokens` holds **only researched or deliberately changed tokens**. Every
  other token keeps the base stylesheet's value.
- A value may be any colour syntax (converted to `oklch()` on apply), a `var(--token)`
  alias, a `url(…)`, or a plain CSS value (`0.25rem`, `600`, a font stack).
- `mode: "update"` adds `"current"` to each token — the value in the existing family — so
  the page shows a before/after column.
- Omit a mode entirely if the family will not ship it.

## Base stylesheet — what "every other token" starts from

- **New family:** `--base builtin:light` / `--base builtin:dark` — the reference themes of the
  installed tokens package (inside the brand-ui source repo the kit finds them in the
  workspace). The reference neutrals are hue-less; tint them toward the brand by proposing
  `--background`, `--card`, `--sidebar`, `--border`, `--muted` and the `--foreground` ramp
  with the brand hue at low chroma (≤ 0.02), marked `derived`.
- **Update:** the family's own stylesheet — the current values are the base, so every token
  you do not propose stays exactly as it is.

## Deriving what the sources do not state

Derived tokens are fine — mark them `derived` and keep them consistent:

- **Hover/pressed:** same hue, lightness −0.05 / −0.10 in light; +0.05 / +0.10 in dark.
- **Ring:** the primary, unless the product uses a distinct focus colour.
- **Sidebar/chrome:** a touch darker than `--background` in light (the recessed-chrome rule:
  background lightness minus sidebar lightness ≥ 0.02), `--card` never below `--background`.
- **Dark scheme when the brand has none:** neutral grounds around L 0.17–0.22 with the
  brand hue at chroma ≤ 0.02; lift primary to L ≈ 0.70–0.75 and flip its ink to dark.
- **Chart series:** brand chart sequence first; fill up to 12 with distinguishable hues;
  never two adjacent series of near-identical lightness and hue.
- **Status colours:** keep them conventional (red/green/amber/blue families) even when the
  brand palette lacks them; tune lightness to the grounds.

## Draft and render

```sh
node <kit> apply --base <base.css> --name acme-light --scheme light \
  --proposal proposal.json --header "Acme — light. Downloadable theme family \"acme\"." \
  --out scratch/acme-light.css
node <kit> audit scratch/acme-light.css scratch/acme-dark.css
node <kit> proposal proposal.json --draft light=scratch/acme-light.css \
  --draft dark=scratch/acme-dark.css --out scratch/acme-proposal.html
```

Fix every audit failure (record each fix as a deviation) and re-render before presenting.
Open the page for the person (publish it as a private artifact where that tool exists;
otherwise open the file in their browser) and give them its location.

## Presenting it

In the chat, beside the page: the brand colour you chose and where it came from, the note
that the family ships no logo art and how the app sets its own, how many values are `measured` / `guideline` / `derived` / `inferred`, every
deviation in one line each, and the open questions. Then ask one question with the options
**Approve and write it**, **Change something** and **Cancel**. No files are written to the
project before the answer is Approve.
