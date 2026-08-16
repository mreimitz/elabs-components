import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  ThemeProvider,
} from "@elabs-ai/components-tokens";

import { ThemeSwitcher, type ThemePreference } from "./theme-switcher";

const meta = {
  title: "Core/ThemeSwitcher",
  component: ThemeSwitcher,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div className="flex min-h-32 items-center justify-center">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    mode: {
      description: "Force presentation mode; `auto` picks toggle vs dropdown by theme count.",
      control: "inline-radio",
      options: ["auto", "toggle", "dropdown"],
      table: { category: "Behavior" },
    },
    effect: {
      description: "Whole-screen reveal animation used when switching themes.",
      control: { type: "select" },
      options: ["polygon", "circle", "circle-blur", "triangle"],
      table: { category: "Appearance" },
    },
    size: {
      description: "Button size of the trigger.",
      control: "inline-radio",
      options: ["sm", "default", "lg"],
      table: { category: "Appearance" },
    },
    showSystem: {
      description: 'Whether to offer a "System" option that follows the OS color scheme.',
      control: "boolean",
      table: { category: "Behavior" },
    },
    themes: {
      description: "Theme names to offer. ≤2 → toggle; >2 → dropdown.",
      control: false,
      table: { category: "Behavior" },
    },
  },
} satisfies Meta<typeof ThemeSwitcher>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Default: the built-in light/dark pair → a cycling light / dark / system toggle. */
export const Toggle: Story = {
  play: async ({ canvas }) => {
    // The toggle button is present and has an accessible label describing the cycle action.
    const btn = canvas.getByRole("button", { name: /theme/i });
    await expect(btn).toBeInTheDocument();
    await expect(btn).toHaveAttribute("aria-label");
  },
};

/** Dropdown mode — the list form. (More than two themes picks this automatically.) */
export const Dropdown: Story = { args: { mode: "dropdown", themes: [...BUILT_IN_THEMES] } };

/** Toggle without the System option (light / dark only). */
export const ToggleNoSystem: Story = { args: { showSystem: false } };

/** A custom (non-default) theme pair. ≤2 themes still toggle instead of a dropdown. */
export const CustomPair: Story = { args: { themes: ["dark", "light"] } };

/**
 * Controlled mode (#366): the caller owns the preference — including
 * "system" — via `preference`/`onPreferenceChange` instead of the switcher's
 * own `localStorage`-backed state, e.g. a settings panel synced to a server.
 * The label below reflects the plain `useState` living OUTSIDE `ThemeSwitcher`.
 */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [preference, setPreference] = useState<ThemePreference>("system");
    return (
      <div className="flex flex-col items-center gap-2">
        <ThemeSwitcher {...args} preference={preference} onPreferenceChange={setPreference} />
        <p className="text-caption text-muted-foreground">Preference: {preference}</p>
      </div>
    );
  },
  args: { themes: ["light", "dark"] },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Preference: system")).toBeInTheDocument();
    const trigger = canvas.getByRole("button", { name: /theme: system/i });
    await userEvent.click(trigger);
    // "system" cycles to "light" (light) — the caller's own state updates,
    // and the switcher renders straight from it (never its own storage key).
    await expect(canvas.getByText("Preference: light")).toBeInTheDocument();
  },
};

/**
 * When a `ThemeProvider` restricts `allowedThemes` (#355), the switcher
 * automatically narrows to that subset (#384). The provider below registers a
 * THIRD theme on top of the two reference ones and then allows only Light and
 * Dark — so the narrowing is observable: `Drafting` is unreachable via any menu
 * item, "System", or the OS `prefers-color-scheme` listener. The nested
 * `ThemeProvider` overrides this file's meta-level (unrestricted) one, since
 * `useTheme()` always reads the nearest ancestor.
 */
const draftingTheme = defineTheme({ value: "drafting", label: "Drafting", dark: false });
const RESTRICTED_REGISTRY = [...BUILT_IN_THEME_DEFINITIONS, draftingTheme];

export const RestrictedProvider: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider
        themes={RESTRICTED_REGISTRY}
        allowedThemes={["light", "dark"]}
        storageKey={null}
      >
        <div className="flex min-h-32 items-center justify-center">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  args: { mode: "dropdown", themes: RESTRICTED_REGISTRY.map((t) => t.value) },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: "Theme" });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const dark = await body.findByRole("menuitem", { name: /dark/i });
    await waitFor(() => expect(dark).toBeVisible());
    await expect(body.queryByText(/drafting/i)).not.toBeInTheDocument();
    // Close the menu so the story doesn't end mid-interaction (portaled content
    // still open at test-end confuses the a11y pass on the surrounding page).
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
  },
};
