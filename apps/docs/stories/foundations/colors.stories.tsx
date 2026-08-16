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
          "`@elabs/components-tokens` `themes.css` and exposed to Tailwind via `@theme inline`. " +
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
    blurb: "The React Flow canvas, its grid, and node/edge ink (`@elabs/components-flow`).",
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
      "The conversation surfaces in `@elabs/components-ai` — user vs assistant message grounds.",
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
      "The five-series chart palette (`@elabs/components-charts`). Re-tuned per theme; under monochrome themes series are also differentiated by pattern, not hue alone.",
    tokens: [
      { varName: "--chart-1", utility: "bg-chart-1" },
      { varName: "--chart-2", utility: "bg-chart-2" },
      { varName: "--chart-3", utility: "bg-chart-3" },
      { varName: "--chart-4", utility: "bg-chart-4" },
      { varName: "--chart-5", utility: "bg-chart-5" },
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
