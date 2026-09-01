import { reactConfig } from "@elabs-ai/components-eslint-config/react";

/**
 * Charts-local severity ratchet (#185).
 *
 * The #185 cleanup retired the inert Biome suppression comments that were hiding
 * `react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any` across this
 * package. Retiring them is only half a fix: nothing in CI fails on warning COUNT
 * (`.github/workflows/ci.yml` runs a bare `pnpm lint`), so at the shared preset's
 * default `warn` level a re-introduced violation lands silently — exactly the
 * accretion mechanism the issue names. These two rules are therefore ERRORS in
 * `@elabs-ai/components-charts`.
 *
 * This is the issue's own documented alternative to `eslint . --max-warnings=0`,
 * which stays infeasible here: the package still carries 39 pre-existing
 * `brand/no-raw-font-size` + `brand/no-raw-color` warnings that are already governed
 * by their own ratchets (`pnpm text-scale:check`, `pnpm palette:check`), so the
 * blanket flag would both turn CI red and double-govern those baselines.
 *
 * That residual is a DIFFERENT debt class that post-dates #185 (the `brand/*` rules
 * arrived with #187 / #182), so it was split out as **#319** rather than swept in
 * here — clearing it needs a design decision (two arbitrary sizes, 10px and 11px,
 * have no matching type role) and an observed render across both themes, neither of which
 * belongs in a lint-suppression cleanup. #319's last step is to flip
 * `--max-warnings=0` and retire this override. #185's AC#1 was amended on the issue
 * to match.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
