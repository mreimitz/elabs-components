/**
 * microtypography-apostrophe — curly ’ not straight ' in user-visible copy (#70).
 * Ported from scripts/check-microtypography.mjs (apostrophe half: per-file ratchet).
 * Same scan positions and `// microtypography-exempt: <reason>` opt-out as
 * `microtypography-ellipsis`; flags a straight `'` between two word characters.
 */
import { scanMicrotypography } from "./microtypography-ellipsis.mjs";

const src = (body, file = "packages/fixture-pkg/src/widget.tsx") => ({ files: { [file]: body } });

export default {
  id: "microtypography-apostrophe",
  scope: "components",
  doc: "Write the curly apostrophe ’ (never a straight `'` between letters) in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; opt out with `// microtypography-exempt: <reason>`.",
  baseline: "per-file",
  run: (ctx) => scanMicrotypography(ctx, "apostrophe", "straight apostrophe — use ’"),
  fixtures: {
    pass: [
      src('<div title="Couldn’t load" />'),
      src("<span>Their approach, 'so to speak,' worked.</span>"),
      src("<span>Don't</span> // microtypography-exempt: identifier sample"),
      src("// <span>Don't</span>"),
      src('<div title="Couldn\'t load" />', "packages/fixture-pkg/src/widget.spec.tsx"),
    ],
    fail: [
      src('<div title="Couldn\'t load" />'),
      src('<StatePanel description="Didn\'t load" />'),
      src("<span>It's here</span>", "packages/fixture-pkg/src/widget.stories.tsx"),
    ],
  },
};
