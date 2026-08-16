import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@qlik-coe-emea/qlabs-components-tokens";
import { Button } from "../button";
import { ConfirmDialog } from "../confirm-dialog";
import { Input } from "../input";
import { Label } from "../label";
import { Textarea } from "../textarea";
import { Text } from "../typography";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { useDialogDismissGuard } from "./use-dialog-dismiss-guard";

const meta = { title: "Overlays/Dialog", component: Dialog, tags: ["autodocs"] } satisfies Meta<
  typeof Dialog
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  // Proves the trigger opens the Radix dialog into its portal (mounted on
  // document.body, outside the story canvas) with the right title.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open dialog/i }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    // waitFor rides out the entrance animation (opacity starts at 0).
    await waitFor(() => expect(within(dialog).getByText("Delete project")).toBeVisible());
  },
};

/**
 * Overflow guard (regression): a `max-w-md` dialog holding a long, unbreakable
 * path inside a `truncate` row. The `minmax(0,1fr)` grid column lets the row
 * shrink and truncate, so the dialog must stay at `max-w-md` and never scroll
 * horizontally. Before the fix the implicit `auto` column blew past `max-w-md`.
 */
export const OverflowGuard: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open settings</Button>
      </DialogTrigger>
      <DialogContent size="sm" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Repository path</DialogTitle>
          <DialogDescription>The dialog must not widen to fit this path.</DialogDescription>
        </DialogHeader>
        <div className="truncate rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-caption">
          ~/Developer/workspaces/monorepo/packages/very-long-package-name/src/features/extremely-deeply-nested/configuration/settings.local.json
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  // Real-surface proof: open the dialog, then assert it never overflows
  // horizontally (scrollWidth must not exceed clientWidth). This is the check
  // jsdom can't do — it needs a real layout engine.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open settings/i }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Repository path")).toBeVisible());
    // No horizontal overflow: the long path truncated instead of widening it.
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
  },
};

/**
 * Opening focus, when the body's first selector match cannot actually take it.
 * A `hidden` file input matches `input:not([disabled])` but swallows `.focus()`,
 * so a redirect that trusted the selector would suppress Radix's own autofocus
 * and leave the keyboard on the TRIGGER — outside the modal. jsdom cannot show
 * this (it does no layout and focuses hidden inputs happily), so the lock lives
 * here, in a real browser.
 */
export const HiddenFirstControl: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Attach evidence</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach evidence</DialogTitle>
          <DialogDescription>The file picker is opened from the button below.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <input id="hidden-upload" name="hidden-upload" type="file" hidden aria-hidden="true" />
          <Field id="evidence-note" label="Note" />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Attach</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /attach evidence/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    const note = await within(dialog).findByLabelText("Note");
    await waitFor(() => expect(document.activeElement).toBe(note));
    // The invariant that matters even if the target ever changes: opening focus
    // never escapes the modal.
    expect(dialog.contains(document.activeElement)).toBe(true);
  },
};

// ───────────────────────────── shared fixtures ───────────────────────────────

function Field({ id, label, defaultValue }: { id: string; label: string; defaultValue?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} autoComplete="off" defaultValue={defaultValue} />
    </div>
  );
}

/** Enough fields that the body outgrows any plausible viewport. */
function RetentionFields({ prefix }: { prefix: string }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <Field key={i} id={`${prefix}-${i}`} label={`Keep runs for stage ${i + 1} (days)`} />
      ))}
    </div>
  );
}

function LongSettingsBody({ prefix }: { prefix: string }) {
  return (
    <>
      <DialogSection title="Identity" description="How this pipeline is addressed by other jobs.">
        <div className="flex flex-col gap-4">
          <Field id={`${prefix}-name`} label="Pipeline name" defaultValue="nightly-ingest" />
          <Field id={`${prefix}-owner`} label="Owner" defaultValue="data-platform" />
        </div>
      </DialogSection>
      <DialogSection title="Retention" description="Storage cost is billed per stage.">
        <RetentionFields prefix={`${prefix}-retention`} />
      </DialogSection>
      <DialogSection title="Alerting" description="Who hears about a failed run.">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Field key={i} id={`${prefix}-alert-${i}`} label={`Escalation contact ${i + 1}`} />
          ))}
        </div>
      </DialogSection>
    </>
  );
}

