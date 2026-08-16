import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Calendar } from "./calendar";
import { Default as DefaultCalendarStory } from "./calendar.stories";

/** Class list of an element, safe for SVG (whose `className` is not a string). */
function classes(el: Element) {
  return (el.getAttribute("class") ?? "").split(/\s+/);
}

/** Walks up from `el` looking for a `relative` ancestor at or below `root`. */
function hasPositionedAncestorWithin(el: Element, root: Element) {
  let node = el.parentElement;
  while (node) {
    if (classes(node).includes("relative")) return true;
    if (node === root) return false;
    node = node.parentElement;
  }
  return false;
}

describe("Calendar", () => {
  it("renders a month grid", () => {
    render(<Calendar mode="single" />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("renders both month-navigation buttons", () => {
    render(<Calendar mode="single" />);
    expect(screen.getByRole("button", { name: /previous month/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next month/i })).toBeInTheDocument();
  });

  // react-day-picker v9 renders <nav> as a SIBLING of the month (not inside the
  // caption, as v8 did). Any absolutely-positioned part must therefore be anchored
  // by a `relative` ancestor INSIDE the calendar — otherwise it escapes to whatever
  // positioned ancestor the page happens to have, and the nav buttons fly to the
  // corners of the viewport / popover.
  it("anchors every absolutely-positioned part inside the calendar", () => {
    const { container } = render(<Calendar mode="single" />);
    const root = container.firstElementChild as HTMLElement;
    const absolute = [...root.querySelectorAll("*")].filter((el) =>
      classes(el).includes("absolute"),
    );

    expect(absolute.length).toBeGreaterThan(0);
    for (const el of absolute) {
      expect(hasPositionedAncestorWithin(el, root)).toBe(true);
    }
  });

  it("keeps the navigation in the caption row, not in the page flow above it", () => {
    const { container } = render(<Calendar mode="single" />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    // The nav overlays the caption row; the buttons themselves stay in normal
    // flow inside it, so they can never be positioned against an outside ancestor.
    expect(nav?.className).toContain("absolute");
    for (const button of nav?.querySelectorAll("button") ?? []) {
      expect(classes(button)).not.toContain("absolute");
    }
  });
});

// #430 — `forms-calendar--default` used to seed its selected day from
// `new Date()`, so the calendar cell axe scored for `color-contrast` had 1
// character on days 1-9 and 2 characters on days 10-31 of the *host machine's*
// calendar. axe-core's `color-contrast` rule reports single-character text as
// `incomplete` (`shortTextContent`) rather than scoring it, and `incomplete`
// results never fail `toHaveNoViolations()` — so the story was red on ~22 days
// a month and green on ~9, entirely independent of any code change.
//
// This lock renders the STORY's actual `Default.render()` output (not a
// hand-rolled `<Calendar>`) under two faked system clocks, so it fails against
// the pre-fix story (whose `selected` tracked `new Date()`) and passes once
// the story pins `selected`/`defaultMonth` instead. It proves the fixture is
// what it claims to be: (a) genuinely independent of the wall clock, and (b)
// pinned to a TWO-digit day specifically, so the a11y assertion stays capable
// of failing rather than being silently routed into axe's unscoreable-text
// path. The real, accepted 4.31:1 ink pair this cell renders
// (`--primary-foreground` on `--primary`, qlik-bright) is `INK_EXEMPT` in
// `packages/tokens/src/themes-contrast.test.ts` (#180) — fixing that colour is
// explicitly out of scope here.
describe("Calendar — story fixture is clock-independent (#430)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // CSF3 story `render` fns are typed `(args, context) => ReactNode`, but this
  // one (like most in this repo) ignores both, calls `useState`, and reads only
  // component state — i.e. it has the exact shape of a function component. It
  // must be mounted as JSX (`<StoryComponent />`), not invoked directly:
  // calling it as a plain function runs its hooks outside of React's render
  // cycle ("Invalid hook call"), since Storybook itself always mounts `render`
  // through the same component tree, never calls it as a helper.
  const StoryComponent = DefaultCalendarStory.render as unknown as () => ReactElement;

  function renderDefaultCalendarStory() {
    const { container } = render(<StoryComponent />);
    const scope = within(container);
    const caption = scope.getByRole("status");
    const selectedCell = container.querySelector('[role="gridcell"][aria-selected="true"]');
    const selectedButton = selectedCell?.querySelector("button") ?? null;

    return {
      captionText: caption.textContent,
      selectedAriaLabel: selectedButton?.getAttribute("aria-label") ?? null,
      selectedDayText: selectedButton?.textContent ?? "",
    };
  }

  it("renders identically whether the system clock reads a single- or a two-digit day", () => {
    // Neither faked date is the pinned selected day (2026-08-17) itself — react-day-picker
    // legitimately prefixes the selected cell's aria-label with "Today, " when the
    // system clock's date happens to match it, which is correct "today" behavior, not
    // the bug under test. Picking two dates that are never "today" isolates the thing
    // this lock exists to catch: the rendered day/caption tracking the clock at all.
    vi.setSystemTime(new Date(2026, 7, 5)); // single-digit "today" — must not matter
    const fromSingleDigitToday = renderDefaultCalendarStory();

    vi.setSystemTime(new Date(2026, 10, 10)); // two-digit "today", different month — must not matter either
    const fromTwoDigitToday = renderDefaultCalendarStory();

    expect(fromTwoDigitToday.captionText).toBe(fromSingleDigitToday.captionText);
    expect(fromTwoDigitToday.selectedAriaLabel).toBe(fromSingleDigitToday.selectedAriaLabel);
    expect(fromTwoDigitToday.selectedDayText).toBe(fromSingleDigitToday.selectedDayText);
  });

  // The load-bearing assertion: the check above alone would still pass if
  // someone "fixed" the flake by pinning the selected day to the 5th instead
  // of the 17th — two renders of a single-digit day also match each other.
  // Only this digit-count check catches that regression.
  it("pins the selected day's rendered text to 2+ digits (10-31), not 1", () => {
    vi.setSystemTime(new Date(2026, 7, 5));
    const { selectedDayText } = renderDefaultCalendarStory();

    expect(selectedDayText.length).toBeGreaterThanOrEqual(2);
  });
});
