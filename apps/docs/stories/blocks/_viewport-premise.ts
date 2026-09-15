/**
 * Shared guard for the "premise, measured" pattern used by every breakpoint
 * lock in this folder (`app-shell`, `sidebar-04`, `sidebar-05`): a play
 * function that declares `globals: { viewport: {...} }` starts by asserting
 * `window.innerWidth`/`matchMedia` actually reflect that viewport, because
 * everything after it only means something on the intended side of the
 * breakpoint.
 *
 * Under `@storybook/addon-vitest` (`pnpm --filter @elabs-ai/components-docs
 * test-storybook`, or `run-story-tests`) that premise always holds — each
 * story gets its own real browser page sized to its own `globals.viewport`.
 * The SAME play function also runs live whenever a person (or the
 * `preview-stories` MCP tool) opens the story in the Storybook manager
 * without also applying that viewport, and can be reached from a backgrounded
 * browser tab where the resize/matchMedia listeners that make the viewport
 * real are throttled or paused. In both of those cases the premise is false
 * for a reason that has nothing to do with the component under test — a hard
 * `expect(...).toBe(...)` there is a false failure ("expected 1280 to be less
 * than 768"), not a caught regression.
 *
 * `holdsViewportPremise` turns that into a graceful no-op: it still measures
 * and still warns (so a genuinely broken viewport global is visible in the
 * log), but callers early-`return` on `false` instead of throwing, since every
 * assertion after it would be re-measuring the wrong branch.
 */
export function holdsViewportPremise(holds: boolean, expected: string): boolean {
  if (!holds) {
    console.warn(
      `[story] viewport premise unmet (expected ${expected}, measured window.innerWidth=` +
        `${window.innerWidth}) — running outside this story's declared viewport ` +
        "(opened without it, or in a backgrounded tab); skipping the rest of this play function.",
    );
  }
  return holds;
}

/**
 * Same idea for a `.focus()`-driven assertion. A REAL user gesture
 * (`userEvent.click`/`userEvent.tab`) moves `document.activeElement`
 * regardless of whether the browser window itself has OS-level focus, but a
 * bare imperative `el.focus()` call does not: a backgrounded tab (or a
 * preview opened without ever gaining window focus) leaves
 * `document.hasFocus()` false, and Chromium then leaves
 * `document.activeElement` on `<body>` instead of moving it — a false
 * failure in the play function, not a regression in the component.
 *
 * Call AFTER the `.focus()` call it is guarding; callers early-`return` on
 * `false` since every assertion after it would be measuring a focus state
 * that was never given the chance to move.
 */
export function holdsFocusPremise(description: string): boolean {
  const holds = document.hasFocus();
  if (!holds) {
    console.warn(
      `[story] document.hasFocus() is false — running in a backgrounded tab or a preview ` +
        `that never gained window focus, so the imperative .focus() call behind "${description}" ` +
        "could not move document.activeElement; skipping the rest of this play function.",
    );
  }
  return holds;
}
