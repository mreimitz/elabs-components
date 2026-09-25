/// <reference types="vite/client" />
import type { Decorator, Preview } from "@storybook/react-vite";
import { addons } from "storybook/preview-api";
import {
  BUILT_IN_THEME_DEFINITIONS,
  DEFAULT_DENSITY,
  DEFAULT_MOTION_PREFERENCE,
  groupThemeFamilies,
} from "@elabs-ai/components-tokens";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  Controls,
  Description,
  DocsContainer,
  Markdown,
  Primary,
  Stories,
  Subtitle,
  Title,
  type DocsContainerProps,
} from "@storybook/addon-docs/blocks";
import { Intent } from "./intent-block";
import { withExpandFit } from "./expand-fit";
import { enhanceArgTypes, stripCustomTags, unwrapInlineCode } from "./docgen";
import { themes } from "storybook/theming";
import a11yBaseline from "../../../scripts/a11y-baseline.json";
import "./preview.css";
import { COMMUNITY_THEME_DEFINITIONS } from "./community-themes.generated";
import {
  THEME_FAMILIES_EVENT,
  resolveToolbarTheme,
  type ToolbarThemeFamily,
} from "./theme-toolbar";
import "@xyflow/react/dist/style.css";
// Wire Monaco's language workers so @elabs-ai/components-editor stories get IntelliSense.
import "@elabs-ai/components-editor/monaco-environment";

// Reload the canvas instead of letting Storybook hot-swap this module. Its swap
// re-applies only this file's annotations and drops the built-in addons' (their
// globals vanish; play functions lose `canvas`), so every story after it fails in
// ways a fresh page never does. Any edit to a non-component module this file
// imports lands here too — a tokens or charts helper, via `./expand-fit` — so
// without this an ordinary chart edit breaks the open tab. Self-accepting stops
// the update at this module, before Storybook re-applies anything. The literal
// `import.meta.hot.accept(` is what Vite's static analysis looks for.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}

/**
 * Writes `data-motion-pref` onto the iframe root (`:root`), exactly as
 * ThemeProvider does — "system" removes the attribute so the OS
 * `prefers-reduced-motion` media query governs. A component (not the decorator
 * function) so the hook satisfies the rules of hooks.
 */
function MotionPreferenceBoundary({
  motionPref,
  children,
}: {
  motionPref: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const el = document.documentElement;
    if (motionPref === "system") el.removeAttribute("data-motion-pref");
    else el.setAttribute("data-motion-pref", motionPref);
  }, [motionPref]);
  return <>{children}</>;
}

/**
 * Drives the motion gate from a toolbar global so every theme sweep can also
 * sweep the three motion states (system / reduced / full). Pair with
 * `globals=motionPref:<state>` from the Storybook MCP tools.
 */
const withMotionPreference: Decorator = (Story, context) => {
  const motionPref = (context.globals.motionPref as string) ?? DEFAULT_MOTION_PREFERENCE;
  return (
    <MotionPreferenceBoundary motionPref={motionPref}>
      <Story />
    </MotionPreferenceBoundary>
  );
};

/**
 * Writes `data-decoration` onto the iframe root, exactly as ThemeProvider does —
 * the "theme" value removes the attribute so each theme's own `--decoration`
 * governs (a theme may declare its own level). Lets any real story be swept across the
 * decoration dial via `globals=decoration:<0..10>` to prove the dual knob.
 */
function DecorationBoundary({ decoration, children }: { decoration: string; children: ReactNode }) {
  useEffect(() => {
    const el = document.documentElement;
    if (decoration === "theme") el.removeAttribute("data-decoration");
    else el.setAttribute("data-decoration", decoration);
  }, [decoration]);
  return <>{children}</>;
}

