/**
 * chart-hairline — the ONE stroke weight every piece of chart furniture uses.
 *
 * Chart furniture (grid rows/columns, axis rules, drop lines, dumbbell tracks,
 * tree links, radar rings, network edges) is not data — it is the ruling the data
 * sits on. Before this constant existed every mark picked its own width (0.55,
 * 0.6, 0.65, 1, 1.4) and two of them additionally multiplied the shared
 * `--chart-grid` colour by an opacity of their own (network edges 0.35, radar
 * 0.6). The result was one token rendering at five weights and three inks, so a
 * line chart's grid read as furniture while a network chart's edges were
 * effectively invisible (1.07:1 against a white card).
 *
 * The contract is therefore two-sided and BOTH halves are load-bearing:
 *
 * 1. **One weight — this constant.** Reach for `CHART_HAIRLINE_WIDTH`, never a
 *    literal. A mark that genuinely needs a different weight is either encoding
 *    data (a network edge's value, which scales UP from this floor) or is not
 *    furniture at all.
 * 2. **One ink — `--chart-grid` at full opacity.** Never dim furniture with an
 *    `opacity` / `strokeOpacity` multiplier: the token is already tuned for a
 *    sub-pixel stroke (2.31:1 flat in `light`, ~1.67:1 as actually drawn at this
 *    width), and a multiplier on top puts it back under the visibility floor.
 *    If a mark must recede, it is a DIFFERENT token, not a fraction of this one.
 *
 * The one sanctioned exception is a *transient emphasis* state — the network
 * chart's adjacency blur — which is a temporary interaction affordance, not a
 * resting appearance.
 */

/**
 * Furniture stroke width, in user units.
 *
 * 0.65 is a deliberate sub-pixel value: it renders as an anti-aliased hairline
 * at 1× and a crisp one on retina, which is the "very thin line" look the system
 * is built around. It costs ink — a 0.65px stroke deposits ~65% of the token's
 * colour — and `--chart-grid` is darkened to pay for exactly that.
 */
export const CHART_HAIRLINE_WIDTH = 0.65;
