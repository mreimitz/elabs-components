import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { SidebarInset, SidebarProvider } from "@elabs-ai/components-ui";
import { AppSidebar } from "./app-sidebar";
import { MailProvider, useMail } from "./mail-context";

function MailPreview() {
  const { selectedMail } = useMail();
  if (!selectedMail) {
    return (
      <div className="flex h-full items-center justify-center text-body text-muted-foreground">
        Select an email to preview
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="text-title font-semibold">{selectedMail.subject}</div>
        <div className="text-body text-muted-foreground">
          From: {selectedMail.name} ({selectedMail.email})
        </div>
      </div>
      <div className="whitespace-pre-wrap p-4 text-body">{`${selectedMail.teaser}\n\nThis is a sample message body for the selected email.`}</div>
    </div>
  );
}

const meta = {
  title: "Layout/App Shell/Mail",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <MailProvider>
        <div className="flex h-dvh w-full">
          <AppSidebar />
          <SidebarInset>
            <div className="m-2 flex-1 rounded-xl border">
              <MailPreview />
            </div>
          </SidebarInset>
        </div>
      </MailProvider>
    </SidebarProvider>
  ),
};

/**
 * #397: `layout-app-shell-mail--default` was the worst-measured real screen
 * for the density type dial (10 of 49 scaling text nodes) because
 * `app-sidebar.tsx`'s 8 raw `text‑sm`/`text‑xs`/`text‑base` utilities were
 * immune to `data-density` — see `.claude/rules/styling-and-tokens.md` "Type
 * is a role, not a size". All 8 now read a `text-<role>` utility instead, so
 * every one of these text nodes scales. Two columns pin `data-density` on a
 * plain wrapping div — NOT `<ThemeProvider>`, which writes `data-density` to
 * `document.documentElement` and would race two columns — mirroring
 * `Foundations/Typography → Density scale`'s pattern. Representative sample:
 * one node per converted role class is enough, since every site sharing a
 * role resolves to the identical computed style.
 */
export const DensityComparison: Story = {
  name: "Density comparison (#397)",
  parameters: {
    docs: {
      description: {
        story:
          "The 8 raw `text‑sm`/`text‑xs`/`text‑base` sites in `app-sidebar.tsx` " +
          "now read `text-body`/`text-meta`/`text-subtitle`, so they scale with " +
          "`data-density` like the rest of the shell. `text‑sm` → `text-body` " +
          "and `text‑base` → `text-subtitle` are documented no-ops (identical " +
          "size + line-height); `text‑xs` → `text-meta` also adopts " +
          "`font-weight: 500` + `letter-spacing: 0.01em` (a real, deliberate " +
          "shift, not a no-op).",
      },
    },
  },
  render: () => (
    <div className="flex gap-8">
      {(["compact", "comfortable", "spacious"] as const).map((mode) => (
        <div data-density={mode} data-testid={`density-${mode}`} key={mode}>
          <p className="mb-2 text-caption text-muted-foreground">{mode}</p>
          <div className="flex h-[420px] w-[520px] overflow-hidden rounded-lg border">
            <SidebarProvider>
              <MailProvider>
                <AppSidebar />
              </MailProvider>
            </SidebarProvider>
          </div>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const compact = canvasElement.querySelector('[data-testid="density-compact"]');
    const comfortable = canvasElement.querySelector('[data-testid="density-comfortable"]');
    const spacious = canvasElement.querySelector('[data-testid="density-spacious"]');
    expect(compact).not.toBeNull();
    expect(comfortable).not.toBeNull();
    expect(spacious).not.toBeNull();

    // `text‑xs` → `text-meta` sites ("Enterprise", "Labels", mail date, mail
    // teaser): 11.25px compact / 12px comfortable / 12.75px spacious,
    // matching Gantt's timescale.
    await waitFor(() => {
      expect(compact?.querySelector(".text-meta")).not.toBeNull();
      expect(comfortable?.querySelector(".text-meta")).not.toBeNull();
      expect(spacious?.querySelector(".text-meta")).not.toBeNull();
    });
    const metaCompact = compact?.querySelector(".text-meta") as Element;
    const metaComfortable = comfortable?.querySelector(".text-meta") as Element;
    const metaSpacious = spacious?.querySelector(".text-meta") as Element;
    expect(px(metaComfortable)).toBe(12);
    expect(px(metaCompact)).toBe(11.25);
    expect(px(metaSpacious)).toBe(12.75);
    expect(px(metaCompact)).toBeLessThan(px(metaComfortable));
    expect(px(metaSpacious)).toBeGreaterThan(px(metaComfortable));

    // `text‑sm` → `text-body` sites ("Acme Inc" wrapper, mail row): a
    // documented visual no-op at `comfortable` (14px, identical to a pre-#397
    // build), still scales at `compact` (13.125px) / `spacious` (14.875px).
    const bodyCompact = compact?.querySelector(".text-body") as Element;
    const bodyComfortable = comfortable?.querySelector(".text-body") as Element;
    const bodySpacious = spacious?.querySelector(".text-body") as Element;
    expect(bodyCompact).not.toBeNull();
    expect(bodyComfortable).not.toBeNull();
    expect(bodySpacious).not.toBeNull();
    expect(px(bodyComfortable)).toBe(14);
    expect(px(bodyCompact)).toBe(13.125);
    expect(px(bodySpacious)).toBe(14.875);

    // `text‑base` → `text-subtitle` site (the mail-list header title, e.g.
    // "Inbox"): 16px comfortable (identical to a pre-#397 `text‑base` build)
    // / 15px compact / 17px spacious.
    const subtitleCompact = compact?.querySelector(".text-subtitle") as Element;
    const subtitleComfortable = comfortable?.querySelector(".text-subtitle") as Element;
    const subtitleSpacious = spacious?.querySelector(".text-subtitle") as Element;
    expect(subtitleCompact).not.toBeNull();
    expect(subtitleComfortable).not.toBeNull();
    expect(subtitleSpacious).not.toBeNull();
    expect(px(subtitleComfortable)).toBe(16);
    expect(px(subtitleCompact)).toBe(15);
    expect(px(subtitleSpacious)).toBe(17);
  },
};
