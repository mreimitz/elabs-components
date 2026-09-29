import { useLayoutEffect, type RefObject } from "react";

/** Share measured room with the legend and navigation. When a full control row cannot
 * fit between them, lift the caption above the overlapping panels instead of covering them. */
export function useStoryRoom(surface: RefObject<HTMLDivElement | null>, visible: boolean) {
  useLayoutEffect(() => {
    const element = surface.current;
    const host =
      element?.closest<HTMLElement>("[data-lens-chrome]") ??
      element?.closest<HTMLElement>(".react-flow");
    if (!element || !host || !visible) return;
    const observed = new Set<HTMLElement>();
    const measure = () => {
      const box = host.getBoundingClientRect();
      if (!box.width) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const center = box.left + box.width / 2;
      const ownPanel = element.closest(".react-flow__panel");
      const panels = [...host.querySelectorAll<HTMLElement>(".react-flow__panel.bottom")].filter(
        (panel) => panel !== ownPanel,
      );
      for (const previous of observed) {
        if (!panels.includes(previous)) {
          observer.unobserve(previous);
          observed.delete(previous);
        }
      }
      for (const panel of panels) {
        if (!observed.has(panel)) {
          observed.add(panel);
          observer.observe(panel);
        }
      }
      const sides = panels
        .map((panel) => ({ panel, rect: panel.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
      let half = box.width / 2 - rem;
      for (const { panel, rect } of sides) {
        if (!panel.classList.contains("left") && !panel.classList.contains("right")) continue;
        half = Math.min(
          half,
          panel.classList.contains("left") ? center - rect.right - 8 : rect.left - center - 8,
        );
      }
      const width = Math.min(
        32 * rem,
        Math.max(0, box.width - 2 * rem),
        half * 2 >= 20 * rem ? half * 2 : Infinity,
      );
      let bottom = 0;
      for (const { rect } of sides) {
        if (rect.right > center - width / 2 && rect.left < center + width / 2) {
          // Panel has its own bottom margin; this margin is inside that panel.
          const margin = parseFloat(getComputedStyle(element.parentElement!).marginBottom) || 0;
          bottom = Math.max(bottom, box.bottom - rect.top + 8 - margin);
        }
      }
      const set = (name: string, value: number) => {
        const rounded = `${Math.round(value * 100) / 100}px`;
        if (element.style.getPropertyValue(name) !== rounded)
          element.style.setProperty(name, rounded);
      };
      set("--story-room", width);
      set("--story-bottom", bottom);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(element);
    // Legend panels may mount after the initial graph or be replaced when opened.
    // Observe membership only; our CSS-variable writes cannot feed this observer back.
    const membership = new MutationObserver(measure);
    membership.observe(host, { childList: true, subtree: true });
    measure();
    return () => {
      observer.disconnect();
      membership.disconnect();
    };
  }, [surface, visible]);
}