function WideSettingsDialog({
  contentClassName,
  prefix,
}: {
  contentClassName?: string;
  prefix: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit pipeline</Button>
      </DialogTrigger>
      <DialogContent size="xl" className={contentClassName}>
        <DialogHeader>
          <DialogTitle>Pipeline settings</DialogTitle>
          <DialogDescription>
            Changes apply to the next scheduled run, not the one in progress.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          <LongSettingsBody prefix={prefix} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const px = (el: Element) => Number.parseFloat(getComputedStyle(el).fontSize);

/**
 * The entrance animation scales the content box (`zoom-in-95`), so a
 * `getBoundingClientRect()` taken mid-flight is a TRANSFORMED rect and drifts by
 * a couple of pixels as the animation lands. Wait it out before measuring in
 * viewport space; the fixity assertions below additionally use `offsetTop`,
 * which is layout and therefore transform-independent.
 */
async function settled(el: HTMLElement) {
  await waitFor(() =>
    expect(el.getAnimations().filter((a) => a.playState === "running")).toHaveLength(0),
  );
}

/**
 * Room between a focused child's border box and its scroll-container ancestor's
 * SCROLLPORT (not its border box — `clientLeft`/`clientTop`/`clientWidth`/
 * `clientHeight` exclude the border and a classic scrollbar, so a scrollbar's
 * width is never mistaken for clearance). Regression fixture for #425.
 */
const room = (child: HTMLElement, box: HTMLElement) => {
  const c = child.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const l = b.left + box.clientLeft; // scrollport, so a classic
  const t = b.top + box.clientTop; // scrollbar is not counted as room
  return {
    left: c.left - l,
    right: l + box.clientWidth - c.right,
    top: c.top - t,
    bottom: t + box.clientHeight - c.bottom,
  };
};

/**
 * Regression lock for #425 — `DialogBody` clipping a flush child's outward
 * focus ring. The body is a scroll container with no padding of its own, so
 * its padding box IS its content box; a full-width child's border box then
 * coincides with the scrollport edge, leaving no room for a `box-shadow` ring
 * (ink overflow — never part of the scrollable region, so it is simply cut).
 *
 * `input` is the FIRST child with no label above it — the top/left/right worst
 * case (identical to the true sole-child case for those three edges, since
 * clipping is a property of the scrollport, not of what else shares the
 * column). `button` below it exercises the library's widest outward paint
 * (`ring-2 ring-offset-2` = 4px). The filler forces a real scrollbar, and
 * scrolling to the very end before focusing `lastButton` exercises the
 * BOTTOM edge at the opposite extreme of the scroll range.
 *
 * The `3.5` threshold: `comfortable` density yields exactly 4px of gutter
 * (`p-1` = `calc(var(--spacing) * 1)`, `--spacing: 0.25rem`); `compact`
 * density yields 3.55px (`--spacing: 0.222rem`, `density.css:97`) — a known,
 * accepted sub-pixel shortfall on the outermost edge of a 2px stroke. The
 * library's widest outward focus paint is `ring-2 ring-offset-2` = 4px, so
 * 3.5 clears both densities with margin while still failing hard against the
 * unfixed 0px baseline.
 *
 * Verified CO-RESIDENT with `DirtyGuard` below, on purpose: a prior attempt to
 * isolate this story in its own file (on a since-refuted suspicion that it
 * destabilized `DirtyGuard`) did not hold up under a clean re-test — 4/4
 * consecutive runs green, `DirtyGuard` included. See
 * `.claude/rules/component-api.md` ("Regression locks with observable side
 * effects must be verified co-resident"), which this story now satisfies.
 */
export const FocusRingClearance: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open form</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Focus ring clearance</DialogTitle>
          <DialogDescription>
            Regression lock for #425 — a flush child&rsquo;s focus ring must never be clipped by the
            body&rsquo;s scrollport.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Input
            id="ring-clearance-input"
            name="ring-clearance-input"
            aria-label="Sole-child input"
            autoComplete="off"
            className="w-full"
          />
          <Button className="w-full">Full-width action</Button>
          {Array.from({ length: 20 }, (_, i) => (
            <Text key={i} variant="caption">
              Filler line {i + 1} — forces the body to scroll.
            </Text>
          ))}
          <Button className="w-full">Last control</Button>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open form/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Focus ring clearance")).toBeVisible());
    await settled(dialog);

    const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;
    const header = dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
    const input = within(dialog).getByLabelText("Sole-child input") as HTMLInputElement;
    const button = within(dialog).getByRole("button", { name: "Full-width action" });
    const lastButton = within(dialog).getByRole("button", { name: "Last control" });

    // 1. Sole-child-equivalent worst case (top/left/right).
    input.focus();
    await waitFor(() => expect(document.activeElement).toBe(input));
    const inputRoom = room(input, body);
    expect(inputRoom.left).toBeGreaterThanOrEqual(3.5);
    expect(inputRoom.right).toBeGreaterThanOrEqual(3.5);
    expect(inputRoom.top).toBeGreaterThanOrEqual(3.5);
    expect(inputRoom.bottom).toBeGreaterThanOrEqual(3.5);

    // 2. The library's widest outward paint (`ring-2 ring-offset-2` = 4px).
    button.focus();
    await waitFor(() => expect(document.activeElement).toBe(button));
    const buttonRoom = room(button, body);
    expect(buttonRoom.left).toBeGreaterThanOrEqual(3.5);
    expect(buttonRoom.right).toBeGreaterThanOrEqual(3.5);
    expect(buttonRoom.top).toBeGreaterThanOrEqual(3.5);
    expect(buttonRoom.bottom).toBeGreaterThanOrEqual(3.5);

    // 3. The scrolled arm (`scroll-p-1`): scroll to the very end, then focus
    // the last control and re-assert clearance on the now-flush bottom edge.
    body.scrollTop = body.scrollHeight;
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(0));
    lastButton.focus();
    await waitFor(() => expect(document.activeElement).toBe(lastButton));
    const lastRoom = room(lastButton, body);
    expect(lastRoom.left).toBeGreaterThanOrEqual(3.5);
    expect(lastRoom.right).toBeGreaterThanOrEqual(3.5);
    expect(lastRoom.top).toBeGreaterThanOrEqual(3.5);
    expect(lastRoom.bottom).toBeGreaterThanOrEqual(3.5);

    // 4. Body content stays flush with the header despite the border-box
    // pullback (the guard against re-doing this fix as padding-only).
    expect(
      Math.abs(input.getBoundingClientRect().left - header.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(0.5);

    // 5. No new horizontal scrollbar introduced by the gutter.
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
  },
};

/**
 * The clip is geometric and theme-invariant (it is a property of the box model,
 * not of any token value) — but the ring's colour IS a token (`--ring`), so the
 * acceptance criterion asks for the rendered result in both shipped themes.
 * Re-runs `FocusRingClearance`'s own geometry assertions under `qlik-dark`,
 * applied the way Storybook actually resolves a theme — a per-story `globals`
 * override (`DecoratorHelpers.pluckThemeFromContext`, read by the root
 * `withTheme` decorator in `preview.tsx`) — rather than a nested
 * `ThemeProvider`, which does not win against that decorator and silently
 * left an earlier version of this story rendering `qlik-bright` under a
 * "qlik-dark" name. `document.documentElement`'s `data-theme` is read back in
 * `play` so a future regression of THIS story is caught rather than repeated.
 */
export const FocusRingClearanceQlikDark: Story = {
  name: "Focus ring clearance — qlik-dark",
  globals: { theme: "qlik-dark" },
  render: FocusRingClearance.render,
  play: async (context) => {
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe("qlik-dark"),
    );
    await FocusRingClearance.play!(context);
  },
};