/**
 * Docs pages follow the Mode toolbar. Storybook's docs container carries its own
 * light theme, so before this a "Dark" selection changed `data-theme` on the
 * iframe root while the page and every embedded preview stayed white — the one
 * control that proves "themeable to any brand" did nothing visible on a docs
 * page (2026-09-17 review, P0). The container now mirrors the resolved theme's
 * `color-scheme`, which `withTheme` writes to the root for every family.
 */
function ThemedDocsContainer(props: DocsContainerProps) {
  const readDark = () =>
    typeof document !== "undefined" &&
    getComputedStyle(document.documentElement).colorScheme === "dark";
  const [dark, setDark] = useState(readDark);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(readDark());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return <DocsContainer {...props} theme={dark ? themes.dark : themes.light} />;
}

/**
 * Every Markdown block on a docs page (component and story descriptions) with
 * line-wrapped code spans joined first — see `unwrapInlineCode`. Rendering
 * `Markdown` from inside its own override is safe: Storybook renders the stock
 * block for a nested use.
 */
function DocsMarkdown(props: ComponentProps<typeof Markdown>) {
  const { children } = props;
  return (
    <Markdown {...props}>
      {typeof children === "string" ? unwrapInlineCode(children) : children}
    </Markdown>
  );
}

/**
 * The autodocs page template.
 *
 * Storybook's stock page is Title → Subtitle → Description → Primary → Controls
 * → Stories, which is why a component page could open with an H1 and go straight
 * to a preview: everything the project knows about WHY the component exists
 * lives in the manifest, and the manifest was never on the page (2026-09-17
 * review §1.7). `Intent` slots in directly under the heading, so the first thing
 * read is what the component is for, what it sits next to, and what not to do
 * with it.
 *
 * `Description` (the component's own TSDoc) is kept AFTER `Intent` rather than
 * dropped: the two say different things, and 280 of the 349 pages have one.
 */
function BrandDocsPage() {
  return (
    <>
      <Title />
      <Subtitle />
      <Intent />
      <Description />
      <Primary />
      <Controls />
      <Stories />
    </>
  );
}

/**
 * A docs page renders every story of a component into ONE document. A story
 * that pins `globals: { decoration: "10" }` (the `*HighDecoration` stories) used
 * to write that pin onto the shared root, so whichever story rendered last set
 * the decoration of every chart on the page — the default story included. On a
 * docs page the root follows the toolbar only, and a story's own pin is scoped
 * to a wrapper around that story; `--decoration` inherits, so the charts inside
 * still read it.
 */
const withDecoration: Decorator = (Story, context) => {
  const decoration = (context.globals.decoration as string) ?? "theme";
  if (context.viewMode !== "docs") {
    return (
      <DecorationBoundary decoration={decoration}>
        <Story />
      </DecorationBoundary>
    );
  }
  const toolbar = (context.userGlobals?.decoration as string | undefined) ?? "theme";
  const pinned = context.storyGlobals?.decoration as string | undefined;
  return (
    <DecorationBoundary decoration={toolbar}>
      {pinned && pinned !== "theme" ? (
        <div data-decoration={pinned} style={{ display: "contents" }}>
          <Story />
        </div>
      ) : (
        <Story />
      )}
    </DecorationBoundary>
  );
};

/**
 * Writes `data-density` onto the iframe root, exactly as ThemeProvider does —
 * "comfortable" removes the attribute (identity; Tailwind default) so default
 * stories are pixel-identical to pre-density builds. Lets any real story be
 * swept across the density dial via `globals=density:<mode>`.
 */
function DensityBoundary({ density, children }: { density: string; children: ReactNode }) {
  useEffect(() => {
    const el = document.documentElement;
    if (density === "comfortable") el.removeAttribute("data-density");
    else el.setAttribute("data-density", density);
  }, [density]);
  return <>{children}</>;
}

const withDensity: Decorator = (Story, context) => {
  const density = (context.globals.density as string) ?? DEFAULT_DENSITY;
  return (
    <DensityBoundary density={density}>
      <Story />
    </DensityBoundary>
  );
};

