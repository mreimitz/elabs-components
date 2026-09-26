import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, BUILT_IN_THEME_DEFINITIONS } from "@elabs-ai/components-tokens";
import { qlikThemes } from "./themes/qlik/theme";
import { clickhouseThemes } from "./themes/clickhouse/theme";
import { salesforceThemes } from "./themes/salesforce/theme";
import { snowflakeThemes } from "./themes/snowflake/theme";
import "./index.css";
import { App } from "./app";
// DG-04: registers every vendored icon (public/icons/index.json) as a ServiceLogo mark.
import { registerIconPacks } from "./icons/register-packs";

registerIconPacks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      themes={[
        ...BUILT_IN_THEME_DEFINITIONS,
        ...qlikThemes,
        ...clickhouseThemes,
        ...salesforceThemes,
        ...snowflakeThemes,
      ]}
      defaultTheme="light"
    >
      <App />
    </ThemeProvider>
  </StrictMode>,
);
