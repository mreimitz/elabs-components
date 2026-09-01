import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  ThemeProvider,
} from "@elabs-ai/components-tokens";
import { Button, ThemeSwitcher } from "@elabs-ai/components-ui";

/**
 * THEMING — how one set of components renders any number of different looks.
 *
 * A theme is a block of semantic token VALUES applied with the `data-theme`
 * attribute on a root element. `:root` is a neutral light base/fallback; each
 * theme is a `[data-theme="…"]` block. Components reference tokens
 * (`bg-background`, `text-muted-foreground`, `border-border`), never raw colors
 * — so re-theming is purely a token swap.
 *
 * **Theming is OPEN (ADR 0029).** `light` and `dark` are the two REFERENCE
 * themes shipped by `@elabs-ai/components-tokens`; they are the worked example, not
 * the menu. You author your own `[data-theme]` block, register it with
 * `<ThemeProvider themes={…}>`, and every component themes correctly with no
 * change to the library — see "Bring your own theme" below.
 *
 * Switch the shipped pair with the toolbar (the paint-roller control);
 * everything on the page re-colors because the same tokens resolve to new values.
 *
 * Orthogonal to color, three more dials live in the toolbar and write their own
 * root attributes: DECORATION (`data-decoration`, 0–10 reprographic texture),
 * DENSITY (`data-density`, spacing + type scale) and MOTION (`data-motion-pref`).
 */

const meta = {
  title: "Foundations/Theming",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "How `data-theme` + semantic tokens give one component set any number of " +
          "looks — the two reference themes (light, dark), a theme you author " +
          "yourself, plus the orthogonal decoration / density / motion dials. Flip " +
          "the toolbar controls and watch the sample composition below adapt.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// The two REFERENCE themes — slug (the data-theme value) + display label.
const THEMES = [
  { slug: "light", label: "Light", note: "Default. Brand primary on near-white surfaces." },
  { slug: "dark", label: "Dark", note: "Warm charcoal surfaces, off-white text." },
] as const;

const DIALS = [
  {
    name: "Decoration",
    attr: "data-decoration",
    range: "0 – 10",
    blurb:
      "Reprographic drafting texture (grid / hatch / squared corners), hue-independent. 0 = plain; 8–10 = the full drawn look.",
  },
  {
    name: "Density",
    attr: "data-density",
    range: "compact · comfortable · spacious",
    blurb:
      "Rescales the spacing scale (`--spacing`) AND the type scale (`--type-factor`) together, so a surface tightens as a whole. Type moves at half spacing's rate, above a 13px body floor.",
  },
  {
    name: "Motion",
    attr: "data-motion-pref",
    range: "system · reduced · full",
    blurb:
      "Gates micro-interaction timing. Respects the OS reduce-motion request unless explicitly set to full.",
  },
] as const;

/**
 * A small but representative composition built ONLY from semantic token
 * utilities — a card on the page ground, with a heading, body, a muted caption,
 * a primary and secondary action, a status pill and a divider. Nothing here is
 * theme-specific: switch the toolbar theme (and try the decoration / density
 * dials) and every part re-skins automatically.
 */
function SampleComposition() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="space-y-1">
        <h4 className="text-title text-foreground">Project overview</h4>
        <p className="m-0 text-body text-muted-foreground">
          A representative surface — card, text, actions and status — rendered entirely from
          semantic tokens.
        </p>
      </div>

      <div className="my-4 border-t border-border" />

      <div className="flex flex-wrap items-center gap-3">
        {/* Primary action — fill + paired foreground ink. */}
        <span className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-body font-medium text-primary-foreground">
          Primary action
        </span>
        {/* Secondary action — neutral fill. */}
        <span className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-body font-medium text-secondary-foreground">
          Secondary
        </span>
        {/* Outline control — border-strong is the sole structural cue (no fill). */}
        <span className="inline-flex items-center rounded-md border border-border-strong px-3 py-1.5 text-body text-foreground">
          Outline
        </span>
        {/* Status pill on a fill. Sits beside the primary action ON PURPOSE:
            --success and --primary are DIFFERENT roles and must not read as the
            same colour (#334). `data-status="complete"` is the same hook
            `StatusBadge` emits — under high decoration this is what
            lets decoration.css's [data-status] line-type channel (#391)
            distinguish it from the "Running" chip below once colour alone
            cannot (both are raw role fills, so the drawn-not-filled
            override collapses them to one identical appearance). */}
        <span
          data-status="complete"
          className="inline-flex items-center rounded-full bg-success px-2.5 py-0.5 text-meta font-medium text-success-foreground"
        >
          Active
        </span>
        {/* The other half of the #334 pair — an --info fill, next to the focus
            ring below, which must not read as the same colour either.
            `data-status="running"` — see the "Active" chip's comment above. */}
        <span
          data-status="running"
          className="inline-flex items-center rounded-full bg-info px-2.5 py-0.5 text-meta font-medium text-info-foreground"
        >
          Running
        </span>
        {/* On-surface status TEXT (uses the -text variant, not the fill). */}
        <span className="text-meta font-medium text-destructive-text">3 errors</span>
      </div>

      {/* A field carrying the focus ring at rest, so --ring can be compared with
          the "Running" (--info) chip above without holding focus (#334). The
          real control below it still shows the genuine focus-visible ring. */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-meta text-muted-foreground">Focus ring (--ring)</span>
          <div className="h-9 w-40 rounded-md border border-input bg-background ring-2 ring-ring" />
        </div>
        <div className="space-y-1">
          <label htmlFor="theming-focus-demo" className="block text-meta text-muted-foreground">
            Tab into me
          </label>
          <input
            id="theming-focus-demo"
            name="theming-focus-demo"
            type="text"
            autoComplete="off"
            placeholder="Focus me…"
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="mt-4 rounded-md bg-surface-muted p-3">
        <p className="m-0 text-caption text-muted-foreground">
          A recessed well (<code className="text-code">bg-surface-muted</code>) for secondary
          content.
        </p>
      </div>
    </div>
  );
}

