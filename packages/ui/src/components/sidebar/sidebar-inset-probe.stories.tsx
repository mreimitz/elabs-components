import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "./sidebar";

const meta = {
  title: "Layout/Sidebar/Inset probe",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Temporary probe — not a real usage example. Measures whether `SidebarInset`'s `peer-data-[variant=inset]` treatment can be driven by a sidebar that is NOT its immediately-preceding sibling, and records the margin/radius `SidebarInset` actually renders in each ordering. Deleted once the R8 fix lands.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Probe only — deleted once R8 lands. Measures whether a RIGHT sidebar can drive the inset treatment. */
export const RightInsetProbe: Story = {
  render: () => (
    <SidebarProvider>
      <SidebarInset data-testid="inset">
        <div className="p-6 text-body">content</div>
      </SidebarInset>
      <Sidebar side="right" variant="inset" data-testid="right-rail">
        <SidebarContent />
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const styles = getComputedStyle(inset);
    // Claim 1: `peer-data-[variant=inset]` is the subsequent-sibling combinator,
    // so a LATER sibling cannot match it. If this is right, margin stays 0px.
    console.log(
      "R8 probe RightInsetProbe — marginTop:",
      styles.marginTop,
      "marginRight:",
      styles.marginRight,
      "marginInlineStart:",
      styles.marginInlineStart,
      "borderRadius:",
      styles.borderTopLeftRadius,
    );
    await expect(inset).toBeInTheDocument();
    // Measured values, asserted directly (not just logged) so the finding
    // survives even where console output does not reach the runner's
    // terminal. CONFIRMED: a right-hand sidebar cannot drive the inset
    // treatment — every value stays at its unset default.
    expect(styles.marginTop).toBe("0px");
    expect(styles.marginRight).toBe("0px");
    expect(styles.marginInlineStart).toBe("0px");
    expect(styles.borderTopLeftRadius).toBe("0px");
  },
};

/** Control — deleted once R8 lands. Same measurement with the sidebar BEFORE the inset, the composing order `peer-*` actually supports. */
export const LeftInsetControl: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar variant="inset" data-testid="left-rail">
        <SidebarContent />
      </Sidebar>
      <SidebarInset data-testid="inset">
        <div className="p-6 text-body">content</div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const styles = getComputedStyle(inset);
    console.log(
      "R8 probe LeftInsetControl — marginTop:",
      styles.marginTop,
      "marginRight:",
      styles.marginRight,
      "marginInlineStart:",
      styles.marginInlineStart,
      "borderRadius:",
      styles.borderTopLeftRadius,
    );
    await expect(inset).toBeInTheDocument();
    // The composing order: the rule DOES match here, so the control shows a
    // non-zero margin and a radius (`m-2 ms-0 rounded-xl` from
    // sidebar.tsx:313 — the inline-start side is deliberately 0, which is
    // Claim 2's hardcoded gutter, not a bug in the control). This is what a
    // right-hand panel is missing.
    expect(styles.marginTop).toBe("8px");
    expect(styles.marginRight).toBe("8px");
    expect(styles.marginInlineStart).toBe("0px");
    expect(styles.borderTopLeftRadius).toBe("8px");
  },
};
