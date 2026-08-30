import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The semantic COLOR tokens — the source of truth for every surface, text,
 * border and accent in the system. Components never hardcode colors; they
 * reference these tokens through Tailwind utilities (`bg-primary`,
 * `text-muted-foreground`, `border-border`, …). Re-branding is a token change,
 * not a component change.
 *
 * Every swatch reads its color straight from the live CSS variable
 * (`var(--token)`), so the whole catalog RE-COLORS when you switch the theme in
 * the toolbar — try `light` → `dark`.
 *
 * NOTE: a swatch fills via `var(--token)` (a token reference, never a raw hex),
 * and is LABELLED with its token name + the Tailwind utility that maps to it.
 */

const meta = {
  title: "Foundations/Colors",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The semantic color tokens, defined once per theme in " +
          "`@elabs-ai/components-tokens` `themes.css` and exposed to Tailwind via `@theme inline`. " +
          "Each swatch is theme-reactive: it fills from `var(--token)`, so switching " +
          "the toolbar theme recolors the entire page. Use the listed utility " +
          "(`bg-*` / `text-*` / `border-*`) — never a raw color.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One semantic token: the CSS variable name and the Tailwind utility prefix it maps to. */
type Token = {
  /** CSS variable, e.g. "--primary". */
  varName: string;
  /** The Tailwind utility that resolves to it, e.g. "bg-primary". */
  utility: string;
  /** Optional paired foreground token to demonstrate legible on-fill text. */
  foregroundVar?: string;
  /** Short note on when to reach for it. */
  note?: string;
};

type TokenGroup = {
  heading: string;
  blurb: string;
  tokens: Token[];
};

// Curated from packages/tokens/src/themes.css — the semantic set every theme
// block overrides. Grouped to mirror docs/TOKEN_GUIDELINES.md "Semantic token set".
const GROUPS: TokenGroup[] = [
  {
    heading: "Surfaces & text",
    blurb:
      "Layered neutrals for the page, cards, popovers and shells. `--background` is the recessed page ground; `--card`/`--surface-elevated` lift above it.",
    tokens: [
      { varName: "--background", utility: "bg-background", foregroundVar: "--foreground" },
      { varName: "--foreground", utility: "text-foreground" },
      { varName: "--card", utility: "bg-card", foregroundVar: "--card-foreground" },
      { varName: "--card-foreground", utility: "text-card-foreground" },
      { varName: "--popover", utility: "bg-popover", foregroundVar: "--popover-foreground" },
      { varName: "--popover-foreground", utility: "text-popover-foreground" },
      { varName: "--surface", utility: "bg-surface" },
      { varName: "--surface-muted", utility: "bg-surface-muted" },
      { varName: "--surface-elevated", utility: "bg-surface-elevated" },
    ],
  },
  {
    heading: "Brand & intents",
    blurb:
      "The brand accent (`--primary`) plus the neutral intent fills. Each fill pairs with a `*-foreground` ink tuned to read on top of it.",
    tokens: [
      { varName: "--primary", utility: "bg-primary", foregroundVar: "--primary-foreground" },
      { varName: "--primary-foreground", utility: "text-primary-foreground" },
      { varName: "--secondary", utility: "bg-secondary", foregroundVar: "--secondary-foreground" },
      { varName: "--secondary-foreground", utility: "text-secondary-foreground" },
      { varName: "--muted", utility: "bg-muted", foregroundVar: "--muted-foreground" },
      {
        varName: "--muted-foreground",
        utility: "text-muted-foreground",
        note: "Secondary text — ≥4.5:1 on muted surfaces.",
      },
      { varName: "--accent", utility: "bg-accent", foregroundVar: "--accent-foreground" },
      { varName: "--accent-foreground", utility: "text-accent-foreground" },
    ],
  },
  {
    heading: "Status",
    blurb:
      "Semantic status FILLS (a colored plate with `*-foreground` ink). For colored TEXT on a surface, use the `*-text` variants — they clear AA where the fill would not.",
    tokens: [
      {
        varName: "--destructive",
        utility: "bg-destructive",
        foregroundVar: "--destructive-foreground",
      },
      {
        varName: "--destructive-text",
        utility: "text-destructive-text",
        note: "Red TEXT on a surface (≥4.5:1).",
      },
      { varName: "--success", utility: "bg-success", foregroundVar: "--success-foreground" },
      {
        varName: "--success-text",
        utility: "text-success-text",
        note: "Green TEXT on a surface (≥4.5:1).",
      },
      { varName: "--warning", utility: "bg-warning", foregroundVar: "--warning-foreground" },
      {
        varName: "--warning-text",
        utility: "text-warning-text",
        note: "Amber TEXT on a surface (≥4.5:1).",
      },
      { varName: "--info", utility: "bg-info", foregroundVar: "--info-foreground" },
      {
        varName: "--info-text",
        utility: "text-info-text",
        note: "Blue TEXT on a surface (≥4.5:1).",
      },
    ],
  },
  {
    heading: "Lines & focus",
    blurb:
      "Hairlines, control outlines and the focus ring. `--border` is the subtle/redundant rung; `--border-strong` (≥3:1) is the sole-cue rung; `--input` outlines fields.",
    tokens: [
      { varName: "--border", utility: "border-border" },
      { varName: "--border-strong", utility: "border-border-strong" },
      { varName: "--input", utility: "border-input" },
      { varName: "--ring", utility: "ring-ring" },
    ],
  },
  {
    heading: "Ordered neutral ramp (#14)",
    blurb:
      "An ADDITIVE, ordered view onto the semantic tokens above (docs/TOKEN_GUIDELINES.md § " +
      '"Ordered neutral ramp") — for a dense row that needs more than the two text weights ' +
      "or two divider weights the slots above name. Every rung is either a `var()` alias of " +
      "an existing slot (foreground-1/-3, border-1/-2, surface-1..4) or a new literal filling " +
      "the gap (foreground-2/-4). See the dedicated hierarchy story below for the ordered, " +
      "judgeable rendering — these swatches are the flat catalog entry.",
    tokens: [
      { varName: "--foreground-1", utility: "text-foreground-1", note: "== --foreground" },
      { varName: "--foreground-2", utility: "text-foreground-2", note: "NEW — secondary label" },
      { varName: "--foreground-3", utility: "text-foreground-3", note: "== --muted-foreground" },
      {
        varName: "--foreground-4",
        utility: "text-foreground-4",
        note: "NEW — disabled, sub-AA by design",
      },
      { varName: "--border-1", utility: "border-border-1", note: "== --border" },
      { varName: "--border-2", utility: "border-border-2", note: "== --border-strong" },
      { varName: "--surface-1", utility: "bg-surface-1", note: "== --background" },
      { varName: "--surface-2", utility: "bg-surface-2", note: "== --surface" },
      { varName: "--surface-3", utility: "bg-surface-3", note: "== --card" },
      { varName: "--surface-4", utility: "bg-surface-4", note: "== --surface-elevated" },
    ],
  },
  {
    heading: "App chrome (sidebar)",
    blurb: "The application shell / sidebar surfaces, so dark-sidebar brands stay legible.",
    tokens: [
      { varName: "--sidebar", utility: "bg-sidebar", foregroundVar: "--sidebar-foreground" },
      { varName: "--sidebar-foreground", utility: "text-sidebar-foreground" },
      {
        varName: "--sidebar-muted-foreground",
        utility: "text-sidebar-muted-foreground",
        note: "Muted nav text (≥4.5:1 vs --sidebar).",
      },
      { varName: "--sidebar-border", utility: "border-sidebar-border" },
      {
        varName: "--sidebar-accent",
        utility: "bg-sidebar-accent",
        foregroundVar: "--sidebar-accent-foreground",
      },
      {
        varName: "--sidebar-primary",
        utility: "bg-sidebar-primary",
        foregroundVar: "--sidebar-primary-foreground",
      },
    ],
  },
  {
    heading: "Canvas & flow",
    blurb: "The React Flow canvas, its grid, and node/edge ink (`@elabs-ai/components-flow`).",
    tokens: [
      { varName: "--canvas", utility: "bg-canvas" },
      { varName: "--canvas-grid", utility: "bg-canvas-grid" },
      { varName: "--flow-node", utility: "bg-flow-node", foregroundVar: "--flow-node-foreground" },
      { varName: "--flow-edge", utility: "text-flow-edge" },
    ],
  },
  {
    heading: "Chat",
    blurb:
      "The conversation surfaces in `@elabs-ai/components-ai` — user vs assistant message grounds.",
    tokens: [
      { varName: "--chat-user", utility: "bg-chat-user", foregroundVar: "--chat-user-foreground" },
      {
        varName: "--chat-assistant",
        utility: "bg-chat-assistant",
        foregroundVar: "--chat-assistant-foreground",
      },
    ],
  },
  {
    heading: "Categorical data palette",
    blurb:
      "The twelve-series chart palette (`@elabs-ai/components-charts`) — three interleaved hue families (yellow, blue, grey) so adjacent series never share a family. Series 1 is the brand colour itself. One ramp, identical in both themes — which means the light theme's series are deliberately pale against a white plot ground; see the note on the ramp in `themes/light.css`. Under monochrome themes series are also differentiated by pattern, not hue alone.",
    tokens: [
      { varName: "--chart-1", utility: "bg-chart-1" },
      { varName: "--chart-2", utility: "bg-chart-2" },
      { varName: "--chart-3", utility: "bg-chart-3" },
      { varName: "--chart-4", utility: "bg-chart-4" },
      { varName: "--chart-5", utility: "bg-chart-5" },
      { varName: "--chart-6", utility: "bg-chart-6" },
      { varName: "--chart-7", utility: "bg-chart-7" },
      { varName: "--chart-8", utility: "bg-chart-8" },
      { varName: "--chart-9", utility: "bg-chart-9" },
      { varName: "--chart-10", utility: "bg-chart-10" },
      { varName: "--chart-11", utility: "bg-chart-11" },
      { varName: "--chart-12", utility: "bg-chart-12" },
    ],
  },
];

function Swatch({ token }: { token: Token }) {
  const { varName, utility, foregroundVar, note } = token;
  return (
    <figure className="m-0 overflow-hidden rounded-md border border-border-strong bg-card">
      {/* The color plate. Fills from the live CSS variable so it re-colors per
          theme. If a foreground token is paired, render its name ON the fill to
          prove the on-fill pairing reads; otherwise keep the plate label-free
          (the legible label lives in the caption below). */}
      <div className="flex h-16 items-end p-2" style={{ background: `var(${varName})` }}>
        {foregroundVar ? (
          <span className="text-meta font-medium" style={{ color: `var(${foregroundVar})` }}>
            {foregroundVar}
          </span>
        ) : null}
      </div>
      <figcaption className="space-y-0.5 border-t border-border p-2">
        <code className="block text-code text-foreground">{varName}</code>
        <code className="block text-meta text-muted-foreground">{utility}</code>
        {note ? <p className="m-0 text-meta text-muted-foreground">{note}</p> : null}
      </figcaption>
    </figure>
  );
}

/** Slugify a heading into a valid HTML id (no spaces / punctuation). */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function TokenGroupBlock({ group }: { group: TokenGroup }) {
  const headingId = `tok-${slug(group.heading)}`;
  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="space-y-1">
        <h3 id={headingId} className="text-subtitle text-foreground">
          {group.heading}
        </h3>
        <p className="m-0 max-w-prose text-caption text-muted-foreground">{group.blurb}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {group.tokens.map((t) => (
          <Swatch key={t.varName} token={t} />
        ))}
      </div>
    </section>
  );
}

