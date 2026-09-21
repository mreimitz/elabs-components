"use client";

/**
 * ThemePreview — one theme shown through an interface instead of a colour chip: the SAME
 * metric card, input and button on every theme card, so the only thing that differs from card
 * to card is the theme — surface, hairline, corner radius, typeface, the primary and the chart
 * ink — which is what a family actually changes.
 *
 * How it scopes: every family ships as a `[data-theme="<value>"]` block that sets the full
 * colour/radius/font token set, so a nested `data-theme` re-themes just this subtree.
 * `data-density="comfortable"` is the library's default density; naming it here re-declares the
 * `--text-*` roles INSIDE the scope, so a family that ships its own type scale resolves
 * against its tokens rather than the page's.
 *
 * Both modes are rendered and CSS shows the one that matches the page (`dark:` follows the
 * page's theme), so there is no mode to read on the client and nothing to flash on hydration.
 * The visibility classes sit on an OUTER box: the `dark` variant also matches a nested
 * `data-theme="…-dark"` element itself, which would un-hide the dark copy on a light page.
 *
 * Decorative: `inert` + `aria-hidden`, so nine cards do not add eighteen tab stops. The card's
 * own `Use` button is the control.
 */
import { Button, Input } from "@elabs-ai/components-ui";
import { MetricCard, Sparkline } from "@elabs-ai/components-charts";
import { themeSwatchesCopy } from "../../content/copy";

const copy = themeSwatchesCopy.preview;

function PreviewSurface({ theme }: { theme: string }) {
  return (
    <div
      data-theme={theme}
      data-density="comfortable"
      className="flex flex-col gap-3 bg-background p-4 text-foreground"
    >
      <MetricCard
        label={copy.metricLabel}
        value={copy.metricValue}
        delta={copy.metricDelta}
        deltaDirection="up"
        description={copy.metricDescription}
        copyExactValue={false}
        sparkline={
          <Sparkline
            values={[...copy.trend]}
            variant="bar"
            fit="fill"
            height={28}
            className="w-full"
            aria-hidden="true"
          />
        }
      />
      <div className="flex items-center gap-2">
        <Input
          aria-label={copy.inputLabel}
          placeholder={copy.inputPlaceholder}
          readOnly
          tabIndex={-1}
          className="min-w-0 flex-1"
        />
        <Button type="button" tabIndex={-1}>
          {copy.button}
        </Button>
      </div>
    </div>
  );
}

export function ThemePreview({
  light,
  dark,
}: {
  /** The family's `data-theme` value per mode; a family may ship only one. */
  light?: string;
  dark?: string;
}) {
  const lightTheme = light ?? dark;
  const darkTheme = dark ?? light;
  if (!lightTheme || !darkTheme) return null;
  return (
    <div data-slot="theme-preview" aria-hidden="true" inert>
      <div className="dark:hidden">
        <PreviewSurface theme={lightTheme} />
      </div>
      <div className="hidden dark:block">
        <PreviewSurface theme={darkTheme} />
      </div>
    </div>
  );
}
