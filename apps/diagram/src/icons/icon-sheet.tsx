import { useMemo, useState } from "react";
import { ServiceLogo } from "@elabs-ai/components-icons";
import { Badge, Button, Card, Heading, Text } from "@elabs-ai/components-ui";
import { ICON_INDEX, ICON_PACKS } from "./register-packs";
import { LUCIDE_ICONS, LucideByName } from "./lucide-map";

/** The sheet's copy, in one place (the app has no i18n; this keeps the strings together). */
const LABELS = {
  heading: "Icon packs",
  intro: (icons: number, packs: number) => `${icons} icons in ${packs} packs. Use these names as`,
  introScheme: "vendor/name",
  introEnd: "in the YAML.",
  markStyle: "Mark style",
  brand: "Brand",
  mono: "Mono",
  vendorFilter: "Vendor filter",
  all: "All",
  gridLabel: (vendor: string) => `${vendor} icons`,
  lucideHeading: "lucide/<name> — generic glyphs",
  unknownHeading: "Unknown name (monogram fallback)",
} as const;

export interface IconSheetProps {
  /**
   * The pack to show, read from the `#icons/<vendor>` hash by `app.tsx`
   * (`iconSheetVendor`). `undefined` shows every pack. The hash is the single source of
   * truth: the filter buttons write it (`iconSheetHash`) and the sidebar's pack links
   * navigate to it, so the two always agree (wave-1 review M4).
   */
  vendor?: string;
}

type MarkVariant = "brand" | "mono";

const ROUTE = "#icons";

/** A name no pack registers — the standing proof of `ServiceLogo`'s monogram fallback. */
const UNKNOWN_NAME = "nope/x";

/** The `#icons` route's hash for one pack (`#icons/aws`), or for every pack (`#icons`). */
export function iconSheetHash(vendor?: string): string {
  return vendor ? `${ROUTE}/${vendor}` : ROUTE;
}

/** The known pack a `#icons/<vendor>` hash names; `undefined` for `#icons`, an unknown pack or another route. */
export function iconSheetVendor(hash: string): string | undefined {
  const prefix = `${ROUTE}/`;
  if (!hash.startsWith(prefix)) return undefined;
  const vendor = hash.slice(prefix.length);
  return ICON_PACKS.some((p) => p.pack === vendor) ? vendor : undefined;
}

function showPack(vendor?: string) {
  window.location.hash = iconSheetHash(vendor);
}

/**
 * The `#icons` dev route (DG-04 step 6) — every vendored icon
 * (`public/icons/index.json`) in a filterable grid, plus the `lucide/<name>`
 * generic-glyph set and a standing "unknown name" proof of the monogram
 * fallback (acceptance: unknown name → accessible monogram).
 */
export function IconSheet({ vendor }: IconSheetProps) {
  const [variant, setVariant] = useState<MarkVariant>("brand");

  const totalCount = Object.keys(ICON_INDEX).length;

  const entries = useMemo(
    () =>
      Object.entries(ICON_INDEX)
        .filter(([key]) => vendor === undefined || key.startsWith(`${vendor}/`))
        .sort(([a], [b]) => a.localeCompare(b)),
    [vendor],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6" data-slot="icon-sheet">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={2}>{LABELS.heading}</Heading>
          <Text variant="caption" tone="muted">
            {LABELS.intro(totalCount, ICON_PACKS.length)}{" "}
            <Text as="span" variant="code">
              {LABELS.introScheme}
            </Text>{" "}
            {LABELS.introEnd}
          </Text>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={LABELS.markStyle}>
          <Button
            type="button"
            size="sm"
            variant={variant === "brand" ? "default" : "outline"}
            aria-pressed={variant === "brand"}
            onClick={() => setVariant("brand")}
          >
            {LABELS.brand}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "mono" ? "default" : "outline"}
            aria-pressed={variant === "mono"}
            onClick={() => setVariant("mono")}
          >
            {LABELS.mono}
          </Button>
        </div>
      </header>

      {/* The count inherits the button's own ink (`border-current text-current`): the
          outline Badge's `text-foreground` is ink for the page, not for the pressed
          button's `bg-primary` plate, and failed contrast in dark and qlik-light (wave-1
          review M5). */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={LABELS.vendorFilter}>
        <Button
          type="button"
          size="sm"
          variant={vendor === undefined ? "default" : "outline"}
          aria-pressed={vendor === undefined}
          onClick={() => showPack(undefined)}
        >
          {LABELS.all}
          <Badge variant="outline" className="ms-2 border-current tabular-nums text-current">
            {totalCount}
          </Badge>
        </Button>
        {ICON_PACKS.map(({ pack, count }) => (
          <Button
            key={pack}
            type="button"
            size="sm"
            variant={vendor === pack ? "default" : "outline"}
            aria-pressed={vendor === pack}
            onClick={() => showPack(pack)}
          >
            {pack}
            <Badge variant="outline" className="ms-2 border-current tabular-nums text-current">
              {count}
            </Badge>
          </Button>
        ))}
      </div>

      <section aria-label={LABELS.gridLabel(vendor ?? LABELS.all)}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
          {entries.map(([key]) => (
            <Card key={key} className="flex flex-col items-center gap-2 p-3 text-center">
              <ServiceLogo name={key} size={32} variant={variant} />
              {/* Wraps instead of truncating: the name is what users copy into the YAML. */}
              <span
                className="line-clamp-2 w-full break-words text-caption text-muted-foreground"
                title={key}
              >
                {key}
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="lucide-heading" className="flex flex-col gap-3">
        <Heading id="lucide-heading" level={3} size="subtitle">
          {LABELS.lucideHeading}
        </Heading>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
          {Object.keys(LUCIDE_ICONS).map((name) => (
            <Card key={name} className="flex flex-col items-center gap-2 p-3 text-center">
              <LucideByName name={name} size={32} className="text-foreground" />
              <span className="line-clamp-2 w-full break-words text-caption text-muted-foreground">
                {`lucide/${name}`}
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="unknown-heading" className="flex flex-col gap-3">
        <Heading id="unknown-heading" level={3} size="subtitle">
          {LABELS.unknownHeading}
        </Heading>
        <Card className="flex w-28 flex-col items-center gap-2 p-3 text-center">
          <ServiceLogo name={UNKNOWN_NAME} size={32} variant={variant} />
          <span className="w-full break-words text-caption text-muted-foreground">
            {UNKNOWN_NAME}
          </span>
        </Card>
      </section>
    </div>
  );
}
