import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Slider } from "./slider";
const meta = {
  title: "Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      description: "Uncontrolled initial value(s) as an array.",
      control: false,
      table: { category: "State" },
    },
    value: {
      description: "Controlled value(s) as an array.",
      control: false,
      table: { category: "State" },
    },
    min: {
      description: "Minimum value of the range.",
      control: "number",
      table: { category: "Behavior" },
    },
    max: {
      description: "Maximum value of the range.",
      control: "number",
      table: { category: "Behavior" },
    },
    step: {
      description: "Increment between selectable values.",
      control: "number",
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Disables the slider.",
      control: "boolean",
      table: { category: "State" },
    },
    orientation: {
      description: "Layout direction of the slider.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    onValueChange: {
      description: "Called when the slider value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Slider>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => <Slider defaultValue={[50]} max={100} step={1} className="w-64" />,
  // Confirms the slider thumb is present and has the expected value attribute.
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole("slider");
    await expect(thumb).toBeInTheDocument();
    await expect(thumb).toHaveAttribute("aria-valuenow", "50");
  },
};

/**
 * The name has to land on the THUMB — that is the element with `role="slider"`.
 * `aria-label` (or `aria-labelledby`, for a visible `<Label>`) is routed there.
 */
export const Labelled: Story = {
  render: () => (
    <Slider aria-label="Decoration level" defaultValue={[4]} max={10} step={1} className="w-64" />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("slider", { name: "Decoration level" })).toBeInTheDocument();
  },
};

/**
 * A replay scrubber announces "step 3 of 12" instead of the bare numeric
 * value — `aria-valuetext` on `thumbProps` (or the top-level `aria-valuetext`
 * shorthand) lands on the thumb, the element that actually carries
 * `role="slider"`.
 */
export const CustomValueText: Story = {
  render: () => (
    <Slider
      aria-label="Replay position"
      defaultValue={[3]}
      max={12}
      step={1}
      className="w-64"
      thumbProps={{ "aria-valuetext": "step 3 of 12" }}
    />
  ),
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole("slider", { name: "Replay position" });
    await expect(thumb).toHaveAttribute("aria-valuetext", "step 3 of 12");
  },
};

/**
 * A range slider (array `defaultValue`) renders one thumb per value. Passing
 * an ARRAY to `thumbProps` (#398) gives each thumb its own accessible name
 * and `aria-valuetext` — a top-level `aria-label`/`aria-valuetext` would
 * apply identically to both thumbs, which isn't what a min/max range wants.
 */
export const Range: Story = {
  render: () => (
    <Slider
      defaultValue={[20, 80]}
      max={100}
      step={1}
      className="w-64"
      thumbProps={[
        { "aria-label": "Minimum price", "aria-valuetext": "$20" },
        { "aria-label": "Maximum price", "aria-valuetext": "$80" },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    const thumbs = canvas.getAllByRole("slider");
    await expect(thumbs).toHaveLength(2);
    await expect(thumbs[0]).toHaveAccessibleName("Minimum price");
    await expect(thumbs[0]).toHaveAttribute("aria-valuetext", "$20");
    await expect(thumbs[1]).toHaveAccessibleName("Maximum price");
    await expect(thumbs[1]).toHaveAttribute("aria-valuetext", "$80");

    // #398 AC-3 — a real accessibility-tree assertion, not just a DOM
    // attribute snapshot: the DOM checks above prove the markup is right,
    // not that a screen reader actually hears two distinctly-named,
    // distinctly-valued thumbs. This reads Chromium's live AX tree via CDP
    // (`Accessibility.getFullAXTree`), which is what assistive tech consumes.
    //
    // `@vitest/browser/context` is a virtual module that only resolves inside
    // Vitest's browser-mode test runner (`pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` /
    // `vitest --project storybook run`, the same engine CI's blocking
    // "Storybook interaction + axe" job uses) — importing it anywhere else
    // throws by the module's own design. The dynamic import + catch lets this
    // block run there while leaving plain interactive Storybook browsing and
    // a production `build-storybook` unaffected (they still get every DOM
    // assertion above).
    let browserContext: typeof import("@vitest/browser/context") | undefined;
    try {
      browserContext = await import("@vitest/browser/context");
    } catch {
      browserContext = undefined;
    }
    if (!browserContext) return;

    interface AXProperty {
      name: string;
      value?: { value?: unknown };
    }
    interface AXNode {
      role?: { value?: string };
      name?: { value?: string };
      ignored?: boolean;
      properties?: AXProperty[];
    }
    interface FrameNode {
      frame: { id: string };
      childFrames?: FrameNode[];
    }
    // The base `CDPSession` type ships empty ("methods are defined by the
    // provider type augmentation" — @vitest/browser/context.d.ts) and this
    // file doesn't pull in the playwright provider's ambient augmentation, so
    // `send` is typed by hand here rather than importing playwright's CDP
    // protocol types into a story file.
    interface CdpSession {
      send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
    }

    const session = browserContext.cdp() as unknown as CdpSession;
    await session.send("Accessibility.enable");
    await session.send("Page.enable");
    const { frameTree } = (await session.send("Page.getFrameTree")) as {
      frameTree: FrameNode;
    };
    const frames: { id: string }[] = [];
    const collectFrames = (node: FrameNode) => {
      frames.push(node.frame);
      for (const child of node.childFrames ?? []) collectFrames(child);
    };
    collectFrames(frameTree);

    let axNodes: AXNode[] = [];
    for (const frame of frames) {
      const result = (await session.send("Accessibility.getFullAXTree", {
        frameId: frame.id,
      })) as { nodes: AXNode[] };
      axNodes = axNodes.concat(result.nodes);
    }

    const sliderNodes = axNodes.filter((node) => node.role?.value === "slider" && !node.ignored);
    await expect(sliderNodes).toHaveLength(2);

    const valuetextOf = (node: AXNode) =>
      node.properties?.find((property) => property.name === "valuetext")?.value?.value;
    const namedThumbs = sliderNodes
      .map((node) => ({ name: node.name?.value, valuetext: valuetextOf(node) }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    await expect(namedThumbs).toEqual([
      { name: "Maximum price", valuetext: "$80" },
      { name: "Minimum price", valuetext: "$20" },
    ]);
  },
};
