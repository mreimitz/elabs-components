import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";

afterEach(cleanup);

function renderMenu() {
  render(
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#">Analytics</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>,
  );
}

describe("NavigationMenuTrigger", () => {
  /**
   * Residual of #54 (issue #85). `userEvent.click()` — like a real mouse click
   * — synthesizes a pointer move onto the trigger before the click itself,
   * which arms `@radix-ui/react-navigation-menu`'s root-level hover-intent
   * open timer (`openTimerRef`, default `delayDuration` 200ms). Neither the
   * click-open path (`onItemSelect`) nor any dismiss path (Escape /
   * outside-click / focus-out, all funnelled through one
   * `ROOT_CONTENT_DISMISS` handler) clears that timer, so — left unpatched —
   * it fires ~200ms later and silently reopens the panel even though the user
   * already dismissed it.
   *
   * Fake timers are load-bearing here, not incidental: asserting
   * `aria-expanded` immediately after Escape passes on the UNPATCHED wrapper
   * too, because the stray timer has not fired yet. The lock only means
   * anything once the assertion runs from INSIDE the delay window.
   */
  it("does not spontaneously reopen after Escape dismisses it inside the hover-intent delay window", async () => {
    // `shouldAdvanceTime` keeps the fake clock ticking in step with real time
    // (in addition to responding to explicit `advanceTimersByTime` calls)
    // so React's own scheduler — which falls back to a real `setTimeout` for
    // its internal flush in this jsdom environment — is never left waiting
    // on a fake timer nothing ever advances; plain `vi.useFakeTimers()` here
    // hangs `userEvent.click()` indefinitely for exactly that reason.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      renderMenu();
      const trigger = screen.getByRole("button", { name: /products/i });

      // Deliberately the opposite of #54's story-level unhover() workaround:
      // hover-then-click with NO intervening pointer-leave, so the real
      // click-then-dismiss sequence is exercised instead of routed around it.
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      // Advance past delayDuration (200ms) + a margin so the stray timer, if
      // still armed, fires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Acceptance criterion from #85: the fix must not regress ordinary
   * click-to-toggle behaviour into the "menu never opens" failure mode hit by
   * an earlier, abandoned `delayDuration={0}` attempt. Several rapid
   * open/close/open cycles, entirely via click (no hover), must all still
   * land the menu in the expected state.
   */
  it("still opens and closes normally across rapid repeated click cycles", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: /products/i });

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  /**
   * Fix-round-1 regression (validator finding): a synthetic pointer-leave
   * dispatched on every click — the first attempt at fixing #85 — runs
   * Radix's real `onTriggerLeave`, which does two things, not one: it clears
   * the stray open timer (wanted) AND unconditionally arms Radix's 150ms
   * close timer (`startCloseTimer`/`closeTimerRef`, unwanted) via
   * `context.onTriggerLeave` (`@radix-ui/react-navigation-menu@1.2.14 and
   * 1.2.22`'s index.mjs, root `onTriggerLeave`). Since a click-opened menu
   * never gets a real pointerenter on its content, nothing ever clears that
   * close timer, so it silently closes itself ~150ms after every click-open
   * unless the mouse happens to move onto the panel — breaking keyboard and
   * touch entry entirely, and any mouse user who pauses before reaching the
   * panel. This test opens the menu via click and asserts it is STILL OPEN
   * well past that delay with no further pointer interaction at all.
   */
  it("stays open past the close-timer delay when opened by click with no further pointer movement", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      renderMenu();
      const trigger = screen.getByRole("button", { name: /products/i });

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Advance well past both Radix's 150ms close-timer delay and its
      // 200ms open-timer delay, with no further interaction of any kind.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(trigger).toHaveAttribute("aria-expanded", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Fix-round-1 requirement: the guard against #85's stray reopen must be
   * scoped to genuine, still-hovering pointer dismissals — it must never
   * interfere with a pure keyboard sequence (no mouse involved at all).
   * Opening and dismissing via keyboard alone must behave exactly as an
   * unpatched menu would: the panel closes on Escape, focus returns to the
   * trigger (Radix's own `triggerRef.current?.focus()` on dismiss), and
   * nothing reopens it afterward.
   */
  it("keyboard: Escape dismisses, returns focus to the trigger, and does not reopen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      renderMenu();
      const trigger = screen.getByRole("button", { name: /products/i });

      act(() => {
        trigger.focus();
      });
      await user.keyboard("{Enter}");
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });
});
