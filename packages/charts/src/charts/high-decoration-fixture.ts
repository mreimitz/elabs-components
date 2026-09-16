import { vi } from "vitest";

/**
 * Test-only: make `useHighDecoration()` / `useHighDecorationOf()` read a high
 * `--decoration` (ADR 0011) in jsdom, which cannot resolve the registered
 * `@property`. Every other computed-style read is passed through to jsdom's real
 * implementation, so text measurement and layout code keep working.
 *
 * Returns the spy; restore it with `vi.restoreAllMocks()` (or `spy.mockRestore()`).
 */
export function stubHighDecoration(level = "10") {
  const real = window.getComputedStyle.bind(window);
  return vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((element: Element, pseudo?: string | null) => {
      const style = real(element, pseudo);
      return new Proxy(style, {
        get(target, prop) {
          if (prop === "getPropertyValue") {
            return (name: string) =>
              name === "--decoration" ? level : target.getPropertyValue(name);
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
}

/** `<pattern>` elements the series-pattern channel injected (`bp-series-*`). */
export function seriesPatterns(container: Element): Element[] {
  return Array.from(container.querySelectorAll('pattern[id^="bp-series-"]'));
}

/** Elements whose `fill` references a series pattern. */
export function seriesPatternFills(container: Element, selector = "[fill]"): Element[] {
  return Array.from(container.querySelectorAll(selector)).filter((el) =>
    (el.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
  );
}