export const Overview: Story = {
  name: "How theming works",
  render: () => (
    <div className="space-y-6">
      <div className="max-w-prose space-y-2">
        <p className="m-0 text-body text-foreground">
          A theme is a set of semantic token <em>values</em> applied via the{" "}
          <code className="text-code">data-theme</code> attribute. Components reference tokens, so
          switching the theme re-colors everything below at once.
        </p>
        <p className="m-0 text-caption text-muted-foreground">
          Use the <strong>theme</strong> control in the toolbar to flip between themes, and the{" "}
          <strong>Decoration</strong> / <strong>Density</strong> / <strong>Motion</strong> dials to
          exercise the orthogonal axes.
        </p>
      </div>
      <SampleComposition />
    </div>
  ),
  // Rendered regression lock for #391 — "a role-fill collapse at high decoration
  // must ship a non-colour compensator". `getComputedStyle` DOES resolve
  // rendered background/border here (unlike the manual oklch→sRGB contrast
  // math elsewhere, which needs a canvas) because this asserts STRUCTURAL
  // inequality between two elements' resolved values, not a numeric contrast
  // ratio — the browser resolves both sides the same way, so a string
  // comparison stays valid even if the resolved format isn't literally oklch.
  //
  // Scoped to the "Active" (complete) / "Running" (running) chip pair —
  // the concrete, testable half of #391's acceptance criteria ("complete and
  // running are distinguishable without colour on the raw-fill surface"). A
  // "ring field vs info chip" comparison was considered (the RCA's evidence
  // table also names that pair) and deliberately left OUT of this hard
  // assertion: the ring-at-rest demo's `bg-background` and the info chip's
  // (decoration-overridden) `background-color: transparent` already differ
  // today, with or without this fix, so asserting "at least one property
  // differs" there would be vacuously true and would not exercise the
  // [data-status] channel at all — it would not catch a regression.
  //
  // MUST fail at pre-#391 high decoration — both chips are raw role
  // fills (`bg-success`/`bg-info`), so decoration.css's drawn-not-filled
  // override collapses them to one identical declaration set. MUST pass
  // after the fix (and at decoration 0, where colour alone
  // already separates them). Run under both theme globals via
  // `mcp__storybook__run-story-tests` / `pnpm --filter @elabs-ai/components-docs test-storybook`.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const completeChip = await canvas.findByText("Active");
    const runningChip = await canvas.findByText("Running");

    const completeStyle = getComputedStyle(completeChip);
    const runningStyle = getComputedStyle(runningChip);
    const completeBefore = getComputedStyle(completeChip, "::before");
    const runningBefore = getComputedStyle(runningChip, "::before");

    const differs =
      completeStyle.backgroundColor !== runningStyle.backgroundColor ||
      completeStyle.borderColor !== runningStyle.borderColor ||
      completeStyle.borderStyle !== runningStyle.borderStyle ||
      completeStyle.backgroundImage !== runningStyle.backgroundImage ||
      completeBefore.content !== runningBefore.content;

    await expect(
      differs,
      'the "Active" (complete) and "Running" (running) status chips must differ in at least one of background-color/border-color/border-style/background-image/::before-content — colour alone cannot carry this at high decoration (#391)',
    ).toBe(true);
  },
};

