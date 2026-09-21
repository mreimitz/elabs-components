"use client";

/**
 * ThemeSwatches — the nine reference families as cards (RM-103, concept §4.5): each theme shown
 * through a small real interface (`ThemePreview`: the same metric card, input and button on
 * every card), the family name, its typeface line, and a `Use` button bound to the site's own
 * theme state (`useSiteTheme`, RM-091's `setFamily`, unchanged — wave-4 ruling 25).
 *
 * The cards used to carry a two-tone colour bar (`primary` over `chart1`, light beside dark).
 * A bar says "this one is blue"; it cannot say that the family also changes the surface, the
 * hairline, the corner radius and the typeface — which is the capability. The preview renders
 * the family's own `data-theme` value from `themes.json` (RM-090), in the page's current mode.
 */
import { Button, Card, CardFooter, CardTitle, CommandChip } from "@elabs-ai/components-ui";
import { ThemePreview } from "./theme-preview";
import { themes } from "../../lib/content";
import { useHydratedSiteTheme } from "../gallery/theme-control";
import { themeSwatchesCopy } from "../../content/copy";
import createThemeSkill from "../../content/generated/create-theme.json";

export function ThemeSwatches() {
  const { family, setFamily } = useHydratedSiteTheme();
  return (
    <div data-slot="theme-swatches" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-title text-foreground">{themeSwatchesCopy.heading}</h3>
        <p className="max-w-prose text-body text-muted-foreground">{themeSwatchesCopy.intro}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const light = t.modes.find((m) => m.mode === "light");
          const dark = t.modes.find((m) => m.mode === "dark");
          const isActive = family === t.slug;
          return (
            <Card
              key={t.slug}
              data-active={isActive ? "" : undefined}
              className="gap-0 overflow-hidden p-0"
            >
              <div className="border-b border-border">
                <ThemePreview light={light?.value} dark={dark?.value} />
              </div>
              <CardFooter className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <CardTitle className="text-subtitle">{t.displayName}</CardTitle>
                  <p className="text-caption text-muted-foreground">
                    {t.hasTypeface
                      ? themeSwatchesCopy.typefaceVendored
                      : themeSwatchesCopy.typefaceSystem}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setFamily(t.slug)}
                  aria-pressed={isActive}
                  aria-label={`${isActive ? themeSwatchesCopy.active : themeSwatchesCopy.use}: ${t.displayName}`}
                >
                  {isActive ? themeSwatchesCopy.active : themeSwatchesCopy.use}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <div className="flex flex-col gap-3">
        <h4 className="text-title text-foreground">{themeSwatchesCopy.createTheme.heading}</h4>
        <p className="max-w-prose text-body text-muted-foreground">
          {themeSwatchesCopy.createTheme.description}
        </p>
        <CommandChip
          hosts={[
            {
              id: "agent",
              label: themeSwatchesCopy.createTheme.hostLabel,
              command: createThemeSkill.invocation,
            },
          ]}
        />
      </div>
    </div>
  );
}