export const AllColors: Story = {
  name: "All color tokens",
  render: () => (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <TokenGroupBlock key={g.heading} group={g} />
      ))}
    </div>
  ),
};

export const FocusRingVsStatus: Story = {
  name: "Focus ring vs. status (supplementary — ADR 0027)",
  render: () => (
    <div className="max-w-2xl space-y-3">
      {/* Supplementary evidence for issue #427 / ADR 0027 — a purpose-built
          story is explicitly NOT the primary sweep for a token-value change
          (Meta #161); a brand-ui-visual-ux-reviewer pass on a real,
          unmodified app screen is. This exists so the semantic-collision
          question stays re-checkable after any future --ring retune. */}
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Supplementary evidence only — not the primary sweep. Tab to the button below and judge, in
        both themes, whether the focus ring reads as a status chip rather than as focus.
      </p>
      <div className="flex flex-wrap items-stretch gap-4">
        <div
          data-status="running"
          className="flex flex-1 items-center justify-center rounded-md bg-info/10 p-6"
        >
          <span className="text-body text-info-text">Info-toned surface</span>
        </div>
        <button
          type="button"
          className="shrink-0 self-center rounded-md border border-input bg-background px-4 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tab into me
        </button>
        <div
          data-status="complete"
          className="flex flex-1 items-center justify-center rounded-md bg-success/10 p-6"
        >
          <span className="text-body text-success-text">Success-toned surface</span>
        </div>
      </div>
    </div>
  ),
};