export const ShippedThemes: Story = {
  name: "The reference themes",
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Two <strong>reference</strong> themes ship in{" "}
        <code className="text-code">@elabs-ai/components-tokens</code> — enough to prove the
        light/dark contract, and the worked example for one you author yourself. Pass the{" "}
        <strong>slug</strong> (the <code className="text-code">data-theme</code> value), never the
        display name, when setting a theme programmatically or via the Storybook globals.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => (
          <div key={t.slug} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-subtitle text-foreground">{t.label}</span>
              <code className="text-meta text-muted-foreground">{t.slug}</code>
            </div>
            <p className="m-0 mt-1 text-caption text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const ShippingASubset: Story = {
  name: "Shipping a subset of the themes",
  render: () => (
    <div className="max-w-prose space-y-4">
      <p className="m-0 text-body text-foreground">
        A product that exposes only <em>some</em> of the shipped themes passes{" "}
        <code className="text-code">allowedThemes</code> to{" "}
        <code className="text-code">ThemeProvider</code>. One prop covers every path — don&rsquo;t
        hand-roll the filtering.
      </p>
      <pre className="m-0 overflow-x-auto rounded-lg border border-border bg-card p-4 text-code text-card-foreground">
        {`<ThemeProvider allowedThemes={["light", "dark"]}>
  <App />
</ThemeProvider>`}
      </pre>
      <ul className="m-0 space-y-1.5 ps-5 text-caption text-muted-foreground">
        <li>
          <code className="text-code">useTheme().themes</code> lists only the allowed names — build
          switchers off that, never off a module-level constant.
        </li>
        <li>
          A persisted value for a now-hidden theme is rejected in the same mount pass that applies
          the theme, so it can never flash on boot.
        </li>
        <li>
          <code className="text-code">setTheme</code> with a disallowed name is a no-op that warns
          in development, and never writes it to storage.
        </li>
        <li>Omitting the prop is unchanged behaviour: the whole registry is available.</li>
      </ul>
      <p className="m-0 text-caption text-muted-foreground">
        <code className="text-code">ThemeSwitcher</code> renders the provider&rsquo;s registry, so
        it inherits the subset with <strong>no prop at all</strong>. Its own{" "}
        <code className="text-code">themes</code> prop is now purely an extra narrowing on top.
      </p>
      <p className="m-0 text-caption text-muted-foreground">
        <code className="text-code">allowedThemes</code> is the narrower of the two knobs. Prefer
        registering exactly the themes you ship via <code className="text-code">themes</code> —
        reach for <code className="text-code">allowedThemes</code> when one registry feeds several
        products that each surface a slice of it.
      </p>
    </div>
  ),
};

/**
 * The `[data-theme="sandstone"]` block for the demo below.
 *
 * DELIBERATELY PARTIAL, and it says so on the page: a real theme must define
 * every name in `THEME_TOKEN_NAMES` (123 of them), which is what
 * `pnpm theme-parity:check` holds the shipped themes to and what a consumer
 * asserts in their own test. What is declared here is the subset the sample
 * composition renders; anything omitted falls back to `:root` — the exact
 * failure mode a coverage assertion exists to catch, shown honestly rather than
 * hidden behind a hand-copied wall of 123 declarations that would go stale.
 */
const SANDSTONE_CSS = `
[data-theme="sandstone"] {
  color-scheme: light;

  --background: oklch(0.97 0.014 85);
  --foreground: oklch(0.28 0.03 60);
  --card: oklch(0.99 0.008 85);
  --card-foreground: oklch(0.28 0.03 60);
  --surface-muted: oklch(0.94 0.02 82);
  --muted: oklch(0.93 0.02 82);
  --muted-foreground: oklch(0.5 0.03 62);

  --primary: oklch(0.55 0.13 42);
  --primary-foreground: oklch(0.99 0.008 85);
  --primary-text: oklch(0.47 0.12 42);
  --secondary: oklch(0.92 0.025 80);
  --secondary-foreground: oklch(0.32 0.04 60);

  --border: oklch(0.88 0.02 80);
  --border-strong: oklch(0.7 0.03 72);
  --input: oklch(0.88 0.02 80);
  --ring: oklch(0.62 0.12 42);

  --success: oklch(0.52 0.13 150);
  --success-foreground: oklch(0.99 0.008 85);
  --info: oklch(0.52 0.12 240);
  --info-foreground: oklch(0.99 0.008 85);
  --destructive-text: oklch(0.48 0.17 28);
}
`;

/** A consumer theme, declared exactly as a consuming app would declare it. */
const sandstone = defineTheme({
  value: "sandstone",
  label: "Sandstone",
  dark: false,
  description: "A demo theme authored outside the library — warm clay on a sand ground.",
});

/**
 * Registers a third theme at runtime and renders it beside the reference pair.
 *
 * Scoped on purpose: `attributeTarget` points at this story's own wrapper, so
 * the demo writes `data-theme` on that element instead of `<html>` and never
 * fights the Storybook toolbar. Storage keys are disabled for the same reason —
 * a docs demo must not persist over the reader's real preference.
 *
 * The `target && …` guard is load-bearing, not defensive noise: `ThemeProvider`
 * applies the theme in a mount-once effect, and a ref is null on the first
 * render — so mounting the provider immediately would apply the theme to
 * `<html>` (the `attributeTarget = null` default) and never re-apply it to the
 * element once the ref lands. Mounting the provider on the second pass is the
 * pattern any scoped `attributeTarget` needs today.
 */
function BringYourOwnThemeDemo() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <style>{SANDSTONE_CSS}</style>
      <div ref={setTarget} className="rounded-lg border border-border bg-background p-4">
        {target ? (
          <ThemeProvider
            themes={[...BUILT_IN_THEME_DEFINITIONS, sandstone]}
            defaultTheme="sandstone"
            attributeTarget={target}
            storageKey={null}
            motionStorageKey={null}
            decorationStorageKey={null}
            densityStorageKey={null}
            registerStorageKey={null}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="m-0 text-caption text-muted-foreground">
                This region is themed by its own provider — one of its themes is authored here.
              </p>
              <ThemeSwitcher mode="dropdown" showSystem={false} />
            </div>
            <SampleComposition />
          </ThemeProvider>
        ) : null}
      </div>
    </>
  );
}

