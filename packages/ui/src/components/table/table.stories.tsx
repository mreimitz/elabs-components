import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
const meta = {
  title: "Data/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The STATIC table markup you lay out yourself; the interactive grid is " +
          "`Data/DataTable` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Low-level static table primitives (header/body/row/cell styling). For sorting, filtering, " +
          "pagination, virtualization, row selection and column management, use the TanStack-powered " +
          "DataTable (see Data/DataTable, @elabs-ai/components-data) instead.",
      },
    },
  },
  argTypes: {
    className: {
      description: "Additional CSS classes applied to the `<table>` element.",
      control: "text",
      table: { category: "Styling" },
    },
    children: {
      description: "Table content — compose with TableHeader, TableBody, TableRow, TableCell, etc.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>api-gateway</TableCell>
          <TableCell>healthy</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>billing</TableCell>
          <TableCell>degraded</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

// ─── Scrolling (#366) ───────────────────────────────────────────────────────

/**
 * A fixed-height container with more rows than fit — `Table`'s own scroll
 * wrapper is genuinely `overflow-auto` here, and that is exactly what no
 * `Table` story ever exercised before #366: the wrapper's own keyboard
 * affordance (WCAG 2.1.1 / axe `scrollable-region-focusable`) shipped
 * unguarded on this package's own turf, only incidentally covered elsewhere.
 * `Tab` reaches the region, and it carries the accessible name naming it a
 * scrollable region — see `table.test.tsx` for the fitting-table negative.
 */
export const Scrolling: Story = {
  render: () => (
    // `Table`'s own scroll wrapper has no explicit height of its own — like any
    // block box it grows to fit its content unless something makes it a flex
    // item with a bounded main-axis size. A plain `<div style={{height:160}}>`
    // ancestor does NOT do that (block children ignore a parent's height), so
    // this outer div is a column flex container: its one child (the wrapper,
    // which already carries `overflow-auto`) gets an automatic flex-basis
    // minimum size of 0 per the flexbox spec's overflow carve-out, letting it
    // shrink to the 160px bound instead of growing to its ~750px content.
    <div style={{ height: 160, display: "flex", flexDirection: "column" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 20 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>service-{i}</TableCell>
              <TableCell>{i % 2 === 0 ? "healthy" : "degraded"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const scrollRegion = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="table-scroll-region"]');
      if (!el || el.scrollHeight <= el.clientHeight) throw new Error("not overflowing yet");
      return el;
    });
    await expect(scrollRegion).toHaveAttribute("tabindex", "0");
    await expect(scrollRegion).toHaveAccessibleName("Table contents, scrollable");
    await expect(scrollRegion).not.toHaveAttribute("role");

    // The region is the only focusable element the story renders, so a
    // single Tab from nothing focused reaches it — the real WCAG 2.1.1
    // reproduction from the issue ("press Tab from the top").
    await userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(scrollRegion));
  },
};
