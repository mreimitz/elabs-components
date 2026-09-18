import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useEffect, useState } from "react";
import { Badge, Button, Textarea } from "@elabs-ai/components-ui";

import { A2uiSurface, type A2uiAction, type A2uiActionContext } from "./a2ui-surface";
import { A2UI_CATALOG_SCHEMA } from "./core/catalog.generated";
import type { A2uiSurfaceSpec } from "./core/spec";
import { UI_CATALOG_BINDINGS, createA2uiCatalog, defineA2uiType } from "./ui-catalog";

/**
 * `A2uiSurface` is Path C of the AI Output Contract — the SAFE generative-UI path
 * (D2): the agent describes a screen as DATA, brand-ui validates it against the
 * catalog (`brand-ui a2ui catalog`) and renders it with the real components.
 * Nothing here is JSX from the model: every node names a catalog type, every prop
 * is checked, and interaction is `on.<event>` → a host action the app resolves.
 *
 * These stories exercise the real behaviours — actions reaching the host, streaming
 * build-up with pruning, the settled error report, an app-extended catalog and a
 * live editor — not static snapshots.
 */

/** A surface an agent would emit for "show me order 4711 and let me approve it". */
const ORDER: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Order 4711",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          { type: "CardTitle", children: ["Order 4711"] },
          {
            type: "CardDescription",
            children: ["Placed today by Northwind Traders · awaiting approval"],
          },
          {
            type: "CardAction",
            children: [{ type: "StatusBadge", props: { status: "awaiting-approval" } }],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Stack",
            props: { gap: "lg" },
            children: [
              {
                type: "Grid",
                props: { columns: 3 },
                children: [
                  {
                    type: "MetricCard",
                    props: {
                      label: "Total",
                      value: 1240,
                      valueFormat: "currency",
                      currency: "EUR",
                    },
                  },
                  { type: "MetricCard", props: { label: "Lines", value: 3 } },
                  {
                    type: "MetricCard",
                    props: {
                      label: "Margin",
                      value: 0.31,
                      valueFormat: "percent",
                      delta: "+2.1 pts",
                      deltaDirection: "up",
                    },
                  },
                ],
              },
              {
                type: "Table",
                children: [
                  {
                    type: "TableHeader",
                    children: [
                      {
                        type: "TableRow",
                        children: [
                          { type: "TableHead", children: ["Item"] },
                          { type: "TableHead", children: ["Qty"] },
                          { type: "TableHead", children: ["Price"] },
                        ],
                      },
                    ],
                  },
                  {
                    type: "TableBody",
                    children: [
                      ["Chai", "10", "€ 180"],
                      ["Aniseed Syrup", "24", "€ 240"],
                      ["Ikura", "12", "€ 820"],
                    ].map((row) => ({
                      type: "TableRow",
                      children: row.map((cell) => ({ type: "TableCell", children: [cell] })),
                    })),
                  },
                ],
              },
              {
                type: "Alert",
                props: { variant: "info" },
                children: [
                  { type: "AlertTitle", children: ["Credit check passed"] },
                  {
                    type: "AlertDescription",
                    children: ["Northwind has a 30-day term and no open disputes."],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: { direction: "row", gap: "sm", justify: "end" },
            children: [
              {
                type: "Button",
                props: { variant: "outline" },
                on: { click: { name: "open-order", payload: { id: 4711 } } },
                children: ["Open in ERP"],
              },
              {
                type: "Button",
                on: { click: { name: "approve", payload: { id: 4711 } } },
                children: ["Approve"],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** What a host app does with actions: here, a visible log. */
function ActionLog({ entries }: { entries: string[] }) {
  return (
    <div
      data-testid="action-log"
      aria-live="polite"
      className="rounded-md bg-surface-muted p-3 text-caption text-muted-foreground"
    >
      {entries.length ? (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e} className="font-mono">
              {e}
            </li>
          ))}
        </ul>
      ) : (
        "Actions the surface sends to the host appear here."
      )}
    </div>
  );
}

function WithActions({ surface }: { surface: A2uiSurfaceSpec }) {
  const [log, setLog] = useState<string[]>([]);
  const onAction = (action: A2uiAction, ctx: A2uiActionContext) =>
    setLog((l) => [
      ...l,
      `${l.length + 1}. ${ctx.event} → ${action.name} ${JSON.stringify(action.payload ?? "")}${ctx.value !== undefined ? ` (value: ${JSON.stringify(ctx.value)})` : ""}`,
    ]);
  return (
    <div className="flex flex-col gap-4">
      <A2uiSurface surface={surface} onAction={onAction} />
      <ActionLog entries={log} />
    </div>
  );
}

const meta = {
  title: "AI/A2UI Surface",
  component: A2uiSurface,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof A2uiSurface>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The order card from the agent-output contract: data in, real components out, actions to the host. */
export const Default: Story = {
  args: { surface: ORDER },
  render: (args) => <WithActions surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group", { name: "Order 4711" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent('click → approve {"id":4711}');
  },
};

/** A form-like surface: inputs, a select, a switch — every change reaches `onAction` with its value. */
export const FormControls: Story = {
  args: {
    surface: {
      a2ui: "1",
      title: "Ship order 4711",
      root: {
        type: "Card",
        children: [
          {
            type: "CardHeader",
            children: [
              { type: "CardTitle", children: ["Ship order 4711"] },
              { type: "CardDescription", children: ["The agent asks for the details it lacks."] },
            ],
          },
          {
            type: "CardContent",
            children: [
              {
                type: "Grid",
                props: { columns: 2, gap: "lg" },
                children: [
                  {
                    type: "Stack",
                    props: { gap: "xs" },
                    children: [
                      { type: "Label", props: { htmlFor: "carrier" }, children: ["Carrier"] },
                      {
                        type: "Select",
                        props: { defaultValue: "dhl" },
                        on: { change: { name: "set-carrier" } },
                        children: [
                          {
                            type: "SelectTrigger",
                            props: { id: "carrier" },
                            children: [
                              { type: "SelectValue", props: { placeholder: "Pick a carrier" } },
                            ],
                          },
                          {
                            type: "SelectContent",
                            children: [
                              {
                                type: "SelectItem",
                                props: { value: "dhl" },
                                children: ["DHL Express"],
                              },
                              { type: "SelectItem", props: { value: "ups" }, children: ["UPS"] },
                              {
                                type: "SelectItem",
                                props: { value: "post" },
                                children: ["Austrian Post"],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: "Stack",
                    props: { gap: "xs" },
                    children: [
                      {
                        type: "Label",
                        props: { htmlFor: "ref" },
                        children: ["Customer reference"],
                      },
                      {
                        type: "Input",
                        props: { id: "ref", placeholder: "PO number" },
                        on: { change: { name: "set-reference" } },
                      },
                    ],
                  },
                  {
                    type: "Stack",
                    props: { direction: "row", gap: "sm", align: "center" },
                    children: [
                      {
                        type: "Switch",
                        props: { id: "insured", defaultChecked: true },
                        on: { change: { name: "set-insured" } },
                      },
                      {
                        type: "Label",
                        props: { htmlFor: "insured" },
                        children: ["Insured shipment"],
                      },
                    ],
                  },
                  {
                    type: "Stack",
                    props: { gap: "xs" },
                    children: [
                      { type: "Label", children: ["Priority"] },
                      {
                        type: "RadioGroup",
                        props: { defaultValue: "standard", "aria-label": "Priority" },
                        on: { change: { name: "set-priority" } },
                        children: [
                          {
                            type: "Stack",
                            props: { direction: "row", gap: "sm", align: "center" },
                            children: [
                              { type: "RadioGroupItem", props: { value: "standard", id: "p-std" } },
                              {
                                type: "Label",
                                props: { htmlFor: "p-std" },
                                children: ["Standard"],
                              },
                            ],
                          },
                          {
                            type: "Stack",
                            props: { direction: "row", gap: "sm", align: "center" },
                            children: [
                              { type: "RadioGroupItem", props: { value: "express", id: "p-exp" } },
                              { type: "Label", props: { htmlFor: "p-exp" }, children: ["Express"] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "CardFooter",
            children: [
              {
                type: "Stack",
                props: { direction: "row", gap: "sm", justify: "end" },
                children: [
                  {
                    type: "Button",
                    props: { variant: "ghost" },
                    on: { click: { name: "cancel" } },
                    children: ["Cancel"],
                  },
                  {
                    type: "Button",
                    on: { click: { name: "ship", payload: { id: 4711 } } },
                    children: ["Ship it"],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  render: (args) => <WithActions surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Customer reference"), "PO-88");
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'set-reference "" (value: "PO-88")',
    );
    await userEvent.click(canvas.getByRole("switch", { name: "Insured shipment" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'set-insured "" (value: false)',
    );
  },
};

/** Tabs, an accordion and a timeline — stateful compounds the agent composes from the catalog. */
export const Composition: Story = {
  args: {
    surface: {
      a2ui: "1",
      root: {
        type: "Stack",
        props: { gap: "lg" },
        children: [
          {
            type: "SectionHeader",
            props: {
              eyebrow: "Deployment",
              title: "api-gateway · v4.2.0",
              description: "Rolled out to 3 of 4 regions.",
              actions: { type: "Badge", props: { variant: "success" }, children: ["Healthy"] },
            },
          },
          {
            type: "Tabs",
            props: { defaultValue: "status" },
            on: { change: { name: "tab" } },
            children: [
              {
                type: "TabsList",
                children: [
                  { type: "TabsTrigger", props: { value: "status" }, children: ["Status"] },
                  { type: "TabsTrigger", props: { value: "details" }, children: ["Details"] },
                ],
              },
              {
                type: "TabsContent",
                props: { value: "status" },
                children: [
                  {
                    type: "Timeline",
                    props: {
                      items: [
                        { title: "eu-central-1", status: "done", timestamp: "09:12" },
                        { title: "eu-west-1", status: "done", timestamp: "09:18" },
                        { title: "us-east-1", status: "active", timestamp: "09:25" },
                        { title: "ap-southeast-2", status: "pending" },
                      ],
                    },
                  },
                ],
              },
              {
                type: "TabsContent",
                props: { value: "details" },
                children: [
                  {
                    type: "Descriptions",
                    props: { columns: 2 },
                    children: [
                      {
                        type: "DescriptionsItem",
                        props: { label: "Commit" },
                        children: ["be18099c"],
                      },
                      {
                        type: "DescriptionsItem",
                        props: { label: "Strategy" },
                        children: ["Canary 10% → 100%"],
                      },
                      {
                        type: "DescriptionsItem",
                        props: { label: "Error budget", numeric: true },
                        children: ["82%"],
                      },
                      {
                        type: "DescriptionsItem",
                        props: { label: "Owner" },
                        children: ["Platform team"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "Accordion",
            props: { type: "single", collapsible: true },
            children: [
              {
                type: "AccordionItem",
                props: { value: "logs" },
                children: [
                  { type: "AccordionTrigger", children: ["Why is us-east-1 still rolling?"] },
                  {
                    type: "AccordionContent",
                    children: [
                      {
                        type: "Text",
                        props: { tone: "muted" },
                        children: [
                          "The canary is holding at 10% until p99 latency stays under 300 ms for 10 minutes.",
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { type: "Progress", props: { value: 75, "aria-label": "Rollout progress" } },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Details" }));
    await expect(await canvas.findByText("Canary 10% → 100%")).toBeInTheDocument();
  },
};

const STREAM_TARGET = JSON.stringify(ORDER);

/** The surface arrives token by token; every node that already validates is drawn, the rest waits. */
function StreamingDemo({ speed = 24 }: { speed?: number }) {
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running || shown >= STREAM_TARGET.length) return;
    const id = window.setTimeout(
      () => setShown((n) => Math.min(STREAM_TARGET.length, n + 7)),
      speed,
    );
    return () => window.clearTimeout(id);
  }, [running, shown, speed]);
  const done = shown >= STREAM_TARGET.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShown(0);
            setRunning(true);
          }}
        >
          Replay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRunning((r) => !r)} disabled={done}>
          {running ? "Pause" : "Resume"}
        </Button>
        <Badge variant={done ? "success" : "secondary"}>
          {done ? "settled" : `streaming ${shown}/${STREAM_TARGET.length}`}
        </Badge>
      </div>
      <A2uiSurface surface={STREAM_TARGET.slice(0, shown)} isStreaming={!done} />
    </div>
  );
}

/** Streaming: partial JSON is completed, validated per node, and builds up behind a skeleton. */
export const Streaming: Story = {
  args: { surface: "" },
  render: () => <StreamingDemo />,
};

/** `loading`: nothing has arrived yet — the layout-shaped skeleton with a polite live region. */
export const Loading: Story = {
  args: { surface: null, loading: true },
};

/** A settled surface that breaks the contract: every problem, with its path, in a `role="alert"`. */
export const Invalid: Story = {
  args: {
    surface: {
      a2ui: "1",
      root: {
        type: "Stack",
        children: [
          { type: "Sparkline", props: { points: [1, 2, 3] } },
          {
            type: "Button",
            props: { variant: "primary", className: "my-brand-card" },
            children: ["Save"],
          },
          { type: "Progress", props: { value: 40 }, children: ["no children here"] },
          { type: "Badge", on: { hover: { name: "peek" } }, children: ["Hover me"] },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("root.children[0].type");
    await expect(alert).toHaveTextContent("root.children[1].props.className");
    await expect(canvas.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  },
};

/** A token-driven app component the agent may now name — the catalog is the app's to extend. */
function Sparkline({ points, label }: { points: number[]; label: string }) {
  const max = Math.max(...points, 1);
  return (
    <figure className="rounded-lg border bg-card p-3 text-card-foreground">
      <figcaption className="text-meta text-muted-foreground">{label}</figcaption>
      <div
        className="mt-2 flex h-12 items-end gap-1"
        role="img"
        aria-label={`${label}: ${points.join(", ")}`}
      >
        {points.map((p, i) => (
          <span
            key={`${label}-${i}`}
            className="w-3 rounded-t-sm bg-primary"
            style={{ height: `${Math.max(8, (p / max) * 100)}%` }}
          />
        ))}
      </div>
    </figure>
  );
}

const extendedCatalog = createA2uiCatalog(
  { ...UI_CATALOG_BINDINGS, Sparkline },
  {
    ...A2UI_CATALOG_SCHEMA,
    Sparkline: defineA2uiType({
      summary: "A tiny bar sparkline for a short numeric series.",
      props: {
        label: { type: "string", required: true },
        points: { type: "array", required: true, description: "Numbers, oldest first." },
      },
    }),
  },
);

/** An app-extended catalog: `Sparkline` is unknown to the shipped catalog but valid in this app's. */
export const ExtendedCatalog: Story = {
  args: {
    catalog: extendedCatalog,
    surface: {
      a2ui: "1",
      root: {
        type: "Grid",
        props: { columns: 3 },
        children: [
          { type: "Sparkline", props: { label: "Sign-ups", points: [3, 5, 4, 8, 9, 12, 11] } },
          { type: "Sparkline", props: { label: "Churn", points: [4, 4, 3, 3, 2, 2, 1] } },
          {
            type: "MetricCard",
            props: {
              label: "MRR",
              value: 48200,
              valueFormat: "currency",
              currency: "USD",
              delta: "+4.1%",
              deltaDirection: "up",
            },
          },
        ],
      },
    },
  },
};

/** Edit the JSON, see the surface — the loop an agent runs against `brand-ui a2ui validate`. */
function LiveEditor() {
  const [text, setText] = useState(JSON.stringify(ORDER, null, 2));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Textarea
        aria-label="Surface JSON"
        className="min-h-[24rem] font-mono text-code"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <A2uiSurface surface={text} />
    </div>
  );
}

/** Live editing: the surface re-validates on every keystroke; incomplete JSON keeps the last frame. */
export const LiveEdit: Story = {
  args: { surface: "" },
  render: () => <LiveEditor />,
};
