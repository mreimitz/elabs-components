/**
 * AI Chart block (copy-owned).
 *
 * The canonical place to render a model's chart tool-output inside an AI
 * conversation — composing BOTH sibling packages:
 *   - @qlik-coe-emea/qlabs-components-ai  (chat surface: Message, Tool, ToolHeader, ToolContent, ToolOutput)
 *   - @qlik-coe-emea/qlabs-components-charts  (smart chart: AutoChart + ChartSpec)
 *
 * WHY a registry block, not a package: the one-way dependency rule
 * (tokens → ui → data/ai/charts/…) prevents any bare package from importing a
 * sibling (DEP_DIRECTION_VIOLATION). Copy-owned registry blocks are explicitly
 * exempt — they live outside the package graph and may compose any number of
 * installed @qlik-coe-emea/qlabs-components-* siblings. This is the same pattern as
 * registry/blocks/chart-frame-data/ (@qlik-coe-emea/qlabs-components-charts + @qlik-coe-emea/qlabs-components-data).
 *
 * The app owns the real model call; the tool output used here is sample data.
 * Swap `sampleSpec` and `sampleInput` for your own tool-call payload.
 *
 * ── Integration paths ────────────────────────────────────────────────────────
 *
 * PATH 1 — zero-code recipe (recommended):
 *   Pass a pre-rendered element to ToolOutput.output so the chart is displayed
 *   directly.  ToolOutput JSON-dumps non-element objects, so pass the element,
 *   not the raw ChartSpec:
 *
 *     <ToolOutput
 *       output={<AutoChart spec={toolPart.output as ChartSpec} />}
 *       errorText={undefined}
 *     />
 *
 * PATH 2 — spec-as-data (when the streamed tool output IS a ChartSpec object):
 *   The model emits the spec as its tool result; the block casts and wraps it:
 *
 *     const spec = toolPart.output as unknown as ChartSpec;
 *     <ToolOutput output={<AutoChart spec={spec} />} errorText={undefined} />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client";

import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@qlik-coe-emea/qlabs-components-ai";
import { AutoChart, type ChartSpec } from "@qlik-coe-emea/qlabs-components-charts";

// ---------------------------------------------------------------------------
// Sample data — replace with your tool-call payload in a real app.
// ---------------------------------------------------------------------------

const sampleSpec: ChartSpec = {
  type: "bar",
  title: "Monthly Revenue",
  description: "Revenue vs profit by month for the current year",
  x: "month",
  series: [
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
  ],
  data: [
    { month: "Jan", revenue: 12000, profit: 4500 },
    { month: "Feb", revenue: 15500, profit: 5200 },
    { month: "Mar", revenue: 11000, profit: 3800 },
    { month: "Apr", revenue: 18500, profit: 7100 },
    { month: "May", revenue: 16800, profit: 5400 },
    { month: "Jun", revenue: 21200, profit: 8800 },
  ],
};

const sampleInput = {
  metric: "revenue",
  groupBy: "month",
  range: "ytd",
};

// ---------------------------------------------------------------------------
// AiChartBlock
// ---------------------------------------------------------------------------

/**
 * AiChartBlock — a minimal but realistic AI conversation that demonstrates a
 * model calling a "render_chart" tool and rendering the result with AutoChart.
 *
 * Swap the hard-coded messages and `sampleSpec` for your live data.
 */
export function AiChartBlock() {
  return (
    <Conversation className="h-[600px] rounded-lg border bg-background">
      <ConversationContent>
        {/* User turn */}
        <Message from="user">
          <MessageContent>Show me revenue and profit by month so far this year.</MessageContent>
        </Message>

        {/* Assistant turn — includes a tool call + text summary */}
        <Message from="assistant">
          <MessageContent>
            {/* Tool call: render_chart — state "output-available" (completed) */}
            <Tool defaultOpen>
              <ToolHeader type="tool-render_chart" state="output-available" title="render_chart" />
              <ToolContent>
                {/* The tool's input params (what the model asked for). */}
                <ToolInput input={sampleInput} />

                {/* PATH 1: pass a pre-rendered element so ToolOutput renders
                    it directly instead of JSON-dumping the raw object. */}
                <ToolOutput
                  output={<AutoChart spec={sampleSpec} height={280} />}
                  errorText={undefined}
                />
              </ToolContent>
            </Tool>

            {/* Assistant text summary after the chart */}
            <p className="text-sm text-muted-foreground">
              Revenue peaked in June at <span className="font-medium text-foreground">$21,200</span>{" "}
              with a corresponding profit of{" "}
              <span className="font-medium text-foreground">$8,800</span>. Overall the trend is
              positive — both metrics climbed steadily from Q1 through Q2.
            </p>
          </MessageContent>
        </Message>
      </ConversationContent>
    </Conversation>
  );
}
