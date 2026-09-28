import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { useThemeTransition } from "./use-theme-transition";
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function Buttons() {
  const change = useThemeTransition();
  return (
    <>
      <button onClick={() => change("dark")}>Dark</button>
      <button onClick={() => change("light")}>Light</button>
    </>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
  delete document.documentElement.dataset.vt;
  delete document.documentElement.dataset.vtEffect;
  localStorage.clear();
});
it("an older transition cannot clear the newer transition's direction", async () => {
  const first = deferred(),
    second = deferred();
  const start = vi
    .fn()
    .mockImplementationOnce((callback: () => void) => {
      callback();
      return { finished: first.promise };
    })
    .mockImplementationOnce((callback: () => void) => {
      callback();
      return { finished: second.promise };
    });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
  render(
    <ThemeProvider defaultTheme="light">
      <Buttons />
    </ThemeProvider>,
  );
  act(() => screen.getByText("Dark").click());
  act(() => screen.getByText("Light").click());
  expect(start).toHaveBeenCalledTimes(2);
  await act(async () => first.resolve());
  expect(document.documentElement.dataset.vt).toBe("to-light");
  await act(async () => second.resolve());
  expect(document.documentElement.dataset.vt).toBeUndefined();
});
it("a rejected transition cleans up without an unhandled rejection", async () => {
  const pending = deferred();
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (callback: () => void) => {
      callback();
      return { finished: pending.promise };
    },
  });
  render(
    <ThemeProvider defaultTheme="light">
      <Buttons />
    </ThemeProvider>,
  );
  act(() => screen.getByText("Dark").click());
  await act(async () => pending.reject(new Error("Transition skipped")));
  expect(document.documentElement.dataset.vt).toBeUndefined();
});
