# App shell blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Layout/App Shell/*` from four primitives-and-ports into four well-designed, copy-own application shells built on repaired shared primitives.

**Architecture:** Two layers, strictly sequenced. **Layer A** repairs and extends `@elabs-ai/components-ui` (sidebar active-state, collapsed group labels, inset composition, plus four new components: `SkipLink`, `CommandTrigger`, `ContextRail`, `SideDock`, and additive `PageShell` modes). **Layer B** rebuilds the four shells as copy-own blocks under `registry/blocks/`, which is the only workspace member permitted to import `@elabs-ai/components-charts` / `-data`, so a believable demo screen is expressible. Layer A lands first so the shells are written against repaired primitives instead of carrying workarounds.

**Tech Stack:** React 19 · TypeScript · Tailwind CSS v4 (semantic tokens only) · Radix UI · `class-variance-authority` · Vitest + Testing Library (unit) · Storybook 10 + `addon-vitest` + `addon-a11y` (interaction + axe) · pnpm workspaces + Turborepo.

**Spec:** [`docs/superpowers/specs/2026-09-05-app-shell-blocks-design.md`](../specs/2026-09-05-app-shell-blocks-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **Semantic tokens only.** No hex, `rgb()`, or arbitrary colour (`bg-[#fff]`). The only file allowed raw colour is `packages/tokens/src/themes.css`.
- **Focus indicators** use the shared compound utilities only: `focus-ring`, `focus-ring-within`, `focus-ring-inset`, `focus-ring-static`. **Never** write `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Retarget with `focus-ring [--focus-ring-color:var(--sidebar-ring)]`.
- **Type is a role, not a size.** Use `text-display|title|subtitle|body|caption|meta|kpi|code`. No raw `text-sm` / `text-xs` / `text-[17px]` in component or story source — `pnpm text-scale:check` is a per-file ratchet that only goes down.
- **Never hand-roll a shadow.** Use the ramp: `shadow-2xs|xs|sm|md|lg|xl|2xl`, or `shadow-ring-*` for a floating surface (which then carries **no** border), or `shadow-hairline` for a bare 1px edge.
- **Colour is never the only channel** (WCAG 1.4.1). Two semantically different states differ by shape, icon, weight, border-style or text as well as hue, and the state reaches assistive tech as a real accessible name — `data-*` is invisible to AT.
- **One-way dependency graph:** `tokens` → `ui`/`icons` → `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`terminal` → `process`. `packages/ui` may **not** import any layer-2 package. Cross-package imports use `@elabs-ai/components-*`, never relative paths.
- **Component API:** `forwardRef`, spread `...props`, accept `className` merged last via `cn()`, export every public type, `cva` for multi-axis variants, `data-slot="<kebab-name>[-<part>]"` on root and parts.
- **Micro-typography:** `…` not `...` (hard gate, no ratchet); curly quotes; non-breaking space in units and shortcuts.
- **Motion:** gated `duration-*` / `ease-*` utilities or `--t-*`, never raw `duration-200`; every movement gets a `motion-reduce:` neutralizer.
- **Loading vocabulary:** `loading?: boolean` (skeleton) and `isStreaming?: boolean` (progressive). No fourth name. Prop-driven only — a component never starts a fetch.
- **No fix without an issue.** Defects found en route are filed with `/file-issue` (root-cause analysis first), not silently patched.
- **Machine-posted GitHub comments** go through `node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>` so they carry the attribution marker.
- **Repository scope:** the two reference apps live in other repositories and are **read-only**. Never create, modify, stage or commit anything outside this repo.
- **Commit trailer:** every commit ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

**Baselines that may only ratchet down** (`--update` after a genuine cleanup, never to admit new debt): `scripts/text-scale-baseline.json`, `scripts/microtypography-baseline.json`, `scripts/story-description-baseline.json`, `scripts/separation-baseline.json`, `scripts/loading-states-baseline.json`, `scripts/variant-coverage-baseline.json`, `scripts/data-slot-baseline.json`, `scripts/components-story-baseline.json`.

---

## File Structure

**Layer A — `packages/ui` (imported by every consumer)**

| Path                                                                                                                             | Responsibility                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/sidebar/sidebar.tsx`                                                                                 | Modified: R1 active indicator (`sidebarMenuButtonVariants` base string, `SidebarMenuSubButton`), R2 collapsed group label, R8 inset composition |
| `packages/ui/src/components/sidebar/sidebar.test.tsx`                                                                            | Modified: R1 / R2 unit locks                                                                                                                    |
| `packages/ui/src/components/sidebar/sidebar.stories.tsx`                                                                         | Modified: real-CSS locks for R1 / R2 / R8                                                                                                       |
| `packages/ui/src/components/skip-link/{skip-link.tsx,index.ts,skip-link.stories.tsx,skip-link.test.tsx}`                         | New (R3): the first focusable element of an app                                                                                                 |
| `packages/ui/src/components/command-trigger/{command-trigger.tsx,index.ts,command-trigger.stories.tsx,command-trigger.test.tsx}` | New (R4): search-shaped `⌘K` button with platform-correct hint                                                                                  |
| `packages/ui/src/components/context-rail/{context-rail.tsx,index.ts,context-rail.stories.tsx,context-rail.test.tsx}`             | New (R5b): permanent right furniture that collapses to a 48px icon strip which **is** its section switcher                                      |
| `packages/ui/src/components/side-dock/{side-dock.tsx,index.ts,side-dock.stories.tsx,side-dock.test.tsx}`                         | New (R5a): summoned right panel, resizable, slides fully away                                                                                   |
| `packages/ui/src/components/page-shell/page-shell.tsx`                                                                           | Modified (R6): additive `scroll` + `headerGutter`                                                                                               |
| `packages/ui/src/components/page-shell/page-shell.test.tsx`                                                                      | New: locks the additive default is unchanged                                                                                                    |
| `packages/ui/src/index.ts`                                                                                                       | Modified: barrel exports for the four new components                                                                                            |

**Layer B — `registry/blocks` (copy-own)**

| Path                                                                                | Responsibility                                                                |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `registry/blocks/app-shell/shell-metrics.ts`                                        | R9: the single declaration of zone widths, published as CSS custom properties |
| `registry/blocks/app-shell/nav-items.ts`                                            | Nav data + `isPathActive` (the router-agnostic contract, §4.3)                |
| `registry/blocks/app-shell/app-nav-rail.tsx`                                        | Zone 1: the collapsible icon rail                                             |
| `registry/blocks/app-shell/app-list-column.tsx`                                     | Zone 2: the optional list column (D8)                                         |
| `registry/blocks/app-shell/app-top-bar.tsx`                                         | Breadcrumbs, command trigger, right cluster                                   |
| `registry/blocks/app-shell/console-overview.tsx`                                    | The believable screen: metric row, runs table, activity timeline              |
| `registry/blocks/app-shell/app-shell-page.tsx`                                      | Rebuilt in place: composes the four zones                                     |
| `registry/blocks/sidebar-02/**`                                                     | Moved from `packages/ui/src/blocks/sidebar-02`, then rebuilt                  |
| `registry/blocks/sidebar-04/**`                                                     | Moved, then rebuilt as a three-zone variation                                 |
| `registry/blocks/sidebar-05/**`                                                     | Moved, then rebuilt as dual-rail                                              |
| `apps/docs/stories/blocks/{app-shell,sidebar-02,sidebar-04,sidebar-05}.stories.tsx` | Stories rendering the shipped blocks through the `@/components/…` alias       |
| `registry/registry.items.json`                                                      | Modified: three `root` paths repointed; prose updated                         |

Files that change together live together: each block is a directory, and its story is the one file outside it (Storybook cannot index inside `registry/`).

---

### Task 1: Verify R8's two claims by rendering, and file the defect issues

The spec's §6 names R8 as **unverified by rendering**. Nothing else may be built on an assumption about how `peer-*` composes. This task produces facts, not code.

**Files:**

- Create: `packages/ui/src/components/sidebar/sidebar-inset-probe.stories.tsx` (temporary; deleted in Task 8)
- Read: `packages/ui/src/components/sidebar/sidebar.tsx:135,217,313`

**Interfaces:**

- Consumes: nothing.
- Produces: a written finding recorded in the issue bodies filed here — `R8_PEER_COMPOSES: boolean` and `R8_GUTTER_SIDES_HARDCODED: boolean`. Task 8 reads them.

- [ ] **Step 1: Write the probe story**

```tsx
// packages/ui/src/components/sidebar/sidebar-inset-probe.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "./sidebar";

const meta = {
  title: "Layout/Sidebar/Inset probe",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Probe only — deleted once R8 lands. Measures whether a RIGHT sidebar can drive the inset treatment. */
export const RightInsetProbe: Story = {
  render: () => (
    <SidebarProvider>
      <SidebarInset data-testid="inset">
        <div className="p-6 text-body">content</div>
      </SidebarInset>
      <Sidebar side="right" variant="inset" data-testid="right-rail">
        <SidebarContent />
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const styles = getComputedStyle(inset);
    // Claim 1: `peer-data-[variant=inset]` is the subsequent-sibling combinator,
    // so a LATER sibling cannot match it. If this is right, margin stays 0px.
    // eslint-disable-next-line no-console
    console.log(
      "R8 probe — marginTop:",
      styles.marginTop,
      "marginRight:",
      styles.marginRight,
      "marginInlineStart:",
      styles.marginInlineStart,
      "borderRadius:",
      styles.borderTopLeftRadius,
    );
    await expect(inset).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run it and read the measurement**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-inset-probe`
Expected: PASS, with the console line printed. Record the four values.

- [ ] **Step 3: Run the same probe with the sidebar BEFORE the inset (the composing order)**

Add a second story `LeftInsetControl` with `<Sidebar variant="inset" />` **before** `<SidebarInset>`, same `play`. Run the same command. The control must show a non-zero margin and a radius; the probe shows what a right-hand panel actually gets. The difference between the two IS the finding.

- [ ] **Step 4: File the defect issues**

Three findings go through `/file-issue` (root-cause analysis first — symptom ≠ root cause):

1. **R1** — `sidebar.tsx:494`'s active state is colour-only at ~1.2:1: fails WCAG 1.4.1 (sole channel) and 1.4.11 (3:1 non-text). Cite the reference app's own repair and its measured 1.17:1 / 1.29:1.
2. **R2** — `sidebar.tsx:422` collapses `SidebarGroupLabel` with `-mt-8 opacity-0`, which is invisible but still boxed, leaving unexplained gaps in the icon rail.
3. **R8** — only if Step 3 confirms it: a right-hand `variant="inset"` panel cannot drive `SidebarInset`'s treatment, because the rule is sibling-ordered.

- [ ] **Step 5: Commit the probe**

```bash
git add packages/ui/src/components/sidebar/sidebar-inset-probe.stories.tsx
git commit -m "test(sidebar): probe whether a right-hand panel can drive the inset treatment"
```

---

### Task 2: Architect review of the three structural additions

`.claude/rules/quality-gates.md` requires `brand-ui-design-system-architect` **before** a structural or public-API change. `ContextRail`, `SideDock` and `PageShell`'s new modes are three of those, and this gate precedes the code.

**Files:**

- Create: `docs/ADR/00XX-context-rail-and-side-dock.md` (number = highest existing + 1; check `ls docs/ADR`)

**Interfaces:**

- Consumes: Task 1's R8 finding.
- Produces: the agreed public prop surfaces of `ContextRail`, `SideDock` and `PageShell`'s additions. Tasks 6, 8 and 9 implement exactly what this ADR records.

- [ ] **Step 1: Dispatch the architect**

Brief it with: the spec's §4.4 R5a / R5b / R6, the two right-hand patterns and why both ship (D4), the fact that `@elabs-ai/components-ai`'s `ContextPanel` (`packages/ai/src/context-panel.tsx:361,365`) is hardcoded `side: "right"` with a `w-0` collapsed spacer and therefore cannot express the icon state, and the constraint that `ContextRail` must live in `ui` because an evidence panel, an inspector, a properties pane and a details drawer are the same component.

- [ ] **Step 2: Write the ADR from its answer**

Record the decision, the two rejected alternatives (re-basing `ContextPanel` now; a single component with a `mode` prop), and the consequence that re-basing `ContextPanel` is deferred as its own work.

- [ ] **Step 3: Commit**

```bash
git add docs/ADR/00XX-context-rail-and-side-dock.md
git commit -m "docs(adr): ContextRail and SideDock as two distinct right-hand patterns"
```

---

### Task 3: R1 — a non-colour active-section indicator

**Files:**

- Modify: `packages/ui/src/components/sidebar/sidebar.tsx:493` (the `sidebarMenuButtonVariants` base string) and `:680-681` (`SidebarMenuSubButton`)
- Test: `packages/ui/src/components/sidebar/sidebar.test.tsx`
- Test: `packages/ui/src/components/sidebar/sidebar.stories.tsx` (real-CSS lock)

**Interfaces:**

- Consumes: the R1 issue filed in Task 1.
- Produces: `SidebarMenuButton` and `SidebarMenuSubButton` gain a geometric active cue. No prop changes — `isActive` already exists.

- [ ] **Step 1: Write the failing unit test**

```tsx
// packages/ui/src/components/sidebar/sidebar.test.tsx — append inside the existing describe
it("marks the active menu button with a non-colour cue, not hue alone", () => {
  render(
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>Active item</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>Resting item</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>,
  );
  const active = screen.getByRole("button", { name: "Active item" });
  const resting = screen.getByRole("button", { name: "Resting item" });
  // Asserting the two class strings merely DIFFER passes on colour-only code and
  // is not sufficient (.claude/rules/accessibility.md §1.4.1). Assert the cues
  // that survive greyscale: a drawn bar, and a heavier weight.
  expect(active.className).toContain("data-[active=true]:before:w-1");
  expect(active.className).toContain("data-[active=true]:font-semibold");
  expect(resting).toHaveAttribute("data-active", "false");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/sidebar/sidebar.test.tsx`
Expected: FAIL — the class string contains neither `before:w-1` nor `font-semibold`.

- [ ] **Step 3: Implement the indicator**

In `sidebar.tsx`, the `sidebarMenuButtonVariants` base string: the item is already `relative` via `SidebarMenuItem`'s `group/menu-item relative`, but the bar is drawn on the button, so the button needs its own `relative`. Replace `data-[active=true]:font-medium` and add the bar:

```
relative … data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:[&>svg]:text-sidebar-primary data-[active=true]:before:pointer-events-none data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:start-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary
```

Apply the same six `before:` utilities plus `data-[active=true]:font-semibold` to `SidebarMenuSubButton`'s second class line (`:681`), which today carries only the wash. Use `start-0`, not `left-0`, so the bar follows writing direction.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/sidebar/sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the real-CSS lock as a story**

A class-name assertion proves the utility is present, not that it paints. Add to `sidebar.stories.tsx`:

```tsx
/** The active item is distinguishable without colour: an accent bar plus a heavier label. */
export const ActiveIndicator: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive data-testid="active">
                Overview
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton data-testid="resting">Reports</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const active = canvasElement.querySelector('[data-testid="active"]') as HTMLElement;
    const resting = canvasElement.querySelector('[data-testid="resting"]') as HTMLElement;
    const bar = getComputedStyle(active, "::before");
    const none = getComputedStyle(resting, "::before");
    // Geometry, not hue: the bar has real width on the active item and none on the resting one.
    await expect(parseFloat(bar.width)).toBeGreaterThan(0);
    await expect(parseFloat(none.width) || 0).toBe(0);
    await expect(getComputedStyle(active).fontWeight).not.toBe(
      getComputedStyle(resting).fontWeight,
    );
  },
};
```

- [ ] **Step 6: Run the story test in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run sidebar`
Expected: PASS in both. CI pins no theme, so the dark run is the only place a dark-only failure surfaces.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/sidebar/sidebar.tsx packages/ui/src/components/sidebar/sidebar.test.tsx packages/ui/src/components/sidebar/sidebar.stories.tsx
git commit -m "fix(sidebar): give the active nav item a non-colour indicator (Closes #<R1 issue>)"
```

---

### Task 4: R2 — collapsed group labels leave no phantom gap

**Files:**

- Modify: `packages/ui/src/components/sidebar/sidebar.tsx:422`
- Test: `packages/ui/src/components/sidebar/sidebar.stories.tsx`

**Interfaces:**

- Consumes: the R2 issue from Task 1.
- Produces: nothing new — a behaviour change to `SidebarGroupLabel` under `collapsible="icon"`.

- [ ] **Step 1: Write the failing story lock**

```tsx
/** Collapsed to the icon rail, a group label takes no space at all — not an invisible box. */
export const CollapsedGroupLabel: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel data-testid="label">Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Overview">Overview</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('[data-testid="label"]') as HTMLElement;
    // `opacity: 0` leaves the box in flow — the gap users see. `display: none` does not.
    await expect(getComputedStyle(label).display).toBe("none");
    await expect(label.getBoundingClientRect().height).toBe(0);
  },
};
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar`
Expected: FAIL — `display` is `flex`, height is 32.

- [ ] **Step 3: Implement**

In `sidebar.tsx:422`, replace:

```
"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
```

with:

```
"group-data-[collapsible=icon]:hidden",
```

Also drop `margin` from the `transition-[margin,opacity]` on the line above — nothing animates margin any more; leave `opacity` so the expand transition is unchanged.

- [ ] **Step 4: Run the story test to verify it passes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/sidebar/sidebar.tsx packages/ui/src/components/sidebar/sidebar.stories.tsx
git commit -m "fix(sidebar): hide group labels in the icon rail instead of leaving an invisible box (Closes #<R2 issue>)"
```

---

### Task 5: R3 — `SkipLink`

**Files:**

- Create: `packages/ui/src/components/skip-link/skip-link.tsx`, `index.ts`, `skip-link.stories.tsx`, `skip-link.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `export function SkipLink(props: SkipLinkProps): JSX.Element` and `export interface SkipLinkProps extends ComponentProps<"a"> { targetId?: string }` — `targetId` defaults to `"main-content"`. Every Layer B shell renders `<SkipLink />` as its first focusable element and gives its `<SidebarInset>` `id="main-content"` and `tabIndex={-1}`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/skip-link/skip-link.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("points at the main landmark and is reachable by keyboard", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });

  it("accepts a different target", () => {
    render(<SkipLink targetId="reading-pane">Skip to the message</SkipLink>);
    expect(screen.getByRole("link", { name: "Skip to the message" })).toHaveAttribute(
      "href",
      "#reading-pane",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/skip-link`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// packages/ui/src/components/skip-link/skip-link.tsx
import { forwardRef, type ComponentProps } from "react";
import { cn } from "../../lib/cn";

export interface SkipLinkProps extends ComponentProps<"a"> {
  /** The id of the landmark to jump to. Defaults to "main-content". */
  targetId?: string;
}

/**
 * The first focusable element of an application: invisible until focused, then a
 * token-styled pill pinned to the top-start corner. Give the target element
 * `id={targetId}` and `tabIndex={-1}` so focus actually lands there.
 */
export const SkipLink = forwardRef<HTMLAnchorElement, SkipLinkProps>(function SkipLink(
  { targetId = "main-content", className, children, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      data-slot="skip-link"
      href={`#${targetId}`}
      className={cn(
        "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:start-4 focus-visible:top-4 focus-visible:z-50",
        "focus-visible:rounded-md focus-visible:bg-card focus-visible:px-3 focus-visible:py-2 focus-visible:text-body focus-visible:text-foreground focus-visible:shadow-ring-md",
        "focus-ring",
        className,
      )}
      {...props}
    >
      {children ?? "Skip to main content"}
    </a>
  );
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/skip-link`
Expected: PASS.

- [ ] **Step 5: Add the barrel exports**

```ts
// packages/ui/src/components/skip-link/index.ts
export * from "./skip-link";
```

In `packages/ui/src/index.ts`, add `export * from "./components/skip-link";` in the alphabetical position (between `./components/sidebar` and `./components/spinner`).

- [ ] **Step 6: Write the story**

```tsx
// packages/ui/src/components/skip-link/skip-link.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { SkipLink } from "./skip-link";

const meta = {
  title: "Navigation/Skip Link",
  component: SkipLink,
  parameters: {
    docs: {
      description: {
        component:
          'The first focusable element of an application. Invisible until it receives focus, then a pill in the top-start corner that jumps past the whole nav rail to the page\'s `<main>`. Give the target `id="main-content"` and `tabIndex={-1}` so focus lands there rather than merely scrolling.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SkipLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press Tab: the link appears. It is the only way a keyboard user skips the rail. */
export const Default: Story = {
  render: () => (
    <div>
      <SkipLink />
      <nav aria-label="Primary" className="p-4 text-body text-muted-foreground">
        nav links live here
      </nav>
      <main id="main-content" tabIndex={-1} className="p-4 text-body">
        Main content
      </main>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const link = canvasElement.querySelector('[data-slot="skip-link"]') as HTMLElement;
    await expect(link).toHaveFocus();
    // Not-sr-only when focused: it has real painted size.
    await expect(link.getBoundingClientRect().width).toBeGreaterThan(40);
  },
};
```

- [ ] **Step 7: Run story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run skip-link`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run skip-link`
Expected: PASS in both.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/skip-link packages/ui/src/index.ts
git commit -m "feat(ui): SkipLink — the first focusable element of an app shell"
```

---

### Task 6: R4 — `CommandTrigger`

**Files:**

- Create: `packages/ui/src/components/command-trigger/command-trigger.tsx`, `index.ts`, `command-trigger.stories.tsx`, `command-trigger.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: the existing `Kbd` component from `@elabs-ai/components-ui` (relative import `../kbd` inside the package).
- Produces: `export const CommandTrigger` — `interface CommandTriggerProps extends ComponentProps<"button"> { label?: string; shortcut?: string }`. `shortcut` defaults to the platform-correct `⌘ K` / `Ctrl K`. Used by the flagship's top bar (Task 12) and the dashboard shell (Task 14).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/command-trigger/command-trigger.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandTrigger } from "./command-trigger";

describe("CommandTrigger", () => {
  it("announces only its label — the shortcut glyph must not pollute the accessible name", () => {
    render(<CommandTrigger />);
    // #117: a Kbd inside a control concatenates into the computed name. Assert the
    // EXACT name; a regex match would happily pass on the polluted string.
    expect(screen.getByRole("button")).toHaveAccessibleName("Search");
  });

  it("takes a custom label and shortcut", () => {
    render(<CommandTrigger label="Find anything" shortcut="Ctrl K" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Find anything");
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/command-trigger`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// packages/ui/src/components/command-trigger/command-trigger.tsx
import { forwardRef, type ComponentProps } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { Kbd } from "../kbd";

export interface CommandTriggerProps extends ComponentProps<"button"> {
  /** The visible and announced label. Defaults to "Search". */
  label?: string;
  /** The shortcut hint. Defaults to the platform-correct ⌘ K / Ctrl K. */
  shortcut?: string;
}

function platformShortcut(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  // `userAgentData.platform` where available, else the legacy string. Both are
  // hints, not guarantees — the trigger is a hint too, so a wrong guess is cosmetic.
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘ K" : "Ctrl K";
}

/**
 * The command-palette opener, shaped like a search field: label left, shortcut
 * pinned right, collapsing to the icon alone under `sm`. The visible label and the
 * Kbd are BOTH aria-hidden and the name is authored on the button — a Kbd inside a
 * control otherwise concatenates into its accessible name (#117).
 */
export const CommandTrigger = forwardRef<HTMLButtonElement, CommandTriggerProps>(
  function CommandTrigger({ label = "Search", shortcut, className, ...props }, ref) {
    const hint = shortcut ?? platformShortcut();
    return (
      <button
        ref={ref}
        type="button"
        data-slot="command-trigger"
        aria-label={label}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-body text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground focus-ring",
          "sm:w-56 sm:justify-between sm:ps-2 sm:pe-1.5",
          className,
        )}
        {...props}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span aria-hidden="true" className="hidden truncate sm:inline">
            {label}
          </span>
        </span>
        <Kbd aria-hidden="true" className="hidden sm:inline-flex">
          {hint}
        </Kbd>
      </button>
    );
  },
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/command-trigger`
Expected: PASS. If `Kbd` does not accept `className`, check its real props first with `mcp__brand-ui__docs Kbd` — never guess a prop.

- [ ] **Step 5: Add barrel exports**

`packages/ui/src/components/command-trigger/index.ts` → `export * from "./command-trigger";`, and `export * from "./components/command-trigger";` in `packages/ui/src/index.ts`.

- [ ] **Step 6: Write the story**

Title `Navigation/Command Trigger`, `tags: ["autodocs"]`, a `parameters.docs.description.component` sentence, and stories `Default` and `WithCustomShortcut`. The `Default` play function asserts `toHaveAccessibleName("Search")` — the same #117 lock, but against the real rendered component in a browser.

- [ ] **Step 7: Run story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run command-trigger`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run command-trigger`
Expected: PASS in both.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/command-trigger packages/ui/src/index.ts
git commit -m "feat(ui): CommandTrigger — the search-shaped command-palette opener"
```

---

### Task 7: R6 — `PageShell` scroll and gutter modes

**Files:**

- Modify: `packages/ui/src/components/page-shell/page-shell.tsx`
- Create: `packages/ui/src/components/page-shell/page-shell.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `PageShellProps` gains `scroll?: "body" | "content" | "fill"` (default `"body"`) and `headerGutter?: boolean` (default `false`). `"body"` is byte-identical to today. The flagship (Task 12) uses `scroll="fill"`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/page-shell/page-shell.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "./page-shell";

describe("PageShell", () => {
  it("is unchanged when no new prop is passed — the additive default", () => {
    const { container } = render(<PageShell>body</PageShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("w-full px-4 py-6 sm:px-6 lg:px-8");
  });

  it('scroll="content" makes the inner column the scroll container', () => {
    const { container } = render(<PageShell scroll="content">body</PageShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-0");
    expect(root.className).toContain("overflow-y-auto");
  });

  it('scroll="fill" fills its parent and does not scroll itself', () => {
    const { container } = render(<PageShell scroll="fill">body</PageShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("h-full");
    expect(root.className).toContain("overflow-hidden");
  });

  it("headerGutter reserves a fixed header row so titles land at one coordinate", () => {
    render(
      <PageShell headerGutter header={<h1>Runs</h1>}>
        body
      </PageShell>,
    );
    const gutter = screen.getByText("Runs").closest('[data-slot="page-shell-header"]');
    expect(gutter).not.toBeNull();
    expect(gutter?.className).toContain("min-h-14");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/page-shell`
Expected: FAIL on the last three; the first (the additive-default lock) passes today and must keep passing.

- [ ] **Step 3: Implement**

Add to `PageShellProps`:

```ts
  /**
   * "body" (default) — the page scrolls with the document. Byte-identical to
   * the pre-#R6 behaviour; existing callers are unaffected.
   * "content" — this container is the scroll port. Use inside a `SidebarInset`
   * whose height is already bounded, so the top bar stays put.
   * "fill" — fills its parent and scrolls nothing itself; a child (a table, a
   * canvas) owns the scrolling.
   */
  scroll?: "body" | "content" | "fill";
  /**
   * Reserve a fixed-height header row so a page title lands at identical
   * coordinates on every route, whether or not that route has a header.
   */
  headerGutter?: boolean;
```

```ts
const scrollMap = {
  body: "",
  content: "min-h-0 flex-1 overflow-y-auto",
  fill: "h-full min-h-0 overflow-hidden",
} as const;
```

Merge `scrollMap[scroll]` into the root `cn()` **after** the base string and before `className`, so a caller can still override. Wrap the header in `<div data-slot="page-shell-header" className={cn(headerGutter && "flex min-h-14 items-center")}>` **only when `headerGutter` is true**; when false the existing branch renders exactly as today.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/page-shell`
Expected: PASS, all four — including the byte-identical default.

- [ ] **Step 5: Extend the story**

Add `ScrollContent`, `ScrollFill` and `WithHeaderGutter` stories to the existing `page-shell.stories.tsx`, each with a one-sentence description. `pnpm variants:check` reads rendered positions, so these must set the prop as a real JSX attribute or story arg, not merely list it in `argTypes.options`.

- [ ] **Step 6: Run story + variant gates**

Run: `cd apps/docs && pnpm exec vitest --project storybook run page-shell`
Run: `pnpm variants:check`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/page-shell
git commit -m "feat(ui): PageShell gains scroll modes and a fixed header gutter"
```

---

### Task 8: R8 — drive the inset treatment from state the content can see

Only the parts Task 1 **confirmed**. If Task 1 showed `peer-*` composes from a right-hand panel after all, this task shrinks to the gutter-sides choice (Steps 3-5) and the probe deletion.

**Files:**

- Modify: `packages/ui/src/components/sidebar/sidebar.tsx:135` (wrapper) and `:313` (`SidebarInset`)
- Delete: `packages/ui/src/components/sidebar/sidebar-inset-probe.stories.tsx`
- Test: `packages/ui/src/components/sidebar/sidebar.stories.tsx`

**Interfaces:**

- Consumes: Task 1's `R8_PEER_COMPOSES` finding.
- Produces: `SidebarProvider` accepts `variant?: "sidebar" | "floating" | "inset"` which it writes as `data-variant` on the wrapper, and `SidebarInset` accepts `gutter?: "auto" | "leading" | "trailing" | "both" | "none"` (default `"auto"` = today's `m-2 ms-0`). Layer B's shells pass `gutter="leading"` for the §2.2 geometry.

- [ ] **Step 1: Write the failing story lock**

```tsx
/** A right-hand panel can drive the floating inset surface — sibling order must not decide it. */
export const RightHandInset: Story = {
  render: () => (
    <SidebarProvider variant="inset">
      <SidebarInset data-testid="inset" gutter="leading">
        <div className="p-6 text-body">content</div>
      </SidebarInset>
      <Sidebar side="right" variant="inset">
        <SidebarContent />
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const s = getComputedStyle(inset);
    await expect(parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0);
    await expect(parseFloat(s.marginInlineStart)).toBeGreaterThan(0);
    // The §2.2 geometry: leading + bottom only. A tab must touch the page it belongs to.
    await expect(parseFloat(s.marginTop)).toBe(0);
    await expect(parseFloat(s.marginInlineEnd)).toBe(0);
  },
};
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar`
Expected: FAIL — radius 0 and margins 0, exactly as Task 1 measured.

- [ ] **Step 3: Implement the state channel**

In `SidebarProvider`, accept `variant` and put it on the wrapper `div` as `data-variant={variant}` alongside the existing classes at `:135`. The wrapper is an **ancestor** of both the content and any rail, so `group-data-[variant=inset]/sidebar-wrapper:` reaches the content regardless of sibling order — which `peer-*` cannot.

In `SidebarInset` (`:313`), replace the four `md:peer-data-[variant=inset]:*` utilities with the ancestor form, and make the gutter explicit:

```ts
const gutterMap = {
  auto: "md:group-data-[variant=inset]/sidebar-wrapper:m-2 md:group-data-[variant=inset]/sidebar-wrapper:ms-0",
  leading:
    "md:group-data-[variant=inset]/sidebar-wrapper:mb-2 md:group-data-[variant=inset]/sidebar-wrapper:ms-2",
  trailing:
    "md:group-data-[variant=inset]/sidebar-wrapper:mb-2 md:group-data-[variant=inset]/sidebar-wrapper:me-2",
  both: "md:group-data-[variant=inset]/sidebar-wrapper:m-2",
  none: "",
} as const;
```

Keep `md:group-data-[variant=inset]/sidebar-wrapper:rounded-xl md:group-data-[variant=inset]/sidebar-wrapper:shadow-sm` unconditional, and **keep** the existing `peer-data-[variant=inset]` line as well so a shell that sets `variant` on `Sidebar` only (every current caller) is unchanged.

- [ ] **Step 4: Run the story lock and the existing sidebar suite**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar`
Run: `pnpm --filter @elabs-ai/components-ui test src/components/sidebar`
Expected: PASS. Any pre-existing inset story must render identically — this is additive.

- [ ] **Step 5: Delete the probe**

```bash
git rm packages/ui/src/components/sidebar/sidebar-inset-probe.stories.tsx
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/sidebar/sidebar.tsx packages/ui/src/components/sidebar/sidebar.stories.tsx
git commit -m "fix(sidebar): drive the inset surface from an ancestor state, not sibling order (Closes #<R8 issue>)"
```

---

### Task 9: R5b — `ContextRail`

**Files:**

- Create: `packages/ui/src/components/context-rail/context-rail.tsx`, `index.ts`, `context-rail.stories.tsx`, `context-rail.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: `Sidebar`, `SidebarProvider`, `SidebarMenu*`, `SidebarMenuBadge` from the same package (relative `../sidebar`); the ADR from Task 2.
- Produces:

```ts
export interface ContextRailSection {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
  content: ReactNode;
}
export interface ContextRailProps extends Omit<ComponentProps<"div">, "onSelect"> {
  sections: ContextRailSection[];
  activeId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
}
```

Controlled only — the caller owns state, per the prop-driven rule. Task 12 wires it.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/context-rail/context-rail.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, Quote } from "lucide-react";
import { ContextRail } from "./context-rail";

const sections = [
  { id: "sources", label: "Sources", icon: FileText, count: 3, content: <p>Sources body</p> },
  { id: "quotes", label: "Quotes", icon: Quote, content: <p>Quotes body</p> },
];

describe("ContextRail", () => {
  it("keeps every section reachable by name when collapsed to the icon strip", () => {
    render(
      <ContextRail
        sections={sections}
        activeId="sources"
        onSelect={() => {}}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    // The label stays in the DOM as the button's accessible name — the collapsed
    // strip IS the section switcher, so it must not become a row of unnamed icons.
    expect(screen.getByRole("button", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quotes" })).toBeInTheDocument();
  });

  it("renders only the active section's content when open", () => {
    render(
      <ContextRail
        sections={sections}
        activeId="quotes"
        onSelect={() => {}}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("Quotes body")).toBeInTheDocument();
    expect(screen.queryByText("Sources body")).toBeNull();
  });

  it("reports the chosen section", async () => {
    const onSelect = vi.fn();
    render(
      <ContextRail
        sections={sections}
        activeId="sources"
        onSelect={onSelect}
        open
        onOpenChange={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Quotes" }));
    expect(onSelect).toHaveBeenCalledWith("quotes");
  });

  it("marks the active section for assistive tech, not by colour alone", () => {
    render(
      <ContextRail
        sections={sections}
        activeId="sources"
        onSelect={() => {}}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Sources" })).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/context-rail`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Build on `Sidebar side="right" collapsible="icon"` inside its **own** `SidebarProvider` (`open` / `onOpenChange` forwarded), because a provider holds exactly one `open` flag and sharing one would collapse the nav rail and the context rail together. One `SidebarMenu` serves both states — `flex-row` when open, `flex-col` when collapsed (`group-data-[collapsible=icon]:flex-col`); each button renders `<Icon aria-hidden="true" />` plus `<span className="group-data-[collapsible=icon]:sr-only">{label}</span>` so the label is the accessible name in both states; `tooltip={label}` in both; `<SidebarMenuBadge>` when `count` is set. `aria-current="true"` on the active button, plus the R1 bar it inherits from `SidebarMenuButton isActive`. When `loading`, render `Skeleton` rows shaped like the section body, and a single `role="status" aria-live="polite"` label at the region — never one per box.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/context-rail`
Expected: PASS.

- [ ] **Step 5: Barrel exports and story**

Add `index.ts` and the `packages/ui/src/index.ts` line. Story title `Layout/Context Rail`, `tags: ["autodocs"]`, description sentence, stories: `Default`, `Collapsed`, `Loading` (the `loading` state is required by `pnpm loading-states:check` for any component exposing a boolean `loading`).

- [ ] **Step 6: Run story tests in both themes and the loading gate**

Run: `cd apps/docs && pnpm exec vitest --project storybook run context-rail`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run context-rail`
Run: `pnpm loading-states:check`
Expected: PASS all three.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/context-rail packages/ui/src/index.ts
git commit -m "feat(ui): ContextRail — a right-hand rail whose collapsed strip is its section switcher"
```

---

### Task 10: R5a — `SideDock`

**Files:**

- Create: `packages/ui/src/components/side-dock/side-dock.tsx`, `index.ts`, `side-dock.stories.tsx`, `side-dock.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: `Sheet` from the same package (relative `../sheet`).
- Produces:

```ts
export interface SideDockProps extends ComponentProps<"aside"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number; // default 300
  maxWidth?: number; // default 720
  minContentWidth?: number; // default 480
  overlayBelow?: number; // default 1100 — MUST stay above the 768px mobile breakpoint
  title: string;
}
```

The caller persists `width`; the component never touches storage.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/side-dock/side-dock.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SideDock } from "./side-dock";

describe("SideDock", () => {
  it("names the region and its resize handle", () => {
    render(
      <SideDock open width={400} onOpenChange={() => {}} onWidthChange={() => {}} title="Assistant">
        <p>dock body</p>
      </SideDock>,
    );
    expect(screen.getByRole("complementary", { name: "Assistant" })).toBeInTheDocument();
    const handle = screen.getByRole("separator", { name: "Resize Assistant" });
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "400");
  });

  it("resizes by keyboard, not pointer alone", async () => {
    const onWidthChange = vi.fn();
    render(
      <SideDock
        open
        width={400}
        onOpenChange={() => {}}
        onWidthChange={onWidthChange}
        title="Assistant"
      >
        <p>dock body</p>
      </SideDock>,
    );
    const handle = screen.getByRole("separator", { name: "Resize Assistant" });
    handle.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onWidthChange).toHaveBeenCalled();
    expect(onWidthChange.mock.calls[0][0]).toBeGreaterThan(400);
  });

  it("clamps to minWidth and maxWidth", async () => {
    const onWidthChange = vi.fn();
    render(
      <SideDock
        open
        width={300}
        minWidth={300}
        onOpenChange={() => {}}
        onWidthChange={onWidthChange}
        title="Assistant"
      >
        <p>dock body</p>
      </SideDock>,
    );
    screen.getByRole("separator", { name: "Resize Assistant" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onWidthChange).toHaveBeenCalledWith(300);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/side-dock`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

An `<aside role="complementary" aria-label={title}>` whose `width` transitions between `0` and `width` px using a gated duration token and `motion-reduce:transition-none`. The resize handle is a real focusable element with `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`, `tabIndex={0}`, arrow-key handling (left widens on a right-hand dock; `Home`/`End` jump to min/max), and pointer handling via `pointerdown` + `setPointerCapture`. Clamp every proposed width to `[minWidth, min(maxWidth, viewportWidth - minContentWidth)]` — recompute against the **live** viewport on resize, so a narrowing window shrinks the dock rather than crushing the content. Below `overlayBelow` px, render the children inside a `Sheet` instead of the inline aside; the default 1100 is deliberately above the library's 768px mobile breakpoint, because a 400px dock at 768px leaves ~360px of content. Keep children mounted for the closing transition, then unmount on `transitionend`.

Read layout with `getBoundingClientRect` only inside event handlers, never during render.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @elabs-ai/components-ui test src/components/side-dock`
Expected: PASS.

- [ ] **Step 5: Barrel exports and story**

Story title `Layout/Side Dock`, `tags: ["autodocs"]`, description sentence, stories `Default` (open), `Closed`, `Resized`. The `Default` play function tabs to the handle, presses `ArrowLeft` twice and asserts the rendered width grew — the real-CSS counterpart of the unit test.

- [ ] **Step 6: Run story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run side-dock`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run side-dock`
Expected: PASS in both.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/side-dock packages/ui/src/index.ts
git commit -m "feat(ui): SideDock — a summoned, resizable right-hand panel"
```

---

### Task 11: Layer A close-out — full battery and derived artifacts

Layer A is a natural stopping point: the package is repaired and shippable on its own, before any shell is touched.

**Files:**

- Modify: `brand-ui.manifest.json`, `component-inventory.md`, `llms.txt`, `apps/docs/public/brand-ui-context.md`, `CLAUDE.md` / `AGENTS.md` generated regions, `CHANGELOG.md`
- Modify: `scripts/components-story-baseline.json` and any ratchet the new components touch

**Interfaces:**

- Consumes: Tasks 3-10.
- Produces: a green package. Layer B builds against it.

- [ ] **Step 1: Regenerate every derived artifact**

Run: `pnpm manifest && pnpm agent-docs`
The pre-commit cascade does this automatically for `packages/*/src/**` changes, but run it explicitly so the diff is reviewable rather than a surprise at commit time.

- [ ] **Step 2: Add the changelog entry**

Under `## Unreleased` in `CHANGELOG.md`, one entry saying what a **consumer** gets: the four new components, the two sidebar repairs, and `PageShell`'s additive modes. `pnpm changelog-entry:check` fails without it, because shipped package source changed.

- [ ] **Step 3: Run the full battery**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm components:check && pnpm variants:check && pnpm loading-states:check
pnpm data-slot:check && pnpm text-scale:check && pnpm microtypography:check
pnpm story-descriptions:check && pnpm docs:check && pnpm manifest:check
```

Expected: all green. Any ratchet that moved **up** is a defect in this work, not a baseline to update.

- [ ] **Step 4: Run the a11y and visual reviewers**

Dispatch `brand-ui-accessibility-reviewer` and `brand-ui-visual-ux-reviewer` over the four new components' stories, cross-theme. Findings route through `/file-issue` — finders report, builders fix.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ui): regenerate derived artifacts for the app-shell primitives"
```

---

### Task 12: Move the three ported shells into the registry, unchanged

A pure move, verified green, **before** any redesign. Mixing a move with a rewrite makes both unreviewable.

**Files:**

- Move: `packages/ui/src/blocks/sidebar-02/**` → `registry/blocks/sidebar-02/**` (same for `-04`, `-05`)
- Delete: the three `*.stories.tsx` from their old homes
- Create: `apps/docs/stories/blocks/sidebar-02.stories.tsx`, `sidebar-04.stories.tsx`, `sidebar-05.stories.tsx`
- Modify: `registry/registry.items.json:75-97` (three `root` paths)

**Interfaces:**

- Consumes: nothing from Layer A yet.
- Produces: the three blocks reachable at `@/components/sidebar-0N/…` from `apps/docs`, exactly as `ai-chat-shell` is.

- [ ] **Step 1: Confirm nothing re-exports the blocks**

Run: `grep -rn "blocks/sidebar-0" packages/ui/src/index.ts packages/ui/src`
Expected: matches only inside the block directories themselves. If `packages/ui/src/index.ts` exports them, STOP — this becomes a breaking public-API change and needs the architect.

- [ ] **Step 2: Move the sources**

```bash
git mv packages/ui/src/blocks/sidebar-02 registry/blocks/sidebar-02
git mv packages/ui/src/blocks/sidebar-04 registry/blocks/sidebar-04
git mv packages/ui/src/blocks/sidebar-05 registry/blocks/sidebar-05
git mv registry/blocks/sidebar-02/sidebar-02.stories.tsx apps/docs/stories/blocks/sidebar-02.stories.tsx
git mv registry/blocks/sidebar-04/sidebar-04.stories.tsx apps/docs/stories/blocks/sidebar-04.stories.tsx
git mv registry/blocks/sidebar-05/sidebar-05.stories.tsx apps/docs/stories/blocks/sidebar-05.stories.tsx
rmdir packages/ui/src/blocks 2>/dev/null || true
```

- [ ] **Step 3: Repoint the imports in the moved stories**

Each story now imports through the consumer alias, matching `apps/docs/stories/blocks/ai-chat-shell.stories.tsx`:

```tsx
import { AppSidebar } from "@/components/sidebar-02/app-sidebar";
```

Keep each story's `title` exactly as it was (`Layout/App Shell/Dashboard`, `…/Mail`, `…/Double-Sided`) so `storySort.order` and every existing docs cross-link still resolve. Inside the blocks, change any relative import that reached into `packages/ui` (`../../components/...`) to the package alias `@elabs-ai/components-ui`.

- [ ] **Step 4: Repoint the registry items**

In `registry/registry.items.json`, change the three `root` values from `packages/ui/src/blocks/sidebar-0N` to `registry/blocks/sidebar-0N`. Do **not** edit `registry/registry.json` — it is generated.

- [ ] **Step 5: Regenerate and validate the registry**

```bash
pnpm gen:registry && pnpm registry:validate && pnpm registry:resolve:check
```

Expected: 26 items, every relative import resolving in both the repo tree and the install tree.

- [ ] **Step 6: Verify the moved stories still render and pass**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-0`
Expected: PASS, three story files.

- [ ] **Step 7: Ratchet the baselines DOWN**

The moved files leave `packages/ui`, so its raw-font-size and separation debt drops:

```bash
pnpm text-scale:check -- --update
pnpm separation:check -- --update
pnpm story-descriptions:check -- --update
pnpm data-slot:check -- --update
```

Inspect each diff: every changed number must go **down** or move to the new path. A number that went up means the move introduced debt — fix the source, not the baseline.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(registry): move the three ported app shells out of packages/ui"
```

---

### Task 13: The flagship shell — frame, metrics and nav rail

**Files:**

- Create: `registry/blocks/app-shell/shell-metrics.ts`, `nav-items.ts`, `app-nav-rail.tsx`
- Modify: `registry/blocks/app-shell/app-shell-page.tsx`

**Interfaces:**

- Consumes: `SkipLink`, `ContextRail`, `CommandTrigger`, `PageShell`, the repaired `Sidebar` — all from `@elabs-ai/components-ui`.
- Produces:

```ts
// shell-metrics.ts
export const NAV_EXPANDED_PX = 256;
export const NAV_COLLAPSED_PX = 48;
export const LIST_COLUMN_PX = 280;
export const CONTEXT_EXPANDED_PX = 320;
export const CONTEXT_COLLAPSED_PX = 48;
export const INSET_GAP_PX = 8;
export function shellStyle(state: ShellState): CSSProperties; // CSS custom properties
export interface ShellState {
  nav: boolean;
  list: boolean;
  context: boolean;
}

// nav-items.ts
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  items?: NavItem[];
}
export const NAV_GROUPS: { label: string; items: NavItem[] }[];
export function isPathActive(itemHref: string, activePath: string): boolean;
```

Tasks 14 and 15 import `isPathActive` and `shellStyle` from here.

- [ ] **Step 1: Write the failing test for the router-agnostic contract**

```tsx
// apps/docs/stories/blocks/app-shell.stories.tsx — the play function is the lock
// (registry/ has no test runner of its own; the block is exercised as it ships).
export const ActivePathMatching: Story = {
  render: () => <AppShellPage activePath="/runs/42" />,
  play: async ({ canvasElement }) => {
    const runs = canvasElement.querySelector('a[href="/runs"]') as HTMLElement;
    const overview = canvasElement.querySelector('a[href="/"]') as HTMLElement;
    // A nested route keeps its parent lit; an unrelated one does not.
    await expect(runs).toHaveAttribute("data-active", "true");
    await expect(overview).toHaveAttribute("data-active", "false");
  },
};
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/docs && pnpm exec vitest --project storybook run app-shell`
Expected: FAIL — `AppShellPage` takes no `activePath` yet.

- [ ] **Step 3: Write `nav-items.ts`**

```ts
/**
 * Router-agnostic by construction. Every nav entry is a plain `<a href>`; swap the
 * element for your router's link and keep this matcher:
 *   <NavLink to={item.href}>            (react-router)
 *   <Link href={item.href}>             (next/link)
 * `isPathActive` is exported so the semantics survive the swap.
 */
export function isPathActive(itemHref: string, activePath: string): boolean {
  if (itemHref === activePath) return true;
  if (itemHref === "/") return false; // the root would otherwise match everything
  return activePath.startsWith(`${itemHref}/`);
}
```

- [ ] **Step 4: Write `shell-metrics.ts`**

One module declaring the widths once and publishing derived offsets as CSS custom properties on the shell root, so a row in a **different subtree** can align with the content column — no CSS selector reaches across, and the widths live inside `Sidebar`. Header comment states plainly that this is a **pattern to copy**, deliberately not a package component, because the widths are an app's decision.

```ts
export function shellStyle({ nav, list, context }: ShellState): CSSProperties {
  const navPx = nav ? NAV_EXPANDED_PX : NAV_COLLAPSED_PX;
  const listPx = list ? LIST_COLUMN_PX : 0;
  const contextPx = context ? CONTEXT_EXPANDED_PX : CONTEXT_COLLAPSED_PX;
  return {
    "--shell-nav-w": `${navPx}px`,
    "--shell-list-w": `${listPx}px`,
    "--shell-context-w": `${contextPx}px`,
    "--shell-content-start": `${navPx + listPx + INSET_GAP_PX}px`,
  } as CSSProperties;
}
```

- [ ] **Step 5: Write `app-nav-rail.tsx`**

`collapsible="icon"`, pinned `data-density="comfortable"` (collapsed icon buttons scale with `--spacing` and shrink below the fixed 3rem rail under `compact`); a brand block using **sidebar** ink tokens (page ink is invisible on a dark rail in the light theme), hidden when collapsed; grouped nav with labels; collapsed-rail mirror items for sub-items; the R1 active state via `isActive={isPathActive(item.href, activePath)}`; `SidebarContent` given explicit `min-h-0 overflow-y-auto` so a sticky footer never draws over the last items at ~900px; the nav landmark wrapped in `display: contents` so it stays in the a11y tree without becoming a layout box that breaks the scroll; footer with Settings and an environment meta line.

- [ ] **Step 6: Compose the frame in `app-shell-page.tsx`**

`<SkipLink />` first; three sibling `SidebarProvider`s (one per collapsible zone — a shared provider holds one `open` flag and would collapse them together), all controlled from local state; `data-nav` / `data-list` / `data-context` on the root plus `style={shellStyle(state)}`; `SidebarInset` as the single `<main>` with `id="main-content"` and `tabIndex={-1}`; `gutter="leading"` for the §2.2 geometry.

- [ ] **Step 7: Run the story test to verify it passes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run app-shell`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add registry/blocks/app-shell apps/docs/stories/blocks/app-shell.stories.tsx
git commit -m "feat(registry): the flagship app shell — four zones, metrics module, router-agnostic nav"
```

---

### Task 14: The flagship shell — top bar, list column, context rail and screen

**Files:**

- Create: `registry/blocks/app-shell/app-top-bar.tsx`, `app-list-column.tsx`, `console-overview.tsx`
- Modify: `registry/blocks/app-shell/app-shell-page.tsx`
- Modify: `apps/docs/stories/blocks/app-shell.stories.tsx`

**Interfaces:**

- Consumes: Task 13's `shellStyle`, `isPathActive`, `NAV_GROUPS`; `ContextRail` (Task 9); `CommandTrigger` (Task 6); `PageShell` `scroll="fill"` (Task 7); `MetricCard` / `DataTable` / `Timeline` from `@elabs-ai/components-ui` and `-data` — legal here, illegal in `packages/ui`, which is the whole reason for the move.
- Produces: the finished flagship, rendered by `Layout/App Shell/Basic`.

- [ ] **Step 1: Write the failing story locks**

Add three stories, each asserting something structural rather than cosmetic:

```tsx
/** Chrome only: every zone present, the content slot empty. */
export const Frame: Story = { render: () => <AppShellPage activePath="/" emptyContent /> };

/** The icon rail: labels gone, tooltips and accessible names intact. */
export const Collapsed: Story = {
  render: () => <AppShellPage activePath="/" defaultNavOpen={false} />,
  play: async ({ canvasElement }) => {
    // The rail is still fully navigable by name — the collapsed state must not
    // become a column of unnamed icons.
    await expect(canvasElement.querySelector('a[href="/runs"]')).toHaveAccessibleName("Runs");
  },
};

/** The right-hand rail open on its first section. */
export const ContextRailOpen: Story = {
  render: () => <AppShellPage activePath="/runs" defaultContextOpen />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-context="open"]')).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/docs && pnpm exec vitest --project storybook run app-shell`
Expected: FAIL — the props do not exist yet.

- [ ] **Step 3: Write `app-top-bar.tsx`**

Sidebar trigger floored at 44×44 under `@media (pointer: coarse)` only (`coarse:size-11`, never unconditionally — a 44px target on a mouse-driven desktop is oversized chrome); breadcrumbs rendered **only** at drill depth ≥ 2; a right cluster of `CommandTrigger`, help, notifications, `ThemeSwitcher` and the context-rail toggle. Every icon-only control carries an `aria-label`.

- [ ] **Step 4: Write `app-list-column.tsx` and `console-overview.tsx`**

The list column is the optional third zone (D8), on by default. `console-overview.tsx` is the believable screen: a metric row, a runs table with status tone, an activity timeline. Status is never colour alone — every tone pairs with a glyph and a text label. Reach for `text-<role>` utilities, `tabular-nums` on every numeric column, and a real empty state for each list.

- [ ] **Step 5: Wire them into `app-shell-page.tsx`**

`PageShell` in `scroll="fill"` mode inside the `SidebarInset`; `ContextRail` on the right, its state controlled by the same store as the root `data-context` attribute.

- [ ] **Step 6: Add the remaining stories**

`Default` (the believable screen), `Narrow` (mobile / slide-over, via a viewport parameter), plus `Loading` and `Empty` states of the screen. Every story gets a description sentence and the file carries `tags: ["autodocs"]`.

- [ ] **Step 7: Run the story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run app-shell`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run app-shell`
Expected: PASS in both, axe included.

- [ ] **Step 8: Commit**

```bash
git add registry/blocks/app-shell apps/docs/stories/blocks/app-shell.stories.tsx
git commit -m "feat(registry): the flagship shell's top bar, list column, context rail and console screen"
```

---

### Task 15: Rebuild the dashboard shell (`sidebar-02`)

**Files:**

- Modify: every file under `registry/blocks/sidebar-02/`
- Modify: `apps/docs/stories/blocks/sidebar-02.stories.tsx`
- Modify: `registry/registry.items.json` (the `sidebar-02` description loses "Adapted from blocks.so." if nothing recognisable survives)

**Interfaces:**

- Consumes: Task 13's `isPathActive` — **copied**, not imported. Blocks are copy-own; a cross-block import would break `npx shadcn add sidebar-02` for anyone who did not also install the flagship.
- Produces: `Layout/App Shell/Dashboard`.

- [ ] **Step 1: Write the failing story locks**

`Default`, `Frame`, `Collapsed`, `Narrow` — the same four-state grid every shell carries, with `Collapsed`'s play function asserting the rail stays navigable by accessible name.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-02`
Expected: FAIL.

- [ ] **Step 3: Rebuild**

Team switcher, collapsible nav groups, the floating inset surface (D7 — `variant="inset"` on the provider plus `gutter="leading"`), the flagship's chrome standards (skip link, `id="main-content"`, the R1 active state, `CommandTrigger` in the top bar). Screen: a metric grid, a chart card, recent activity — all reachable now that the block lives in `registry/`.

- [ ] **Step 4: Run the story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-02`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run sidebar-02`
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add registry/blocks/sidebar-02 apps/docs/stories/blocks/sidebar-02.stories.tsx registry/registry.items.json
git commit -m "feat(registry): rebuild the dashboard app shell on the repaired primitives"
```

---

### Task 16: Rebuild the mail shell (`sidebar-04`)

**Files:**

- Modify: every file under `registry/blocks/sidebar-04/`
- Modify: `apps/docs/stories/blocks/sidebar-04.stories.tsx`
- Modify: `registry/registry.items.json`

**Interfaces:**

- Consumes: the same copied `isPathActive`.
- Produces: `Layout/App Shell/Mail` — a three-zone variation on the flagship's left side (icon rail + list column + reading pane), not a separate idea.

- [ ] **Step 1: Write the failing story locks**

The four-state grid, plus a `play` asserting the reading pane is a labelled landmark and that the list column's items are real links.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-04`
Expected: FAIL.

- [ ] **Step 3: Rebuild**

Icon rail + list column + reading pane, floating inset surface, flagship chrome standards. This rebuild is also what retires the raw-font-size debt `.claude/rules/styling-and-tokens.md` names in the old `sidebar-04` source: every raw `text-sm` / `text-xs` becomes its role (`text-body` / `text-meta`), and `text-xs` → `text-meta` additionally adopts weight 500 and `0.01em` tracking, so check any label that relied on weight 400.

- [ ] **Step 4: Run the story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-04`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run sidebar-04`
Expected: PASS in both.

- [ ] **Step 5: Ratchet the text-scale baseline down**

Run: `pnpm text-scale:check -- --update`
Inspect the diff: the `sidebar-04` count must drop, not move sideways.

- [ ] **Step 6: Commit**

```bash
git add registry/blocks/sidebar-04 apps/docs/stories/blocks/sidebar-04.stories.tsx registry/registry.items.json scripts/text-scale-baseline.json
git commit -m "feat(registry): rebuild the mail shell as a three-zone variation of the flagship"
```

---

### Task 17: Rebuild the dual-rail shell (`sidebar-05`) and demonstrate `SideDock`

**Files:**

- Modify: every file under `registry/blocks/sidebar-05/`
- Modify: `apps/docs/stories/blocks/sidebar-05.stories.tsx`
- Modify: `registry/registry.items.json`

**Interfaces:**

- Consumes: `SideDock` (Task 10) — this shell is where the summoned-panel pattern gets its real home, so both right-hand patterns (D4) ship demonstrated rather than merely available.
- Produces: `Layout/App Shell/Double-Sided`.

- [ ] **Step 1: Write the failing story locks**

The four-state grid plus `DockOpen`, whose play function asserts the dock is a named `complementary` landmark and that its resize handle is keyboard-reachable.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-05`
Expected: FAIL.

- [ ] **Step 3: Rebuild**

Slim icon rail opening a contextual second panel; a settings surface with a section list as the screen; `SideDock` on the right, its width held in the block's own state with a comment showing where a consumer would persist it. Floating inset surface, flagship chrome standards.

- [ ] **Step 4: Run the story tests in both themes**

Run: `cd apps/docs && pnpm exec vitest --project storybook run sidebar-05`
Run: `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run sidebar-05`
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add registry/blocks/sidebar-05 apps/docs/stories/blocks/sidebar-05.stories.tsx registry/registry.items.json
git commit -m "feat(registry): rebuild the dual-rail shell and demonstrate SideDock"
```

---

### Task 18: Retire the `AppShell` primitive's claim on `Basic`, and re-check attribution

**Files:**

- Modify: `packages/ui/src/components/app-shell/app-shell.stories.tsx` (title only)
- Modify: `scripts/attributions.sources.json`
- Modify: `ATTRIBUTION.md` + the generated attribution dataset (via `pnpm gen:attributions`)

**Interfaces:**

- Consumes: Tasks 15-17 (whether anything from blocks.so survived).
- Produces: `Layout/App Shell/Minimal` for the primitive; a truthful attribution dataset.

- [ ] **Step 1: Retitle the primitive's story**

In `packages/ui/src/components/app-shell/app-shell.stories.tsx`, change `title: "Layout/App Shell/Basic"` to `title: "Layout/App Shell/Minimal"`. The component itself is **unchanged** (R7) — it remains the honest answer for a simple layout. Update its description to say so, and to point at `Basic` for the full console.

- [ ] **Step 2: Check every docs cross-link still resolves**

Run: `pnpm docs-links:check && pnpm storybook-groups:check`
Expected: PASS. Story ids derive from titles, so a retitle 404s every link that named the old one; this gate is what catches it.

- [ ] **Step 3: Decide the blocks.so entry honestly**

Read the three rebuilt blocks. If nothing recognisable from blocks.so survives, **delete** the `blocks-so` entry from `scripts/attributions.sources.json` — a credit for something we no longer ship overstates what the product contains. If a layout skeleton or naming survives, keep the entry and rewrite its `note` to say exactly what remains. Do not guess; read the old source in git history and compare.

- [ ] **Step 4: Regenerate and check**

Run: `pnpm gen:attributions && pnpm attributions:check && pnpm attribution:provenance:check`
Expected: PASS. The provenance gate fails if any shipped source still says "adapted from blocks.so" while the entry is gone — so the two halves must move together.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/app-shell/app-shell.stories.tsx scripts/attributions.sources.json ATTRIBUTION.md packages/ui/src/components/attribution-panel
git commit -m "docs: the AppShell primitive becomes Minimal, and blocks.so attribution matches what ships"
```

---

### Task 19: Full battery, reviewers, and the derived-artifact cascade

**Files:**

- Modify: `brand-ui.manifest.json`, `registry/registry.json`, `component-inventory.md`, `llms.txt`, `apps/docs/public/brand-ui-context.md`, the `pnpm gen` regions, `CHANGELOG.md`

**Interfaces:**

- Consumes: every prior task.
- Produces: a mergeable branch.

- [ ] **Step 1: Regenerate everything derived**

```bash
pnpm gen:registry && pnpm manifest && pnpm agent-docs && pnpm gen:attributions
```

- [ ] **Step 2: Add the Layer B changelog entry**

One `## Unreleased` entry describing what a consumer gets: four rebuilt app-shell blocks, the three moved out of the component package, and the story names that changed.

- [ ] **Step 3: Run the whole battery**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm registry:validate && pnpm registry:resolve:check && pnpm gen:registry:check
pnpm docs:check && pnpm docs-links:check && pnpm storybook-groups:check
pnpm story-descriptions:check && pnpm text-scale:check && pnpm microtypography:check
pnpm separation:check && pnpm loading-states:check && pnpm variants:check && pnpm data-slot:check
pnpm components:check && pnpm manifest:check && pnpm changelog-entry:check
pnpm a11y:baseline:check && pnpm attributions:check && pnpm attribution:provenance:check
```

Expected: all green. A ratchet that moved **up** is a defect introduced by this work.

- [ ] **Step 4: Run the full Storybook suite in both themes**

```bash
pnpm --filter @elabs-ai/components-docs test-storybook
cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run
```

Expected: PASS in both. CI pins no theme, so the dark run is the only place a dark-only failure surfaces — cite the theme slug in the report, never "both themes".

- [ ] **Step 5: Run the reviewers on all four shells, cross-theme**

Dispatch `brand-ui-visual-ux-reviewer` and `brand-ui-accessibility-reviewer` over `Layout/App Shell/*` in `light` and `dark`. They report; they do not edit. Every finding goes through `/file-issue`.

- [ ] **Step 6: Commit and open the PR**

```bash
git add -A
git commit -m "chore: regenerate derived artifacts for the app-shell rebuild"
gh pr create --title "App shell blocks: four designed shells on repaired primitives" --body-file <path>
```

The PR body cites the spec, this plan, the issues closed (R1, R2, R8), and the exact story ids + theme slugs observed.

---

## Self-Review

**Spec coverage.** §4.4 R1 → Task 3 · R2 → Task 4 · R3 → Task 5 · R4 → Task 6 · R5a → Task 10 · R5b → Task 9 · R6 → Task 7 · R7 → Task 18 · R8 → Tasks 1 and 8 · R9 → Task 13. §4.2 placement/naming → Task 12 (move) and Tasks 13-17 (rebuild). §4.3 router-agnostic contract → Task 13. §4.5 flagship → Tasks 13-14. §4.6 supporting shells → Tasks 15-17. §4.7 state grid → the story steps of Tasks 13-17. §5 verification → Tasks 11 and 19. §6's attribution risk → Task 18. The architect gate the spec requires before R5a/R5b/R8 → Task 2.

**Deliberately deferred, and named in the spec as such:** re-basing `@elabs-ai/components-ai`'s `ContextPanel` on `ContextRail`. It is a cross-package API change and gets its own work.

**Open naming decision, unresolved by this plan:** the flagship keeps the story name `Basic` per the owner's wording, though it is the richest of the four. `Console` or `Workbench` reads better. Changing it is a one-line edit in Task 14's story file and can be taken at any point before Task 19.

**Type consistency check.** `isPathActive(itemHref, activePath)` is defined in Task 13 and used with that exact signature in Tasks 13, 15, 16, 17 (copied, not imported — blocks are copy-own). `shellStyle(state)` and `ShellState` are defined once in Task 13. `ContextRailSection` / `ContextRailProps` (Task 9) and `SideDockProps` (Task 10) are used unchanged in Tasks 14 and 17. `PageShellProps.scroll` values `"body" | "content" | "fill"` are consistent between Task 7's implementation and Task 14's use of `"fill"`. `SidebarInset`'s `gutter` values are consistent between Task 8 and Tasks 13, 15, 16, 17.
