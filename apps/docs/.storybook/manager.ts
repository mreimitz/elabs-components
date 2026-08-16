import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// Brand the Storybook manager (sidebar header / loading screen) with the Qlik
// lockup instead of the default Storybook logo. The image is the same Qlik mark
// the browser-tab favicon uses (apps/docs/public/qlik-logo.svg) — a static brand
// asset, served from staticDirs at the manager root, so `./qlik-logo.svg`
// resolves the same way `./qlik-favicon.svg` does in main.ts's managerHead.
const qlikTheme = create({
  base: "dark",
  brandTitle: "Qlik · brand-ui",
  brandImage: "./qlik-logo.svg",
  brandUrl: "/",
  brandTarget: "_self",
  // Qlik green for the selected/active sidebar item, replacing Storybook's
  // default blue so the chrome reads on-brand.
  colorSecondary: "#009845",
});

addons.setConfig({ theme: qlikTheme });
