import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@elabs-ai/components-ui";
import type { Route } from "../routes/use-hash";
import { useDiagram } from "../state/diagram-store";
import { openDoc } from "../shell/mode-store";
import { backFromDrill, useDrillView } from "./drill-down";
const DRILL_LABELS = {
  location: "Diagram inspection",
  readonly: "Read-only",
  open: "Open diagram",
  parent: "Parent diagram",
};
export function DrillBreadcrumb({ route }: { route: Extract<Route, { kind: "doc" }> }) {
  const state = useDrillView();
  const rootTitle = useDiagram((s) => s.drawn.spec?.title ?? DRILL_LABELS.parent);
  const crumbs = state.root === route.path ? state.crumbs : [];
  const chain = route.into ?? [];
  const leaf = crumbs.length === chain.length ? crumbs.at(-1) : undefined;
  return (
    <>
      <Breadcrumb aria-label={DRILL_LABELS.location} className="min-w-0 flex-1 overflow-x-auto">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild>
              <button
                type="button"
                className="focus-ring max-w-40 truncate rounded-sm"
                onClick={() => backFromDrill(0)}
                title={rootTitle}
              >
                {rootTitle}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {chain.map((id, index) => (
            <Fragment key={`${index}:${id}`}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {index === chain.length - 1 ? (
                  <BreadcrumbPage className="max-w-48 truncate" title={crumbs[index]?.title ?? id}>
                    {crumbs[index]?.title ?? id}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      className="focus-ring max-w-32 truncate rounded-sm"
                      onClick={() => backFromDrill(index + 1)}
                      title={crumbs[index]?.title ?? id}
                    >
                      {crumbs[index]?.title ?? id}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {leaf ? (
        <Button size="sm" variant="outline" onClick={() => openDoc(leaf.path, { mode: "view" })}>
          {DRILL_LABELS.open}
        </Button>
      ) : null}
    </>
  );
}