/**
 * The fixed-header/footer proof. Opens a deliberately long form, scrolls the
 * `DialogBody` to the bottom and asserts that the header and footer have not
 * moved — the primary action stays reachable without scrolling it out of view.
 * It also compares the RENDERED font sizes of the three type rungs, so a section
 * heading can never silently collapse onto the field-label rung.
 */
export const WideWithSections: Story = {
  render: () => <WideSettingsDialog prefix="wide" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit pipeline/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Pipeline settings")).toBeVisible());

    const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;
    const header = dialog.querySelector<HTMLElement>('[data-slot="dialog-header"]')!;
    const footer = dialog.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;

    // The body — not the dialog — owns the overflow.
    await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight + 8));
    await settled(dialog);

    const headerTop = header.offsetTop;
    const footerTop = footer.offsetTop;
    // The whole dialog, footer included, is inside the viewport before anyone
    // scrolls anything.
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    expect(footer.offsetTop + footer.offsetHeight).toBeLessThanOrEqual(dialog.clientHeight + 1);

    body.scrollTop = body.scrollHeight;
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(0));

    expect(header.offsetTop).toBe(headerTop);
    expect(footer.offsetTop).toBe(footerTop);
    expect(dialog.scrollTop).toBe(0);
    // Primary action still on screen after scrolling to the very bottom.
    expect(within(footer).getByRole("button", { name: "Save changes" })).toBeVisible();

    // Type rungs, measured — not inferred from class names (#341 AC).
    const title = within(dialog).getByText("Pipeline settings");
    const section = within(dialog).getByRole("heading", { name: "Retention" });
    const label = within(dialog).getByText("Owner");
    expect(px(title)).toBeGreaterThan(px(section));
    expect(px(section)).toBeGreaterThan(px(label));
  },
};