export const BringYourOwnTheme: Story = {
  name: "Bring your own theme",
  render: () => (
    <div className="space-y-5">
      <div className="max-w-prose space-y-2">
        <p className="m-0 text-body text-foreground">
          Theme names are <strong>open</strong> (ADR 0029). A theme is any{" "}
          <code className="text-code">[data-theme=&quot;…&quot;]</code> block covering the token
          contract, registered on the provider. Nothing in the library needs to know its name.
        </p>
        <p className="m-0 text-caption text-muted-foreground">
          Below, a <code className="text-code">sandstone</code> theme is defined in this story file
          and offered alongside the two reference themes. Pick it in the switcher — the whole region
          re-colors, and the switcher labels, iconography and &ldquo;System&rdquo; resolution all
          work with no library change.
        </p>
      </div>

      <pre className="m-0 overflow-x-auto rounded-lg border border-border bg-card p-4 text-code text-card-foreground">
        {`/* 1. Author the block — every name in THEME_TOKEN_NAMES. */
[data-theme="sandstone"] {
  color-scheme: light;
  --background: oklch(0.97 0.014 85);
  /* … */
}

/* 2. Describe it. */
const sandstone = defineTheme({
  value: "sandstone", label: "Sandstone", dark: false,
});

/* 3. Register it. \`themes\` REPLACES the default registry —
      spread the built-ins to keep them. */
<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, sandstone]}>
  <App />
</ThemeProvider>`}
      </pre>

      <BringYourOwnThemeDemo />

      <ul className="m-0 max-w-prose space-y-1.5 ps-5 text-caption text-muted-foreground">
        <li>
          <strong>Cover the contract.</strong> Assert your stylesheet defines every{" "}
          <code className="text-code">THEME_TOKEN_NAMES</code> entry in your own test — a missing
          token silently falls back to <code className="text-code">:root</code> and usually looks
          wrong. The <code className="text-code">sandstone</code> block above is deliberately
          partial, so a few values here come from that fallback.
        </li>
        <li>
          <strong>
            Declare <code className="text-code">color-scheme</code>.
          </strong>{" "}
          It is how the library answers &ldquo;is this theme dark&rdquo; for a theme it has never
          heard of — native scrollbars and controls follow it, and so do Monaco, map basemaps and
          toasts.
        </li>
        <li>
          <strong>
            Keep <code className="text-code">dark</code> in agreement
          </strong>{" "}
          with that declaration. The flag drives switcher iconography and which theme
          &ldquo;System&rdquo; picks.
        </li>
        <li>
          Ship <em>only</em> your themes by omitting the built-in spread — the registry is replaced,
          not extended.
        </li>
      </ul>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Radix portals the menu to <body>, outside the story canvas.
    const doc = within(canvasElement.ownerDocument.body);

    // The consumer theme is offered by a switcher that was given no `themes`
    // prop — i.e. it came from the PROVIDER's registry.
    await userEvent.click(canvas.getByRole("button", { name: "Theme" }));
    const menu = await doc.findByRole("menu");
    await expect(within(menu).getByText("Sandstone")).toBeInTheDocument();
    await expect(within(menu).getByText("Light")).toBeInTheDocument();

    // Picking a reference theme, then the consumer theme, applies each in turn —
    // on the SCOPED target, never the document root (which the toolbar owns).
    const region = canvasElement.querySelector<HTMLElement>("[data-theme]");
    await expect(region).not.toBeNull();
    const rootTheme = canvasElement.ownerDocument.documentElement.getAttribute("data-theme");

    // `waitFor`: the switch runs inside `document.startViewTransition`, so the
    // attribute write lands a frame later than the click.
    await userEvent.click(await doc.findByRole("menuitem", { name: /light/i }));
    await waitFor(() => expect(region?.getAttribute("data-theme")).toBe("light"));

    // `find`, not `get`: Radix keeps the page outside the menu `aria-hidden`
    // until the dismiss settles, and an aria-hidden subtree is invisible to
    // byRole — a synchronous read here is a flake, not an assertion.
    await userEvent.click(await canvas.findByRole("button", { name: "Theme" }));
    await userEvent.click(await doc.findByRole("menuitem", { name: /sandstone/i }));
    await waitFor(() => expect(region?.getAttribute("data-theme")).toBe("sandstone"));

    // The scoping actually held: the document root still carries whatever the
    // toolbar set. A provider that leaked to <html> would have overwritten it.
    await expect(canvasElement.ownerDocument.documentElement.getAttribute("data-theme")).toBe(
      rootTheme,
    );

    // Wait for Radix to unwind the `aria-hidden` it puts on the rest of the page
    // while the menu is open. axe runs AFTER the play function, and a wrapper
    // still carrying `aria-hidden` around focusable content is a real
    // `aria-hidden-focus` violation — it is the dismiss that is unfinished, not
    // the markup that is wrong, so the fix is to await it, never to exempt it.
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector("[data-aria-hidden]")).toBeNull(),
    );
  },
};

