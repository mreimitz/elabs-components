import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { expect, waitFor, within } from "storybook/test";
import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import { Button } from "../button";
import { DialogTitle } from "../dialog";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";
const meta = {
  title: "Overlays/Command",
  component: Command,
  tags: ["autodocs"],
  argTypes: {
    label: {
      description: "Accessible label for the command palette (cmdk `label` prop).",
      control: "text",
      table: { category: "Accessibility" },
    },
    filter: {
      description: "Custom ranking function for filtering items (overrides fuzzy default).",
      control: false,
      table: { category: "Behaviour" },
    },
    shouldFilter: {
      description: "Whether cmdk filters items by the current search value. Default true.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    loop: {
      description: "Whether keyboard navigation wraps from last item back to first.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Command className="w-72 rounded-lg shadow-ring-md">
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>New project</CommandItem>
          <CommandItem>Open settings</CommandItem>
          <CommandItem>Invite teammate</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
  // Types a search query and confirms filtering works; then clears to see all items.
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Type a command…");
    await waitFor(() => expect(input).toBeVisible());
    // Filter to "settings"
    await userEvent.type(input, "settings");
    await waitFor(() => expect(canvas.getByText("Open settings")).toBeVisible());
    // "New project" should be filtered out
    await expect(canvas.queryByText("New project")).toBeNull();
    // Clear filter — all items return
    await userEvent.clear(input);
    await waitFor(() => expect(canvas.getByText("New project")).toBeVisible());
  },
};

/* -------------------------------------------------------------------------- */
/*  Command Dialog (⌘K palette)                                                */
/* -------------------------------------------------------------------------- */

/** The ⌘K command palette: a `CommandDialog` toggled by a shortcut or a button. */
function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = () => setOpen(false);

  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <p className="text-body text-muted-foreground">
        Press{" "}
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-meta" translate="no">
          ⌘ K
        </kbd>{" "}
        or use the button.
      </p>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open command palette
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        {/* CommandDialog doesn't ship a built-in title, so supply an sr-only one
            for the dialog's accessible name. */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={run}>
              <Calendar />
              Calendar
            </CommandItem>
            <CommandItem onSelect={run}>
              <Smile />
              Search emoji
            </CommandItem>
            <CommandItem onSelect={run}>
              <Calculator />
              Calculator
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={run}>
              <User />
              Profile
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run}>
              <CreditCard />
              Billing
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run}>
              <Settings />
              Settings
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

/** A ⌘K command palette in a dialog, opened by shortcut or button. */
export const Palette: Story = {
  name: "Command Dialog (⌘K)",
  render: () => <CommandPaletteDemo />,
};

/* -------------------------------------------------------------------------- */
/*  Groups, icons, shortcuts & separators                                      */
/* -------------------------------------------------------------------------- */

/** An inline menu with grouped items, leading icons, separators and shortcuts. */
export const Groups: Story = {
  name: "Groups, icons & shortcuts",
  render: () => (
    <Command className="w-80 rounded-lg shadow-ring-md">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <Calendar />
            Calendar
          </CommandItem>
          <CommandItem>
            <Smile />
            Search emoji
          </CommandItem>
          <CommandItem>
            <Calculator />
            Calculator
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <User />
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <CreditCard />
            Billing
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Settings />
            Settings
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

/* -------------------------------------------------------------------------- */
/*  Scrollable                                                                 */
/* -------------------------------------------------------------------------- */

const FRAMEWORKS = [
  "Next.js",
  "React",
  "Remix",
  "Astro",
  "SvelteKit",
  "Nuxt",
  "SolidStart",
  "Qwik City",
  "Gatsby",
  "Vite",
  "Angular",
  "Vue",
  "Ember",
  "Preact",
  "Lit",
  "Alpine.js",
  "HTMX",
  "Eleventy",
  "Hugo",
  "Docusaurus",
];

/** A long list inside the `CommandList`'s built-in scroll region (max-h 300px). */
export const Scrollable: Story = {
  name: "Scrollable",
  render: () => (
    <Command className="w-80 rounded-lg shadow-ring-md">
      <CommandInput placeholder="Search framework…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Frameworks">
          {FRAMEWORKS.map((framework) => (
            <CommandItem key={framework}>{framework}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

/* -------------------------------------------------------------------------- */
/*  External combobox input (#365)                                            */
/* -------------------------------------------------------------------------- */

/**
 * A plain `<input role="combobox">` rendered OUTSIDE the `Command` tree (the
 * composer-textarea / `@`-mention shape #365 was filed for) driving
 * `aria-activedescendant` off `onActiveItemIdChange` — never by positionally
 * querying `[role="option"]`. Arrow keys typed into the input are forwarded
 * onto the `Command` root so cmdk's own navigation still owns selection.
 */
function ExternalInputComboboxDemo() {
  const [activeId, setActiveId] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);

  const forwardKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      listRef.current?.dispatchEvent(
        new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }),
      );
    }
  };

  return (
    <div className="w-80 space-y-2">
      <input
        aria-activedescendant={activeId}
        aria-controls="mention-list"
        aria-expanded="true"
        role="combobox"
        onKeyDown={forwardKey}
        placeholder="Type @ to mention…"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Command
        id="mention-list"
        ref={listRef}
        onActiveItemIdChange={setActiveId}
        className="rounded-lg border shadow-ring-md"
      >
        <CommandList>
          <CommandGroup heading="Teammates">
            <CommandItem value="ada">Ada Lovelace</CommandItem>
            <CommandItem value="grace">Grace Hopper</CommandItem>
            <CommandItem value="alan">Alan Turing</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

export const ExternalInputCombobox: Story = {
  name: "External input combobox (aria-activedescendant, #365)",
  parameters: {
    docs: {
      description: {
        story:
          "`Command`'s `onActiveItemIdChange` reports the DOM id cmdk assigned to the " +
          "highlighted item, so an input rendered outside the `Command` tree — a composer " +
          "textarea driving an `@`-mention popup — can set `aria-activedescendant` " +
          'correctly without positionally querying `[role="option"]`.',
      },
    },
  },
  render: () => <ExternalInputComboboxDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    await waitFor(() => expect(input).toBeVisible());

    // Before ANY interaction: cmdk highlights the first item on mount, so the
    // external input must already point at it. (cmdk's own `state.selectedItemId`
    // is `undefined` here — `Command` resolves the id from the committed DOM
    // instead, which is what makes this assertion pass.)
    await waitFor(() => {
      const onMount = canvasElement.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(onMount).not.toBeNull();
      expect(input.getAttribute("aria-activedescendant")).toBe(onMount.id);
    });

    // Forward one ArrowDown (the real keyboard-navigation path) to move
    // cmdk's selection, then confirm the external input's
    // aria-activedescendant follows the newly-highlighted item's DOM id —
    // never a positional index.
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );

    let firstId: string | null = null;
    await waitFor(() => {
      const selected = canvasElement.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(selected).not.toBeNull();
      expect(input.getAttribute("aria-activedescendant")).toBe(selected.id);
      firstId = selected.id;
    });

    // A second ArrowDown must move it again, to a DIFFERENT id.
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await waitFor(() => {
      const nowSelected = canvasElement.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(nowSelected.id).not.toBe(firstId);
      expect(input.getAttribute("aria-activedescendant")).toBe(nowSelected.id);
    });
  },
};
