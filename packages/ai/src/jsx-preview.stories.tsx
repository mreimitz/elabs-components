import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Textarea } from "@elabs-ai/components-ui";
import { JSXPreview, JSXPreviewContent, JSXPreviewError, JSXPreviewSkeleton } from "./jsx-preview";

/**
 * `JSXPreview` is the "ad-hoc JSX" path of the AI Output Contract: an agent emits
 * a JSX markup STRING and the component renders ONLY the tags present in the
 * `components` allow-list you pass. These stories exercise the REAL behaviors —
 * live streaming with partial-tag completion, live editing, data bindings, and the
 * error slot — not static snapshots.
 *
 * The allow-listed components are token-driven so they read in every theme.
 */
function Stat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className="text-title tabular-nums">{value}</div>
      {delta ? <div className="text-caption text-primary">{delta}</div> : null}
    </div>
  );
}

function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "neutral";
  children?: ReactNode;
}) {
  const rail =
    tone === "success"
      ? "border-s-primary"
      : tone === "neutral"
        ? "border-s-muted"
        : "border-s-info";
  return <div className={`border-s-2 ${rail} bg-muted/40 px-3 py-2 text-body`}>{children}</div>;
}

/** The allow-list — the agent may reference `<Stat>` / `<Callout>`; nothing else custom renders. */
const allow = { Stat, Callout };

const DASHBOARD =
  '<div className="grid grid-cols-3 gap-3">' +
  '<Stat label="Revenue" value="$1.2M" delta="+12%" />' +
  '<Stat label="Users" value="48.2k" delta="+3%" />' +
  '<Stat label="Churn" value="1.8%" />' +
  "</div>";

const meta = {
  title: "AI/JSXPreview",
  component: JSXPreview,
  parameters: { layout: "padded" },
} satisfies Meta<typeof JSXPreview>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A complete agent-emitted surface, rendered against the allow-list. */
export const Default: Story = {
  render: () => (
    <JSXPreview jsx={DASHBOARD} components={allow}>
      <JSXPreviewContent />
      <JSXPreviewError />
    </JSXPreview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Revenue")).toBeInTheDocument();
    await expect(canvas.getByText("$1.2M")).toBeInTheDocument();
    await expect(canvas.getByText("Churn")).toBeInTheDocument();
  },
};

/**
 * LIVE streaming — the headline behavior. The JSX string grows over time and, while
 * `isStreaming`, partial/unclosed tags are auto-completed (`completeJsxTag`) so the
 * surface renders progressively without flashing parse errors. `JSXPreviewSkeleton`
 * covers the brief moment before the first tag paints. Streams on mount; "Replay"
 * restarts it.
 */
function StreamingDemo() {
  const [len, setLen] = useState(0);
  const [run, setRun] = useState(0); // bump to replay
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLen(0);
    timer.current = setInterval(() => {
      setLen((n) => {
        const next = Math.min(n + 12, DASHBOARD.length);
        if (next >= DASHBOARD.length && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        return next;
      });
    }, 18);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [run]);

  const streaming = len < DASHBOARD.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button onClick={() => setRun((r) => r + 1)} size="sm" variant="outline" type="button">
          Replay stream
        </Button>
        <span className="text-meta text-muted-foreground">
          {streaming ? "streaming…" : "complete"}
        </span>
      </div>
      <JSXPreview components={allow} isStreaming={streaming} jsx={DASHBOARD.slice(0, len)}>
        <JSXPreviewSkeleton />
        <JSXPreviewContent />
      </JSXPreview>
    </div>
  );
}

export const Streaming: Story = {
  render: () => <StreamingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /replay stream/i }));
    // After the stream completes, the full dashboard rendered (tags auto-closed mid-stream).
    await canvas.findByText("Churn", {}, { timeout: 4000 });
    await expect(canvas.getByText("Revenue")).toBeInTheDocument();
  },
};

