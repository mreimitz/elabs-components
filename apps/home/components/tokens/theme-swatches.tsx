"use client";

/**
 * ThemeSwatches — the nine reference families as cards (RM-103, concept §4.5): a light/dark
 * swatch pair, the family name, its typeface line, and a `Use` button bound to the site's own
 * theme state (`useSiteTheme`, RM-091's `setFamily`, unchanged — wave-4 ruling 25). The swatch
 * colours are literal values from `themes.json` (RM-090), the SAME precedent `site-nav.tsx`'s
 * `NavThemeSwitch` already uses for `ThemeFamilySwitch`'s `swatch` prop: generated theme data
 * rendered as an inline colour, never a hand-typed literal.
 */
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CommandChip,
} from "@elabs-ai/components-ui";
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
            <Card key={t.slug} data-active={isActive ? "" : undefined}>
              <CardHeader>
                <CardTitle>{t.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 overflow-hidden rounded-md border border-border-strong"
                >
                  <span
                    className="h-full flex-1"
                    style={{ background: light?.background ?? undefined }}
                  />
                  <span
                    className="h-full flex-1"
                    style={{ background: dark?.background ?? undefined }}
                  />
                </div>
                <p className="text-caption text-muted-foreground">
                  {t.hasTypeface
                    ? themeSwatchesCopy.typefaceVendored
                    : themeSwatchesCopy.typefaceSystem}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setFamily(t.slug)}
                  aria-pressed={isActive}
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