/**
 * A tenant's runtime brand color — deliberately far from the shipped themes'
 * own `--primary` (a brand lime), so the swatch's color change is unambiguous
 * regardless of which reference theme the Storybook toolbar has active.
 */
const TENANT_COLORS = {
  acme: "oklch(0.55 0.18 250)", // blue
  globex: "oklch(0.62 0.2 25)", // red/orange
} as const;
type TenantId = keyof typeof TENANT_COLORS;

/**
 * Runtime `tokenOverrides` (#17, ADR 0031) driving a scoped brand patch — the
 * multi-tenant/white-label scenario the feature exists for: a tenant's brand
 * color is not known until an admin picks it or a lookup resolves, so it
 * can't live in a build-time `[data-theme]` block the way `BringYourOwnTheme`
 * above demonstrates.
 *
 * Deliberately mirrors the CALLBACK-REF pattern from `BringYourOwnThemeDemo`
 * — `attributeTarget` starts `null` until `ref={setTarget}` resolves — but,
 * UNLIKE that demo, mounts `ThemeProvider` from the very first render rather
 * than gating on `target &&`. That is intentional: it is exactly the shape
 * that used to leak the override onto `<html>` permanently, because the
 * effect's fallback to `document.documentElement` on the first (null-target)
 * run was never cleaned up once the ref resolved (ADR 0031 Amendment,
 * 2026-08-30). The play function below asserts the document root never
 * carries the override, in a REAL rendered browser — the "verified only
 * statically, never observed rendering" gap that fix round's review named.
 */
