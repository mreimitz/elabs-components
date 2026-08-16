import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  ThemeProvider,
} from "@elabs/components-tokens";

import { ThemeSwitcher } from "./theme-switcher";

const SYSTEM_STORAGE_KEY = "brand-ui-theme-system";

function setup(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitcher", () => {
  it("renders a toggle button for a 2-theme pair", () => {
    setup(<ThemeSwitcher themes={["light", "dark"]} />);
    expect(screen.getByRole("button", { name: /theme:/i })).toBeInTheDocument();
  });

  it("cycles the theme on click (jsdom has no startViewTransition → instant setTheme)", async () => {
    setup(<ThemeSwitcher themes={["light", "dark"]} showSystem={false} />);
    await userEvent.click(screen.getByRole("button", { name: /theme:/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  // The >2-themes AUTO-upgrade can't be exercised while only two themes ship
  // (a paused one is out of BUILT_IN_THEMES), so this pins the explicit dropdown mode —
  // the same render path the auto-upgrade selects.
  it("renders a dropdown trigger in dropdown mode", () => {
    setup(<ThemeSwitcher mode="dropdown" themes={[...BUILT_IN_THEMES]} />);
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });
});

describe("ThemeSwitcher — controlled preference (#366)", () => {
  it("renders the current preference from the caller's state and reports every pick, writing no localStorage", async () => {
    const onPreferenceChange = vi.fn();
    setup(
      <ThemeSwitcher
        themes={["light", "dark"]}
        showSystem={false}
        preference="light"
        onPreferenceChange={onPreferenceChange}
      />,
    );
    const btn = screen.getByRole("button", { name: /theme: light/i });
    await userEvent.click(btn);
    expect(onPreferenceChange).toHaveBeenCalledTimes(1);
    expect(onPreferenceChange).toHaveBeenCalledWith("dark");
    expect(window.localStorage.getItem(SYSTEM_STORAGE_KEY)).toBeNull();
  });

  it('picking a theme from a "system" preference reports the resolved ThemeName, not "system"', async () => {
    const onPreferenceChange = vi.fn();
    setup(
      <ThemeSwitcher
        themes={["light", "dark"]}
        preference="system"
        onPreferenceChange={onPreferenceChange}
      />,
    );
    // order is [light, dark, system]; "system" cycles to "light".
    const btn = screen.getByRole("button", { name: /theme: system/i });
    await userEvent.click(btn);
    expect(onPreferenceChange).toHaveBeenCalledTimes(1);
    expect(onPreferenceChange).toHaveBeenCalledWith("light");
    expect(window.localStorage.getItem(SYSTEM_STORAGE_KEY)).toBeNull();
  });

  it("the view-transition setter still fires in controlled mode (the theme visibly applies)", async () => {
    const onPreferenceChange = vi.fn();
    setup(
      <ThemeSwitcher
        themes={["light", "dark"]}
        showSystem={false}
        preference="light"
        onPreferenceChange={onPreferenceChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /theme: light/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("uncontrolled usage (no preference prop) is unchanged: it still tracks its own localStorage key", async () => {
    setup(<ThemeSwitcher themes={["light", "dark"]} showSystem={false} />);
    await userEvent.click(screen.getByRole("button", { name: /theme:/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(SYSTEM_STORAGE_KEY)).toBe("0");
  });
});

describe("ThemeSwitcher — provider-scoped themes (#384)", () => {
  it("never renders a theme the provider disallows, even when the themes prop lists it", async () => {
    render(
      <ThemeProvider allowedThemes={["light", "dark"]}>
        <ThemeSwitcher mode="dropdown" themes={[...BUILT_IN_THEMES]} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByText(/blueprint/i)).not.toBeInTheDocument();
    expect(within(menu).getByText("Light")).toBeInTheDocument();
    expect(within(menu).getByText("Dark")).toBeInTheDocument();
  });

  it("no rendered control ever applies the disallowed theme (menu items + System)", async () => {
    render(
      <ThemeProvider allowedThemes={["light", "dark"]}>
        <ThemeSwitcher mode="dropdown" themes={[...BUILT_IN_THEMES]} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    const darkItem = await screen.findByRole("menuitem", { name: /dark/i });
    await userEvent.click(darkItem);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    const systemItem = await screen.findByRole("menuitem", { name: /system/i });
    await userEvent.click(systemItem);
    expect(["light", "dark"]).toContain(document.documentElement.getAttribute("data-theme"));
  });

  it("an empty intersection (themes prop entirely disallowed) falls back to the provider's list, never the disallowed prop", async () => {
    render(
      <ThemeProvider allowedThemes={["light"]}>
        <ThemeSwitcher mode="dropdown" themes={["dark"]} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByText("Dark")).not.toBeInTheDocument();
    expect(within(menu).getByText("Light")).toBeInTheDocument();
  });

  it("BACKWARD COMPAT: a default <ThemeSwitcher /> under a non-restricting provider renders exactly today's toggle, not a dropdown", () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    // The default 2-theme toggle presentation — never upgraded to a dropdown by
    // provider.themes (which is the full built-in registry when no
    // allowedThemes is set).
    expect(screen.getByRole("button", { name: /theme:/i })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("BACKWARD COMPAT: an explicit 2-theme pair under a non-restricting provider is unaffected", async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher themes={["light", "dark"]} showSystem={false} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /theme:/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

/**
 * The switcher renders the PROVIDER's registry (ADR 0029). Before this it
 * defaulted to a hard-coded `["light","dark"]` pair, so an app that registered
 * its own themes got a switcher that could not reach them — and, worse, a
 * switcher whose `light`/`dark` fallbacks named themes that app may not ship at
 * all. These drive consumer theme names end to end: label, iconography, the
 * auto-upgrade to a dropdown, and what "System" resolves to.
 */
describe("ThemeSwitcher — consumer themes (ADR 0029)", () => {
  const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });
  const parchment = defineTheme({ value: "parchment", label: "Parchment", dark: false });

  it("offers the provider's consumer themes with NO themes prop at all", async () => {
    render(
      <ThemeProvider themes={[parchment, midnight]} defaultTheme="parchment">
        <ThemeSwitcher mode="dropdown" />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Parchment")).toBeInTheDocument();
    expect(within(menu).getByText("Midnight")).toBeInTheDocument();
    // The old hard-coded default pair is not silently in the list.
    expect(within(menu).queryByText("Light")).not.toBeInTheDocument();
  });

  it("applies a consumer theme when picked", async () => {
    render(
      <ThemeProvider themes={[parchment, midnight]} defaultTheme="parchment">
        <ThemeSwitcher mode="dropdown" />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /midnight/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
  });

  it("auto-upgrades to a dropdown once the registry passes two themes", async () => {
    render(
      <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]}>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    // Three registered themes → the dropdown trigger, not the cycle toggle.
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /theme:/i })).not.toBeInTheDocument();
  });

  it("announces the consumer theme's OWN label in toggle mode, never a name the app lacks", async () => {
    render(
      <ThemeProvider themes={[parchment, midnight]} defaultTheme="parchment">
        <ThemeSwitcher showSystem={false} />
      </ThemeProvider>,
    );
    // The pre-0029 code labelled the roles ("Theme: light"), naming a theme this
    // app does not ship.
    const button = screen.getByRole("button", { name: /theme:/i });
    expect(button).toHaveAccessibleName(/Theme: Parchment\. Activate to switch to Midnight\./i);
    await userEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
  });

  it('resolves "System" to a registered theme of the right darkness, not to "light"/"dark"', async () => {
    render(
      <ThemeProvider themes={[parchment, midnight]} defaultTheme="parchment">
        <ThemeSwitcher mode="dropdown" />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Theme" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /system/i }));
    // jsdom's matchMedia stub reports no dark preference, so the light-side
    // registry entry wins — the point is that it is a REGISTERED name.
    expect(["parchment", "midnight"]).toContain(
      document.documentElement.getAttribute("data-theme"),
    );
  });
});