export const WideWithSectionsQlikDark: Story = {
  name: "Wide with sections — qlik-dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="qlik-dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: () => <WideSettingsDialog prefix="wide-dark" />,
  play: WideWithSections.play,
};

export const WideWithSectionsHighDecoration: Story = {
  name: "Wide with sections — high decoration",
  globals: { decoration: "10" },
  render: () => <WideSettingsDialog prefix="wide-blueprint" />,
  play: WideWithSections.play,
};

/**
 * The same dialog at a phone-height viewport, simulated deterministically by
 * capping the content box — the runner's window size then cannot flatter the
 * result. Header and footer must still hold their ground.
 */
export const ShortViewport: Story = {
  render: () => <WideSettingsDialog prefix="short" contentClassName="max-h-[360px]" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit pipeline/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Pipeline settings")).toBeVisible());

    const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;
    const footer = dialog.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;

    await settled(dialog);
    expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(361);
    await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight + 8));

    const footerTop = footer.offsetTop;
    expect(footer.offsetTop + footer.offsetHeight).toBeLessThanOrEqual(dialog.clientHeight + 1);
    body.scrollTop = body.scrollHeight;
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(0));
    expect(footer.offsetTop).toBe(footerTop);
    expect(dialog.scrollTop).toBe(0);
  },
};

// ─────────────────────────────── form recipe ─────────────────────────────────

function RenameForm() {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Rename dataset</Button>
      </DialogTrigger>
      <DialogContent>
        {/* The recipe: the body IS a real <form>, so Enter submits and the
            browser's own validation applies. No wrapper component needed — a
            short form has nothing to scroll, so it takes no DialogBody. */}
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSaved(new FormData(event.currentTarget).get("dataset-name") as string);
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename dataset</DialogTitle>
            <DialogDescription>
              References to the old name keep working for 30 days.
            </DialogDescription>
          </DialogHeader>
          <Field id="dataset-name" label="Dataset name" defaultValue="orders_raw" />
          {saved ? <Text variant="caption">Saved as {saved}</Text> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A short form: no internal scroll, and Enter submits because the body is a real `<form>`. */
export const FormRecipe: Story = {
  render: () => <RenameForm />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /rename dataset/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    const input = await within(dialog).findByLabelText("Dataset name");

    await userEvent.clear(input);
    await userEvent.type(input, "orders_clean{Enter}");

    await waitFor(() => expect(within(dialog).getByText("Saved as orders_clean")).toBeVisible());
    // A short form never grows its own scrollbar.
    expect(dialog.scrollHeight).toBeLessThanOrEqual(dialog.clientHeight + 1);
  },
};

// ──────────────────────────────── workbench ──────────────────────────────────

/** `size="full"` with the body owning a split pane — the editor + result shape. */
export const WorkbenchShell: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open query workbench</Button>
      </DialogTrigger>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Query workbench</DialogTitle>
          <DialogDescription>Draft a query and preview its result before saving.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 md:grid-cols-2">
          <DialogSection title="Query" description="SQL runs against the staging warehouse.">
            <Label htmlFor="workbench-sql">Statement</Label>
            <Textarea
              id="workbench-sql"
              name="workbench-sql"
              rows={12}
              spellCheck={false}
              className="font-mono text-code"
              defaultValue={"select order_id, total\nfrom orders_raw\nwhere total > 100"}
            />
          </DialogSection>
          <DialogSection title="Preview" description="First 3 rows, refreshed on run.">
            <div className="flex flex-col gap-2 font-mono text-code text-muted-foreground">
              <span>1041 · 128.00</span>
              <span>1042 · 210.50</span>
              <span>1043 · 104.25</span>
            </div>
          </DialogSection>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Discard</Button>
          </DialogClose>
          <Button>Save query</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open query workbench/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Query workbench")).toBeVisible());
    const footer = dialog.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;
    // 90vh tall, and the footer is inside it rather than off the bottom.
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    expect(dialog.scrollTop).toBe(0);
  },
};

