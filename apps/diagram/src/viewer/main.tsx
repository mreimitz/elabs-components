import { useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, defineTheme } from "@elabs-ai/components-tokens";
import { Button, Text, ToggleGroup, ToggleGroupItem } from "@elabs-ai/components-ui";
import { CanvasPane } from "../panes/canvas-pane";
import { DrillDownView } from "../interaction/drill-down-view";
import { DrillBreadcrumb } from "../interaction/drill-breadcrumb";
import { diagramActions, diagramStore, useDiagram } from "../state/diagram-store";
import { lensActions, useLens } from "../shell/lens-store";
import { navigate, parseRoute, useRoute } from "../routes/use-hash";
import { registerIconPacks } from "./adapters/icons";
import { snapshot } from "./snapshot";
import "../index.css";
const LABELS = {
  back: "Back to main diagram",
  view: "Diagram view",
  technical: "Technical",
  visual: "Visual",
  untitled: "Published diagram",
};
const initial = parseRoute(window.location.hash);
const path =
  initial.kind === "doc" && initial.path && Object.hasOwn(snapshot.documents, initial.path)
    ? initial.path
    : snapshot.root;
if (initial.kind !== "doc" || initial.path !== path)
  window.history.replaceState(null, "", `#d/${path}`);
diagramActions.load(snapshot.documents[path]!, path);
registerIconPacks();
function Viewer() {
  const route = useRoute();
  const title = useDiagram((state) => state.drawn.ast?.title);
  const target = useLens((state) => state.target);
  const path =
    route.kind === "doc" && route.path && Object.hasOwn(snapshot.documents, route.path)
      ? route.path
      : snapshot.root;
  useLayoutEffect(() => {
    if (route.kind !== "doc" || route.path !== path)
      navigate({ kind: "doc", path }, { replace: true });
    if (diagramStore.get().path !== path) {
      lensActions.settleForDocument();
      diagramActions.load(snapshot.documents[path]!, path);
    }
  }, [path, route]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== "Escape" ||
        route.kind !== "doc" ||
        !route.present ||
        route.into?.length ||
        (event.target instanceof Element &&
          event.target.closest("input,textarea,[contenteditable],[role=menu],[role=dialog]"))
      )
        return;
      event.preventDefault();
      navigate({ ...route, present: false });
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [route]);
  const into = route.kind === "doc" ? route.into : undefined;
  return (
    <main
      className="flex h-dvh min-h-0 flex-col bg-background text-foreground"
      id="diagram-workspace"
      tabIndex={-1}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        {into?.length && route.kind === "doc" ? (
          <DrillBreadcrumb route={route} />
        ) : (
          <>
            <Text className="min-w-32 flex-1 truncate">{title ?? LABELS.untitled}</Text>
            {path !== snapshot.root ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ kind: "doc", path: snapshot.root })}
              >
                {LABELS.back}
              </Button>
            ) : null}
            <ToggleGroup
              type="single"
              role="radiogroup"
              value={target}
              onValueChange={(value) => {
                if (value === "technical" || value === "visual") lensActions.setLens(value);
              }}
              aria-label={LABELS.view}
            >
              <ToggleGroupItem value="technical">{LABELS.technical}</ToggleGroupItem>
              <ToggleGroupItem value="visual">{LABELS.visual}</ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
      </header>
      <section className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0"
          style={{ visibility: into?.length ? "hidden" : undefined }}
          inert={into?.length ? true : undefined}
        >
          <CanvasPane presenting={route.kind === "doc" && route.present === true} />
        </div>
        {into?.length ? <DrillDownView chain={into} /> : null}
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    themes={[
      defineTheme({
        value: snapshot.theme,
        label: snapshot.theme,
        dark: snapshot.theme.endsWith("dark"),
      }),
    ]}
    defaultTheme={snapshot.theme}
    storageKey={null}
    motionStorageKey={null}
  >
    <Viewer />
  </ThemeProvider>,
);
