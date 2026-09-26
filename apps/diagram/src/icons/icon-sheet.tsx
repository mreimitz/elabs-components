import { useMemo, useState } from "react";
import { ServiceLogo } from "@elabs-ai/components-icons";
import { Badge, Button } from "@elabs-ai/components-ui";
import { ICON_INDEX, ICON_PACKS } from "./register-packs";
import { LUCIDE_ICONS, LucideByName } from "./lucide-map";

export interface IconSheetProps {
  /** Pre-selects a vendor (from the sidebar's "Icon packs" menu, which
   *  navigates to `#icons/<vendor>` — `app.tsx`'s hash route parses the
   *  segment after `#icons/` and hands it in here). `undefined`/unknown
   *  vendor falls back to "all". */
  initialVendor?: string;
}

type MarkVariant = "brand" | "mono";

const ALL_VENDORS = "all";

/**
 * The `#icons` dev route (DG-04 step 6) — every vendored icon
 * (`public/icons/index.json`) in a filterable grid, plus the `lucide/<name>`
 * generic-glyph set and a standing "unknown name" proof of the monogram
 * fallback (acceptance: unknown name → accessible monogram).
 */
export function IconSheet({ initialVendor }: IconSheetProps) {
  const knownVendor = initialVendor && ICON_PACKS.some((p) => p.pack === initialVendor);
  const [vendor, setVendor] = useState<string>(knownVendor ? initialVendor! : ALL_VENDORS);
  const [variant, setVariant] = useState<MarkVariant>("brand");

  const totalCount = Object.keys(ICON_INDEX).length;

  const entries = useMemo(
    () =>
      Object.entries(ICON_INDEX)
        .filter(([key]) => vendor === ALL_VENDORS || key.startsWith(`${vendor}/`))
        .sort(([a], [b]) => a.localeCompare(b)),
    [vendor],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6" data-slot="icon-sheet">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title font-semibold">Icon packs</h2>
          <p className="text-caption text-muted-foreground">
            {totalCount} icons across {ICON_PACKS.length} packs — every icon name in the YAML
            dialect is vendor/name, resolved through ServiceLogo.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Mark style">
          <Button
            type="button"
            size="sm"
            variant={variant === "brand" ? "default" : "outline"}
            aria-pressed={variant === "brand"}
            onClick={() => setVariant("brand")}
          >
            Brand
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "mono" ? "default" : "outline"}
            aria-pressed={variant === "mono"}
            onClick={() => setVariant("mono")}
          >
            Mono
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Vendor filter">
        <Button
          type="button"
          size="sm"
          variant={vendor === ALL_VENDORS ? "default" : "outline"}
          aria-pressed={vendor === ALL_VENDORS}
          onClick={() => setVendor(ALL_VENDORS)}
        >
          All
          <Badge variant="outline" className="ms-2 tabular-nums">
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
            onClick={() => setVendor(pack)}
          >
            {pack}
            <Badge variant="outline" className="ms-2 tabular-nums">
              {count}
            </Badge>
          </Button>
        ))}
      </div>

      <section aria-label={`${vendor === ALL_VENDORS ? "All" : vendor} icons`}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
          {entries.map(([key]) => (
            <div
              key={key}
              className="flex flex-col items-center gap-2 rounded-md border border-border bg-card p-3 text-center"
            >
              <ServiceLogo name={key} size={32} variant={variant} />
              <span className="w-full truncate text-caption text-muted-foreground" title={key}>
                {key}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="lucide-heading" className="flex flex-col gap-3">
        <h3 id="lucide-heading" className="text-subtitle font-medium">
          lucide/&lt;name&gt; — generic glyphs
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
          {Object.keys(LUCIDE_ICONS).map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded-md border border-border bg-card p-3 text-center"
            >
              <LucideByName name={name} size={32} className="text-foreground" />
              <span className="w-full truncate text-caption text-muted-foreground">
                lucide/{name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="unknown-heading" className="flex flex-col gap-3">
        <h3 id="unknown-heading" className="text-subtitle font-medium">
          Unknown name (monogram fallback)
        </h3>
        <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-card p-3 text-center w-28">
          <ServiceLogo name="nope/x" size={32} variant={variant} />
          <span className="w-full truncate text-caption text-muted-foreground">nope/x</span>
        </div>
      </section>
    </div>
  );
}