/**
 * The Theme / Mode toolbar (ADR 0036). The registry is the built-in Default
 * family plus every downloadable family in repo-root `themes/` (wired by
 * `scripts/gen-community-themes.mjs`). The preview publishes a plain summary on
 * the channel; `manager.tsx` renders a Theme select and — only for a family with
 * both schemes — a Mode select. `channel.last()` lets a manager that mounts
 * later still read it. See `theme-toolbar.ts` for the global contract.
 */
const TOOLBAR_FAMILIES: readonly ToolbarThemeFamily[] = groupThemeFamilies([
  ...BUILT_IN_THEME_DEFINITIONS,
  ...COMMUNITY_THEME_DEFINITIONS,
]).map((f) => ({
  id: f.id,
  label: f.label,
  schemes: f.schemes,
  variants: { light: f.light?.value, dark: f.dark?.value },
}));
addons.getChannel().emit(THEME_FAMILIES_EVENT, TOOLBAR_FAMILIES);

/**
 * Writes `data-theme` onto `document.documentElement`, exactly as
 * `@storybook/addon-themes`'s `withThemeByDataAttribute` does — but with a REAL
 * React `useEffect` (see `DensityBoundary`/`DecorationBoundary` above) instead
 * of `storybook/preview-api`'s own hook shim (#402).
 *
 * Root cause: `storybook/preview-api`'s `useEffect` only invokes its `create()`
 * callback once `HooksContext.triggerEffects()` runs
 * (`storybook/dist/_browser-chunks/chunk-SZQXB3JV.js`), which is wired to fire
 * on the `STORY_RENDERED` channel event emitted by the full Storybook preview
 * runtime (`PreviewWeb`/`renderToCanvas`). `@storybook/addon-vitest`'s
 * composed-story test harness mounts stories directly and never emits that
 * event, so `withThemeByDataAttribute`'s effect silently never ran under
 * `test-storybook` — confirmed directly: a `console.error` placed at the top
 * of its returned decorator body never printed, while `document.documentElement`
 * stayed `data-theme=null` for every story, every run. Every story was
 * therefore scored against the unbranded `:root` fallback palette instead of
 * the shipped theme. A genuine React `useEffect` is flushed by React itself
 * regardless of Storybook's channel machinery, so it runs correctly in BOTH
 * the dev server and `vitest --project storybook`.
 */