export const Primary: Story = {
  name: "Primary (brand accent)",
  render: () => (
    <div className="max-w-md space-y-3">
      <p className="m-0 text-caption text-muted-foreground">
        The single brand accent. Swap <code className="text-code">--primary</code> per theme and
        every primary button, link, ring and selected state re-skins. Here it is shown as a fill
        with its paired <code className="text-code">--primary-foreground</code> ink.
      </p>
      <Swatch
        token={{
          varName: "--primary",
          utility: "bg-primary",
          foregroundVar: "--primary-foreground",
        }}
      />
    </div>
  ),
};

// #14 — the ordered neutral ramp, rendered so the ORDER is judgeable, not just
// the swatches above. Each rung is labelled with its own token + utility so a
// reviewer can tell "rung N really is quieter than rung N-1" from the actual
// rendered text/border/surface, in both themes — the finding this story exists
// to close was that these ten tokens had zero consumers anywhere in the repo,
// so "theme-safe, observed" was unverifiable for them however green the gates.
const FOREGROUND_RUNGS = [
  {
    cls: "text-foreground-1",
    token: "--foreground-1",
    role: "Primary value",
    sample: "$128,400.00",
  },
  {
    cls: "text-foreground-2",
    token: "--foreground-2",
    role: "Secondary label",
    sample: "Q3 revenue",
  },
  {
    cls: "text-foreground-3",
    token: "--foreground-3",
    role: "Tertiary / metadata",
    sample: "Updated 3 minutes ago",
  },
  {
    cls: "text-foreground-4",
    token: "--foreground-4",
    role: "Disabled (intentionally sub-AA — WCAG 1.4.3 exempts inactive-control text)",
    sample: "Archived — no longer editable",
  },
] as const;

