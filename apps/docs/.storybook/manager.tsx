import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// Brand the Storybook manager (sidebar header / loading screen) with the brand-ui
// lockup instead of the default Storybook logo. The image is the same mark the
// browser-tab favicon uses (apps/docs/public/brand-logo.svg) — a static asset,
// served from staticDirs at the manager root, so `./brand-logo.svg` resolves the
// same way `./brand-favicon.svg` does in main.ts's managerHead.
const managerTheme = create({
  base: "dark",
  brandTitle: "brand-ui",
  brandImage: "./brand-logo.svg",
  brandUrl: "/",
  brandTarget: "_self",
  // The brand lime for the selected/active sidebar item, replacing Storybook's
  // default blue so the chrome reads on-brand. Hard-coded because the manager
  // renders outside the token stylesheet — keep it equal to --brand-mark-tail.
  colorSecondary: "#D0E268",
});

addons.setConfig({ theme: managerTheme });