function ThemeBoundary({ theme, children }: { theme: string; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return <>{children}</>;
}

/**
 * `STORYBOOK_THEME=<slug>` pins the theme for a whole run.
 *
 * The quality gates require a component to be OBSERVED in every theme, but the
 * only ways to reach a non-default theme were the dev-server toolbar and a
 * `globals=theme:<slug>` URL — both of which need a human driving a browser.
 * `@storybook/addon-vitest` (`pnpm exec vitest --project storybook`) composes
 * stories with no toolbar and no URL, so every headless run — local and CI —
 * silently measured `light` only, and a cross-theme claim cannot honestly be
 * made from one.
 *
 * This is the same env-var seam `STORYBOOK_A11Y_MODE` already uses, and for the
 * same reason: a sweep has to be reproducible by a command, not by a gesture.
 * Storybook exposes `STORYBOOK_`-prefixed variables to the preview bundle.
 *
 *   STORYBOOK_THEME=dark pnpm exec vitest --project storybook run <name>
 *
 * It sits BELOW a per-story `parameters.themes.themeOverride` and the toolbar
 * global on purpose: a story that pins its own theme is demonstrating that
 * theme, and a sweep must not silently repaint it.
 */
const THEME_FROM_ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.STORYBOOK_THEME;

const withTheme: Decorator = (Story, context) => {
  // Resolution order: a per-story `parameters.themes.themeOverride` wins, then
  // the toolbar/URL `theme` global (a family id or a variant name —
  // `globals=theme:<slug>`), then `STORYBOOK_THEME`, then the Default family.
  // `mode` only applies when the winner is a family id.
  const themeOverride = (context.parameters.themes as { themeOverride?: string } | undefined)
    ?.themeOverride;
  const selected = context.globals.theme as string | undefined;
  const mode = context.globals.mode as string | undefined;
  const theme =
    themeOverride || resolveToolbarTheme(TOOLBAR_FAMILIES, selected || THEME_FROM_ENV, mode);
  return (
    <ThemeBoundary theme={theme}>
      <Story />
    </ThemeBoundary>
  );
};

/**
 * Story ids whose axe violations pre-date the ratchet (#316). Generated, never
 * hand-kept — see `scripts/a11y-baseline.json` and `pnpm check --rule a11y-baseline`.
 */
const A11Y_BASELINE = new Set(Object.keys(a11yBaseline.stories));

/**
 * `pnpm a11y:baseline:run` sets `STORYBOOK_A11Y_MODE=todo` so the MEASUREMENT
 * run puts every story in report-only mode. This is load-bearing, not a
 * convenience: `@storybook/addon-vitest` stamps `task.meta.reports` only AFTER
 * `composedStory.run()` resolves, so a story that fails on axe never reports its
 * violations and would be harvested as "clean". Measuring with axe unable to
 * throw is the only way to see the whole violation surface at once.
 */
const A11Y_MEASURE_ALL =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.STORYBOOK_A11Y_MODE === "todo";

const preview: Preview = {
  // Runs after the framework infers controls — see ./docgen.ts.
  // Cast: the enhancer only reads/writes `control`, `description` and `type`, which
  // is a structural subset of StrictArgTypes; it never constructs an arg type.
  argTypesEnhancers: [
    enhanceArgTypes as unknown as NonNullable<Preview["argTypesEnhancers"]>[number],
  ],
  /**
   * The axe ratchet's teeth (#78 AC3 / #316). `parameters.a11y.test` is
   * `"error"` globally (below), so ANY axe violation fails the blocking
   * Storybook CI job. Historical violations would have made `main` permanently
   * red, so each pre-existing offender is downgraded — per story, from the
   * generated baseline — to addon-a11y's report-only `"todo"` mode.
   *
   * Why here and not per story file: 84 of 230 story files were violating when
   * this landed (#316's measurement). Hand-stamping `parameters.a11y` into each
   * one would make the exemptions editable by anyone touching a story, which is
   * exactly the "silently added to the baseline" failure the ratchet forbids.
   *
   * REPLACE, never mutate: `combineParameters` keeps the SAME `a11y` object
   * reference for every story when only the project annotations define the key,
   * so an in-place `context.parameters.a11y.test = …` would downgrade the whole
   * suite after the first baselined story ran.
   */
  beforeEach(context) {
    if (A11Y_MEASURE_ALL || A11Y_BASELINE.has(context.id)) {
      context.parameters.a11y = { ...context.parameters.a11y, test: "todo" };
    }
  },
  // `withExpandFit` first, so it is innermost: it measures the story alone.
  decorators: [withExpandFit, withDensity, withDecoration, withMotionPreference, withTheme],
  // `theme` + `mode` are driven by the custom toolbar in `manager.tsx`, so they
  // are declared here without a built-in `toolbar` entry. Empty = Default family,
  // light (or `STORYBOOK_THEME`). `expand` is set only by the website's enlarged
  // view (`globals=expand:fill`, see `./expand-fit.tsx`); no toolbar either.
  initialGlobals: { theme: "", mode: "", expand: "" },
  globalTypes: {
    decoration: {
      description:
        "Decoration dial 0–10 (writes data-decoration on :root; 'theme' = use the theme default)",
      defaultValue: "theme",
      toolbar: {
        title: "Decoration",
        icon: "ruler",
        items: [
          { value: "theme", title: "Theme default" },
          { value: "0", title: "0 — off" },
          { value: "2", title: "2" },
          { value: "4", title: "4" },
          { value: "6", title: "6 — gentle" },
          { value: "8", title: "8" },
          { value: "10", title: "10 — full" },
        ],
        dynamicTitle: true,
      },
    },
    motionPref: {
      description: "Motion preference (writes data-motion-pref on :root)",
      defaultValue: DEFAULT_MOTION_PREFERENCE,
      toolbar: {
        title: "Motion",
        icon: "lightning",
        items: [
          { value: "system", title: "System (OS)" },
          { value: "reduced", title: "Reduce motion" },
          { value: "full", title: "Full motion" },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description:
        "Density dial (writes data-density on :root; 'comfortable' = Tailwind default — no change)",
      defaultValue: DEFAULT_DENSITY,
      toolbar: {
        title: "Density",
        icon: "collapse",
        items: [
          { value: "compact", title: "Compact" },
          { value: "comfortable", title: "Comfortable (default)" },
          { value: "spacious", title: "Spacious" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    // Chart responsive tiers (ADR 0039): one width inside each tier, so a chart
    // story can be checked narrow / medium / wide from the toolbar.
    viewport: {
      options: {
        chartNarrow: {
          name: "Chart narrow (380)",
          styles: { width: "380px", height: "800px" },
          type: "mobile",
        },
        chartMedium: {
          name: "Chart medium (600)",
          styles: { width: "600px", height: "800px" },
          type: "tablet",
        },
        chartWide: {
          name: "Chart wide (900)",
          styles: { width: "900px", height: "800px" },
          type: "desktop",
        },
      },
    },
    docs: {
      container: ThemedDocsContainer,
      page: BrandDocsPage,
      components: { Markdown: DocsMarkdown },
      // react-docgen hands over the whole JSDoc block, `@dataShape`/`@avoidWhen`
      // included; the Intent block above already renders those two as "Best for"
      // and "Avoid when", so they are not also prose. See ./docgen.ts.
      extractComponentDescription: (component: unknown) =>
        stripCustomTags(
          (component as { __docgenInfo?: { description?: string } })?.__docgenInfo?.description ??
            "",
        ) || null,
    },
    // #78 AC3 / #316: axe FAILS the build. addon-a11y's default is `"todo"`
    // (= report, never fail) — at that setting the blocking Storybook CI job
    // enforced only the interaction half, and a new component could ship an
    // unnamed button with a green CI. `"error"` makes `expect(result)
    // .toHaveNoViolations()` run for every story; the pre-existing offenders
    // measured on 2026-08-01 (84 of 230 story files) are downgraded one by one
    // from `scripts/a11y-baseline.json` in `beforeEach` above, and that baseline
    // can only shrink (`pnpm check --rule a11y-baseline`).
    a11y: { test: "error" },
    layout: "centered",
    // ANCHORED on purpose: the shipped default `/(background|color)$/i` matches
    // any prop ENDING in "color" — `accessibleDescription`… no, but `seriesColor`,
    // `gridColor`, `emptyColor` and every `*BackgroundColor` yes, including the
    // ones typed as a function or a token union. Those got a hex colour picker
    // that writes a value the component cannot use. Match the exact names that
    // really do take a CSS colour; ./docgen.ts then vetoes the control on any of
    // them whose TYPE is not a colour string (2026-09-17 review §A5).
    controls: {
      matchers: { color: /^(background|color|accentColor|fill|stroke)$/, date: /Date$/i },
    },
    options: {
      storySort: {
        // ── The sidebar order. Keep in step with the numbered list in
        //    docs/STORYBOOK_GUIDELINES.md — same groups, same order.
        //
        // ALPHABETICAL IS THE DEFAULT within every group, so a new component
        // lands in a predictable place with no edit here. Without `method`,
        // Storybook falls back to "configure", which returns 0 for any two
        // unlisted siblings — i.e. Vite import order. That is what interleaved
        // Patterns/{Blocks,Templates,Scenarios} ("blocks in the middle") and left
        // Foundations in no order at all.
        //
        // Story EXPORTS inside one component keep their DECLARATION order:
        // storySort short-circuits on equal titles unless `includeNames` is set.
        //
        // `order` then overrides alphabetical where a reading order matters: the
        // top-level tiers, plus the three groups (Docs, Foundations, Patterns)
        // whose children tell a story alphabetical would scramble. A name may be
        // followed by a nested array ordering ITS children; a name with no nested
        // array falls through to alphabetical.
        //
        // Top-level order = primitives → composites → domain packages → utilities
        // → demos. EVERY top-level group must be listed; an unlisted group sorts
        // to the bottom in arbitrary story-import order (the 2026-06-15 IA review
        // finding, which recurred within three months).
        //
        // WHY THE ARRAY IS INLINE AND MUST STAY INLINE: Storybook generates the
        // order in index.json by STATICALLY parsing this file
        // (`getStorySortParameter`, storybook/internal/csf-tools). Its `parseValue`
        // walks literals only and throws "Unexpected '<name>'. Parameter
        // 'options.storySort' should be defined inline" on ANY identifier — an
        // imported const, a local const in this same file, and a spread element all
        // fail the build (probed directly against that parser, 2026-09-03). So this
        // array cannot be extracted to a module. A gate that needs to read it should
        // parse THIS literal: bracket-match the array that follows the `order` key,
        // strip line comments, drop trailing commas, JSON.parse — the array holds
        // nothing but double-quoted strings and nested arrays. (Match the LAST
        // occurrence of the key, or skip this comment block: prose above a literal
        // is the classic way a naive first-match parser reads the wrong bytes.)
        method: "alphabetical",
        order: [
          // `Docs` is the CUSTOMER-facing front section: what brand-ui is, how to
          // get it, how an agent talks to it. Reference material about one
          // component (the ViewToolbar contract, the jsdom chart recipe, the
          // CodeWorkspace content-access note) sits with that component instead,
          // where a reader is already looking — 2026-09-17 review §1.8.
          "Docs",
          [
            "Introduction",
            "Getting Started",
            "brand-ui MCP Server",
            "Storybook MCP for Agents",
            "AI Output Contract for Agents",
            "Choosing between similar components",
          ],
          "Foundations",
          [
            "Colors",
            "Typography",
            "Spacing & Radius",
            "Elevation",
            "Motion",
            "Decoration",
            "Paper",
            "Theming",
            "Localization",
          ],
          "Core",
          "Icons",
          "Forms",
          "Display",
          "Disclosure",
          "Navigation",
          "Overlays",
          "Feedback",
          "States",
          "Layout",
          "Data",
          "Charts",
          "AI",
          "Terminal",
          "Editor",
          "Viewer",
          "Flow",
          "Maps",
          "Marketing",
          "Process",
          "Patterns",
          [
            "Templates",
            // Use-case templates by who builds them, then the archetype starters
            // `brand-ui create` scaffolds.
            ["Analytics", "Operations", "Customers", "Product Teams", "AI Products", "Starters"],
            "Scenarios",
            "Blocks",
            // Reading order of the copy-own block families: numbers first, then the
            // arguments built on them, then the surfaces they sit in.
            [
              "KPI Cards",
              "Stat Cards",
              "Infographics",
              "Editorial Charts",
              "Command Centers",
              "Maps and Geo",
              "Process and Flow",
              "Data Surfaces",
              "Documents",
              "Agent Ops",
              "Generative UI",
              "AI and Terminal",
              "Application",
              "Forms and Setup",
              "Authentication",
              "Account and Settings",
              "Commerce",
              "Marketing",
            ],
          ],
          // `!dev` harness stories (hidden from the sidebar, kept in the test run).
          "Internal",
        ],
      },
    },
  },
};

export default preview;
