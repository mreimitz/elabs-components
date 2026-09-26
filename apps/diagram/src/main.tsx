import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, BUILT_IN_THEME_DEFINITIONS } from "@elabs-ai/components-tokens";
import { qlikThemes } from "./themes/qlik/theme";
import { clickhouseThemes } from "./themes/clickhouse/theme";
import { salesforceThemes } from "./themes/salesforce/theme";
import { snowflakeThemes } from "./themes/snowflake/theme";
// Monaco's web workers for Vite (editor README); without it Monaco falls back to the main thread.
import "@elabs-ai/components-editor/monaco-environment";
import "./index.css";
import { App } from "./app";
// DG-04: registers every vendored icon (public/icons/index.json) as a ServiceLogo mark.
import { registerIconPacks } from "./icons/register-packs";
// DG-14: one toast host for wave 3 (DG-16 and DG-17 both toast), mounted here so they
// build in parallel.
import { Toaster } from "@elabs-ai/components-ui";
// DG-16: the text history, the unload guard and share links.
import { guardUnload } from "./io/files";
import { loadSharedDoc } from "./io/share-url";
import { diagramStore } from "./state/diagram-store";
import { installHistory, onHistoryKeyDown } from "./state/history";

registerIconPacks();

function render() {
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
        {/* Before <App />: its effects run first, so a toast from App's first effects shows. */}
        <Toaster />
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

// DG-16: a share link (`#doc=…`) replaces the seed before the first render; the history
// starts after it, so the shared document is where Undo stops.
void loadSharedDoc().then(() => {
  installHistory();
  window.addEventListener("keydown", onHistoryKeyDown);
  guardUnload(() => {
    const { text, loadedText } = diagramStore.get();
    return text !== loadedText;
  });
  render();
});