/**
 * LIVE editing — type an agent's JSX string and watch it render against the
 * allow-list in real time. Half-typed/unclosed tags are treated as INCOMPLETE
 * (not invalid): the surface builds up via `completeJsxTag` and the error box
 * stays hidden — no more flashing red while you type (loading-states.md). Only a
 * *settled, genuinely malformed* input surfaces `JSXPreviewError`. Tags outside
 * the allow-list don't render.
 */
function EditableDemo() {
  const [jsx, setJsx] = useState(
    '<div className="grid grid-cols-2 gap-3">\n' +
      '  <Stat label="Revenue" value="$1.2M" delta="+12%" />\n' +
      '  <Callout tone="success">On track for Q3</Callout>\n' +
      "</div>",
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-meta text-muted-foreground" htmlFor="agent-jsx">
          Agent JSX (edit me)
        </label>
        <Textarea
          className="font-mono text-code"
          id="agent-jsx"
          onChange={(e) => setJsx(e.target.value)}
          rows={8}
          spellCheck={false}
          value={jsx}
        />
      </div>
      <JSXPreview components={allow} jsx={jsx}>
        <JSXPreviewSkeleton />
        <JSXPreviewContent />
        <JSXPreviewError />
      </JSXPreview>
    </div>
  );
}

export const Editable: Story = {
  render: () => <EditableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText(/agent jsx/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '<Callout tone="success">Shipped it</Callout>');
    await canvas.findByText("Shipped it");
  },
};

/**
 * Data bindings — the JSX references `{values}` resolved from the `bindings` prop,
 * so the agent can emit a fixed template and you inject the data.
 */
export const DataBindings: Story = {
  render: () => (
    <JSXPreview
      bindings={{ revenue: "$1.2M", delta: "+12%", users: "48.2k", churn: "1.8%" }}
      components={allow}
      jsx={
        '<div className="grid grid-cols-3 gap-3">' +
        '<Stat label="Revenue" value={revenue} delta={delta} />' +
        '<Stat label="Users" value={users} />' +
        '<Stat label="Churn" value={churn} />' +
        "</div>"
      }
    >
      <JSXPreviewContent />
    </JSXPreview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The values come from `bindings`, not the markup.
    await expect(canvas.getByText("$1.2M")).toBeInTheDocument();
    await expect(canvas.getByText("48.2k")).toBeInTheDocument();
  },
};

/**
 * LOADING — fetch-then-show. Before any JSX has arrived, `loading` puts the
 * preview in its `pending` state and `JSXPreviewSkeleton` renders a layout-shaped
 * placeholder (a status live region for AT) instead of a blank or an error. Once
 * the content arrives, it swaps in.
 */
function LoadingDemo() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="space-y-3">
      <Button onClick={() => setLoading((l) => !l)} size="sm" variant="outline" type="button">
        {loading ? "Finish loading" : "Reset to loading"}
      </Button>
      <JSXPreview components={allow} jsx={loading ? "" : DASHBOARD} loading={loading}>
        <JSXPreviewSkeleton />
        <JSXPreviewContent />
      </JSXPreview>
    </div>
  );
}

export const Loading: Story = {
  render: () => <LoadingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The skeleton's live region is present while loading; no content yet.
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(canvas.queryByText("Revenue")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /finish loading/i }));
    await canvas.findByText("Revenue");
  },
};

/**
 * TERMINAL error — a *settled, syntactically complete* input that is still
 * invalid (here a broken `{)}` expression). This is the ONLY case that surfaces
 * `JSXPreviewError`; incomplete/streaming input never does.
 */
export const TerminalError: Story = {
  name: "Terminal error",
  render: () => (
    <JSXPreview components={allow} jsx={'<Stat label="Revenue" value={)} />'}>
      <JSXPreviewSkeleton />
      <JSXPreviewContent />
      <JSXPreviewError />
    </JSXPreview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("alert");
  },
};
