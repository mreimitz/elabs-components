import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
const meta = {
  title: "Navigation/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  argTypes: {
    children: {
      description: "Breadcrumb content — compose with BreadcrumbList, BreadcrumbItem, etc.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the nav element.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof Breadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Projects</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>brand-ui</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

/**
 * #310 — `BreadcrumbLink` had no focus-visible styling of its own, so keyboard
 * focus fell straight through to the browser's own default ring instead of
 * the library's token-driven indicator (`focus-ring`, ADR 0027) every other
 * interactive control carries. A class-string assertion would be worthless
 * (it wouldn't prove anything actually paints) so this locks the RENDERED
 * indicator: Tab to the first link and assert a real box-shadow exists,
 * mirroring `Button`'s `CompoundFocusIndicator` lock.
 */
export const FocusIndicator: Story = {
  name: "Focus indicator (#310)",
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>brand-ui</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: async ({ canvas, userEvent }) => {
    const link = canvas.getByRole("link", { name: "Home" });

    // Tab rather than .focus(): `:focus-visible` is what `focus-ring` keys
    // on, and a programmatic focus does not reliably match it.
    await userEvent.tab();
    await expect(link).toHaveFocus();

    const focused = getComputedStyle(link);
    await expect(focused.boxShadow).not.toBe("none");
  },
};
