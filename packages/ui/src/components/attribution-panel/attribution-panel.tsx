import { forwardRef, useId, useMemo, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { ScrollArea } from "../scroll-area";
import { useLocale } from "../locale-provider";
import { ATTRIBUTIONS } from "./attributions.generated";
import type { Attribution, AttributionCategory } from "./attribution-types";

/**
 * Render order + the heading each group gets. `data` first because those are the
 * notices a licence obliges us to show; `dependency` last because it is the long
 * tail nobody scrolls to but everybody must be able to reach.
 */
const CATEGORY_ORDER: readonly AttributionCategory[] = ["data", "source", "font", "dependency"];

const CATEGORY_LABEL: Record<AttributionCategory, string> = {
  data: "Map data & tiles",
  source: "Adapted source",
  font: "Fonts",
  dependency: "Open-source dependencies",
};

export interface AttributionPanelProps extends HTMLAttributes<HTMLElement> {
  /**
   * The notices to render. Defaults to the GENERATED dataset
   * (`scripts/gen-attributions.mjs`), which is what keeps this panel accurate
   * without anyone maintaining a list — override only to scope or to test.
   */
  attributions?: readonly Attribution[];
  /** Restrict to these categories, in the panel's own order. Default: all. */
  categories?: readonly AttributionCategory[];
  /**
   * Restrict to notices reachable through these packages — e.g. an app that only
   * uses `…-ui` need not credit MapLibre's basemap providers. Matched against
   * each entry's `usedBy`. Default: all.
   */
  packages?: readonly string[];
  /** Show only the notices a licence obliges us to display. */
  requiredOnly?: boolean;
  /**
   * Cap the body height and scroll inside it. Omit to let the panel grow and
   * leave scrolling to the container (a Dialog body, a settings pane).
   */
  maxHeight?: number | string;
}

/** Filter + group in one pass so the render is a plain map over sections. */
function groupAttributions(
  attributions: readonly Attribution[],
  {
    categories,
    packages,
    requiredOnly,
  }: Pick<AttributionPanelProps, "categories" | "packages" | "requiredOnly">,
) {
  const order = categories ?? CATEGORY_ORDER;
  const visible = attributions.filter(
    (a) =>
      order.includes(a.category) &&
      (!requiredOnly || a.required) &&
      (!packages || a.usedBy.some((p) => packages.includes(p))),
  );
  return order
    .map((category) => ({ category, items: visible.filter((a) => a.category === category) }))
    .filter((group) => group.items.length > 0);
}

function AttributionItem({ item, requiredLabel }: { item: Attribution; requiredLabel: string }) {
  return (
    <li data-slot="attribution-panel-item" className="flex flex-col gap-0.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            {item.name}
          </a>
        ) : (
          <span className="text-body font-medium">{item.name}</span>
        )}
        {item.version ? (
          <span className="text-meta text-muted-foreground tabular-nums">{item.version}</span>
        ) : null}
        <span className="text-meta text-muted-foreground">{item.license}</span>
        {item.required ? (
          // Not colour-only: the badge carries the word itself (WCAG 1.4.1).
          <Badge variant="outline" className="text-meta">
            {requiredLabel}
          </Badge>
        ) : null}
      </div>
      {item.copyright ? (
        <p className="text-meta text-muted-foreground break-words">{item.copyright}</p>
      ) : null}
      {item.note ? <p className="text-meta text-muted-foreground">{item.note}</p> : null}
    </li>
  );
}

/**
 * The single surface where brand-ui's third-party notices are displayed —
 * OSS dependencies, adapted source, self-hosted fonts, and the map data/tile
 * credits that a licence actually obliges the product to show.
 *
 * The content is GENERATED from the repo (`pnpm gen:attributions`, gated by
 * `pnpm attributions:check`), so it cannot drift from what is actually shipped
 * the way a hand-kept credits page does.
 *
 * **Why this exists:** `MapCanvas` disables MapLibre's in-map attribution
 * control by default, and the flow canvases hide the React Flow badge. The
 * React Flow badge is an MIT project's request and carries no condition, but the
 * default Carto basemap's OpenStreetMap data is ODbL-licensed and the credit is
 * REQUIRED — mounting this panel somewhere a user can reach (an About dialog, a
 * settings pane, a footer link) is what keeps that obligation met while the map
 * corner stays clean. Ship it, or turn the in-map control back on.
 */
export const AttributionPanel = forwardRef<HTMLElement, AttributionPanelProps>(
  function AttributionPanel(
    {
      attributions = ATTRIBUTIONS,
      categories,
      packages,
      requiredOnly,
      maxHeight,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    // Instance-scoped so two panels on one page (Storybook autodocs renders every
    // story together) can't emit the same heading id — duplicate ids break the
    // aria-labelledby target and fail axe.
    const baseId = useId();
    const groups = useMemo(
      () => groupAttributions(attributions, { categories, packages, requiredOnly }),
      [attributions, categories, packages, requiredOnly],
    );

    const body = (
      <div className="flex flex-col gap-6">
        {groups.map(({ category, items }) => (
          <section
            key={category}
            data-slot="attribution-panel-section"
            aria-labelledby={`${baseId}-${category}`}
          >
            <h3 id={`${baseId}-${category}`} className="text-subtitle text-foreground mb-1">
              {CATEGORY_LABEL[category]}
            </h3>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <AttributionItem
                  key={item.id}
                  item={item}
                  requiredLabel={t("ui.attributionPanel.required")}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );

    return (
      <section
        ref={ref}
        data-slot="attribution-panel"
        aria-label={t("ui.attributionPanel.label")}
        className={cn("bg-card border border-border rounded-lg p-4", className)}
        {...props}
      >
        {groups.length === 0 ? (
          <p className="text-body text-muted-foreground">{t("ui.attributionPanel.empty")}</p>
        ) : maxHeight === undefined ? (
          body
        ) : (
          <ScrollArea style={{ maxHeight }} className="pe-3">
            {body}
          </ScrollArea>
        )}
      </section>
    );
  },
);

export { ATTRIBUTIONS, CATEGORY_LABEL };
export type { Attribution, AttributionCategory };
