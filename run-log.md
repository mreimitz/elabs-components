### Pre-verified the two changes I am about to land, rather than trusting the result files

**#282 — the token edit, measured from the diff.** Only `--flow-edge-weak` moved; the strong
end is untouched in all three blocks.

| block   | weak before | weak after | strong | lightness span before | after    |
| ------- | ----------- | ---------- | ------ | --------------------- | -------- |
| `light` | L 0.82      | L 0.63     | L 0.45 | 0.37                  | **0.18** |
| `dark`  | L 0.40      | L 0.50     | L 0.75 | 0.35                  | 0.25     |
| `:root` | L 0.85      | L 0.63     | L 0.45 | 0.40                  | 0.18     |

So the light ramp's lightness range is **halved**. That is precisely the failure mode the
visual review brief was written to catch, and the builder named it in the token comment
rather than absorbing it: _"the ramp's quiet end barely reads as quieter than an unramped
edge"_, with the two systemic repairs (a longer ramp, or a darker `--canvas`) declared out of
scope and flagged. Correct behaviour — it makes the review load-bearing instead of ceremonial.

Mitigating, and the reviewer should weigh it rather than take my word: the ramp is not
lightness-only. Chroma runs 0.02 to 0.16 across it, and stroke **width** carries the same
measure independently. A halved lightness span is not automatically a halved legibility span.

**#283 — what it actually fixes, so the closing comment does not overclaim.** Its source diff
is **docblock comments only** (`canvas-layer.tsx` §4, `canvas-token-color`'s note). No public
surface change, which is why its branch carries no manifest diff — the integrator still has
to run the cascade and confirm that rather than assume it. The real change is three shipped
reference stories repainted onto a neutral mono rung, a rule note, and a lock in
`charts-contrast.test.ts` that composites `--chart-mono-7` at the stories' actual α=0.65 over
`--chart-background` and asserts ≥3:1 per theme — using `mixOverSrgb`/`contrastSrgb`, both of
which already exist on `main`, so the lock compiles against shipped helpers.

That lock is **not** vacuous: it measures the composited pixel, not the raw token, and it
deliberately declines the categorical-series 1.4.11 exemption on the grounds that a mono rung
is not a series colour. But the honest framing for the closing comment is that no consumer's
behaviour changes — `CanvasLayer` never chose the ink; the caller's `draw` does. What shipped
is a corrected exemplar, written guidance, and a regression lock on the exemplar.
