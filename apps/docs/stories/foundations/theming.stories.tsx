import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

/**
 * THEMING — how one set of components renders three different looks.
 *
 * A theme is a block of semantic token VALUES applied with the `data-theme`
 * attribute on a root element. `:root` is a neutral light base/fallback; each
 * theme is a `[data-theme="…"]` block in `@qlik-coe-emea/qlabs-components-tokens` `themes.css`.
 * Components reference tokens (`bg-background`, `text-muted-foreground`,
 * `border-border`), never raw colors — so re-theming is purely a token swap.
 *
 * There are THREE shipped themes. Switch them with the toolbar (the paint-roller
 * control); everything on the page re-colors because the same tokens resolve to
 * new values.
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
          "How `data-theme` + semantic tokens give one component set its shipped " +
          "looks (qlik-bright, qlik-dark) plus the orthogonal decoration / " +
          "density / motion dials. Flip the toolbar controls and watch the sample " +
          "composition below adapt.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// The shipped themes — slug (the data-theme value) + display label.
const THEMES = [
  { slug: "qlik-bright", label: "Qlik Bright", note: "Default. Qlik Green on light surfaces." },
  { slug: "qlik-dark", label: "Qlik Dark", note: "Deep-blue surfaces, brighter Qlik Green." },
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
            `StatusBadge` emits — under blueprint/high-decoration this is what
            lets decoration.css's [data-status] line-type channel (#391)
            distinguish it from the "Running" chip below once colour alone
            cannot (both are raw role fills, so blueprint's drawn-not-filled
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
          Use the <strong>theme</strong> control in the toolbar to flip between the three themes,
          and the <strong>Decoration</strong> / <strong>Density</strong> / <strong>Motion</strong>{" "}
          dials to exercise the orthogonal axes.
        </p>
      </div>
      <SampleComposition />
    </div>
  ),
  // Rendered regression lock for #391 — "a role-fill collapse in blueprint
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
  // MUST fail on today's (pre-#391) blueprint — both chips are raw role
  // fills (`bg-success`/`bg-info`), so decoration.css's drawn-not-filled
  // override collapses them to one identical declaration set. MUST pass
  // after the fix (and in `qlik-bright`/`qlik-dark`, where colour alone
  // already separates them). Run under all three theme globals via
  // `mcp__storybook__run-story-tests` / `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`.
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
  name: "The shipped themes",
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Two themes ship in <code className="text-code">@qlik-coe-emea/qlabs-components-tokens</code>
        . Pass the <strong>slug</strong> (the <code className="text-code">data-theme</code> value),
        never the display name, when setting a theme programmatically or via the Storybook globals.
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
        {`<ThemeProvider allowedThemes={["qlik-bright", "qlik-dark"]}>
  <App />
</ThemeProvider>`}
      </pre>
      <ul className="m-0 space-y-1.5 ps-5 text-caption text-muted-foreground">
        <li>
          <code className="text-code">useTheme().themes</code> lists only the allowed names — build
          switchers off that, not off <code className="text-code">THEMES</code>.
        </li>
        <li>
          A persisted value for a now-hidden theme is rejected in the same mount pass that applies
          the theme, so it can never flash on boot.
        </li>
        <li>
          <code className="text-code">setTheme</code> with a disallowed name is a no-op that warns
          in development, and never writes it to storage.
        </li>
        <li>Omitting the prop is unchanged behaviour: every shipped theme is available.</li>
      </ul>
      <p className="m-0 text-caption text-muted-foreground">
        <code className="text-code">ThemeSwitcher</code> keeps its own{" "}
        <code className="text-code">themes</code> prop (defaulting to the light/dark pair) — pass it{" "}
        <code className="text-code">themes={"{useTheme().themes}"}</code> to inherit the subset.
      </p>
    </div>
  ),
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