// ─────────────────────────────── dirty guard ─────────────────────────────────

function GuardedDialog({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("orders_raw");
  const dirty = name !== "orders_raw";

  const guard = useDialogDismissGuard({
    dirty,
    onClose: () => setOpen(false),
    onOpen: () => setOpen(true),
  });

  function save() {
    // The save path closes the dialog itself, so it never reaches the guard —
    // that asymmetry is structural, not a flag.
    setName("orders_raw");
    setOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={guard.onOpenChange}>
        <DialogTrigger asChild>
          <Button>Edit dataset</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit dataset</DialogTitle>
            <DialogDescription>Escape closes — unless there is unsaved work.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guarded-name">Dataset name</Label>
            <Input
              id="guarded-name"
              name="guarded-name"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {children}
          <DialogFooter>
            <Button variant="outline" onClick={() => guard.onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={guard.confirmOpen}
        onOpenChange={guard.onConfirmOpenChange}
        tone="destructive"
        title="Discard changes?"
        description="Your edits to this dataset have not been saved."
        confirmLabel="Discard"
        onConfirm={() => {
          setName("orders_raw"); // discarding reverts the edits…
          guard.confirmDiscard(); // …and the guard closes both surfaces.
        }}
      />
    </>
  );
}

/**
 * Escape with unsaved changes raises a discard confirmation; a programmatic
 * close after a successful save does not. The dirty guard is a hook, not a prop,
 * because the component must not own app state (D5).
 */
export const DirtyGuard: Story = {
  render: () => <GuardedDialog />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);

    // 1. Dirty + Escape → the discard confirmation, dialog stays open.
    await userEvent.click(canvas.getByRole("button", { name: /edit dataset/i }));
    const dialog = await doc.findByRole("dialog");
    const input = await within(dialog).findByLabelText("Dataset name");
    await userEvent.type(input, "_v2");
    await userEvent.keyboard("{Escape}");

    const confirm = await doc.findByRole("alertdialog");
    await waitFor(() => expect(within(confirm).getByText("Discard changes?")).toBeVisible());
    // The guarded dialog is still mounted underneath. It is queried by slot, not
    // by role, because Radix marks everything outside the top layer
    // `aria-hidden` while the alert dialog owns the screen.
    expect(
      canvasElement.ownerDocument.querySelector('[data-slot="dialog-content"]'),
    ).toBeInTheDocument();
    // Nested focus scopes: the confirmation still lands on its safe action.
    const discardCancel = within(confirm).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(discardCancel));

    // 2. Confirming the discard closes both surfaces.
    await userEvent.click(within(confirm).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(doc.queryByRole("alertdialog")).toBeNull());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-slot="dialog-content"]')).toBeNull(),
    );

    // 3. Save → closes with NO discard confirmation.
    await userEvent.click(canvas.getByRole("button", { name: /edit dataset/i }));
    const reopened = await doc.findByRole("dialog");
    await userEvent.type(await within(reopened).findByLabelText("Dataset name"), "_v3");
    await userEvent.click(within(reopened).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-slot="dialog-content"]')).toBeNull(),
    );
    expect(doc.queryByRole("alertdialog")).toBeNull();
  },
};
