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
   * Acceptance criterion from #85: the fix (cancelling the stray timer via a
   * synthetic pointer-leave dispatched on every click) must not regress
   * ordinary click-to-toggle behaviour into the "menu never opens" failure
   * mode hit by an earlier, abandoned `delayDuration={0}` attempt. Several
   * rapid open/close/open cycles, entirely via click (no hover), must all
   * still land the menu in the expected state.
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
});