function RuntimeTokenOverridesDemo() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [tenant, setTenant] = useState<TenantId | null>("acme");
  const [previewOpen, setPreviewOpen] = useState(true);

  const overrides = tenant ? { "--primary": TENANT_COLORS[tenant] } : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tenant === "acme" ? "default" : "outline"}
          onClick={() => {
            setTenant("acme");
            setPreviewOpen(true);
          }}
        >
          Acme (blue)
        </Button>
        <Button
          size="sm"
          variant={tenant === "globex" ? "default" : "outline"}
          onClick={() => {
            setTenant("globex");
            setPreviewOpen(true);
          }}
        >
          Globex (red)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTenant(null)}>
          No override
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen((open) => !open)}>
          {previewOpen ? "Close" : "Open"} tenant preview
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="block text-meta text-muted-foreground">
            Reference — the theme&rsquo;s own <code className="text-code">--primary</code>,
            untouched
          </span>
          <div
            data-testid="reference-swatch"
            aria-hidden="true"
            className="h-12 w-full rounded-md bg-primary"
          />
        </div>

        <div ref={setTarget} className="space-y-1.5 rounded-lg border border-border p-2">
          <span className="block text-meta text-muted-foreground">
            Tenant preview {previewOpen ? "(open)" : "(closed)"}
          </span>
          {previewOpen ? (
            <ThemeProvider
              attributeTarget={target}
              tokenOverrides={overrides}
              storageKey={null}
              motionStorageKey={null}
              decorationStorageKey={null}
              densityStorageKey={null}
              registerStorageKey={null}
            >
              <div
                data-testid="primary-swatch"
                aria-hidden="true"
                className="h-12 w-full rounded-md bg-primary"
              />
            </ThemeProvider>
          ) : (
            <div
              data-testid="primary-swatch"
              aria-hidden="true"
              className="h-12 w-full rounded-md bg-primary"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const RuntimeTokenOverrides: Story = {
  name: "Runtime token overrides",
  render: () => (
    <div className="space-y-5">
      <div className="max-w-prose space-y-2">
        <p className="m-0 text-body text-foreground">
          <code className="text-code">tokenOverrides</code> patches one or two tokens at{" "}
          <strong>runtime</strong> — for a value not known until the app boots (a tenant&rsquo;s
          brand color from a lookup, an admin-picked accent) — unlike{" "}
          <code className="text-code">BringYourOwnTheme</code> above, which needs the value at{" "}
          <strong>build</strong> time (issue #17, ADR 0031).
        </p>
        <p className="m-0 text-caption text-muted-foreground">
          It layers over whichever theme is active — no{" "}
          <code className="text-code">[data-theme]</code> block to author, no{" "}
          <code className="text-code">THEME_TOKEN_NAMES</code> coverage required. Pick a tenant
          below; only <code className="text-code">--primary</code> is forced, everything else keeps
          coming from the active reference theme.
        </p>
      </div>

      <pre className="m-0 overflow-x-auto rounded-lg border border-border bg-card p-4 text-code text-card-foreground">
        {`<ThemeProvider tokenOverrides={{ "--primary": tenant.brandColor }}>
  <App />
</ThemeProvider>`}
      </pre>

      <RuntimeTokenOverridesDemo />

      <ul className="m-0 max-w-prose space-y-1.5 ps-5 text-caption text-muted-foreground">
        <li>
          <strong>Partial, not a replacement.</strong> Only the keys you pass are forced; every
          other token keeps coming from the active theme.
        </li>
        <li>
          <strong>
            Values are validated too (<code className="text-code">CSS.supports</code>)
          </strong>
          , not just keys — an invalid value is rejected with a console warning instead of silently
          resolving to <code className="text-code">unset</code>.
        </li>
        <li>
          <strong>Cleared when the target changes, and on unmount</strong> — closing the tenant
          preview above removes the override instead of leaving it stuck.
        </li>
      </ul>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const docRoot = canvasElement.ownerDocument.documentElement;

    const referenceColor = () =>
      getComputedStyle(canvas.getByTestId("reference-swatch")).backgroundColor;
    const primaryColor = () =>
      getComputedStyle(canvas.getByTestId("primary-swatch")).backgroundColor;

    // Initial state: Acme (blue) is active, so the tenant swatch reads
    // differently from the untouched reference.
    await waitFor(() => expect(primaryColor()).not.toBe(referenceColor()));
    // I2 regression lock, in a REAL rendered browser (static review alone
    // could not verify this): the override never lands on the document root,
    // even though `attributeTarget` started `null` on the first render — see
    // the component doc comment above for why that shape used to leak.
    await expect(docRoot.style.getPropertyValue("--primary")).toBe("");

    // "No override" restores the theme's own value — swatches match again.
    await userEvent.click(canvas.getByRole("button", { name: "No override" }));
    await waitFor(() => expect(primaryColor()).toBe(referenceColor()));

    // Globex (red) diverges again.
    await userEvent.click(canvas.getByRole("button", { name: "Globex (red)" }));
    await waitFor(() => expect(primaryColor()).not.toBe(referenceColor()));
    await expect(docRoot.style.getPropertyValue("--primary")).toBe("");

    // I3 regression lock: closing the preview UNMOUNTS the provider — the
    // override must be cleared, not left stuck on the target.
    await userEvent.click(canvas.getByRole("button", { name: "Close tenant preview" }));
    await waitFor(() => expect(primaryColor()).toBe(referenceColor()));

    // Reopening re-applies it.
    await userEvent.click(canvas.getByRole("button", { name: "Open tenant preview" }));
    await waitFor(() => expect(primaryColor()).not.toBe(referenceColor()));
    await expect(docRoot.style.getPropertyValue("--primary")).toBe("");
  },
};

export const Dials: Story = {
  name: "Orthogonal dials",
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Independent of color, three dials adjust texture, rhythm and motion. Each is driven by a
        root attribute and surfaced in the Storybook toolbar.
      </p>
      <div className="space-y-3">
        {DIALS.map((d) => (
          <div key={d.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-subtitle text-foreground">{d.name}</span>
              <code className="text-meta text-muted-foreground">{d.attr}</code>
            </div>
            <p className="m-0 mt-0.5 text-meta text-muted-foreground tabular-nums">{d.range}</p>
            <p className="m-0 mt-1 text-caption text-muted-foreground">{d.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};