export const OrderedNeutralRamp: Story = {
  name: "Ordered neutral ramp — judgeable hierarchy (#14)",
  parameters: {
    docs: {
      description: {
        story:
          "The three ramps stacked so the ORDER reads directly off the page: each foreground " +
          "rung must look quieter than the one above it (and the quietest, foreground-4, must " +
          "still be legible — it is sub-AA by design, not illegible); border-1 is the redundant " +
          "hairline and border-2 the sole-cue rung; surface-1..4 is a lift ladder from page " +
          "ground to most-elevated. Switch the toolbar theme (light/dark) — the ordering must " +
          "hold in both. Two adjacent rungs CAN render identically in one theme (e.g. " +
          "surface-1/surface-2 in `light`, where `--surface` == `--background`) — that is " +
          "documented as correct in docs/TOKEN_GUIDELINES.md, not a bug.",
      },
    },
    // --foreground-4 is DELIBERATELY sub-AA (docs/TOKEN_GUIDELINES.md § "Ordered
    // neutral ramp": "disabled, sub-AA by design" — WCAG 1.4.3 exempts inactive-
    // control text). Excluding it from axe's color-contrast scan documents that
    // as an accepted design decision rather than papering over it in the a11y
    // ratchet baseline; every OTHER rung in this story (foreground-1..3, both
    // border rungs, all four surface rungs) stays fully checked, so a real
    // regression on any of those still fails this test.
    a11y: {
      context: { exclude: ".text-foreground-4" },
    },
  },
  render: () => (
    <div className="max-w-2xl space-y-8">
      <section aria-labelledby="ramp-foreground" className="space-y-2">
        <h3 id="ramp-foreground" className="text-subtitle text-foreground">
          Foreground rungs — each row quieter than the last
        </h3>
        <div className="space-y-1 rounded-lg border border-border bg-card p-4">
          {FOREGROUND_RUNGS.map((r) => (
            <div key={r.token} className="flex flex-wrap items-baseline justify-between gap-2 py-1">
              <span className={`text-body ${r.cls}`}>{r.sample}</span>
              <span className="text-meta text-muted-foreground">
                <code className="text-code">{r.token}</code> ·{" "}
                <code className="text-code">{r.cls}</code> — {r.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ramp-border" className="space-y-2">
        <h3 id="ramp-border" className="text-subtitle text-foreground">
          Border rungs — subtle vs. sole-cue
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border-1 bg-card p-4">
            <code className="block text-code text-foreground">--border-1 / border-border-1</code>
            <p className="m-0 text-caption text-muted-foreground">
              Subtle — a redundant boundary (== --border). Legitimate here because the card fill
              already separates it from the page.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-border-2 bg-card p-4">
            <code className="block text-code text-foreground">--border-2 / border-border-2</code>
            <p className="m-0 text-caption text-muted-foreground">
              Strong — the sole structural cue (== --border-strong, ≥3:1). Reach for this rung when
              there is no fill/elevation change to fall back on.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="ramp-surface" className="space-y-2">
        <h3 id="ramp-surface" className="text-subtitle text-foreground">
          Surface rungs — a lift ladder, page ground to most elevated
        </h3>
        <div className="rounded-lg bg-surface-1 p-6">
          <p className="m-0 mb-3 text-meta text-muted-foreground">
            <code className="text-code">--surface-1 / bg-surface-1</code> — page ground
          </p>
          <div className="rounded-lg bg-surface-2 p-6">
            <p className="m-0 mb-3 text-meta text-muted-foreground">
              <code className="text-code">--surface-2 / bg-surface-2</code> — base layer
            </p>
            <div className="rounded-lg bg-surface-3 p-6">
              <p className="m-0 mb-3 text-meta text-muted-foreground">
                <code className="text-code">--surface-3 / bg-surface-3</code> — raised card
              </p>
              <div className="rounded-lg bg-surface-4 p-6 shadow-sm">
                <p className="m-0 text-meta text-muted-foreground">
                  <code className="text-code">--surface-4 / bg-surface-4</code> — most elevated
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  ),
};
