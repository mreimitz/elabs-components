---
"@elabs-ai/components-ui": patch
---

`CommandChip`'s root element now renders `role="group"`, so a consumer-supplied `aria-label`
attaches validly instead of tripping axe's `aria-prohibited-attr` rule on the implicit
`generic` role of a bare `<div>`. Its host-picker menu now opens with `modal={false}`, so it
no longer `aria-hide`s the rest of the page (nav, hero CTAs, footer, …) while open, fixing a
WCAG 4.1.2 mismatch and the related Storybook axe flake on `display-commandchip--switch-host`.
